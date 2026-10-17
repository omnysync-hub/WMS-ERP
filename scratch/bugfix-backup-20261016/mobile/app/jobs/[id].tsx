import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  ScrollView,
  Text,
  View,
  Pressable,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Location from "expo-location";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Banknote,
  Package,
  Percent,
  Wrench,
} from "lucide-react-native";
import { InventoryList, ServicesList } from "@/components/job/JobItemList";
import { JobOverviewCard } from "@/components/job/JobOverviewCard";
import { JobInventorySections } from "@/components/job/JobInventorySections";
import { calculateJobBilling, formatMoney, technicianJobStatus } from "@/lib/jobLineFormat";
import { JobActionToolbar } from "@/components/job/JobActionToolbar";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Card } from "@/components/ui/Card";
import { fetchJob, transitionJob } from "@/services/jobsService";
import { stopContinuousJobRing, markJobAsAccepted } from "@/services/jobAssignmentAlert";
import { useAuthStore } from "@/store/authStore";
import { colors } from "@/constants/theme";
import { toast } from "@/store/toastStore";
import { haptic } from "@/lib/haptics";
import type { JobItem } from "@/types";

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
    if (query.data?.status && query.data.status !== "Assigned") {
      void markJobAsAccepted(id);
    }
  }, [query.data, id]);

  const mutation = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const action = String(payload.action ?? "");
      if (action === "accept") {
        await markJobAsAccepted(id, undefined, employee?.id);
      }
      return transitionJob(id!, payload);
    },
    onSuccess: async (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["job", id] });
      qc.invalidateQueries({ queryKey: ["jobs"] });
      qc.invalidateQueries({ queryKey: ["requests"] });
      const action = String(vars.action ?? "");
      if (action === "accept") {
        await markJobAsAccepted(id, undefined, employee?.id);
        toast("Job accepted", "success");
      }
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

  const job = query.data;

  if (query.isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: "center" }}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  if (!job) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, padding: 16 }}>
        <Text style={{ color: colors.textDim }}>Job not found.</Text>
      </View>
    );
  }

  const isReassigned = job.status === "TechnicianReassigned";
  const successor = (job.childJobs && job.childJobs[0]) || null;
  const statusView = technicianJobStatus(String(job.status));
  const showTeam = (job.assignments?.length || 0) > 1 && !isReassigned;
  const billing = calculateJobBilling(job, items);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 10 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.text, fontSize: 22, fontWeight: "900" }}>
              {job.jobNumber}
            </Text>
            {statusView.label === "Done" ? (
              <Text style={{ color: colors.textMuted, marginTop: 4, fontSize: 13 }}>
                Finished on your side
              </Text>
            ) : null}
          </View>
          {statusView.showBadge ? (
            <StatusBadge label={statusView.label} friendly />
          ) : statusView.label === "Done" ? (
            <Text style={{ color: colors.success, fontWeight: "800", fontSize: 14 }}>Done</Text>
          ) : null}
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 170 }}>
        {isReassigned ? (
          <Card style={{ marginBottom: 14, borderRadius: 18, gap: 8, backgroundColor: colors.surfaceElevated }}>
            <Text style={{ color: colors.text, fontWeight: "800", fontSize: 15 }}>
              This job was reassigned
            </Text>
            <Text style={{ color: colors.textMuted, fontSize: 13, lineHeight: 18 }}>
              Continue on the successor work order
              {successor ? ` ${successor.jobNumber}` : ""}.
            </Text>
            {successor ? (
              <Pressable
                onPress={() =>
                  router.push({ pathname: "/jobs/[id]", params: { id: successor.id } })
                }
              >
                <Text style={{ color: colors.primary, fontWeight: "800" }}>
                  Open {successor.jobNumber}
                </Text>
              </Pressable>
            ) : null}
          </Card>
        ) : null}

        {showTeam ? (
          <Card style={{ marginBottom: 14, borderRadius: 18, gap: 6 }}>
            <Text
              style={{
                color: colors.textDim,
                fontSize: 11,
                fontWeight: "800",
                letterSpacing: 0.6,
              }}
            >
              ASSIGNED TECHNICIANS
            </Text>
            {job.assignments!.map((a) => (
              <Text key={a.id} style={{ color: colors.text, fontSize: 13 }}>
                {(a.technician && a.technician.name) || a.technicianId}
                {a.role === "primary" ? " · lead" : " · assistant"}
                {a.status ? ` · ${a.status}` : ""}
              </Text>
            ))}
          </Card>
        ) : null}

        <JobOverviewCard job={job} />


        {/* Services & Equipment Section */}
        <Card style={{ marginTop: 18, borderRadius: 18, gap: 12 }}>
          <View style={{ gap: 4 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <View
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 8,
                  backgroundColor: "#2563EB20",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Wrench size={16} color="#2563EB" />
              </View>
              <Text
                style={{
                  color: colors.text,
                  fontWeight: "900",
                  fontSize: 16,
                  letterSpacing: 0.8,
                }}
              >
                SERVICES & EQUIPMENT
              </Text>
            </View>
            <Text style={{ color: colors.textDim, fontSize: 12, lineHeight: 18 }}>
              Equipment specifications, billable services, and labor on this job.
            </Text>
          </View>

          <ServicesList
            items={items}
            editable={job.status === "InProgress"}
            onChangeRate={(itemId, rate) =>
              setItems((prev) =>
                prev.map((it) =>
                  it.id === itemId ? { ...it, unitRate: rate, unitPrice: rate } : it
                )
              )
            }
            onChangeActual={(itemId, qty) =>
              setItems((prev) =>
                prev.map((it) =>
                  it.id === itemId ? { ...it, quantityActual: qty, quantityPlanned: qty } : it
                )
              )
            }
            onRemove={(itemId) =>
              setItems((prev) => prev.filter((it) => it.id !== itemId))
            }
          />

          <Button
            title="Add service"
            size="md"
            icon={<Wrench size={18} color="#fff" />}
            onPress={() =>
              router.push({
                pathname: "/jobs/add-services",
                params: { jobId: id, jobNumber: job.jobNumber },
              })
            }
            style={{ backgroundColor: "#2563EB", marginTop: 4 }}
          />
        </Card>

        {/* Inventory Section */}
        <Card style={{ marginTop: 18, borderRadius: 18, gap: 12 }}>
          <View style={{ gap: 4 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <View
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 8,
                  backgroundColor: colors.primaryMuted,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Package size={16} color={colors.primary} />
              </View>
              <Text
                style={{
                  color: colors.text,
                  fontWeight: "900",
                  fontSize: 16,
                  letterSpacing: 0.8,
                }}
              >
                PARTS & MATERIALS (INVENTORY)
              </Text>
            </View>
            <Text style={{ color: colors.textDim, fontSize: 12, lineHeight: 18 }}>
              Stock items and materials. Set how much you used and track line prices.
            </Text>
          </View>

          <InventoryList
            items={items}
            editable={job.status === "InProgress"}
            onChangeActual={(itemId, qty) =>
              setItems((prev) =>
                prev.map((it) => (it.id === itemId ? { ...it, quantityActual: qty } : it))
              )
            }
            onRemove={(itemId) =>
              setItems((prev) => prev.filter((it) => it.id !== itemId))
            }
            onDiscountPress={(item) =>
              router.push({
                pathname: "/jobs/discount-modal",
                params: { jobId: id, itemId: item.id },
              })
            }
          />

          <View style={{ flexDirection: "row", gap: 10, marginTop: 6 }}>
            <Button
              title="Request discount"
              size="md"
              icon={<Percent size={18} color="#fff" />}
              onPress={() =>
                router.push({
                  pathname: "/jobs/discount-modal",
                  params: { jobId: id },
                })
              }
              style={{ flex: 1, backgroundColor: "#BE123C" }}
            />
            <Button
              title="Need parts"
              size="md"
              icon={<Package size={18} color="#fff" />}
              onPress={() =>
                router.push({
                  pathname: "/jobs/inventory-request",
                  params: { jobId: id, jobNumber: job.jobNumber },
                })
              }
              style={{
                flex: 1,
                backgroundColor: colors.surfaceElevated,
                borderWidth: 1,
                borderColor: colors.border,
              }}
            />
          </View>
        </Card>

        {/* Job Billing & Total Summary Card */}
        <Card style={{ marginTop: 18, borderRadius: 18, gap: 12 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <View
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 8,
                  backgroundColor: colors.primaryMuted,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Banknote size={16} color={colors.primary} />
              </View>
              <Text
                style={{
                  color: colors.text,
                  fontWeight: "900",
                  fontSize: 16,
                  letterSpacing: 0.8,
                }}
              >
                JOB BILLING & TOTAL
              </Text>
            </View>
            <Text style={{ color: colors.primary, fontWeight: "900", fontSize: 18 }}>
              {formatMoney(billing.netTotal)}
            </Text>
          </View>

          <View
            style={{
              backgroundColor: colors.surface,
              borderRadius: 12,
              padding: 12,
              gap: 8,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Text style={{ color: colors.textDim, fontSize: 13 }}>Services & Labor</Text>
              <Text style={{ color: colors.text, fontWeight: "700", fontSize: 13 }}>
                {formatMoney(billing.servicesTotal)}
              </Text>
            </View>
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Text style={{ color: colors.textDim, fontSize: 13 }}>Parts & Materials</Text>
              <Text style={{ color: colors.text, fontWeight: "700", fontSize: 13 }}>
                {formatMoney(billing.materialsTotal)}
              </Text>
            </View>
            {billing.totalDiscount > 0 ? (
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={{ color: colors.success, fontSize: 13, fontWeight: "700" }}>Approved Discount</Text>
                <Text style={{ color: colors.success, fontWeight: "800", fontSize: 13 }}>
                  - {formatMoney(billing.totalDiscount)}
                </Text>
              </View>
            ) : null}
            <View style={{ height: 1, backgroundColor: colors.border, marginVertical: 2 }} />
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Text style={{ color: colors.text, fontWeight: "800", fontSize: 14 }}>Total to Collect</Text>
              <Text style={{ color: colors.text, fontWeight: "900", fontSize: 16 }}>
                {formatMoney(billing.netTotal)}
              </Text>
            </View>
          </View>
        </Card>

        <View style={{ marginTop: 18 }}>
          <JobInventorySections job={job} items={items} />
        </View>
      </ScrollView>

      {!isReassigned && (
        <JobActionToolbar
          status={job.status}
          loading={mutation.isPending}
          onAccept={() =>
            mutation.mutate({
              action: "accept",
              actor: employee?.name ?? "Technician",
              technicianId: employee?.id,
            })
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
      )}
    </View>
  );
}
