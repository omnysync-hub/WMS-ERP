"use client";

import React, { useEffect, useState } from "react";
import PageHeader from "@/components/layout/PageHeader";
import StatusBadge from "@/components/ui/StatusBadge";
import { formatCurrency, formatDateTime } from "@/lib/utils";
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
} from "lucide-react";
import { realtimeSync } from "@/lib/realtimeSync";
import { useRole } from "@/contexts/RoleContext";

export default function InventoryPurchasingPage() {
  const { currentRole } = useRole();
  const isStorekeeper = currentRole === "storekeeper";

  const [activeTab, setActiveTab] = useState<"stock" | "storekeeper" | "purchasing" | "pos" | "branches">("stock");

  const [products, setProducts] = useState<any[]>([]);
  const [techRequests, setTechRequests] = useState<any[]>([]);
  const [techReturns, setTechReturns] = useState<any[]>([]);
  const [purchasingData, setPurchasingData] = useState<{ prs: any[]; pos: any[]; grns: any[] }>({
    prs: [],
    pos: [],
    grns: [],
  });

  // Selected product movement timeline
  const [selectedProduct, setSelectedProduct] = useState<any>(null);

  // POS State
  const [posCart, setPosCart] = useState<{ product: any; quantity: number }[]>([]);
  const [posSuccessMsg, setPosSuccessMsg] = useState("");
  const [isSubmittingPos, setIsSubmittingPos] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  // Stock Filter State & Allocations Modal
  const [stockFilter, setStockFilter] = useState<"all" | "field" | "low">("all");
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

  // PR Form
  const [showPrModal, setShowPrModal] = useState(false);
  const [prProductId, setPrProductId] = useState("");
  const [prQty, setPrQty] = useState("10");
  const [prNotes, setPrNotes] = useState("");

  // Add Stock & Product Creation State
  const [showAddStockModal, setShowAddStockModal] = useState(false);
  const [stockModalTab, setStockModalTab] = useState<"restock" | "opening_stock" | "new_product">("restock");
  const [restockProductId, setRestockProductId] = useState("");
  const [restockQuantity, setRestockQuantity] = useState("10");
  const [restockUnitCost, setRestockUnitCost] = useState("");
  const [restockSource, setRestockSource] = useState("Local Wholesale Market (Karachi/Lahore)");
  const [restockNotes, setRestockNotes] = useState("");
  const [isSubmittingStock, setIsSubmittingStock] = useState(false);

  // Opening Stock State
  const [openingProductId, setOpeningProductId] = useState("");
  const [openingQuantity, setOpeningQuantity] = useState("50");
  const [openingUnitCost, setOpeningUnitCost] = useState("");
  const [openingValuationDate, setOpeningValuationDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [openingNotes, setOpeningNotes] = useState("Fiscal Year Opening Stock Balance Declaration");
  const [isSubmittingOpeningStock, setIsSubmittingOpeningStock] = useState(false);

  const [newProductSku, setNewProductSku] = useState("");
  const [newProductName, setNewProductName] = useState("");
  const [newProductUnit, setNewProductUnit] = useState("unit");
  const [newProductCost, setNewProductCost] = useState("");
  const [newProductPrice, setNewProductPrice] = useState("");
  const [newProductQty, setNewProductQty] = useState("10");
  const [newProductMinAlert, setNewProductMinAlert] = useState("5");

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
      } else if (activeTab === "purchasing") {
        const res = await fetch("/api/inventory?view=purchasing");
        const data = await res.json();
        setPurchasingData(data);
      } else if (activeTab === "pos") {
        const res = await fetch("/api/inventory");
        const data = await res.json();
        if (Array.isArray(data)) setProducts(data);
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

  // Convert PR to PO
  const handleApprovePrToPo = async (pr: any) => {
    try {
      const res = await fetch("/api/inventory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create_po",
          prId: pr.id,
          supplierName: "Apex HVAC Wholesalers LLC",
          supplierEmail: "sales@apexhvac.ae",
          items: [{ productId: pr.productId, quantity: pr.quantity, unitCost: 45 }],
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error);
      }
      setNotification("PR approved! Purchase Order generated and sent to supplier.");
      loadData();
    } catch (e: any) {
      alert(e.message);
    }
  };

  // Receive GRN
  const handleReceiveGrn = async (po: any) => {
    try {
      const res = await fetch("/api/inventory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "receive_grn",
          poId: po.id,
          receivedBy: "Bilal Sheikh (Storekeeper)",
          items: po.items?.map((item: any) => ({
            productId: item.productId,
            qtyReceived: item.quantity,
          })) || [],
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error);
      }
      setNotification("GRN created! Stock received into warehouse and inventory balance updated.");
      loadData();
    } catch (e: any) {
      alert(e.message);
    }
  };

  // Raise PR
  const handleCreatePr = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/inventory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create_pr",
          productId: prProductId || products[0]?.id,
          quantity: Number(prQty) || 1,
          notes: prNotes,
          requestedBy: "Bilal Sheikh (Storekeeper)",
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error);
      }
      setShowPrModal(false);
      setNotification("Purchase Requisition raised successfully.");
      loadData();
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

  // Declare / Set Opening Stock
  const handleOpeningStockSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!openingProductId) return;
    try {
      setIsSubmittingOpeningStock(true);
      const res = await fetch("/api/inventory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "set_opening_stock",
          productId: openingProductId,
          quantity: Number(openingQuantity) || 1,
          unitCost: Number(openingUnitCost) || 0,
          openingDate: openingValuationDate,
          notes: openingNotes,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error);
      }
      setShowAddStockModal(false);
      const targetProduct = products.find((p) => p.id === openingProductId);
      setNotification(
        `Opening stock of ${openingQuantity} units declared for "${targetProduct?.name || "Product"}"! Posted Dr 1200 (Inventory Asset) / Cr 3000 (Owner Equity).`
      );
      loadData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsSubmittingOpeningStock(false);
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

  // POS Add to Cart
  const addToPosCart = (product: any) => {
    const existing = posCart.find((i) => i.product.id === product.id);
    if (existing) {
      setPosCart(
        posCart.map((i) =>
          i.product.id === product.id ? { ...i, quantity: i.quantity + 1 } : i
        )
      );
    } else {
      setPosCart([...posCart, { product, quantity: 1 }]);
    }
  };

  // POS Checkout
  const handlePosCheckout = async () => {
    if (posCart.length === 0) return;
    try {
      setIsSubmittingPos(true);
      const res = await fetch("/api/inventory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "pos_sale",
          customerName: "Walk-in Counter Customer",
          items: posCart.map((it) => ({
            productId: it.product.id,
            quantity: it.quantity,
            unitPrice: it.product.unitPrice,
          })),
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error);
      }
      const data = await res.json();
      setPosSuccessMsg(`Cash sale completed! Receipt #${data.invoiceNumber || "INV-POS"}`);
      setPosCart([]);
      loadData();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setIsSubmittingPos(false);
    }
  };

  const posTotal = posCart.reduce((sum, it) => sum + it.quantity * it.product.unitPrice, 0);

  const pendingStorekeeperCount =
    techRequests.filter((r) => r.status === "Pending").length +
    techReturns.filter((r) => r.status === "Pending").length;

  const lowStockCount = products.filter(
    (p) => p.stockQuantity <= (p.reorderPoint || 5)
  ).length;

  const totalWarehouseUnits = products.reduce((acc, p) => acc + (p.stockQuantity || 0), 0);
  const totalStockOnJobUnits = products.reduce((acc, p) => acc + (p.stockOnJob || 0), 0);
  const totalEnterpriseUnits = totalWarehouseUnits + totalStockOnJobUnits;
  const productsOnJobCount = products.filter((p) => (p.stockOnJob || 0) > 0).length;

  const filteredProducts = products.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.sku.toLowerCase().includes(searchTerm.toLowerCase());
    if (!matchesSearch) return false;

    if (stockFilter === "field") {
      return (p.stockOnJob || 0) > 0;
    }
    if (stockFilter === "low") {
      return p.stockQuantity <= (p.reorderPoint || 5);
    }
    return true;
  });

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

  const tabs = [
    { id: "stock", label: "Stock Levels", icon: <Package className="w-3.5 h-3.5" />, badge: lowStockCount > 0 ? `${lowStockCount} Low` : undefined },
    { id: "storekeeper", label: "Storekeeper Queue", icon: <Truck className="w-3.5 h-3.5" />, count: pendingStorekeeperCount },
    { id: "branches", label: "Branches & Movements", icon: <Building className="w-3.5 h-3.5" /> },
    { id: "purchasing", label: "Procurement (PR / PO / GRN)", icon: <FileText className="w-3.5 h-3.5" /> },
    { id: "pos", label: "Counter POS Terminal", icon: <ShoppingCart className="w-3.5 h-3.5" /> },
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Enterprise Page Header */}
      <PageHeader
        breadcrumbs={[{ label: "Purchasing & Inventory" }]}
        title="Purchasing & Inventory Management"
        subtitle="Warehouse stock tracking, storekeeper dispatch queue, PR/PO/GRN procurement, and OTC counter POS"
        actions={
          <div className="flex items-center gap-2">
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
              Add Stock / Restock
            </button>
            <button
              type="button"
              onClick={() => {
                if (products.length > 0 && !openingProductId) {
                  setOpeningProductId(products[0].id);
                  setOpeningUnitCost(String(products[0].costPrice || ""));
                }
                setStockModalTab("opening_stock");
                setShowAddStockModal(true);
              }}
              className="h-8 px-3 rounded-lg border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-xs font-semibold text-emerald-800 inline-flex items-center gap-1.5 transition shadow-xs focus-visible:outline-none"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-700" />
              Opening Stock
            </button>
            <button
              type="button"
              onClick={() => {
                setStockModalTab("new_product");
                setShowAddStockModal(true);
              }}
              className="h-8 px-3 rounded-lg border border-[#D4D4D8] hover:bg-[#F4F4F5] text-xs font-semibold text-[#18181B] inline-flex items-center gap-1.5 transition shadow-xs focus-visible:outline-none"
            >
              <Plus className="w-3.5 h-3.5 text-[#71717A]" />
              New Product
            </button>
            <button
              type="button"
              onClick={() => {
                if (products.length > 0 && !prProductId) setPrProductId(products[0].id);
                setShowPrModal(true);
              }}
              className="h-8 px-3 rounded-lg border border-[#D4D4D8] hover:bg-[#F4F4F5] text-xs font-semibold text-[#71717A] hover:text-[#18181B] inline-flex items-center gap-1.5 transition shadow-xs focus-visible:outline-none"
            >
              <FileText className="w-3.5 h-3.5 text-[#71717A]" />
              Raise PR
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-xl border border-[#E4E4E7] shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-[#71717A]">
                  Warehouse Available
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
              <p className="text-[11px] text-[#71717A] mt-1">Available for dispatch or counter sale</p>
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
                Issued to technicians across active work orders
              </p>
            </div>

            <div className="bg-white p-4 rounded-xl border border-[#E4E4E7] shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-[#71717A]">
                  Total Enterprise Stock
                </span>
                <div className="w-7 h-7 rounded-lg bg-purple-50 text-purple-700 flex items-center justify-center">
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
                <span className="text-xs text-[#71717A]">items below minimum</span>
              </div>
              <p className="text-[11px] text-[#71717A] mt-1">Require purchase requisition replenishment</p>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-[#E4E4E7] shadow-xs overflow-hidden">
            <div className="px-5 py-3.5 bg-[#FAFAFA] border-b border-[#E4E4E7] flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div>
                <h3 className="text-xs font-bold text-[#18181B] uppercase tracking-wider">
                  Enterprise Inventory & Field Allocations
                </h3>
                <p className="text-[11px] text-[#71717A] mt-0.5">
                  Live warehouse stock quantity, active field allocations on jobs, and opening stock valuations.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {/* Filter chips */}
                <div className="inline-flex rounded-lg p-0.5 bg-[#F4F4F5] border border-[#E4E4E7] text-xs">
                  <button
                    type="button"
                    onClick={() => setStockFilter("all")}
                    className={`px-2.5 py-1 rounded-md font-semibold transition ${
                      stockFilter === "all"
                        ? "bg-white text-[#18181B] shadow-2xs"
                        : "text-[#71717A] hover:text-[#18181B]"
                    }`}
                  >
                    All ({products.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setStockFilter("field")}
                    className={`px-2.5 py-1 rounded-md font-semibold inline-flex items-center gap-1 transition ${
                      stockFilter === "field"
                        ? "bg-blue-600 text-white shadow-2xs"
                        : "text-[#71717A] hover:text-blue-700"
                    }`}
                  >
                    <Truck className="w-3 h-3" />
                    On Job ({productsOnJobCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => setStockFilter("low")}
                    className={`px-2.5 py-1 rounded-md font-semibold inline-flex items-center gap-1 transition ${
                      stockFilter === "low"
                        ? "bg-amber-600 text-white shadow-2xs"
                        : "text-[#71717A] hover:text-amber-700"
                    }`}
                  >
                    <AlertTriangle className="w-3 h-3" />
                    Low Stock ({lowStockCount})
                  </button>
                </div>

                <div className="relative w-56">
                  <Search className="w-3.5 h-3.5 text-[#71717A] absolute left-2.5 top-2.5" />
                  <input
                    type="text"
                    placeholder="Search SKU or part name..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-[#D4D4D8] text-xs bg-white focus:outline-none focus:ring-2 focus:ring-[#0D7A5F]"
                  />
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-[#E4E4E7] text-[11px] font-semibold text-[#71717A] uppercase tracking-wider bg-[#F4F4F5]">
                    <th className="py-2.5 px-4">SKU / Code</th>
                    <th className="py-2.5 px-4">Item Name</th>
                    <th className="py-2.5 px-4 text-center">In Warehouse</th>
                    <th className="py-2.5 px-4 text-center">Stock on Job</th>
                    <th className="py-2.5 px-4 text-center">Total Stock</th>
                    <th className="py-2.5 px-4 text-center">Reorder Point</th>
                    <th className="py-2.5 px-4 text-right">
                      {isStorekeeper ? "Valuation" : "Unit Price"}
                    </th>
                    <th className="py-2.5 px-4 text-center">Status</th>
                    <th className="py-2.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E4E4E7]">
                  {filteredProducts.map((p) => {
                    const isLow = p.stockQuantity <= (p.reorderPoint || 5);
                    const isOut = p.stockQuantity <= 0;
                    const onJobQty = p.stockOnJob || 0;
                    const totalQty = (p.stockQuantity || 0) + onJobQty;

                    return (
                      <tr
                        key={p.id}
                        className={`transition hover:bg-[#FAFAFA] ${
                          isLow ? "bg-amber-50/20" : ""
                        }`}
                      >
                        <td className="py-3 px-4 font-mono font-bold text-[#18181B]">
                          {p.sku}
                        </td>
                        <td className="py-3 px-4 font-medium text-[#18181B]">
                          {p.name}
                        </td>
                        <td className="py-3 px-4 text-center font-mono font-bold">
                          <span
                            className={
                              isOut
                                ? "text-rose-600"
                                : isLow
                                ? "text-amber-600"
                                : "text-emerald-700"
                            }
                          >
                            {p.stockQuantity} <span className="text-[10px] font-normal text-[#71717A]">{p.unit || "unit"}</span>
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          {onJobQty > 0 ? (
                            <button
                              type="button"
                              onClick={() => setActiveAllocationProduct(p)}
                              className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 hover:border-blue-300 transition cursor-pointer"
                              title="Click to view technician allocations across active jobs"
                            >
                              <Truck className="w-3 h-3 text-blue-600 shrink-0" />
                              <span>{onJobQty} {p.unit || "units"}</span>
                              <span className="text-[9px] px-1 bg-blue-200/70 rounded-full font-mono text-blue-900 font-normal">
                                {p.jobAllocations?.length || 1} {p.jobAllocations?.length === 1 ? "job" : "jobs"}
                              </span>
                            </button>
                          ) : (
                            <span className="text-[#A1A1AA] text-xs font-mono">0 on job</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center font-mono font-bold text-[#18181B]">
                          {totalQty} <span className="text-[10px] font-normal text-[#71717A]">{p.unit || "unit"}</span>
                        </td>
                        <td className="py-3 px-4 text-center font-mono text-[#71717A]">
                          {p.reorderPoint || 5}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-[#18181B]">
                          {isStorekeeper ? (
                            <span className="text-[10px] text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                              Price Masked
                            </span>
                          ) : (
                            formatCurrency(p.unitPrice)
                          )}
                        </td>
                        <td className="py-3 px-4 text-center">
                          {isOut ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                              Out of Stock
                            </span>
                          ) : isLow ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                              Low Stock Warning
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                              Adequate Stock
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                setRestockProductId(p.id);
                                setRestockUnitCost(String(p.costPrice || ""));
                                setStockModalTab("restock");
                                setShowAddStockModal(true);
                              }}
                              className="text-[11px] font-semibold text-[#0D7A5F] hover:bg-[#0D7A5F]/10 px-2 py-0.5 rounded transition border border-[#0D7A5F]/30 focus-visible:outline-none inline-flex items-center gap-0.5"
                              title="Inward / Restock item"
                            >
                              <Plus className="w-3 h-3" />
                              Restock
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setOpeningProductId(p.id);
                                setOpeningUnitCost(String(p.costPrice || ""));
                                setStockModalTab("opening_stock");
                                setShowAddStockModal(true);
                              }}
                              className="text-[11px] font-semibold text-emerald-800 hover:bg-emerald-100 px-2 py-0.5 rounded transition border border-emerald-300 focus-visible:outline-none inline-flex items-center gap-0.5"
                              title="Set or audit opening stock"
                            >
                              <FileSpreadsheet className="w-3 h-3" />
                              Opening
                            </button>
                            <button
                              type="button"
                              onClick={() => handleViewTimeline(p.id)}
                              className="text-[11px] font-semibold text-[#71717A] hover:text-[#18181B] hover:underline focus-visible:outline-none"
                            >
                              Log
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
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

      {/* TAB 3: PURCHASING PIPELINE (PR -> PO -> GRN) */}
      {activeTab === "purchasing" && (
        <div className="space-y-6">
          {/* Purchase Requisitions */}
          <div className="bg-white rounded-xl border border-[#E4E4E7] shadow-xs overflow-hidden">
            <div className="px-5 py-3.5 bg-[#FAFAFA] border-b border-[#E4E4E7] flex items-center justify-between">
              <h3 className="text-xs font-bold text-[#18181B] uppercase tracking-wider">
                Stage 1: Purchase Requisitions (PR)
              </h3>
              <button
                type="button"
                onClick={() => setShowPrModal(true)}
                className="text-xs font-semibold text-[#0D7A5F] hover:underline"
              >
                + New PR
              </button>
            </div>

            <div className="divide-y divide-[#E4E4E7]">
              {purchasingData.prs.map((pr) => (
                <div key={pr.id} className="p-4 flex items-center justify-between hover:bg-[#FAFAFA]">
                  <div>
                    <span className="font-mono font-bold text-[#18181B]">{pr.prNumber}</span>
                    <p className="text-xs text-[#52525B] mt-0.5">
                      Requested: <span className="font-semibold text-[#18181B]">{pr.quantity}x {pr.product?.name}</span> by {pr.requestedBy}
                    </p>
                  </div>
                  {pr.status === "pending" ? (
                    <button
                      type="button"
                      onClick={() => handleApprovePrToPo(pr)}
                      className="h-8 px-3 rounded-lg bg-[#0D7A5F] hover:bg-[#0A624C] text-white text-xs font-semibold inline-flex items-center gap-1.5 transition shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0D7A5F]"
                    >
                      Approve & Convert to PO
                    </button>
                  ) : (
                    <span className="text-xs font-bold text-emerald-800 bg-emerald-100 px-3 py-1 rounded-full">
                      ✓ PO Issued
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Purchase Orders */}
          <div className="bg-white rounded-xl border border-[#E4E4E7] shadow-xs overflow-hidden">
            <div className="px-5 py-3.5 bg-[#FAFAFA] border-b border-[#E4E4E7]">
              <h3 className="text-xs font-bold text-[#18181B] uppercase tracking-wider">
                Stage 2: Purchase Orders (PO) & GRN Receipt
              </h3>
            </div>

            <div className="divide-y divide-[#E4E4E7]">
              {purchasingData.pos.map((po) => (
                <div key={po.id} className="p-4 flex items-center justify-between hover:bg-[#FAFAFA]">
                  <div>
                    <span className="font-mono font-bold text-[#18181B]">{po.poNumber}</span>
                    <p className="text-xs text-[#52525B] mt-0.5">
                      Supplier: <span className="font-semibold text-[#18181B]">{po.supplierName}</span>
                    </p>
                    <p className="text-xs font-mono font-bold text-[#0D7A5F] mt-0.5">
                      Total: {formatCurrency(po.totalAmount)}
                    </p>
                  </div>

                  {po.status === "issued" ? (
                    <button
                      type="button"
                      onClick={() => handleReceiveGrn(po)}
                      className="h-8 px-3 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold inline-flex items-center gap-1.5 transition shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0D7A5F]"
                    >
                      Receive Delivery & Generate GRN
                    </button>
                  ) : (
                    <span className="text-xs font-bold text-emerald-800 bg-emerald-100 px-3 py-1 rounded-full">
                      ✓ GRN Received
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: POINT OF SALE (POS) */}
      {activeTab === "pos" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Products grid */}
          <div className="lg:col-span-2 space-y-4">
            <h3 className="text-xs font-bold text-[#18181B] uppercase tracking-wider">
              Select HVAC Part / Service
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {products.map((p) => (
                <button
                  type="button"
                  key={p.id}
                  onClick={() => addToPosCart(p)}
                  className="bg-white rounded-xl border border-[#E4E4E7] p-4 text-left hover:border-[#0D7A5F] transition shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0D7A5F]"
                >
                  <p className="font-mono text-[11px] text-[#71717A]">{p.sku}</p>
                  <p className="font-bold text-[#18181B] text-xs mt-0.5">{p.name}</p>
                  <div className="flex items-center justify-between mt-3 pt-2 border-t border-[#E4E4E7]">
                    <span className="text-[11px] text-[#71717A]">
                      In Stock: {p.stockQuantity}
                    </span>
                    <span className="text-xs font-bold font-mono text-[#0D7A5F]">
                      {formatCurrency(p.unitPrice)}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Cart Checkout */}
          <div className="bg-white rounded-xl border border-[#E4E4E7] p-5 shadow-xs flex flex-col justify-between h-[520px]">
            <div>
              <h3 className="text-xs font-bold text-[#18181B] uppercase tracking-wider pb-3 border-b border-[#E4E4E7]">
                Point of Sale Cart
              </h3>

              {posSuccessMsg && (
                <div className="p-3 my-2 bg-emerald-50 text-emerald-900 rounded-lg text-xs font-semibold flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  {posSuccessMsg}
                </div>
              )}

              <div className="space-y-2 mt-3 max-h-72 overflow-y-auto">
                {posCart.length === 0 ? (
                  <p className="text-xs text-[#71717A] text-center py-12">
                    Cart is empty. Select any part on the left to add.
                  </p>
                ) : (
                  posCart.map((it) => (
                    <div
                      key={it.product.id}
                      className="flex items-center justify-between text-xs p-2.5 bg-[#FAFAFA] rounded-lg border border-[#E4E4E7]"
                    >
                      <div>
                        <p className="font-bold text-[#18181B]">{it.product.name}</p>
                        <p className="text-[11px] text-[#71717A] font-mono">
                          {it.quantity} x {formatCurrency(it.product.unitPrice)}
                        </p>
                      </div>
                      <span className="font-mono font-bold text-[#18181B]">
                        {formatCurrency(it.quantity * it.product.unitPrice)}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="pt-3 border-t border-[#E4E4E7] space-y-3">
              <div className="flex items-center justify-between text-sm font-bold text-[#18181B]">
                <span>Total Amount:</span>
                <span className="font-mono text-[#0D7A5F] text-base font-black">
                  {formatCurrency(posTotal)}
                </span>
              </div>
              <button
                type="button"
                onClick={handlePosCheckout}
                disabled={posCart.length === 0 || isSubmittingPos}
                className="w-full py-2.5 bg-[#0D7A5F] hover:bg-[#0A624C] disabled:bg-[#E4E4E7] disabled:text-[#A1A1AA] text-white rounded-lg text-xs font-bold shadow-xs transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0D7A5F]"
              >
                {isSubmittingPos ? "Processing Cash Sale..." : "Complete Cash POS Sale"}
              </button>
            </div>
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

          {/* CHECKOUT EQUIPMENT MODAL */}
          {selectedAssetForCheckout && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
              <div className="bg-white border border-[#EDEDED] rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150 text-[#18181B]">
                <div className="flex items-center justify-between px-5 py-4 border-b border-[#EDEDED] bg-[#F8FAFC]">
                  <div>
                    <h4 className="text-sm font-bold text-[#18181B] flex items-center gap-2">
                      <Package className="w-4 h-4 text-[#0D7A5F]" />
                      Issue Equipment to Field Tech
                    </h4>
                    <span className="text-[11px] text-[#71717A] font-mono">
                      {selectedAssetForCheckout.tag} — {selectedAssetForCheckout.name}
                    </span>
                  </div>
                  <button
                    onClick={() => setSelectedAssetForCheckout(null)}
                    className="text-[#71717A] hover:text-[#18181B] text-lg font-bold px-2 py-1"
                  >
                    ✕
                  </button>
                </div>

                <form onSubmit={handleCheckoutEquipment} className="p-5 space-y-4 text-xs">
                  <div>
                    <label className="block text-[11px] font-mono text-[#71717A] mb-1">
                      Assign to Technician *
                    </label>
                    <select
                      required
                      value={checkoutEmployeeId}
                      onChange={(e) => setCheckoutEmployeeId(e.target.value)}
                      className="w-full bg-white border border-[#D4D4D8] rounded-lg px-3 py-2 text-xs text-[#18181B] outline-none"
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
                      className="w-full bg-white border border-[#D4D4D8] rounded-lg px-3 py-1.5 text-xs text-[#18181B]"
                      placeholder="e.g. Gauge calibrated, oil level ok"
                    />
                  </div>

                  <div className="flex justify-end gap-2 pt-2 border-t border-[#EDEDED]">
                    <button
                      type="button"
                      onClick={() => setSelectedAssetForCheckout(null)}
                      className="px-4 py-1.5 rounded-lg border border-[#D4D4D8] text-xs text-[#71717A]"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmittingMovement || !checkoutEmployeeId}
                      className="px-4 py-1.5 rounded-lg bg-[#0D7A5F] hover:bg-[#0A624C] text-white text-xs font-bold shadow-xs transition disabled:opacity-50"
                    >
                      {isSubmittingMovement ? "Issuing..." : "Confirm Checkout"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* RAISE PR MODAL */}
      {showPrModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in duration-150"
          role="dialog"
          aria-modal="true"
          aria-labelledby="pr-dialog-title"
          onKeyDown={(e) => {
            if (e.key === "Escape") setShowPrModal(false);
          }}
        >
          <div className="bg-white rounded-xl max-w-sm w-full p-6 space-y-4 shadow-xl border border-[#E4E4E7]">
            <div className="flex items-center justify-between pb-2 border-b border-[#E4E4E7]">
              <h3 id="pr-dialog-title" className="text-sm font-bold text-[#18181B] flex items-center gap-2">
                <FileText className="w-4 h-4 text-[#0D7A5F]" />
                Raise Purchase Requisition (PR)
              </h3>
              <button
                type="button"
                onClick={() => setShowPrModal(false)}
                className="text-[#71717A] hover:text-[#18181B] p-1 rounded hover:bg-[#F4F4F5] transition"
                aria-label="Close dialog"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreatePr} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-[#71717A] block mb-1">
                  Product *
                </label>
                <select
                  value={prProductId}
                  onChange={(e) => setPrProductId(e.target.value)}
                  className="w-full bg-[#FAFAFA] p-2 rounded-lg text-xs border border-[#D4D4D8] focus:ring-2 focus:ring-[#0D7A5F] focus:outline-none text-[#18181B]"
                >
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.sku})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-[#71717A] block mb-1">
                  Quantity Required *
                </label>
                <input
                  type="number"
                  min="1"
                  value={prQty}
                  onChange={(e) => setPrQty(e.target.value)}
                  className="w-full bg-[#FAFAFA] p-2 rounded-lg text-xs border border-[#D4D4D8] focus:ring-2 focus:ring-[#0D7A5F] focus:outline-none font-mono font-bold"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-[#71717A] block mb-1">
                  Requisition Notes
                </label>
                <input
                  type="text"
                  placeholder="e.g. Stock below critical threshold"
                  value={prNotes}
                  onChange={(e) => setPrNotes(e.target.value)}
                  className="w-full bg-[#FAFAFA] p-2 rounded-lg text-xs border border-[#D4D4D8] focus:ring-2 focus:ring-[#0D7A5F] focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#E4E4E7]">
                <button
                  type="button"
                  onClick={() => setShowPrModal(false)}
                  className="px-3 py-1.5 text-xs text-[#71717A] hover:text-[#18181B] font-semibold rounded hover:bg-[#F4F4F5] transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#0D7A5F] hover:bg-[#0A624C] text-white rounded-lg text-xs font-bold transition shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0D7A5F]"
                >
                  Submit Requisition
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ADD STOCK / CREATE PRODUCT MODAL */}
      {showAddStockModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-lg w-full border border-[#E4E4E7] shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="px-5 py-4 border-b border-[#E4E4E7] flex items-center justify-between bg-[#FAFAFA]">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-[#0D7A5F]/10 flex items-center justify-center text-[#0D7A5F]">
                  <Package className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[#18181B]">
                    {stockModalTab === "restock"
                      ? "Add / Inward Stock"
                      : stockModalTab === "opening_stock"
                      ? "Opening Stock Declaration"
                      : "Create New Inventory Item"}
                  </h3>
                  <p className="text-[11px] text-[#71717A]">
                    {stockModalTab === "restock"
                      ? "Direct warehouse stock replenishment & automatic ledger posting"
                      : stockModalTab === "opening_stock"
                      ? "Establish verified opening balance & equity ledger (Dr 1200 / Cr 3000)"
                      : "Register a new HVAC product or spare part in the warehouse catalogue"}
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

            {/* Sub-tab Navigation */}
            <div className="flex border-b border-[#E4E4E7] px-5 bg-white">
              <button
                type="button"
                onClick={() => setStockModalTab("restock")}
                className={`py-2.5 px-3 text-xs font-semibold border-b-2 transition ${
                  stockModalTab === "restock"
                    ? "border-[#0D7A5F] text-[#0D7A5F]"
                    : "border-transparent text-[#71717A] hover:text-[#18181B]"
                }`}
              >
                Restock Existing Item
              </button>
              <button
                type="button"
                onClick={() => {
                  if (products.length > 0 && !openingProductId) {
                    setOpeningProductId(products[0].id);
                    setOpeningUnitCost(String(products[0].costPrice || ""));
                  }
                  setStockModalTab("opening_stock");
                }}
                className={`py-2.5 px-3 text-xs font-semibold border-b-2 transition inline-flex items-center gap-1.5 ${
                  stockModalTab === "opening_stock"
                    ? "border-[#0D7A5F] text-[#0D7A5F]"
                    : "border-transparent text-[#71717A] hover:text-[#18181B]"
                }`}
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                Opening Stock
              </button>
              <button
                type="button"
                onClick={() => setStockModalTab("new_product")}
                className={`py-2.5 px-3 text-xs font-semibold border-b-2 transition ${
                  stockModalTab === "new_product"
                    ? "border-[#0D7A5F] text-[#0D7A5F]"
                    : "border-transparent text-[#71717A] hover:text-[#18181B]"
                }`}
              >
                + Register New Product
              </button>
            </div>

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

            {/* TAB 2: OPENING STOCK DECLARATION */}
            {stockModalTab === "opening_stock" && (
              <form onSubmit={handleOpeningStockSubmit} className="p-5 space-y-4">
                <div className="p-3 bg-emerald-50/80 border border-emerald-200 rounded-lg text-emerald-950 text-xs flex items-start gap-2.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold block">Double-Entry Accounting Compliance</span>
                    <span className="text-[11px] text-emerald-800">
                      Opening stock establishes verified baseline inventory on the Balance Sheet. 
                      Posting directly debits <strong>Account 1200 (Inventory Asset)</strong> and credits <strong>Account 3000 (Owner Equity)</strong> without impacting P&L COGS.
                    </span>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-[#18181B] block mb-1">
                    Select Product *
                  </label>
                  <select
                    value={openingProductId || (products[0]?.id || "")}
                    onChange={(e) => {
                      setOpeningProductId(e.target.value);
                      const sel = products.find((p) => p.id === e.target.value);
                      if (sel) setOpeningUnitCost(String(sel.costPrice || ""));
                    }}
                    className="w-full bg-[#FAFAFA] p-2.5 rounded-lg text-xs border border-[#D4D4D8] focus:ring-2 focus:ring-[#0D7A5F] focus:outline-none text-[#18181B] font-medium"
                    required
                  >
                    <option value="" disabled>-- Select a Product --</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.sku}) — Available: {p.stockQuantity} {p.unit || "units"} (Current Cost: {formatCurrency(p.costPrice || 0)})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-[#18181B] block mb-1">
                      Opening Physical Quantity *
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={openingQuantity}
                      onChange={(e) => setOpeningQuantity(e.target.value)}
                      placeholder="e.g. 50"
                      className="w-full bg-[#FAFAFA] p-2 rounded-lg text-xs border border-[#D4D4D8] focus:ring-2 focus:ring-[#0D7A5F] focus:outline-none font-mono font-bold text-[#18181B]"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-[#18181B] block mb-1">
                      {isStorekeeper ? "Unit Cost (Masked)" : "Unit Cost (PKR) *"}
                    </label>
                    {isStorekeeper ? (
                      <div className="w-full bg-amber-50/70 border border-amber-200 rounded-lg p-2 text-xs text-amber-800 font-mono">
                        Valuation Masked for Storekeeper
                      </div>
                    ) : (
                      <input
                        type="number"
                        min="0"
                        value={openingUnitCost}
                        onChange={(e) => setOpeningUnitCost(e.target.value)}
                        placeholder="e.g. 8500"
                        className="w-full bg-[#FAFAFA] p-2 rounded-lg text-xs border border-[#D4D4D8] focus:ring-2 focus:ring-[#0D7A5F] focus:outline-none font-mono font-bold text-[#18181B]"
                        required
                      />
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-[#18181B] block mb-1">
                      Valuation / Effective Date
                    </label>
                    <input
                      type="date"
                      value={openingValuationDate}
                      onChange={(e) => setOpeningValuationDate(e.target.value)}
                      className="w-full bg-[#FAFAFA] p-2 rounded-lg text-xs border border-[#D4D4D8] focus:ring-2 focus:ring-[#0D7A5F] focus:outline-none text-[#18181B]"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-[#18181B] block mb-1">
                      Audit Notes / Memo
                    </label>
                    <input
                      type="text"
                      value={openingNotes}
                      onChange={(e) => setOpeningNotes(e.target.value)}
                      placeholder="e.g. FY 2026 Opening Count"
                      className="w-full bg-[#FAFAFA] p-2 rounded-lg text-xs border border-[#D4D4D8] focus:ring-2 focus:ring-[#0D7A5F] focus:outline-none text-[#18181B]"
                    />
                  </div>
                </div>

                {/* Journal Entry Impact Preview */}
                {(() => {
                  const qty = Number(openingQuantity) || 0;
                  const cost = Number(openingUnitCost) || 0;
                  const totalVal = qty * cost;
                  const sel = products.find((p) => p.id === (openingProductId || products[0]?.id));

                  return (
                    <div className="p-3.5 bg-[#F4F4F5] rounded-lg border border-[#E4E4E7] space-y-2 text-xs">
                      <div className="flex items-center justify-between text-[#71717A] text-[11px] font-semibold uppercase">
                        <span>Journal Entry Preview (Double-Entry)</span>
                        <span className="font-mono text-[#18181B]">Valuation: {formatCurrency(totalVal)}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-[11px]">
                        <div className="p-2 bg-white rounded border border-[#E4E4E7]">
                          <span className="text-[10px] text-emerald-700 font-bold uppercase block">Debit (Asset)</span>
                          <span className="font-medium text-[#18181B] block">1200 - Inventory Asset</span>
                          <span className="font-mono font-bold text-emerald-700">+{formatCurrency(totalVal)}</span>
                        </div>
                        <div className="p-2 bg-white rounded border border-[#E4E4E7]">
                          <span className="text-[10px] text-blue-700 font-bold uppercase block">Credit (Equity)</span>
                          <span className="font-medium text-[#18181B] block">3000 - Owner Capital / Equity</span>
                          <span className="font-mono font-bold text-blue-700">+{formatCurrency(totalVal)}</span>
                        </div>
                      </div>
                      {sel && (
                        <div className="text-[11px] text-[#71717A] flex justify-between pt-1 border-t border-[#E4E4E7]">
                          <span>Current Warehouse Stock: {sel.stockQuantity} {sel.unit || "unit"}</span>
                          <span>New Stock Balance: <strong className="text-[#18181B]">{sel.stockQuantity + qty} {sel.unit || "unit"}</strong></span>
                        </div>
                      )}
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
                    disabled={isSubmittingOpeningStock || !openingQuantity || Number(openingQuantity) <= 0}
                    className="px-4 py-2 bg-[#0D7A5F] hover:bg-[#0A624C] disabled:opacity-50 text-white rounded-lg text-xs font-bold transition shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0D7A5F] inline-flex items-center gap-1.5"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5" />
                    {isSubmittingOpeningStock ? "Posting..." : "Declare Opening Stock"}
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
          </div>
        </div>
      )}

      {/* ACTIVE FIELD ALLOCATIONS (STOCK ON JOB) MODAL */}
      {activeAllocationProduct && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white rounded-xl max-w-2xl w-full border border-[#E4E4E7] shadow-xl overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="px-5 py-4 border-b border-[#E4E4E7] flex items-center justify-between bg-[#FAFAFA]">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center">
                  <Truck className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[#18181B]">
                    Active Field Allocations: {activeAllocationProduct.name}
                  </h3>
                  <p className="text-[11px] text-[#71717A]">
                    SKU: <span className="font-mono font-semibold">{activeAllocationProduct.sku}</span> • Units issued to technicians on active service jobs
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

            <div className="p-5 space-y-4">
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
                  <p className="text-xs text-[#71717A] py-6 text-center border rounded-lg border-dashed">
                    No active job allocations found. All units are currently in physical warehouse storage.
                  </p>
                ) : (
                  <div className="border border-[#E4E4E7] rounded-lg overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-[#F4F4F5] border-b border-[#E4E4E7] text-[11px] font-semibold text-[#71717A] uppercase">
                        <tr>
                          <th className="py-2 px-3">Job #</th>
                          <th className="py-2 px-3">Customer</th>
                          <th className="py-2 px-3">Technician</th>
                          <th className="py-2 px-3 text-center">Status</th>
                          <th className="py-2 px-3 text-right">Qty Issued</th>
                          <th className="py-2 px-3 text-right">Action</th>
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

            <div className="px-5 py-3 bg-[#FAFAFA] border-t border-[#E4E4E7] flex justify-end">
              <button
                type="button"
                onClick={() => setActiveAllocationProduct(null)}
                className="px-4 py-1.5 bg-white border border-[#D4D4D8] hover:bg-[#F4F4F5] rounded-lg text-xs font-semibold text-[#18181B] transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
