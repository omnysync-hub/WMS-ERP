"use client";

import React, { useEffect, useState, useMemo } from "react";
import PageHeader from "@/components/layout/PageHeader";
import StatusBadge from "@/components/ui/StatusBadge";
import ProgressRing from "@/components/ui/ProgressRing";
import SideDrawer from "@/components/ui/SideDrawer";
import SearchableSelect from "@/components/ui/SearchableSelect";
import ProjectProcurementDrawer from "@/components/projects/ProjectProcurementDrawer";
import BoqProgressModal from "@/components/projects/BoqProgressModal";
import ProjectBillingTab from "@/components/projects/ProjectBillingTab";
import ProjectGanttTab from "@/components/projects/ProjectGanttTab";
import ProjectChangeOrdersTab from "@/components/projects/ProjectChangeOrdersTab";
import { formatCurrency, formatDate, formatDateTime, cn } from "@/lib/utils";
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
  Search,
  Edit3,
  Trash2,
  Download,
  TrendingUp,
  AlertCircle,
  Filter,
  Sparkles,
  Calculator,
  PieChart,
  ArrowRight,
  Clock,
  Building,
  Check,
  FileSpreadsheet,
  RefreshCw,
  AlertTriangle,
  ArrowUpRight,
  Users,
  ShoppingCart,
  Receipt,
  GitBranch,
  DollarSign,
  Percent,
} from "lucide-react";

interface Customer {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  addressText?: string;
}

interface Technician {
  id: string;
  name: string;
  phone?: string;
  currentStatus?: string;
}

interface BOQItem {
  id: string;
  projectId: string;
  itemCode: string;
  description: string;
  unit: string;
  plannedQty: number;
  unitRate: number;
  category?: string;
  actualQty?: number;
  actualCost?: number;
  completedQty?: number;
  version?: number;
  changeOrderRef?: string | null;
  status?: string;
  tasks?: ProjectTask[];
  createdAt?: string;
}

