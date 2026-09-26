"use client";

import React, { useEffect, useState } from "react";
import PageHeader from "@/components/layout/PageHeader";
import StatusBadge from "@/components/ui/StatusBadge";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import SideDrawer from "@/components/ui/SideDrawer";
import {
  Package,
  ShoppingCart,
  FileText,
  Truck,
  Plus,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  ArrowRight,
  TrendingDown,
  Trash2,
  Search,
  Check,
  X,
  Clock,
  Layers,
  FileSpreadsheet,
  ExternalLink,
  Eye,
  Info,
  ShieldCheck,
  Building,
  Wrench,
  ArrowRightLeft,
  Scale,
  ClipboardList,
  Pencil,
  Sparkles,
  History,
  XCircle,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { realtimeSync } from "@/lib/realtimeSync";
import { useRole } from "@/contexts/RoleContext";

function isServiceProduct(p: any) {
  if (!p) return false;
  if (p.isService) return true;
  const s = (p.sku || "").toUpperCase();
  const u = (p.unit || "").toLowerCase();
  return (
    s.startsWith("SRV-") ||
    s.startsWith("SVC-") ||
    ["service", "visit", "job", "hr", "hour"].includes(u)
  );
}

function generateServiceSku(prods: any[] = []) {
  const existingSkus = new Set(
    prods.map((p) => (p.sku || "").toUpperCase().trim())
  );
  let maxNum = 0;
  prods.forEach((p) => {
    const sku = (p.sku || "").toUpperCase().trim();
    const match = sku.match(/^SRV-(\d+)$/);
    if (match) {
      const num = parseInt(match[1], 10);
      if (num > maxNum) maxNum = num;
    }
  });
  let nextNum = maxNum > 0 ? maxNum + 1 : 1;
  let candidate = `SRV-${String(nextNum).padStart(3, "0")}`;
  while (existingSkus.has(candidate)) {
    nextNum++;
    candidate = `SRV-${String(nextNum).padStart(3, "0")}`;
  }
  return candidate;
}

export default function InventoryPurchasingPage() {
  const { currentRole } = useRole();
  const isStorekeeper = currentRole === "storekeeper";

  const [activeTab, setActiveTab] = useState<"stock" | "storekeeper" | "branches">("stock");

  const [products, setProducts] = useState<any[]>([]);
  const [techRequests, setTechRequests] = useState<any[]>([]);
  const [techReturns, setTechReturns] = useState<any[]>([]);

  // Selected product movement timeline
  const [selectedProduct, setSelectedProduct] = useState<any>(null);

  const [searchTerm, setSearchTerm] = useState("");

  // Stock Filter State & Allocations Modal
  const [stockFilter, setStockFilter] = useState<"all" | "physical" | "services" | "field" | "low">("all");
  const [activeAllocationProduct, setActiveAllocationProduct] = useState<any>(null);

  // Branches & Multi-Movement Hub State
  const [selectedBranch, setSelectedBranch] = useState("Central Warehouse (Lahore Hub)");
  const [branchMovements, setBranchMovements] = useState<any[]>([]);
  const [equipmentList, setEquipmentList] = useState<any[]>([]);
  const [technicians, setTechnicians] = useState<any[]>([]);
  const [activeMovementSubTab, setActiveMovementSubTab] = useState<"transfer" | "adjustment" | "workshop" | "equipment">("transfer");
  const [isSubmittingMovement, setIsSubmittingMovement] = useState(false);

  // Transfer Form State
  const [transferProductId, setTransferProductId] = useState("");
  const [transferQty, setTransferQty] = useState("5");
  const [transferFromBranch, setTransferFromBranch] = useState("Central Warehouse (Lahore Hub)");
  const [transferToBranch, setTransferToBranch] = useState("Karachi Regional Depot");
  const [transferChallan, setTransferChallan] = useState("");
  const [transferNotes, setTransferNotes] = useState("");

  // Discrepancy Adjustment Form State
  const [adjustProductId, setAdjustProductId] = useState("");
  const [adjustQty, setAdjustQty] = useState("1");
  const [adjustType, setAdjustType] = useState<"increase" | "decrease">("decrease");
  const [adjustReason, setAdjustReason] = useState("Audit Physical Variance");
  const [adjustNotes, setAdjustNotes] = useState("");

  // Workshop Internal Consumption State
  const [workshopProductId, setWorkshopProductId] = useState("");
  const [workshopQty, setWorkshopQty] = useState("1");
  const [workshopBench, setWorkshopBench] = useState("Compressor Test Bench & Brazing");
  const [workshopTech, setWorkshopTech] = useState("Senior Workshop Tech");
  const [workshopNotes, setWorkshopNotes] = useState("");

  // Equipment Checkout Modal State
  const [selectedAssetForCheckout, setSelectedAssetForCheckout] = useState<any>(null);
  const [checkoutEmployeeId, setCheckoutEmployeeId] = useState("");
  const [checkoutNotes, setCheckoutNotes] = useState("Tested, calibrated & functional");



  // Add Stock & Product Creation State
  const [showAddStockModal, setShowAddStockModal] = useState(false);
  const [stockModalTab, setStockModalTab] = useState<"restock" | "new_product" | "new_service">("restock");
  const [restockProductId, setRestockProductId] = useState("");
  const [restockQuantity, setRestockQuantity] = useState("10");
  const [restockUnitCost, setRestockUnitCost] = useState("");
  const [restockSource, setRestockSource] = useState("Local Wholesale Market (Karachi/Lahore)");
  const [restockNotes, setRestockNotes] = useState("");
  const [isSubmittingStock, setIsSubmittingStock] = useState(false);

  // New Physical Product State
  const [newProductSku, setNewProductSku] = useState("");
  const [newProductName, setNewProductName] = useState("");
  const [newProductUnit, setNewProductUnit] = useState("unit");
  const [newProductCost, setNewProductCost] = useState("");
  const [newProductPrice, setNewProductPrice] = useState("");
  const [newProductQty, setNewProductQty] = useState("10");
  const [newProductMinAlert, setNewProductMinAlert] = useState("5");

  // Predefined Service State
  const [newServiceSku, setNewServiceSku] = useState("");
  const [newServiceName, setNewServiceName] = useState("");
  const [newServiceCost, setNewServiceCost] = useState("");
  const [newServiceNotes, setNewServiceNotes] = useState("");

  // Quick Edit Modal State (Rate / Cost update)
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [editPrice, setEditPrice] = useState("");
  const [editCost, setEditCost] = useState("");
  const [isUpdatingProduct, setIsUpdatingProduct] = useState(false);

  const [notification, setNotification] = useState("");

  async function loadData() {
    try {
      if (activeTab === "stock") {
        const res = await fetch("/api/inventory");
        const data = await res.json();
        if (Array.isArray(data)) setProducts(data);
      } else if (activeTab === "storekeeper") {
        const [reqRes, retRes] = await Promise.all([
          fetch("/api/inventory?view=requests"),
          fetch("/api/inventory?view=returns"),
        ]);
        const requests = await reqRes.json();
        const returns = await retRes.json();
        if (Array.isArray(requests)) setTechRequests(requests);
        if (Array.isArray(returns)) setTechReturns(returns);

      } else if (activeTab === "branches") {
        const [prodRes, moveRes, equipRes, techRes] = await Promise.all([
          fetch("/api/inventory"),
          fetch("/api/inventory?view=movements"),
          fetch("/api/inventory?view=equipment"),
          fetch("/api/technicians"),
        ]);
        const pData = await prodRes.json();
        const mData = await moveRes.json();
        const eData = await equipRes.json();
        const tData = await techRes.json();
        if (Array.isArray(pData)) setProducts(pData);
        if (Array.isArray(mData)) setBranchMovements(mData);
        if (Array.isArray(eData)) setEquipmentList(eData);
        if (Array.isArray(tData)) setTechnicians(tData);
      }
    } catch (e) {
      console.error("Failed loading inventory data", e);
    }
  }

  useEffect(() => {
    loadData();
  }, [activeTab]);

  useEffect(() => {
    if (products.length > 0 && (!newServiceSku || newServiceSku === "SRV-")) {
      setNewServiceSku(generateServiceSku(products));
    }
  }, [products]);

  // Real-time synchronization for storekeeper requests and stock returns
  useEffect(() => {
    const unsub = realtimeSync.subscribe((evt) => {
      if (
        evt.type === "INVENTORY_REQUESTED" ||
        evt.type === "STOCK_RETURN_ACKNOWLEDGED" ||
        evt.type === "INVENTORY_FULFILLED"
      ) {
        loadData();
      }
    });
    return () => unsub();
  }, [activeTab]);

  // View product timeline
  const handleViewTimeline = async (id: string) => {
    try {
      const res = await fetch(`/api/inventory?productId=${id}`);
      const data = await res.json();
      setSelectedProduct(data);
    } catch (e) {
      console.error(e);
    }
  };

  // Storekeeper acknowledge stock return
  const handleAcknowledgeReturn = async (returnId: string) => {
    try {
      const res = await fetch("/api/inventory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "acknowledge_return",
          stockReturnId: returnId,
          storeKeeperName: "Bilal Sheikh (Storekeeper)",
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error);
      }
      setNotification("Stock return physically inspected and acknowledged. Warehouse inventory restored.");
      loadData();

      // Publish Real-time Sync Event
      realtimeSync.publish("STOCK_RETURN_ACKNOWLEDGED", {
        actor: "Storekeeper Bilal Sheikh",
        message: `Storekeeper Bilal Sheikh physically inspected and acknowledged returned stock.`,
        payload: { returnId },
      });
    } catch (e: any) {
      alert(e.message);
    }
  };

  // Storekeeper fulfill tech inventory request
  const handleFulfillRequest = async (requestId: string, itemStr: string, qty: number) => {
    const prod = products.find((p) => p.name.includes(itemStr) || p.sku.includes(itemStr)) || products[0];
    if (!prod) return;

    try {
      const res = await fetch("/api/inventory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "fulfill_request",
          requestId,
          productId: prod.id,
          quantity: qty,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error);
      }
      setNotification("Inventory issued to technician. Stock deducted and COGS posted.");
      loadData();

      // Publish Real-time Sync Event
      realtimeSync.publish("INVENTORY_FULFILLED", {
        actor: "Storekeeper Bilal Sheikh",
        message: `Storekeeper Bilal Sheikh fulfilled request: ${qty}x ${prod.name}`,
        payload: { requestId, productId: prod.id, quantity: qty },
      });
    } catch (e: any) {
      alert(e.message);
    }
  };



  // Restock Existing Item
  const handleRestockSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!restockProductId) return;
    try {
      setIsSubmittingStock(true);
      const res = await fetch("/api/inventory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "add_stock",
          productId: restockProductId,
          quantity: Number(restockQuantity) || 1,
          unitCost: restockUnitCost ? Number(restockUnitCost) : undefined,
          source: restockSource,
          notes: restockNotes,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error);
      }
      setShowAddStockModal(false);
      setNotification("Stock added successfully! Warehouse inventory and financial ledgers updated.");
      setRestockNotes("");
      loadData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsSubmittingStock(false);
    }
  };


  // Create New Product
  const handleCreateProductSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProductSku || !newProductName) return;
    try {
      setIsSubmittingStock(true);
      const res = await fetch("/api/inventory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create_product",
          sku: newProductSku,
          name: newProductName,
          unit: newProductUnit,
          costPrice: Number(newProductCost) || 0,
          unitPrice: Number(newProductPrice) || 0,
          stockQuantity: Number(newProductQty) || 0,
          reorderLevel: Number(newProductMinAlert) || 5,
          notes: "Initial inventory setup",
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error);
      }
      setShowAddStockModal(false);
      setNotification(`Product "${newProductName}" (${newProductSku}) created with ${newProductQty} initial units.`);
      setNewProductSku("");
      setNewProductName("");
      setNewProductCost("");
      setNewProductPrice("");
      loadData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsSubmittingStock(false);
    }
  };

  // Create Predefined Service
  const handleCreateServiceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newServiceSku || !newServiceName) return;
    try {
      setIsSubmittingStock(true);
      const cost = Number(newServiceCost) || 0;
      const res = await fetch("/api/inventory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create_product",
          itemType: "service",
          sku: newServiceSku.trim().toUpperCase(),
          name: newServiceName.trim(),
          unit: "service",
          unitPrice: cost,
          costPrice: cost,
          stockQuantity: 0,
          reorderLevel: 0,
          notes: newServiceNotes || "Predefined billable service package",
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error);
      }
      setShowAddStockModal(false);
      setNotification(`Predefined Service "${newServiceName}" (${newServiceSku}) added to catalog!`);
      const nextSku = generateServiceSku([...products, { sku: newServiceSku }]);
      setNewServiceSku(nextSku);
      setNewServiceName("");
      setNewServiceCost("");
      setNewServiceNotes("");
      loadData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsSubmittingStock(false);
    }
  };

  // Quick Update Service / Product Rate
  const handleQuickUpdateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct) return;
    try {
      setIsUpdatingProduct(true);
      const isService = isServiceProduct(editingProduct);
      const res = await fetch("/api/inventory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update_product",
          id: editingProduct.id,
          unitPrice: Number(editPrice) || 0,
          costPrice: isService ? (Number(editPrice) || 0) : (Number(editCost) || 0),
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error);
      }
      setNotification(`Updated rates for "${editingProduct.name}" successfully.`);
      setEditingProduct(null);
      loadData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsUpdatingProduct(false);
    }
  };



  const pendingStorekeeperCount =
    techRequests.filter((r) => r.status === "Pending").length +
    techReturns.filter((r) => r.status === "Pending").length;

  const physicalProducts = products.filter((p) => !isServiceProduct(p));
  const serviceProducts = products.filter((p) => isServiceProduct(p));

  const lowStockCount = physicalProducts.filter(
    (p) => p.stockQuantity <= (p.reorderPoint || 5)
  ).length;

  const totalWarehouseUnits = physicalProducts.reduce((acc, p) => acc + (p.stockQuantity || 0), 0);
  const totalStockOnJobUnits = physicalProducts.reduce((acc, p) => acc + (p.stockOnJob || 0), 0);
  const totalEnterpriseUnits = totalWarehouseUnits + totalStockOnJobUnits;
  const productsOnJobCount = physicalProducts.filter((p) => (p.stockOnJob || 0) > 0).length;

  const filteredProducts = products.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.sku.toLowerCase().includes(searchTerm.toLowerCase());
    if (!matchesSearch) return false;

    if (stockFilter === "physical") {
      return !isServiceProduct(p);
    }
    if (stockFilter === "services") {
      return isServiceProduct(p);
    }
    if (stockFilter === "field") {
      return !isServiceProduct(p) && (p.stockOnJob || 0) > 0;
    }
    if (stockFilter === "low") {
      return !isServiceProduct(p) && p.stockQuantity <= (p.reorderPoint || 5);
    }
    return true;
  });

  const [inventoryPage, setInventoryPage] = useState(1);
  const inventoryPageSize = 20;

  useEffect(() => {
    setInventoryPage(1);
  }, [stockFilter, searchTerm, products.length]);

  const sortedProducts = React.useMemo(() => {
    return [...filteredProducts].sort((a, b) => {
      const parseDate = (item: any) => {
        const val = item?.createdAt || item?.created_at || item?.updatedAt || item?.updated_at || item?.date;
        if (!val) return 0;
        const d = new Date(val).getTime();
        return isNaN(d) ? 0 : d;
      };
      const dateA = parseDate(a);
      const dateB = parseDate(b);
      if (dateA && dateB && dateA !== dateB) return dateB - dateA;
      return 0;
    });
  }, [filteredProducts]);

  const invTotalItems = sortedProducts.length;
  const invTotalPages = Math.max(1, Math.ceil(invTotalItems / inventoryPageSize));
  const validInvPage = Math.min(Math.max(1, inventoryPage), invTotalPages);
  const invStartIndex = (validInvPage - 1) * inventoryPageSize;
  const invEndIndex = Math.min(invStartIndex + inventoryPageSize, invTotalItems);
  const paginatedProducts = sortedProducts.slice(invStartIndex, invEndIndex);

  const handleBranchTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!transferProductId) return alert("Please select a product");
    setIsSubmittingMovement(true);
    try {
      const res = await fetch("/api/inventory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "branch_transfer",
          productId: transferProductId,
          quantity: Number(transferQty),
          fromBranch: transferFromBranch,
          toBranch: transferToBranch,
          challanNumber: transferChallan || `TRF-${Date.now().toString().slice(-4)}`,
          notes: transferNotes,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to transfer stock");
      }
      setNotification(`Stock transfer dispatched successfully to ${transferToBranch}`);
      setTransferNotes("");
      loadData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsSubmittingMovement(false);
    }
  };

  const handleStockAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustProductId) return alert("Please select a product");
    setIsSubmittingMovement(true);
    try {
      const res = await fetch("/api/inventory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "stock_adjustment",
          productId: adjustProductId,
          quantity: Number(adjustQty),
          type: adjustType,
          reason: adjustReason,
          notes: adjustNotes,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to record adjustment");
      }
      setNotification(`Stock audit adjustment recorded (${adjustType === "increase" ? "+" : "-"}${adjustQty})`);
      setAdjustNotes("");
      loadData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsSubmittingMovement(false);
    }
  };

  const handleWorkshopConsumption = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workshopProductId) return alert("Please select a product");
    setIsSubmittingMovement(true);
    try {
      const res = await fetch("/api/inventory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "workshop_consumption",
          productId: workshopProductId,
          quantity: Number(workshopQty),
          workshopUnit: workshopBench,
          technicianName: workshopTech,
          notes: workshopNotes,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to log workshop consumption");
      }
      setNotification("Workshop internal consumption recorded and stock updated.");
      setWorkshopNotes("");
      loadData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsSubmittingMovement(false);
    }
  };

  const handleCheckoutEquipment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAssetForCheckout || !checkoutEmployeeId) return alert("Please select equipment and technician");
    setIsSubmittingMovement(true);
    try {
      const res = await fetch("/api/inventory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "checkout_equipment",
          assetId: selectedAssetForCheckout.id,
          employeeId: checkoutEmployeeId,
          assignedBy: "Storekeeper",
          conditionNotes: checkoutNotes,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to checkout equipment");
      }
      setNotification(`Equipment '${selectedAssetForCheckout.name}' checked out to technician`);
      setSelectedAssetForCheckout(null);
      loadData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsSubmittingMovement(false);
    }
  };

  const handleReturnEquipment = async (asset: any) => {
    const latestAssignment = asset.assignments?.[0];
    const notes = prompt("Enter return inspection condition (e.g. Returned clean, functional & calibrated):", "Returned clean & calibrated");
    if (notes === null) return;
    try {
      const res = await fetch("/api/inventory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "return_equipment",
          assetId: asset.id,
          assignmentId: latestAssignment?.id,
          conditionNotes: notes,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to return equipment");
      }
      setNotification(`Equipment '${asset.name}' returned to tool crib storage.`);
      loadData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const tabs: Array<{ id: string; label: string; icon: React.ReactNode; badge?: string; count?: number }> = [
    { id: "stock", label: "Stock Levels", icon: <Package className="w-3.5 h-3.5" />, badge: lowStockCount > 0 ? `${lowStockCount} Low` : undefined },
    { id: "branches", label: "Branches & Movements", icon: <Building className="w-3.5 h-3.5" /> },
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Enterprise Page Header */}
      <PageHeader
        breadcrumbs={[{ label: "Warehouse & Stock" }]}
        title="Warehouse & Stock Management"
        subtitle="Comprehensive inventory levels, parts tracking, on-job field allocations, and multi-branch movements"
        actions={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setStockModalTab("new_service");
                setNewServiceSku(generateServiceSku(products));
                setShowAddStockModal(true);
              }}
              className="h-8 px-3.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-xs font-semibold text-white inline-flex items-center gap-1.5 transition shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
            >
              <Wrench className="w-3.5 h-3.5" />
              + Add Service
            </button>
            <button
              type="button"
              onClick={() => {
                setStockModalTab("new_product");
                setShowAddStockModal(true);
              }}
              className="h-8 px-3 rounded-lg border border-[#D4D4D8] hover:bg-[#F4F4F5] text-xs font-semibold text-[#18181B] inline-flex items-center gap-1.5 transition shadow-xs focus-visible:outline-none"
            >
              <Package className="w-3.5 h-3.5 text-[#71717A]" />
              New Material
            </button>
            <button
              type="button"
              onClick={() => {
                if (products.length > 0 && !restockProductId) {
                  setRestockProductId(products[0].id);
                  setRestockUnitCost(String(products[0].costPrice || ""));
                }
                setStockModalTab("restock");
                setShowAddStockModal(true);
              }}
              className="h-8 px-3.5 rounded-lg bg-[#0D7A5F] hover:bg-[#0A624C] text-xs font-semibold text-white inline-flex items-center gap-1.5 transition shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0D7A5F]"
            >
              <Plus className="w-3.5 h-3.5" />
              + Restock Item
            </button>
          </div>
        }
      />

      {notification && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-medium rounded-lg flex items-center justify-between">
          <span className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            {notification}
          </span>
          <button
            onClick={() => setNotification("")}
            className="text-emerald-700 hover:text-emerald-900 font-bold"
            aria-label="Dismiss message"
          >
            ✕
          </button>
        </div>
      )}

      {/* Enterprise Saved-View Tab Navigation */}
      <div className="flex items-center border-b border-[#E4E4E7] gap-2 overflow-x-auto bg-white px-4 rounded-xl border shadow-xs">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id as any);
                setSelectedProduct(null);
              }}
              className={`h-11 px-3.5 text-xs font-semibold inline-flex items-center gap-2 border-b-2 transition whitespace-nowrap focus-visible:outline-none ${
                isActive
                  ? "border-[#0D7A5F] text-[#0D7A5F]"
                  : "border-transparent text-[#71717A] hover:text-[#18181B] hover:border-[#D4D4D8]"
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
              {tab.badge && (
                <span className="text-[10px] px-1.5 py-0.2 rounded-full font-bold bg-amber-100 text-amber-800">
                  {tab.badge}
                </span>
              )}
              {tab.count !== undefined && tab.count > 0 && (
                <span className="text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold bg-rose-100 text-rose-800">
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* TAB 1: STOCK LEVELS */}
      {activeTab === "stock" && (
        <div className="space-y-6">
          {/* Stock Metrics Overview Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
            <div className="bg-white p-4 rounded-xl border border-[#E4E4E7] shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-[#71717A]">
                  Warehouse Stock
                </span>
                <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center">
                  <Package className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-bold font-mono text-[#18181B]">
                  {totalWarehouseUnits.toLocaleString()}
                </span>
                <span className="text-xs text-[#71717A]">units in storage</span>
              </div>
              <p className="text-[11px] text-[#71717A] mt-1">Available physical materials & parts</p>
            </div>

            <div className="bg-white p-4 rounded-xl border border-blue-200/80 bg-blue-50/20 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-blue-900">
                  Stock on Job / Field
                </span>
                <div className="w-7 h-7 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center">
                  <Truck className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-bold font-mono text-blue-900">
                  {totalStockOnJobUnits.toLocaleString()}
                </span>
                <span className="text-xs text-blue-700">units issued</span>
              </div>
              <p className="text-[11px] text-blue-800/80 mt-1">
                Active parts held by field technicians
              </p>
            </div>

            <div className="bg-white p-4 rounded-xl border border-[#E4E4E7] shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-[#71717A]">
                  Total Material Stock
                </span>
                <div className="w-7 h-7 rounded-lg bg-zinc-100 text-zinc-700 flex items-center justify-center">
                  <Layers className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-bold font-mono text-[#18181B]">
                  {totalEnterpriseUnits.toLocaleString()}
                </span>
                <span className="text-xs text-[#71717A]">combined units</span>
              </div>
              <p className="text-[11px] text-[#71717A] mt-1">Warehouse + Field technician holdings</p>
            </div>

            <div className="bg-white p-4 rounded-xl border border-purple-200/80 bg-purple-50/20 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-purple-900">
                  Predefined Services
                </span>
                <div className="w-7 h-7 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center">
                  <Wrench className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-bold font-mono text-purple-900">
                  {serviceProducts.length}
                </span>
                <span className="text-xs text-purple-700">active packages</span>
              </div>
              <p className="text-[11px] text-purple-800/80 mt-1">
                On-demand labor, wash & repairs
              </p>
            </div>

            <div className="bg-white p-4 rounded-xl border border-[#E4E4E7] shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-[#71717A]">
                  Reorder Alerts
                </span>
                <div
                  className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                    lowStockCount > 0 ? "bg-amber-100 text-amber-800" : "bg-zinc-100 text-zinc-600"
                  }`}
                >
                  <AlertTriangle className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span
                  className={`text-2xl font-bold font-mono ${
                    lowStockCount > 0 ? "text-amber-700" : "text-[#18181B]"
                  }`}
                >
                  {lowStockCount}
                </span>
                <span className="text-xs text-[#71717A]">materials low</span>
              </div>
              <p className="text-[11px] text-[#71717A] mt-1">Parts requiring procurement PR</p>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-[#E4E4E7] shadow-xs overflow-hidden">
            {/* Header & Controls Toolbar */}
            <div className="px-5 py-4 bg-gradient-to-r from-zinc-50/80 to-white border-b border-[#E4E4E7] flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-xs font-bold text-[#18181B] uppercase tracking-wider">
                    Catalog Inventory & Predefined Services
                  </h3>
                  <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-600 font-semibold border border-zinc-200">
                    {filteredProducts.length} {filteredProducts.length === 1 ? "item" : "items"}
                  </span>
                </div>
                <p className="text-[11px] text-[#71717A] mt-0.5">
                  Physical warehouse stock, live job dispatches, and predefined billable technician service packages.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                {/* Filter chips */}
                <div className="inline-flex rounded-xl p-1 bg-[#F4F4F5] border border-[#E4E4E7] text-xs">
                  <button
                    type="button"
                    onClick={() => setStockFilter("all")}
                    className={`px-3 py-1 rounded-lg font-semibold transition ${
                      stockFilter === "all"
                        ? "bg-white text-[#18181B] shadow-2xs font-bold"
                        : "text-[#71717A] hover:text-[#18181B]"
                    }`}
                  >
                    All ({products.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setStockFilter("physical")}
                    className={`px-2.5 py-1 rounded-lg font-semibold inline-flex items-center gap-1.5 transition ${
                      stockFilter === "physical"
                        ? "bg-[#0D7A5F] text-white shadow-2xs font-bold"
                        : "text-[#71717A] hover:text-[#0D7A5F]"
                    }`}
                  >
                    <Package className="w-3 h-3" />
                    Physical ({physicalProducts.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setStockFilter("services")}
                    className={`px-2.5 py-1 rounded-lg font-semibold inline-flex items-center gap-1.5 transition ${
                      stockFilter === "services"
                        ? "bg-indigo-600 text-white shadow-2xs font-bold"
                        : "text-[#71717A] hover:text-indigo-700"
                    }`}
                  >
                    <Wrench className="w-3 h-3" />
                    Services ({serviceProducts.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setStockFilter("field")}
                    className={`px-2.5 py-1 rounded-lg font-semibold inline-flex items-center gap-1.5 transition ${
                      stockFilter === "field"
                        ? "bg-blue-600 text-white shadow-2xs font-bold"
                        : "text-[#71717A] hover:text-blue-700"
                    }`}
                  >
                    <Truck className="w-3 h-3" />
                    On Job ({productsOnJobCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => setStockFilter("low")}
                    className={`px-2.5 py-1 rounded-lg font-semibold inline-flex items-center gap-1.5 transition ${
                      stockFilter === "low"
                        ? "bg-amber-600 text-white shadow-2xs font-bold"
                        : "text-[#71717A] hover:text-amber-700"
                    }`}
                  >
                    <AlertTriangle className="w-3 h-3" />
                    Low ({lowStockCount})
                  </button>
                </div>

                {/* Search Bar */}
                <div className="relative w-64">
                  <Search className="w-3.5 h-3.5 text-[#71717A] absolute left-3 top-2.5" />
                  <input
                    type="text"
                    placeholder="Search SKU, part, or service..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-8.5 pr-7 py-1.5 rounded-xl border border-[#D4D4D8] text-xs bg-white focus:outline-none focus:ring-2 focus:ring-[#0D7A5F] placeholder:text-zinc-400"
                  />
                  {searchTerm && (
                    <button
                      type="button"
                      onClick={() => setSearchTerm("")}
                      className="absolute right-2.5 top-2 text-zinc-400 hover:text-zinc-600 text-xs"
                      title="Clear search"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Table or Empty State */}
            {filteredProducts.length === 0 ? (
              <div className="py-14 px-4 text-center">
                <div className="w-12 h-12 rounded-2xl bg-zinc-100 text-zinc-400 flex items-center justify-center mx-auto mb-3">
                  <Package className="w-6 h-6" />
                </div>
                <h4 className="text-sm font-bold text-zinc-800">No inventory items or services found</h4>
                <p className="text-xs text-zinc-500 mt-1 max-w-sm mx-auto">
                  {searchTerm
                    ? `No results match "${searchTerm}". Try checking your spelling or clearing filters.`
                    : "No items match the selected category filter."}
                </p>
                {(searchTerm || stockFilter !== "all") && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchTerm("");
                      setStockFilter("all");
                    }}
                    className="mt-3.5 px-3 py-1.5 rounded-lg border border-zinc-300 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 transition"
                  >
                    Reset Filters & Search
                  </button>
                )}
              </div>
            ) : (
              <>
                <div className="overflow-x-auto max-h-[640px]">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="sticky top-0 bg-[#F8FAFC] z-10 border-b border-[#E4E4E7]">
                    <tr className="text-[11px] font-semibold text-[#71717A] uppercase tracking-wider">
                      <th className="py-3 px-4">Item Code & Type</th>
                      <th className="py-3 px-4">Description / Service</th>
                      <th className="py-3 px-4 text-center">In Warehouse</th>
                      <th className="py-3 px-4 text-center">Stock on Job</th>
                      <th className="py-3 px-4 text-center">Total Stock</th>
                      <th className="py-3 px-4 text-center">Reorder Point</th>
                      <th className="py-3 px-4 text-right">
                        {isStorekeeper ? "Valuation" : "Billable Rate"}
                      </th>
                      <th className="py-3 px-4 text-center">Classification</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E4E4E7]">
                    {paginatedProducts.map((p) => {
                      const isService = isServiceProduct(p);
                      const isLow = !isService && p.stockQuantity <= (p.reorderPoint || 5);
                      const isOut = !isService && p.stockQuantity <= 0;
                      const onJobQty = p.stockOnJob || 0;
                      const totalQty = (p.stockQuantity || 0) + onJobQty;

                      return (
                        <tr
                          key={p.id}
                          className={`transition-colors hover:bg-zinc-50/80 ${
                            isService
                              ? "bg-purple-50/15"
                              : isLow
                              ? "bg-amber-50/25"
                              : ""
                          }`}
                        >
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-bold text-xs text-[#18181B] bg-zinc-100 border border-zinc-200 px-2 py-0.5 rounded-md shadow-2xs">
                                {p.sku}
                              </span>
                              {isService ? (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-purple-100 text-purple-800 border border-purple-200 shrink-0">
                                  <Wrench className="w-2.5 h-2.5 text-purple-700" />
                                  Service
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-800 border border-emerald-200 shrink-0">
                                  <Package className="w-2.5 h-2.5 text-emerald-700" />
                                  Material
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-4 max-w-xs">
                            <div className="font-semibold text-xs text-[#18181B]">{p.name}</div>
                          </td>
                          <td className="py-3 px-4 text-center font-mono">
                            {isService ? (
                              <span className="text-xs text-zinc-300 font-mono">—</span>
                            ) : isOut ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200 shadow-2xs">
                                <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                                0 <span className="font-normal text-[10px] text-rose-600">{p.unit || "unit"}</span>
                              </span>
                            ) : isLow ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200 shadow-2xs">
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                                {p.stockQuantity} <span className="font-normal text-[10px] text-amber-700">{p.unit || "unit"}</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 shadow-2xs">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                {p.stockQuantity} <span className="font-normal text-[10px] text-emerald-700">{p.unit || "unit"}</span>
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-center">
                            {isService ? (
                              <span className="text-xs text-zinc-300 font-mono">—</span>
                            ) : onJobQty > 0 ? (
                              <button
                                type="button"
                                onClick={() => setActiveAllocationProduct(p)}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 hover:border-blue-300 transition shadow-2xs cursor-pointer group"
                                title="Click to view technician allocations across active jobs"
                              >
                                <Truck className="w-3.5 h-3.5 text-blue-600 shrink-0 group-hover:scale-105 transition-transform" />
                                <span>{onJobQty} <span className="text-[10px] font-normal">{p.unit || "units"}</span></span>
                                <span className="text-[10px] px-1.5 py-0.2 bg-blue-200/80 rounded-full font-mono text-blue-900 font-semibold">
                                  {p.jobAllocations?.length || 1} {p.jobAllocations?.length === 1 ? "job" : "jobs"}
                                </span>
                              </button>
                            ) : (
                              <span className="text-xs text-zinc-300 font-mono">—</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-center">
                            {isService ? (
                              <span className="text-xs text-zinc-300 font-mono">—</span>
                            ) : (
                              <div className="font-mono font-bold text-xs text-[#18181B]">
                                {totalQty} <span className="text-[10px] font-normal text-zinc-500">{p.unit || "unit"}</span>
                              </div>
                            )}
                          </td>
                          <td className="py-3 px-4 text-center font-mono">
                            {isService ? (
                              <span className="text-xs text-zinc-300 font-mono">—</span>
                            ) : (
                              <span className="text-xs text-zinc-600 font-medium">
                                {p.reorderPoint || 5} <span className="text-[10px] text-zinc-400 font-normal">{p.unit || "unit"}</span>
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right">
                            {isStorekeeper && !isService ? (
                              <span className="text-[10px] font-semibold text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                                Price Masked
                              </span>
                            ) : (
                              <div className="font-mono text-xs font-bold text-[#18181B]">
                                <span>{formatCurrency(p.unitPrice || p.costPrice || 0)}</span>
                                {!isService && (
                                  <span className="text-[10px] font-normal text-zinc-500 ml-1">/{p.unit || "unit"}</span>
                                )}
                              </div>
                            )}
                          </td>
                          <td className="py-3 px-4 text-center">
                            {isService ? (
                              <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-purple-50 text-purple-800 border border-purple-200 whitespace-nowrap inline-flex items-center gap-1.5 shadow-2xs">
                                <Sparkles className="w-3 h-3 text-purple-600 shrink-0" />
                                Service
                              </span>
                            ) : isOut ? (
                              <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-50 text-rose-800 border border-rose-200 whitespace-nowrap inline-flex items-center gap-1.5 shadow-2xs">
                                <XCircle className="w-3 h-3 text-rose-600 shrink-0" />
                                Out of Stock
                              </span>
                            ) : isLow ? (
                              <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200 whitespace-nowrap inline-flex items-center gap-1.5 shadow-2xs">
                                <AlertTriangle className="w-3 h-3 text-amber-600 shrink-0" />
                                Low Stock
                              </span>
                            ) : (
                              <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 whitespace-nowrap inline-flex items-center gap-1.5 shadow-2xs">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
                                In Stock
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {isService ? (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditingProduct(p);
                                      setEditPrice(String(p.unitPrice || 0));
                                      setEditCost(String(p.costPrice || 0));
                                    }}
                                    className="h-7 px-2.5 rounded-lg bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 text-xs font-semibold inline-flex items-center gap-1 transition shadow-2xs cursor-pointer focus-visible:outline-none"
                                    title="Edit service billing rate or technician cost"
                                  >
                                    <Pencil className="w-3 h-3" />
                                    Edit Cost
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleViewTimeline(p.id)}
                                    className="h-7 px-2 rounded-lg text-zinc-500 hover:text-zinc-800 hover:bg-zinc-100 text-xs font-semibold inline-flex items-center gap-1 transition cursor-pointer focus-visible:outline-none"
                                    title="View Stock Audit Log"
                                  >
                                    <History className="w-3.5 h-3.5" />
                                    Log
                                  </button>
                                </>
                              ) : (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setRestockProductId(p.id);
                                      setRestockUnitCost(String(p.costPrice || ""));
                                      setStockModalTab("restock");
                                      setShowAddStockModal(true);
                                    }}
                                    className="h-7 px-2.5 rounded-lg bg-[#0D7A5F] hover:bg-[#0A624C] text-white text-xs font-semibold inline-flex items-center gap-1 transition shadow-xs cursor-pointer focus-visible:outline-none"
                                    title="Inward / Restock item"
                                  >
                                    <Plus className="w-3.5 h-3.5" />
                                    Restock
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleViewTimeline(p.id)}
                                    className="h-7 px-2 rounded-lg text-zinc-500 hover:text-zinc-800 hover:bg-zinc-100 text-xs font-semibold inline-flex items-center gap-1 transition cursor-pointer focus-visible:outline-none"
                                    title="View Stock Audit Log"
                                  >
                                    <History className="w-3.5 h-3.5" />
                                    Log
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Table Footer with Pagination Controls */}
              <div className="px-4 py-3 bg-[#FAFAFA] border-t border-[#EDEDED] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-[#71717A]">
                <div className="flex items-center gap-3">
                  <span>
                    Showing{" "}
                    <strong className="text-[#18181B] font-mono">
                      {invTotalItems === 0 ? 0 : invStartIndex + 1}–{invEndIndex}
                    </strong>{" "}
                    of <strong className="text-[#18181B] font-mono">{invTotalItems}</strong> catalog items
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-xs font-mono text-[#71717A]">
                    Page <strong className="text-[#18181B]">{validInvPage}</strong> of{" "}
                    <strong className="text-[#18181B]">{invTotalPages}</strong>
                  </span>

                  <div className="inline-flex items-center rounded-lg border border-[#D4D4D8] bg-white shadow-2xs overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setInventoryPage((p) => Math.max(1, p - 1))}
                      disabled={validInvPage <= 1}
                      className="px-3 py-1.5 text-xs font-semibold text-[#18181B] hover:bg-[#F4F4F5] disabled:opacity-40 disabled:cursor-not-allowed transition border-r border-[#E4E4E7] flex items-center gap-1 cursor-pointer disabled:pointer-events-none"
                      aria-label="Previous page"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                      Previous
                    </button>
                    <button
                      type="button"
                      onClick={() => setInventoryPage((p) => Math.min(invTotalPages, p + 1))}
                      disabled={validInvPage >= invTotalPages}
                      className="px-3 py-1.5 text-xs font-semibold text-[#18181B] hover:bg-[#F4F4F5] disabled:opacity-40 disabled:cursor-not-allowed transition flex items-center gap-1 cursor-pointer disabled:pointer-events-none"
                      aria-label="Next page"
                    >
                      Next
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}
          </div>

          {/* Product Movement Timeline & Allocations Drawer */}
          {selectedProduct && (
            <div className="bg-white rounded-xl border border-[#E4E4E7] shadow-xs p-5 space-y-4 animate-in fade-in">
              <div className="flex items-center justify-between pb-3 border-b border-[#E4E4E7]">
                <div>
                  <h3 className="text-xs font-bold text-[#18181B] uppercase tracking-wider">
                    Stock Audit Log: {selectedProduct.name} ({selectedProduct.sku})
                  </h3>
                  <div className="flex items-center gap-3 text-[11px] text-[#71717A] mt-0.5">
                    <span>
                      Warehouse: <strong className="text-[#18181B] font-mono">{selectedProduct.stockQuantity}</strong> {selectedProduct.unit || "unit"}
                    </span>
                    <span>•</span>
                    <span>
                      Stock on Job: <strong className="text-blue-700 font-mono">{selectedProduct.stockOnJob || 0}</strong> {selectedProduct.unit || "unit"}
                    </span>
                    <span>•</span>
                    <span>
                      Total Stock: <strong className="text-[#18181B] font-mono">{(selectedProduct.stockQuantity || 0) + (selectedProduct.stockOnJob || 0)}</strong> {selectedProduct.unit || "unit"}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedProduct(null)}
                  className="text-xs text-[#0D7A5F] font-semibold hover:underline"
                >
                  Close Log
                </button>
              </div>

              {/* Active Field Allocations in Timeline View */}
              {selectedProduct.jobAllocations && selectedProduct.jobAllocations.length > 0 && (
                <div className="p-3 bg-blue-50/50 border border-blue-200 rounded-lg space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-blue-900">
                    <span className="flex items-center gap-1.5">
                      <Truck className="w-3.5 h-3.5 text-blue-700" />
                      Active Field Allocations ({selectedProduct.stockOnJob} {selectedProduct.unit || "units"} issued)
                    </span>
                    <span className="text-[11px] font-normal text-blue-800">
                      Currently deployed on {selectedProduct.jobAllocations.length} active work orders
                    </span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                    {selectedProduct.jobAllocations.map((alloc: any, idx: number) => (
                      <div key={idx} className="p-2 bg-white rounded border border-blue-200/80 flex items-center justify-between">
                        <div>
                          <div className="font-mono font-bold text-[#18181B]">{alloc.jobNumber}</div>
                          <div className="text-[11px] text-[#71717A]">{alloc.customerName} • Tech: <span className="text-[#18181B] font-medium">{alloc.technicianName}</span></div>
                        </div>
                        <div className="text-right">
                          <span className="font-mono font-bold text-blue-700 text-xs">
                            {alloc.quantity} {selectedProduct.unit || "unit"}
                          </span>
                          <span className="block text-[10px] text-[#71717A]">{alloc.jobStatus}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Ledger Entries Table */}
              {(() => {
                const entries = selectedProduct.stockEntries || selectedProduct.movements || [];
                if (entries.length === 0) {
                  return (
                    <p className="text-xs text-[#71717A] py-4 text-center">No movements recorded yet.</p>
                  );
                }

                return (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-[#E4E4E7] text-[11px] font-semibold text-[#71717A] uppercase tracking-wider bg-[#F4F4F5]">
                          <th className="py-2.5 px-3">Date</th>
                          <th className="py-2.5 px-3">Type</th>
                          <th className="py-2.5 px-3">Direction</th>
                          <th className="py-2.5 px-3">Reference / Notes</th>
                          <th className="py-2.5 px-3 text-right">Quantity</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#E4E4E7]">
                        {entries.map((m: any) => {
                          const isPositive = m.direction === "in" || m.quantity > 0 || m.refType === "opening_stock";
                          const qty = m.qty ?? m.quantity ?? 0;
                          return (
                            <tr key={m.id} className="hover:bg-[#FAFAFA]">
                              <td className="py-2.5 px-3 font-mono text-[#71717A]">
                                {formatDateTime(m.createdAt)}
                              </td>
                              <td className="py-2.5 px-3 font-bold capitalize text-[#18181B]">
                                <span className="inline-flex items-center gap-1">
                                  {m.refType === "opening_stock" && <FileSpreadsheet className="w-3 h-3 text-emerald-600" />}
                                  {m.refType || m.type || "Movement"}
                                </span>
                              </td>
                              <td className="py-2.5 px-3">
                                <span
                                  className={`px-1.5 py-0.2 text-[10px] font-bold rounded uppercase ${
                                    isPositive ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"
                                  }`}
                                >
                                  {m.direction || (isPositive ? "IN" : "OUT")}
                                </span>
                              </td>
                              <td className="py-2.5 px-3 text-[#52525B]">{m.notes || m.reference || "—"}</td>
                              <td className="py-2.5 px-3 text-right font-mono font-bold">
                                <span className={isPositive ? "text-emerald-600" : "text-rose-600"}>
                                  {isPositive ? `+${qty}` : `-${qty}`}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: STOREKEEPER QUEUE */}
      {activeTab === "storekeeper" && (
        <div className="space-y-6">
          {/* Pending Technician Requests */}
          <div className="bg-white rounded-xl border border-[#E4E4E7] shadow-xs overflow-hidden">
            <div className="px-5 py-3.5 bg-[#FAFAFA] border-b border-[#E4E4E7]">
              <h3 className="text-xs font-bold text-[#18181B] uppercase tracking-wider">
                Field Technician Material Requests (Queue to Fulfill)
              </h3>
            </div>

            {techRequests.length === 0 ? (
              <p className="text-xs text-[#71717A] p-8 text-center">
                No open inventory requests from field technicians.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-[#E4E4E7] text-[11px] font-semibold text-[#71717A] uppercase tracking-wider bg-[#F4F4F5]">
                      <th className="py-2.5 px-4">Technician</th>
                      <th className="py-2.5 px-4">Requested Item</th>
                      <th className="py-2.5 px-4 text-center">Qty</th>
                      <th className="py-2.5 px-4">Job Reference</th>
                      <th className="py-2.5 px-4 text-center">Status</th>
                      <th className="py-2.5 px-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E4E4E7]">
                    {techRequests.map((req) => (
                      <tr key={req.id} className="hover:bg-[#FAFAFA]">
                        <td className="py-3 px-4 font-bold text-[#18181B]">{req.technician?.name}</td>
                        <td className="py-3 px-4 font-medium text-[#18181B]">{req.item}</td>
                        <td className="py-3 px-4 text-center font-mono font-bold">{req.qtyRequested}</td>
                        <td className="py-3 px-4 font-mono text-[#0D7A5F]">{req.job?.jobNumber || "—"}</td>
                        <td className="py-3 px-4 text-center"><StatusBadge status={req.status} /></td>
                        <td className="py-3 px-4 text-right">
                          {req.status === "Pending" ? (
                            <button
                              type="button"
                              onClick={() => handleFulfillRequest(req.id, req.item, req.qtyRequested)}
                              className="h-8 px-3 rounded-lg bg-[#0D7A5F] hover:bg-[#0A624C] text-white text-xs font-semibold inline-flex items-center gap-1.5 transition shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0D7A5F]"
                            >
                              <Package className="w-3.5 h-3.5" />
                              Issue & Deduct Stock
                            </button>
                          ) : (
                            <span className="text-xs text-emerald-700 font-semibold">✓ Issued</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Pending Technician Returns */}
          <div className="bg-white rounded-xl border border-[#E4E4E7] shadow-xs overflow-hidden">
            <div className="px-5 py-3.5 bg-[#FAFAFA] border-b border-[#E4E4E7]">
              <h3 className="text-xs font-bold text-[#18181B] uppercase tracking-wider">
                Field Material Returns (Awaiting Physical Verification)
              </h3>
            </div>

            {techReturns.length === 0 ? (
              <p className="text-xs text-[#71717A] p-8 text-center">
                No returned materials pending physical inspection.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-[#E4E4E7] text-[11px] font-semibold text-[#71717A] uppercase tracking-wider bg-[#F4F4F5]">
                      <th className="py-2.5 px-4">Technician</th>
                      <th className="py-2.5 px-4">Returned Item</th>
                      <th className="py-2.5 px-4 text-center">Qty Returned</th>
                      <th className="py-2.5 px-4">Job Reference</th>
                      <th className="py-2.5 px-4 text-center">Status</th>
                      <th className="py-2.5 px-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E4E4E7]">
                    {techReturns.map((ret) => (
                      <tr key={ret.id} className="hover:bg-[#FAFAFA]">
                        <td className="py-3 px-4 font-bold text-[#18181B]">{ret.technician?.name}</td>
                        <td className="py-3 px-4 font-medium text-[#18181B]">{ret.item}</td>
                        <td className="py-3 px-4 text-center font-mono font-bold">{ret.qtyReturned}</td>
                        <td className="py-3 px-4 font-mono text-[#0D7A5F]">{ret.job?.jobNumber || "—"}</td>
                        <td className="py-3 px-4 text-center"><StatusBadge status={ret.status} /></td>
                        <td className="py-3 px-4 text-right">
                          {ret.status === "Pending" ? (
                            <button
                              type="button"
                              onClick={() => handleAcknowledgeReturn(ret.id)}
                              className="h-8 px-3 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold inline-flex items-center gap-1.5 transition shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0D7A5F]"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                              Acknowledge & Restock
                            </button>
                          ) : (
                            <span className="text-xs text-emerald-700 font-semibold">✓ Restocked</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}



      {/* TAB 5: BRANCHES & MULTI-MOVEMENT HUB */}
      {activeTab === "branches" && (
        <div className="space-y-6">
          {/* Branch Overview Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              {
                name: "Central Warehouse (Lahore Hub)",
                city: "Lahore (HQ)",
                type: "Primary Distribution",
                units: totalWarehouseUnits,
                activeTransfers: 3,
                accent: "border-[#0D7A5F] bg-[#0D7A5F]/5",
                badge: "Hub Central",
              },
              {
                name: "Karachi Regional Depot",
                city: "Karachi (South)",
                type: "Regional Bin",
                units: Math.round(totalWarehouseUnits * 0.42),
                activeTransfers: 1,
                accent: "border-blue-200 bg-white",
                badge: "Active Depot",
              },
              {
                name: "Islamabad Regional Depot",
                city: "Islamabad (North)",
                type: "Regional Bin",
                units: Math.round(totalWarehouseUnits * 0.28),
                activeTransfers: 2,
                accent: "border-purple-200 bg-white",
                badge: "Active Depot",
              },
              {
                name: "Faisalabad Workshop & Spares",
                city: "Faisalabad",
                type: "Workshop Depot",
                units: Math.round(totalWarehouseUnits * 0.15),
                activeTransfers: 0,
                accent: "border-amber-200 bg-white",
                badge: "Workshop Center",
              },
            ].map((b, idx) => (
              <div
                key={idx}
                onClick={() => setSelectedBranch(b.name)}
                className={`p-4 rounded-xl border transition cursor-pointer shadow-xs ${
                  selectedBranch === b.name ? b.accent + " ring-2 ring-[#0D7A5F]" : "bg-white border-[#E4E4E7] hover:border-slate-300"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#71717A]">
                    {b.city}
                  </span>
                  <span className="text-[9px] px-2 py-0.5 rounded-full font-bold bg-[#F4F4F5] text-[#18181B] font-mono">
                    {b.badge}
                  </span>
                </div>
                <div className="mt-2">
                  <h4 className="text-xs font-bold text-[#18181B] line-clamp-1">{b.name}</h4>
                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="text-xl font-bold font-mono text-[#18181B]">{b.units.toLocaleString()}</span>
                    <span className="text-[11px] text-[#71717A]">units on hand</span>
                  </div>
                  <div className="mt-1 text-[10px] text-[#0D7A5F] font-semibold">
                    {b.activeTransfers > 0 ? `📦 ${b.activeTransfers} inter-branch dispatches` : "All transfers clear"}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Movement Hub Navigation */}
          <div className="bg-white rounded-xl border border-[#E4E4E7] shadow-xs overflow-hidden">
            <div className="flex items-center border-b border-[#E4E4E7] px-4 overflow-x-auto bg-[#FAFAFA]">
              <button
                type="button"
                onClick={() => setActiveMovementSubTab("transfer")}
                className={`py-3 px-4 text-xs font-semibold inline-flex items-center gap-2 border-b-2 transition ${
                  activeMovementSubTab === "transfer"
                    ? "border-[#0D7A5F] text-[#0D7A5F]"
                    : "border-transparent text-[#71717A] hover:text-[#18181B]"
                }`}
              >
                <ArrowRightLeft className="w-3.5 h-3.5" />
                <span>Inter-Branch Stock Transfer</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveMovementSubTab("adjustment")}
                className={`py-3 px-4 text-xs font-semibold inline-flex items-center gap-2 border-b-2 transition ${
                  activeMovementSubTab === "adjustment"
                    ? "border-[#0D7A5F] text-[#0D7A5F]"
                    : "border-transparent text-[#71717A] hover:text-[#18181B]"
                }`}
              >
                <Scale className="w-3.5 h-3.5" />
                <span>Discrepancy Adjustments (+/-)</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveMovementSubTab("workshop")}
                className={`py-3 px-4 text-xs font-semibold inline-flex items-center gap-2 border-b-2 transition ${
                  activeMovementSubTab === "workshop"
                    ? "border-[#0D7A5F] text-[#0D7A5F]"
                    : "border-transparent text-[#71717A] hover:text-[#18181B]"
                }`}
              >
                <Wrench className="w-3.5 h-3.5" />
                <span>Internal Workshop Consumption</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveMovementSubTab("equipment")}
                className={`py-3 px-4 text-xs font-semibold inline-flex items-center gap-2 border-b-2 transition ${
                  activeMovementSubTab === "equipment"
                    ? "border-[#0D7A5F] text-[#0D7A5F]"
                    : "border-transparent text-[#71717A] hover:text-[#18181B]"
                }`}
              >
                <Package className="w-3.5 h-3.5" />
                <span>Heavy Equipment & Vacuum Pump Tool-Crib ({equipmentList.length})</span>
              </button>
            </div>

            {/* SUB-VIEW 1: INTER-BRANCH STOCK TRANSFER */}
            {activeMovementSubTab === "transfer" && (
              <div className="p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
                <form onSubmit={handleBranchTransfer} className="lg:col-span-1 space-y-4 p-4 rounded-xl border border-slate-200 bg-slate-50/50">
                  <div className="flex items-center gap-2 text-xs font-bold text-[#18181B] pb-2 border-b border-slate-200">
                    <ArrowRightLeft className="w-4 h-4 text-[#0D7A5F]" />
                    Dispatch Stock to Another Branch
                  </div>

                  <div>
                    <label className="block text-[11px] font-mono text-[#71717A] mb-1">Source Branch (From) *</label>
                    <select
                      value={transferFromBranch}
                      onChange={(e) => setTransferFromBranch(e.target.value)}
                      className="w-full bg-white border border-[#D4D4D8] rounded-lg px-3 py-2 text-xs text-[#18181B] outline-none"
                    >
                      <option value="Central Warehouse (Lahore Hub)">Central Warehouse (Lahore Hub)</option>
                      <option value="Karachi Regional Depot">Karachi Regional Depot</option>
                      <option value="Islamabad Regional Depot">Islamabad Regional Depot</option>
                      <option value="Faisalabad Workshop & Spares">Faisalabad Workshop & Spares</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-mono text-[#71717A] mb-1">Destination Branch (To) *</label>
                    <select
                      value={transferToBranch}
                      onChange={(e) => setTransferToBranch(e.target.value)}
                      className="w-full bg-white border border-[#D4D4D8] rounded-lg px-3 py-2 text-xs text-[#18181B] outline-none"
                    >
                      <option value="Karachi Regional Depot">Karachi Regional Depot</option>
                      <option value="Islamabad Regional Depot">Islamabad Regional Depot</option>
                      <option value="Faisalabad Workshop & Spares">Faisalabad Workshop & Spares</option>
                      <option value="Central Warehouse (Lahore Hub)">Central Warehouse (Lahore Hub)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-mono text-[#71717A] mb-1">Select Item to Transfer *</label>
                    <select
                      value={transferProductId}
                      onChange={(e) => setTransferProductId(e.target.value)}
                      className="w-full bg-white border border-[#D4D4D8] rounded-lg px-3 py-2 text-xs text-[#18181B] outline-none"
                      required
                    >
                      <option value="">-- Choose Inventory Item --</option>
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.sku}) — Stock: {p.stockQuantity} {p.unit || "unit"}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-mono text-[#71717A] mb-1">Quantity *</label>
                      <input
                        type="number"
                        min="1"
                        required
                        value={transferQty}
                        onChange={(e) => setTransferQty(e.target.value)}
                        className="w-full bg-white border border-[#D4D4D8] rounded-lg px-3 py-1.5 text-xs text-[#18181B] font-mono font-bold"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-mono text-[#71717A] mb-1">Challan #</label>
                      <input
                        type="text"
                        placeholder="TRF-2026-X"
                        value={transferChallan}
                        onChange={(e) => setTransferChallan(e.target.value)}
                        className="w-full bg-white border border-[#D4D4D8] rounded-lg px-3 py-1.5 text-xs text-[#18181B] font-mono"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-mono text-[#71717A] mb-1">Transfer Notes & Vehicle Ref</label>
                    <input
                      type="text"
                      placeholder="e.g. Daewoo Express cargo bilty #9102"
                      value={transferNotes}
                      onChange={(e) => setTransferNotes(e.target.value)}
                      className="w-full bg-white border border-[#D4D4D8] rounded-lg px-3 py-1.5 text-xs text-[#18181B]"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmittingMovement || !transferProductId}
                    className="w-full py-2 bg-[#0D7A5F] hover:bg-[#0A624C] text-white text-xs font-bold rounded-lg shadow-xs transition disabled:opacity-50"
                  >
                    {isSubmittingMovement ? "Dispatching..." : "Dispatch Inter-Branch Transfer"}
                  </button>
                </form>

                <div className="lg:col-span-2 space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-[#E4E4E7]">
                    <h4 className="text-xs font-bold text-[#18181B] uppercase tracking-wider">
                      Recent Branch Movement Challans
                    </h4>
                    <span className="text-[11px] text-[#71717A]">
                      Tracking transfers between {selectedBranch} and regional depots
                    </span>
                  </div>

                  {branchMovements.filter((m) => m.refType === "branch_transfer").length === 0 ? (
                    <div className="p-8 text-center text-xs text-[#71717A] bg-[#FAFAFA] rounded-xl border border-dashed border-[#D4D4D8]">
                      No active inter-branch transfers recorded yet. Dispatch a new transfer on the left.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {branchMovements
                        .filter((m) => m.refType === "branch_transfer")
                        .map((m) => (
                          <div
                            key={m.id}
                            className="p-3 bg-white rounded-xl border border-[#E4E4E7] flex items-center justify-between hover:border-[#0D7A5F]/40 transition text-xs"
                          >
                            <div>
                              <div className="font-bold text-[#18181B]">{m.product?.name || "Inventory Item"}</div>
                              <div className="text-[11px] text-[#71717A]">{m.notes}</div>
                              <div className="text-[10px] font-mono text-[#A1A1AA] mt-0.5">
                                {formatDateTime(m.createdAt)}
                              </div>
                            </div>
                            <div className="text-right">
                              <span className="font-mono font-bold text-rose-600 block text-sm">
                                -{m.qty} {m.product?.unit || "units"}
                              </span>
                              <span className="text-[9px] px-2 py-0.5 rounded-full font-bold bg-blue-50 text-blue-700 border border-blue-200">
                                Dispatched
                              </span>
                            </div>
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* SUB-VIEW 2: DISCREPANCY ADJUSTMENTS */}
            {activeMovementSubTab === "adjustment" && (
              <div className="p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
                <form onSubmit={handleStockAdjustment} className="lg:col-span-1 space-y-4 p-4 rounded-xl border border-slate-200 bg-slate-50/50">
                  <div className="flex items-center gap-2 text-xs font-bold text-[#18181B] pb-2 border-b border-slate-200">
                    <Scale className="w-4 h-4 text-amber-600" />
                    Record Stock Audit Adjustment (+/-)
                  </div>

                  <div>
                    <label className="block text-[11px] font-mono text-[#71717A] mb-1">Adjustment Type *</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setAdjustType("increase")}
                        className={`py-2 px-3 rounded-lg border text-xs font-bold transition ${
                          adjustType === "increase"
                            ? "bg-emerald-50 border-emerald-500 text-emerald-700 shadow-2xs"
                            : "bg-white border-[#D4D4D8] text-[#71717A]"
                        }`}
                      >
                        + Stock Surplus
                      </button>
                      <button
                        type="button"
                        onClick={() => setAdjustType("decrease")}
                        className={`py-2 px-3 rounded-lg border text-xs font-bold transition ${
                          adjustType === "decrease"
                            ? "bg-rose-50 border-rose-500 text-rose-700 shadow-2xs"
                            : "bg-white border-[#D4D4D8] text-[#71717A]"
                        }`}
                      >
                        - Stock Loss / Deficit
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-mono text-[#71717A] mb-1">Select Item *</label>
                    <select
                      value={adjustProductId}
                      onChange={(e) => setAdjustProductId(e.target.value)}
                      className="w-full bg-white border border-[#D4D4D8] rounded-lg px-3 py-2 text-xs text-[#18181B] outline-none"
                      required
                    >
                      <option value="">-- Choose Item to Adjust --</option>
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.sku}) — Current: {p.stockQuantity} {p.unit || "unit"}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-mono text-[#71717A] mb-1">Quantity Variance *</label>
                    <input
                      type="number"
                      min="1"
                      required
                      value={adjustQty}
                      onChange={(e) => setAdjustQty(e.target.value)}
                      className="w-full bg-white border border-[#D4D4D8] rounded-lg px-3 py-1.5 text-xs text-[#18181B] font-mono font-bold"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-mono text-[#71717A] mb-1">Audit Discrepancy Reason *</label>
                    <select
                      value={adjustReason}
                      onChange={(e) => setAdjustReason(e.target.value)}
                      className="w-full bg-white border border-[#D4D4D8] rounded-lg px-3 py-2 text-xs text-[#18181B] outline-none"
                    >
                      <option value="Audit Physical Variance">Audit Physical Variance (Periodic Stock-Count)</option>
                      <option value="Damaged in Warehouse Handling">Damaged in Warehouse Handling</option>
                      <option value="Refrigerant Gas Cylinder Leakage">Refrigerant Gas Cylinder Leakage / Seal Vent</option>
                      <option value="Expired Chemicals or Vacuum Oil">Expired Chemicals or Vacuum Oil</option>
                      <option value="Incorrect Goods Inward Entry Correction">Inward Receipt Count Correction</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-mono text-[#71717A] mb-1">Auditor / Manager Notes</label>
                    <input
                      type="text"
                      placeholder="e.g. Approved by Warehouse Supervisor Qasim"
                      value={adjustNotes}
                      onChange={(e) => setAdjustNotes(e.target.value)}
                      className="w-full bg-white border border-[#D4D4D8] rounded-lg px-3 py-1.5 text-xs text-[#18181B]"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmittingMovement || !adjustProductId}
                    className="w-full py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-lg shadow-xs transition disabled:opacity-50"
                  >
                    {isSubmittingMovement ? "Recording..." : "Apply Audit Adjustment"}
                  </button>
                </form>

                <div className="lg:col-span-2 space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-[#E4E4E7]">
                    <h4 className="text-xs font-bold text-[#18181B] uppercase tracking-wider">
                      Audit Adjustment Logs & Write-offs
                    </h4>
                  </div>
                  {branchMovements.filter((m) => m.refType === "stock_adjustment").length === 0 ? (
                    <div className="p-8 text-center text-xs text-[#71717A] bg-[#FAFAFA] rounded-xl border border-dashed border-[#D4D4D8]">
                      No discrepancy adjustments logged for this period.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {branchMovements
                        .filter((m) => m.refType === "stock_adjustment")
                        .map((m) => (
                          <div
                            key={m.id}
                            className="p-3 bg-white rounded-xl border border-[#E4E4E7] flex items-center justify-between hover:border-amber-400 transition text-xs"
                          >
                            <div>
                              <div className="font-bold text-[#18181B]">{m.product?.name || "Stock Item"}</div>
                              <div className="text-[11px] text-[#71717A]">{m.notes}</div>
                              <div className="text-[10px] font-mono text-[#A1A1AA]">{formatDateTime(m.createdAt)}</div>
                            </div>
                            <div className="text-right font-mono font-bold text-sm">
                              <span className={m.direction === "in" ? "text-emerald-600" : "text-rose-600"}>
                                {m.direction === "in" ? `+${m.qty}` : `-${m.qty}`} {m.product?.unit || "unit"}
                              </span>
                            </div>
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* SUB-VIEW 3: WORKSHOP CONSUMPTION */}
            {activeMovementSubTab === "workshop" && (
              <div className="p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
                <form onSubmit={handleWorkshopConsumption} className="lg:col-span-1 space-y-4 p-4 rounded-xl border border-slate-200 bg-slate-50/50">
                  <div className="flex items-center gap-2 text-xs font-bold text-[#18181B] pb-2 border-b border-slate-200">
                    <Wrench className="w-4 h-4 text-[#0D7A5F]" />
                    Record In-House Workshop Consumption
                  </div>

                  <div>
                    <label className="block text-[11px] font-mono text-[#71717A] mb-1">Select Consumed Item *</label>
                    <select
                      value={workshopProductId}
                      onChange={(e) => setWorkshopProductId(e.target.value)}
                      className="w-full bg-white border border-[#D4D4D8] rounded-lg px-3 py-2 text-xs text-[#18181B] outline-none"
                      required
                    >
                      <option value="">-- Choose Consumed Material --</option>
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.sku}) — Available: {p.stockQuantity} {p.unit || "unit"}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-mono text-[#71717A] mb-1">Quantity Consumed *</label>
                    <input
                      type="number"
                      min="1"
                      required
                      value={workshopQty}
                      onChange={(e) => setWorkshopQty(e.target.value)}
                      className="w-full bg-white border border-[#D4D4D8] rounded-lg px-3 py-1.5 text-xs text-[#18181B] font-mono font-bold"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-mono text-[#71717A] mb-1">Workshop Unit / Bench *</label>
                    <select
                      value={workshopBench}
                      onChange={(e) => setWorkshopBench(e.target.value)}
                      className="w-full bg-white border border-[#D4D4D8] rounded-lg px-3 py-2 text-xs text-[#18181B] outline-none"
                    >
                      <option value="Compressor Test Bench & Brazing">Compressor Test Bench & Brazing</option>
                      <option value="PCB & Inverter Circuit Diagnostic Lab">PCB & Inverter Circuit Diagnostic Lab</option>
                      <option value="Motor Rewinding & Fan Balancing">Motor Rewinding & Fan Balancing</option>
                      <option value="AC Outdoor Coil Chemical Cleaning Wash">AC Outdoor Coil Chemical Cleaning Wash</option>
                      <option value="General Workshop Fleet Maintenance">General Workshop Fleet Maintenance</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-mono text-[#71717A] mb-1">Technician / Mechanic</label>
                    <input
                      type="text"
                      value={workshopTech}
                      onChange={(e) => setWorkshopTech(e.target.value)}
                      className="w-full bg-white border border-[#D4D4D8] rounded-lg px-3 py-1.5 text-xs text-[#18181B]"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-mono text-[#71717A] mb-1">Work Description / Unit Ref</label>
                    <input
                      type="text"
                      placeholder="e.g. Refurbishing Gree 2-Ton Inverter PCB"
                      value={workshopNotes}
                      onChange={(e) => setWorkshopNotes(e.target.value)}
                      className="w-full bg-white border border-[#D4D4D8] rounded-lg px-3 py-1.5 text-xs text-[#18181B]"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmittingMovement || !workshopProductId}
                    className="w-full py-2 bg-[#0D7A5F] hover:bg-[#0A624C] text-white text-xs font-bold rounded-lg shadow-xs transition disabled:opacity-50"
                  >
                    {isSubmittingMovement ? "Logging..." : "Log Internal Consumption"}
                  </button>
                </form>

                <div className="lg:col-span-2 space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-[#E4E4E7]">
                    <h4 className="text-xs font-bold text-[#18181B] uppercase tracking-wider">
                      Internal Maintenance & Bench Consumptions
                    </h4>
                  </div>
                  {branchMovements.filter((m) => m.refType === "workshop_consumption").length === 0 ? (
                    <div className="p-8 text-center text-xs text-[#71717A] bg-[#FAFAFA] rounded-xl border border-dashed border-[#D4D4D8]">
                      No internal workshop consumptions recorded yet.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {branchMovements
                        .filter((m) => m.refType === "workshop_consumption")
                        .map((m) => (
                          <div
                            key={m.id}
                            className="p-3 bg-white rounded-xl border border-[#E4E4E7] flex items-center justify-between hover:border-[#0D7A5F]/40 transition text-xs"
                          >
                            <div>
                              <div className="font-bold text-[#18181B]">{m.product?.name || "Materials"}</div>
                              <div className="text-[11px] text-[#71717A]">{m.notes}</div>
                              <div className="text-[10px] font-mono text-[#A1A1AA]">{formatDateTime(m.createdAt)}</div>
                            </div>
                            <div className="text-right">
                              <span className="font-mono font-bold text-rose-600 block text-sm">
                                -{m.qty} {m.product?.unit || "units"}
                              </span>
                              <span className="text-[9px] px-2 py-0.5 rounded-full font-bold bg-amber-50 text-amber-800 border border-amber-200">
                                In-House Internal
                              </span>
                            </div>
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* SUB-VIEW 4: HEAVY EQUIPMENT & VACUUM PUMP TOOL-CRIB */}
            {activeMovementSubTab === "equipment" && (
              <div className="p-6 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#E4E4E7]">
                  <div>
                    <h4 className="text-xs font-bold text-[#18181B] uppercase tracking-wider">
                      Physical Tool & Heavy Equipment Register
                    </h4>
                    <p className="text-[11px] text-[#71717A]">
                      Vacuum pumps, recovery units, digital manifolds, and oxy-acetylene torches issued to technicians
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-[#71717A]">
                      {equipmentList.filter((e) => e.status === "Assigned").length} in field •{" "}
                      {equipmentList.filter((e) => e.status === "In Storage").length} in storage
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {equipmentList.map((asset) => {
                    const isAssigned = asset.status === "Assigned";
                    const currentAssignment = asset.assignments?.[0];

                    return (
                      <div
                        key={asset.id}
                        className={`p-4 rounded-xl border transition shadow-xs flex flex-col justify-between ${
                          isAssigned
                            ? "bg-blue-50/30 border-blue-200"
                            : "bg-white border-[#E4E4E7]"
                        }`}
                      >
                        <div>
                          <div className="flex items-center justify-between">
                            <span className="font-mono font-bold text-xs text-[#0D7A5F]">{asset.tag}</span>
                            <span
                              className={`text-[10px] px-2 py-0.5 rounded-full font-bold font-mono ${
                                isAssigned
                                  ? "bg-blue-100 text-blue-800"
                                  : "bg-emerald-100 text-emerald-800"
                              }`}
                            >
                              {asset.status}
                            </span>
                          </div>
                          <h5 className="font-bold text-[#18181B] text-sm mt-1">{asset.name}</h5>
                          <span className="text-[11px] text-[#71717A] font-mono block">
                            Category: {asset.category}
                          </span>

                          {isAssigned && currentAssignment && (
                            <div className="mt-3 p-2.5 rounded-lg bg-blue-100/60 border border-blue-200/80 text-xs text-blue-950 space-y-1">
                              <div className="font-bold flex items-center justify-between">
                                <span>Checked Out To:</span>
                                <span className="font-mono">{currentAssignment.employee?.name || "Technician"}</span>
                              </div>
                              <div className="text-[11px] text-blue-800">
                                Date: {new Date(currentAssignment.assignedAt).toLocaleDateString()}
                              </div>
                              {currentAssignment.conditionNotes && (
                                <div className="text-[10px] text-blue-900 italic">
                                  &quot;{currentAssignment.conditionNotes}&quot;
                                </div>
                              )}
                            </div>
                          )}
                        </div>

                        <div className="pt-4 mt-3 border-t border-[#E4E4E7] flex items-center justify-end gap-2">
                          {isAssigned ? (
                            <button
                              type="button"
                              onClick={() => handleReturnEquipment(asset)}
                              className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition shadow-xs inline-flex items-center gap-1.5"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" /> Return to Tool-Crib
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setSelectedAssetForCheckout(asset)}
                              className="px-3 py-1.5 rounded-lg bg-[#0D7A5F] hover:bg-[#0A624C] text-white text-xs font-bold transition shadow-xs inline-flex items-center gap-1.5"
                            >
                              <Package className="w-3.5 h-3.5" /> Check Out to Tech
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* CHECKOUT EQUIPMENT SIDE DRAWER */}
          <SideDrawer
            isOpen={Boolean(selectedAssetForCheckout)}
            onClose={() => setSelectedAssetForCheckout(null)}
            width="max-w-md"
            title={
              <div className="flex items-center gap-2">
                <Package className="w-4 h-4 text-[#0D7A5F]" />
                <span>Issue Equipment to Field Tech</span>
              </div>
            }
            subtitle={
              selectedAssetForCheckout ? (
                <span className="font-mono">
                  {selectedAssetForCheckout.tag} — {selectedAssetForCheckout.name}
                </span>
              ) : undefined
            }
            bodyClassName="p-0 flex flex-col flex-1 overflow-hidden"
          >
            <form onSubmit={handleCheckoutEquipment} className="flex-1 overflow-y-auto p-6 space-y-4 text-xs">
              <div>
                <label className="block text-[11px] font-mono text-[#71717A] mb-1">
                  Assign to Technician *
                </label>
                <select
                  required
                  value={checkoutEmployeeId}
                  onChange={(e) => setCheckoutEmployeeId(e.target.value)}
                  className="w-full bg-white border border-[#D4D4D8] rounded-lg px-3 py-2 text-xs text-[#18181B] outline-none focus:ring-2 focus:ring-[#0D7A5F]"
                >
                  <option value="">-- Select Field Technician --</option>
                  {technicians.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.designation || "HVAC Tech"})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-mono text-[#71717A] mb-1">
                  Pre-Issue Inspection & Calibration Notes
                </label>
                <input
                  type="text"
                  value={checkoutNotes}
                  onChange={(e) => setCheckoutNotes(e.target.value)}
                  className="w-full bg-white border border-[#D4D4D8] rounded-lg px-3 py-2 text-xs text-[#18181B] focus:ring-2 focus:ring-[#0D7A5F] outline-none"
                  placeholder="e.g. Gauge calibrated, oil level ok"
                />
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-[#EDEDED]">
                <button
                  type="button"
                  onClick={() => setSelectedAssetForCheckout(null)}
                  className="px-4 py-2 rounded-lg border border-[#D4D4D8] text-xs text-[#71717A] font-semibold hover:bg-zinc-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingMovement || !checkoutEmployeeId}
                  className="px-5 py-2 rounded-lg bg-[#0D7A5F] hover:bg-[#0A624C] text-white text-xs font-bold shadow-xs transition disabled:opacity-50 inline-flex items-center gap-1.5"
                >
                  {isSubmittingMovement ? "Issuing..." : "Confirm Checkout"}
                </button>
              </div>
            </form>
          </SideDrawer>
        </div>
      )}



      {/* ADD STOCK / CREATE PRODUCT SIDE DRAWER */}
      <SideDrawer
        isOpen={showAddStockModal}
        onClose={() => setShowAddStockModal(false)}
        width="max-w-xl"
        customHeader={
          <div className="px-6 py-4.5 border-b border-[#E4E4E7] flex items-center justify-between bg-[#FAFAFA] shrink-0">
            <div className="flex items-center gap-2.5">
              <div
                className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                  stockModalTab === "new_service"
                    ? "bg-purple-100 text-purple-700"
                    : "bg-[#0D7A5F]/10 text-[#0D7A5F]"
                }`}
              >
                {stockModalTab === "new_service" ? (
                  <Wrench className="w-4 h-4" />
                ) : (
                  <Package className="w-4 h-4" />
                )}
              </div>
              <div>
                <h3 className="text-sm font-bold text-[#18181B]">
                  {stockModalTab === "restock"
                    ? "Add / Inward Stock"
                    : stockModalTab === "new_service"
                    ? "Register Predefined Service"
                    : "Register New Material / Spare Part"}
                </h3>
                <p className="text-[11px] text-[#71717A]">
                  {stockModalTab === "restock"
                    ? "Direct warehouse stock replenishment & automatic ledger posting"
                    : stockModalTab === "new_service"
                    ? "Define billable labor, chemical wash, inspection, or diagnostic packages"
                    : "Register physical parts, refrigerants, or equipment in warehouse catalog"}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowAddStockModal(false)}
              className="text-[#71717A] hover:text-[#18181B] p-1.5 rounded-lg hover:bg-[#F4F4F5] transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        }
        bodyClassName="p-0 flex flex-col flex-1 overflow-hidden"
      >

            {/* Sub-tab Navigation */}
            <div className="flex border-b border-[#E4E4E7] px-6 bg-white overflow-x-auto shrink-0">
              <button
                type="button"
                onClick={() => setStockModalTab("restock")}
                className={`py-3 px-3.5 text-xs font-semibold border-b-2 transition whitespace-nowrap ${
                  stockModalTab === "restock"
                    ? "border-[#0D7A5F] text-[#0D7A5F]"
                    : "border-transparent text-[#71717A] hover:text-[#18181B]"
                }`}
              >
                Restock Item
              </button>
              <button
                type="button"
                onClick={() => setStockModalTab("new_product")}
                className={`py-3 px-3.5 text-xs font-semibold border-b-2 transition whitespace-nowrap inline-flex items-center gap-1.5 ${
                  stockModalTab === "new_product"
                    ? "border-[#0D7A5F] text-[#0D7A5F]"
                    : "border-transparent text-[#71717A] hover:text-[#18181B]"
                }`}
              >
                <Package className="w-3.5 h-3.5" />
                + New Material
              </button>
              <button
                type="button"
                onClick={() => {
                  setStockModalTab("new_service");
                  if (!newServiceSku || newServiceSku === "SRV-") {
                    setNewServiceSku(generateServiceSku(products));
                  }
                }}
                className={`py-3 px-3.5 text-xs font-semibold border-b-2 transition whitespace-nowrap inline-flex items-center gap-1.5 ${
                  stockModalTab === "new_service"
                    ? "border-indigo-600 text-indigo-700"
                    : "border-transparent text-[#71717A] hover:text-indigo-600"
                }`}
              >
                <Wrench className="w-3.5 h-3.5" />
                + Predefined Service
              </button>
            </div>

            {/* Drawer Scrollable Body */}
            <div className="flex-1 overflow-y-auto">

            {/* TAB 1: RESTOCK EXISTING ITEM */}
            {stockModalTab === "restock" && (
              <form onSubmit={handleRestockSubmit} className="p-5 space-y-4">
                <div>
                  <label className="text-xs font-semibold text-[#18181B] block mb-1">
                    Select Product to Restock *
                  </label>
                  <select
                    value={restockProductId}
                    onChange={(e) => {
                      setRestockProductId(e.target.value);
                      const sel = products.find((p) => p.id === e.target.value);
                      if (sel) setRestockUnitCost(String(sel.costPrice || ""));
                    }}
                    className="w-full bg-[#FAFAFA] p-2.5 rounded-lg text-xs border border-[#D4D4D8] focus:ring-2 focus:ring-[#0D7A5F] focus:outline-none text-[#18181B] font-medium"
                    required
                  >
                    <option value="" disabled>-- Select a Product --</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.sku}) — Available: {p.stockQuantity} {p.unit || "units"}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-[#18181B] block mb-1">
                      Quantity to Add *
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={restockQuantity}
                      onChange={(e) => setRestockQuantity(e.target.value)}
                      className="w-full bg-[#FAFAFA] p-2 rounded-lg text-xs border border-[#D4D4D8] focus:ring-2 focus:ring-[#0D7A5F] focus:outline-none font-mono font-bold text-[#18181B]"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-[#18181B] block mb-1">
                      {isStorekeeper ? "Unit Cost (Masked)" : "Unit Cost (PKR)"}
                    </label>
                    {isStorekeeper ? (
                      <div className="w-full bg-amber-50/70 border border-amber-200 rounded-lg p-2 text-xs text-amber-800 font-mono">
                        Cost Masked for Storekeeper
                      </div>
                    ) : (
                      <input
                        type="number"
                        min="0"
                        value={restockUnitCost}
                        onChange={(e) => setRestockUnitCost(e.target.value)}
                        placeholder="e.g. 8500"
                        className="w-full bg-[#FAFAFA] p-2 rounded-lg text-xs border border-[#D4D4D8] focus:ring-2 focus:ring-[#0D7A5F] focus:outline-none font-mono font-bold text-[#18181B]"
                      />
                    )}
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-[#18181B] block mb-1">
                    Procurement Source / Vendor
                  </label>
                  <select
                    value={restockSource}
                    onChange={(e) => setRestockSource(e.target.value)}
                    className="w-full bg-[#FAFAFA] p-2 rounded-lg text-xs border border-[#D4D4D8] focus:ring-2 focus:ring-[#0D7A5F] focus:outline-none text-[#18181B]"
                  >
                    <option value="Local Wholesale Market (Karachi/Lahore)">Local Wholesale Market (Karachi/Lahore)</option>
                    <option value="Haier Official Distributor Pakistan">Haier Official Distributor Pakistan</option>
                    <option value="Gree / DWP Official Depot">Gree / DWP Official Depot</option>
                    <option value="Direct Cash Float Purchase">Direct Cash Float Purchase</option>
                    <option value="Physical Stock Audit Adjustment">Physical Stock Audit Adjustment</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-[#18181B] block mb-1">
                    Adjustment Notes / Memo
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Replenishment for peak summer AC rush"
                    value={restockNotes}
                    onChange={(e) => setRestockNotes(e.target.value)}
                    className="w-full bg-[#FAFAFA] p-2 rounded-lg text-xs border border-[#D4D4D8] focus:ring-2 focus:ring-[#0D7A5F] focus:outline-none text-[#18181B]"
                  />
                </div>

                {/* Stock Level Preview */}
                {(() => {
                  const sel = products.find((p) => p.id === restockProductId);
                  if (!sel) return null;
                  const currentQty = sel.stockQuantity;
                  const added = Number(restockQuantity) || 0;
                  const newQty = currentQty + added;
                  const totalCost = added * (Number(restockUnitCost) || sel.costPrice || 0);

                  return (
                    <div className="p-3 bg-[#F4F4F5] rounded-lg border border-[#E4E4E7] text-xs space-y-1">
                      <div className="flex justify-between font-medium text-[#71717A]">
                        <span>Current Stock:</span>
                        <span className="font-mono font-bold text-[#18181B]">{currentQty} {sel.unit || "units"}</span>
                      </div>
                      <div className="flex justify-between font-medium text-[#0D7A5F]">
                        <span>New Balance After Inward:</span>
                        <span className="font-mono font-bold">{newQty} {sel.unit || "units"}</span>
                      </div>
                      <div className="flex justify-between font-medium text-[#71717A] pt-1 border-t border-[#E4E4E7]">
                        <span>Total Inventory Asset Value Added:</span>
                        <span className="font-mono font-bold text-[#18181B]">{formatCurrency(totalCost)}</span>
                      </div>
                    </div>
                  );
                })()}

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#E4E4E7]">
                  <button
                    type="button"
                    onClick={() => setShowAddStockModal(false)}
                    className="px-3.5 py-1.5 text-xs text-[#71717A] hover:text-[#18181B] font-semibold rounded hover:bg-[#F4F4F5] transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingStock || !restockProductId}
                    className="px-4 py-2 bg-[#0D7A5F] hover:bg-[#0A624C] disabled:opacity-50 text-white rounded-lg text-xs font-bold transition shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0D7A5F]"
                  >
                    {isSubmittingStock ? "Saving..." : "Confirm & Inward Stock"}
                  </button>
                </div>
              </form>
            )}



            {/* TAB 3: CREATE NEW PRODUCT */}
            {stockModalTab === "new_product" && (
              <form onSubmit={handleCreateProductSubmit} className="p-5 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-[#18181B] block mb-1">
                      SKU / Item Code *
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. PCB-GREE-1.5T"
                      value={newProductSku}
                      onChange={(e) => setNewProductSku(e.target.value.toUpperCase())}
                      className="w-full bg-[#FAFAFA] p-2 rounded-lg text-xs border border-[#D4D4D8] focus:ring-2 focus:ring-[#0D7A5F] focus:outline-none font-mono font-bold uppercase"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-[#18181B] block mb-1">
                      Unit of Measure
                    </label>
                    <select
                      value={newProductUnit}
                      onChange={(e) => setNewProductUnit(e.target.value)}
                      className="w-full bg-[#FAFAFA] p-2 rounded-lg text-xs border border-[#D4D4D8] focus:ring-2 focus:ring-[#0D7A5F] focus:outline-none text-[#18181B]"
                    >
                      <option value="unit">unit (pcs)</option>
                      <option value="cylinder">cylinder</option>
                      <option value="meter">meter</option>
                      <option value="roll">roll</option>
                      <option value="pack">pack</option>
                      <option value="kg">kg</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-[#18181B] block mb-1">
                    Product / Part Name *
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Gree 1.5-Ton Inverter PCB Main Board"
                    value={newProductName}
                    onChange={(e) => setNewProductName(e.target.value)}
                    className="w-full bg-[#FAFAFA] p-2 rounded-lg text-xs border border-[#D4D4D8] focus:ring-2 focus:ring-[#0D7A5F] focus:outline-none font-medium"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-[#18181B] block mb-1">
                      Cost Price (PKR) *
                    </label>
                    <input
                      type="number"
                      min="0"
                      placeholder="e.g. 8500"
                      value={newProductCost}
                      onChange={(e) => setNewProductCost(e.target.value)}
                      className="w-full bg-[#FAFAFA] p-2 rounded-lg text-xs border border-[#D4D4D8] focus:ring-2 focus:ring-[#0D7A5F] focus:outline-none font-mono font-bold"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-[#18181B] block mb-1">
                      Selling Price (PKR) *
                    </label>
                    <input
                      type="number"
                      min="0"
                      placeholder="e.g. 14500"
                      value={newProductPrice}
                      onChange={(e) => setNewProductPrice(e.target.value)}
                      className="w-full bg-[#FAFAFA] p-2 rounded-lg text-xs border border-[#D4D4D8] focus:ring-2 focus:ring-[#0D7A5F] focus:outline-none font-mono font-bold"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-[#18181B] block mb-1">
                      Initial Opening Stock *
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={newProductQty}
                      onChange={(e) => setNewProductQty(e.target.value)}
                      className="w-full bg-[#FAFAFA] p-2 rounded-lg text-xs border border-[#D4D4D8] focus:ring-2 focus:ring-[#0D7A5F] focus:outline-none font-mono font-bold"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-[#18181B] block mb-1">
                      Low Stock Alert Threshold
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={newProductMinAlert}
                      onChange={(e) => setNewProductMinAlert(e.target.value)}
                      className="w-full bg-[#FAFAFA] p-2 rounded-lg text-xs border border-[#D4D4D8] focus:ring-2 focus:ring-[#0D7A5F] focus:outline-none font-mono"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#E4E4E7]">
                  <button
                    type="button"
                    onClick={() => setShowAddStockModal(false)}
                    className="px-3.5 py-1.5 text-xs text-[#71717A] hover:text-[#18181B] font-semibold rounded hover:bg-[#F4F4F5] transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingStock || !newProductSku || !newProductName}
                    className="px-4 py-2 bg-[#0D7A5F] hover:bg-[#0A624C] disabled:opacity-50 text-white rounded-lg text-xs font-bold transition shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0D7A5F]"
                  >
                    {isSubmittingStock ? "Creating..." : "Save & Add to Catalog"}
                  </button>
                </div>
              </form>
            )}

            {/* TAB 4: CREATE PREDEFINED SERVICE */}
            {stockModalTab === "new_service" && (
              <form onSubmit={handleCreateServiceSubmit} className="p-5 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-semibold text-[#18181B]">
                        Service Code / SKU *
                      </label>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[9px] text-purple-700 bg-purple-100/80 px-1.5 py-0.2 rounded font-bold uppercase tracking-wider border border-purple-200">
                          Auto
                        </span>
                        <button
                          type="button"
                          onClick={() => setNewServiceSku(generateServiceSku(products))}
                          className="text-[#71717A] hover:text-purple-700 transition p-0.5 rounded hover:bg-purple-100"
                          title="Regenerate Service Code"
                        >
                          <RefreshCw className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                    <input
                      type="text"
                      placeholder="e.g. SRV-001"
                      value={newServiceSku}
                      onChange={(e) => setNewServiceSku(e.target.value.toUpperCase())}
                      className="w-full bg-[#FAFAFA] p-2 rounded-lg text-xs border border-[#D4D4D8] focus:ring-2 focus:ring-indigo-500 focus:outline-none font-mono font-bold uppercase text-[#18181B]"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-[#18181B] block mb-1">
                      Cost (PKR) *
                    </label>
                    <input
                      type="number"
                      min="0"
                      placeholder="e.g. 3500"
                      value={newServiceCost}
                      onChange={(e) => setNewServiceCost(e.target.value)}
                      className="w-full bg-[#FAFAFA] p-2 rounded-lg text-xs border border-[#D4D4D8] focus:ring-2 focus:ring-indigo-500 focus:outline-none font-mono font-bold text-indigo-700"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-[#18181B] block mb-1">
                    Service Name & Title *
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Split AC Deep Jet Wash & Anti-Bacterial Treatment"
                    value={newServiceName}
                    onChange={(e) => setNewServiceName(e.target.value)}
                    className="w-full bg-[#FAFAFA] p-2 rounded-lg text-xs border border-[#D4D4D8] focus:ring-2 focus:ring-indigo-500 focus:outline-none font-medium text-[#18181B]"
                    required
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-[#18181B] block mb-1">
                    Scope / Description Notes
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Includes blower disassembly, high pressure water jet, chemical foam coil cleaning"
                    value={newServiceNotes}
                    onChange={(e) => setNewServiceNotes(e.target.value)}
                    className="w-full bg-[#FAFAFA] p-2 rounded-lg text-xs border border-[#D4D4D8] focus:ring-2 focus:ring-indigo-500 focus:outline-none text-[#18181B]"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#E4E4E7]">
                  <button
                    type="button"
                    onClick={() => setShowAddStockModal(false)}
                    className="px-3.5 py-1.5 text-xs text-[#71717A] hover:text-[#18181B] font-semibold rounded hover:bg-[#F4F4F5] transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingStock || !newServiceSku || !newServiceName}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold transition shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 inline-flex items-center gap-1.5"
                  >
                    <Wrench className="w-3.5 h-3.5" />
                    {isSubmittingStock ? "Saving..." : "Save Predefined Service"}
                  </button>
                </div>
              </form>
            )}
            </div>
      </SideDrawer>

      {/* QUICK EDIT SERVICE / PRODUCT RATE SIDE DRAWER */}
      <SideDrawer
        isOpen={Boolean(editingProduct)}
        onClose={() => setEditingProduct(null)}
        width="max-w-md"
        customHeader={
          <div className="px-6 py-4.5 border-b border-[#E4E4E7] flex items-center justify-between bg-purple-50/50 shrink-0">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center">
                <Pencil className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-[#18181B]">
                  {editingProduct && isServiceProduct(editingProduct) ? "Edit Service Cost" : "Edit Price & Cost"}
                </h3>
                <p className="text-[11px] text-[#71717A] font-mono truncate max-w-[220px]">
                  {editingProduct?.sku} • {editingProduct?.name}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setEditingProduct(null)}
              className="text-[#71717A] hover:text-[#18181B] p-1.5 rounded-lg hover:bg-[#F4F4F5] transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        }
        bodyClassName="p-0 flex flex-col flex-1 overflow-hidden"
      >
        {editingProduct && (
          <form onSubmit={handleQuickUpdateProduct} className="flex-1 overflow-y-auto p-6 space-y-4 text-xs">
            {isServiceProduct(editingProduct) ? (
              <div>
                <label className="font-semibold text-[#18181B] block mb-1">
                  Cost (PKR) *
                </label>
                <input
                  type="number"
                  min="0"
                  required
                  value={editPrice}
                  onChange={(e) => {
                    setEditPrice(e.target.value);
                    setEditCost(e.target.value);
                  }}
                  className="w-full bg-[#FAFAFA] p-2.5 rounded-lg border border-[#D4D4D8] font-mono font-bold text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none text-indigo-700"
                />
              </div>
            ) : (
              <>
                <div>
                  <label className="font-semibold text-[#18181B] block mb-1">
                    Customer Billable Rate (PKR) *
                  </label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={editPrice}
                    onChange={(e) => setEditPrice(e.target.value)}
                    className="w-full bg-[#FAFAFA] p-2.5 rounded-lg border border-[#D4D4D8] font-mono font-bold text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="font-semibold text-[#18181B] block mb-1">
                    Standard Labor / Base Cost (PKR)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={editCost}
                    onChange={(e) => setEditCost(e.target.value)}
                    className="w-full bg-[#FAFAFA] p-2.5 rounded-lg border border-[#D4D4D8] font-mono font-bold text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
              </>
            )}

            <div className="flex items-center justify-end gap-2 pt-4 border-t border-[#E4E4E7]">
              <button
                type="button"
                onClick={() => setEditingProduct(null)}
                className="px-3.5 py-1.5 text-xs text-[#71717A] hover:text-[#18181B] font-semibold rounded hover:bg-[#F4F4F5] transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isUpdatingProduct}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold transition shadow-xs"
              >
                {isUpdatingProduct ? "Saving..." : isServiceProduct(editingProduct) ? "Update Cost" : "Update Rate"}
              </button>
            </div>
          </form>
        )}
      </SideDrawer>

      {/* ACTIVE FIELD ALLOCATIONS (STOCK ON JOB) SIDE DRAWER */}
      <SideDrawer
        isOpen={Boolean(activeAllocationProduct)}
        onClose={() => setActiveAllocationProduct(null)}
        width="max-w-2xl"
        customHeader={
          <div className="px-6 py-4.5 border-b border-[#E4E4E7] flex items-center justify-between bg-[#FAFAFA] shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center">
                <Truck className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-[#18181B]">
                  Active Field Allocations: {activeAllocationProduct?.name}
                </h3>
                <p className="text-[11px] text-[#71717A]">
                  SKU: <span className="font-mono font-semibold">{activeAllocationProduct?.sku}</span> • Units issued to technicians on active service jobs
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setActiveAllocationProduct(null)}
              className="text-[#71717A] hover:text-[#18181B] p-1.5 rounded-lg hover:bg-[#F4F4F5] transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        }
        bodyClassName="p-0 flex flex-col flex-1 overflow-hidden"
      >

        {activeAllocationProduct && (
          <>
            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              {/* Summary Stats */}
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 bg-[#FAFAFA] rounded-lg border border-[#E4E4E7]">
                  <span className="text-[10px] font-semibold uppercase text-[#71717A] block">Warehouse Storage</span>
                  <span className="text-lg font-bold font-mono text-[#18181B]">
                    {activeAllocationProduct.stockQuantity} {activeAllocationProduct.unit || "unit"}
                  </span>
                </div>
                <div className="p-3 bg-blue-50/60 rounded-lg border border-blue-200">
                  <span className="text-[10px] font-semibold uppercase text-blue-800 block">Stock on Job (Field)</span>
                  <span className="text-lg font-bold font-mono text-blue-900">
                    {activeAllocationProduct.stockOnJob || 0} {activeAllocationProduct.unit || "unit"}
                  </span>
                </div>
                <div className="p-3 bg-[#FAFAFA] rounded-lg border border-[#E4E4E7]">
                  <span className="text-[10px] font-semibold uppercase text-[#71717A] block">Total Stock</span>
                  <span className="text-lg font-bold font-mono text-[#18181B]">
                    {(activeAllocationProduct.stockQuantity || 0) + (activeAllocationProduct.stockOnJob || 0)} {activeAllocationProduct.unit || "unit"}
                  </span>
                </div>
              </div>

              {/* Allocations Table */}
              <div>
                <h4 className="text-xs font-bold text-[#18181B] uppercase tracking-wider mb-2">
                  Active Work Order Deployments
                </h4>
                {(!activeAllocationProduct.jobAllocations || activeAllocationProduct.jobAllocations.length === 0) ? (
                  <p className="text-xs text-[#71717A] py-8 text-center border rounded-lg border-dashed">
                    No active job allocations found. All units are currently in physical warehouse storage.
                  </p>
                ) : (
                  <div className="border border-[#E4E4E7] rounded-lg overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-[#F4F4F5] border-b border-[#E4E4E7] text-[11px] font-semibold text-[#71717A] uppercase">
                        <tr>
                          <th className="py-2.5 px-3">Job #</th>
                          <th className="py-2.5 px-3">Customer</th>
                          <th className="py-2.5 px-3">Technician</th>
                          <th className="py-2.5 px-3 text-center">Status</th>
                          <th className="py-2.5 px-3 text-right">Qty Issued</th>
                          <th className="py-2.5 px-3 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#E4E4E7]">
                        {activeAllocationProduct.jobAllocations.map((alloc: any, idx: number) => (
                          <tr key={idx} className="hover:bg-[#FAFAFA]">
                            <td className="py-2.5 px-3 font-mono font-bold text-[#18181B]">
                              {alloc.jobNumber}
                            </td>
                            <td className="py-2.5 px-3 text-[#18181B]">{alloc.customerName}</td>
                            <td className="py-2.5 px-3 font-medium text-[#18181B]">{alloc.technicianName}</td>
                            <td className="py-2.5 px-3 text-center">
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-zinc-100 text-zinc-800 border border-zinc-200">
                                {alloc.jobStatus}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono font-bold text-blue-700">
                              {alloc.quantity} {activeAllocationProduct.unit || "unit"}
                            </td>
                            <td className="py-2.5 px-3 text-right">
                              <a
                                href={`/jobs?jobId=${alloc.jobId}`}
                                className="text-[11px] font-semibold text-[#0D7A5F] hover:underline inline-flex items-center gap-1"
                              >
                                View Job
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            <div className="px-6 py-3.5 bg-[#FAFAFA] border-t border-[#E4E4E7] flex justify-end shrink-0">
              <button
                type="button"
                onClick={() => setActiveAllocationProduct(null)}
                className="px-5 py-2 bg-white border border-[#D4D4D8] hover:bg-[#F4F4F5] rounded-lg text-xs font-semibold text-[#18181B] transition shadow-2xs"
              >
                Close
              </button>
            </div>
          </>
        )}
      </SideDrawer>
    </div>
  );
}
