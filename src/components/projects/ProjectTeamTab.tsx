"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Users, UserPlus, Trash2, Crown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useRole } from "@/contexts/RoleContext";

export interface ProjectTeamMember {
  id: string;
  employeeId: string;
  projectRole: string;
  employee?: { name: string; designation?: string | null } | null;
}

interface StaffOption {
  id: string;
  name: string;
  designation?: string;
}

interface ProjectTeamTabProps {
  projectId: string;
  managerId?: string | null;
  teamMembers: ProjectTeamMember[];
  /** Fallback staff list (technicians already loaded by the page) if the HRM employee list is unavailable. */
  fallbackEmployees: StaffOption[];
  onRefresh: () => void;
  showToast: (msg: string, type: "success" | "error" | "info") => void;
}

const PROJECT_ROLES = [
  { value: "pm", label: "Project Manager" },
  { value: "supervisor", label: "Supervisor" },
  { value: "foreman", label: "Foreman" },
  { value: "technician", label: "Technician" },
  { value: "member", label: "Member" },
];

const roleLabel = (value: string) =>
  PROJECT_ROLES.find((r) => r.value === value)?.label || value;

const selectCls =
  "h-8 px-2 text-xs bg-white border border-[#D4D4D8] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0D7A5F] text-[#18181B]";
const btnPrimary =
  "h-8 px-3 rounded-lg bg-[#0D7A5F] hover:bg-[#0A624C] text-white text-xs font-bold inline-flex items-center gap-1.5 transition shadow-xs disabled:opacity-50";