interface ProjectTask {
  id: string;
  projectId: string;
  boqItemId?: string | null;
  boqItem?: BOQItem | null;
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

interface BOQChangeOrder {
  id: string;
  projectId: string;
  changeNumber: string;
  title: string;
  description?: string | null;
  requestedBy?: string | null;
  amountImpact: number;
  daysImpact: number;
  status: string;
  approvedAt?: string | null;
  createdAt: string;
}

interface ProjectMilestone {
  id: string;
  projectId: string;
  title: string;
  description?: string | null;
  percentage: number;
  amount: number;
  targetDate?: string | null;
  status: string;
  invoiceNumber?: string | null;
  billedAt?: string | null;
  createdAt: string;
}

interface ProjectInvoice {
  id: string;
  invoiceNumber: string;
  amount: number;
  status: string;
  createdAt: string;
}

interface ProjectRequisition {
  id: string;
  prNumber: string;
  status: string;
  priority: string;
  createdAt: string;
  items?: any[];
}

interface Project {
  id: string;
  projectNumber: string;
  name: string;
  customerId: string;
  customer?: Customer;
  status: string; // planning, active, completed, on_hold
  totalBudget: number;
  contractValue?: number;
  invoicedAmount?: number;
  paidAmount?: number;
  retentionPercent?: number;
  revision?: number;
  billingMethod?: string;
  startDate?: string | null;
  endDate?: string | null;
  boqItems: BOQItem[];
  tasks: ProjectTask[];
  changeOrders?: BOQChangeOrder[];
  milestones?: ProjectMilestone[];
  invoices?: ProjectInvoice[];
  requisitions?: ProjectRequisition[];
  createdAt: string;
}

const COMMON_UNITS = [
  "sq.m",
  "sq.ft",
  "lm",
  "pcs",
  "unit",
  "ton",
  "kg",
  "bags",
  "hours",
  "set",
  "lot",
  "lump_sum",
  "rolls",
  "meters",
];

const SAMPLE_MEP_TEMPLATES = [
  { itemCode: "HVAC-01", description: "Supply & install 24-gauge GI sheet rectangular ducting with insulation", unit: "sq.m", plannedQty: 180, unitRate: 145 },
  { itemCode: "HVAC-02", description: "Ceiling Concealed Fan Coil Units (FCU 2.5 TR) mounting & piping", unit: "pcs", plannedQty: 8, unitRate: 850 },
  { itemCode: "HVAC-03", description: "Aluminum linear bar slot supply and return air diffusers", unit: "lm", plannedQty: 42, unitRate: 120 },
  { itemCode: "PLMB-01", description: "Schedule 40 seamless chilled water copper piping with thermal cladding", unit: "lm", plannedQty: 95, unitRate: 210 },
  { itemCode: "ELEC-01", description: "Dedicated 3-phase isolators and cabling from main distribution board", unit: "set", plannedQty: 4, unitRate: 650 },
  { itemCode: "TEST-01", description: "Air balancing, duct pressure leakage test and commissioning sign-off", unit: "lump_sum", plannedQty: 1, unitRate: 2500 },
];

export default function ProjectsPage() {
  // State
  const [projects, setProjects] = useState<Project[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filters & Tabs
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<
    "boq" | "gantt" | "tasks" | "billing" | "changeOrders" | "analytics"
  >("boq");
  const [boqSearch, setBoqSearch] = useState("");
  const [taskStatusFilter, setTaskStatusFilter] = useState<string>("ALL");

  // Procurement & BOQ Multi-select states
  const [selectedBoqIds, setSelectedBoqIds] = useState<string[]>([]);
  const [showProcurementDrawer, setShowProcurementDrawer] = useState(false);

  // BOQ Progress & Cost Variance Modal
  const [selectedBoqForProgress, setSelectedBoqForProgress] = useState<BOQItem | null>(null);
  const [showBoqProgressModal, setShowBoqProgressModal] = useState(false);

  // Toast notification
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);

  const showToast = (message: string, type: "success" | "error" | "info" = "success") => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 4000);
  };

  // Modals & Drawers State
  // 1. Create Project
  const [showNewProjectModal, setShowNewProjectModal] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [newProjectCustomerId, setNewProjectCustomerId] = useState("");
  const [newProjectBudget, setNewProjectBudget] = useState<number | string>("");
  const [newProjectStatus, setNewProjectStatus] = useState("planning");
  const [newProjectStartDate, setNewProjectStartDate] = useState("");
  const [newProjectEndDate, setNewProjectEndDate] = useState("");
  const [newProjectBoqRows, setNewProjectBoqRows] = useState<Array<{ itemCode: string; description: string; unit: string; plannedQty: number; unitRate: number }>>([
    { itemCode: "BOQ-01", description: "", unit: "unit", plannedQty: 1, unitRate: 0 },
  ]);

  // 2. Edit Project
  const [showEditProjectModal, setShowEditProjectModal] = useState(false);
  const [editProjectId, setEditProjectId] = useState("");
  const [editProjectName, setEditProjectName] = useState("");
  const [editProjectCustomerId, setEditProjectCustomerId] = useState("");
  const [editProjectBudget, setEditProjectBudget] = useState<number | string>("");
  const [editProjectStatus, setEditProjectStatus] = useState("planning");
  const [editProjectStartDate, setEditProjectStartDate] = useState("");
  const [editProjectEndDate, setEditProjectEndDate] = useState("");

  // 3. Delete Project
  const [showDeleteProjectModal, setShowDeleteProjectModal] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);

  // 4. Add BOQ Item
  const [showNewBoqModal, setShowNewBoqModal] = useState(false);
  const [boqItemCode, setBoqItemCode] = useState("");
  const [boqDescription, setBoqDescription] = useState("");
  const [boqUnit, setBoqUnit] = useState("unit");
  const [boqPlannedQty, setBoqPlannedQty] = useState<number | string>(1);
  const [boqUnitRate, setBoqUnitRate] = useState<number | string>("");

  // 5. Edit BOQ Item
  const [showEditBoqModal, setShowEditBoqModal] = useState(false);
  const [editingBoqItem, setEditingBoqItem] = useState<BOQItem | null>(null);
  const [editBoqItemCode, setEditBoqItemCode] = useState("");
  const [editBoqDescription, setEditBoqDescription] = useState("");
  const [editBoqUnit, setEditBoqUnit] = useState("unit");
  const [editBoqPlannedQty, setEditBoqPlannedQty] = useState<number | string>(1);
  const [editBoqUnitRate, setEditBoqUnitRate] = useState<number | string>(0);

  // 6. Delete BOQ Item
  const [showDeleteBoqModal, setShowDeleteBoqModal] = useState(false);
  const [boqToDelete, setBoqToDelete] = useState<BOQItem | null>(null);

  // 7. Add Milestone Task
  const [showNewTaskModal, setShowNewTaskModal] = useState(false);
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDescription, setTaskDescription] = useState("");
  const [taskBoqItemId, setTaskBoqItemId] = useState("");
  const [taskTechnicianId, setTaskTechnicianId] = useState("");
  const [taskStatus, setTaskStatus] = useState("Created");

  // 8. Edit Milestone Task
  const [showEditTaskModal, setShowEditTaskModal] = useState(false);
  const [editingTask, setEditingTask] = useState<ProjectTask | null>(null);
  const [editTaskTitle, setEditTaskTitle] = useState("");
  const [editTaskDescription, setEditTaskDescription] = useState("");
  const [editTaskBoqItemId, setEditTaskBoqItemId] = useState("");
  const [editTaskTechnicianId, setEditTaskTechnicianId] = useState("");
  const [editTaskStatus, setEditTaskStatus] = useState("Created");

  // 9. Delete Task
  const [showDeleteTaskModal, setShowDeleteTaskModal] = useState(false);
  const [taskToDelete, setTaskToDelete] = useState<ProjectTask | null>(null);

  // Data Loading
  async function loadData(preserveSelectionId?: string) {
    try {
      setRefreshing(true);
      const [projRes, custRes, techRes] = await Promise.all([
        fetch("/api/projects"),
        fetch("/api/customers"),
        fetch("/api/technicians"),
      ]);

      const [projData, custData, techData] = await Promise.all([
        projRes.json(),
        custRes.json(),
        techRes.json(),
      ]);

      if (Array.isArray(projData)) {
        setProjects(projData);
        const targetId = preserveSelectionId || selectedProjectId || (projData.length > 0 ? projData[0].id : null);
        if (targetId && projData.some((p) => p.id === targetId)) {
          setSelectedProjectId(targetId);
          fetch(`/api/projects?id=${targetId}`)
            .then((r) => r.json())
            .then((detail) => {
              if (detail && !detail.error) {
                setProjects((prev) => prev.map((p) => (p.id === targetId ? { ...p, ...detail } : p)));
              }
            })
            .catch(() => {});
        } else if (projData.length > 0) {
          setSelectedProjectId(projData[0].id);
        } else {
          setSelectedProjectId(null);
        }
      }

      if (Array.isArray(custData)) {
        setCustomers(custData);
      }
      if (Array.isArray(techData)) {
        setTechnicians(techData);
      }
    } catch (e: any) {
      console.error("Failed loading project data", e);
      showToast("Error loading project information: " + e.message, "error");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function handleSelectProject(id: string) {
    setSelectedProjectId(id);
    setSelectedBoqIds([]);
    try {
      const res = await fetch(`/api/projects?id=${id}`);
      if (res.ok) {
        const detail = await res.json();
        setProjects((prev) => prev.map((p) => (p.id === id ? { ...p, ...detail } : p)));
      }
    } catch (e) {
      console.error("Failed fetching project details:", e);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  // Selected project object
  const selectedProject = useMemo(() => {
    return projects.find((p) => p.id === selectedProjectId) || null;
  }, [projects, selectedProjectId]);

  // Derived Calculations for Selected Project
  const scheduledBOQTotal = useMemo(() => {
    if (!selectedProject?.boqItems) return 0;
    return selectedProject.boqItems.reduce(
      (sum, item) => sum + (Number(item.plannedQty) || 0) * (Number(item.unitRate) || 0),
      0
    );
  }, [selectedProject]);

  const actualCostTotal = useMemo(() => {
    if (!selectedProject?.boqItems) return 0;
    return selectedProject.boqItems.reduce(
      (sum, item) => sum + (Number(item.actualCost) || 0),
      0
    );
  }, [selectedProject]);

  const costVariance = useMemo(() => {
    return scheduledBOQTotal - actualCostTotal;
  }, [scheduledBOQTotal, actualCostTotal]);

  const effectiveContract = useMemo(() => {
    return selectedProject?.contractValue || selectedProject?.totalBudget || scheduledBOQTotal;
  }, [selectedProject, scheduledBOQTotal]);

  const projectedMargin = useMemo(() => {
    const currentCost = actualCostTotal > 0 ? actualCostTotal : scheduledBOQTotal;
    return effectiveContract - currentCost;
  }, [effectiveContract, actualCostTotal, scheduledBOQTotal]);

  const marginPercent = useMemo(() => {
    return effectiveContract > 0 ? Math.round((projectedMargin / effectiveContract) * 100) : 0;
  }, [projectedMargin, effectiveContract]);

  const budgetVariance = useMemo(() => {
    if (!selectedProject) return 0;
    return (selectedProject.totalBudget || 0) - scheduledBOQTotal;
  }, [selectedProject, scheduledBOQTotal]);

  const completedTasksCount = useMemo(() => {
    if (!selectedProject?.tasks) return 0;
    return selectedProject.tasks.filter(
      (t) => t.status === "Verified" || t.status === "Completed"
    ).length;
  }, [selectedProject]);

  const totalTasksCount = useMemo(() => {
    return selectedProject?.tasks?.length || 0;
  }, [selectedProject]);

  const milestoneProgress = useMemo(() => {
    if (totalTasksCount === 0) return 0;
    return Math.round((completedTasksCount / totalTasksCount) * 100);
  }, [completedTasksCount, totalTasksCount]);

  // Global Aggregate KPI Metrics
  const globalKpis = useMemo(() => {
    const totalProjects = projects.length;
    const activeProjects = projects.filter((p) => p.status === "active").length;
    const planningProjects = projects.filter((p) => p.status === "planning").length;
    const totalBudgetSum = projects.reduce((sum, p) => sum + (Number(p.totalBudget) || 0), 0);
    const totalBOQSum = projects.reduce((sum, p) => {
      const pSum = (p.boqItems || []).reduce(
        (s, it) => s + (Number(it.plannedQty) || 0) * (Number(it.unitRate) || 0),
        0
      );
      return sum + pSum;
    }, 0);

    const allTasks = projects.flatMap((p) => p.tasks || []);
    const completedAllTasks = allTasks.filter(
      (t) => t.status === "Verified" || t.status === "Completed"
    ).length;
    const overallVelocity = allTasks.length > 0 ? Math.round((completedAllTasks / allTasks.length) * 100) : 0;

    return {
      totalProjects,
      activeProjects,
      planningProjects,
      totalBudgetSum,
      totalBOQSum,
      totalTasksCount: allTasks.length,
      overallVelocity,
    };
  }, [projects]);

  // Filtered Projects for directory
  const filteredProjects = useMemo(() => {
    return projects.filter((proj) => {
      const matchesStatus =
        statusFilter === "all" ||
        proj.status?.toLowerCase() === statusFilter.toLowerCase();
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        proj.name.toLowerCase().includes(q) ||
        proj.projectNumber.toLowerCase().includes(q) ||
        proj.customer?.name?.toLowerCase().includes(q);
      return matchesStatus && matchesSearch;
    });
  }, [projects, statusFilter, searchQuery]);

  // Filtered BOQ items
  const filteredBOQItems = useMemo(() => {
    if (!selectedProject?.boqItems) return [];
    const q = boqSearch.toLowerCase().trim();
    if (!q) return selectedProject.boqItems;
    return selectedProject.boqItems.filter(
      (item) =>
        item.itemCode.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q) ||
        item.unit.toLowerCase().includes(q)
    );
  }, [selectedProject, boqSearch]);

  // Filtered Tasks
  const filteredTasks = useMemo(() => {
    if (!selectedProject?.tasks) return [];
    if (taskStatusFilter === "ALL") return selectedProject.tasks;
    return selectedProject.tasks.filter((t) => t.status === taskStatusFilter);
  }, [selectedProject, taskStatusFilter]);

  // Customer options for SearchableSelect
  const customerOptions = useMemo(() => {
    return customers.map((c) => ({
      value: c.id,
      label: c.name,
      subLabel: `${c.phone || "No phone"} • ${c.addressText ? c.addressText.slice(0, 30) + "..." : "No address"}`,
    }));
  }, [customers]);

  // Technician options for SearchableSelect
  const technicianOptions = useMemo(() => {
    return [
      { value: "", label: "Unassigned (None)" },
      ...technicians.map((t) => ({
        value: t.id,
        label: t.name,
        subLabel: `${t.phone || "No phone"} • ${t.currentStatus || "Available"}`,
        badge: t.currentStatus,
        badgeTone: (t.currentStatus === "Available" ? "green" : t.currentStatus === "On Job" ? "blue" : "zinc") as any,
      })),
    ];
  }, [technicians]);

  // BOQ item options for Task SearchableSelect
  const boqItemOptions = useMemo(() => {
    if (!selectedProject?.boqItems) return [{ value: "", label: "None (Independent Task)" }];
    return [
      { value: "", label: "None (Independent Task)" },
      ...selectedProject.boqItems.map((it) => ({
        value: it.id,
        label: `${it.itemCode} — ${it.description.slice(0, 45)}...`,
        subLabel: `Qty: ${it.plannedQty} ${it.unit} @ ${formatCurrency(it.unitRate)}`,
      })),
    ];
  }, [selectedProject]);

  // ---------------------------------------------------------------------------
  // HANDLERS: PROJECT CRUD
  // ---------------------------------------------------------------------------
  const handleOpenCreateProject = () => {
    setNewProjectName("");
    setNewProjectCustomerId(customers[0]?.id || "");
    setNewProjectBudget("");
    setNewProjectStatus("planning");
    setNewProjectStartDate(new Date().toISOString().split("T")[0]);
    const nextMonth = new Date();
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    setNewProjectEndDate(nextMonth.toISOString().split("T")[0]);
    setNewProjectBoqRows([
      { itemCode: "BOQ-01", description: "", unit: "unit", plannedQty: 1, unitRate: 0 },
    ]);
    setShowNewProjectModal(true);
  };

  const handleAddBoqRowInNewProject = () => {
    const nextIndex = newProjectBoqRows.length + 1;
    setNewProjectBoqRows([
      ...newProjectBoqRows,
      {
        itemCode: `BOQ-${String(nextIndex).padStart(2, "0")}`,
        description: "",
        unit: "unit",
        plannedQty: 1,
        unitRate: 0,
      },
    ]);
  };

  const handleRemoveBoqRowInNewProject = (idx: number) => {
    if (newProjectBoqRows.length <= 1) return;
    setNewProjectBoqRows(newProjectBoqRows.filter((_, i) => i !== idx));
  };

  const handleCreateProjectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectName.trim() || !newProjectCustomerId) {
      showToast("Please provide project name and select a customer.", "error");
      return;
    }

    try {
      const payload = {
        name: newProjectName.trim(),
        customerId: newProjectCustomerId,
        status: newProjectStatus,
        totalBudget: Number(newProjectBudget) || 0,
        startDate: newProjectStartDate || null,
        endDate: newProjectEndDate || null,
        boqItems: newProjectBoqRows.filter((r) => r.description?.trim()),
      };

      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to create project");
      }

      const created = await res.json();
      setShowNewProjectModal(false);
      showToast(`Commercial project ${created.projectNumber} created successfully!`, "success");
      await loadData(created.id);
    } catch (err: any) {
      showToast(err.message, "error");
    }
  };

  const handleOpenEditProject = (proj: Project) => {
    setEditProjectId(proj.id);
    setEditProjectName(proj.name);
    setEditProjectCustomerId(proj.customerId);
    setEditProjectBudget(proj.totalBudget);
    setEditProjectStatus(proj.status);
    setEditProjectStartDate(proj.startDate ? new Date(proj.startDate).toISOString().split("T")[0] : "");
    setEditProjectEndDate(proj.endDate ? new Date(proj.endDate).toISOString().split("T")[0] : "");
    setShowEditProjectModal(true);
  };

  const handleEditProjectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editProjectName.trim() || !editProjectCustomerId) {
      showToast("Project name and customer are required.", "error");
      return;
    }

    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update_project",
          id: editProjectId,
          name: editProjectName.trim(),
          customerId: editProjectCustomerId,
          status: editProjectStatus,
          totalBudget: Number(editProjectBudget) || 0,
          startDate: editProjectStartDate || null,
          endDate: editProjectEndDate || null,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to update project");
      }

      setShowEditProjectModal(false);
      showToast("Project details updated successfully!", "success");
      await loadData(editProjectId);
    } catch (err: any) {
      showToast(err.message, "error");
    }
  };

  const handleQuickStatusChange = async (newStatus: string) => {
    if (!selectedProject) return;
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update_project",
          id: selectedProject.id,
          status: newStatus,
        }),
      });
      if (!res.ok) throw new Error("Failed to change project status");
      showToast(`Project status set to "${newStatus}"`, "info");
      await loadData(selectedProject.id);
    } catch (e: any) {
      showToast(e.message, "error");
    }
  };

  const handleConfirmDeleteProject = async () => {
    if (!projectToDelete) return;
    try {
      const res = await fetch(`/api/projects?id=${projectToDelete.id}&entity=project`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to delete project");
      }
      setShowDeleteProjectModal(false);
      showToast(`Project ${projectToDelete.projectNumber} and linked records deleted.`, "success");
      setProjectToDelete(null);
      await loadData();
    } catch (err: any) {
      showToast(err.message, "error");
    }
  };

  // ---------------------------------------------------------------------------
  // HANDLERS: BOQ ITEMS CRUD
  // ---------------------------------------------------------------------------
  const handleOpenAddBOQ = () => {
    if (!selectedProject) return;
    const currentCount = selectedProject.boqItems?.length || 0;
    setBoqItemCode(`BOQ-${String(currentCount + 1).padStart(2, "0")}`);
    setBoqDescription("");
    setBoqUnit("unit");
    setBoqPlannedQty(1);
    setBoqUnitRate("");
    setShowNewBoqModal(true);
  };

  const handleCreateBOQSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProject || !boqDescription.trim()) {
      showToast("Please enter an item description.", "error");
      return;
    }

    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "add_boq_item",
          projectId: selectedProject.id,
          itemCode: boqItemCode.trim(),
          description: boqDescription.trim(),
          unit: boqUnit.trim(),
          plannedQty: Number(boqPlannedQty) || 1,
          unitRate: Number(boqUnitRate) || 0,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to add BOQ item");
      }

      setShowNewBoqModal(false);
      showToast("BOQ item added successfully!", "success");
      await loadData(selectedProject.id);
    } catch (err: any) {
      showToast(err.message, "error");
    }
  };

  const handleOpenEditBOQ = (item: BOQItem) => {
    setEditingBoqItem(item);
    setEditBoqItemCode(item.itemCode);
    setEditBoqDescription(item.description);
    setEditBoqUnit(item.unit);
    setEditBoqPlannedQty(item.plannedQty);
    setEditBoqUnitRate(item.unitRate);
    setShowEditBoqModal(true);
  };

  const handleEditBOQSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBoqItem || !editBoqDescription.trim()) return;

    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update_boq_item",
          id: editingBoqItem.id,
          itemCode: editBoqItemCode.trim(),
          description: editBoqDescription.trim(),
          unit: editBoqUnit.trim(),
          plannedQty: Number(editBoqPlannedQty) || 1,
          unitRate: Number(editBoqUnitRate) || 0,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to update BOQ item");
      }

      setShowEditBoqModal(false);
      showToast("BOQ item updated successfully!", "success");
      await loadData(selectedProject?.id);
    } catch (err: any) {
      showToast(err.message, "error");
    }
  };

  const handleConfirmDeleteBOQ = async () => {
    if (!boqToDelete) return;
    try {
      const res = await fetch(`/api/projects?id=${boqToDelete.id}&entity=boq_item`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to delete BOQ item");
      }
      setShowDeleteBoqModal(false);
      showToast(`BOQ item ${boqToDelete.itemCode} removed.`, "success");
      setBoqToDelete(null);
      await loadData(selectedProject?.id);
    } catch (err: any) {
      showToast(err.message, "error");
    }
  };

  const handleLoadSampleBOQPackage = async () => {
    if (!selectedProject) return;
    if (
      !confirm(
        `Load standard MEP & HVAC BOQ package (${SAMPLE_MEP_TEMPLATES.length} schedule items) into ${selectedProject.name}?`
      )
    ) {
      return;
    }

    try {
      for (const item of SAMPLE_MEP_TEMPLATES) {
        await fetch("/api/projects", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "add_boq_item",
            projectId: selectedProject.id,
            ...item,
          }),
        });
      }
      showToast("Standard MEP BOQ package loaded successfully!", "success");
      await loadData(selectedProject.id);
    } catch (err: any) {
      showToast("Error loading template items: " + err.message, "error");
    }
  };

  const handleExportBOQToCSV = () => {
    if (!selectedProject) return;
    const items = selectedProject.boqItems || [];
    if (items.length === 0) {
      showToast("No BOQ items to export.", "info");
      return;
    }

    const headers = [
      "BOQ Item Code",
      "Description",
      "Unit of Measure",
      "Planned Quantity",
      "Unit Rate (PKR)",
      "Scheduled Amount (PKR)",
      "Linked Tasks Count",
    ];

    const rows = items.map((it) => {
      const amount = (Number(it.plannedQty) || 0) * (Number(it.unitRate) || 0);
      const taskCount = it.tasks?.length || 0;
      return [
        `"${it.itemCode.replace(/"/g, '""')}"`,
        `"${it.description.replace(/"/g, '""')}"`,
        `"${it.unit}"`,
        it.plannedQty,
        it.unitRate,
        amount,
        taskCount,
      ].join(",");
    });

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `BOQ_${selectedProject.projectNumber}_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast(`BOQ Schedule exported for ${selectedProject.projectNumber}`, "success");
  };

  // ---------------------------------------------------------------------------
  // HANDLERS: MILESTONE TASKS CRUD
  // ---------------------------------------------------------------------------
  const handleOpenAddTask = (preselectedBoqItemId?: string) => {
    if (!selectedProject) return;
    setTaskTitle("");
    setTaskDescription("");
    setTaskBoqItemId(preselectedBoqItemId || "");
    setTaskTechnicianId("");
    setTaskStatus("Created");
    setShowNewTaskModal(true);
  };

  const handleCreateTaskSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProject || !taskTitle.trim()) {
      showToast("Task title is required.", "error");
      return;
    }

    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create_task",
          projectId: selectedProject.id,
          boqItemId: taskBoqItemId || null,
          title: taskTitle.trim(),
          description: taskDescription.trim(),
          assignedTechnicianId: taskTechnicianId || null,
          status: taskStatus,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to create task");
      }

      setShowNewTaskModal(false);
      showToast("Milestone task created successfully!", "success");
      await loadData(selectedProject.id);
    } catch (err: any) {
      showToast(err.message, "error");
    }
  };

  const handleOpenEditTask = (task: ProjectTask) => {
    setEditingTask(task);
    setEditTaskTitle(task.title);
    setEditTaskDescription(task.description || "");
    setEditTaskBoqItemId(task.boqItemId || "");
    setEditTaskTechnicianId(task.assignedTechnicianId || "");
    setEditTaskStatus(task.status);
    setShowEditTaskModal(true);
  };

  const handleEditTaskSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTask || !editTaskTitle.trim()) return;

    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update_task",
          id: editingTask.id,
          title: editTaskTitle.trim(),
          description: editTaskDescription.trim(),
          boqItemId: editTaskBoqItemId || null,
          assignedTechnicianId: editTaskTechnicianId || null,
          status: editTaskStatus,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to update milestone task");
      }

      setShowEditTaskModal(false);
      showToast("Milestone task updated successfully!", "success");
      await loadData(selectedProject?.id);
    } catch (err: any) {
      showToast(err.message, "error");
    }
  };

  const handleUpdateTaskStatus = async (taskId: string, newStatus: string) => {
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update_task_status",
          id: taskId,
          status: newStatus,
        }),
      });

      if (!res.ok) throw new Error("Failed to advance task status");
      showToast(`Task status updated to ${newStatus}`, "info");
      await loadData(selectedProject?.id);
    } catch (e: any) {
      showToast(e.message, "error");
    }
  };

  const handleConfirmDeleteTask = async () => {
    if (!taskToDelete) return;
    try {
      const res = await fetch(`/api/projects?id=${taskToDelete.id}&entity=task`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to delete task");
      }
      setShowDeleteTaskModal(false);
      showToast("Task deleted.", "success");
      setTaskToDelete(null);
      await loadData(selectedProject?.id);
    } catch (err: any) {
      showToast(err.message, "error");
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Toast Banner */}
      {toast && (
        <div
          className={cn(
            "fixed bottom-5 right-5 z-50 px-4 py-3 rounded-xl shadow-lg border text-xs font-semibold flex items-center gap-2.5 transition animate-in slide-in-from-bottom-2",
            toast.type === "success" && "bg-emerald-950 text-emerald-200 border-emerald-800",
            toast.type === "error" && "bg-rose-950 text-rose-200 border-rose-800",
            toast.type === "info" && "bg-slate-900 text-slate-200 border-slate-700"
          )}
        >
          {toast.type === "success" && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />}
          {toast.type === "error" && <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />}
          {toast.type === "info" && <Sparkles className="w-4 h-4 text-sky-400 shrink-0" />}
          <span>{toast.message}</span>
          <button
            onClick={() => setToast(null)}
            className="ml-2 hover:opacity-75 text-zinc-400 hover:text-white"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Enterprise Page Header */}
      <PageHeader
        breadcrumbs={[{ label: "Commercial Operations" }, { label: "Projects & BOQ" }]}
        title="Project Management & BOQ Schedules"
        subtitle="Commercial contracts, Bill of Quantities (BOQ) item schedules, cost variance tracking, and milestone task state-machines"
        badge={
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
            <FolderKanban className="w-3.5 h-3.5 text-[#0D7A5F]" />
            Enterprise Commercial Hub
          </span>
        }
        actions={
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => loadData(selectedProjectId || undefined)}
              disabled={refreshing}
              className="h-9 px-3 rounded-lg border border-[#E4E4E7] bg-white hover:bg-[#F4F4F5] text-xs font-semibold text-[#52525B] inline-flex items-center gap-1.5 transition shadow-xs disabled:opacity-50"
              title="Refresh projects data"
            >
              <RefreshCw className={cn("w-3.5 h-3.5", refreshing && "animate-spin text-[#0D7A5F]")} />
              <span>Refresh</span>
            </button>
            <button
              type="button"
              onClick={handleOpenCreateProject}
              className="h-9 px-4 rounded-lg bg-[#0D7A5F] hover:bg-[#0A624C] text-white text-xs font-bold inline-flex items-center gap-1.5 transition shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0D7A5F]"
            >
              <Plus className="w-4 h-4" />
              <span>New Commercial Project</span>
            </button>
          </div>
        }
      />

      {/* High-Level Executive KPI Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-[#E4E4E7] p-4.5 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-[#71717A] uppercase tracking-wider block">
              Active Contracts
            </span>
            <div className="text-2xl font-black text-[#18181B] mt-1 tracking-tight">
              {globalKpis.activeProjects}
              <span className="text-xs font-medium text-[#71717A] ml-1.5">
                / {globalKpis.totalProjects} total
              </span>
            </div>
            <span className="text-[11px] text-[#0D7A5F] font-semibold mt-0.5 block">
              {globalKpis.planningProjects} in planning phase
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-[#0D7A5F]">
            <FolderKanban className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white rounded-xl border border-[#E4E4E7] p-4.5 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-[#71717A] uppercase tracking-wider block">
              Total Contract Budget
            </span>
            <div className="text-2xl font-black text-[#18181B] mt-1 tracking-tight">
              {formatCurrency(globalKpis.totalBudgetSum)}
            </div>
            <span className="text-[11px] text-[#71717A] font-medium mt-0.5 block">
              Sum of active commercial scopes
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-sky-50 border border-sky-100 flex items-center justify-center text-sky-600">
            <Calculator className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white rounded-xl border border-[#E4E4E7] p-4.5 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-[#71717A] uppercase tracking-wider block">
              Scheduled BOQ Value
            </span>
            <div className="text-2xl font-black text-[#0D7A5F] mt-1 tracking-tight">
              {formatCurrency(globalKpis.totalBOQSum)}
            </div>
            <span className="text-[11px] text-[#52525B] font-semibold mt-0.5 block">
              {globalKpis.totalBudgetSum >= globalKpis.totalBOQSum ? (
                <span className="text-emerald-700">Under overall budget headroom</span>
              ) : (
                <span className="text-rose-600">Exceeds contract budget</span>
              )}
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-[#0D7A5F]">
            <Layers className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white rounded-xl border border-[#E4E4E7] p-4.5 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-[#71717A] uppercase tracking-wider block">
              Milestone Velocity
            </span>
            <div className="text-2xl font-black text-[#18181B] mt-1 tracking-tight">
              {globalKpis.overallVelocity}%
            </div>
            <span className="text-[11px] text-[#71717A] font-medium mt-0.5 block">
              {globalKpis.totalTasksCount} total milestone tasks
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-violet-50 border border-violet-100 flex items-center justify-center text-violet-600">
            <TrendingUp className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Main Two-Column Enterprise Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* ================================================================= */}
        {/* LEFT COLUMN: COMMERCIAL CONTRACTS DIRECTORY                       */}
        {/* ================================================================= */}
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-white rounded-xl border border-[#E4E4E7] p-4 shadow-xs space-y-3.5">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-[#18181B] uppercase tracking-wider flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-[#0D7A5F]" />
                Commercial Directory
              </h3>
              <span className="text-xs font-mono font-bold text-[#71717A] bg-[#F4F4F5] px-2 py-0.5 rounded-full">
                {filteredProjects.length}
              </span>
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-[#A1A1AA] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search contract, PRJ#, client..."
                className="w-full pl-8.5 pr-8 py-1.5 text-xs bg-[#FAFAFA] border border-[#E4E4E7] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0D7A5F] text-[#18181B]"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#A1A1AA] hover:text-[#18181B]"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* Status Filter Tabs */}
            <div className="flex items-center gap-1 overflow-x-auto pb-1 text-[11px] scrollbar-none border-b border-[#E4E4E7]">
              {[
                { key: "all", label: "All" },
                { key: "planning", label: "Planning" },
                { key: "active", label: "Active" },
                { key: "completed", label: "Completed" },
              ].map((tab) => (
                <button
                  type="button"
                  key={tab.key}
                  onClick={() => setStatusFilter(tab.key)}
                  className={cn(
                    "px-2.5 py-1 rounded-md font-semibold transition whitespace-nowrap",
                    statusFilter === tab.key
                      ? "bg-[#18181B] text-white"
                      : "text-[#71717A] hover:text-[#18181B] hover:bg-[#F4F4F5]"
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Projects List */}
            <div className="space-y-2.5 max-h-[640px] overflow-y-auto pr-1">
              {loading ? (
                <div className="py-12 text-center text-xs text-[#71717A]">
                  <RefreshCw className="w-5 h-5 animate-spin mx-auto text-[#0D7A5F] mb-2" />
                  Loading commercial projects...
                </div>
              ) : filteredProjects.length === 0 ? (
                <div className="py-10 text-center text-xs text-[#71717A] border border-dashed border-[#E4E4E7] rounded-xl p-4">
                  <p className="font-semibold text-[#18181B]">No matching contracts found</p>
                  <p className="text-[11px] mt-1 text-[#71717A]">
                    {searchQuery ? "Try refining your search terms" : "Click '+ New Commercial Project' to start"}
                  </p>
                  <button
                    type="button"
                    onClick={handleOpenCreateProject}
                    className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0D7A5F] text-white text-xs font-semibold hover:bg-[#0A624C] transition"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Create First Project
                  </button>
                </div>
              ) : (
                filteredProjects.map((proj) => {
                  const isSelected = selectedProjectId === proj.id;
                  const boqSum = (proj.boqItems || []).reduce(
                    (s, it) => s + (Number(it.plannedQty) || 0) * (Number(it.unitRate) || 0),
                    0
                  );
                  const tasksDone = (proj.tasks || []).filter(
                    (t) => t.status === "Verified" || t.status === "Completed"
                  ).length;
                  const tasksTotal = (proj.tasks || []).length;
                  const pct = tasksTotal > 0 ? Math.round((tasksDone / tasksTotal) * 100) : 0;

                  return (
                    <div
                      key={proj.id}
                      onClick={() => handleSelectProject(proj.id)}
                      className={cn(
                        "w-full text-left rounded-xl border p-3.5 transition shadow-xs cursor-pointer relative group",
                        isSelected
                          ? "bg-white border-[#0D7A5F] ring-1.5 ring-[#0D7A5F]"
                          : "bg-white border-[#E4E4E7] hover:border-[#D4D4D8] hover:bg-[#FAFAFA]"
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="font-mono font-bold text-xs text-[#0D7A5F] bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">
                          {proj.projectNumber}
                        </span>
                        <div className="flex items-center gap-1.5">
                          <StatusBadge status={proj.status} />
                          {/* Quick Card Action Buttons */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenEditProject(proj);
                            }}
                            className="opacity-0 group-hover:opacity-100 p-1 hover:bg-[#F4F4F5] rounded text-[#71717A] hover:text-[#18181B] transition"
                            title="Edit Project"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setProjectToDelete(proj);
                              setShowDeleteProjectModal(true);
                            }}
                            className="opacity-0 group-hover:opacity-100 p-1 hover:bg-rose-50 rounded text-[#71717A] hover:text-rose-600 transition"
                            title="Delete Project"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      <h4 className="text-xs font-bold text-[#18181B] mt-2 leading-snug">
                        {proj.name}
                      </h4>
                      <p className="text-[11px] text-[#71717A] mt-0.5 flex items-center gap-1 truncate">
                        <Building className="w-3 h-3 text-[#A1A1AA] shrink-0" />
                        <span>Client: {proj.customer?.name || "Unassigned"}</span>
                      </p>

                      {/* Mini Progress & Budget Bar */}
                      <div className="mt-3 pt-2.5 border-t border-[#E4E4E7] space-y-1.5 text-xs">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-[#71717A]">Budget:</span>
                          <span className="font-mono font-bold text-[#18181B]">
                            {formatCurrency(proj.totalBudget)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-[#71717A]">BOQ Scheduled:</span>
                          <span className="font-mono font-semibold text-[#0D7A5F]">
                            {formatCurrency(boqSum)}
                          </span>
                        </div>

                        {/* Visual Task Velocity Micro Bar */}
                        <div className="pt-1 flex items-center justify-between text-[10px] text-[#71717A]">
                          <span>{tasksDone}/{tasksTotal} Tasks Done</span>
                          <span className="font-mono font-bold text-[#18181B]">{pct}%</span>
                        </div>
                        <div className="w-full bg-[#F4F4F5] rounded-full h-1.5 overflow-hidden">
                          <div
                            className="bg-[#0D7A5F] h-full rounded-full transition-all duration-300"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* ================================================================= */}
        {/* RIGHT COLUMN: SELECTED PROJECT DEEP DIVE WORKSPACE               */}
        {/* ================================================================= */}
        <div className="lg:col-span-8 space-y-6">
          {selectedProject ? (
            <>
              {/* Project Overview Master Card */}
              <div className="bg-white rounded-xl border border-[#E4E4E7] p-5 shadow-xs">
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-5 pb-5 border-b border-[#E4E4E7]">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono font-bold text-xs text-[#0D7A5F] bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                        {selectedProject.projectNumber}
                      </span>
                      {/* Interactive Status Changer */}
                      <select
                        value={selectedProject.status}
                        onChange={(e) => handleQuickStatusChange(e.target.value)}
                        className="bg-white text-xs py-0.5 px-2 rounded-lg border border-[#D4D4D8] font-semibold text-[#18181B] focus:ring-2 focus:ring-[#0D7A5F] focus:outline-none"
                      >
                        <option value="planning">Status: Planning</option>
                        <option value="active">Status: Active</option>
                        <option value="completed">Status: Completed</option>
                        <option value="on_hold">Status: On Hold</option>
                      </select>
                    </div>

                    <h2 className="text-lg font-bold text-[#18181B] mt-2">
                      {selectedProject.name}
                    </h2>

                    <div className="flex items-center gap-4 text-xs text-[#52525B] mt-1.5 flex-wrap">
                      <span className="flex items-center gap-1.5">
                        <Building className="w-3.5 h-3.5 text-[#0D7A5F]" />
                        <span>Client: </span>
                        <strong className="text-[#18181B]">{selectedProject.customer?.name}</strong>
                      </span>
                      {selectedProject.customer?.phone && (
                        <span className="text-[#71717A] text-[11px]">
                          ({selectedProject.customer.phone})
                        </span>
                      )}
                      <span className="flex items-center gap-1.5 text-[11px] text-[#71717A]">
                        <Calendar className="w-3.5 h-3.5 text-[#A1A1AA]" />
                        <span>
                          {formatDate(selectedProject.startDate)} → {formatDate(selectedProject.endDate)}
                        </span>
                      </span>
                    </div>
                  </div>

                  {/* Actions & Progress */}
                  <div className="flex items-center gap-4 shrink-0">
                    <div className="text-center">
                      <ProgressRing
                        percentage={milestoneProgress}
                        label="Milestone Rate"
                        sublabel={`${completedTasksCount} of ${totalTasksCount} tasks verified`}
                        size={100}
                      />
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleOpenEditProject(selectedProject)}
                        className="px-3 py-1.5 rounded-lg border border-[#E4E4E7] bg-white hover:bg-[#F4F4F5] text-xs font-semibold text-[#18181B] inline-flex items-center gap-1.5 transition shadow-xs"
                      >
                        <Edit3 className="w-3.5 h-3.5 text-[#71717A]" />
                        Edit Project
                      </button>
                      <button
                        type="button"
                        onClick={handleExportBOQToCSV}
                        className="px-3 py-1.5 rounded-lg border border-[#E4E4E7] bg-white hover:bg-[#F4F4F5] text-xs font-semibold text-[#18181B] inline-flex items-center gap-1.5 transition shadow-xs"
                      >
                        <Download className="w-3.5 h-3.5 text-[#0D7A5F]" />
                        Export BOQ CSV
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setProjectToDelete(selectedProject);
                          setShowDeleteProjectModal(true);
                        }}
                        className="px-3 py-1.5 rounded-lg border border-rose-200 bg-rose-50 hover:bg-rose-100 text-xs font-semibold text-rose-700 inline-flex items-center gap-1.5 transition"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                        Delete
                      </button>
                    </div>
                  </div>
                </div>

                {/* Financial Headroom & Variance Strip */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 pt-4 text-xs">
                  <div className="bg-[#FAFAFA] rounded-xl p-3 border border-[#E4E4E7]">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-[#71717A] uppercase tracking-wider">
                        Contract Value
                      </span>
                      <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200">
                        Rev {selectedProject.revision || 1}.0
                      </span>
                    </div>
                    <span className="font-mono font-bold text-sm text-[#18181B] mt-1 block">
                      {formatCurrency(effectiveContract)}
                    </span>
                    <span className="text-[10px] text-[#71717A] mt-0.5 block">
                      Retention: {selectedProject.retentionPercent || 0}%
                    </span>
                  </div>

                  <div className="bg-[#FAFAFA] rounded-xl p-3 border border-[#E4E4E7]">
                    <span className="text-[10px] font-bold text-[#71717A] uppercase tracking-wider block">
                      Planned BOQ Cost
                    </span>
                    <span className="font-mono font-bold text-sm text-[#0D7A5F] mt-1 block">
                      {formatCurrency(scheduledBOQTotal)}
                    </span>
                    <span className="text-[10px] text-[#71717A] mt-0.5 block">
                      {selectedProject.boqItems?.length || 0} scheduled items
                    </span>
                  </div>

                  <div className="bg-[#FAFAFA] rounded-xl p-3 border border-[#E4E4E7]">
                    <span className="text-[10px] font-bold text-[#71717A] uppercase tracking-wider block">
                      Actual Cost Incurred
                    </span>
                    <span className="font-mono font-bold text-sm text-[#18181B] mt-1 block">
                      {formatCurrency(actualCostTotal)}
                    </span>
                    <span className="text-[10px] text-[#71717A] mt-0.5 block">
                      Site labor & material
                    </span>
                  </div>

                  <div
                    className={cn(
                      "rounded-xl p-3 border",
                      costVariance >= 0
                        ? "bg-emerald-50/70 border-emerald-200 text-emerald-900"
                        : "bg-rose-50 border-rose-200 text-rose-900"
                    )}
                  >
                    <span className="text-[10px] font-bold uppercase tracking-wider block">
                      {costVariance >= 0 ? "Cost Savings Margin" : "Cost Overrun"}
                    </span>
                    <div className="flex items-center gap-1.5 mt-1">
                      <span className="font-mono font-bold text-sm">
                        {costVariance >= 0 ? `+${formatCurrency(costVariance)}` : `-${formatCurrency(Math.abs(costVariance))}`}
                      </span>
                    </div>
                    <span className="text-[10px] font-medium opacity-80 mt-0.5 block">
                      {scheduledBOQTotal > 0
                        ? `${Math.abs(Math.round((costVariance / scheduledBOQTotal) * 100))}% vs planned`
                        : "0%"}
                    </span>
                  </div>

                  <div className="bg-[#FAFAFA] rounded-xl p-3 border border-[#E4E4E7]">
                    <span className="text-[10px] font-bold text-[#71717A] uppercase tracking-wider block">
                      Projected Margin
                    </span>
                    <span className="font-mono font-bold text-sm text-teal-800 mt-1 block">
                      {formatCurrency(projectedMargin)}
                    </span>
                    <span className="text-[10px] font-bold text-emerald-700 mt-0.5 block">
                      {marginPercent}% Gross Profit
                    </span>
                  </div>
                </div>
              </div>

              {/* Workspace Navigation Tabs */}
              <div className="flex items-center justify-between border-b border-[#E4E4E7] overflow-x-auto">
                <div className="flex items-center gap-1 min-w-max">
                  <button
                    type="button"
                    onClick={() => setActiveTab("boq")}
                    className={cn(
                      "pb-2.5 px-3 text-xs font-bold transition border-b-2 flex items-center gap-2",
                      activeTab === "boq"
                        ? "border-[#0D7A5F] text-[#0D7A5F]"
                        : "border-transparent text-[#71717A] hover:text-[#18181B]"
                    )}
                  >
                    <Layers className="w-4 h-4" />
                    <span>Bill of Quantities (BOQ)</span>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-[#F4F4F5] text-[#52525B]">
                      {selectedProject.boqItems?.length || 0}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab("gantt")}
                    className={cn(
                      "pb-2.5 px-3 text-xs font-bold transition border-b-2 flex items-center gap-2",
                      activeTab === "gantt"
                        ? "border-[#0D7A5F] text-[#0D7A5F]"
                        : "border-transparent text-[#71717A] hover:text-[#18181B]"
                    )}
                  >
                    <Clock className="w-4 h-4" />
                    <span>Interactive Timeline & Gantt</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab("tasks")}
                    className={cn(
                      "pb-2.5 px-3 text-xs font-bold transition border-b-2 flex items-center gap-2",
                      activeTab === "tasks"
                        ? "border-[#0D7A5F] text-[#0D7A5F]"
                        : "border-transparent text-[#71717A] hover:text-[#18181B]"
                    )}
                  >
                    <ListTodo className="w-4 h-4" />
                    <span>Tasks Execution</span>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-[#F4F4F5] text-[#52525B]">
                      {selectedProject.tasks?.length || 0}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab("billing")}
                    className={cn(
                      "pb-2.5 px-3 text-xs font-bold transition border-b-2 flex items-center gap-2",
                      activeTab === "billing"
                        ? "border-[#0D7A5F] text-[#0D7A5F]"
                        : "border-transparent text-[#71717A] hover:text-[#18181B]"
                    )}
                  >
                    <Receipt className="w-4 h-4" />
                    <span>Progress Billing & Invoices</span>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-700">
                      {selectedProject.milestones?.length || 0}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab("changeOrders")}
                    className={cn(
                      "pb-2.5 px-3 text-xs font-bold transition border-b-2 flex items-center gap-2",
                      activeTab === "changeOrders"
                        ? "border-[#0D7A5F] text-[#0D7A5F]"
                        : "border-transparent text-[#71717A] hover:text-[#18181B]"
                    )}
                  >
                    <FolderKanban className="w-4 h-4" />
                    <span>BOQ Revisions & Variations</span>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-purple-50 text-purple-700">
                      Rev {selectedProject.revision || 1}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab("analytics")}
                    className={cn(
                      "pb-2.5 px-3 text-xs font-bold transition border-b-2 flex items-center gap-2",
                      activeTab === "analytics"
                        ? "border-[#0D7A5F] text-[#0D7A5F]"
                        : "border-transparent text-[#71717A] hover:text-[#18181B]"
                    )}
                  >
                    <PieChart className="w-4 h-4" />
                    <span>Cost Analysis</span>
                  </button>
                </div>
              </div>

              {/* ============================================================= */}
              {/* TAB 1: BILL OF QUANTITIES (BOQ)                               */}
              {/* ============================================================= */}
              {activeTab === "boq" && (
                <div className="bg-white rounded-xl border border-[#E4E4E7] shadow-xs overflow-hidden space-y-0">
                  {/* BOQ Toolbar */}
                  <div className="p-4 bg-[#FAFAFA] border-b border-[#E4E4E7] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                      <div className="relative w-full sm:w-64">
                        <Search className="w-3.5 h-3.5 text-[#A1A1AA] absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          value={boqSearch}
                          onChange={(e) => setBoqSearch(e.target.value)}
                          placeholder="Search BOQ code, description..."
                          className="w-full pl-8.5 pr-7 py-1.5 text-xs bg-white border border-[#D4D4D8] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0D7A5F] text-[#18181B]"
                        />
                        {boqSearch && (
                          <button
                            type="button"
                            onClick={() => setBoqSearch("")}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-[#A1A1AA] hover:text-[#18181B]"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={handleLoadSampleBOQPackage}
                        className="h-8 px-2.5 rounded-lg border border-[#D4D4D8] bg-white hover:bg-[#F4F4F5] text-xs font-semibold text-[#52525B] inline-flex items-center gap-1.5 transition shrink-0"
                        title="Load standard MEP templates"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-[#0D7A5F]" />
                        <span>Load Template</span>
                      </button>
                    </div>

                    <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                      {selectedBoqIds.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setShowProcurementDrawer(true)}
                          className="h-8 px-3 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold inline-flex items-center gap-1.5 transition shadow-xs animate-in fade-in"
                        >
                          <ShoppingCart className="w-3.5 h-3.5" />
                          <span>Raise Requisition ({selectedBoqIds.length})</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={handleOpenAddBOQ}
                        className="h-8 px-3 rounded-lg bg-[#0D7A5F] hover:bg-[#0A624C] text-white text-xs font-bold inline-flex items-center gap-1.5 transition shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0D7A5F]"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add BOQ Item</span>
                      </button>
                    </div>
                  </div>

                  {/* BOQ Dense Table */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-[#E4E4E7] text-[11px] font-semibold text-[#71717A] uppercase tracking-wider bg-[#F4F4F5]">
                          <th className="py-2.5 px-3 text-center w-10">
                            <input
                              type="checkbox"
                              checked={
                                filteredBOQItems.length > 0 &&
                                selectedBoqIds.length === filteredBOQItems.length
                              }
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedBoqIds(filteredBOQItems.map((i) => i.id));
                                } else {
                                  setSelectedBoqIds([]);
                                }
                              }}
                              className="rounded border-[#D4D4D8] text-[#0D7A5F] focus:ring-[#0D7A5F]"
                            />
                          </th>
                          <th className="py-2.5 px-4">Item Code</th>
                          <th className="py-2.5 px-4 min-w-[180px]">Description & Scope</th>
                          <th className="py-2.5 px-4 text-center">Unit</th>
                          <th className="py-2.5 px-4 text-center">Planned Qty</th>
                          <th className="py-2.5 px-4 text-right">Unit Rate</th>
                          <th className="py-2.5 px-4 text-right">Planned Total</th>
                          <th className="py-2.5 px-4 text-right">Actual Incurred</th>
                          <th className="py-2.5 px-4 text-center">Status</th>
                          <th className="py-2.5 px-4 text-center">Tasks</th>
                          <th className="py-2.5 px-4 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#E4E4E7]">
                        {filteredBOQItems.length === 0 ? (
                          <tr>
                            <td colSpan={11} className="py-12 text-center text-xs text-[#71717A]">
                              <p className="font-semibold text-[#18181B]">No BOQ items found</p>
                              <p className="text-[11px] mt-0.5">
                                Add items manually or use &quot;Load Template&quot; to populate standard MEP scopes.
                              </p>
                              <div className="mt-3 flex items-center justify-center gap-2">
                                <button
                                  type="button"
                                  onClick={handleOpenAddBOQ}
                                  className="px-3 py-1.5 rounded-lg bg-[#0D7A5F] text-white text-xs font-semibold hover:bg-[#0A624C] transition"
                                >
                                  + Add Item
                                </button>
                                <button
                                  type="button"
                                  onClick={handleLoadSampleBOQPackage}
                                  className="px-3 py-1.5 rounded-lg border border-[#D4D4D8] bg-white text-xs font-semibold text-[#18181B] hover:bg-[#F4F4F5] transition"
                                >
                                  Load Sample MEP
                                </button>
                              </div>
                            </td>
                          </tr>
                        ) : (
                          filteredBOQItems.map((item) => {
                            const rowTotal = (Number(item.plannedQty) || 0) * (Number(item.unitRate) || 0);
                            const tasksCount = item.tasks?.length || 0;
                            const isSelected = selectedBoqIds.includes(item.id);

                            return (
                              <tr
                                key={item.id}
                                className={cn(
                                  "hover:bg-[#FAFAFA] transition group",
                                  isSelected && "bg-emerald-50/40"
                                )}
                              >
                                <td className="py-3 px-3 text-center">
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={(e) => {
                                      if (e.target.checked) {
                                        setSelectedBoqIds([...selectedBoqIds, item.id]);
                                      } else {
                                        setSelectedBoqIds(selectedBoqIds.filter((id) => id !== item.id));
                                      }
                                    }}
                                    className="rounded border-[#D4D4D8] text-[#0D7A5F] focus:ring-[#0D7A5F]"
                                  />
                                </td>
                                <td className="py-3 px-4 font-mono font-bold text-[#18181B]">
                                  <div className="flex items-center gap-1.5">
                                    <span>{item.itemCode}</span>
                                    {item.version && item.version > 1 && (
                                      <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-purple-50 text-purple-700 border border-purple-200">
                                        v{item.version}
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-[10px] uppercase font-semibold text-[#71717A] mt-0.5">
                                    {item.category || "material"}
                                  </div>
                                </td>
                                <td className="py-3 px-4">
                                  <p className="font-medium text-[#18181B]">{item.description}</p>
                                  {item.changeOrderRef && (
                                    <span className="text-[10px] text-purple-700 font-mono">
                                      Variation: {item.changeOrderRef}
                                    </span>
                                  )}
                                </td>
                                <td className="py-3 px-4 text-center">
                                  <span className="font-mono text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-[#F4F4F5] text-[#52525B] border border-[#E4E4E7]">
                                    {item.unit}
                                  </span>
                                </td>
                                <td className="py-3 px-4 text-center font-mono font-bold text-[#18181B]">
                                  {item.plannedQty}
                                </td>
                                <td className="py-3 px-4 text-right font-mono text-[#52525B]">
                                  {formatCurrency(item.unitRate)}
                                </td>
                                <td className="py-3 px-4 text-right font-mono font-bold text-[#0D7A5F]">
                                  {formatCurrency(rowTotal)}
                                </td>
                                <td className="py-3 px-4 text-right font-mono">
                                  {item.actualCost !== undefined && item.actualCost > 0 ? (
                                    <div>
                                      <span
                                        className={cn(
                                          "font-bold",
                                          item.actualCost > rowTotal ? "text-rose-600" : "text-emerald-700"
                                        )}
                                      >
                                        {formatCurrency(item.actualCost)}
                                      </span>
                                      <div className="text-[10px] text-[#71717A]">
                                        Qty: {item.actualQty ?? 0}
                                      </div>
                                    </div>
                                  ) : (
                                    <span className="text-[#A1A1AA] italic text-[11px]">-</span>
                                  )}
                                </td>
                                <td className="py-3 px-4 text-center">
                                  <span
                                    className={cn(
                                      "text-[10px] font-bold px-2 py-0.5 rounded-full capitalize inline-block",
                                      item.status === "completed"
                                        ? "bg-emerald-100 text-emerald-800"
                                        : item.status === "procuring"
                                        ? "bg-amber-100 text-amber-800"
                                        : item.status === "in_progress"
                                        ? "bg-blue-100 text-blue-800"
                                        : "bg-[#F4F4F5] text-[#52525B]"
                                    )}
                                  >
                                    {item.status || "pending"}
                                  </span>
                                  {item.completedQty !== undefined && item.completedQty > 0 && (
                                    <div className="text-[10px] text-[#71717A] mt-0.5 font-mono">
                                      {item.completedQty}/{item.plannedQty} {item.unit}
                                    </div>
                                  )}
                                </td>
                                <td className="py-3 px-4 text-center">
                                  {tasksCount > 0 ? (
                                    <span className="inline-flex items-center gap-1 font-mono text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
                                      <CheckCircle2 className="w-3 h-3 text-[#0D7A5F]" />
                                      {tasksCount}
                                    </span>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => handleOpenAddTask(item.id)}
                                      className="text-[10px] text-[#71717A] hover:text-[#0D7A5F] underline"
                                      title="Create task for this item"
                                    >
                                      + Task
                                    </button>
                                  )}
                                </td>
                                <td className="py-3 px-4 text-right">
                                  <div className="flex items-center justify-end gap-1.5">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setSelectedBoqForProgress(item);
                                        setShowBoqProgressModal(true);
                                      }}
                                      className="p-1 hover:bg-teal-50 rounded text-teal-600 hover:text-teal-800 transition"
                                      title="Update Actuals & Consumption"
                                    >
                                      <Calculator className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleOpenAddTask(item.id)}
                                      className="p-1 hover:bg-[#F4F4F5] rounded text-[#71717A] hover:text-[#0D7A5F] transition"
                                      title="Add Task for this BOQ Item"
                                    >
                                      <Plus className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleOpenEditBOQ(item)}
                                      className="p-1 hover:bg-[#F4F4F5] rounded text-[#71717A] hover:text-[#18181B] transition"
                                      title="Edit BOQ Item"
                                    >
                                      <Edit3 className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setBoqToDelete(item);
                                        setShowDeleteBoqModal(true);
                                      }}
                                      className="p-1 hover:bg-rose-50 rounded text-[#71717A] hover:text-rose-600 transition"
                                      title="Delete BOQ Item"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                      {filteredBOQItems.length > 0 && (
                        <tfoot>
                          <tr className="border-t-2 border-[#E4E4E7] bg-[#FAFAFA] font-bold text-xs text-[#18181B]">
                            <td className="py-3 px-4 uppercase text-[11px]" colSpan={3}>
                              Total Scheduled Items ({filteredBOQItems.length})
                            </td>
                            <td className="py-3 px-4 text-center font-mono">
                              {filteredBOQItems.reduce((s, it) => s + Number(it.plannedQty), 0)}
                            </td>
                            <td className="py-3 px-4 text-right text-[11px] text-[#71717A]">
                              Scheduled Sum:
                            </td>
                            <td className="py-3 px-4 text-right font-mono text-[#0D7A5F] text-sm font-black">
                              {formatCurrency(
                                filteredBOQItems.reduce(
                                  (s, it) => s + (Number(it.plannedQty) || 0) * (Number(it.unitRate) || 0),
                                  0
                                )
                              )}
                            </td>
                            <td colSpan={2} />
                          </tr>
                        </tfoot>
                      )}
                    </table>
                  </div>
                </div>
              )}

              {/* ============================================================= */}
              {/* TAB 2: MILESTONE TASKS EXECUTION                             */}
              {/* ============================================================= */}
              {activeTab === "tasks" && (
                <div className="bg-white rounded-xl border border-[#E4E4E7] shadow-xs overflow-hidden">
                  <div className="p-4 bg-[#FAFAFA] border-b border-[#E4E4E7] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div>
                      <h3 className="text-xs font-bold text-[#18181B] uppercase tracking-wider">
                        Milestone Task Execution
                      </h3>
                      <p className="text-[11px] text-[#71717A] mt-0.5">
                        State machine: Created → Assigned → InProgress → Completed → Verified.
                      </p>
                    </div>

                    <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
                      {/* Filter by Status */}
                      <select
                        value={taskStatusFilter}
                        onChange={(e) => setTaskStatusFilter(e.target.value)}
                        className="bg-white text-xs py-1.5 px-2.5 rounded-lg border border-[#D4D4D8] font-medium text-[#18181B] focus:ring-2 focus:ring-[#0D7A5F] focus:outline-none"
                      >
                        <option value="ALL">All Statuses</option>
                        <option value="Created">Created</option>
                        <option value="Assigned">Assigned</option>
                        <option value="InProgress">InProgress</option>
                        <option value="Completed">Completed</option>
                        <option value="Verified">Verified</option>
                      </select>

                      <button
                        type="button"
                        onClick={() => handleOpenAddTask()}
                        className="h-8 px-3 rounded-lg bg-[#0D7A5F] hover:bg-[#0A624C] text-white text-xs font-bold inline-flex items-center gap-1.5 transition shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0D7A5F]"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add Task</span>
                      </button>
                    </div>
                  </div>

                  <div className="divide-y divide-[#E4E4E7]">
                    {filteredTasks.length === 0 ? (
                      <div className="py-12 text-center text-xs text-[#71717A]">
                        <ListTodo className="w-8 h-8 text-[#A1A1AA] mx-auto mb-2 opacity-50" />
                        <p className="font-semibold text-[#18181B]">No milestone tasks found</p>
                        <p className="text-[11px] mt-0.5">
                          {taskStatusFilter !== "ALL"
                            ? `No tasks currently with status "${taskStatusFilter}"`
                            : "Create execution tasks linked to your BOQ schedule to track job milestones."}
                        </p>
                        <button
                          type="button"
                          onClick={() => handleOpenAddTask()}
                          className="mt-3 px-3 py-1.5 rounded-lg bg-[#0D7A5F] text-white text-xs font-semibold hover:bg-[#0A624C] transition inline-flex items-center gap-1.5"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          Add First Task
                        </button>
                      </div>
                    ) : (
                      filteredTasks.map((task) => (
                        <div
                          key={task.id}
                          className="p-4 hover:bg-[#FAFAFA] transition flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h4 className="text-xs font-bold text-[#18181B]">{task.title}</h4>
                              {task.boqItem && (
                                <span className="font-mono text-[10px] font-bold text-[#0D7A5F] bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                                  Linked: {task.boqItem.itemCode}
                                </span>
                              )}
                            </div>

                            {task.description && (
                              <p className="text-[11px] text-[#52525B] max-w-xl">
                                {task.description}
                              </p>
                            )}

                            <div className="flex items-center gap-3 text-[11px] text-[#71717A] pt-0.5">
                              <span className="flex items-center gap-1">
                                <User className="w-3 h-3 text-[#A1A1AA]" />
                                <span>
                                  Assigned:{" "}
                                  <strong className="text-[#18181B]">
                                    {task.assignedTechnician?.name || "Unassigned"}
                                  </strong>
                                </span>
                              </span>
                              <span>•</span>
                              <span>Created: {formatDate(task.createdAt)}</span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2.5 shrink-0 self-end sm:self-auto">
                            <StatusBadge status={task.status} />

                            {/* State Machine Transition Dropdown */}
                            <select
                              value={task.status}
                              onChange={(e) => handleUpdateTaskStatus(task.id, e.target.value)}
                              className="bg-white text-xs py-1 px-2 rounded-lg border border-[#D4D4D8] focus:ring-2 focus:ring-[#0D7A5F] text-[#18181B] font-semibold"
                            >
                              <option value="Created">Created</option>
                              <option value="Assigned">Assigned</option>
                              <option value="InProgress">InProgress</option>
                              <option value="Completed">Completed</option>
                              <option value="Verified">Verified</option>
                            </select>

                            <button
                              type="button"
                              onClick={() => handleOpenEditTask(task)}
                              className="p-1.5 hover:bg-[#F4F4F5] rounded-lg text-[#71717A] hover:text-[#18181B] transition"
                              title="Edit Task"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setTaskToDelete(task);
                                setShowDeleteTaskModal(true);
                              }}
                              className="p-1.5 hover:bg-rose-50 rounded-lg text-[#71717A] hover:text-rose-600 transition"
                              title="Delete Task"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* ============================================================= */}
              {/* TAB 3: FINANCIAL & BUDGET ANALYSIS                           */}
              {/* ============================================================= */}
              {activeTab === "analytics" && (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Top 5 High Value BOQ Items */}
                    <div className="bg-white rounded-xl border border-[#E4E4E7] p-5 shadow-xs space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-xs font-bold text-[#18181B] uppercase tracking-wider flex items-center gap-2">
                          <PieChart className="w-4 h-4 text-[#0D7A5F]" />
                          Highest Value BOQ Items
                        </h3>
                        <span className="text-[11px] text-[#71717A]">By scheduled total</span>
                      </div>

                      <div className="space-y-3">
                        {[...(selectedProject.boqItems || [])]
                          .sort(
                            (a, b) =>
                              (Number(b.plannedQty) || 0) * (Number(b.unitRate) || 0) -
                              (Number(a.plannedQty) || 0) * (Number(a.unitRate) || 0)
                          )
                          .slice(0, 5)
                          .map((item, idx) => {
                            const val = (Number(item.plannedQty) || 0) * (Number(item.unitRate) || 0);
                            const share = scheduledBOQTotal > 0 ? Math.round((val / scheduledBOQTotal) * 100) : 0;

                            return (
                              <div key={item.id} className="space-y-1 text-xs">
                                <div className="flex items-center justify-between">
                                  <span className="font-semibold text-[#18181B] truncate max-w-[220px]">
                                    {idx + 1}. {item.itemCode} - {item.description}
                                  </span>
                                  <span className="font-mono font-bold text-[#0D7A5F]">
                                    {formatCurrency(val)} ({share}%)
                                  </span>
                                </div>
                                <div className="w-full bg-[#F4F4F5] rounded-full h-1.5 overflow-hidden">
                                  <div
                                    className="bg-[#0D7A5F] h-full rounded-full transition-all"
                                    style={{ width: `${share}%` }}
                                  />
                                </div>
                              </div>
                            );
                          })}
                      </div>
                    </div>

                    {/* Milestone State Machine Distribution */}
                    <div className="bg-white rounded-xl border border-[#E4E4E7] p-5 shadow-xs space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-xs font-bold text-[#18181B] uppercase tracking-wider flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-[#0D7A5F]" />
                          Milestone Task Breakdown
                        </h3>
                        <span className="text-[11px] text-[#71717A]">Workflow lifecycle</span>
                      </div>

                      <div className="space-y-3 text-xs">
                        {["Created", "Assigned", "InProgress", "Completed", "Verified"].map((st) => {
                          const count = (selectedProject.tasks || []).filter((t) => t.status === st).length;
                          const pct = totalTasksCount > 0 ? Math.round((count / totalTasksCount) * 100) : 0;

                          return (
                            <div key={st} className="space-y-1">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <StatusBadge status={st} />
                                  <span className="text-[#52525B] font-medium">{st}</span>
                                </div>
                                <span className="font-mono font-bold text-[#18181B]">
                                  {count} tasks ({pct}%)
                                </span>
                              </div>
                              <div className="w-full bg-[#F4F4F5] rounded-full h-1.5 overflow-hidden">
                                <div
                                  className={cn(
                                    "h-full rounded-full transition-all",
                                    st === "Verified" || st === "Completed"
                                      ? "bg-emerald-600"
                                      : st === "InProgress"
                                      ? "bg-sky-500"
                                      : "bg-slate-400"
                                  )}
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ============================================================= */}
              {/* TAB 4: INTERACTIVE GANTT & SCHEDULE                           */}
              {/* ============================================================= */}
              {activeTab === "gantt" && (
                <ProjectGanttTab
                  projectId={selectedProject.id}
                  tasks={selectedProject.tasks || []}
                  technicians={technicians}
                  onRefresh={() => loadData(selectedProject.id)}
                  showToast={showToast}
                  onOpenAddTask={() => handleOpenAddTask()}
                />
              )}

              {/* ============================================================= */}
              {/* TAB 5: PROGRESS BILLING & INVOICES                            */}
              {/* ============================================================= */}
              {activeTab === "billing" && (
                <ProjectBillingTab
                  projectId={selectedProject.id}
                  projectNumber={selectedProject.projectNumber}
                  projectName={selectedProject.name}
                  contractValue={selectedProject.contractValue || selectedProject.totalBudget}
                  totalBudget={selectedProject.totalBudget}
                  invoicedAmount={selectedProject.invoicedAmount || 0}
                  retentionPercent={selectedProject.retentionPercent || 0}
                  milestones={selectedProject.milestones || []}
                  invoices={selectedProject.invoices || []}
                  onRefresh={() => loadData(selectedProject.id)}
                  showToast={showToast}
                />
              )}

              {/* ============================================================= */}
              {/* TAB 6: BOQ REVISIONS & CHANGE ORDERS                          */}
              {/* ============================================================= */}
              {activeTab === "changeOrders" && (
                <ProjectChangeOrdersTab
                  projectId={selectedProject.id}
                  projectNumber={selectedProject.projectNumber}
                  projectName={selectedProject.name}
                  currentRevision={selectedProject.revision || 1}
                  changeOrders={selectedProject.changeOrders || []}
                  boqItems={selectedProject.boqItems || []}
                  onRefresh={() => loadData(selectedProject.id)}
                  showToast={showToast}
                />
              )}
            </>
          ) : (
            <div className="bg-white rounded-xl border border-[#E4E4E7] p-12 text-center text-xs text-[#71717A] shadow-xs">
              <FolderKanban className="w-10 h-10 text-[#A1A1AA] mx-auto mb-3 opacity-60" />
              <h3 className="text-sm font-bold text-[#18181B]">No Project Selected</h3>
              <p className="text-xs text-[#71717A] mt-1 max-w-sm mx-auto">
                Select a commercial project from the directory on the left or create a new project contract to begin managing BOQ schedules.
              </p>
              <button
                type="button"
                onClick={handleOpenCreateProject}
                className="mt-4 px-4 py-2 rounded-lg bg-[#0D7A5F] text-white text-xs font-bold hover:bg-[#0A624C] transition inline-flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                Create New Project
              </button>
            </div>
          )}
        </div>
      </div>

      {/* =================================================================== */}
      {/* DRAWER: CREATE PROJECT                                              */}
      {/* =================================================================== */}
      <SideDrawer
        isOpen={showNewProjectModal}
        onClose={() => setShowNewProjectModal(false)}
        title={
          <div className="flex items-center gap-2">
            <FolderKanban className="w-4 h-4 text-[#0D7A5F]" />
            <span>Create Commercial Project</span>
          </div>
        }
        subtitle="Initialize commercial contract scope, client details, and optional initial BOQ schedule"
        width="max-w-2xl"
        footer={
          <div className="flex items-center justify-end gap-2.5 w-full">
            <button
              type="button"
              onClick={() => setShowNewProjectModal(false)}
              className="px-3.5 py-2 text-xs text-[#71717A] hover:text-[#18181B] font-semibold rounded-lg hover:bg-[#F4F4F5] transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="create-project-form"
              className="px-5 py-2 bg-[#0D7A5F] hover:bg-[#0A624C] text-white rounded-lg text-xs font-bold transition shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0D7A5F]"
            >
              Create Project
            </button>
          </div>
        }
      >
        <form id="create-project-form" onSubmit={handleCreateProjectSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-[#52525B] block mb-1">
              Project Name / Contract Scope *
            </label>
            <input
              type="text"
              placeholder="e.g. Al-Barsha Commercial Complex HVAC Fitout"
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
              className="w-full bg-[#FAFAFA] p-2 rounded-lg text-xs border border-[#D4D4D8] focus:ring-2 focus:ring-[#0D7A5F] focus:outline-none text-[#18181B]"
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-[#52525B] block mb-1">
                Client / Customer *
              </label>
              <SearchableSelect
                value={newProjectCustomerId}
                onChange={(val) => setNewProjectCustomerId(val)}
                placeholder="Select commercial customer..."
                searchPlaceholder="Search client by name/phone..."
                options={customerOptions}
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-[#52525B] block mb-1">
                Project Status
              </label>
              <select
                value={newProjectStatus}
                onChange={(e) => setNewProjectStatus(e.target.value)}
                className="w-full bg-[#FAFAFA] p-2 rounded-lg text-xs border border-[#D4D4D8] focus:ring-2 focus:ring-[#0D7A5F] focus:outline-none text-[#18181B] font-medium"
              >
                <option value="planning">Planning</option>
                <option value="active">Active Execution</option>
                <option value="completed">Completed</option>
                <option value="on_hold">On Hold</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-[#52525B] block mb-1">
              Contract Budget (PKR) *
            </label>
            <input
              type="number"
              step="any"
              min="0"
              placeholder="e.g. 150000"
              value={newProjectBudget}
              onChange={(e) => setNewProjectBudget(e.target.value)}
              className="w-full bg-[#FAFAFA] p-2 rounded-lg text-xs border border-[#D4D4D8] focus:ring-2 focus:ring-[#0D7A5F] focus:outline-none text-[#18181B] font-mono font-bold"
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-[#52525B] block mb-1">
                Start Date
              </label>
              <input
                type="date"
                value={newProjectStartDate}
                onChange={(e) => setNewProjectStartDate(e.target.value)}
                className="w-full bg-[#FAFAFA] p-2 rounded-lg text-xs border border-[#D4D4D8] focus:ring-2 focus:ring-[#0D7A5F] focus:outline-none text-[#18181B]"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-[#52525B] block mb-1">
                Target Completion Date
              </label>
              <input
                type="date"
                value={newProjectEndDate}
                onChange={(e) => setNewProjectEndDate(e.target.value)}
                className="w-full bg-[#FAFAFA] p-2 rounded-lg text-xs border border-[#D4D4D8] focus:ring-2 focus:ring-[#0D7A5F] focus:outline-none text-[#18181B]"
              />
            </div>
          </div>

          {/* Initial BOQ Schedule Rows Builder */}
          <div className="pt-3 border-t border-[#E4E4E7] space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#18181B] uppercase tracking-wider flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-[#0D7A5F]" />
                Initial BOQ Items (Optional)
              </span>
              <button
                type="button"
                onClick={handleAddBoqRowInNewProject}
                className="text-[11px] font-semibold text-[#0D7A5F] hover:underline inline-flex items-center gap-1"
              >
                <Plus className="w-3 h-3" />
                Add Row
              </button>
            </div>

            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {newProjectBoqRows.map((row, idx) => (
                <div
                  key={idx}
                  className="grid grid-cols-12 gap-2 p-2 bg-[#FAFAFA] rounded-lg border border-[#E4E4E7] items-center text-xs"
                >
                  <div className="col-span-2">
                    <input
                      type="text"
                      placeholder="Code"
                      value={row.itemCode}
                      onChange={(e) => {
                        const next = [...newProjectBoqRows];
                        next[idx].itemCode = e.target.value;
                        setNewProjectBoqRows(next);
                      }}
                      className="w-full bg-white p-1.5 rounded border border-[#D4D4D8] text-[11px] font-mono font-bold"
                    />
                  </div>
                  <div className="col-span-4">
                    <input
                      type="text"
                      placeholder="Description / Scope"
                      value={row.description}
                      onChange={(e) => {
                        const next = [...newProjectBoqRows];
                        next[idx].description = e.target.value;
                        setNewProjectBoqRows(next);
                      }}
                      className="w-full bg-white p-1.5 rounded border border-[#D4D4D8] text-[11px]"
                    />
                  </div>
                  <div className="col-span-2">
                    <select
                      value={row.unit}
                      onChange={(e) => {
                        const next = [...newProjectBoqRows];
                        next[idx].unit = e.target.value;
                        setNewProjectBoqRows(next);
                      }}
                      className="w-full bg-white p-1.5 rounded border border-[#D4D4D8] text-[11px]"
                    >
                      {COMMON_UNITS.map((u) => (
                        <option key={u} value={u}>
                          {u}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="col-span-1">
                    <input
                      type="number"
                      min="1"
                      placeholder="Qty"
                      value={row.plannedQty}
                      onChange={(e) => {
                        const next = [...newProjectBoqRows];
                        next[idx].plannedQty = Number(e.target.value) || 1;
                        setNewProjectBoqRows(next);
                      }}
                      className="w-full bg-white p-1.5 rounded border border-[#D4D4D8] text-[11px] font-mono text-center"
                    />
                  </div>
                  <div className="col-span-2">
                    <input
                      type="number"
                      step="any"
                      placeholder="Rate"
                      value={row.unitRate}
                      onChange={(e) => {
                        const next = [...newProjectBoqRows];
                        next[idx].unitRate = Number(e.target.value) || 0;
                        setNewProjectBoqRows(next);
                      }}
                      className="w-full bg-white p-1.5 rounded border border-[#D4D4D8] text-[11px] font-mono text-right"
                    />
                  </div>
                  <div className="col-span-1 text-center">
                    <button
                      type="button"
                      onClick={() => handleRemoveBoqRowInNewProject(idx)}
                      disabled={newProjectBoqRows.length <= 1}
                      className="text-zinc-400 hover:text-rose-600 disabled:opacity-20"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </form>
      </SideDrawer>

      {/* =================================================================== */}
      {/* DRAWER: EDIT PROJECT                                                */}
      {/* =================================================================== */}
      <SideDrawer
        isOpen={showEditProjectModal}
        onClose={() => setShowEditProjectModal(false)}
        title={
          <div className="flex items-center gap-2">
            <Edit3 className="w-4 h-4 text-[#0D7A5F]" />
            <span>Edit Project Details</span>
          </div>
        }
        subtitle="Update project scope, client allocation, status, and contract dates"
        width="max-w-lg"
        footer={
          <div className="flex items-center justify-end gap-2.5 w-full">
            <button
              type="button"
              onClick={() => setShowEditProjectModal(false)}
              className="px-3.5 py-2 text-xs text-[#71717A] hover:text-[#18181B] font-semibold rounded-lg hover:bg-[#F4F4F5] transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="edit-project-form"
              className="px-5 py-2 bg-[#0D7A5F] hover:bg-[#0A624C] text-white rounded-lg text-xs font-bold transition shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0D7A5F]"
            >
              Save Changes
            </button>
          </div>
        }
      >
        <form id="edit-project-form" onSubmit={handleEditProjectSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-[#52525B] block mb-1">
              Project Name *
            </label>
            <input
              type="text"
              value={editProjectName}
              onChange={(e) => setEditProjectName(e.target.value)}
              className="w-full bg-[#FAFAFA] p-2 rounded-lg text-xs border border-[#D4D4D8] focus:ring-2 focus:ring-[#0D7A5F] focus:outline-none text-[#18181B]"
              required
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-[#52525B] block mb-1">
              Customer / Client *
            </label>
            <SearchableSelect
              value={editProjectCustomerId}
              onChange={(val) => setEditProjectCustomerId(val)}
              options={customerOptions}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-[#52525B] block mb-1">
                Contract Budget (PKR)
              </label>
              <input
                type="number"
                step="any"
                value={editProjectBudget}
                onChange={(e) => setEditProjectBudget(e.target.value)}
                className="w-full bg-[#FAFAFA] p-2 rounded-lg text-xs border border-[#D4D4D8] focus:ring-2 focus:ring-[#0D7A5F] focus:outline-none text-[#18181B] font-mono font-bold"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-[#52525B] block mb-1">
                Lifecycle Status
              </label>
              <select
                value={editProjectStatus}
                onChange={(e) => setEditProjectStatus(e.target.value)}
                className="w-full bg-[#FAFAFA] p-2 rounded-lg text-xs border border-[#D4D4D8] focus:ring-2 focus:ring-[#0D7A5F] focus:outline-none text-[#18181B] font-medium"
              >
                <option value="planning">Planning</option>
                <option value="active">Active Execution</option>
                <option value="completed">Completed</option>
                <option value="on_hold">On Hold</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-[#52525B] block mb-1">
                Start Date
              </label>
              <input
                type="date"
                value={editProjectStartDate}
                onChange={(e) => setEditProjectStartDate(e.target.value)}
                className="w-full bg-[#FAFAFA] p-2 rounded-lg text-xs border border-[#D4D4D8] focus:ring-2 focus:ring-[#0D7A5F] focus:outline-none text-[#18181B]"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-[#52525B] block mb-1">
                Completion Date
              </label>
              <input
                type="date"
                value={editProjectEndDate}
                onChange={(e) => setEditProjectEndDate(e.target.value)}
                className="w-full bg-[#FAFAFA] p-2 rounded-lg text-xs border border-[#D4D4D8] focus:ring-2 focus:ring-[#0D7A5F] focus:outline-none text-[#18181B]"
              />
            </div>
          </div>
        </form>
      </SideDrawer>

      {/* =================================================================== */}
      {/* DRAWER: ADD BOQ ITEM                                                */}
      {/* =================================================================== */}
      <SideDrawer
        isOpen={showNewBoqModal}
        onClose={() => setShowNewBoqModal(false)}
        title={
          <div className="flex items-center gap-2">
            <Plus className="w-4 h-4 text-[#0D7A5F]" />
            <span>Add Bill of Quantities (BOQ) Item</span>
          </div>
        }
        subtitle={selectedProject ? `Project: ${selectedProject.name}` : undefined}
        width="max-w-md"
        footer={
          <div className="flex items-center justify-end gap-2.5 w-full">
            <button
              type="button"
              onClick={() => setShowNewBoqModal(false)}
              className="px-3.5 py-2 text-xs text-[#71717A] hover:text-[#18181B] font-semibold rounded-lg hover:bg-[#F4F4F5] transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="create-boq-form"
              className="px-5 py-2 bg-[#0D7A5F] hover:bg-[#0A624C] text-white rounded-lg text-xs font-bold transition shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0D7A5F]"
            >
              Add to Schedule
            </button>
          </div>
        }
      >
        <form id="create-boq-form" onSubmit={handleCreateBOQSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-[#52525B] block mb-1">
                BOQ Item Code *
              </label>
              <input
                type="text"
                value={boqItemCode}
                onChange={(e) => setBoqItemCode(e.target.value)}
                className="w-full bg-[#FAFAFA] p-2 rounded-lg text-xs border border-[#D4D4D8] focus:ring-2 focus:ring-[#0D7A5F] focus:outline-none text-[#18181B] font-mono font-bold"
                required
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-[#52525B] block mb-1">
                Unit of Measure *
              </label>
              <select
                value={boqUnit}
                onChange={(e) => setBoqUnit(e.target.value)}
                className="w-full bg-[#FAFAFA] p-2 rounded-lg text-xs border border-[#D4D4D8] focus:ring-2 focus:ring-[#0D7A5F] focus:outline-none text-[#18181B] font-medium"
              >
                {COMMON_UNITS.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-[#52525B] block mb-1">
              Description & Scope of Work *
            </label>
            <textarea
              rows={3}
              placeholder="e.g. Supply and install 24-gauge GI sheet rectangular ducting with 25mm fiberglass insulation"
              value={boqDescription}
              onChange={(e) => setBoqDescription(e.target.value)}
              className="w-full bg-[#FAFAFA] p-2 rounded-lg text-xs border border-[#D4D4D8] focus:ring-2 focus:ring-[#0D7A5F] focus:outline-none text-[#18181B]"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-[#52525B] block mb-1">
                Planned Quantity *
              </label>
              <input
                type="number"
                step="any"
                min="0.01"
                placeholder="1"
                value={boqPlannedQty}
                onChange={(e) => setBoqPlannedQty(e.target.value)}
                className="w-full bg-[#FAFAFA] p-2 rounded-lg text-xs border border-[#D4D4D8] focus:ring-2 focus:ring-[#0D7A5F] focus:outline-none text-[#18181B] font-mono font-bold"
                required
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-[#52525B] block mb-1">
                Unit Rate (PKR) *
              </label>
              <input
                type="number"
                step="any"
                min="0"
                placeholder="0"
                value={boqUnitRate}
                onChange={(e) => setBoqUnitRate(e.target.value)}
                className="w-full bg-[#FAFAFA] p-2 rounded-lg text-xs border border-[#D4D4D8] focus:ring-2 focus:ring-[#0D7A5F] focus:outline-none text-[#18181B] font-mono font-bold"
                required
              />
            </div>
          </div>

          {/* Live Calculated Amount */}
          <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-200 flex items-center justify-between text-xs">
            <span className="font-semibold text-emerald-900">Total Scheduled Amount:</span>
            <span className="font-mono font-black text-sm text-[#0D7A5F]">
              {formatCurrency((Number(boqPlannedQty) || 0) * (Number(boqUnitRate) || 0))}
            </span>
          </div>
        </form>
      </SideDrawer>

      {/* =================================================================== */}
      {/* DRAWER: EDIT BOQ ITEM                                               */}
      {/* =================================================================== */}
      <SideDrawer
        isOpen={showEditBoqModal}
        onClose={() => setShowEditBoqModal(false)}
        title={
          <div className="flex items-center gap-2">
            <Edit3 className="w-4 h-4 text-[#0D7A5F]" />
            <span>Edit BOQ Schedule Item</span>
          </div>
        }
        subtitle={editingBoqItem ? `Item: ${editingBoqItem.itemCode}` : undefined}
        width="max-w-md"
        footer={
          <div className="flex items-center justify-end gap-2.5 w-full">
            <button
              type="button"
              onClick={() => setShowEditBoqModal(false)}
              className="px-3.5 py-2 text-xs text-[#71717A] hover:text-[#18181B] font-semibold rounded-lg hover:bg-[#F4F4F5] transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="edit-boq-form"
              className="px-5 py-2 bg-[#0D7A5F] hover:bg-[#0A624C] text-white rounded-lg text-xs font-bold transition shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0D7A5F]"
            >
              Save Changes
            </button>
          </div>
        }
      >
        <form id="edit-boq-form" onSubmit={handleEditBOQSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-[#52525B] block mb-1">
                BOQ Item Code *
              </label>
              <input
                type="text"
                value={editBoqItemCode}
                onChange={(e) => setEditBoqItemCode(e.target.value)}
                className="w-full bg-[#FAFAFA] p-2 rounded-lg text-xs border border-[#D4D4D8] focus:ring-2 focus:ring-[#0D7A5F] focus:outline-none text-[#18181B] font-mono font-bold"
                required
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-[#52525B] block mb-1">
                Unit of Measure *
              </label>
              <select
                value={editBoqUnit}
                onChange={(e) => setEditBoqUnit(e.target.value)}
                className="w-full bg-[#FAFAFA] p-2 rounded-lg text-xs border border-[#D4D4D8] focus:ring-2 focus:ring-[#0D7A5F] focus:outline-none text-[#18181B] font-medium"
              >
                {COMMON_UNITS.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-[#52525B] block mb-1">
              Description & Scope *
            </label>
            <textarea
              rows={3}
              value={editBoqDescription}
              onChange={(e) => setEditBoqDescription(e.target.value)}
              className="w-full bg-[#FAFAFA] p-2 rounded-lg text-xs border border-[#D4D4D8] focus:ring-2 focus:ring-[#0D7A5F] focus:outline-none text-[#18181B]"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-[#52525B] block mb-1">
                Planned Quantity *
              </label>
              <input
                type="number"
                step="any"
                min="0.01"
                value={editBoqPlannedQty}
                onChange={(e) => setEditBoqPlannedQty(e.target.value)}
                className="w-full bg-[#FAFAFA] p-2 rounded-lg text-xs border border-[#D4D4D8] focus:ring-2 focus:ring-[#0D7A5F] focus:outline-none text-[#18181B] font-mono font-bold"
                required
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-[#52525B] block mb-1">
                Unit Rate (PKR) *
              </label>
              <input
                type="number"
                step="any"
                min="0"
                value={editBoqUnitRate}
                onChange={(e) => setEditBoqUnitRate(e.target.value)}
                className="w-full bg-[#FAFAFA] p-2 rounded-lg text-xs border border-[#D4D4D8] focus:ring-2 focus:ring-[#0D7A5F] focus:outline-none text-[#18181B] font-mono font-bold"
                required
              />
            </div>
          </div>

          <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-200 flex items-center justify-between text-xs">
            <span className="font-semibold text-emerald-900">Total Scheduled Amount:</span>
            <span className="font-mono font-black text-sm text-[#0D7A5F]">
              {formatCurrency((Number(editBoqPlannedQty) || 0) * (Number(editBoqUnitRate) || 0))}
            </span>
          </div>
        </form>
      </SideDrawer>

      {/* =================================================================== */}
      {/* DRAWER: ADD MILESTONE TASK                                          */}
      {/* =================================================================== */}
      <SideDrawer
        isOpen={showNewTaskModal}
        onClose={() => setShowNewTaskModal(false)}
        title={
          <div className="flex items-center gap-2">
            <ListTodo className="w-4 h-4 text-[#0D7A5F]" />
            <span>Add Milestone Task</span>
          </div>
        }
        subtitle={selectedProject ? `Project: ${selectedProject.name}` : undefined}
        width="max-w-md"
        footer={
          <div className="flex items-center justify-end gap-2.5 w-full">
            <button
              type="button"
              onClick={() => setShowNewTaskModal(false)}
              className="px-3.5 py-2 text-xs text-[#71717A] hover:text-[#18181B] font-semibold rounded-lg hover:bg-[#F4F4F5] transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="create-task-form"
              className="px-5 py-2 bg-[#0D7A5F] hover:bg-[#0A624C] text-white rounded-lg text-xs font-bold transition shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0D7A5F]"
            >
              Create Milestone
            </button>
          </div>
        }
      >
        <form id="create-task-form" onSubmit={handleCreateTaskSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-[#52525B] block mb-1">
              Task Title / Milestone *
            </label>
            <input
              type="text"
              placeholder="e.g. Rough-in duct pressure test and seal joints"
              value={taskTitle}
              onChange={(e) => setTaskTitle(e.target.value)}
              className="w-full bg-[#FAFAFA] p-2 rounded-lg text-xs border border-[#D4D4D8] focus:ring-2 focus:ring-[#0D7A5F] focus:outline-none text-[#18181B]"
              required
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-[#52525B] block mb-1">
              Link to BOQ Item (Optional)
            </label>
            <SearchableSelect
              value={taskBoqItemId}
              onChange={(val) => setTaskBoqItemId(val)}
              placeholder="None (Independent Task)"
              searchPlaceholder="Search BOQ item..."
              clearable
              options={boqItemOptions}
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-[#52525B] block mb-1">
              Assign Field Technician
            </label>
            <SearchableSelect
              value={taskTechnicianId}
              onChange={(val) => setTaskTechnicianId(val)}
              placeholder="Select technician to assign..."
              searchPlaceholder="Search technicians by name/status..."
              clearable
              options={technicianOptions}
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-[#52525B] block mb-1">
              Initial Workflow State
            </label>
            <select
              value={taskStatus}
              onChange={(e) => setTaskStatus(e.target.value)}
              className="w-full bg-[#FAFAFA] p-2 rounded-lg text-xs border border-[#D4D4D8] focus:ring-2 focus:ring-[#0D7A5F] focus:outline-none text-[#18181B] font-medium"
            >
              <option value="Created">Created</option>
              <option value="Assigned">Assigned</option>
              <option value="InProgress">InProgress</option>
              <option value="Completed">Completed</option>
              <option value="Verified">Verified</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold text-[#52525B] block mb-1">
              Task Notes / Instructions
            </label>
            <textarea
              rows={3}
              placeholder="Enter technical instructions, specs, or acceptance criteria..."
              value={taskDescription}
              onChange={(e) => setTaskDescription(e.target.value)}
              className="w-full bg-[#FAFAFA] p-2 rounded-lg text-xs border border-[#D4D4D8] focus:ring-2 focus:ring-[#0D7A5F] focus:outline-none text-[#18181B]"
            />
          </div>
        </form>
      </SideDrawer>

      {/* =================================================================== */}
      {/* DRAWER: EDIT MILESTONE TASK                                         */}
      {/* =================================================================== */}
      <SideDrawer
        isOpen={showEditTaskModal}
        onClose={() => setShowEditTaskModal(false)}
        title={
          <div className="flex items-center gap-2">
            <Edit3 className="w-4 h-4 text-[#0D7A5F]" />
            <span>Edit Milestone Task</span>
          </div>
        }
        subtitle={editingTask ? `Task: ${editingTask.title}` : undefined}
        width="max-w-md"
        footer={
          <div className="flex items-center justify-end gap-2.5 w-full">
            <button
              type="button"
              onClick={() => setShowEditTaskModal(false)}
              className="px-3.5 py-2 text-xs text-[#71717A] hover:text-[#18181B] font-semibold rounded-lg hover:bg-[#F4F4F5] transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="edit-task-form"
              className="px-5 py-2 bg-[#0D7A5F] hover:bg-[#0A624C] text-white rounded-lg text-xs font-bold transition shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0D7A5F]"
            >
              Save Changes
            </button>
          </div>
        }
      >
        <form id="edit-task-form" onSubmit={handleEditTaskSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-[#52525B] block mb-1">
              Task Title *
            </label>
            <input
              type="text"
              value={editTaskTitle}
              onChange={(e) => setEditTaskTitle(e.target.value)}
              className="w-full bg-[#FAFAFA] p-2 rounded-lg text-xs border border-[#D4D4D8] focus:ring-2 focus:ring-[#0D7A5F] focus:outline-none text-[#18181B]"
              required
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-[#52525B] block mb-1">
              Linked BOQ Item
            </label>
            <SearchableSelect
              value={editTaskBoqItemId}
              onChange={(val) => setEditTaskBoqItemId(val)}
              clearable
              options={boqItemOptions}
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-[#52525B] block mb-1">
              Assigned Field Technician
            </label>
            <SearchableSelect
              value={editTaskTechnicianId}
              onChange={(val) => setEditTaskTechnicianId(val)}
              clearable
              options={technicianOptions}
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-[#52525B] block mb-1">
              Workflow Status
            </label>
            <select
              value={editTaskStatus}
              onChange={(e) => setEditTaskStatus(e.target.value)}
              className="w-full bg-[#FAFAFA] p-2 rounded-lg text-xs border border-[#D4D4D8] focus:ring-2 focus:ring-[#0D7A5F] focus:outline-none text-[#18181B] font-medium"
            >
              <option value="Created">Created</option>
              <option value="Assigned">Assigned</option>
              <option value="InProgress">InProgress</option>
              <option value="Completed">Completed</option>
              <option value="Verified">Verified</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold text-[#52525B] block mb-1">
              Task Notes / Instructions
            </label>
            <textarea
              rows={3}
              value={editTaskDescription}
              onChange={(e) => setEditTaskDescription(e.target.value)}
              className="w-full bg-[#FAFAFA] p-2 rounded-lg text-xs border border-[#D4D4D8] focus:ring-2 focus:ring-[#0D7A5F] focus:outline-none text-[#18181B]"
            />
          </div>
        </form>
      </SideDrawer>

      {/* =================================================================== */}
      {/* CONFIRMATION MODAL: DELETE PROJECT                                  */}
      {/* =================================================================== */}
      {showDeleteProjectModal && projectToDelete && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl border border-[#E4E4E7] space-y-4 animate-in fade-in zoom-in-95">
            <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[#18181B]">Delete Commercial Project?</h3>
              <p className="text-xs text-[#52525B] mt-1.5 leading-relaxed">
                Are you sure you want to delete{" "}
                <strong className="text-[#18181B]">{projectToDelete.projectNumber} — {projectToDelete.name}</strong>?
                This will permanently delete all associated BOQ items, planned rates, and milestone task progress.
              </p>
            </div>
            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-[#E4E4E7]">
              <button
                type="button"
                onClick={() => {
                  setShowDeleteProjectModal(false);
                  setProjectToDelete(null);
                }}
                className="px-4 py-2 text-xs font-semibold text-[#71717A] hover:text-[#18181B] rounded-lg hover:bg-[#F4F4F5] transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteProject}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold transition shadow-xs"
              >
                Yes, Delete Project
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* CONFIRMATION MODAL: DELETE BOQ ITEM                                 */}
      {/* =================================================================== */}
      {showDeleteBoqModal && boqToDelete && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl border border-[#E4E4E7] space-y-4 animate-in fade-in zoom-in-95">
            <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[#18181B]">Delete BOQ Schedule Item?</h3>
              <p className="text-xs text-[#52525B] mt-1.5 leading-relaxed">
                Remove item <strong className="text-[#18181B]">{boqToDelete.itemCode}</strong> (
                {boqToDelete.description})? Any linked tasks will be decoupled from this schedule item.
              </p>
            </div>
            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-[#E4E4E7]">
              <button
                type="button"
                onClick={() => {
                  setShowDeleteBoqModal(false);
                  setBoqToDelete(null);
                }}
                className="px-4 py-2 text-xs font-semibold text-[#71717A] hover:text-[#18181B] rounded-lg hover:bg-[#F4F4F5] transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteBOQ}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold transition shadow-xs"
              >
                Delete BOQ Item
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* CONFIRMATION MODAL: DELETE TASK                                     */}
      {/* =================================================================== */}
      {showDeleteTaskModal && taskToDelete && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl border border-[#E4E4E7] space-y-4 animate-in fade-in zoom-in-95">
            <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[#18181B]">Delete Milestone Task?</h3>
              <p className="text-xs text-[#52525B] mt-1.5 leading-relaxed">
                Are you sure you want to remove task: <strong className="text-[#18181B]">{taskToDelete.title}</strong>?
              </p>
            </div>
            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-[#E4E4E7]">
              <button
                type="button"
                onClick={() => {
                  setShowDeleteTaskModal(false);
                  setTaskToDelete(null);
                }}
                className="px-4 py-2 text-xs font-semibold text-[#71717A] hover:text-[#18181B] rounded-lg hover:bg-[#F4F4F5] transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteTask}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold transition shadow-xs"
              >
                Delete Task
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* DRAWER: DIRECT PROCUREMENT FROM BOQ                                 */}
      {/* =================================================================== */}
      {selectedProject && (
        <ProjectProcurementDrawer
          isOpen={showProcurementDrawer}
          onClose={() => setShowProcurementDrawer(false)}
          projectId={selectedProject.id}
          projectNumber={selectedProject.projectNumber}
          projectName={selectedProject.name}
          selectedItems={(selectedProject.boqItems || []).filter((i) => selectedBoqIds.includes(i.id))}
          onSuccess={() => {
            setSelectedBoqIds([]);
            loadData(selectedProject.id);
          }}
          showToast={showToast}
        />
      )}

      {/* =================================================================== */}
      {/* MODAL: BOQ PROGRESS & ACTUAL COST VARIANCE                          */}
      {/* =================================================================== */}
      <BoqProgressModal
        isOpen={showBoqProgressModal}
        onClose={() => {
          setShowBoqProgressModal(false);
          setSelectedBoqForProgress(null);
        }}
        boqItem={selectedBoqForProgress}
        onSuccess={() => {
          if (selectedProject) loadData(selectedProject.id);
        }}
        showToast={showToast}
      />
    </div>
  );
}
