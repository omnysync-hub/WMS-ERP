import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  ScrollView,
  Text,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Location from "expo-location";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Package,
  PhoneCall,
  Receipt,
  Percent,
  MapPin,
  UserRound,
  BadgePercent,
} from "lucide-react-native";
import { JobItemList } from "@/components/job/JobItemList";
import { JobActionToolbar } from "@/components/job/JobActionToolbar";
import { JobQuickAction, JobQuickActionRow } from "@/components/job/JobQuickAction";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Card } from "@/components/ui/Card";
import { fetchJob, transitionJob } from "@/services/jobsService";
import { useAuthStore } from "@/store/authStore";
import { colors } from "@/constants/theme";
import { OFFICE, STOREKEEPER } from "@/constants/storekeeper";
import { toast } from "@/store/toastStore";
import { haptic } from "@/lib/haptics";
import type { JobItem } from "@/types";

function callStorekeeper() {
  if (!STOREKEEPER.phone) {
    void haptic.warn();
    Alert.alert(
      "No store number",
      "Ask admin to set the storekeeper phone in the app."
    );
    return;
  }
  void haptic.press();
  void Linking.openURL(`tel:${STOREKEEPER.phone}`);
}

function callOfficeForDiscount() {
  if (!OFFICE.phone) {
    void haptic.warn();
    Alert.alert(
      "No office number",
      "Ask admin to set the office phone, or use Ask for discount to send a request."
    );
    return;
  }
  void haptic.press();
  void Linking.openURL(`tel:${OFFICE.phone}`);
}

