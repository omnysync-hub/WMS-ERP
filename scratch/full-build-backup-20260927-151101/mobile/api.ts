import axios, { AxiosRequestConfig } from "axios";
import { Alert, Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import { enqueueMutation } from "@/services/syncService";
import { isMobileAccessDisabledResponse } from "@/services/loginErrors";

/** Android emulator → host machine. Physical device: set EXPO_PUBLIC_API_URL to LAN IP. */
export const DEFAULT_ERP_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ||
  (Platform.OS === "android" ? "http://10.0.2.2:3001" : "http://localhost:3001");

/** Mutable for Switch Tenant — also mirrored into SecureStore key `wms_api_url`. */
export let ERP_BASE_URL = DEFAULT_ERP_BASE_URL;

export function setErpBaseUrl(url: string) {
  ERP_BASE_URL = url.replace(/\/$/, "");
  apiClient.defaults.baseURL = ERP_BASE_URL;
}

export const apiClient = axios.create({
  baseURL: ERP_BASE_URL,
  timeout: 15000,
  headers: { "Content-Type": "application/json" },
});

apiClient.interceptors.request.use(async (config) => {
  const override = await SecureStore.getItemAsync("wms_api_url");
  if (override && override !== apiClient.defaults.baseURL) {
    setErpBaseUrl(override);
    config.baseURL = ERP_BASE_URL;
  }
  const token = await SecureStore.getItemAsync("wms_auth_token");
  if (token) {
    const { isSignedMobileToken } = await import("@/services/authToken");
    if (!isSignedMobileToken(token)) {
      await SecureStore.deleteItemAsync("wms_auth_token");
    } else {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

let handlingAccessDisabled = false;

apiClient.interceptors.response.use(
  (res) => res,
  async (error) => {
    if (!axios.isAxiosError(error) || !error.response) {
      return Promise.reject(error);
    }

    const status = error.response.status;
    const url = String(error.config?.url ?? "");
    const method = String(error.config?.method ?? "").toLowerCase();
    const isLoginPost =
      method === "post" &&
      (url.endsWith("/api/mobile/auth") || /\/api\/mobile\/auth(\?|$)/.test(url));

    if (isLoginPost) {
      return Promise.reject(error);
    }

    if (
      !handlingAccessDisabled &&
      isMobileAccessDisabledResponse(status, error.response.data)
    ) {
      const { useAuthStore } = await import("@/store/authStore");
      if (useAuthStore.getState().isAuthenticated) {
        handlingAccessDisabled = true;
        try {
          const { stopTelemetry } = await import("@/services/telemetryService");
          stopTelemetry();
          await useAuthStore.getState().logout();
          Alert.alert(
            "Access disabled",
            "Your mobile access has been disabled — contact your admin/HR"
          );
        } finally {
          handlingAccessDisabled = false;
        }
      }
    }

    return Promise.reject(error);
  }
);

/** Queue write mutations when offline; callers pass `offlineQueue: true`. */
export async function apiRequest<T = unknown>(
  config: AxiosRequestConfig & { offlineQueue?: boolean }
): Promise<T> {
  try {
    const res = await apiClient.request<T>(config);
    return res.data;
  } catch (err: unknown) {
    const isNetwork =
      axios.isAxiosError(err) && (!err.response || err.code === "ERR_NETWORK");
    if (config.offlineQueue && isNetwork && config.method && config.url) {
      await enqueueMutation({
        endpoint: config.url,
        method: config.method.toUpperCase(),
        payload: config.data ?? {},
      });
      return { queued: true } as T;
    }
    throw err;
  }
}

export const api = {
  login: (credentials: {
    username?: string;
    phone?: string;
    email?: string;
    employeeId?: string;
    password: string;
  }) => apiClient.post("/api/mobile/auth", credentials),

  getProfile: (employeeId: string) =>
    apiClient.get(`/api/mobile/auth?employeeId=${employeeId}`),

  registerPushToken: (data: {
    employeeId: string;
    token: string;
    platform: string;
    deviceModel: string;
    osVersion: string;
    appVersion?: string;
  }) => apiClient.post("/api/mobile/push-token", data),

  getRequests: (technicianId: string, limit = 20) =>
    apiClient.get(`/api/mobile/requests`, { params: { technicianId, limit } }),

  respondRequest: (
    requestId: string,
    data: {
      employeeId: string;
      actionStatus: "accepted" | "rejected" | "acknowledged";
      notes?: string;
      etaMinutes?: number;
    }
  ) => apiClient.post(`/api/mobile/requests/${requestId}/respond`, data),

  sendTelemetry: (data: {
    employeeId: string;
    lat: number;
    lng: number;
    accuracy: number;
    batteryLevel: number;
    isMoving: boolean;
    speed: number;
    source?: string;
    timestamp?: string;
  }) =>
    apiRequest({
      method: "POST",
      url: "/api/mobile/telemetry",
      data,
      offlineQueue: true,
    }),

  getLocationConsent: (employeeId?: string) =>
    apiClient.get("/api/mobile/consent", {
      params: employeeId ? { employeeId } : undefined,
    }),

  acknowledgeLocationConsent: (data: {
    employeeId?: string;
    deviceModel?: string;
    policyVersion?: string;
  }) => apiClient.post("/api/mobile/consent", data),

  getJobs: (technicianId: string, status?: string) =>
    apiClient.get(`/api/jobs`, { params: { technicianId, status } }),

  getJob: (jobId: string) => apiClient.get(`/api/jobs/${jobId}`),

  updateJobStatus: (jobId: string, payload: Record<string, unknown>) =>
    apiRequest({
      method: "PATCH",
      url: `/api/jobs/${jobId}`,
      data: payload,
      offlineQueue: true,
    }),

  claimJobExpense: (
    jobId: string,
    data: {
      technicianId: string;
      amount: number;
      note: string;
      receiptUrl?: string;
    }
  ) =>
    apiRequest({
      method: "POST",
      url: `/api/jobs/${jobId}/expense`,
      data,
      offlineQueue: true,
    }),

  requestJobInventory: (
    jobId: string,
    data: { technicianId: string; item: string; qtyRequested: number }
  ) =>
    apiRequest({
      method: "POST",
      url: `/api/jobs/${jobId}/inventory-request`,
      data,
      offlineQueue: true,
    }),

  returnJobStock: (
    jobId: string,
    data: { technicianId: string; item: string; qtyReturned: number }
  ) =>
    apiRequest({
      method: "POST",
      url: `/api/jobs/${jobId}/stock-return`,
      data,
      offlineQueue: true,
    }),

  getInventoryProducts: () => apiClient.get("/api/inventory"),

  getTechnicianLedger: (technicianId: string) =>
    apiClient.get("/api/accounts", {
      params: { view: "technicians", technicianId },
    }),

  getEssEmployee: (employeeId: string) =>
    apiClient.get(`/api/hrm/employees/${employeeId}`),

  raiseGrievance: (data: {
    employeeId: string;
    category: string;
    description: string;
  }) =>
    apiClient.post("/api/hrm/grievances", {
      action: "raise",
      ...data,
    }),

  getLeaves: (employeeId: string) =>
    apiClient.get(`/api/mobile/leaves?employeeId=${employeeId}`),

  submitLeave: (data: {
    employeeId: string;
    leaveTypeId?: string;
    leaveType?: string;
    startDate: string;
    endDate: string;
    reason: string;
  }) => apiClient.post("/api/mobile/leaves", data),

  getGeofenceZones: (activeOnly = true, employeeId?: string) =>
    apiClient.get(`/api/geofence-zones`, {
      params: {
        activeOnly: activeOnly ? "true" : "false",
        ...(employeeId ? { employeeId } : {}),
      },
    }),

  punchAttendance: (data: {
    employeeId: string;
    geofenceZoneId?: string;
    lat: number;
    lng: number;
    timestamp: string;
    faceMatchScore: number;
    livenessScore?: number;
    deviceId: string;
    notes?: string;
  }) =>
    apiRequest({
      method: "POST",
      url: "/api/attendance",
      data,
      offlineQueue: true,
    }),

  getAttendanceHistory: (employeeId: string, limit = 50) =>
    apiClient.get(`/api/attendance`, { params: { employeeId, limit } }),

  enrollFace: (
    employeeId: string,
    data: {
      embedding: number[];
      enrolledAt?: string;
      actorName?: string;
      actorRole?: string;
      actorId?: string;
    }
  ) => apiClient.post(`/api/employees/${employeeId}/enrollment`, data),

  getEnrollmentStatus: (employeeId: string, includeEmbedding = false) =>
    apiClient.get(`/api/employees/${employeeId}/enrollment`, {
      params: includeEmbedding ? { includeEmbedding: "true" } : undefined,
    }),
};
