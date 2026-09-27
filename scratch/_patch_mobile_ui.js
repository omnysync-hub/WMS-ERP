const fs = require("fs");
const root = "D:/WMS-APP 1/workman-mobile";

// JobCard hints
{
  const path = root + "/components/job/JobCard.tsx";
  let s = fs.readFileSync(path, "utf8");
  if (!s.includes("TechnicianReassigned")) {
    s = s.replace(
      `  if (s === "Cancelled") return "Cancelled";
  return "Tap to open";`,
      `  if (s === "Cancelled") return "Cancelled";
  if (s === "TechnicianReassigned") return "Reassigned — open successor job";
  return "Tap to open";`
    );
  }
  if (!s.includes("assignments?.length")) {
    s = s.replace(
      `<StatusBadge label={job.status} friendly />`,
      `<View style={{ alignItems: "flex-end", gap: 4 }}>
            <StatusBadge label={job.status} friendly />
            {(job.assignments?.length || 0) > 1 ? (
              <Text style={{ color: colors.textDim, fontSize: 10, fontWeight: "700" }}>
                {job.assignments!.length} techs
              </Text>
            ) : null}
          </View>`
    );
  }
  fs.writeFileSync(path, s);
  console.log("JobCard updated");
}

// Job detail — reassigned banner + technicianId on accept
{
  const path = root + "/app/jobs/[id].tsx";
  let s = fs.readFileSync(path, "utf8");
  // accept with technicianId
  s = s.replace(
    `onAccept={() =>
          mutation.mutate({ action: "accept", actor: employee?.name ?? "Technician" })
        }`,
    `onAccept={() =>
          mutation.mutate({
            action: "accept",
            actor: employee?.name ?? "Technician",
            technicianId: employee?.id,
          })
        }`
  );

  if (!s.includes("TechnicianReassigned")) {
    s = s.replace(
      `  const showQuickActions =
    job.status === "Assigned" ||
    job.status === "Accepted" ||
    job.status === "InProgress" ||
    job.status === "Paused";`,
      `  const showQuickActions =
    job.status === "Assigned" ||
    job.status === "Accepted" ||
    job.status === "InProgress" ||
    job.status === "Paused";

  const isReassigned = job.status === "TechnicianReassigned";
  const successor = (job.childJobs && job.childJobs[0]) || null;`
    );

    s = s.replace(
      `<StatusBadge label={job.status} friendly />
        </View>

        <Card style={{ marginTop: 14, borderRadius: 18, gap: 10 }}>`,
      `<StatusBadge label={job.status} friendly />
        </View>

        {isReassigned && (
          <Card style={{ marginTop: 14, borderRadius: 18, gap: 8, backgroundColor: colors.surfaceElevated }}>
            <Text style={{ color: colors.text, fontWeight: "800", fontSize: 15 }}>
              This job was reassigned
            </Text>
            <Text style={{ color: colors.textMuted, fontSize: 13, lineHeight: 18 }}>
              Historical data is preserved. Continue on the successor work order
              {successor ? \` \${successor.jobNumber}\` : ""}.
            </Text>
            {successor ? (
              <Pressable
                onPress={() => router.push(\`/jobs/\${successor.id}\`)}
                style={{ marginTop: 4 }}
              >
                <Text style={{ color: colors.primary, fontWeight: "800" }}>
                  Open {successor.jobNumber} →
                </Text>
              </Pressable>
            ) : null}
          </Card>
        )}

        {(job.assignments?.length || 0) > 0 && !isReassigned && (
          <Card style={{ marginTop: 14, borderRadius: 18, gap: 6 }}>
            <Text style={{ color: colors.textDim, fontSize: 11, fontWeight: "800", letterSpacing: 0.6 }}>
              ASSIGNED TECHNICIANS
            </Text>
            {job.assignments!.map((a) => (
              <Text key={a.id} style={{ color: colors.text, fontSize: 13 }}>
                {a.technician?.name || a.technicianId}
                {a.role === "primary" ? " · lead" : " · assistant"}
                {a.status ? \` · \${a.status}\` : ""}
              </Text>
            ))}
          </Card>
        )}

        <Card style={{ marginTop: 14, borderRadius: 18, gap: 10 }}>`
    );

    // Ensure Pressable imported
    if (!s.includes("Pressable") && s.includes('from "react-native"')) {
      s = s.replace(
        /import \{([^}]+)\} from "react-native"/,
        (m, inner) => {
          if (inner.includes("Pressable")) return m;
          return `import {${inner.trim().replace(/,$/, "")}, Pressable } from "react-native"`;
        }
      );
    }

    // Hide toolbar when reassigned
    s = s.replace(
      `<JobActionToolbar
        status={job.status}
        loading={mutation.isPending}`,
      `{!isReassigned && (
      <JobActionToolbar
        status={job.status}
        loading={mutation.isPending}`
    );
    s = s.replace(
      `        }
      />
    </View>
  );
}`,
      `        }
      />
      )}
    </View>
  );
}`
    );
  }
  fs.writeFileSync(path, s);
  console.log("job detail updated");
}

