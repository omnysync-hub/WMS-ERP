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
} from "lucide-react";
import { realtimeSync } from "@/lib/realtimeSync";

export default function InventoryPurchasingPage() {
  const [activeTab, setActiveTab] = useState<"stock" | "storekeeper" | "purchasing" | "pos">("stock");

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

  // PR Form
  const [showPrModal, setShowPrModal] = useState(false);
  const [prProductId, setPrProductId] = useState("");
  const [prQty, setPrQty] = useState("10");
  const [prNotes, setPrNotes] = useState("");

  // Add Stock & Product Creation State
  const [showAddStockModal, setShowAddStockModal] = useState(false);
  const [stockModalTab, setStockModalTab] = useState<"restock" | "new_product">("restock");
  const [restockProductId, setRestockProductId] = useState("");
  const [restockQuantity, setRestockQuantity] = useState("10");
  const [restockUnitCost, setRestockUnitCost] = useState("");
  const [restockSource, setRestockSource] = useState("Local Wholesale Market (Karachi/Lahore)");
  const [restockNotes, setRestockNotes] = useState("");
  const [isSubmittingStock, setIsSubmittingStock] = useState(false);

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

  const filteredProducts = products.filter((p) =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.sku.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const tabs = [
    { id: "stock", label: "Stock Levels", icon: <Package className="w-3.5 h-3.5" />, badge: lowStockCount > 0 ? `${lowStockCount} Low` : undefined },
    { id: "storekeeper", label: "Storekeeper Queue", icon: <Truck className="w-3.5 h-3.5" />, count: pendingStorekeeperCount },
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
          <div className="bg-white rounded-xl border border-[#E4E4E7] shadow-xs overflow-hidden">
            <div className="px-5 py-3.5 bg-[#FAFAFA] border-b border-[#E4E4E7] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-xs font-bold text-[#18181B] uppercase tracking-wider">
                  Warehouse Stock Inventory
                </h3>
                <p className="text-[11px] text-[#71717A] mt-0.5">
                  Live stock quantity, reorder alerts, and physical warehouse valuation.
                </p>
              </div>

              <div className="relative w-64">
                <Search className="w-3.5 h-3.5 text-[#71717A] absolute left-2.5 top-2.5" />
                <input
                  type="text"
                  placeholder="Filter by SKU or part name..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-[#D4D4D8] text-xs bg-white focus:outline-none focus:ring-2 focus:ring-[#0D7A5F]"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-[#E4E4E7] text-[11px] font-semibold text-[#71717A] uppercase tracking-wider bg-[#F4F4F5]">
                    <th className="py-2.5 px-4">SKU / Code</th>
                    <th className="py-2.5 px-4">Item Name</th>
                    <th className="py-2.5 px-4 text-center">In Stock</th>
                    <th className="py-2.5 px-4 text-center">Reorder Point</th>
                    <th className="py-2.5 px-4 text-right">Unit Price</th>
                    <th className="py-2.5 px-4 text-center">Status</th>
                    <th className="py-2.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E4E4E7]">
                  {filteredProducts.map((p) => {
                    const isLow = p.stockQuantity <= (p.reorderPoint || 5);
                    const isOut = p.stockQuantity <= 0;

                    return (
                      <tr
                        key={p.id}
                        className={`transition hover:bg-[#FAFAFA] ${
                          isLow ? "bg-amber-50/30" : ""
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
                            {p.stockQuantity}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center font-mono text-[#71717A]">
                          {p.reorderPoint || 5}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-[#18181B]">
                          {formatCurrency(p.unitPrice)}
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
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setRestockProductId(p.id);
                                setRestockUnitCost(String(p.costPrice || ""));
                                setStockModalTab("restock");
                                setShowAddStockModal(true);
                              }}
                              className="text-[11px] font-semibold text-[#0D7A5F] hover:bg-[#0D7A5F]/10 px-2 py-0.5 rounded transition border border-[#0D7A5F]/30 focus-visible:outline-none inline-flex items-center gap-1"
                            >
                              <Plus className="w-3 h-3" />
                              Add Stock
                            </button>
                            <button
                              type="button"
                              onClick={() => handleViewTimeline(p.id)}
                              className="text-[11px] font-semibold text-[#71717A] hover:text-[#18181B] hover:underline focus-visible:outline-none"
                            >
                              Movements
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

          {/* Product Movement Timeline */}
          {selectedProduct && (
            <div className="bg-white rounded-xl border border-[#E4E4E7] shadow-xs p-5 space-y-4 animate-in fade-in">
              <div className="flex items-center justify-between pb-3 border-b border-[#E4E4E7]">
                <div>
                  <h3 className="text-xs font-bold text-[#18181B] uppercase tracking-wider">
                    Stock Audit Log: {selectedProduct.name} ({selectedProduct.sku})
                  </h3>
                  <p className="text-[11px] text-[#71717A]">
                    Current Physical Balance: {selectedProduct.stockQuantity} units
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedProduct(null)}
                  className="text-xs text-[#0D7A5F] font-semibold hover:underline"
                >
                  Close Log
                </button>
              </div>

              {!selectedProduct.movements || selectedProduct.movements.length === 0 ? (
                <p className="text-xs text-[#71717A] py-4 text-center">No movements recorded yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-[#E4E4E7] text-[11px] font-semibold text-[#71717A] uppercase tracking-wider bg-[#F4F4F5]">
                        <th className="py-2.5 px-3">Date</th>
                        <th className="py-2.5 px-3">Type</th>
                        <th className="py-2.5 px-3">Reference / Notes</th>
                        <th className="py-2.5 px-3 text-right">Quantity</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E4E4E7]">
                      {selectedProduct.movements.map((m: any) => (
                        <tr key={m.id} className="hover:bg-[#FAFAFA]">
                          <td className="py-2.5 px-3 font-mono text-[#71717A]">
                            {formatDateTime(m.createdAt)}
                          </td>
                          <td className="py-2.5 px-3 font-bold capitalize text-[#18181B]">
                            {m.type}
                          </td>
                          <td className="py-2.5 px-3 text-[#52525B]">{m.reference || "—"}</td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold">
                            <span className={m.quantity > 0 ? "text-emerald-600" : "text-rose-600"}>
                              {m.quantity > 0 ? `+${m.quantity}` : m.quantity}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
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
                    {stockModalTab === "restock" ? "Add / Inward Stock" : "Create New Inventory Item"}
                  </h3>
                  <p className="text-[11px] text-[#71717A]">
                    {stockModalTab === "restock"
                      ? "Direct warehouse stock replenishment & automatic ledger posting"
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
                      Unit Cost (PKR)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={restockUnitCost}
                      onChange={(e) => setRestockUnitCost(e.target.value)}
                      placeholder="e.g. 8500"
                      className="w-full bg-[#FAFAFA] p-2 rounded-lg text-xs border border-[#D4D4D8] focus:ring-2 focus:ring-[#0D7A5F] focus:outline-none font-mono font-bold text-[#18181B]"
                    />
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

            {/* TAB 2: CREATE NEW PRODUCT */}
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
    </div>
  );
}
