"use client";

import React, { useState, useEffect } from "react";
import StatusBadge from "@/components/ui/StatusBadge";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import {
  Briefcase,
  Clock,
  User,
  MapPin,
  Phone,
  CheckCircle2,
  AlertCircle,
  Play,
  Pause,
  Check,
  Plus,
  Receipt,
  Package,
  RotateCcw,
  Camera,
  RefreshCw,
  ExternalLink,
  ChevronRight,
  Bell,
  Navigation,
  Sparkles,
  ArrowRight,
  Percent,
  X,
  Wifi,
  BatteryCharging,
  ChevronDown,
  Sliders,
  Minus,
} from "lucide-react";
import { realtimeSync } from "@/lib/realtimeSync";
import { logActivity } from "@/lib/telemetry";

export default function MobileCompanionPage() {
  const [activeTab, setActiveTab] = useState<"jobs" | "attendance" | "profile">("jobs");
  const [technician, setTechnician] = useState<any>(null);
  const [allTechnicians, setAllTechnicians] = useState<any[]>([]);
  const [showTechSwitcherModal, setShowTechSwitcherModal] = useState(false);
  const [isTechDropdownOpen, setIsTechDropdownOpen] = useState(false);
  const [zoomLevel, setZoomLevel] = useState<number>(0.92);
  const [currentTime, setCurrentTime] = useState("09:41");
  const [jobs, setJobs] = useState<any[]>([]);
  const [selectedJob, setSelectedJob] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [jobSection, setJobSection] = useState<"all" | "assigned" | "active" | "paused" | "done" | "expenses">("all");

  // Live Phone Clock
  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      const hours = String(now.getHours()).padStart(2, "0");
      const mins = String(now.getMinutes()).padStart(2, "0");
      setCurrentTime(`${hours}:${mins}`);
    };
    updateClock();
    const interval = setInterval(updateClock, 30000);
    return () => clearInterval(interval);
  }, []);

  // Warehouse Inventory Products (Linked to Store)
  const [warehouseProducts, setWarehouseProducts] = useState<any[]>([]);

  // Sub-action modals on selected job
  const [showRequestInventoryModal, setShowRequestInventoryModal] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState("");
  const [reqQty, setReqQty] = useState("1");
  const [reqNotes, setReqNotes] = useState("");

  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [expenseAmount, setExpenseAmount] = useState("");
  const [expenseNote, setExpenseNote] = useState("");

  // Item-level discount requests
  const [showItemDiscountModal, setShowItemDiscountModal] = useState(false);
  const [selectedDiscountItem, setSelectedDiscountItem] = useState<any>(null);
  const [itemDiscountRequested, setItemDiscountRequested] = useState("");
  const [itemDiscountReason, setItemDiscountReason] = useState("");

  // Stop / Pause Job Scenario (e.g. 5 ACs planned, 3 fitted today, 2 tomorrow)
  const [showStopModal, setShowStopModal] = useState(false);
  const [unitsCompletedToday, setUnitsCompletedToday] = useState("3");
  const [unitsRemainingTomorrow, setUnitsRemainingTomorrow] = useState("2");
  const [pauseReason, setPauseReason] = useState(
    "Installed 3 AC units today; remaining 2 units scheduled for tomorrow morning."
  );

  // Complete Job & Unused Inventory Return (e.g. customer changed mind: 10 requested, only 8 used)
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [actualQuantities, setActualQuantities] = useState<Record<string, number | "">>({});
  const [unusedRemarks, setUnusedRemarks] = useState(
    "Customer changed mind on 2 units due to balcony space restriction."
  );
  const [completionWorkingRemarks, setCompletionWorkingRemarks] = useState(
    "Standard diagnostic & testing completed. Coils inspected, refrigerant charged, operating parameters normal."
  );
  const [paymentReceivedAmount, setPaymentReceivedAmount] = useState("");
  const [paymentMeans, setPaymentMeans] = useState<"cash" | "online" | "cheque" | "unmarked">("cash");
  const [paymentNotes, setPaymentNotes] = useState("");

  // Notifications & Feedback
  const [notificationToast, setNotificationToast] = useState<string | null>(null);
  const [newAssignmentAlert, setNewAssignmentAlert] = useState<any | null>(null);

  // Mobile attendance states
  const [simulatedFaceScore, setSimulatedFaceScore] = useState(98.2);
  const [attendanceMsg, setAttendanceMsg] = useState<any>(null);
  const [isCapturingFace, setIsCapturingFace] = useState(false);

  // Technician ledger balance
  const [techLedgerData, setTechLedgerData] = useState<any>(null);

  // Employee Self-Service (ESS) states
  const [techEssData, setTechEssData] = useState<any>(null);
  const [essSubTab, setEssSubTab] = useState<"ledger" | "leave" | "assets" | "payslips" | "helpdesk">("ledger");
  const [showMobileLeaveModal, setShowMobileLeaveModal] = useState(false);
  const [mobileLeaveTypeId, setMobileLeaveTypeId] = useState("");
  const [mobileLeaveStart, setMobileLeaveStart] = useState(new Date().toISOString().split("T")[0]);
  const [mobileLeaveEnd, setMobileLeaveEnd] = useState(new Date(Date.now() + 86400000 * 2).toISOString().split("T")[0]);
  const [mobileLeaveReason, setMobileLeaveReason] = useState("");
  const [showMobileGrievanceModal, setShowMobileGrievanceModal] = useState(false);
  const [mobileGrievanceCat, setMobileGrievanceCat] = useState("Equipment & Tools");
  const [mobileGrievanceDesc, setMobileGrievanceDesc] = useState("");

  const fetchTechnicianDetails = async (tech: any) => {
    try {
      // Fetch jobs assigned to this technician
      const jobsRes = await fetch(`/api/jobs?technicianId=${tech.id}`);
      const jobsData = await jobsRes.json();
      if (Array.isArray(jobsData)) {
        setJobs(jobsData);

        // Check if there is a newly assigned job awaiting acceptance
        const newlyAssigned = jobsData.find((j) => j.status === "Assigned");
        if (newlyAssigned) {
          setNewAssignmentAlert(newlyAssigned);
        } else {
          setNewAssignmentAlert(null);
        }

        if (selectedJob) {
          const updated = jobsData.find((j) => j.id === selectedJob.id);
          if (updated) setSelectedJob(updated);
        }
      }

      // Fetch ledger
      const ledgerRes = await fetch(`/api/accounts?view=technicians&technicianId=${tech.id}`);
      const ledgerData = await ledgerRes.json();
      setTechLedgerData(ledgerData);

      // Fetch detailed ESS profile
      try {
        const essRes = await fetch(`/api/hrm/employees/${tech.id}`);
        if (essRes.ok) {
          const essJson = await essRes.json();
          setTechEssData(essJson.employee);
          if (essJson.employee?.leaveBalances?.length > 0) {
            setMobileLeaveTypeId(essJson.employee.leaveBalances[0].leaveTypeId);
          }
        }
      } catch (err) {
        // ignore
      }
    } catch (e) {
      console.error("Failed loading technician details", e);
    }
  };

  const switchTechnician = async (tech: any) => {
    setTechnician(tech);
    setSelectedJob(null);
    setShowTechSwitcherModal(false);
    setIsTechDropdownOpen(false);
    setNotificationToast(`Switched active account to ${tech.name} (${tech.designation || "Technician"})`);
    setTimeout(() => setNotificationToast(null), 4000);
    await fetchTechnicianDetails(tech);
  };

  async function loadMobileData() {
    try {
      setLoading(true);
      const [techRes, invRes] = await Promise.all([
        fetch("/api/technicians"),
        fetch("/api/inventory"),
      ]);
      const data = await techRes.json();
      const invData = await invRes.json();

      const productsList = Array.isArray(invData) ? invData : (invData?.products || []);
      setWarehouseProducts(productsList);
      if (productsList.length > 0) {
        setSelectedProductId((prev) => (prev ? prev : productsList[0].id));
      }

      if (data.technicians && data.technicians.length > 0) {
        setAllTechnicians(data.technicians);
        const currentTech = technician
          ? data.technicians.find((t: any) => t.id === technician.id) || data.technicians[0]
          : data.technicians[0];
        setTechnician(currentTech);
        await fetchTechnicianDetails(currentTech);
      }
    } catch (e) {
      console.error("Failed loading mobile app data", e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadMobileData();
  }, []);

  // Real-time Event Subscription across ERP tabs/devices
  useEffect(() => {
    const unsubscribe = realtimeSync.subscribe((event) => {
      // Audio chime on mobile simulation
      if (typeof window !== "undefined") {
        try {
          const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.type = "sine";
          osc.frequency.setValueAtTime(587.33, ctx.currentTime);
          osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15);
          gain.gain.setValueAtTime(0.12, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
          osc.start();
          osc.stop(ctx.currentTime + 0.35);
        } catch (e) {}
      }

      if (event.type === "INVENTORY_FULFILLED") {
        setNotificationToast(`📦 Warehouse Storekeeper Bilal Sheikh issued requested materials!`);
        setTimeout(() => setNotificationToast(null), 5000);
        if (selectedJob) handleOpenJob(selectedJob.id);
        if (technician) fetchTechnicianDetails(technician);
      } else if (event.type === "DISCOUNT_GRANTED") {
        setNotificationToast(`✓ Accountant approved item discount! Updated live.`);
        setTimeout(() => setNotificationToast(null), 5000);
        if (selectedJob) handleOpenJob(selectedJob.id);
      } else if (event.type === "JOB_ASSIGNED") {
        if (!event.technicianId || event.technicianId === technician?.id) {
          setNotificationToast(`🚨 New Job #${event.jobNumber || ""} Assigned to You!`);
          setNewAssignmentAlert(event.payload?.job || { jobNumber: event.jobNumber, status: "Assigned" });
          setTimeout(() => setNotificationToast(null), 6000);
          if (technician) fetchTechnicianDetails(technician);
        }
      } else if (event.type === "STOCK_RETURN_ACKNOWLEDGED") {
        setNotificationToast(`✓ Storekeeper acknowledged returned material!`);
        setTimeout(() => setNotificationToast(null), 5000);
        if (selectedJob) handleOpenJob(selectedJob.id);
        if (technician) fetchTechnicianDetails(technician);
      } else if (event.type === "JOB_VERIFIED") {
        setNotificationToast(`✓ Job #${event.jobNumber} verified & settled by Accounts!`);
        setTimeout(() => setNotificationToast(null), 5000);
        if (selectedJob) handleOpenJob(selectedJob.id);
        if (technician) fetchTechnicianDetails(technician);
      }
    });

    return () => unsubscribe();
  }, [selectedJob?.id, technician?.id]);

  // Silent 3.5s real-time sync polling heartbeat
  useEffect(() => {
    if (!technician) return;
    const interval = setInterval(() => {
      fetchTechnicianDetails(technician);
      if (selectedJob) {
        fetch(`/api/jobs/${selectedJob.id}`)
          .then((r) => r.json())
          .then((updated) => {
            if (updated && updated.id) {
              setSelectedJob((prev: any) => {
                if (!prev) return updated;
                if (
                  prev.status !== updated.status ||
                  prev.discountAmount !== updated.discountAmount ||
                  JSON.stringify(prev.inventoryRequests) !== JSON.stringify(updated.inventoryRequests) ||
                  JSON.stringify(prev.items) !== JSON.stringify(updated.items)
                ) {
                  return updated;
                }
                return prev;
              });
            }
          })
          .catch(() => {});
      }
    }, 3500);
    return () => clearInterval(interval);
  }, [technician, selectedJob?.id]);

  // Fetch full details when opening a job
  const handleOpenJob = async (jobId: string) => {
    try {
      const res = await fetch(`/api/jobs/${jobId}`);
      const data = await res.json();
      setSelectedJob(data);

      // Initialize actual quantities dictionary and default payment calculation
      const initial: Record<string, number | ""> = {};
      let estimatedNet = 0;
      data.items?.forEach((it: any) => {
        const qty = it.quantityActual ?? it.quantityPlanned;
        initial[it.id] = qty;
        estimatedNet += qty * it.unitRate;
      });
      estimatedNet = Math.max(0, estimatedNet - (data.discountAmount || 0));

      setActualQuantities(initial);
      setPaymentReceivedAmount(String(estimatedNet));
      setNewAssignmentAlert(null);
    } catch (e) {
      console.error(e);
    }
  };

  // 1. TECHNICIAN ACCEPTS JOB -> NOTIFIES ADMIN & MOVES TO IN-PROGRESS
  const handleAcceptJob = async () => {
    if (!selectedJob || !technician) return;
    try {
      // Step 1: Accept
      const res = await fetch(`/api/jobs/${selectedJob.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "accept",
          actor: technician.name,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error);
      }

      // Step 2: Immediately transition to InProgress with GPS & timestamp
      const startRes = await fetch(`/api/jobs/${selectedJob.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "start",
          lat: 25.2048,
          lng: 55.2708,
          actor: technician.name,
        }),
      });
      if (!startRes.ok) {
        const err = await startRes.json();
        throw new Error(err.error);
      }

      // Step 3: Broadcast Admin Notification
      const adminNotice = {
        id: `notice-${Date.now()}`,
        title: "Work Order Accepted",
        message: `Technician ${technician.name} accepted ${selectedJob.jobNumber}. Status moved to In-Progress.`,
        timestamp: new Date().toLocaleTimeString(),
        jobId: selectedJob.id,
      };

      try {
        const existing = JSON.parse(localStorage.getItem("admin_notifications") || "[]");
        localStorage.setItem("admin_notifications", JSON.stringify([adminNotice, ...existing]));
        window.dispatchEvent(new Event("admin_notification_update"));
      } catch (e) {
        // ignore
      }

      // Publish Real-time Sync Event
      realtimeSync.publish("JOB_ACCEPTED", {
        jobId: selectedJob.id,
        jobNumber: selectedJob.jobNumber,
        technicianId: technician.id,
        technicianName: technician.name,
        actor: technician.name,
        message: `Technician ${technician.name} accepted Job #${selectedJob.jobNumber}. Status moved to In-Progress.`,
      });

      logActivity({
        action: "ACCEPT_JOB",
        target: `Job #${selectedJob.jobNumber} accepted by technician`,
        category: "MOBILE_APP",
        actorName: technician.name,
        actorRole: "TECHNICIAN",
        metadata: { jobId: selectedJob.id, jobNumber: selectedJob.jobNumber },
      });

      setNotificationToast(`Job Accepted! Status moved to In-Progress. Operations Dispatch notified.`);
      setTimeout(() => setNotificationToast(null), 5000);

      handleOpenJob(selectedJob.id);
      loadMobileData();
    } catch (e: any) {
      alert(e.message);
    }
  };

  // 2. REQUEST INVENTORY LINKED TO STORE
  const handleRequestInventory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedJob || !technician) return;

    const prod = warehouseProducts.find((p) => p.id === selectedProductId) || warehouseProducts[0];
    const itemDescription = prod ? `${prod.name} (${prod.sku})` : "General HVAC Materials";

    try {
      const res = await fetch(`/api/jobs/${selectedJob.id}/inventory-request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          technicianId: technician.id,
          item: itemDescription,
          qtyRequested: Number(reqQty) || 1,
        }),
      });
      if (!res.ok) throw new Error("Failed requesting materials");

      // Publish Real-time Sync Event
      realtimeSync.publish("INVENTORY_REQUESTED", {
        jobId: selectedJob.id,
        jobNumber: selectedJob.jobNumber,
        technicianId: technician.id,
        technicianName: technician.name,
        actor: technician.name,
        message: `Technician ${technician.name} requested ${reqQty}x ${prod?.name || "HVAC Materials"} from Central Store`,
        payload: { productId: prod?.id, quantity: Number(reqQty) || 1 },
      });

      logActivity({
        action: "REQUEST_INVENTORY",
        target: `Technician requested ${reqQty}x ${prod?.name || "HVAC Materials"} from Store on #${selectedJob.jobNumber}`,
        category: "MOBILE_APP",
        actorName: technician.name,
        actorRole: "TECHNICIAN",
        metadata: { jobId: selectedJob.id, productId: prod?.id, qty: reqQty },
      });

      setShowRequestInventoryModal(false);
      setReqQty("1");
      setNotificationToast(`Inventory request sent to Storekeeper Bilal Sheikh (+971 50 678 9012)`);
      setTimeout(() => setNotificationToast(null), 4000);

      handleOpenJob(selectedJob.id);
    } catch (e: any) {
      alert(e.message);
    }
  };

  // Note: Technicians cannot self-issue inventory. All store requests must be dispatched
  // and issued by the warehouse storekeeper through the ERP software (/inventory).

  // 3. STOP JOB FOR TODAY (PAUSE SCENARIO: 5 ACs planned, 3 fitted today, 2 tomorrow)
  const handleStopJob = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedJob || !technician) return;

    try {
      const formattedNote = `Work paused for today: Fitted ${unitsCompletedToday} units; ${unitsRemainingTomorrow} units remaining for tomorrow. Reason: ${pauseReason} [GPS: 25.2048, 55.2708]`;

      const res = await fetch(`/api/jobs/${selectedJob.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "pause",
          note: formattedNote,
          actor: technician.name,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error);
      }

      // Publish Real-time Sync Event
      realtimeSync.publish("JOB_PAUSED", {
        jobId: selectedJob.id,
        jobNumber: selectedJob.jobNumber,
        technicianId: technician.id,
        technicianName: technician.name,
        actor: technician.name,
        message: `Technician ${technician.name} paused Job #${selectedJob.jobNumber} (${unitsCompletedToday} fitted today, ${unitsRemainingTomorrow} tomorrow)`,
        payload: { completed: unitsCompletedToday, remaining: unitsRemainingTomorrow, reason: pauseReason },
      });

      logActivity({
        action: "PAUSE_JOB",
        target: `Job #${selectedJob.jobNumber} paused: ${unitsCompletedToday} installed, ${unitsRemainingTomorrow} tomorrow`,
        category: "MOBILE_APP",
        actorName: technician.name,
        actorRole: "TECHNICIAN",
        metadata: { jobId: selectedJob.id, unitsCompletedToday, unitsRemainingTomorrow },
      });

      setShowStopModal(false);
      setNotificationToast(`Job Paused. Timestamp & GPS location logged for Admin review.`);
      setTimeout(() => setNotificationToast(null), 4000);

      handleOpenJob(selectedJob.id);
      loadMobileData();
    } catch (e: any) {
      alert(e.message);
    }
  };

  // Resume Job next day
  const handleResumeJob = async () => {
    if (!selectedJob || !technician) return;
    try {
      const res = await fetch(`/api/jobs/${selectedJob.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "resume",
          lat: 25.2048,
          lng: 55.2708,
          actor: technician.name,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error);
      }

      // Publish Real-time Sync Event
      realtimeSync.publish("JOB_ACCEPTED", {
        jobId: selectedJob.id,
        jobNumber: selectedJob.jobNumber,
        technicianId: technician.id,
        technicianName: technician.name,
        actor: technician.name,
        message: `Technician ${technician.name} resumed Job #${selectedJob.jobNumber}`,
      });

      logActivity({
        action: "RESUME_JOB",
        target: `Job #${selectedJob.jobNumber} resumed on site by technician`,
        category: "MOBILE_APP",
        actorName: technician.name,
        actorRole: "TECHNICIAN",
        metadata: { jobId: selectedJob.id },
      });

      setNotificationToast(`Job Resumed! Technician back on site.`);
      setTimeout(() => setNotificationToast(null), 4000);

      handleOpenJob(selectedJob.id);
      loadMobileData();
    } catch (e: any) {
      alert(e.message);
    }
  };

  // ESS: Apply for Leave from Mobile
  const handleApplyMobileLeave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!technician || !mobileLeaveTypeId) return;
    try {
      const res = await fetch("/api/hrm/leave", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "request",
          employeeId: technician.id,
          leaveTypeId: mobileLeaveTypeId,
          startDate: mobileLeaveStart,
          endDate: mobileLeaveEnd,
          reason: mobileLeaveReason || "Field technician leave request",
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error);
      }
      setShowMobileLeaveModal(false);
      setMobileLeaveReason("");
      setNotificationToast("Leave request submitted to supervisor for approval.");
      setTimeout(() => setNotificationToast(null), 5000);
      loadMobileData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  // ESS: Raise Grievance Ticket from Mobile
  const handleRaiseMobileGrievance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!technician || !mobileGrievanceDesc.trim()) return;
    try {
      const res = await fetch("/api/hrm/grievances", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "submit",
          employeeId: technician.id,
          category: mobileGrievanceCat,
          description: mobileGrievanceDesc,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error);
      }
      setShowMobileGrievanceModal(false);
      setMobileGrievanceDesc("");
      setNotificationToast("Workplace ticket submitted to HR & Storekeeper.");
      setTimeout(() => setNotificationToast(null), 5000);
      loadMobileData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Request Item-Level Discount from Accountant
  const handleRequestItemDiscount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedJob || !selectedDiscountItem || !itemDiscountRequested) return;
    try {
      const res = await fetch(`/api/jobs/${selectedJob.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "request_item_discount",
          itemId: selectedDiscountItem.id,
          discountRequested: Number(itemDiscountRequested),
          reason: itemDiscountReason || "Customer on-site negotiation",
          actor: technician?.name || "Technician",
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error);
      }

      // Publish Real-time Sync Event
      realtimeSync.publish("DISCOUNT_REQUESTED", {
        jobId: selectedJob.id,
        jobNumber: selectedJob.jobNumber,
        technicianId: technician?.id,
        technicianName: technician?.name,
        actor: technician?.name || "Technician",
        message: `Technician ${technician?.name} requested PKR ${itemDiscountRequested} discount on ${selectedDiscountItem.description}`,
        payload: {
          itemId: selectedDiscountItem.id,
          discountAmount: Number(itemDiscountRequested),
          reason: itemDiscountReason || "Customer on-site negotiation",
        },
      });

      logActivity({
        action: "REQUEST_DISCOUNT",
        target: `Item discount of PKR ${itemDiscountRequested} on ${selectedDiscountItem.description} (#${selectedJob.jobNumber})`,
        category: "MOBILE_APP",
        actorName: technician?.name || "Technician",
        actorRole: "TECHNICIAN",
        metadata: { jobId: selectedJob.id, itemId: selectedDiscountItem.id, amount: itemDiscountRequested },
      });

      setShowItemDiscountModal(false);
      setItemDiscountRequested("");
      setItemDiscountReason("");
      setNotificationToast(`Item discount request of PKR ${itemDiscountRequested} sent to Accountant Fatima Noor.`);
      setTimeout(() => setNotificationToast(null), 4000);
      handleOpenJob(selectedJob.id);
    } catch (e: any) {
      alert(e.message);
    }
  };

  // 4. COMPLETE JOB & HANDLE UNUSED/LEFTOVER INVENTORY RETURN & PAYMENT COLLECTION
  const handleCompleteJob = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedJob || !technician) return;

    const actualItems = selectedJob.items.map((it: any) => ({
      id: it.id,
      quantityActual: Number(actualQuantities[it.id]),
    }));

    try {
      // Step 1: Check for unused items (e.g. 10 planned/issued, only 8 used -> 2 unused)
      let hasUnusedItems = false;
      for (const it of selectedJob.items) {
        const actual = Number(actualQuantities[it.id]);
        const unused = Math.max(0, it.quantityPlanned - actual);
        if (unused > 0) {
          hasUnusedItems = true;
          // Automatically submit stock return with the mandatory technician remarks
          await fetch(`/api/jobs/${selectedJob.id}/stock-return`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              technicianId: technician.id,
              item: `${it.description} (Unused: ${unused} units — Reason: ${unusedRemarks})`,
              qtyReturned: unused,
            }),
          });
        }
      }

      // Step 2: Complete the job with execution remarks and customer payment means
      const res = await fetch(`/api/jobs/${selectedJob.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "complete",
          actualItems,
          completionDetails: {
            workingRemarks: completionWorkingRemarks,
            paymentAmount: paymentMeans === "unmarked" ? 0 : Number(paymentReceivedAmount) || 0,
            paymentMeans,
            paymentNotes,
            unusedReason: hasUnusedItems ? unusedRemarks : undefined,
          },
          actor: technician.name,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error);
      }

      // Publish Real-time Sync Event
      realtimeSync.publish("JOB_COMPLETED", {
        jobId: selectedJob.id,
        jobNumber: selectedJob.jobNumber,
        technicianId: technician.id,
        technicianName: technician.name,
        actor: technician.name,
        message: `Technician ${technician.name} marked Job #${selectedJob.jobNumber} completed (${paymentMeans.toUpperCase()}: $${paymentReceivedAmount || 0})`,
        payload: { paymentMeans, amount: paymentReceivedAmount, hasUnusedItems },
      });

      logActivity({
        action: "COMPLETE_JOB",
        target: `Job #${selectedJob.jobNumber} completed on site (${paymentMeans.toUpperCase()}: $${paymentReceivedAmount || 0})`,
        category: "MOBILE_APP",
        actorName: technician.name,
        actorRole: "TECHNICIAN",
        metadata: {
          jobId: selectedJob.id,
          paymentMeans,
          paymentAmount: paymentReceivedAmount,
          hasUnusedItems,
        },
      });

      setShowCompleteModal(false);

      if (hasUnusedItems) {
        setNotificationToast(
          `Job Completed! ⚠️ Mandatory: Return unused items to Storekeeper Bilal Sheikh before Accountant clearance.`
        );
      } else {
        setNotificationToast(`Job Completed successfully! Handing over to Accountant for settlement clearance.`);
      }

      setTimeout(() => setNotificationToast(null), 6000);

      handleOpenJob(selectedJob.id);
      loadMobileData();
    } catch (e: any) {
      alert(e.message);
    }
  };

  // Log Expense Claim (Job-specific or General Field Hisaab)
  const handleLogExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!technician || !expenseAmount) return;
    try {
      if (selectedJob) {
        const res = await fetch(`/api/jobs/${selectedJob.id}/expense`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            technicianId: technician.id,
            amount: Number(expenseAmount),
            note: expenseNote || "Field expense",
          }),
        });
        if (!res.ok) throw new Error("Failed logging expense");

        realtimeSync.publish("EXPENSE_LOGGED", {
          jobId: selectedJob.id,
          jobNumber: selectedJob.jobNumber,
          technicianId: technician.id,
          technicianName: technician.name,
          actor: technician.name,
          message: `Technician ${technician.name} logged $${expenseAmount} field expense (${expenseNote || "Field expense"})`,
          payload: { amount: Number(expenseAmount), note: expenseNote },
        });
        handleOpenJob(selectedJob.id);
      } else {
        const res = await fetch("/api/accounts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "add_expense",
            payeeType: "technician",
            payeeName: technician.name,
            technicianId: technician.id,
            expenseAccountCode: "6100",
            disbursingAccountCode: "1000",
            amount: Number(expenseAmount),
            memo: expenseNote || "Field expense voucher",
            actorName: technician.name,
          }),
        });
        if (!res.ok) throw new Error("Failed logging expense voucher");

        realtimeSync.publish("EXPENSE_LOGGED", {
          technicianId: technician.id,
          technicianName: technician.name,
          actor: technician.name,
          message: `Technician ${technician.name} logged $${expenseAmount} expense voucher`,
          payload: { amount: Number(expenseAmount), note: expenseNote },
        });
      }

      setShowExpenseModal(false);
      setExpenseAmount("");
      setExpenseNote("");
      loadMobileData();
      setNotificationToast(`Expense of $${expenseAmount} logged successfully.`);
      setTimeout(() => setNotificationToast(null), 4000);
    } catch (e: any) {
      alert(e.message);
    }
  };

  // Biometric Face Scan
  const handleFaceScan = async () => {
    if (!technician) return;
    try {
      setIsCapturingFace(true);
      const res = await fetch("/api/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId: technician.id,
          faceMatchScore: simulatedFaceScore,
          lat: 25.2048,
          lng: 55.2708,
          notes: "Mobile biometric verification",
        }),
      });
      const data = await res.json();
      setAttendanceMsg(data);
    } catch (e: any) {
      alert(e.message);
    } finally {
      setIsCapturingFace(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0B0E] text-white flex flex-col items-center justify-start py-4 px-2 sm:px-4 font-sans select-none overflow-x-hidden relative">
      {/* Studio Canvas Floating Header */}
      <header className="w-full max-w-4xl flex flex-wrap items-center justify-between gap-3 mb-4 px-4 py-2.5 rounded-2xl bg-[#16181D] border border-white/10 shadow-xl z-20">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-[#0D7A5F] flex items-center justify-center shadow-md text-white font-black text-sm">
            <Briefcase className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xs font-bold text-white tracking-tight">Mobile Field Companion</h1>
              <span className="text-[10px] bg-emerald-500/20 text-emerald-400 font-semibold px-2 py-0.5 rounded-full border border-emerald-500/30 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Field Simulator Active
              </span>
            </div>
            <p className="text-[10px] text-[#A1A1AA]">
              Device: Apple iPhone 15 Pro • GPS Lat: 25.2048, Lng: 55.2708 (Dubai Marina)
            </p>
          </div>
        </div>

        {/* Studio Canvas Technician Switcher & Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Active Technician Account Dropdown Switcher */}
          <div className="relative">
            <button
              onClick={() => setIsTechDropdownOpen(!isTechDropdownOpen)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#22252B] hover:bg-[#2A2E36] border border-white/10 text-xs font-medium transition"
              title="Switch Technician Account"
            >
              <span className="text-[#A1A1AA] text-[11px]">Account:</span>
              <span className="font-bold text-white flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                {technician?.name || "Select Technician"}
              </span>
              <ChevronDown className="w-3.5 h-3.5 text-[#A1A1AA]" />
            </button>

            {isTechDropdownOpen && (
              <>
                <div className="fixed inset-0 z-50" onClick={() => setIsTechDropdownOpen(false)} />
                <div className="absolute right-0 top-full mt-1.5 z-50 w-72 bg-[#1C1E24] border border-white/15 rounded-xl shadow-2xl p-1.5 text-xs">
                  <div className="px-2.5 py-1 text-[10px] font-bold text-[#A1A1AA] uppercase tracking-wider">
                    Switch Field Technician
                  </div>
                  {allTechnicians.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => switchTechnician(t)}
                      className={`w-full text-left px-2.5 py-2 rounded-lg flex items-center justify-between transition ${
                        technician?.id === t.id
                          ? "bg-emerald-600/30 text-emerald-300 font-bold"
                          : "text-zinc-300 hover:bg-white/5 hover:text-white"
                      }`}
                    >
                      <div className="overflow-hidden">
                        <p className="leading-tight truncate">{t.name}</p>
                        <p className="text-[10px] text-zinc-400 leading-tight mt-0.5 truncate">
                          {t.phone} • {t.currentStatus}
                        </p>
                      </div>
                      {technician?.id === t.id && (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      )}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Zoom / Scale Controller */}
          <div className="flex items-center bg-[#22252B] p-0.5 rounded-xl border border-white/10 text-[11px] text-[#A1A1AA]">
            {[
              { label: "85%", value: 0.85 },
              { label: "90%", value: 0.9 },
              { label: "100%", value: 1 },
            ].map((opt) => (
              <button
                key={opt.label}
                onClick={() => setZoomLevel(opt.value)}
                className={`px-2 py-1 rounded-lg font-medium transition ${
                  zoomLevel === opt.value
                    ? "bg-[#0D7A5F] text-white font-bold"
                    : "hover:text-white"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Link back to ERP Dashboard */}
          <a
            href="/"
            target="_blank"
            rel="noopener noreferrer"
            className="px-2.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-semibold flex items-center gap-1.5 transition"
          >
            <span>ERP Dashboard</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </header>

      {/* Realistic Smartphone Hardware Frame with Scalable Viewport */}
      <div
        style={{ transform: `scale(${zoomLevel})`, transformOrigin: "top center" }}
        className="transition-transform duration-200"
      >
        <div className="w-[390px] sm:w-[412px] h-[820px] sm:h-[844px] bg-[#1A1C20] rounded-[54px] p-[10px] shadow-[0_30px_90px_rgba(0,0,0,0.95),0_0_0_1px_rgba(255,255,255,0.14),inset_0_0_0_2px_rgba(0,0,0,0.8)] relative flex flex-col shrink-0">
          {/* Smartphone Hardware Buttons on Bezel */}
          <div className="absolute -left-[14px] top-24 w-[4px] h-7 bg-[#2E3138] rounded-l-sm" title="Action Button" />
          <div className="absolute -left-[14px] top-36 w-[4px] h-12 bg-[#2E3138] rounded-l-sm" title="Volume Up" />
          <div className="absolute -left-[14px] top-52 w-[4px] h-12 bg-[#2E3138] rounded-l-sm" title="Volume Down" />
          <div className="absolute -right-[14px] top-40 w-[4px] h-16 bg-[#2E3138] rounded-r-sm" title="Power Button" />

          {/* Inner Phone Screen Glass Viewport */}
          <div className="w-full h-full rounded-[44px] overflow-hidden bg-[#F7F8F7] relative flex flex-col text-[#18181B] shadow-inner">
            {/* Dynamic Island Notch */}
            <div
              onClick={() => setShowTechSwitcherModal(true)}
              className="w-28 h-6 bg-black rounded-full mx-auto mt-2 flex items-center justify-between px-3 z-40 shrink-0 shadow-md cursor-pointer group"
              title="Click to switch technician account"
            >
              <div className="w-2.5 h-2.5 rounded-full bg-[#0a0a0f] border border-[#1e2538] flex items-center justify-center">
                <div className="w-1 h-1 rounded-full bg-[#112344]" />
              </div>
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            </div>

            {/* Status Bar */}
            <div className="px-6 py-1 flex items-center justify-between text-[11px] font-semibold text-[#18181B] shrink-0">
              <span className="font-mono">{currentTime}</span>
              <div className="flex items-center gap-1.5 text-xs">
                <span className="text-[10px] font-bold">5G</span>
                <Wifi className="w-3 h-3 text-[#18181B]" />
                <BatteryCharging className="w-3.5 h-3.5 text-emerald-600" />
              </div>
            </div>

            {/* In-App Mobile Header */}
            <header className="bg-[#18181B] text-white px-3.5 py-2.5 flex items-center justify-between shrink-0 shadow-md">
              <div className="flex items-center gap-2 overflow-hidden">
                <button
                  onClick={() => setShowTechSwitcherModal(true)}
                  title="Switch Technician Account"
                  className="w-8 h-8 rounded-full bg-[#0D7A5F] hover:bg-emerald-600 text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-xs transition"
                >
                  {technician ? technician.name.charAt(0) : "W"}
                </button>
                <div className="overflow-hidden text-left">
                  <h1 className="text-xs font-bold text-white leading-none truncate">
                    {technician?.name || "Technician Portal"}
                  </h1>
                  <p className="text-[10px] text-emerald-400 font-semibold mt-0.5 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                    <span className="truncate">GPS Lat: 25.2048, Lng: 55.2708</span>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={() => setShowTechSwitcherModal(true)}
                  className="px-2 py-1 rounded-md bg-white/10 hover:bg-white/20 text-[10px] text-emerald-300 font-semibold transition"
                >
                  Switch Tech
                </button>
                <button
                  onClick={loadMobileData}
                  title="Sync field data"
                  className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-[#A1A1AA] hover:text-white transition"
                >
                  <RefreshCw className="w-3 h-3" />
                </button>
              </div>
            </header>

      {/* Floating In-App Toast Notification Banner */}
      {notificationToast && (
        <div className="mx-3 mt-2 p-3 bg-emerald-950 text-emerald-100 rounded-xl shadow-xl border border-emerald-500/50 text-xs flex items-center gap-2 animate-in slide-in-from-top-2 z-40">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span className="font-medium flex-1">{notificationToast}</span>
          <button onClick={() => setNotificationToast(null)} className="text-emerald-400 hover:text-white">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* PUSH NOTIFICATION ALERT: NEW JOB ASSIGNED TO TECHNICIAN */}
      {newAssignmentAlert && !selectedJob && (
        <div className="mx-3 mt-2 p-3.5 bg-[#18181B] text-white rounded-xl shadow-xl border border-emerald-500/40 flex items-center justify-between animate-in slide-in-from-top-3 z-30">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-sm">
              <Bell className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs font-bold text-white flex items-center gap-1.5">
                <span>New Job Dispatched!</span>
                <span className="text-[10px] bg-[#0D7A5F] px-1.5 py-0.2 rounded font-mono">
                  {newAssignmentAlert.jobNumber}
                </span>
              </p>
              <p className="text-[11px] text-[#A1A1AA] truncate max-w-[200px] mt-0.5">
                {newAssignmentAlert.customer?.name} • Tap to view & accept
              </p>
            </div>
          </div>
          <button
            onClick={() => handleOpenJob(newAssignmentAlert.id)}
            className="px-3 py-1.5 bg-[#0D7A5F] hover:bg-emerald-600 text-white text-xs font-bold rounded-lg transition shadow-xs flex items-center gap-1"
          >
            Review <ArrowRight className="w-3 h-3" />
          </button>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 p-3.5 overflow-y-auto">
        {/* TAB 1: JOBS VIEW */}
        {activeTab === "jobs" && (
          <div>
            {selectedJob ? (
              /* ========================================================= */
              /* JOB EXECUTION & FIELD WORKFLOW SCREEN                     */
              /* ========================================================= */
              <div className="space-y-3.5 animate-in fade-in">
                <button
                  onClick={() => setSelectedJob(null)}
                  className="text-xs font-semibold text-[#71717A] flex items-center gap-1 hover:text-[#18181B] transition"
                >
                  ← Back to Assigned Jobs
                </button>

                {/* Job Summary Card */}
                <div className="bg-white rounded-xl p-4 space-y-2.5 shadow-[0_1px_3px_rgba(0,0,0,0.035)] border border-[#EDEDED]">
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-black text-sm text-[#18181B]">
                      {selectedJob.jobNumber}
                    </span>
                    <StatusBadge status={selectedJob.status} />
                  </div>

                  <div>
                    <p className="text-sm font-bold text-[#18181B]">
                      {selectedJob.customer?.name}
                    </p>
                    <a
                      href={`https://maps.google.com/?q=${selectedJob.customer?.lat || 25.2048},${selectedJob.customer?.lng || 55.2708}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-[#0D7A5F] font-semibold flex items-center gap-1 mt-1 hover:underline"
                    >
                      <MapPin className="w-3.5 h-3.5 shrink-0" />
                      {selectedJob.customer?.addressText}
                    </a>
                  </div>

                  {selectedJob.customer?.phone && (
                    <div className="flex items-center gap-2 pt-1 border-t border-[#EDEDED]">
                      <a
                        href={`tel:${selectedJob.customer.phone}`}
                        className="text-xs font-semibold text-[#18181B] flex items-center gap-1 bg-[#F4F4F5] px-2.5 py-1 rounded-md"
                      >
                        <Phone className="w-3 h-3 text-[#0D7A5F]" />
                        Call Customer: {selectedJob.customer.phone}
                      </a>
                    </div>
                  )}

                  {selectedJob.remarks && (
                    <div className="p-2.5 bg-[#F9FAFB] rounded-lg text-xs text-[#52525B] border border-[#EDEDED]">
                      <span className="font-bold text-[#18181B] block text-[10px] uppercase">
                        Dispatcher / Equipment Notes:
                      </span>
                      {selectedJob.remarks}
                    </div>
                  )}
                </div>

                {/* Assigned Job Items */}
                <div className="bg-white rounded-xl p-4 space-y-2.5 shadow-[0_1px_3px_rgba(0,0,0,0.035)] border border-[#EDEDED]">
                  <h3 className="text-xs font-bold text-[#18181B] uppercase tracking-wider">
                    Assigned Job Items & Materials
                  </h3>
                  <div className="space-y-2">
                    {selectedJob.items?.map((it: any) => {
                      const isRequested = it.description?.includes("[Discount Requested:");
                      const isApproved = it.description?.includes("[Discount Approved:");
                      const cleanDesc = it.description?.replace(/\s*\[Discount.*?\]/gi, "");

                      return (
                        <div
                          key={it.id}
                          className="p-3 bg-[#F9FAFB] rounded-xl border border-[#EDEDED] space-y-2 text-xs"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="font-semibold text-[#18181B]">{cleanDesc}</p>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-[11px] text-[#71717A]">
                                  Qty: {it.quantityPlanned} @ {formatCurrency(it.unitRate)}
                                </span>
                                {it.quantityActual !== null && it.quantityActual !== undefined && (
                                  <span className="font-mono font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.2 rounded text-[10px]">
                                    Actual: {it.quantityActual}
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Ask for Discount Button */}
                            {!selectedJob.finalizedAt && selectedJob.status === "InProgress" && (
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedDiscountItem(it);
                                  setItemDiscountRequested("");
                                  setItemDiscountReason("");
                                  setShowItemDiscountModal(true);
                                }}
                                className="shrink-0 px-2 py-1 rounded-md bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 text-[10px] font-bold transition flex items-center gap-1 shadow-2xs"
                              >
                                <Percent className="w-3 h-3 text-amber-600" />
                                Ask Discount
                              </button>
                            )}
                          </div>

                          {/* Discount Status Badges */}
                          {isRequested && (
                            <div className="p-2 bg-amber-50/80 border border-amber-200 rounded-lg text-[10px] text-amber-950 flex items-center justify-between">
                              <span className="font-medium">⏳ Discount Requested — Awaiting Accountant:</span>
                              <span className="font-mono font-bold text-amber-800">
                                {it.description.match(/\[Discount Requested: ([^\]]+)\]/)?.[1] || "Requested"}
                              </span>
                            </div>
                          )}

                          {isApproved && (
                            <div className="p-2 bg-emerald-50/80 border border-emerald-200 rounded-lg text-[10px] text-emerald-950 flex items-center justify-between">
                              <span className="font-bold flex items-center gap-1 text-emerald-800">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                Discount Approved & Reflected in Price:
                              </span>
                              <span className="font-mono font-bold text-emerald-700">
                                {it.description.match(/\[Discount Approved: ([^\]]+)\]/)?.[1] || "Approved"}
                              </span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Warehouse Inventory Requests & Store Status */}
                {selectedJob.inventoryRequests && selectedJob.inventoryRequests.length > 0 && (
                  <div className="bg-white rounded-xl p-4 space-y-2 shadow-[0_1px_3px_rgba(0,0,0,0.035)] border border-[#EDEDED]">
                    <h3 className="text-xs font-bold text-[#18181B] uppercase tracking-wider flex items-center justify-between">
                      <span>Warehouse Store Requests</span>
                      <span className="text-[10px] font-mono text-[#71717A]">
                        Storekeeper: Bilal Sheikh
                      </span>
                    </h3>
                    <div className="space-y-1.5">
                      {selectedJob.inventoryRequests.map((req: any) => (
                        <div
                          key={req.id}
                          className="p-2.5 bg-[#F9FAFB] rounded-lg border border-[#EDEDED] flex items-center justify-between text-xs"
                        >
                          <div>
                            <p className="font-semibold text-[#18181B]">{req.item}</p>
                            <p className="text-[11px] text-[#71717A]">Qty: {req.qtyRequested} units</p>
                          </div>
                          <div>
                            {req.status?.toLowerCase() === "issued" ? (
                              <div className="flex items-center gap-1.5">
                                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                  Issued by Storekeeper
                                </span>
                                {!selectedJob.finalizedAt && selectedJob.status === "InProgress" && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const matchingJobItem = selectedJob.items?.find((it: any) =>
                                        it.description.toLowerCase().includes(req.item.toLowerCase())
                                      );
                                      if (matchingJobItem) {
                                        setSelectedDiscountItem(matchingJobItem);
                                      } else {
                                        setSelectedDiscountItem({
                                          id: selectedJob.items?.[0]?.id || "job-item",
                                          description: `${req.item} [Issued by Storekeeper]`,
                                          unitRate: 15000,
                                        });
                                      }
                                      setItemDiscountRequested("");
                                      setItemDiscountReason("");
                                      setShowItemDiscountModal(true);
                                    }}
                                    className="shrink-0 px-2 py-0.5 rounded-md bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 text-[10px] font-bold transition flex items-center gap-1"
                                  >
                                    <Percent className="w-3 h-3 text-amber-600" />
                                    Ask Discount
                                  </button>
                                )}
                              </div>
                            ) : (
                              <div className="text-right">
                                <span className="text-[10px] font-bold text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                                  <Clock className="w-3 h-3 text-amber-600" />
                                  Pending Storekeeper Dispatch
                                </span>
                                <span className="text-[9px] text-[#71717A] block mt-0.5">
                                  Storekeeper must issue via software
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Mid-Job Action Buttons: Request Inventory (Linked to Store) & Log Expense */}
                {selectedJob.status === "InProgress" && (
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setShowRequestInventoryModal(true)}
                      className="p-3 bg-white border border-[#EDEDED] rounded-xl text-xs font-semibold text-[#18181B] flex items-center justify-center gap-1.5 hover:bg-[#F9FAFB] shadow-2xs transition"
                    >
                      <Package className="w-4 h-4 text-[#0D7A5F]" />
                      Request Inventory
                    </button>
                    <button
                      onClick={() => setShowExpenseModal(true)}
                      className="p-3 bg-white border border-[#EDEDED] rounded-xl text-xs font-semibold text-[#18181B] flex items-center justify-center gap-1.5 hover:bg-[#F9FAFB] shadow-2xs transition"
                    >
                      <Receipt className="w-4 h-4 text-amber-600" />
                      Log Field Expense
                    </button>
                  </div>
                )}

                {/* ========================================================= */}
                {/* PRIMARY EXECUTION BUTTONS PER JOB STATUS                  */}
                {/* ========================================================= */}
                <div className="pt-1">
                  {/* STATUS: ASSIGNED -> ACCEPT JOB */}
                  {selectedJob.status === "Assigned" && (
                    <button
                      onClick={handleAcceptJob}
                      className="w-full py-3.5 bg-[#0D7A5F] hover:bg-[#0A624C] text-white rounded-xl text-xs font-bold shadow-md transition flex items-center justify-center gap-2"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      Accept Job Order & Start Work
                    </button>
                  )}

                  {/* STATUS: IN-PROGRESS -> FINISH JOB OR STOP/PAUSE FOR TODAY */}
                  {selectedJob.status === "InProgress" && (
                    <div className="space-y-2">
                      <button
                        onClick={() => setShowCompleteModal(true)}
                        className="w-full py-3.5 bg-[#0D7A5F] hover:bg-[#0A624C] text-white rounded-xl text-xs font-bold shadow-md transition flex items-center justify-center gap-2"
                      >
                        <Check className="w-4 h-4" />
                        Finish & Complete Job Order
                      </button>

                      <button
                        onClick={() => setShowStopModal(true)}
                        className="w-full py-2.5 bg-white border border-[#EDEDED] hover:bg-[#F9FAFB] text-[#18181B] rounded-xl text-xs font-semibold transition flex items-center justify-center gap-1.5"
                      >
                        <Pause className="w-3.5 h-3.5 text-amber-600" />
                        Stop Job for Today (Pause & Return Tomorrow)
                      </button>
                    </div>
                  )}

                  {/* STATUS: PAUSED -> RESUME WORK NEXT DAY */}
                  {selectedJob.status === "Paused" && (
                    <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl space-y-2.5">
                      <div className="flex items-center justify-between text-amber-950 text-xs font-bold">
                        <span className="flex items-center gap-1.5">
                          <Pause className="w-4 h-4 text-amber-600" />
                          Job Paused for Today
                        </span>
                        <span className="text-[10px] font-mono bg-amber-100 px-2 py-0.5 rounded">
                          GPS & Time Logged
                        </span>
                      </div>
                      <p className="text-[11px] text-amber-900 leading-relaxed">
                        Partial work saved. Ready to resume next morning to complete remaining AC units.
                      </p>
                      <button
                        onClick={handleResumeJob}
                        className="w-full py-3 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-xs mt-1"
                      >
                        <Play className="w-3.5 h-3.5" />
                        Resume Job (Continue From Where You Left Off)
                      </button>
                    </div>
                  )}

                  {/* STATUS: COMPLETED PENDING VERIFICATION */}
                  {selectedJob.status === "CompletedPendingVerification" && (
                    <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-center space-y-1.5">
                      <CheckCircle2 className="w-6 h-6 text-emerald-600 mx-auto" />
                      <p className="text-xs font-bold text-emerald-950">
                        Work Completed Successfully!
                      </p>
                      <p className="text-[11px] text-emerald-800">
                        Proceed to Storekeeper Bilal Sheikh for returned inventory sign-off, then to Accountant Fatima Noor for final Hisaab cash settlement.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              /* ========================================================= */
              /* TECHNICIAN ASSIGNED WORK ORDERS LIST                      */
              /* ========================================================= */
              <div className="space-y-3.5">
                {/* Header & Sync */}
                <div className="flex items-center justify-between pb-1">
                  <div>
                    <h2 className="text-sm font-bold text-[#18181B] tracking-tight">
                      Field Work Orders
                    </h2>
                    <p className="text-[11px] text-[#71717A]">
                      {technician?.name || "Technician"} • Active Operations
                    </p>
                  </div>
                  <button
                    onClick={loadMobileData}
                    className="text-[11px] text-[#0D7A5F] hover:underline font-bold flex items-center gap-1"
                  >
                    <RefreshCw className="w-3 h-3" /> Sync
                  </button>
                </div>

                {/* Section Filter Pills */}
                {(() => {
                  const assignedJobs = jobs.filter((j) => j.status === "Assigned");
                  const activeJobs = jobs.filter((j) => j.status === "InProgress" || j.status === "Accepted");
                  const pausedJobs = jobs.filter((j) => j.status === "Paused");
                  const doneJobs = jobs.filter((j) => ["CompletedPendingVerification", "Finalized", "Verified"].includes(j.status));

                  const sections = [
                    { id: "all", label: "All", count: jobs.length },
                    { id: "assigned", label: "Assigned", count: assignedJobs.length, alert: assignedJobs.length > 0 },
                    { id: "active", label: "Active", count: activeJobs.length, pulse: activeJobs.length > 0 },
                    { id: "paused", label: "Paused", count: pausedJobs.length },
                    { id: "done", label: "Done", count: doneJobs.length },
                    { id: "expenses", label: "Expenses & Hisaab", count: techLedgerData?.detailedEntries?.length || 0 },
                  ];

                  return (
                    <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar text-xs">
                      {sections.map((sec) => {
                        const isSel = jobSection === sec.id;
                        return (
                          <button
                            key={sec.id}
                            type="button"
                            onClick={() => setJobSection(sec.id as any)}
                            className={`px-3 py-1.5 rounded-full font-bold whitespace-nowrap inline-flex items-center gap-1.5 transition text-[11px] ${
                              isSel
                                ? "bg-[#18181B] text-white shadow-xs"
                                : "bg-white text-[#71717A] border border-[#E4E4E7] hover:border-[#D4D4D8]"
                            }`}
                          >
                            <span>{sec.label}</span>
                            <span
                              className={`text-[9px] px-1.5 py-0.2 rounded-full font-mono ${
                                isSel
                                  ? "bg-white/20 text-white"
                                  : sec.alert
                                  ? "bg-amber-100 text-amber-900 font-bold"
                                  : "bg-[#F4F4F5] text-[#71717A]"
                              }`}
                            >
                              {sec.count}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  );
                })()}

                {/* EXPENSES & HISAAB SECTION */}
                {jobSection === "expenses" && (
                  <div className="space-y-3 animate-in fade-in">
                    {/* Hisaab Summary Card */}
                    <div className="bg-gradient-to-br from-[#18181B] to-[#27272A] rounded-2xl p-4 text-white space-y-3 shadow-md border border-[#3F3F46]">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-[#A1A1AA] uppercase font-bold tracking-wider">
                          Technician Hisaab Balance
                        </span>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                          Single Netted
                        </span>
                      </div>

                      <div className="flex items-baseline justify-between">
                        <div>
                          <span className="text-2xl font-bold font-mono text-white block">
                            {formatCurrency(Math.abs(techLedgerData?.netBalance || 0))}
                          </span>
                          <span className="text-[11px] text-[#A1A1AA]">
                            {(techLedgerData?.netBalance || 0) > 0
                              ? "Owed to Company (Cash float / Collections)"
                              : (techLedgerData?.netBalance || 0) < 0
                              ? "Company owes you (Expense reimbursements)"
                              : "Settled Clean (Balanced PKR 0)"}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setShowExpenseModal(true)}
                          className="px-3 py-1.5 bg-[#0D7A5F] hover:bg-[#0A624C] text-white font-bold rounded-xl text-xs inline-flex items-center gap-1 shadow-sm transition"
                        >
                          <Plus className="w-3.5 h-3.5" /> Log Expense
                        </button>
                      </div>

                      <div className="grid grid-cols-2 gap-2 pt-2 border-t border-white/10 text-xs font-mono">
                        <div>
                          <span className="text-[10px] text-[#A1A1AA] block">Advances / Float:</span>
                          <span className="font-bold text-rose-400">
                            {formatCurrency(techLedgerData?.totalAdvances || 0)}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] text-[#A1A1AA] block">Expenses Claimed:</span>
                          <span className="font-bold text-emerald-400">
                            {formatCurrency(techLedgerData?.totalExpensesOwed || 0)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Expenses History List */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between px-1">
                        <span className="text-xs font-bold text-[#18181B] uppercase tracking-wider">
                          Logged Vouchers & Floats
                        </span>
                        <span className="text-[10px] text-[#71717A] font-mono">
                          {techLedgerData?.detailedEntries?.length || 0} entries
                        </span>
                      </div>

                      {(!techLedgerData?.detailedEntries || techLedgerData.detailedEntries.length === 0) ? (
                        <div className="bg-white rounded-xl p-8 text-center text-xs text-[#71717A] border border-[#EDEDED]">
                          <Receipt className="w-8 h-8 text-[#A1A1AA] mx-auto mb-2 opacity-50" />
                          No expenses or advances logged yet.
                        </div>
                      ) : (
                        techLedgerData.detailedEntries.map((entry: any) => {
                          const isAdvance = entry.type === "advance" || entry.type === "hisaab_given";
                          return (
                            <div
                              key={entry.id}
                              className="bg-white rounded-xl p-3 border border-[#EDEDED] flex items-center justify-between shadow-[0_1px_2px_rgba(0,0,0,0.02)]"
                            >
                              <div className="space-y-0.5">
                                <div className="flex items-center gap-1.5">
                                  <span
                                    className={`px-1.5 py-0.2 rounded text-[10px] font-bold uppercase font-mono ${
                                      isAdvance
                                        ? "bg-rose-50 text-rose-700 border border-rose-200"
                                        : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                    }`}
                                  >
                                    {entry.type.replace("_", " ")}
                                  </span>
                                  <span className="font-bold text-xs text-[#18181B]">{entry.notes || "Field voucher"}</span>
                                </div>
                                <span className="text-[10px] text-[#71717A] font-mono block">
                                  {formatDateTime(entry.createdAt || entry.date)}
                                </span>
                              </div>
                              <span
                                className={`font-mono font-bold text-sm ${
                                  isAdvance ? "text-rose-600" : "text-emerald-600"
                                }`}
                              >
                                {isAdvance ? "+" : "-"}
                                {formatCurrency(entry.amount)}
                              </span>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}

                {/* WORK ORDERS LIST (Filtered by Section) */}
                {jobSection !== "expenses" && (() => {
                  const assignedJobs = jobs.filter((j) => j.status === "Assigned");
                  const activeJobs = jobs.filter((j) => j.status === "InProgress" || j.status === "Accepted");
                  const pausedJobs = jobs.filter((j) => j.status === "Paused");
                  const doneJobs = jobs.filter((j) => ["CompletedPendingVerification", "Finalized", "Verified"].includes(j.status));

                  const displayList =
                    jobSection === "assigned" ? assignedJobs :
                    jobSection === "active" ? activeJobs :
                    jobSection === "paused" ? pausedJobs :
                    jobSection === "done" ? doneJobs :
                    jobs;

                  if (displayList.length === 0) {
                    return (
                      <div className="bg-white rounded-xl p-10 text-center text-xs text-[#71717A] border border-[#EDEDED] space-y-2 animate-in fade-in">
                        <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
                        <p className="font-bold text-sm text-[#18181B]">
                          {jobSection === "assigned"
                            ? "No Pending Assignments"
                            : jobSection === "active"
                            ? "No Work Orders Currently Active"
                            : jobSection === "paused"
                            ? "No Paused Work Orders"
                            : jobSection === "done"
                            ? "No Completed Work Orders Yet"
                            : "No Work Orders Found"}
                        </p>
                        <p className="text-[#71717A]">
                          {jobSection === "assigned"
                            ? "You are all caught up! New dispatch assignments will alert you live."
                            : "Select another category to view work orders."}
                        </p>
                      </div>
                    );
                  }

                  return (
                    <div className="space-y-2.5 animate-in fade-in">
                      {displayList.map((job) => {
                        const isAssigned = job.status === "Assigned";
                        const isPaused = job.status === "Paused";
                        const isActive = job.status === "InProgress" || job.status === "Accepted";

                        return (
                          <div
                            key={job.id}
                            onClick={() => handleOpenJob(job.id)}
                            className={`bg-white rounded-2xl p-4 space-y-2.5 cursor-pointer border transition shadow-[0_1px_3px_rgba(0,0,0,0.035)] ${
                              isActive
                                ? "border-emerald-500 ring-1 ring-emerald-500/20"
                                : isAssigned
                                ? "border-amber-400 bg-amber-50/20"
                                : isPaused
                                ? "border-amber-300 bg-amber-50/10"
                                : "border-[#EDEDED] hover:border-[#0D7A5F]"
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-1.5">
                                {isActive && (
                                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                                )}
                                <span className="font-mono font-bold text-xs text-[#18181B]">
                                  {job.jobNumber}
                                </span>
                              </div>
                              <StatusBadge status={job.status} />
                            </div>

                            <div>
                              <p className="text-sm font-bold text-[#18181B]">
                                {job.customer?.name}
                              </p>
                              <p className="text-xs text-[#71717A] flex items-center gap-1 mt-0.5 truncate">
                                <MapPin className="w-3 h-3 text-[#A1A1AA] shrink-0" />
                                {job.customer?.addressText}
                              </p>
                            </div>

                            {/* If job is paused, show reason banner */}
                            {isPaused && (
                              <div className="p-2 bg-amber-50 border border-amber-200 rounded-lg text-[11px] text-amber-900">
                                <span className="font-bold">⏸ Paused: </span>
                                <span>{job.remarks || "Work suspended overnight or awaiting materials"}</span>
                              </div>
                            )}

                            {/* Card Footer & Contextual Action */}
                            <div className="pt-2 border-t border-[#EDEDED] flex items-center justify-between text-xs">
                              <span className="capitalize font-semibold text-[#71717A] text-[11px]">
                                {job.jobType} • {job.items?.length || 0} items
                              </span>

                              {isAssigned ? (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleOpenJob(job.id);
                                  }}
                                  className="px-3 py-1.5 bg-[#0D7A5F] hover:bg-[#0A624C] text-white font-bold text-xs rounded-xl shadow-xs inline-flex items-center gap-1"
                                >
                                  Accept Job →
                                </button>
                              ) : isPaused ? (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleOpenJob(job.id);
                                  }}
                                  className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl shadow-xs inline-flex items-center gap-1"
                                >
                                  <Play className="w-3 h-3" /> Resume Work
                                </button>
                              ) : isActive ? (
                                <span className="font-bold text-[#0D7A5F] inline-flex items-center gap-1 text-[11px]">
                                  Active On-Site <ChevronRight className="w-3.5 h-3.5" />
                                </span>
                              ) : (
                                <span className="font-bold text-[#71717A] inline-flex items-center gap-1 text-[11px]">
                                  View Summary <ChevronRight className="w-3.5 h-3.5" />
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: ATTENDANCE SCANNER */}
        {activeTab === "attendance" && (
          <div className="space-y-4">
            <div className="bg-white rounded-xl p-6 text-center space-y-4 border border-[#EDEDED] shadow-xs">
              <div className="w-16 h-16 rounded-full bg-emerald-50 text-[#0D7A5F] flex items-center justify-center mx-auto">
                <Camera className="w-8 h-8" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-[#18181B]">
                  Biometric Face & GPS Check-In
                </h3>
                <p className="text-xs text-[#71717A] mt-1">
                  Dual gate check: Facial match (≥90%) AND authorized geofence radius.
                </p>
              </div>

              {/* Camera Simulator Frame */}
              <div className="w-44 h-44 mx-auto rounded-3xl bg-slate-900 border-2 border-emerald-500/40 relative overflow-hidden flex items-center justify-center">
                <div className="absolute inset-4 rounded-2xl border-2 border-dashed border-emerald-400 opacity-75 animate-pulse flex items-center justify-center">
                  <User className="w-14 h-14 text-slate-700" />
                </div>
                <div className="absolute bottom-2 left-2 right-2 text-[10px] text-white bg-black/70 py-1 rounded font-mono">
                  Face Match: {simulatedFaceScore}%
                </div>
              </div>

              {attendanceMsg && (
                <div
                  className={`p-3 rounded-xl text-xs font-semibold text-left ${
                    attendanceMsg.status === "present"
                      ? "bg-emerald-50 text-emerald-900 border border-emerald-200"
                      : "bg-rose-50 text-rose-900 border border-rose-200"
                  }`}
                >
                  <p className="font-bold">
                    {attendanceMsg.status === "present" ? "✓ Attendance Verified" : "✗ Verification Failed"}
                  </p>
                  <p className="text-[11px] font-normal mt-0.5">{attendanceMsg.message}</p>
                </div>
              )}

              <button
                onClick={handleFaceScan}
                disabled={isCapturingFace}
                className="w-full py-3 bg-[#0D7A5F] hover:bg-[#0A624C] text-white rounded-xl text-xs font-bold shadow-xs transition"
              >
                {isCapturingFace ? "Scanning Face & GPS..." : "Scan Biometrics Now"}
              </button>
            </div>
          </div>
        )}

        {/* TAB 3: EMPLOYEE SELF-SERVICE (ESS) & RUNNING LEDGER */}
        {activeTab === "profile" && (
          <div className="space-y-4">
            {/* Staff Card */}
            <div className="bg-white rounded-xl p-4 border border-[#EDEDED] shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-[#18181B]">{technician?.name}</h3>
                  <p className="text-xs text-[#71717A]">{techEssData?.designation || "HVAC Technician"} • {technician?.phone}</p>
                </div>
                <span className="text-[10px] uppercase font-bold bg-[#F4F4F5] px-2 py-0.5 rounded text-[#71717A]">
                  {techEssData?.department || "Operations"}
                </span>
              </div>

              {/* Sub-tab switcher inside ESS */}
              <div className="flex items-center gap-1 overflow-x-auto pb-1 border-t border-[#F4F4F5] pt-2">
                {[
                  { id: "ledger", label: "My Ledger" },
                  { id: "leave", label: "Leave & Balances" },
                  { id: "assets", label: "My Assets" },
                  { id: "payslips", label: "Payslips" },
                  { id: "helpdesk", label: "Helpdesk" },
                ].map((st) => (
                  <button
                    key={st.id}
                    onClick={() => setEssSubTab(st.id as any)}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-bold whitespace-nowrap transition ${
                      essSubTab === st.id
                        ? "bg-[#0D7A5F] text-white"
                        : "bg-[#F4F4F5] text-[#71717A] hover:text-[#18181B]"
                    }`}
                  >
                    {st.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Sub-view: My Ledger */}
            {essSubTab === "ledger" && (
              <div className="bg-white rounded-xl p-4 border border-[#EDEDED] shadow-xs space-y-3">
                <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl">
                  <span className="text-[11px] text-emerald-900 font-bold block uppercase tracking-wider">
                    Netted Running Balance
                  </span>
                  <span className="text-2xl font-black font-mono text-emerald-700">
                    {formatCurrency(techLedgerData?.netBalance || 0)}
                  </span>
                  <p className="text-[10px] text-emerald-800 mt-0.5">
                    Netted running balance: Advances + Cash Handover - Verified Expenses.
                  </p>
                </div>

                <div className="space-y-1.5 pt-1">
                  <span className="text-xs font-bold text-[#18181B] block">Recent Ledger Entries</span>
                  {techLedgerData?.detailedEntries?.map((e: any) => (
                    <div
                      key={e.id}
                      className="p-2.5 bg-[#F9FAFB] rounded-lg border border-[#EDEDED] flex items-center justify-between text-xs"
                    >
                      <div>
                        <p className="font-semibold capitalize text-[#18181B]">
                          {e.type.replace("_", " ")}
                        </p>
                        <p className="text-[10px] text-[#71717A]">{formatDateTime(e.createdAt)}</p>
                      </div>
                      <span className="font-mono font-bold text-[#18181B]">
                        {formatCurrency(e.amount)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Sub-view: Leave Balances & Requests */}
            {essSubTab === "leave" && (
              <div className="bg-white rounded-xl p-4 border border-[#EDEDED] shadow-xs space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#18181B] uppercase tracking-wider">
                    My Leave Entitlements
                  </span>
                  <button
                    onClick={() => setShowMobileLeaveModal(true)}
                    className="px-2.5 py-1 bg-[#0D7A5F] hover:bg-[#0A624C] text-white text-[11px] font-bold rounded-lg transition"
                  >
                    + Apply Leave
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {techEssData?.leaveBalances?.map((lb: any) => (
                    <div key={lb.id} className="p-2.5 bg-[#F9FAFB] rounded-lg border border-[#EDEDED] text-center">
                      <span className="text-[10px] text-[#71717A] font-bold block">{lb.leaveType?.name}</span>
                      <span className="text-lg font-mono font-bold text-[#0D7A5F]">{lb.balance}</span>
                      <span className="text-[9px] text-[#71717A] block">days available</span>
                    </div>
                  ))}
                </div>

                {/* Recent Leave Requests */}
                <div className="space-y-1.5 pt-2 border-t border-[#F4F4F5]">
                  <span className="text-xs font-bold text-[#18181B] block">My Recent Requests</span>
                  {techEssData?.leaveRequests && techEssData.leaveRequests.length > 0 ? (
                    techEssData.leaveRequests.map((r: any) => (
                      <div key={r.id} className="p-2.5 bg-[#F9FAFB] rounded-lg border border-[#EDEDED] flex items-center justify-between text-xs">
                        <div>
                          <span className="font-semibold text-[#18181B]">{r.leaveType?.name}</span>
                          <span className="text-[10px] text-[#71717A] block">
                            {formatDateTime(r.startDate)} ({r.daysCount} days)
                          </span>
                        </div>
                        <StatusBadge status={r.status} />
                      </div>
                    ))
                  ) : (
                    <p className="text-[11px] text-[#71717A]">No leave requests submitted yet.</p>
                  )}
                </div>
              </div>
            )}

            {/* Sub-view: My Assets */}
            {essSubTab === "assets" && (
              <div className="bg-white rounded-xl p-4 border border-[#EDEDED] shadow-xs space-y-3">
                <span className="text-xs font-bold text-[#18181B] uppercase tracking-wider block">
                  Company Assets & Testing Instruments
                </span>
                {techEssData?.assetAssignments && techEssData.assetAssignments.length > 0 ? (
                  <div className="space-y-2">
                    {techEssData.assetAssignments.map((a: any) => (
                      <div key={a.id} className="p-3 bg-[#F9FAFB] rounded-lg border border-[#EDEDED] text-xs flex items-center justify-between">
                        <div>
                          <span className="font-mono font-bold text-[#18181B]">{a.asset?.tag}</span>
                          <p className="font-semibold text-[#18181B]">{a.asset?.name}</p>
                          <p className="text-[10px] text-[#71717A]">{a.conditionNotes}</p>
                        </div>
                        <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                          {a.returnedAt ? "Returned" : "Active"}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-[#71717A]">No company assets assigned to you.</p>
                )}
              </div>
            )}

            {/* Sub-view: Payslips */}
            {essSubTab === "payslips" && (
              <div className="bg-white rounded-xl p-4 border border-[#EDEDED] shadow-xs space-y-3">
                <span className="text-xs font-bold text-[#18181B] uppercase tracking-wider block">
                  My Monthly Payslips
                </span>
                {techEssData?.payslips && techEssData.payslips.length > 0 ? (
                  <div className="space-y-2">
                    {techEssData.payslips.map((ps: any) => (
                      <div key={ps.id} className="p-3 bg-[#F9FAFB] rounded-lg border border-[#EDEDED] text-xs flex items-center justify-between">
                        <div>
                          <p className="font-bold text-[#18181B]">{ps.payrollRun?.period}</p>
                          <p className="text-[10px] text-[#71717A]">Gross: {formatCurrency(ps.grossSalary)}</p>
                        </div>
                        <div className="text-right">
                          <span className="font-mono font-bold text-emerald-700 block">
                            {formatCurrency(ps.netSalary)}
                          </span>
                          <span className="text-[9px] font-bold text-emerald-800 bg-emerald-100 px-1.5 py-0.2 rounded">
                            {ps.status}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-[#71717A]">No payslips available yet.</p>
                )}
              </div>
            )}

            {/* Sub-view: Helpdesk */}
            {essSubTab === "helpdesk" && (
              <div className="bg-white rounded-xl p-4 border border-[#EDEDED] shadow-xs space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#18181B] uppercase tracking-wider">
                    Workplace & Field Helpdesk
                  </span>
                  <button
                    onClick={() => setShowMobileGrievanceModal(true)}
                    className="px-2.5 py-1 bg-[#0D7A5F] hover:bg-[#0A624C] text-white text-[11px] font-bold rounded-lg transition"
                  >
                    + Raise Ticket
                  </button>
                </div>

                {techEssData?.grievanceTickets && techEssData.grievanceTickets.length > 0 ? (
                  <div className="space-y-2">
                    {techEssData.grievanceTickets.map((tk: any) => (
                      <div key={tk.id} className="p-3 bg-[#F9FAFB] rounded-lg border border-[#EDEDED] text-xs space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-mono font-bold text-[#18181B]">{tk.ticketNumber}</span>
                          <StatusBadge status={tk.status} />
                        </div>
                        <p className="font-semibold text-[#18181B]">{tk.category}</p>
                        <p className="text-[11px] text-[#71717A] line-clamp-2">{tk.description}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-[#71717A]">No helpdesk tickets raised.</p>
                )}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Docked In-App Bottom Navigation */}
      <nav className="bg-white border-t border-[#EDEDED] px-4 py-2 flex items-center justify-around z-30 shadow-md shrink-0">
        <button
          onClick={() => setActiveTab("jobs")}
          className={`flex flex-col items-center gap-1 text-xs font-semibold transition ${
            activeTab === "jobs" ? "text-[#0D7A5F]" : "text-[#71717A] hover:text-[#18181B]"
          }`}
        >
          <Briefcase className="w-5 h-5" />
          Jobs
        </button>

        <button
          onClick={() => setActiveTab("attendance")}
          className={`flex flex-col items-center gap-1 text-xs font-semibold transition ${
            activeTab === "attendance" ? "text-[#0D7A5F]" : "text-[#71717A] hover:text-[#18181B]"
          }`}
        >
          <Camera className="w-5 h-5" />
          Attendance
        </button>

        <button
          onClick={() => setActiveTab("profile")}
          className={`flex flex-col items-center gap-1 text-xs font-semibold transition ${
            activeTab === "profile" ? "text-[#0D7A5F]" : "text-[#71717A] hover:text-[#18181B]"
          }`}
        >
          <User className="w-5 h-5" />
          Staff ESS
        </button>
      </nav>

      {/* Smartphone Home Indicator Bar */}
      <div className="w-32 h-1 bg-zinc-800/40 rounded-full mx-auto my-1.5 shrink-0" />

      {/* ========================================================================= */}
      {/* MODAL 1: REQUEST INVENTORY (LINKED TO WAREHOUSE STORE + "CALL STORE" BTN) */}
      {/* ========================================================================= */}
      {showRequestInventoryModal && (
        <div className="absolute inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-t-[32px] w-full p-5 pb-7 space-y-4 shadow-2xl border-t border-zinc-200/80 text-xs max-h-[88%] overflow-y-auto overscroll-contain animate-in slide-in-from-bottom duration-200">
            {/* iOS Grab Handle */}
            <div className="w-12 h-1 bg-zinc-300 rounded-full mx-auto -mt-1 mb-2 shrink-0" />

            <div className="flex items-center justify-between pb-2 border-b border-zinc-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-[#0D7A5F] shrink-0">
                  <Package className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-zinc-900 leading-tight">Request Store Materials</h3>
                  <p className="text-[10px] text-zinc-500">Live linked to Central Store stock</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowRequestInventoryModal(false)}
                className="w-7 h-7 rounded-full bg-zinc-100 hover:bg-zinc-200 text-zinc-500 hover:text-zinc-900 flex items-center justify-center transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* DIRECT "CALL STORE" CONTACT CARD */}
            <div className="p-3 bg-gradient-to-r from-emerald-50 via-teal-50/50 to-emerald-50 border border-emerald-200/80 rounded-2xl flex items-center justify-between shadow-2xs">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-[#0D7A5F] text-white flex items-center justify-center font-bold text-xs shadow-xs shrink-0">
                  BS
                </div>
                <div>
                  <span className="font-bold text-emerald-900 block text-xs">Bilal Sheikh</span>
                  <span className="text-[10px] text-emerald-700">Central Storekeeper • +92 312 4443322</span>
                </div>
              </div>
              <a
                href="tel:+923124443322"
                className="px-3 py-1.5 bg-[#0D7A5F] hover:bg-[#0A624C] active:scale-95 text-white rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-xs transition"
              >
                <Phone className="w-3.5 h-3.5" />
                Call Store
              </a>
            </div>

            <form onSubmit={handleRequestInventory} className="space-y-3.5">
              <div>
                <label className="font-semibold text-zinc-800 text-xs block mb-1.5">
                  Select Warehouse Item (Linked to Store Stock) *
                </label>
                <div className="relative">
                  <select
                    value={selectedProductId}
                    onChange={(e) => setSelectedProductId(e.target.value)}
                    className="w-full appearance-none bg-zinc-50 hover:bg-zinc-100/80 p-3 pr-9 rounded-xl border border-zinc-200 focus:bg-white focus:border-[#0D7A5F] focus:ring-2 focus:ring-emerald-500/10 focus:outline-none text-zinc-900 font-medium text-xs transition"
                  >
                    {warehouseProducts.length === 0 ? (
                      <option value="">Loading warehouse inventory...</option>
                    ) : (
                      warehouseProducts.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} — ({p.stockQuantity} in stock)
                        </option>
                      ))
                    )}
                  </select>
                  <ChevronDown className="w-4 h-4 text-zinc-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>

              {/* Selected Product Live Stock Badge Card */}
              {(() => {
                const selectedProd = warehouseProducts.find((p) => p.id === selectedProductId) || warehouseProducts[0];
                if (!selectedProd) return null;
                return (
                  <div className="p-3 bg-zinc-50 border border-zinc-200/80 rounded-2xl flex items-center justify-between text-xs">
                    <div className="overflow-hidden mr-2">
                      <p className="font-bold text-zinc-800 truncate">{selectedProd.name}</p>
                      <p className="text-[10px] text-zinc-500 mt-0.5 font-mono">
                        SKU: {selectedProd.sku} • Rate: {formatCurrency(selectedProd.unitPrice)}
                      </p>
                    </div>
                    <span
                      className={`px-2.5 py-1 rounded-full text-[10px] font-bold shrink-0 ${
                        selectedProd.stockQuantity > 10
                          ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                          : "bg-amber-100 text-amber-800 border border-amber-200"
                      }`}
                    >
                      {selectedProd.stockQuantity} In Stock
                    </span>
                  </div>
                );
              })()}

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="font-semibold text-zinc-800 text-xs">
                    Quantity Required *
                  </label>
                  {(() => {
                    const selectedProd = warehouseProducts.find((p) => p.id === selectedProductId) || warehouseProducts[0];
                    return selectedProd ? (
                      <span className="text-[10px] text-zinc-500 font-mono">
                        Available in store: {selectedProd.stockQuantity}
                      </span>
                    ) : null;
                  })()}
                </div>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setReqQty(String(Math.max(1, (Number(reqQty) || 1) - 1)))}
                    className="w-10 h-10 rounded-xl bg-zinc-100 hover:bg-zinc-200 active:scale-95 text-zinc-700 font-bold text-base flex items-center justify-center transition shrink-0"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <input
                    type="number"
                    min="1"
                    required
                    value={reqQty}
                    onChange={(e) => setReqQty(e.target.value)}
                    className="flex-1 bg-zinc-50 p-2.5 rounded-xl border border-zinc-200 focus:bg-white focus:border-[#0D7A5F] focus:outline-none text-center font-mono font-bold text-sm text-zinc-900"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const selectedProd = warehouseProducts.find((p) => p.id === selectedProductId) || warehouseProducts[0];
                      const maxQty = selectedProd?.stockQuantity || 99;
                      setReqQty(String(Math.min(maxQty, (Number(reqQty) || 1) + 1)));
                    }}
                    className="w-10 h-10 rounded-xl bg-zinc-100 hover:bg-zinc-200 active:scale-95 text-zinc-700 font-bold text-base flex items-center justify-center transition shrink-0"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2 border-t border-zinc-100">
                <button
                  type="button"
                  onClick={() => setShowRequestInventoryModal(false)}
                  className="px-4 py-3 text-xs text-zinc-600 hover:bg-zinc-100 rounded-xl font-semibold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 bg-[#0D7A5F] hover:bg-[#0A624C] active:scale-98 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-900/10 flex items-center justify-center gap-1.5 transition"
                >
                  <Package className="w-4 h-4" />
                  Send Request to Store
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: STOP JOB (PAUSE SCENARIO: 5 ACs, 3 fitted today, 2 tomorrow)     */}
      {/* ========================================================================= */}
      {showStopModal && (
        <div className="absolute inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-t-[32px] w-full p-5 pb-7 space-y-4 shadow-2xl border-t border-zinc-200/80 text-xs max-h-[88%] overflow-y-auto overscroll-contain animate-in slide-in-from-bottom duration-200">
            {/* iOS Grab Handle */}
            <div className="w-12 h-1 bg-zinc-300 rounded-full mx-auto -mt-1 mb-2 shrink-0" />

            <div className="flex items-center justify-between pb-2 border-b border-zinc-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 shrink-0">
                  <Pause className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-zinc-900 leading-tight">Stop Work for Today (Pause)</h3>
                  <p className="text-[10px] text-zinc-500">Log partial units completed & resume schedule</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowStopModal(false)}
                className="w-7 h-7 rounded-full bg-zinc-100 hover:bg-zinc-200 text-zinc-500 hover:text-zinc-900 flex items-center justify-center transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleStopJob} className="space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-zinc-50 rounded-2xl border border-zinc-200/80 space-y-1.5">
                  <label className="font-semibold text-zinc-800 text-[11px] block">
                    Fitted Today *
                  </label>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setUnitsCompletedToday(String(Math.max(1, (Number(unitsCompletedToday) || 1) - 1)))}
                      className="w-7 h-7 rounded-lg bg-zinc-200 hover:bg-zinc-300 text-zinc-700 font-bold text-xs flex items-center justify-center shrink-0"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <input
                      type="number"
                      min="1"
                      required
                      value={unitsCompletedToday}
                      onChange={(e) => setUnitsCompletedToday(e.target.value)}
                      className="w-full bg-white p-1.5 rounded-lg border border-zinc-200 text-center font-mono font-bold text-xs text-zinc-900"
                    />
                    <button
                      type="button"
                      onClick={() => setUnitsCompletedToday(String((Number(unitsCompletedToday) || 1) + 1))}
                      className="w-7 h-7 rounded-lg bg-zinc-200 hover:bg-zinc-300 text-zinc-700 font-bold text-xs flex items-center justify-center shrink-0"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                  <span className="text-[10px] text-zinc-500 block text-center">e.g. 3 AC units</span>
                </div>

                <div className="p-3 bg-amber-50/70 rounded-2xl border border-amber-200/80 space-y-1.5">
                  <label className="font-semibold text-amber-950 text-[11px] block">
                    Remaining Tomorrow *
                  </label>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setUnitsRemainingTomorrow(String(Math.max(1, (Number(unitsRemainingTomorrow) || 1) - 1)))}
                      className="w-7 h-7 rounded-lg bg-amber-200 hover:bg-amber-300 text-amber-800 font-bold text-xs flex items-center justify-center shrink-0"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <input
                      type="number"
                      min="1"
                      required
                      value={unitsRemainingTomorrow}
                      onChange={(e) => setUnitsRemainingTomorrow(e.target.value)}
                      className="w-full bg-white p-1.5 rounded-lg border border-amber-200 text-center font-mono font-bold text-xs text-amber-700"
                    />
                    <button
                      type="button"
                      onClick={() => setUnitsRemainingTomorrow(String((Number(unitsRemainingTomorrow) || 1) + 1))}
                      className="w-7 h-7 rounded-lg bg-amber-200 hover:bg-amber-300 text-amber-800 font-bold text-xs flex items-center justify-center shrink-0"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                  <span className="text-[10px] text-amber-800 block text-center">e.g. 2 AC units</span>
                </div>
              </div>

              <div>
                <label className="font-semibold text-zinc-800 text-xs block mb-1">
                  Reason & Scheduled Resume Time *
                </label>
                <textarea
                  rows={2}
                  required
                  placeholder="e.g. Working hours finished. Remaining 2 indoor units will be mounted tomorrow at 9:00 AM."
                  value={pauseReason}
                  onChange={(e) => setPauseReason(e.target.value)}
                  className="w-full bg-zinc-50 hover:bg-zinc-100/80 p-2.5 rounded-xl border border-zinc-200 text-xs resize-none focus:bg-white focus:border-amber-600 focus:outline-none"
                />
              </div>

              <div className="p-2.5 bg-amber-50 rounded-xl border border-amber-200/80 text-[11px] text-amber-950 flex items-center justify-between">
                <span className="flex items-center gap-1.5 font-bold">
                  <Navigation className="w-3.5 h-3.5 text-amber-700" />
                  GPS & Timestamp
                </span>
                <span className="font-mono text-[10px] text-amber-900">
                  Lat: 25.2048, Lng: 55.2708 • {currentTime}
                </span>
              </div>

              <div className="flex items-center gap-2 pt-2 border-t border-zinc-100">
                <button
                  type="button"
                  onClick={() => setShowStopModal(false)}
                  className="px-4 py-3 text-xs text-zinc-600 hover:bg-zinc-100 rounded-xl font-semibold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold shadow-md shadow-amber-900/10 transition"
                >
                  Confirm Stop (Pause Job)
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: FINISH JOB & UNUSED / LEFTOVER INVENTORY RETURN                  */}
      {/* ========================================================================= */}
      {showCompleteModal && selectedJob && (
        <div className="absolute inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-t-[32px] w-full p-5 pb-7 space-y-4 shadow-2xl border-t border-zinc-200/80 text-xs max-h-[88%] overflow-y-auto overscroll-contain animate-in slide-in-from-bottom duration-200">
            {/* iOS Grab Handle */}
            <div className="w-12 h-1 bg-zinc-300 rounded-full mx-auto -mt-1 mb-2 shrink-0" />

            <div className="flex items-center justify-between pb-2 border-b border-zinc-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-[#0D7A5F] shrink-0">
                  <Check className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-zinc-900 leading-tight">Finish Job — Actuals & Materials</h3>
                  <p className="text-[10px] text-zinc-500">Record installed units & unused store return</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowCompleteModal(false)}
                className="w-7 h-7 rounded-full bg-zinc-100 hover:bg-zinc-200 text-zinc-500 hover:text-zinc-900 flex items-center justify-center transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCompleteJob} className="space-y-3.5">
              {selectedJob.items?.map((it: any) => {
                const currentActual = actualQuantities[it.id] !== "" ? Number(actualQuantities[it.id]) : it.quantityPlanned;
                const unusedQty = Math.max(0, it.quantityPlanned - currentActual);

                return (
                  <div key={it.id} className="p-3 bg-zinc-50 rounded-2xl border border-zinc-200/80 space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="font-bold text-zinc-800 text-xs">{it.description}</p>
                      <span className="text-[10px] bg-white px-2 py-0.5 rounded-md font-mono border border-zinc-200">
                        Issued: {it.quantityPlanned}
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-zinc-200/60">
                      <label className="text-[11px] text-zinc-600 font-semibold">
                        Actual Delivered / Used:
                      </label>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            const cur = Number(actualQuantities[it.id] ?? it.quantityPlanned);
                            setActualQuantities({
                              ...actualQuantities,
                              [it.id]: Math.max(0, cur - 1),
                            });
                          }}
                          className="w-6 h-6 rounded bg-zinc-200 hover:bg-zinc-300 text-zinc-700 font-bold flex items-center justify-center"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <input
                          type="number"
                          min="0"
                          max={it.quantityPlanned * 2}
                          required
                          value={actualQuantities[it.id] ?? ""}
                          onChange={(e) =>
                            setActualQuantities({
                              ...actualQuantities,
                              [it.id]: e.target.value === "" ? "" : Number(e.target.value),
                            })
                          }
                          className="w-14 bg-white p-1 rounded-lg border border-zinc-200 text-center font-mono font-bold text-xs focus:ring-1 focus:ring-[#0D7A5F]"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const cur = Number(actualQuantities[it.id] ?? it.quantityPlanned);
                            setActualQuantities({
                              ...actualQuantities,
                              [it.id]: cur + 1,
                            });
                          }}
                          className="w-6 h-6 rounded bg-zinc-200 hover:bg-zinc-300 text-zinc-700 font-bold flex items-center justify-center"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                    </div>

                    {unusedQty > 0 && (
                      <div className="p-2 bg-amber-50 rounded-xl border border-amber-200 text-[11px] text-amber-950">
                        <span className="font-bold">⚠️ Unused Material: {unusedQty} units</span>
                        <p className="text-[10px] text-amber-900 mt-0.5">
                          Compulsory store return to Storekeeper Bilal Sheikh before settlement.
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Remarks for unused materials */}
              {selectedJob.items?.some((it: any) => {
                const actual = Number(actualQuantities[it.id] ?? it.quantityPlanned);
                return it.quantityPlanned > actual;
              }) && (
                <div className="space-y-1.5 p-3 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-900">
                  <span className="font-bold block">
                    Reason Why Items Were Unused (Customer Change of Mind) *
                  </span>
                  <input
                    type="text"
                    required
                    value={unusedRemarks}
                    onChange={(e) => setUnusedRemarks(e.target.value)}
                    placeholder="e.g. Customer opted for 8 units instead of 10"
                    className="w-full bg-white p-2.5 rounded-xl border border-rose-300 text-xs text-zinc-900 focus:outline-none"
                  />
                  <p className="text-[10px] text-rose-800">
                    🛑 <strong>Rule 1.3:</strong> Stock return must be acknowledged by Storekeeper Bilal Sheikh.
                  </p>
                </div>
              )}

              <div>
                <label className="font-semibold text-zinc-800 text-xs block mb-1">
                  Working Execution & Diagnostic Remarks *
                </label>
                <textarea
                  rows={2}
                  required
                  value={completionWorkingRemarks}
                  onChange={(e) => setCompletionWorkingRemarks(e.target.value)}
                  placeholder="e.g. Installed and vacuumed copper lines, verified 65 PSI gas pressure, tested cooling."
                  className="w-full bg-zinc-50 p-2.5 rounded-xl border border-zinc-200 text-xs resize-none focus:bg-white focus:border-[#0D7A5F] focus:outline-none"
                />
              </div>

              {/* Customer Payment Collection Means */}
              <div className="p-3.5 bg-gradient-to-br from-emerald-50 to-teal-50/40 border border-emerald-200/80 rounded-2xl space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-emerald-950 uppercase text-[11px] tracking-wider block">
                    Customer Payment Collection
                  </span>
                  <span className="text-[10px] text-emerald-800 font-mono">
                    Required for Clearance
                  </span>
                </div>

                <div>
                  <label className="font-semibold text-zinc-800 text-xs block mb-1">
                    Payment Status & Transfer Means *
                  </label>
                  <select
                    value={paymentMeans}
                    onChange={(e: any) => {
                      setPaymentMeans(e.target.value);
                      if (e.target.value === "unmarked") {
                        setPaymentReceivedAmount("0");
                      }
                    }}
                    className="w-full bg-white p-2.5 rounded-xl border border-emerald-300 text-xs font-semibold text-zinc-900 focus:outline-none"
                  >
                    <option value="cash">Cash (Collected on site)</option>
                    <option value="online">Online Bank Transfer (Transferred by customer)</option>
                    <option value="cheque">Cheque / POS Card</option>
                    <option value="unmarked">Unmarked / Unpaid (Pending customer invoice)</option>
                  </select>
                </div>

                {paymentMeans !== "unmarked" ? (
                  <div>
                    <label className="font-semibold text-zinc-800 text-xs block mb-1">
                      Amount Collected ($) *
                    </label>
                    <input
                      type="number"
                      min="0"
                      required
                      value={paymentReceivedAmount}
                      onChange={(e) => setPaymentReceivedAmount(e.target.value)}
                      className="w-full bg-white p-2.5 rounded-xl border border-emerald-300 text-xs font-mono font-bold text-zinc-900"
                    />
                  </div>
                ) : (
                  <div className="p-2 bg-amber-50 border border-amber-200 rounded-xl text-[11px] text-amber-900">
                    <p className="font-bold">⚠️ Unmarked / Unpaid Selected</p>
                    <p className="text-[10px] text-amber-800 mt-0.5">
                      Work order will be submitted with payment pending. Formal invoice will be sent by Accounts.
                    </p>
                  </div>
                )}

                <div>
                  <label className="font-semibold text-zinc-700 text-[11px] block mb-1">
                    Payment Reference / Transfer Note
                  </label>
                  <input
                    type="text"
                    value={paymentNotes}
                    onChange={(e) => setPaymentNotes(e.target.value)}
                    placeholder={paymentMeans === "online" ? "e.g. Bank Transfer Ref # or account" : "e.g. Receipt voucher # or customer note"}
                    className="w-full bg-white p-2 rounded-xl border border-zinc-200 text-xs text-zinc-900"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2 border-t border-zinc-100">
                <button
                  type="button"
                  onClick={() => setShowCompleteModal(false)}
                  className="px-4 py-3 text-xs text-zinc-600 hover:bg-zinc-100 rounded-xl font-semibold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 bg-[#0D7A5F] hover:bg-[#0A624C] text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-900/10 transition"
                >
                  Submit Completion
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 4: REQUEST ITEM DISCOUNT (TECHNICIAN ASKS ACCOUNTANT FOR DISCOUNT)  */}
      {/* ========================================================================= */}
      {showItemDiscountModal && selectedDiscountItem && (
        <div className="absolute inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-t-[32px] w-full p-5 pb-7 space-y-4 shadow-2xl border-t border-zinc-200/80 text-xs max-h-[88%] overflow-y-auto overscroll-contain animate-in slide-in-from-bottom duration-200">
            {/* iOS Grab Handle */}
            <div className="w-12 h-1 bg-zinc-300 rounded-full mx-auto -mt-1 mb-2 shrink-0" />

            <div className="flex items-center justify-between pb-2 border-b border-zinc-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 shrink-0">
                  <Percent className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-zinc-900 leading-tight">Ask for Item Discount</h3>
                  <p className="text-[10px] text-zinc-500">Live negotiation with Accountant Fatima Noor</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowItemDiscountModal(false)}
                className="w-7 h-7 rounded-full bg-zinc-100 hover:bg-zinc-200 text-zinc-500 hover:text-zinc-900 flex items-center justify-center transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 bg-amber-50/80 border border-amber-200/80 rounded-2xl space-y-1">
              <p className="font-bold text-amber-950 text-xs">
                {selectedDiscountItem.description.replace(/\s*\[Discount.*?\]/gi, "")}
              </p>
              <p className="text-[11px] text-amber-800">
                Current Unit Rate: <span className="font-mono font-bold">{formatCurrency(selectedDiscountItem.unitRate)}</span>
              </p>
            </div>

            <form onSubmit={handleRequestItemDiscount} className="space-y-3.5">
              <div>
                <label className="font-semibold text-zinc-800 text-xs block mb-1">
                  Discount Amount Requested (PKR per unit) *
                </label>
                <input
                  type="number"
                  min="1"
                  max={selectedDiscountItem.unitRate || 999999}
                  required
                  placeholder="e.g. 2500"
                  value={itemDiscountRequested}
                  onChange={(e) => setItemDiscountRequested(e.target.value)}
                  className="w-full bg-zinc-50 p-2.5 rounded-xl border border-zinc-200 text-xs font-mono font-bold text-zinc-900 focus:bg-white focus:border-amber-600 focus:outline-none"
                />
                {itemDiscountRequested && Number(itemDiscountRequested) > 0 && (
                  <span className="text-[11px] text-emerald-700 font-bold block mt-1.5">
                    Proposed Revised Rate: {formatCurrency(Math.max(0, selectedDiscountItem.unitRate - Number(itemDiscountRequested)))}
                  </span>
                )}
              </div>

              <div>
                <label className="font-semibold text-zinc-800 text-xs block mb-1">
                  Customer / Site Justification *
                </label>
                <textarea
                  rows={2}
                  required
                  placeholder="e.g. Customer requested price match with local distributor"
                  value={itemDiscountReason}
                  onChange={(e) => setItemDiscountReason(e.target.value)}
                  className="w-full bg-zinc-50 p-2.5 rounded-xl border border-zinc-200 text-xs resize-none focus:bg-white focus:border-amber-600 focus:outline-none"
                />
              </div>

              <div className="flex items-center gap-2 pt-2 border-t border-zinc-100">
                <button
                  type="button"
                  onClick={() => setShowItemDiscountModal(false)}
                  className="px-4 py-3 text-xs text-zinc-600 hover:bg-zinc-100 rounded-xl font-semibold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 bg-[#0D7A5F] hover:bg-[#0A624C] text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-900/10 transition"
                >
                  Send to Accountant
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 5: LOG FIELD EXPENSE                                                */}
      {/* ========================================================================= */}
      {showExpenseModal && (
        <div className="absolute inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-t-[32px] w-full p-5 pb-7 space-y-4 shadow-2xl border-t border-zinc-200/80 text-xs max-h-[88%] overflow-y-auto overscroll-contain animate-in slide-in-from-bottom duration-200">
            {/* iOS Grab Handle */}
            <div className="w-12 h-1 bg-zinc-300 rounded-full mx-auto -mt-1 mb-2 shrink-0" />

            <div className="flex items-center justify-between pb-2 border-b border-zinc-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 shrink-0">
                  <Receipt className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-zinc-900 leading-tight">Log Field Expense</h3>
                  <p className="text-[10px] text-zinc-500">Queued for Accountant Fatima Noor settlement</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowExpenseModal(false)}
                className="w-7 h-7 rounded-full bg-zinc-100 hover:bg-zinc-200 text-zinc-500 hover:text-zinc-900 flex items-center justify-center transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleLogExpense} className="space-y-3.5">
              <div>
                <label className="font-semibold text-zinc-800 text-xs block mb-1">
                  Expense Amount (PKR) *
                </label>
                <input
                  type="number"
                  placeholder="e.g. 1500"
                  required
                  value={expenseAmount}
                  onChange={(e) => setExpenseAmount(e.target.value)}
                  className="w-full bg-zinc-50 p-2.5 rounded-xl border border-zinc-200 text-xs font-mono font-bold text-zinc-900 focus:bg-white focus:border-amber-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="font-semibold text-zinc-800 text-xs block mb-1">
                  Receipt Description *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Emergency Teflon tape and insulation ties"
                  required
                  value={expenseNote}
                  onChange={(e) => setExpenseNote(e.target.value)}
                  className="w-full bg-zinc-50 p-2.5 rounded-xl border border-zinc-200 text-xs text-zinc-900 focus:bg-white focus:border-amber-600 focus:outline-none"
                />
              </div>

              <div className="flex items-center gap-2 pt-2 border-t border-zinc-100">
                <button
                  type="button"
                  onClick={() => setShowExpenseModal(false)}
                  className="px-4 py-3 text-xs text-zinc-600 hover:bg-zinc-100 rounded-xl font-semibold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold shadow-md shadow-amber-900/10 transition"
                >
                  Queue for Settlement Clearance
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 6: MOBILE APPLY LEAVE                                               */}
      {/* ========================================================================= */}
      {showMobileLeaveModal && (
        <div className="absolute inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-t-[32px] w-full p-5 pb-7 space-y-4 shadow-2xl border-t border-zinc-200/80 text-xs max-h-[88%] overflow-y-auto overscroll-contain animate-in slide-in-from-bottom duration-200">
            {/* iOS Grab Handle */}
            <div className="w-12 h-1 bg-zinc-300 rounded-full mx-auto -mt-1 mb-2 shrink-0" />

            <div className="flex items-center justify-between pb-2 border-b border-zinc-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-[#0D7A5F] shrink-0">
                  <Clock className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-zinc-900 leading-tight">Apply for Leave</h3>
                  <p className="text-[10px] text-zinc-500">Employee Self-Service (ESS)</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowMobileLeaveModal(false)}
                className="w-7 h-7 rounded-full bg-zinc-100 hover:bg-zinc-200 text-zinc-500 hover:text-zinc-900 flex items-center justify-center transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleApplyMobileLeave} className="space-y-3.5">
              <div>
                <label className="font-semibold text-zinc-800 text-xs block mb-1">Leave Category *</label>
                <select
                  value={mobileLeaveTypeId}
                  onChange={(e) => setMobileLeaveTypeId(e.target.value)}
                  className="w-full bg-zinc-50 p-2.5 rounded-xl border border-zinc-200 text-xs font-semibold text-zinc-900 focus:bg-white focus:outline-none"
                >
                  {techEssData?.leaveBalances?.map((lb: any) => (
                    <option key={lb.id} value={lb.leaveTypeId}>
                      {lb.leaveType?.name} ({lb.balance} days left)
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="font-semibold text-zinc-800 text-xs block mb-1">Start Date *</label>
                  <input
                    type="date"
                    required
                    value={mobileLeaveStart}
                    onChange={(e) => setMobileLeaveStart(e.target.value)}
                    className="w-full bg-zinc-50 p-2.5 rounded-xl border border-zinc-200 text-xs font-mono text-zinc-900"
                  />
                </div>
                <div>
                  <label className="font-semibold text-zinc-800 text-xs block mb-1">End Date *</label>
                  <input
                    type="date"
                    required
                    value={mobileLeaveEnd}
                    onChange={(e) => setMobileLeaveEnd(e.target.value)}
                    className="w-full bg-zinc-50 p-2.5 rounded-xl border border-zinc-200 text-xs font-mono text-zinc-900"
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold text-zinc-800 text-xs block mb-1">Reason / Notes *</label>
                <textarea
                  rows={2}
                  required
                  placeholder="e.g. Doctor appointment / Family event"
                  value={mobileLeaveReason}
                  onChange={(e) => setMobileLeaveReason(e.target.value)}
                  className="w-full bg-zinc-50 p-2.5 rounded-xl border border-zinc-200 text-xs resize-none focus:bg-white focus:outline-none"
                />
              </div>

              <div className="flex items-center gap-2 pt-2 border-t border-zinc-100">
                <button
                  type="button"
                  onClick={() => setShowMobileLeaveModal(false)}
                  className="px-4 py-3 text-xs text-zinc-600 hover:bg-zinc-100 rounded-xl font-semibold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 bg-[#0D7A5F] hover:bg-[#0A624C] text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-900/10 transition"
                >
                  Submit Application
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 7: MOBILE RAISE GRIEVANCE / FIELD TICKET                            */}
      {/* ========================================================================= */}
      {showMobileGrievanceModal && (
        <div className="absolute inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-t-[32px] w-full p-5 pb-7 space-y-4 shadow-2xl border-t border-zinc-200/80 text-xs max-h-[88%] overflow-y-auto overscroll-contain animate-in slide-in-from-bottom duration-200">
            {/* iOS Grab Handle */}
            <div className="w-12 h-1 bg-zinc-300 rounded-full mx-auto -mt-1 mb-2 shrink-0" />

            <div className="flex items-center justify-between pb-2 border-b border-zinc-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-[#0D7A5F] shrink-0">
                  <Briefcase className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-zinc-900 leading-tight">Field Equipment & Support Ticket</h3>
                  <p className="text-[10px] text-zinc-500">Fast reporting to HR & Operations</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowMobileGrievanceModal(false)}
                className="w-7 h-7 rounded-full bg-zinc-100 hover:bg-zinc-200 text-zinc-500 hover:text-zinc-900 flex items-center justify-center transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleRaiseMobileGrievance} className="space-y-3.5">
              <div>
                <label className="font-semibold text-zinc-800 text-xs block mb-1">Category *</label>
                <select
                  value={mobileGrievanceCat}
                  onChange={(e) => setMobileGrievanceCat(e.target.value)}
                  className="w-full bg-zinc-50 p-2.5 rounded-xl border border-zinc-200 text-xs font-semibold text-zinc-900 focus:bg-white focus:outline-none"
                >
                  <option value="Equipment & Tools">Equipment & Tools</option>
                  <option value="Workplace Safety">Field Safety & PPE</option>
                  <option value="Vehicle & Transport">Service Van / Fuel Card</option>
                  <option value="HR Policy & Payroll">Payroll & Allowance Query</option>
                </select>
              </div>

              <div>
                <label className="font-semibold text-zinc-800 text-xs block mb-1">Issue Description *</label>
                <textarea
                  rows={3}
                  required
                  placeholder="Describe the issue, broken pressure gauge, van repair, or store assistance needed..."
                  value={mobileGrievanceDesc}
                  onChange={(e) => setMobileGrievanceDesc(e.target.value)}
                  className="w-full bg-zinc-50 p-2.5 rounded-xl border border-zinc-200 text-xs resize-none focus:bg-white focus:outline-none"
                />
              </div>

              <div className="flex items-center gap-2 pt-2 border-t border-zinc-100">
                <button
                  type="button"
                  onClick={() => setShowMobileGrievanceModal(false)}
                  className="px-4 py-3 text-xs text-zinc-600 hover:bg-zinc-100 rounded-xl font-semibold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 bg-[#0D7A5F] hover:bg-[#0A624C] text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-900/10 transition"
                >
                  Send Ticket
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 8: IN-APP TECHNICIAN ACCOUNT SWITCHER SHEET                         */}
      {/* ========================================================================= */}
      {showTechSwitcherModal && (
        <div className="absolute inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-t-[32px] w-full p-5 pb-7 space-y-4 shadow-2xl border-t border-zinc-200/80 text-xs max-h-[88%] overflow-y-auto overscroll-contain animate-in slide-in-from-bottom duration-200">
            {/* iOS Grab Handle */}
            <div className="w-12 h-1 bg-zinc-300 rounded-full mx-auto -mt-1 mb-2 shrink-0" />

            <div className="flex items-center justify-between pb-2 border-b border-zinc-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-[#0D7A5F] shrink-0">
                  <User className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-zinc-900 leading-tight">Switch Technician Account</h3>
                  <p className="text-[10px] text-zinc-500">Test live field jobs & actions per technician</p>
                </div>
              </div>
              <button
                onClick={() => setShowTechSwitcherModal(false)}
                className="w-7 h-7 rounded-full bg-zinc-100 hover:bg-zinc-200 text-zinc-500 hover:text-zinc-900 flex items-center justify-center transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-[11px] text-zinc-600 leading-relaxed">
              Select any technician to instantly view their assigned jobs, inventory requests, and payroll ESS profile:
            </p>

            <div className="space-y-2">
              {allTechnicians.map((t) => {
                const isCurrent = technician?.id === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => switchTechnician(t)}
                    className={`w-full text-left p-3 rounded-2xl border flex items-center justify-between transition ${
                      isCurrent
                        ? "bg-emerald-50/70 border-emerald-300 ring-2 ring-[#0D7A5F]/20"
                        : "bg-zinc-50/80 border-zinc-200/80 hover:bg-zinc-100/80"
                    }`}
                  >
                    <div className="flex items-center gap-3 overflow-hidden">
                      <div
                        className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs text-white shrink-0 shadow-xs ${
                          isCurrent ? "bg-[#0D7A5F]" : "bg-zinc-600"
                        }`}
                      >
                        {t.name.charAt(0)}
                      </div>
                      <div className="overflow-hidden">
                        <p className="font-bold text-zinc-900 text-xs truncate">{t.name}</p>
                        <p className="text-[10px] text-zinc-500 truncate">
                          {t.phone} • <span className="font-semibold text-emerald-700">{t.currentStatus}</span>
                        </p>
                      </div>
                    </div>

                    {isCurrent ? (
                      <span className="text-[10px] font-bold text-[#0D7A5F] bg-emerald-100 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                        <Check className="w-3 h-3" /> Active
                      </span>
                    ) : (
                      <span className="text-[10px] text-zinc-500 font-semibold hover:text-zinc-900">
                        Switch →
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

          </div>
        </div>
      </div>
    </div>
  );
}