// Jobs list batch accept UI
{
  const path = root + "/app/(tabs)/index.tsx";
  let s = fs.readFileSync(path, "utf8");
  if (!s.includes("batchAcceptJobs")) {
    s = s.replace(
      `import { fetchJobs } from "@/services/jobsService";`,
      `import { batchAcceptJobs, fetchJobs } from "@/services/jobsService";
import { useMutation, useQueryClient } from "@tanstack/react-query";`
    );
    // might duplicate useQuery import - check
    if ((s.match(/from "@tanstack\/react-query"/g) || []).length > 1) {
      s = s.replace(
        `import { useQuery } from "@tanstack/react-query";\nimport { Bell } from "lucide-react-native";
import { JobCard } from "@/components/job/JobCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { InlineBanner } from "@/components/ui/InlineBanner";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { batchAcceptJobs, fetchJobs } from "@/services/jobsService";
import { useMutation, useQueryClient } from "@tanstack/react-query";`,
        `import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell } from "lucide-react-native";
import { JobCard } from "@/components/job/JobCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { InlineBanner } from "@/components/ui/InlineBanner";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { batchAcceptJobs, fetchJobs } from "@/services/jobsService";`
      );
    } else {
      s = s.replace(
        `import { useQuery } from "@tanstack/react-query";`,
        `import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";`
      );
      // remove duplicate if we added useMutation line separately
      s = s.replace(
        `import { batchAcceptJobs, fetchJobs } from "@/services/jobsService";
import { useMutation, useQueryClient } from "@tanstack/react-query";`,
        `import { batchAcceptJobs, fetchJobs } from "@/services/jobsService";`
      );
    }

    s = s.replace(
      `  const [filter, setFilter] = useState<(typeof FILTERS)[number]["id"]>("All");
  const isTechnician = employee?.role === "technician";`,
      `  const [filter, setFilter] = useState<(typeof FILTERS)[number]["id"]>("All");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectMode, setSelectMode] = useState(false);
  const queryClient = useQueryClient();
  const isTechnician = employee?.role === "technician";`
    );

    s = s.replace(
      `  const jobs: Job[] = useMemo(() => {
    const list = jobsQuery.data ?? [];
    if (filter === "All") return list;
    if (filter === "Completed") {
      return list.filter((j) =>
        String(j.status).toLowerCase().includes("completed")
      );
    }
    return list.filter((j) => j.status === filter);
  }, [jobsQuery.data, filter]);`,
      `  const jobs: Job[] = useMemo(() => {
    const list = (jobsQuery.data ?? []).filter(
      (j) => j.status !== "TechnicianReassigned"
    );
    if (filter === "All") return list;
    if (filter === "Completed") {
      return list.filter((j) =>
        String(j.status).toLowerCase().includes("completed")
      );
    }
    return list.filter((j) => j.status === filter);
  }, [jobsQuery.data, filter]);

  const assignedJobs = useMemo(
    () => jobs.filter((j) => j.status === "Assigned"),
    [jobs]
  );

  const batchMutation = useMutation({
    mutationFn: () => batchAcceptJobs(selectedIds, employee!.id),
    onSuccess: async () => {
      setSelectedIds([]);
      setSelectMode(false);
      await queryClient.invalidateQueries({ queryKey: ["jobs"] });
    },
  });

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };`
    );

    // Add batch UI above FlatList
    s = s.replace(
      `{jobsQuery.isLoading ? (
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
      )}`,
      `{assignedJobs.length > 0 ? (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: space.md,
            gap: space.sm,
          }}
        >
          <Pressable
            onPress={() => {
              void haptic.select();
              setSelectMode((v) => !v);
              setSelectedIds([]);
            }}
            style={{
              paddingHorizontal: space.md,
              minHeight: tapMin,
              justifyContent: "center",
              borderRadius: radius.full,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: selectMode ? colors.primary : colors.surface,
            }}
          >
            <Text style={{ color: colors.text, fontWeight: "800", fontSize: 13 }}>
              {selectMode ? "Cancel select" : "Select jobs"}
            </Text>
          </Pressable>
          {selectMode ? (
            <Pressable
              disabled={selectedIds.length === 0 || batchMutation.isPending}
              onPress={() => {
                void haptic.tap();
                batchMutation.mutate();
              }}
              style={{
                paddingHorizontal: space.lg,
                minHeight: tapMin,
                justifyContent: "center",
                borderRadius: radius.full,
                backgroundColor:
                  selectedIds.length === 0 ? colors.surface : colors.primary,
                opacity: selectedIds.length === 0 ? 0.5 : 1,
              }}
            >
              <Text style={{ color: "#fff", fontWeight: "900", fontSize: 13 }}>
                {batchMutation.isPending
                  ? "Accepting…"
                  : \`Accept \${selectedIds.length || ""}\`.trim()}
              </Text>
            </Pressable>
          ) : (
            <Text style={{ color: colors.textDim, fontSize: 12 }}>
              {assignedJobs.length} waiting to accept
            </Text>
          )}
        </View>
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
          renderItem={({ item }) => (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              {selectMode && item.status === "Assigned" ? (
                <Pressable
                  onPress={() => toggleSelect(item.id)}
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 8,
                    borderWidth: 2,
                    borderColor: selectedIds.includes(item.id)
                      ? colors.primary
                      : colors.border,
                    backgroundColor: selectedIds.includes(item.id)
                      ? colors.primary
                      : "transparent",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Text style={{ color: "#fff", fontWeight: "900" }}>
                    {selectedIds.includes(item.id) ? "✓" : ""}
                  </Text>
                </Pressable>
              ) : null}
              <View style={{ flex: 1 }}>
                <JobCard job={item} />
              </View>
            </View>
          )}
        />
      )}`
    );
  }
  fs.writeFileSync(path, s);
  console.log("jobs list batch UI updated");
}
