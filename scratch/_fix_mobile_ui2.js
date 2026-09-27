const fs = require("fs");
const root = "D:/WMS-APP 1/workman-mobile";

// --- tabs index batch accept ---
{
  const path = root + "/app/(tabs)/index.tsx";
  let s = fs.readFileSync(path, "utf8").replace(/^\uFEFF/, "");
  const had = s.includes("\r\n");
  s = s.replace(/\r\n/g, "\n");

  if (!s.includes("useMutation")) {
    s = s.replace(
      'import { useQuery } from "@tanstack/react-query";',
      'import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";'
    );
  }
  if (!s.includes("batchAcceptJobs")) {
    s = s.replace(
      'import { fetchJobs } from "@/services/jobsService";',
      'import { batchAcceptJobs, fetchJobs } from "@/services/jobsService";'
    );
  }

  if (!s.includes("selectMode")) {
    s = s.replace(
      '  const [filter, setFilter] = useState<(typeof FILTERS)[number]["id"]>("All");\n  const isTechnician = employee?.role === "technician";',
      '  const [filter, setFilter] = useState<(typeof FILTERS)[number]["id"]>("All");\n  const [selectedIds, setSelectedIds] = useState<string[]>([]);\n  const [selectMode, setSelectMode] = useState(false);\n  const queryClient = useQueryClient();\n  const isTechnician = employee?.role === "technician";'
    );

    const oldJobs = `  const jobs: Job[] = useMemo(() => {
    const list = jobsQuery.data ?? [];
    if (filter === "All") return list;
    if (filter === "Completed") {
      return list.filter((j) =>
        String(j.status).toLowerCase().includes("completed")
      );
    }
    return list.filter((j) => j.status === filter);
  }, [jobsQuery.data, filter]);

  if (employee && !isTechnician) {`;

    const newJobs = `  const jobs: Job[] = useMemo(() => {
    const list = (jobsQuery.data ?? []).filter((j) => j.status !== "TechnicianReassigned");
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
  };

  if (employee && !isTechnician) {`;

    if (!s.includes(oldJobs)) throw new Error("jobs useMemo block not found");
    s = s.replace(oldJobs, newJobs);

    const oldList = `      {jobsQuery.isLoading ? (
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
      )}`;

    const newList = `      {assignedJobs.length > 0 ? (
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
                backgroundColor: selectedIds.length === 0 ? colors.surface : colors.primary,
                opacity: selectedIds.length === 0 ? 0.5 : 1,
              }}
            >
              <Text style={{ color: "#fff", fontWeight: "900", fontSize: 13 }}>
                {batchMutation.isPending
                  ? "Accepting..."
                  : "Accept " + selectedIds.length}
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
                    borderColor: selectedIds.includes(item.id) ? colors.primary : colors.border,
                    backgroundColor: selectedIds.includes(item.id) ? colors.primary : "transparent",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Text style={{ color: "#fff", fontWeight: "900" }}>
                    {selectedIds.includes(item.id) ? "OK" : ""}
                  </Text>
                </Pressable>
              ) : null}
              <View style={{ flex: 1 }}>
                <JobCard job={item} />
              </View>
            </View>
          )}
        />
      )}`;

    if (!s.includes(oldList)) throw new Error("FlatList block not found");
    s = s.replace(oldList, newList);
    console.log("tabs index batch UI applied");
  } else {
    console.log("tabs index already has selectMode");
  }

  if (had) s = s.replace(/\n/g, "\r\n");
  fs.writeFileSync(path, s);
}

