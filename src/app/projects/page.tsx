"use client";

import React, { useEffect, useState } from "react";
import PageHeader from "@/components/layout/PageHeader";
import StatusBadge from "@/components/ui/StatusBadge";
import ProgressRing from "@/components/ui/ProgressRing";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import {
  FolderKanban,
  CheckCircle2,
  ListTodo,
  Plus,
  User,
  ChevronRight,
  Briefcase,
  Layers,
  Calendar,
  X,
} from "lucide-react";

export default function ProjectsPage() {
  const [projects, setProjects] = useState<any[]>([]);
  const [selectedProject, setSelectedProject] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // New task modal
  const [showNewTaskModal, setShowNewTaskModal] = useState(false);
  const [taskTitle, setTaskTitle] = useState("");
  const [taskBoqItemId, setTaskBoqItemId] = useState("");

  async function loadProjects() {
    try {
      setLoading(true);
      const res = await fetch("/api/projects");
      const data = await res.json();
      if (Array.isArray(data)) {
        setProjects(data);
        if (!selectedProject && data.length > 0) {
          setSelectedProject(data[0]);
        } else if (selectedProject) {
          const updated = data.find((p) => p.id === selectedProject.id);
          if (updated) setSelectedProject(updated);
        }
      }
    } catch (e) {
      console.error("Failed loading projects", e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadProjects();
  }, []);

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProject || !taskTitle.trim()) return;

    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create_task",
          projectId: selectedProject.id,
          boqItemId: taskBoqItemId || null,
          title: taskTitle.trim(),
        }),
      });
      if (!res.ok) throw new Error("Failed to create task");
      setShowNewTaskModal(false);
      setTaskTitle("");
      loadProjects();
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleUpdateTaskStatus = async (taskId: string, status: string) => {
    try {
      await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update_task_status",
          taskId,
          status,
        }),
      });
      loadProjects();
    } catch (e) {
      console.error(e);
    }
  };

  const completedTasks = (selectedProject?.tasks || []).filter(
    (t: any) => t.status === "Verified" || t.status === "Completed"
  ).length;
  const totalTasks = (selectedProject?.tasks || []).length;
  const progressPercent = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 35;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Enterprise Page Header */}
      <PageHeader
        breadcrumbs={[{ label: "Projects & BOQ" }]}
        title="Project Management & BOQ Schedules"
        subtitle="Commercial contracts, Bill of Quantities (BOQ) and task state-machine milestone tracking"
        badge={
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
            <FolderKanban className="w-3.5 h-3.5 text-[#0D7A5F]" />
            Commercial Operations
          </span>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Project Selector Directory */}
        <div className="space-y-4">
          <h3 className="text-xs font-bold text-[#18181B] uppercase tracking-wider">
            Commercial Contracts Directory
          </h3>
          <div className="space-y-2.5">
            {projects.map((proj) => {
              const isSelected = selectedProject?.id === proj.id;
              return (
                <button
                  type="button"
                  key={proj.id}
                  onClick={() => setSelectedProject(proj)}
                  className={`w-full text-left bg-white rounded-xl border p-4 transition shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0D7A5F] ${
                    isSelected
                      ? "border-[#0D7A5F] ring-1 ring-[#0D7A5F]"
                      : "border-[#E4E4E7] hover:border-[#D4D4D8]"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-xs text-[#0D7A5F]">
                      {proj.projectNumber}
                    </span>
                    <StatusBadge status={proj.status} />
                  </div>
                  <h4 className="text-xs font-bold text-[#18181B] mt-1.5 leading-snug">
                    {proj.name}
                  </h4>
                  <p className="text-[11px] text-[#71717A] mt-0.5">
                    Client: {proj.customer?.name}
                  </p>
                  <div className="mt-3 pt-2.5 border-t border-[#E4E4E7] flex items-center justify-between text-xs">
                    <span className="text-[#71717A] text-[11px]">Contract Budget:</span>
                    <span className="font-mono font-bold text-[#18181B]">
                      {formatCurrency(proj.totalBudget)}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right: Selected Project BOQ & Task Execution */}
        {selectedProject && (
          <div className="lg:col-span-2 space-y-6">
            {/* Project Overview Card with Progress Ring */}
            <div className="bg-white rounded-xl border border-[#E4E4E7] p-5 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-6">
              <div>
                <span className="text-xs font-bold font-mono text-[#0D7A5F] bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                  {selectedProject.projectNumber}
                </span>
                <h2 className="text-base font-bold text-[#18181B] mt-2">
                  {selectedProject.name}
                </h2>
                <p className="text-xs text-[#52525B] mt-1">
                  Customer: <span className="font-semibold text-[#18181B]">{selectedProject.customer?.name}</span>
                </p>
                <p className="text-[11px] text-[#71717A] mt-0.5">
                  Timeline: {formatDateTime(selectedProject.startDate)} → {formatDateTime(selectedProject.endDate)}
                </p>
              </div>

              <div className="shrink-0">
                <ProgressRing
                  percentage={progressPercent}
                  label="Milestone Progress"
                  sublabel={`${completedTasks} of ${totalTasks} tasks verified`}
                  size={110}
                />
              </div>
            </div>

            {/* BOQ Schedule Dense Table */}
            <div className="bg-white rounded-xl border border-[#E4E4E7] shadow-xs overflow-hidden">
              <div className="px-5 py-3.5 bg-[#FAFAFA] border-b border-[#E4E4E7]">
                <h3 className="text-xs font-bold text-[#18181B] uppercase tracking-wider">
                  Bill of Quantities (BOQ) Schedule
                </h3>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-[#E4E4E7] text-[11px] font-semibold text-[#71717A] uppercase tracking-wider bg-[#F4F4F5]">
                      <th className="py-2.5 px-4">BOQ Code</th>
                      <th className="py-2.5 px-4">Description</th>
                      <th className="py-2.5 px-4 text-center">Unit</th>
                      <th className="py-2.5 px-4 text-center">Planned Qty</th>
                      <th className="py-2.5 px-4 text-right">Unit Rate</th>
                      <th className="py-2.5 px-4 text-right">Scheduled Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E4E4E7]">
                    {selectedProject.boqItems?.map((item: any) => (
                      <tr key={item.id} className="hover:bg-[#FAFAFA]">
                        <td className="py-3 px-4 font-mono font-bold text-[#18181B]">
                          {item.itemCode}
                        </td>
                        <td className="py-3 px-4 font-medium text-[#18181B]">
                          {item.description}
                        </td>
                        <td className="py-3 px-4 text-center text-[#71717A] uppercase text-[11px]">
                          {item.unit}
                        </td>
                        <td className="py-3 px-4 text-center font-mono font-bold text-[#18181B]">
                          {item.plannedQty}
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-[#52525B]">
                          {formatCurrency(item.unitRate)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-[#0D7A5F]">
                          {formatCurrency(item.plannedQty * item.unitRate)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Project Tasks Reusing State Machine */}
            <div className="bg-white rounded-xl border border-[#E4E4E7] shadow-xs overflow-hidden">
              <div className="px-5 py-3.5 bg-[#FAFAFA] border-b border-[#E4E4E7] flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold text-[#18181B] uppercase tracking-wider">
                    Task Milestone Execution
                  </h3>
                  <p className="text-[11px] text-[#71717A] mt-0.5">
                    Tasks reuse the Job state machine (Created → Assigned → InProgress → Completed → Verified).
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowNewTaskModal(true)}
                  className="h-8 px-3 rounded-lg bg-[#0D7A5F] hover:bg-[#0A624C] text-white text-xs font-semibold inline-flex items-center gap-1.5 transition shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0D7A5F]"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Task
                </button>
              </div>

              <div className="divide-y divide-[#E4E4E7]">
                {!selectedProject.tasks || selectedProject.tasks.length === 0 ? (
                  <p className="text-xs text-[#71717A] py-8 text-center">
                    No milestone tasks added yet. Click "+ Add Task" to begin milestone tracking.
                  </p>
                ) : (
                  selectedProject.tasks.map((task: any) => (
                    <div
                      key={task.id}
                      className="p-4 hover:bg-[#FAFAFA] transition flex items-center justify-between"
                    >
                      <div>
                        <p className="text-xs font-bold text-[#18181B]">{task.title}</p>
                        <p className="text-[11px] text-[#71717A] mt-0.5">
                          Assigned: {task.assignedTechnician?.name || "Unassigned"}
                        </p>
                      </div>

                      <div className="flex items-center gap-3">
                        <StatusBadge status={task.status} />
                        {task.status !== "Verified" && (
                          <select
                            value={task.status}
                            onChange={(e) => handleUpdateTaskStatus(task.id, e.target.value)}
                            className="bg-white text-xs p-1 rounded-md border border-[#D4D4D8] focus:ring-2 focus:ring-[#0D7A5F] text-[#18181B] font-medium"
                          >
                            <option value="Created">Created</option>
                            <option value="Assigned">Assigned</option>
                            <option value="InProgress">InProgress</option>
                            <option value="Completed">Completed</option>
                            <option value="Verified">Verified</option>
                          </select>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* NEW TASK MODAL */}
      {showNewTaskModal && selectedProject && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in duration-150"
          role="dialog"
          aria-modal="true"
          aria-labelledby="task-dialog-title"
          onKeyDown={(e) => {
            if (e.key === "Escape") setShowNewTaskModal(false);
          }}
        >
          <div className="bg-white rounded-xl max-w-sm w-full p-6 space-y-4 shadow-xl border border-[#E4E4E7]">
            <div className="flex items-center justify-between pb-2 border-b border-[#E4E4E7]">
              <h3 id="task-dialog-title" className="text-sm font-bold text-[#18181B] flex items-center gap-2">
                <ListTodo className="w-4 h-4 text-[#0D7A5F]" />
                Add BOQ Milestone Task
              </h3>
              <button
                type="button"
                onClick={() => setShowNewTaskModal(false)}
                className="text-[#71717A] hover:text-[#18181B] p-1 rounded hover:bg-[#F4F4F5] transition"
                aria-label="Close dialog"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateTask} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-[#71717A] block mb-1">
                  Task Title *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Coil flush on AHU #3"
                  value={taskTitle}
                  onChange={(e) => setTaskTitle(e.target.value)}
                  className="w-full bg-[#FAFAFA] p-2 rounded-lg text-xs border border-[#D4D4D8] focus:ring-2 focus:ring-[#0D7A5F] focus:outline-none text-[#18181B]"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-[#71717A] block mb-1">
                  Link to BOQ Item (Optional)
                </label>
                <select
                  value={taskBoqItemId}
                  onChange={(e) => setTaskBoqItemId(e.target.value)}
                  className="w-full bg-[#FAFAFA] p-2 rounded-lg text-xs border border-[#D4D4D8] focus:ring-2 focus:ring-[#0D7A5F] focus:outline-none text-[#18181B]"
                >
                  <option value="">None (Independent Task)</option>
                  {selectedProject.boqItems?.map((it: any) => (
                    <option key={it.id} value={it.id}>
                      {it.itemCode} — {it.description}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#E4E4E7]">
                <button
                  type="button"
                  onClick={() => setShowNewTaskModal(false)}
                  className="px-3 py-1.5 text-xs text-[#71717A] hover:text-[#18181B] font-semibold rounded hover:bg-[#F4F4F5] transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#0D7A5F] hover:bg-[#0A624C] text-white rounded-lg text-xs font-bold transition shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0D7A5F]"
                >
                  Create Task
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