export default function JobDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const employee = useAuthStore((s) => s.employee);
  const [items, setItems] = useState<JobItem[]>([]);

  const query = useQuery({
    queryKey: ["job", id],
    enabled: !!id,
    queryFn: () => fetchJob(id!),
  });

  useEffect(() => {
    if (query.data?.items) setItems(query.data.items);
  }, [query.data]);

  const mutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) => transitionJob(id!, payload),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["job", id] });
      qc.invalidateQueries({ queryKey: ["jobs"] });
      const action = String(vars.action ?? "");
      if (action === "accept") toast("Job accepted", "success");
      else if (action === "start") toast("Started on site", "success");
      else if (action === "resume") toast("Work resumed", "success");
    },
    onError: (e: Error) => {
      void haptic.error();
      Alert.alert("Couldn't do that", e.message);
    },
  });

  async function withGps(action: string) {
    const { status } = await Location.requestForegroundPermissionsAsync();
    let lat: number | undefined;
    let lng: number | undefined;
    if (status === "granted") {
      const loc = await Location.getCurrentPositionAsync({});
      lat = loc.coords.latitude;
      lng = loc.coords.longitude;
    }
    await mutation.mutateAsync({
      action,
      lat,
      lng,
      actor: employee?.name ?? "Technician",
    });
  }

  if (query.isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: "center" }}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  const job = query.data;
  if (!job) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, padding: 16 }}>
        <Text style={{ color: colors.textDim }}>Job not found.</Text>
      </View>
    );
  }

  const showQuickActions =
    job.status === "Assigned" ||
    job.status === "Accepted" ||
    job.status === "InProgress" ||
    job.status === "Paused";

  const customer = job.customerName ?? job.customer?.name;
  const address = job.address ?? job.customer?.address;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 170 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 10 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.text, fontSize: 24, fontWeight: "900" }}>
              {job.jobNumber}
            </Text>
            <Text style={{ color: colors.textMuted, marginTop: 4, fontSize: 14, lineHeight: 20 }}>
              {job.status === "Assigned"
                ? "Accept this job to get started."
                : job.status === "Accepted"
                  ? "Start when you arrive on site."
                  : job.status === "InProgress"
                    ? "Log parts, pause, or mark done below."
                    : job.status === "Paused"
                      ? "Resume when you’re ready to continue."
                      : "Job details"}
            </Text>
          </View>
          <StatusBadge label={job.status} friendly />
        </View>

        <Card style={{ marginTop: 14, borderRadius: 18, gap: 10 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <View
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                backgroundColor: colors.surfaceElevated,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <UserRound size={18} color={colors.primary} />
            </View>
            <Text style={{ color: colors.text, fontSize: 16, fontWeight: "700", flex: 1 }}>
              {customer}
            </Text>
          </View>
          {!!address && (
            <View style={{ flexDirection: "row", gap: 10, alignItems: "flex-start" }}>
              <MapPin size={16} color={colors.textDim} style={{ marginTop: 2 }} />
              <Text style={{ color: colors.textMuted, flex: 1, lineHeight: 20 }}>{address}</Text>
            </View>
          )}
        </Card>

        {showQuickActions && (
          <>
            <Text
              style={{
                color: colors.textDim,
                fontSize: 12,
                fontWeight: "800",
                letterSpacing: 0.8,
                marginTop: 22,
                marginBottom: 4,
              }}
            >
              QUICK ACTIONS
            </Text>
            <JobQuickActionRow>
              <JobQuickAction
                title="Call storekeeper"
                subtitle={
                  STOREKEEPER.displayPhone
                    ? `Ring ${STOREKEEPER.displayPhone}`
                    : STOREKEEPER.name
                }
                tone="blue"
                icon={<PhoneCall size={22} color="#fff" />}
                onPress={callStorekeeper}
              />
              <JobQuickAction
                title="Call for discount"
                subtitle={
                  OFFICE.displayPhone
                    ? `Ring office · ${OFFICE.displayPhone}`
                    : "Ring the office"
                }
                tone="rose"
                icon={<BadgePercent size={22} color="#fff" />}
                onPress={callOfficeForDiscount}
              />
              <JobQuickAction
                title="Need parts"
                subtitle="Send list to store"
                tone="green"
                icon={<Package size={22} color="#fff" />}
                onPress={() =>
                  router.push({
                    pathname: "/jobs/inventory-request",
                    params: { jobId: id, jobNumber: job.jobNumber },
                  })
                }
              />
              <JobQuickAction
                title="Ask for discount"
                subtitle="Send request in app"
                tone="rose"
                icon={<Percent size={22} color="#fff" />}
                onPress={() =>
                  router.push({
                    pathname: "/jobs/discount-modal",
                    params: {
                      jobId: id,
                      itemsJson: JSON.stringify(items),
                    },
                  })
                }
              />
              <JobQuickAction
                title="Log expense"
                subtitle="Money you spent"
                tone="amber"
                icon={<Receipt size={22} color="#fff" />}
                onPress={() =>
                  router.push({ pathname: "/expenses/new", params: { jobId: id } })
                }
              />
            </JobQuickActionRow>
          </>
        )}

        <Card style={{ marginTop: 18, borderRadius: 18 }}>
          <Text style={{ color: colors.text, fontWeight: "800", fontSize: 16, marginBottom: 4 }}>
            Materials
          </Text>
          <Text style={{ color: colors.textDim, fontSize: 12, marginBottom: 12, lineHeight: 18 }}>
            {job.status === "InProgress"
              ? "Change the numbers if you used less or more."
              : "Parts planned for this job."}
          </Text>
          <JobItemList
            items={items}
            editable={job.status === "InProgress"}
            onChangeActual={(itemId, qty) =>
              setItems((prev) =>
                prev.map((it) => (it.id === itemId ? { ...it, quantityActual: qty } : it))
              )
            }
          />
        </Card>
      </ScrollView>

      <JobActionToolbar
        status={job.status}
        loading={mutation.isPending}
        onAccept={() =>
          mutation.mutate({ action: "accept", actor: employee?.name ?? "Technician" })
        }
        onStart={() => void withGps("start")}
        onResume={() => void withGps("resume")}
        onPause={() =>
          router.push({
            pathname: "/jobs/pause-modal",
            params: { jobId: id },
          })
        }
        onComplete={() =>
          router.push({
            pathname: "/jobs/complete-modal",
            params: {
              jobId: id,
              itemsJson: JSON.stringify(items),
            },
          })
        }
      />
    </View>
  );
}