export default function ProjectTeamTab({
  projectId,
  managerId,
  teamMembers,
  fallbackEmployees,
  onRefresh,
  showToast,
}: ProjectTeamTabProps) {
  const { hasPermission } = useRole();
  const canAssign = hasPermission("projects.assign_team");

  const [employees, setEmployees] = useState<StaffOption[]>([]);
  const [pmSelection, setPmSelection] = useState<string>(managerId || "");
  const [newMemberId, setNewMemberId] = useState("");
  const [newMemberRole, setNewMemberRole] = useState("member");
  const [busy, setBusy] = useState(false);

  // Keep the PM select in sync when switching projects
  useEffect(() => {
    setPmSelection(managerId || "");
  }, [managerId, projectId]);

  // Load the full employee list (same source the HRM pages use); fall back to the page's technicians.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/hrm/employees");
        if (!res.ok) throw new Error("hrm employees unavailable");
        const data = await res.json();
        const list = Array.isArray(data) ? data : data?.employees;
        if (Array.isArray(list) && list.length > 0) {
          if (!cancelled) {
            setEmployees(
              list
                .filter((e: any) => e && e.id)
                .map((e: any) => ({
                  id: e.id,
                  name: e.name || "Unnamed",
                  designation: e.designation || e.role || undefined,
                }))
            );
          }
          return;
        }
        throw new Error("empty");
      } catch {
        if (!cancelled) setEmployees(fallbackEmployees);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const staffOptions = useMemo(() => {
    // Merge in any team members / PM not present in the loaded list so names always resolve
    const map = new Map<string, StaffOption>();
    employees.forEach((e) => map.set(e.id, e));
    fallbackEmployees.forEach((e) => {
      if (!map.has(e.id)) map.set(e.id, e);
    });
    teamMembers.forEach((m) => {
      if (!map.has(m.employeeId)) {
        map.set(m.employeeId, {
          id: m.employeeId,
          name: m.employee?.name || m.employeeId,
          designation: m.employee?.designation || undefined,
        });
      }
    });
    if (managerId && !map.has(managerId)) {
      const pmMember = teamMembers.find((m) => m.employeeId === managerId);
      map.set(managerId, {
        id: managerId,
        name: pmMember?.employee?.name || managerId,
        designation: pmMember?.employee?.designation || undefined,
      });
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [employees, fallbackEmployees, teamMembers, managerId]);

  const staffName = (id: string) =>
    staffOptions.find((s) => s.id === id)?.name ||
    teamMembers.find((m) => m.employeeId === id)?.employee?.name ||
    id;

  async function postAction(action: string, extra: Record<string, any>, successMsg: string) {
    try {
      setBusy(true);
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, projectId, ...extra }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Action failed");
      }
      showToast(successMsg, "success");
      onRefresh();
    } catch (e: any) {
      showToast(e.message || "Action failed", "error");
    } finally {
      setBusy(false);
    }
  }

  const handleAssignPm = () => {
    if (!pmSelection) {
      showToast("Select a Project Manager first.", "error");
      return;
    }
    postAction("assign_pm", { managerId: pmSelection }, "Project Manager assigned.");
  };

  const handleAddMember = () => {
    if (!newMemberId) {
      showToast("Select an employee to add to the team.", "error");
      return;
    }
    postAction(
      "set_team_member",
      { employeeId: newMemberId, projectRole: newMemberRole },
      "Team member saved."
    );
    setNewMemberId("");
  };

  return (
    <div className="bg-white rounded-xl border border-[#E4E4E7] shadow-xs overflow-hidden">
      <div className="p-4 bg-[#FAFAFA] border-b border-[#E4E4E7]">
        <h3 className="text-xs font-bold text-[#18181B] flex items-center gap-2">
          <Users className="w-4 h-4 text-[#0D7A5F]" />
          Project Team & Roles
        </h3>
        <p className="text-[11px] text-[#71717A] mt-0.5">
          Assign the Project Manager and build the site team. In-project roles control who leads,
          supervises and executes work on this project.
        </p>
      </div>

      <div className="p-4 space-y-5">
        {/* Project Manager */}
        <div className="flex flex-col sm:flex-row sm:items-end gap-3">
          <div className="flex-1">
            <label className="text-[10px] font-bold text-[#71717A] uppercase tracking-wider block mb-1">
              Project Manager
            </label>
            <select
              value={pmSelection}
              onChange={(e) => setPmSelection(e.target.value)}
              disabled={!canAssign}
              className={cn(selectCls, "w-full")}
            >
              <option value="">— Select Project Manager —</option>
              {staffOptions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                  {s.designation ? ` (${s.designation})` : ""}
                </option>
              ))}
            </select>
          </div>
          {canAssign && (
            <button type="button" onClick={handleAssignPm} disabled={busy} className={btnPrimary}>
              <Crown className="w-3.5 h-3.5" />
              Assign PM
            </button>
          )}
          {managerId && (
            <span className="text-[11px] text-[#52525B]">
              Current PM: <span className="font-bold text-[#18181B]">{staffName(managerId)}</span>
            </span>
          )}
        </div>

        {/* Team list */}
        <div>
          <h4 className="text-[11px] font-bold text-[#18181B] uppercase tracking-wider mb-2">
            Team Members ({teamMembers.length})
          </h4>
          {teamMembers.length === 0 ? (
            <p className="text-xs text-[#71717A] italic">
              No team members assigned yet. Add members below.
            </p>
          ) : (
            <div className="divide-y divide-[#E4E4E7] border border-[#E4E4E7] rounded-lg overflow-hidden">
              {teamMembers.map((member) => (
                <div
                  key={member.id}
                  className="flex flex-col sm:flex-row sm:items-center gap-2 px-3 py-2.5 bg-white"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-[#18181B] truncate">
                      {member.employee?.name || staffName(member.employeeId)}
                      {member.employeeId === managerId && (
                        <span className="ml-2 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-800 uppercase">
                          PM
                        </span>
                      )}
                    </p>
                    <p className="text-[10px] text-[#71717A]">
                      {member.employee?.designation || staffOptions.find((s) => s.id === member.employeeId)?.designation || ""}
                    </p>
                  </div>
                  <select
                    value={member.projectRole}
                    disabled={!canAssign || busy}
                    onChange={(e) =>
                      postAction(
                        "set_team_member",
                        { employeeId: member.employeeId, projectRole: e.target.value },
                        `Role updated to ${roleLabel(e.target.value)}.`
                      )
                    }
                    className={selectCls}
                  >
                    {PROJECT_ROLES.map((r) => (
                      <option key={r.value} value={r.value}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                  {canAssign && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        postAction(
                          "remove_team_member",
                          { employeeId: member.employeeId },
                          "Team member removed."
                        )
                      }
                      className="p-1.5 hover:bg-rose-50 rounded text-[#71717A] hover:text-rose-600 transition disabled:opacity-50"
                      title="Remove from team"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Add member */}
        {canAssign && (
          <div className="flex flex-col sm:flex-row sm:items-end gap-3 pt-1 border-t border-dashed border-[#E4E4E7]">
            <div className="flex-1">
              <label className="text-[10px] font-bold text-[#71717A] uppercase tracking-wider block mb-1">
                Add Team Member
              </label>
              <select
                value={newMemberId}
                onChange={(e) => setNewMemberId(e.target.value)}
                className={cn(selectCls, "w-full")}
              >
                <option value="">— Select employee —</option>
                {staffOptions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                    {s.designation ? ` (${s.designation})` : ""}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold text-[#71717A] uppercase tracking-wider block mb-1">
                Project Role
              </label>
              <select
                value={newMemberRole}
                onChange={(e) => setNewMemberRole(e.target.value)}
                className={selectCls}
              >
                {PROJECT_ROLES.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>
            <button type="button" onClick={handleAddMember} disabled={busy} className={btnPrimary}>
              <UserPlus className="w-3.5 h-3.5" />
              Add Member
            </button>
          </div>
        )}
        {!canAssign && (
          <p className="text-[11px] text-[#A1A1AA] italic flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5" /> You can view the team but need the
            &quot;Assign Project Team&quot; permission to change it.
          </p>
        )}
      </div>
    </div>
  );
}
