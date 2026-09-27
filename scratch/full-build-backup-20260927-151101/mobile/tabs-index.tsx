import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  Text,
  View,
} from "react-native";
import { Redirect, useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { Bell } from "lucide-react-native";
import { JobCard } from "@/components/job/JobCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { InlineBanner } from "@/components/ui/InlineBanner";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { fetchJobs } from "@/services/jobsService";
import { fetchRequests } from "@/services/requestsService";
import { useAuthStore } from "@/store/authStore";
import { colors, radius, space, tapMin, type } from "@/constants/theme";
import { haptic } from "@/lib/haptics";
import type { Job } from "@/types";

const FILTERS = [
  { id: "All", label: "All" },
  { id: "Assigned", label: "New" },
  { id: "InProgress", label: "Working" },
  { id: "Paused", label: "Paused" },
  { id: "Completed", label: "Done" },
] as const;

export default function JobsScreen() {
  const router = useRouter();
  const employee = useAuthStore((s) => s.employee);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["id"]>("All");
  const isTechnician = employee?.role === "technician";
  const firstName = employee?.name?.trim().split(/\s+/)[0] ?? "there";

  const jobsQuery = useQuery({
    queryKey: ["jobs", employee?.id, filter],
    enabled: !!employee?.id && isTechnician,
    queryFn: () =>
      fetchJobs(
        employee!.id,
        filter === "All" ? undefined : filter === "Completed" ? "Completed" : filter
      ),
  });

  const requestsQuery = useQuery({
    queryKey: ["requests", employee?.id],
    enabled: !!employee?.id && isTechnician,
    queryFn: () => fetchRequests(employee!.id),
  });

  const unread = requestsQuery.data?.unreadCount ?? 0;

  const jobs: Job[] = useMemo(() => {
    const list = jobsQuery.data ?? [];
    if (filter === "All") return list;
    if (filter === "Completed") {
      return list.filter((j) =>
        String(j.status).toLowerCase().includes("completed")
      );
    }
    return list.filter((j) => j.status === filter);
  }, [jobsQuery.data, filter]);

  if (employee && !isTechnician) {
    return <Redirect href="/(tabs)/attendance" />;
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, padding: space.lg }}>
      <ScreenHeader
        title={`Hi, ${firstName}`}
        subtitle="Your jobs today — tap one to open it"
        right={
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Requests, ${unread} unread`}
            onPress={() => {
              void haptic.tap();
              router.push("/(tabs)/requests");
            }}
            style={{
              backgroundColor: unread > 0 ? colors.urgent : colors.surface,
              borderWidth: 1,
              borderColor: unread > 0 ? colors.urgent : colors.border,
              borderRadius: radius.md,
              paddingHorizontal: space.md,
              minHeight: tapMin,
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
            }}
          >
            <Bell size={18} color={unread > 0 ? "#fff" : colors.primary} />
            <Text
              style={{
                color: unread > 0 ? "#fff" : colors.text,
                fontWeight: "800",
                fontSize: 14,
              }}
            >
              {unread}
            </Text>
          </Pressable>
        }
      />

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm, marginBottom: space.lg }}>
        {FILTERS.map((f) => {
          const active = filter === f.id;
          return (
            <Pressable
              key={f.id}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              onPress={() => {
                void haptic.select();
                setFilter(f.id);
              }}
              style={{
                paddingHorizontal: space.lg,
                minHeight: tapMin,
                justifyContent: "center",
                borderRadius: radius.full,
                backgroundColor: active ? colors.primary : colors.surface,
                borderWidth: 1,
                borderColor: active ? colors.primary : colors.border,
              }}
            >
              <Text style={{ color: colors.text, ...type.label }}>{f.label}</Text>
            </Pressable>
          );
        })}
      </View>

      {jobsQuery.isError ? (
        <InlineBanner
          title="Couldn’t load jobs"
          detail="Pull down to try again, or check your connection."
          tone="error"
        />
      ) : null}

      {jobsQuery.isLoading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} size="large" />
      ) : (
        <FlatList
          data={jobs}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl
              refreshing={jobsQuery.isRefetching}
              onRefresh={() => jobsQuery.refetch()}
              tintColor={colors.primary}
            />
          }
          ListEmptyComponent={
            <EmptyState
              title="No jobs right now"
              message="Pull down to refresh, or try another filter."
            />
          }
          renderItem={({ item }) => <JobCard job={item} />}
        />
      )}
    </View>
  );
}