// --- job detail reassigned + technicianId ---
{
  const path = root + "/app/jobs/[id].tsx";
  let s = fs.readFileSync(path, "utf8").replace(/^\uFEFF/, "");
  const had = s.includes("\r\n");
  s = s.replace(/\r\n/g, "\n");

  // ensure Pressable import
  if (!/\bPressable\b/.test(s.split("from \"react-native\"")[0])) {
    s = s.replace(
      /import \{([\s\S]*?)\} from "react-native"/,
      (m, inner) => {
        if (inner.includes("Pressable")) return m;
        return 'import {' + inner.replace(/\s+$/, "") + ", Pressable } from \"react-native\"";
      }
    );
  }

  if (!s.includes("isReassigned")) {
    const oldShow = `  const showQuickActions =
    job.status === "Assigned" ||
    job.status === "Accepted" ||
    job.status === "InProgress" ||
    job.status === "Paused";

  const customer = job.customerName ?? job.customer?.name;`;
    const newShow = `  const showQuickActions =
    job.status === "Assigned" ||
    job.status === "Accepted" ||
    job.status === "InProgress" ||
    job.status === "Paused";

  const isReassigned = job.status === "TechnicianReassigned";
  const successor = (job.childJobs && job.childJobs[0]) || null;

  const customer = job.customerName ?? job.customer?.name;`;
    if (!s.includes(oldShow)) throw new Error("showQuickActions block not found");
    s = s.replace(oldShow, newShow);

    const badgeAnchor = `<StatusBadge label={job.status} friendly />
        </View>

        <Card style={{ marginTop: 14, borderRadius: 18, gap: 10 }}>`;
    const badgeWith = `<StatusBadge label={job.status} friendly />
        </View>

        {isReassigned ? (
          <Card style={{ marginTop: 14, borderRadius: 18, gap: 8, backgroundColor: colors.surfaceElevated }}>
            <Text style={{ color: colors.text, fontWeight: "800", fontSize: 15 }}>
              This job was reassigned
            </Text>
            <Text style={{ color: colors.textMuted, fontSize: 13, lineHeight: 18 }}>
              Historical data is preserved. Continue on the successor work order
              {successor ? " " + successor.jobNumber : ""}.
            </Text>
            {successor ? (
              <Pressable onPress={() => router.push("/jobs/" + successor.id)} style={{ marginTop: 4 }}>
                <Text style={{ color: colors.primary, fontWeight: "800" }}>
                  Open {successor.jobNumber}
                </Text>
              </Pressable>
            ) : null}
          </Card>
        ) : null}

        {(job.assignments?.length || 0) > 0 && !isReassigned ? (
          <Card style={{ marginTop: 14, borderRadius: 18, gap: 6 }}>
            <Text style={{ color: colors.textDim, fontSize: 11, fontWeight: "800", letterSpacing: 0.6 }}>
              ASSIGNED TECHNICIANS
            </Text>
            {job.assignments!.map((a) => (
              <Text key={a.id} style={{ color: colors.text, fontSize: 13 }}>
                {(a.technician && a.technician.name) || a.technicianId}
                {a.role === "primary" ? " · lead" : " · assistant"}
                {a.status ? " · " + a.status : ""}
              </Text>
            ))}
          </Card>
        ) : null}

        <Card style={{ marginTop: 14, borderRadius: 18, gap: 10 }}>`;
    if (!s.includes(badgeAnchor)) throw new Error("badge anchor not found");
    s = s.replace(badgeAnchor, badgeWith);

    // wrap toolbar
    if (!s.includes("{!isReassigned && (")) {
      s = s.replace(
        `<JobActionToolbar
        status={job.status}
        loading={mutation.isPending}
        onAccept={() =>
          mutation.mutate({ action: "accept", actor: employee?.name ?? "Technician" })
        }`,
        `{!isReassigned && (
      <JobActionToolbar
        status={job.status}
        loading={mutation.isPending}
        onAccept={() =>
          mutation.mutate({
            action: "accept",
            actor: employee?.name ?? "Technician",
            technicianId: employee?.id,
          })
        }`
      );
      // close wrapper before final View close
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
    console.log("job detail reassigned UI applied");
  } else {
    // still ensure technicianId on accept
    if (!s.includes("technicianId: employee?.id")) {
      s = s.replace(
        'mutation.mutate({ action: "accept", actor: employee?.name ?? "Technician" })',
        'mutation.mutate({ action: "accept", actor: employee?.name ?? "Technician", technicianId: employee?.id })'
      );
      console.log("added technicianId to accept");
    } else console.log("job detail already patched");
  }

  if (had) s = s.replace(/\n/g, "\r\n");
  fs.writeFileSync(path, s);
}