"use client";

import React, { useState } from "react";
import { formatDate } from "@/lib/utils";
import {
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
  User,
  Sliders,
  Sparkles,
  ChevronRight,
  Plus,
  Layers,
  ArrowRight,
} from "lucide-react";

interface Technician {
  id: string;
  name: string;
}

interface ProjectTask {
  id: string;
  projectId: string;
  boqItemId?: string | null;
  boqItem?: { itemCode: string; description: string } | null;
  title: string;
  description?: string | null;
  status: string;
  assignedTechnicianId?: string | null;
  assignedTechnician?: Technician | null;
  startDate?: string | null;
  dueDate?: string | null;
  estimatedHours?: number;
  actualHours?: number;
  progressPercent?: number;
  priority?: string;
  dependencies?: string | null;
  createdAt: string;
}

interface ProjectGanttTabProps {
  projectId: string;
  tasks: ProjectTask[];
  technicians: Technician[];
  onRefresh: () => void;
  showToast: (msg: string, type: "success" | "error" | "info") => void;
  onOpenAddTask: () => void;
}

export default function ProjectGanttTab({
  projectId,
  tasks,
  technicians,
  onRefresh,
  showToast,
  onOpenAddTask,
}: ProjectGanttTabProps) {
  const [editingTask, setEditingTask] = useState<ProjectTask | null>(null);
  const [progressVal, setProgressVal] = useState<number>(0);
  const [savingProgress, setSavingProgress] = useState(false);

  // Quick update task progress
  async function handleUpdateTaskGantt(task: ProjectTask, newProgress: number) {
    try {
      setSavingProgress(true);
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update_task_gantt",
          taskId: task.id,
          progressPercent: newProgress,
          status: newProgress === 100 ? "Completed" : newProgress > 0 ? "InProgress" : task.status,
        }),
      });

      if (!res.ok) throw new Error("Failed to update schedule progress.");
      showToast(`Task "${task.title}" progress set to ${newProgress}%`, "success");
      onRefresh();
    } catch (err: any) {
      showToast(err.message, "error");
    } finally {
      setSavingProgress(false);
      setEditingTask(null);
    }
  }

  // Calculate project overall completion based on task progresses
  const avgProgress = tasks.length > 0
    ? Math.round(tasks.reduce((sum, t) => sum + (t.progressPercent || (t.status === "Completed" ? 100 : 0)), 0) / tasks.length)
    : 0;

  return (
    <div className="space-y-6">
      {/* Schedule Header & Overall Progress */}
      <div className="bg-white p-5 rounded-xl border border-[#E4E4E7] shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-[#18181B]">Interactive Timeline & Gantt Schedule</h3>
            <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
              {avgProgress}% Project Completion
            </span>
          </div>
          <p className="text-xs text-[#71717A]">
            Track task schedule durations, technician labor hours, dependencies, and completion percentages.
          </p>
        </div>

        <button
          type="button"
          onClick={onOpenAddTask}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-[#0D7A5F] hover:bg-[#0A634D] text-white rounded-lg text-xs font-bold transition shadow-xs self-end md:self-auto"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add Task to Timeline</span>
        </button>
      </div>

      {/* Task Gantt Matrix */}
      <div className="bg-white rounded-xl border border-[#E4E4E7] shadow-xs overflow-hidden">
        <div className="p-4 bg-[#FAFAFA] border-b border-[#E4E4E7] flex items-center justify-between">
          <span className="text-xs font-bold text-[#52525B]">Work Breakdown Structure & Progress Matrix</span>
          <span className="text-xs text-[#71717A]">{tasks.length} Scheduled Tasks</span>
        </div>

        {tasks.length === 0 ? (
          <div className="p-12 text-center space-y-2">
            <Clock className="w-8 h-8 text-[#A1A1AA] mx-auto" />
            <div className="text-xs font-bold text-[#18181B]">No Schedule Tasks Added Yet</div>
            <p className="text-xs text-[#71717A]">
              Add execution tasks linked to BOQ items to map your project gantt timeline.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-[#E4E4E7]">
            {tasks.map((task) => {
              const currentProgress = task.progressPercent ?? (task.status === "Completed" ? 100 : 0);
              const priorityColor =
                task.priority === "critical"
                  ? "bg-rose-100 text-rose-800 border-rose-200"
                  : task.priority === "high"
                  ? "bg-amber-100 text-amber-800 border-amber-200"
                  : "bg-blue-100 text-blue-800 border-blue-200";

              return (
                <div key={task.id} className="p-4.5 hover:bg-[#FAFAFA] transition space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-[#18181B]">{task.title}</span>
                        {task.boqItem && (
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-[#F4F4F5] text-[#0D7A5F] border border-[#E4E4E7]">
                            {task.boqItem.itemCode}
                          </span>
                        )}
                        <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${priorityColor}`}>
                          {task.priority || "Normal"} Priority
                        </span>
                      </div>
                      {task.description && (
                        <p className="text-xs text-[#71717A]">{task.description}</p>
                      )}
                    </div>

                    <div className="flex items-center gap-3 text-xs">
                      {task.assignedTechnician ? (
                        <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-teal-50 text-teal-800 border border-teal-200 font-medium">
                          <User className="w-3.5 h-3.5" />
                          <span>{task.assignedTechnician.name}</span>
                        </span>
                      ) : (
                        <span className="text-[11px] text-[#A1A1AA] italic">Unassigned</span>
                      )}

                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          task.status === "Completed"
                            ? "bg-emerald-100 text-emerald-800"
                            : task.status === "InProgress"
                            ? "bg-blue-100 text-blue-800"
                            : "bg-[#F4F4F5] text-[#52525B]"
                        }`}
                      >
                        {task.status}
                      </span>
                    </div>
                  </div>

                  {/* Dates & Hours Bar */}
                  <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-[#71717A]">
                    <div className="flex items-center gap-4">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-[#A1A1AA]" />
                        <span>Start: {task.startDate ? formatDate(task.startDate) : "Not set"}</span>
                      </span>
                      <span>→</span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-[#A1A1AA]" />
                        <span>Due: {task.dueDate ? formatDate(task.dueDate) : "Not set"}</span>
                      </span>
                      {task.estimatedHours ? (
                        <span>• Est: {task.estimatedHours} hrs</span>
                      ) : null}
                    </div>

                    {/* Interactive Progress Slider */}
                    <div className="flex items-center gap-2.5 w-full sm:w-64">
                      <span className="text-[11px] font-bold text-[#18181B] w-8">
                        {currentProgress}%
                      </span>
                      <div className="grow relative">
                        <input
                          type="range"
                          min="0"
                          max="100"
                          step="5"
                          value={editingTask?.id === task.id ? progressVal : currentProgress}
                          onChange={(e) => {
                            setEditingTask(task);
                            setProgressVal(Number(e.target.value));
                          }}
                          onMouseUp={() => {
                            if (editingTask?.id === task.id) {
                              handleUpdateTaskGantt(task, progressVal);
                            }
                          }}
                          onTouchEnd={() => {
                            if (editingTask?.id === task.id) {
                              handleUpdateTaskGantt(task, progressVal);
                            }
                          }}
                          className="w-full accent-[#0D7A5F] cursor-pointer"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Timeline Bar Visualizer */}
                  <div className="w-full bg-[#E4E4E7] h-2 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        currentProgress === 100
                          ? "bg-emerald-600"
                          : currentProgress > 50
                          ? "bg-[#0D7A5F]"
                          : "bg-blue-600"
                      }`}
                      style={{ width: `${Math.min(100, currentProgress)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
