"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import {
  ShoppingBag,
  Search,
  Plus,
  Minus,
  Trash2,
  CreditCard,
  Banknote,
  Building2,
  User,
  CheckCircle2,
  AlertCircle,
  Clock,
  Printer,
  RotateCcw,
  ArrowRight,
  ChevronRight,
  ShieldCheck,
  PauseCircle,
  PlayCircle,
  DollarSign,
  ArrowDownLeft,
  ArrowUpRight,
  X,
  FileText,
  SlidersHorizontal,
  Layers,
  Sparkles,
  ExternalLink,
} from "lucide-react";
import { cn, formatCurrency, formatDateTime } from "@/lib/utils";

interface ProductItem {
  id: string;
  sku: string;
  name: string;
  unit: string;
  unitPrice: number;
  costPrice: number;
  stockQuantity: number;
  reorderLevel: number;
}

interface CartItem {
  product: ProductItem;
  quantity: number;
  unitPrice: number;
  discount: number; // PKR flat discount on this line
}

interface HeldCart {
  id: string;
  heldAt: string;
  customerName: string;
  items: CartItem[];
  notes?: string;
}

export default function PosTerminalPage() {
  // Navigation & View Modes
  const [activeTab, setActiveTab] = useState<"terminal" | "history" | "shifts">("terminal");

  // Catalog & Data states
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [activeSession, setActiveSession] = useState<any>(null);
  const [recentSales, setRecentSales] = useState<any[]>([]);
  const [pastSessions, setPastSessions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("ALL");
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Active Cart State
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<{ name: string; phone: string }>({
    name: "Walk-in Customer",
    phone: "",
  });
  const [orderDiscountType, setOrderDiscountType] = useState<"fixed" | "percent">("fixed");
  const [orderDiscountValue, setOrderDiscountValue] = useState<number>(0);
  const [applyGstTax, setApplyGstTax] = useState(false); // 16% PRA GST
  const [orderNotes, setOrderNotes] = useState("");

  // Held Orders State
  const [heldCarts, setHeldCarts] = useState<HeldCart[]>([]);

  // Checkout Modal State
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "card" | "transfer" | "credit" | "split">("cash");
  const [amountTendered, setAmountTendered] = useState<string>("");
  const [splitCashAmount, setSplitCashAmount] = useState<string>("");
  const [splitCardAmount, setSplitCardAmount] = useState<string>("");
  const [cardApprovalRef, setCardApprovalRef] = useState<string>("");
  const [isSubmittingCheckout, setIsSubmittingCheckout] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  // Receipt Modal State
  const [completedSale, setCompletedSale] = useState<any>(null);
  const [showReceiptModal, setShowReceiptModal] = useState(false);

  // Shift & Register Modals State
  const [showOpenShiftModal, setShowOpenShiftModal] = useState(false);
  const [openingFloatInput, setOpeningFloatInput] = useState("5000");
  const [cashierNameInput, setCashierNameInput] = useState("Fatima Noor");
  const [showCloseShiftModal, setShowCloseShiftModal] = useState(false);
  const [countedCashInput, setCountedCashInput] = useState("");
  const [closeShiftNotes, setCloseShiftNotes] = useState("");
  const [zReportData, setZReportData] = useState<any>(null);
  const [showCashDropModal, setShowCashDropModal] = useState(false);
  const [dropType, setDropType] = useState<"cash_in" | "cash_out">("cash_out");
  const [dropAmount, setDropAmount] = useState("");
  const [dropReason, setDropReason] = useState("");
  const [shiftSubmitting, setShiftSubmitting] = useState(false);

  // 1. DATA LOADER
  const loadData = async () => {
    try {
      setIsLoading(true);
      const [posRes, registerRes] = await Promise.all([
        fetch("/api/pos?action=catalog"),
        fetch("/api/pos/register"),
      ]);

      const posData = await posRes.json();
      const regData = await registerRes.json();

      if (posData.success) {
        setProducts(posData.products || []);
        setCustomers(posData.customers || []);
        setRecentSales(posData.recentSales || []);
      }

      if (regData.success) {
        setActiveSession(regData.activeSession || null);
        setPastSessions(regData.pastSessions || []);
      }
    } catch (e) {
      console.error("Failed to load POS data:", e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Keyboard shortcut listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "F2") {
        e.preventDefault();
        searchInputRef.current?.focus();
      } else if (e.key === "F12" && cart.length > 0 && !showCheckoutModal && !showReceiptModal) {
        e.preventDefault();
        handleOpenCheckout();
      } else if (e.key === "Escape") {
        if (showReceiptModal) setShowReceiptModal(false);
        if (showCheckoutModal) setShowCheckoutModal(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [cart, showCheckoutModal, showReceiptModal]);

  // Product categories extraction
  const categories = useMemo(() => {
    return [
      "ALL",
      "HVAC Units",
      "Compressors",
      "Refrigerant Gas",
      "Copper Pipes",
      "Electrical & Capacitors",
      "Spare Parts",
      "Consumables",
    ];
  }, []);

  // Filtered Products
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesQuery =
        !q ||
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        p.unit.toLowerCase().includes(q);

      if (!matchesQuery) return false;

      if (selectedCategory === "ALL") return true;
      if (selectedCategory === "HVAC Units") return p.name.toLowerCase().includes("inverter") || p.name.toLowerCase().includes("ac") || p.name.toLowerCase().includes("ton");
      if (selectedCategory === "Compressors") return p.name.toLowerCase().includes("compressor");
      if (selectedCategory === "Refrigerant Gas") return p.name.toLowerCase().includes("gas") || p.name.toLowerCase().includes("r410") || p.name.toLowerCase().includes("r22") || p.name.toLowerCase().includes("r32");
      if (selectedCategory === "Copper Pipes") return p.name.toLowerCase().includes("copper") || p.name.toLowerCase().includes("pipe");
      if (selectedCategory === "Electrical & Capacitors") return p.name.toLowerCase().includes("capacitor") || p.name.toLowerCase().includes("relay") || p.name.toLowerCase().includes("contactor");
      if (selectedCategory === "Spare Parts") return p.name.toLowerCase().includes("filter") || p.name.toLowerCase().includes("blade") || p.name.toLowerCase().includes("motor") || p.name.toLowerCase().includes("valve");
      return true;
    });
  }, [products, searchQuery, selectedCategory]);

  // Cart Operations
  const addToCart = (product: ProductItem) => {
    if (product.stockQuantity <= 0) return;

    setCart((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);
      if (existing) {
        if (existing.quantity >= product.stockQuantity) return prev;
        return prev.map((item) =>
          item.product.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [
        ...prev,
        {
          product,
          quantity: 1,
          unitPrice: product.unitPrice,
          discount: 0,
        },
      ];
    });
  };

  const updateQuantity = (productId: string, newQty: number) => {
    if (newQty <= 0) {
      removeFromCart(productId);
      return;
    }

    setCart((prev) =>
      prev.map((item) => {
        if (item.product.id === productId) {
          const maxQty = item.product.stockQuantity;
          const clampedQty = Math.min(newQty, maxQty);
          return { ...item, quantity: clampedQty };
        }
        return item;
      })
    );
  };

  const updateItemDiscount = (productId: string, discountAmount: number) => {
    setCart((prev) =>
      prev.map((item) =>
        item.product.id === productId ? { ...item, discount: Math.max(0, discountAmount) } : item
      )
    );
  };

  const removeFromCart = (productId: string) => {
    setCart((prev) => prev.filter((item) => item.product.id !== productId));
  };

  const clearCart = () => {
    setCart([]);
    setOrderDiscountValue(0);
    setApplyGstTax(false);
    setOrderNotes("");
  };

  // Held Cart Operations
  const holdCurrentCart = () => {
    if (cart.length === 0) return;
    const newHeld: HeldCart = {
      id: `HOLD-${Date.now().toString().slice(-4)}`,
      heldAt: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      customerName: selectedCustomer.name,
      items: [...cart],
      notes: orderNotes,
    };
    setHeldCarts((prev) => [newHeld, ...prev]);
    clearCart();
  };

  const restoreHeldCart = (heldId: string) => {
    const target = heldCarts.find((h) => h.id === heldId);
    if (!target) return;
    setCart(target.items);
    setSelectedCustomer({ name: target.customerName, phone: "" });
    setOrderNotes(target.notes || "");
    setHeldCarts((prev) => prev.filter((h) => h.id !== heldId));
  };

  // Financial Calculations
  const cartSubtotal = useMemo(() => {
    return cart.reduce((sum, item) => {
      const lineTotal = item.quantity * item.unitPrice - item.discount;
      return sum + Math.max(0, lineTotal);
    }, 0);
  }, [cart]);

  const totalDiscount = useMemo(() => {
    const itemsDiscount = cart.reduce((sum, item) => sum + item.discount, 0);
    let orderDisc = 0;
    if (orderDiscountType === "percent") {
      orderDisc = (cartSubtotal * Math.min(100, Math.max(0, orderDiscountValue))) / 100;
    } else {
      orderDisc = Math.min(cartSubtotal, Math.max(0, orderDiscountValue));
    }
    return itemsDiscount + orderDisc;
  }, [cart, cartSubtotal, orderDiscountType, orderDiscountValue]);

  const taxAmount = useMemo(() => {
    if (!applyGstTax) return 0;
    const taxableAmount = Math.max(0, cartSubtotal - (orderDiscountType === "percent" ? (cartSubtotal * orderDiscountValue) / 100 : orderDiscountValue));
    return Math.round(taxableAmount * 0.16 * 100) / 100; // 16% GST
  }, [applyGstTax, cartSubtotal, orderDiscountType, orderDiscountValue]);

  const grandTotal = useMemo(() => {
    const afterOrderDisc =
      orderDiscountType === "percent"
        ? cartSubtotal - (cartSubtotal * Math.min(100, Math.max(0, orderDiscountValue))) / 100
        : Math.max(0, cartSubtotal - orderDiscountValue);
    return Math.max(0, Math.round((afterOrderDisc + taxAmount) * 100) / 100);
  }, [cartSubtotal, orderDiscountType, orderDiscountValue, taxAmount]);

  // Checkout Initiation
  const handleOpenCheckout = () => {
    setCheckoutError(null);
    setPaymentMethod("cash");
    setAmountTendered(String(grandTotal));
    setSplitCashAmount(String(Math.floor(grandTotal / 2)));
    setSplitCardAmount(String(Math.ceil(grandTotal / 2)));
    setShowCheckoutModal(true);
  };

  // Change Calculation
  const tenderedNumber = Number(amountTendered) || 0;
  const changeDue = Math.max(0, Math.round((tenderedNumber - grandTotal) * 100) / 100);

  // Submit Sale Checkout
  const handleCompleteCheckout = async () => {
    if (paymentMethod === "cash" && tenderedNumber < grandTotal) {
      setCheckoutError(`Tendered cash (PKR ${tenderedNumber.toLocaleString()}) cannot be less than total payable (PKR ${grandTotal.toLocaleString()})`);
      return;
    }

    if (paymentMethod === "split") {
      const c = Number(splitCashAmount) || 0;
      const d = Number(splitCardAmount) || 0;
      if (Math.abs(c + d - grandTotal) > 1) {
        setCheckoutError(`Split cash (${c}) + card (${d}) must equal total payable (${grandTotal})`);
        return;
      }
    }

    try {
      setIsSubmittingCheckout(true);
      setCheckoutError(null);

      const payload = {
        action: "checkout",
        items: cart.map((item) => ({
          productId: item.product.id,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          discountAmount: item.discount,
        })),
        paymentMethod,
        amountTendered: paymentMethod === "cash" ? tenderedNumber : grandTotal,
        changeGiven: paymentMethod === "cash" ? changeDue : 0,
        subtotal: cartSubtotal,
        discountAmount: totalDiscount,
        taxAmount,
        totalAmount: grandTotal,
        customerName: selectedCustomer.name || "Walk-in Customer",
        customerPhone: selectedCustomer.phone || null,
        cashierName: activeSession?.cashierName || "Fatima Noor (Accountant)",
        notes: orderNotes ? `${orderNotes}${cardApprovalRef ? ` | Card Auth: ${cardApprovalRef}` : ""}` : cardApprovalRef ? `Card Auth: ${cardApprovalRef}` : null,
        splitDetails: paymentMethod === "split" ? {
          cashAmount: Number(splitCashAmount) || 0,
          cardAmount: Number(splitCardAmount) || 0,
        } : undefined,
      };

      const res = await fetch("/api/pos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Checkout transaction failed");
      }

      setCompletedSale(data.sale);
      setShowCheckoutModal(false);
      setShowReceiptModal(true);
      clearCart();
      loadData(); // reload catalog & shift stats
    } catch (e: any) {
      setCheckoutError(e.message || "Failed to complete transaction");
    } finally {
      setIsSubmittingCheckout(false);
    }
  };

  // Shift Register Actions
  const handleOpenShift = async () => {
    try {
      setShiftSubmitting(true);
      const res = await fetch("/api/pos/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "open",
          cashierName: cashierNameInput,
          openingFloat: Number(openingFloatInput) || 0,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to open register");
      setShowOpenShiftModal(false);
      loadData();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setShiftSubmitting(false);
    }
  };

  const handleCashDrop = async () => {
    try {
      setShiftSubmitting(true);
      const res = await fetch("/api/pos/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "cash_drop",
          dropType,
          amount: Number(dropAmount) || 0,
          reason: dropReason,
          cashierName: activeSession?.cashierName || "Counter Cashier",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to record cash drop");
      setShowCashDropModal(false);
      setDropAmount("");
      setDropReason("");
      loadData();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setShiftSubmitting(false);
    }
  };

  const handleCloseShift = async () => {
    try {
      setShiftSubmitting(true);
      const res = await fetch("/api/pos/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "close",
          closingCash: Number(countedCashInput) || 0,
          notes: closeShiftNotes,
          cashierName: activeSession?.cashierName || "Counter Cashier",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to close register");
      setZReportData(data.zReport);
      setShowCloseShiftModal(false);
      loadData();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setShiftSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-[#18181B] flex flex-col font-sans pb-12">
      {/* ========================================================================= */}
      {/* 1. TOP STATUS & SHIFT REGISTER BAR */}
      {/* ========================================================================= */}
      <header className="bg-white border-b border-[#E4E4E7] sticky top-0 z-30 px-4 py-2.5 shadow-2xs">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Brand & Mode Switcher */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#0D7A5F] to-emerald-700 flex items-center justify-center text-white shadow-xs">
              <ShoppingBag className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm font-bold text-[#18181B] tracking-tight">
                  Enterprise POS Terminal
                </h1>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-emerald-100 text-[#065F46] border border-emerald-200">
                  Live Counter
                </span>
              </div>
              <p className="text-[11px] text-[#71717A]">
                High-Speed Retail Checkout, Inventory Sync & GAAP Postings
              </p>
            </div>
          </div>

          {/* Center Tabs: Terminal vs History vs Shifts */}
          <div className="inline-flex rounded-xl border border-[#EDEDED] p-1 bg-[#F4F4F5] self-start md:self-auto">
            <button
              type="button"
              onClick={() => setActiveTab("terminal")}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 transition",
                activeTab === "terminal"
                  ? "bg-white text-[#0D7A5F] shadow-xs"
                  : "text-[#71717A] hover:text-[#18181B]"
              )}
            >
              <ShoppingBag className="w-3.5 h-3.5" />
              Counter Terminal
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("history")}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 transition",
                activeTab === "history"
                  ? "bg-white text-[#0D7A5F] shadow-xs"
                  : "text-[#71717A] hover:text-[#18181B]"
              )}
            >
              <FileText className="w-3.5 h-3.5" />
              Sales & Receipts ({recentSales.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("shifts")}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 transition",
                activeTab === "shifts"
                  ? "bg-white text-[#0D7A5F] shadow-xs"
                  : "text-[#71717A] hover:text-[#18181B]"
              )}
            >
              <Banknote className="w-3.5 h-3.5" />
              Shift Register (X/Z)
            </button>
          </div>

          {/* Right Shift Register Controls */}
          <div className="flex items-center gap-2">
            {activeSession ? (
              <div className="flex items-center gap-2">
                <div className="hidden lg:flex flex-col text-right leading-tight">
                  <span className="text-[10px] font-bold text-emerald-700 flex items-center justify-end gap-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    Shift #{activeSession.sessionNumber}
                  </span>
                  <span className="text-[11px] font-mono font-bold text-[#18181B]">
                    Drawer Cash: {formatCurrency(activeSession.expectedCash || activeSession.openingFloat)}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => setShowCashDropModal(true)}
                  className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-[#F4F4F5] hover:bg-[#E4E4E7] text-[#18181B] transition inline-flex items-center gap-1"
                  title="Record drawer cash drop or petty payout"
                >
                  <DollarSign className="w-3.5 h-3.5 text-[#0D7A5F]" />
                  Cash In / Out
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setCountedCashInput(String(activeSession.expectedCash || 0));
                    setShowCloseShiftModal(true);
                  }}
                  className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 transition inline-flex items-center gap-1"
                >
                  Close Shift (Z)
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowOpenShiftModal(true)}
                className="px-3 py-1.5 rounded-lg text-xs font-bold bg-[#0D7A5F] hover:bg-[#0A634D] text-white shadow-xs transition inline-flex items-center gap-1.5"
              >
                <Banknote className="w-4 h-4" />
                Open Register Shift
              </button>
            )}

            <Link
              href="/accounts"
              className="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-[#71717A] hover:text-[#18181B] hover:bg-[#F4F4F5] transition"
              title="Return to Accounts Suite"
            >
              Back to Accounts
            </Link>
          </div>
        </div>
      </header>

      {/* ========================================================================= */}
      {/* 2. TAB CONTENT: TERMINAL (SPLIT VIEW: CATALOG + SHOPPING CART)            */}
      {/* ========================================================================= */}
      {activeTab === "terminal" && (
        <main className="max-w-7xl w-full mx-auto p-4 flex-1 flex flex-col lg:flex-row gap-4">
          {/* LEFT: PRODUCT CATALOG & BARCODE SEARCH */}
          <div className="flex-1 flex flex-col space-y-3 min-w-0">
            {/* Search Bar & Scanner */}
            <div className="bg-white rounded-xl border border-[#E4E4E7] p-3 shadow-2xs space-y-2.5">
              <div className="relative">
                <Search className="w-4 h-4 text-[#71717A] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Scan barcode, SKU, or search product name... [Press F2]"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-20 py-2.5 bg-[#F9FAFB] border border-[#E4E4E7] focus:border-[#0D7A5F] focus:bg-white rounded-xl text-xs font-medium outline-hidden transition"
                />
                <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1">
                  <span className="text-[10px] font-mono font-bold text-[#A1A1AA] bg-white border border-[#E4E4E7] px-1.5 py-0.5 rounded">
                    F2
                  </span>
                </div>
              </div>

              {/* Category Pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                {categories.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setSelectedCategory(cat)}
                    className={cn(
                      "px-2.5 py-1 rounded-lg text-xs font-bold whitespace-nowrap transition",
                      selectedCategory === cat
                        ? "bg-[#0D7A5F] text-white shadow-2xs"
                        : "bg-[#F4F4F5] text-[#71717A] hover:text-[#18181B] hover:bg-[#E4E4E7]"
                    )}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Product Cards Grid */}
            <div className="flex-1 bg-white rounded-xl border border-[#E4E4E7] p-3 shadow-2xs overflow-y-auto max-h-[calc(100vh-250px)]">
              {isLoading ? (
                <div className="py-16 text-center text-xs text-[#71717A]">
                  Loading live inventory catalog...
                </div>
              ) : filteredProducts.length === 0 ? (
                <div className="py-16 text-center space-y-2">
                  <p className="text-xs font-semibold text-[#71717A]">
                    No matching products found.
                  </p>
                  <p className="text-[11px] text-[#A1A1AA]">
                    Try searching for another term or selecting "ALL" categories.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2.5">
                  {filteredProducts.map((prod) => {
                    const isOutOfStock = prod.stockQuantity <= 0;
                    const isLowStock = !isOutOfStock && prod.stockQuantity <= prod.reorderLevel;
                    const inCartItem = cart.find((c) => c.product.id === prod.id);

                    return (
                      <div
                        key={prod.id}
                        onClick={() => !isOutOfStock && addToCart(prod)}
                        className={cn(
                          "relative p-3 rounded-xl border text-left flex flex-col justify-between transition group select-none",
                          isOutOfStock
                            ? "bg-[#FAFAFA] border-[#EDEDED] opacity-60 cursor-not-allowed"
                            : "bg-white border-[#E4E4E7] hover:border-[#0D7A5F] hover:shadow-xs cursor-pointer active:scale-[0.98]"
                        )}
                      >
                        {inCartItem && (
                          <div className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-[#0D7A5F] text-white text-[11px] font-mono font-bold flex items-center justify-center shadow-xs">
                            {inCartItem.quantity}
                          </div>
                        )}

                        <div>
                          <div className="flex items-center justify-between gap-1 mb-1">
                            <span className="font-mono text-[10px] font-bold text-[#71717A] bg-[#F4F4F5] px-1.5 py-0.5 rounded">
                              {prod.sku}
                            </span>
                            <span
                              className={cn(
                                "text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full",
                                isOutOfStock
                                  ? "bg-rose-100 text-rose-800"
                                  : isLowStock
                                  ? "bg-amber-100 text-amber-800"
                                  : "bg-emerald-50 text-emerald-700"
                              )}
                            >
                              {isOutOfStock ? "Out of Stock" : `${prod.stockQuantity} ${prod.unit}`}
                            </span>
                          </div>

                          <h4 className="text-xs font-bold text-[#18181B] line-clamp-2 leading-snug group-hover:text-[#0D7A5F] transition">
                            {prod.name}
                          </h4>
                        </div>

                        <div className="mt-2.5 pt-2 border-t border-[#F4F4F5] flex items-center justify-between">
                          <span className="text-xs font-bold font-mono text-[#0D7A5F]">
                            {formatCurrency(prod.unitPrice)}
                          </span>
                          <span className="text-[10px] text-[#A1A1AA] uppercase">
                            /{prod.unit}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* RIGHT: SHOPPING CART & LIVE TOTALS */}
          <div className="w-full lg:w-[420px] flex flex-col space-y-3 shrink-0">
            <div className="bg-white rounded-xl border border-[#E4E4E7] shadow-2xs p-3.5 flex flex-col h-full">
              {/* Customer Selector & Parked Carts */}
              <div className="pb-3 border-b border-[#E4E4E7] space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-[#18181B] flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-[#0D7A5F]" />
                    Customer / Counter Sale
                  </span>

                  {heldCarts.length > 0 && (
                    <div className="flex items-center gap-1 text-[11px]">
                      <span className="text-[#A1A1AA]">Parked:</span>
                      {heldCarts.map((h) => (
                        <button
                          key={h.id}
                          type="button"
                          onClick={() => restoreHeldCart(h.id)}
                          className="px-2 py-0.5 rounded bg-amber-100 text-amber-900 font-bold hover:bg-amber-200 transition"
                          title={`Resume ${h.customerName} (${h.heldAt})`}
                        >
                          {h.customerName.slice(0, 8)}..
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex gap-2">
                  <select
                    value={selectedCustomer.name}
                    onChange={(e) => {
                      const cust = customers.find((c) => c.name === e.target.value);
                      if (cust) {
                        setSelectedCustomer({ name: cust.name, phone: cust.phone || "" });
                      } else {
                        setSelectedCustomer({ name: e.target.value, phone: "" });
                      }
                    }}
                    className="flex-1 bg-[#F9FAFB] border border-[#E4E4E7] focus:border-[#0D7A5F] rounded-lg px-2.5 py-1.5 text-xs font-semibold"
                  >
                    <option value="Walk-in Customer">Walk-in Customer (Cash Counter)</option>
                    {customers.map((c) => (
                      <option key={c.id} value={c.name}>
                        {c.name} ({c.phone || "No Phone"})
                      </option>
                    ))}
                  </select>

                  <button
                    type="button"
                    onClick={holdCurrentCart}
                    disabled={cart.length === 0}
                    className="px-2 py-1.5 rounded-lg text-[11px] font-bold bg-[#F4F4F5] hover:bg-[#E4E4E7] disabled:opacity-50 text-[#18181B] transition inline-flex items-center gap-1 shrink-0"
                    title="Park / Hold current cart"
                  >
                    <PauseCircle className="w-3.5 h-3.5" />
                    Hold
                  </button>
                </div>
              </div>

              {/* Cart Items List */}
              <div className="flex-1 overflow-y-auto py-2.5 space-y-2 min-h-[220px] max-h-[340px]">
                {cart.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center p-6 text-[#A1A1AA] space-y-2">
                    <ShoppingBag className="w-8 h-8 opacity-30 text-[#18181B]" />
                    <p className="text-xs font-semibold">Cart is currently empty.</p>
                    <p className="text-[11px]">Click items from catalog or scan barcode to add.</p>
                  </div>
                ) : (
                  cart.map((item) => {
                    const lineTotal = item.quantity * item.unitPrice - item.discount;
                    return (
                      <div
                        key={item.product.id}
                        className="p-2.5 rounded-xl bg-[#F9FAFB] border border-[#EDEDED] flex flex-col gap-1.5"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <span className="text-xs font-bold text-[#18181B] block truncate">
                              {item.product.name}
                            </span>
                            <span className="text-[10px] text-[#71717A] font-mono">
                              {item.product.sku} · {formatCurrency(item.unitPrice)}
                            </span>
                          </div>

                          <span className="font-mono font-bold text-xs text-[#18181B]">
                            {formatCurrency(Math.max(0, lineTotal))}
                          </span>
                        </div>

                        {/* Quantity Stepper & Remove */}
                        <div className="flex items-center justify-between pt-1 border-t border-[#EDEDED]/60">
                          <div className="flex items-center gap-1.5 bg-white border border-[#E4E4E7] rounded-lg p-0.5">
                            <button
                              type="button"
                              onClick={() => updateQuantity(item.product.id, item.quantity - 1)}
                              className="w-5 h-5 flex items-center justify-center hover:bg-[#F4F4F5] rounded text-[#71717A]"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <input
                              type="number"
                              min="1"
                              max={item.product.stockQuantity}
                              value={item.quantity}
                              onChange={(e) => updateQuantity(item.product.id, parseInt(e.target.value, 10) || 1)}
                              className="w-8 text-center text-xs font-mono font-bold outline-hidden"
                            />
                            <button
                              type="button"
                              onClick={() => updateQuantity(item.product.id, item.quantity + 1)}
                              disabled={item.quantity >= item.product.stockQuantity}
                              className="w-5 h-5 flex items-center justify-center hover:bg-[#F4F4F5] disabled:opacity-40 rounded text-[#71717A]"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => removeFromCart(item.product.id)}
                              className="p-1 hover:bg-rose-50 text-rose-600 rounded transition"
                              title="Remove item"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Order Modifiers & Financial Summary */}
              <div className="pt-3 border-t border-[#E4E4E7] space-y-2.5">
                {/* Discount & Tax Row */}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="flex items-center gap-1 bg-[#F9FAFB] border border-[#E4E4E7] rounded-lg px-2 py-1">
                    <span className="text-[11px] text-[#71717A]">Disc:</span>
                    <input
                      type="number"
                      min="0"
                      value={orderDiscountValue || ""}
                      onChange={(e) => setOrderDiscountValue(Number(e.target.value) || 0)}
                      placeholder="0"
                      className="w-full bg-transparent text-right font-mono font-bold outline-hidden text-xs"
                    />
                    <button
                      type="button"
                      onClick={() => setOrderDiscountType((prev) => (prev === "fixed" ? "percent" : "fixed"))}
                      className="text-[10px] font-bold uppercase font-mono px-1 py-0.5 rounded bg-white border border-[#E4E4E7]"
                    >
                      {orderDiscountType === "percent" ? "%" : "PKR"}
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => setApplyGstTax(!applyGstTax)}
                    className={cn(
                      "flex items-center justify-between px-2.5 py-1 rounded-lg border text-xs font-semibold transition",
                      applyGstTax
                        ? "bg-emerald-50 border-emerald-300 text-emerald-800"
                        : "bg-[#F9FAFB] border-[#E4E4E7] text-[#71717A]"
                    )}
                  >
                    <span>16% GST:</span>
                    <span className="font-mono font-bold">
                      {applyGstTax ? formatCurrency(taxAmount) : "Exempt"}
                    </span>
                  </button>
                </div>

                {/* Subtotal, Discount & Grand Total Breakdown */}
                <div className="bg-[#F9FAFB] rounded-xl p-2.5 space-y-1 text-xs border border-[#EDEDED]">
                  <div className="flex justify-between text-[#71717A]">
                    <span>Subtotal:</span>
                    <span className="font-mono font-medium">{formatCurrency(cartSubtotal)}</span>
                  </div>
                  {totalDiscount > 0 && (
                    <div className="flex justify-between text-rose-600 font-medium">
                      <span>Total Discount:</span>
                      <span className="font-mono">-{formatCurrency(totalDiscount)}</span>
                    </div>
                  )}
                  {applyGstTax && (
                    <div className="flex justify-between text-emerald-700 font-medium">
                      <span>Sales Tax (16%):</span>
                      <span className="font-mono">+{formatCurrency(taxAmount)}</span>
                    </div>
                  )}

                  <div className="pt-1.5 border-t border-[#E4E4E7] flex items-baseline justify-between">
                    <span className="font-bold text-[#18181B] text-sm">Grand Total:</span>
                    <span className="font-mono font-black text-xl text-[#0D7A5F]">
                      {formatCurrency(grandTotal)}
                    </span>
                  </div>
                </div>

                {/* Actions Bar */}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={clearCart}
                    disabled={cart.length === 0}
                    className="px-3 py-2.5 rounded-xl border border-[#E4E4E7] hover:bg-[#F4F4F5] disabled:opacity-40 text-xs font-bold text-[#71717A] transition"
                  >
                    Clear
                  </button>

                  <button
                    type="button"
                    onClick={handleOpenCheckout}
                    disabled={cart.length === 0}
                    className="flex-1 py-3 px-4 rounded-xl bg-[#0D7A5F] hover:bg-[#0A634D] disabled:opacity-40 text-white font-black text-sm shadow-md hover:shadow-lg transition flex items-center justify-center gap-2"
                  >
                    <Banknote className="w-5 h-5" />
                    Pay / Charge {formatCurrency(grandTotal)} [F12]
                  </button>
                </div>
              </div>
            </div>
          </div>
        </main>
      )}

      {/* ========================================================================= */}
      {/* 3. TAB CONTENT: SALES HISTORY & RECEIPT REPRINTS                          */}
      {/* ========================================================================= */}
      {activeTab === "history" && (
        <div className="max-w-7xl mx-auto w-full p-4 space-y-4">
          <div className="bg-white rounded-xl border border-[#E4E4E7] shadow-xs overflow-hidden">
            <div className="px-5 py-4 border-b border-[#E4E4E7] flex flex-col md:flex-row md:items-center justify-between gap-3 bg-[#FAFAFA]">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#18181B]">
                  POS Counter Sales Register & Receipt Archive
                </h3>
                <p className="text-[11px] text-[#71717A]">
                  Every counter sale is synced live with inventory deductions and balanced double-entry accounting.
                </p>
              </div>

              <div className="text-xs font-mono font-bold text-[#0D7A5F] bg-white border border-[#E4E4E7] px-3 py-1.5 rounded-lg">
                Total Archive: {recentSales.length} Sales
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-[#E4E4E7] text-[11px] font-semibold text-[#71717A] uppercase tracking-wider bg-[#F4F4F5]">
                    <th className="py-2.5 px-4">Receipt #</th>
                    <th className="py-2.5 px-4">Date & Time</th>
                    <th className="py-2.5 px-4">Customer</th>
                    <th className="py-2.5 px-4">Items Sold</th>
                    <th className="py-2.5 px-3 text-center">Payment</th>
                    <th className="py-2.5 px-4 text-right">Total Amount</th>
                    <th className="py-2.5 px-4 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E4E4E7]">
                  {recentSales.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-[#71717A]">
                        No counter sales recorded yet.
                      </td>
                    </tr>
                  ) : (
                    recentSales.map((sale) => (
                      <tr key={sale.id} className="hover:bg-[#F9FAFB] transition">
                        <td className="py-3 px-4 font-mono font-bold text-[#0D7A5F]">
                          {sale.saleNumber}
                        </td>
                        <td className="py-3 px-4 text-[#71717A] font-mono text-[11px]">
                          {formatDateTime(sale.createdAt)}
                        </td>
                        <td className="py-3 px-4 font-medium text-[#18181B]">
                          {sale.customerName}
                          {sale.customerPhone && (
                            <span className="block text-[10px] text-[#71717A] font-mono">
                              {sale.customerPhone}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <div className="space-y-0.5">
                            {sale.items?.map((it: any, idx: number) => (
                              <div key={idx} className="text-[11px]">
                                <span className="font-semibold text-[#18181B]">
                                  {it.quantity}x {it.product?.name || "Item"}
                                </span>{" "}
                                <span className="text-[#71717A]">@ {formatCurrency(it.unitPrice)}</span>
                              </div>
                            ))}
                          </div>
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span className="capitalize px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#F4F4F5] text-[#18181B] border border-[#E4E4E7]">
                            {sale.paymentMethod}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-[#18181B]">
                          {formatCurrency(sale.totalAmount)}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <button
                            type="button"
                            onClick={() => {
                              setCompletedSale(sale);
                              setShowReceiptModal(true);
                            }}
                            className="px-2 py-1 rounded bg-[#F4F4F5] hover:bg-[#E4E4E7] text-[#18181B] font-bold text-[11px] inline-flex items-center gap-1 transition"
                          >
                            <Printer className="w-3.5 h-3.5 text-[#0D7A5F]" />
                            Reprint Receipt
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. TAB CONTENT: SHIFT REGISTER & CASH DRAWER SESSIONS (X & Z REPORTS)    */}
      {/* ========================================================================= */}
      {activeTab === "shifts" && (
        <div className="max-w-7xl mx-auto w-full p-4 space-y-4">
          {/* Active Shift Card */}
          <div className="bg-white rounded-xl border border-[#E4E4E7] p-5 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#E4E4E7]">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#18181B] flex items-center gap-2">
                  <Banknote className="w-4 h-4 text-[#0D7A5F]" />
                  Active Cash Drawer Register Session
                </h3>
                <p className="text-[11px] text-[#71717A]">
                  Track float opening, counter sales, drawer drops, and end-of-shift reconciliation (X/Z Reports).
                </p>
              </div>

              {activeSession ? (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowCashDropModal(true)}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold bg-[#F4F4F5] hover:bg-[#E4E4E7] text-[#18181B] transition"
                  >
                    + Cash In / Out Drop
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setCountedCashInput(String(activeSession.expectedCash || 0));
                      setShowCloseShiftModal(true);
                    }}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white shadow-xs transition"
                  >
                    End Shift & Print Z-Report
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowOpenShiftModal(true)}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold bg-[#0D7A5F] hover:bg-[#0A634D] text-white shadow-xs transition"
                >
                  Open New Shift Register
                </button>
              )}
            </div>

            {activeSession ? (
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
                <div className="p-3 rounded-xl bg-[#F9FAFB] border border-[#EDEDED]">
                  <span className="text-[10px] text-[#71717A] uppercase font-bold block">Session #</span>
                  <span className="text-sm font-mono font-bold text-[#0D7A5F] block mt-0.5">
                    {activeSession.sessionNumber}
                  </span>
                  <span className="text-[10px] text-[#71717A]">{activeSession.cashierName}</span>
                </div>

                <div className="p-3 rounded-xl bg-[#F9FAFB] border border-[#EDEDED]">
                  <span className="text-[10px] text-[#71717A] uppercase font-bold block">Opening Float</span>
                  <span className="text-sm font-mono font-bold text-[#18181B] block mt-0.5">
                    {formatCurrency(activeSession.openingFloat)}
                  </span>
                  <span className="text-[10px] text-[#71717A]">Cash Drawer Start</span>
                </div>

                <div className="p-3 rounded-xl bg-[#F9FAFB] border border-[#EDEDED]">
                  <span className="text-[10px] text-[#71717A] uppercase font-bold block">Total POS Sales</span>
                  <span className="text-sm font-mono font-bold text-[#18181B] block mt-0.5">
                    {formatCurrency(activeSession.totalSalesAmount)}
                  </span>
                  <span className="text-[10px] text-emerald-700 font-semibold">{activeSession.totalSalesCount} Receipts</span>
                </div>

                <div className="p-3 rounded-xl bg-[#F9FAFB] border border-[#EDEDED]">
                  <span className="text-[10px] text-[#71717A] uppercase font-bold block">Cash Collected</span>
                  <span className="text-sm font-mono font-bold text-emerald-700 block mt-0.5">
                    {formatCurrency(activeSession.cashSalesAmount)}
                  </span>
                  <span className="text-[10px] text-[#71717A]">In-Drawer Cash</span>
                </div>

                <div className="p-3 rounded-xl bg-[#F9FAFB] border border-[#EDEDED]">
                  <span className="text-[10px] text-[#71717A] uppercase font-bold block">Cash Drops / Out</span>
                  <span className="text-sm font-mono font-bold text-rose-600 block mt-0.5">
                    -{formatCurrency(activeSession.cashOutTotal)}
                  </span>
                  <span className="text-[10px] text-emerald-700">+{formatCurrency(activeSession.cashInTotal)} In</span>
                </div>

                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200">
                  <span className="text-[10px] text-emerald-900 uppercase font-bold block">Expected Drawer Cash</span>
                  <span className="text-base font-mono font-black text-emerald-800 block mt-0.5">
                    {formatCurrency(activeSession.expectedCash || activeSession.openingFloat)}
                  </span>
                  <span className="text-[10px] text-emerald-700">Must Count At Close</span>
                </div>
              </div>
            ) : (
              <div className="p-6 text-center text-xs text-[#71717A] bg-[#F9FAFB] rounded-xl border border-dashed border-[#E4E4E7] space-y-1">
                <p className="font-bold text-[#18181B]">No register shift is currently open.</p>
                <p>Click "Open New Shift Register" to record opening cash float and start taking sales.</p>
              </div>
            )}
          </div>

          {/* Past Sessions History Table */}
          <div className="bg-white rounded-xl border border-[#E4E4E7] shadow-xs overflow-hidden">
            <div className="px-5 py-3.5 bg-[#FAFAFA] border-b border-[#E4E4E7]">
              <h4 className="text-xs font-bold uppercase tracking-wider text-[#18181B]">
                Closed Shifts & Z-Report Reconciliations
              </h4>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-[#E4E4E7] text-[11px] font-semibold text-[#71717A] uppercase tracking-wider bg-[#F4F4F5]">
                    <th className="py-2.5 px-4">Session #</th>
                    <th className="py-2.5 px-4">Cashier</th>
                    <th className="py-2.5 px-4">Opened / Closed</th>
                    <th className="py-2.5 px-4 text-right">Float</th>
                    <th className="py-2.5 px-4 text-right">Total Sales</th>
                    <th className="py-2.5 px-4 text-right">Counted Cash</th>
                    <th className="py-2.5 px-4 text-right">Discrepancy</th>
                    <th className="py-2.5 px-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E4E4E7]">
                  {pastSessions.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-[#71717A]">
                        No shift sessions logged yet.
                      </td>
                    </tr>
                  ) : (
                    pastSessions.map((sess) => (
                      <tr key={sess.id} className="hover:bg-[#F9FAFB] transition">
                        <td className="py-3 px-4 font-mono font-bold text-[#18181B]">
                          {sess.sessionNumber}
                        </td>
                        <td className="py-3 px-4 font-medium">{sess.cashierName}</td>
                        <td className="py-3 px-4 text-[11px] text-[#71717A]">
                          <div>In: {formatDateTime(sess.openedAt)}</div>
                          {sess.closedAt && (
                            <div className="text-[#A1A1AA]">Out: {formatDateTime(sess.closedAt)}</div>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right font-mono">
                          {formatCurrency(sess.openingFloat)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-[#0D7A5F]">
                          {formatCurrency(sess.totalSalesAmount)}
                          <span className="block text-[10px] text-[#71717A] font-normal">
                            ({sess.totalSalesCount} sales)
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold">
                          {sess.closingCash !== null ? formatCurrency(sess.closingCash) : "—"}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold">
                          {sess.discrepancy !== null ? (
                            <span
                              className={cn(
                                sess.discrepancy === 0
                                  ? "text-emerald-700"
                                  : sess.discrepancy > 0
                                  ? "text-blue-700"
                                  : "text-rose-600"
                              )}
                            >
                              {sess.discrepancy > 0 ? "+" : ""}
                              {formatCurrency(sess.discrepancy)}
                            </span>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span
                            className={cn(
                              "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase",
                              sess.status === "open"
                                ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                                : "bg-[#F4F4F5] text-[#71717A] border border-[#E4E4E7]"
                            )}
                          >
                            {sess.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 5. MULTI-TENDER PAYMENT CHECKOUT MODAL                                    */}
      {/* ========================================================================= */}
      {showCheckoutModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-[#E4E4E7] shadow-2xl max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-4 bg-gradient-to-r from-[#0D7A5F] to-emerald-800 text-white flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-200">
                  Payment Checkout
                </span>
                <h3 className="text-base font-bold">Complete Sale & Multi-Tender</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowCheckoutModal(false)}
                className="p-1 rounded-lg hover:bg-white/20 text-white transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {/* Grand Total Display */}
              <div className="bg-[#F9FAFB] rounded-xl p-3.5 border border-[#EDEDED] flex items-center justify-between">
                <div>
                  <span className="text-[11px] text-[#71717A] block">Total Amount Payable</span>
                  <span className="text-2xl font-black font-mono text-[#0D7A5F]">
                    {formatCurrency(grandTotal)}
                  </span>
                </div>
                <div className="text-right text-[11px] text-[#71717A]">
                  <div>Customer: <strong className="text-[#18181B]">{selectedCustomer.name}</strong></div>
                  <div>Items: <strong>{cart.length} lines</strong></div>
                </div>
              </div>

              {/* Payment Method Selector Tabs */}
              <div className="grid grid-cols-5 gap-1.5 p-1 bg-[#F4F4F5] rounded-xl">
                {[
                  { id: "cash", label: "Cash", icon: Banknote },
                  { id: "card", label: "Card", icon: CreditCard },
                  { id: "transfer", label: "Bank", icon: Building2 },
                  { id: "credit", label: "Khata", icon: User },
                  { id: "split", label: "Split", icon: SlidersHorizontal },
                ].map((tab) => {
                  const Icon = tab.icon;
                  const isSel = paymentMethod === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setPaymentMethod(tab.id as any)}
                      className={cn(
                        "py-2 rounded-lg text-xs font-bold flex flex-col items-center gap-1 transition",
                        isSel
                          ? "bg-white text-[#0D7A5F] shadow-xs"
                          : "text-[#71717A] hover:text-[#18181B]"
                      )}
                    >
                      <Icon className="w-4 h-4" />
                      {tab.label}
                    </button>
                  );
                })}
              </div>

              {/* CASH TENDER SECTION */}
              {paymentMethod === "cash" && (
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-semibold text-[#71717A] block mb-1">
                      Amount Tendered by Customer (PKR):
                    </label>
                    <input
                      type="number"
                      step="1"
                      value={amountTendered}
                      onChange={(e) => setAmountTendered(e.target.value)}
                      className="w-full bg-[#F9FAFB] border border-[#D4D4D8] focus:border-[#0D7A5F] focus:bg-white rounded-xl p-3 text-lg font-mono font-bold outline-hidden transition"
                    />
                  </div>

                  {/* Fast Cash Tender Buttons */}
                  <div className="grid grid-cols-4 gap-1.5">
                    {[
                      { label: "Exact", val: grandTotal },
                      { label: "500", val: 500 },
                      { label: "1,000", val: 1000 },
                      { label: "2,000", val: 2000 },
                      { label: "5,000", val: 5000 },
                      { label: "10,000", val: 10000 },
                    ].map((btn, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setAmountTendered(String(btn.val))}
                        className="py-1.5 text-xs font-mono font-bold bg-[#F4F4F5] hover:bg-[#E4E4E7] text-[#18181B] rounded-lg transition"
                      >
                        {btn.label === "Exact" ? "Exact" : `Rs. ${btn.label}`}
                      </button>
                    ))}
                  </div>

                  {/* Change Due Display */}
                  <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 flex items-center justify-between">
                    <span className="text-xs font-bold text-emerald-900">Change Due to Customer:</span>
                    <span className="text-xl font-mono font-black text-[#065F46]">
                      {formatCurrency(changeDue)}
                    </span>
                  </div>
                </div>
              )}

              {/* CARD / POS TERMINAL SECTION */}
              {paymentMethod === "card" && (
                <div className="space-y-3">
                  <div className="p-3 bg-blue-50 rounded-xl border border-blue-200 text-xs text-blue-900">
                    Swipe or tap card on countertop POS terminal. Once approved, enter transaction approval code below.
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-[#71717A] block mb-1">
                      Card Approval / Auth Code:
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. AUTH-982341 (Optional)"
                      value={cardApprovalRef}
                      onChange={(e) => setCardApprovalRef(e.target.value)}
                      className="w-full bg-[#F9FAFB] border border-[#D4D4D8] focus:border-[#0D7A5F] rounded-xl p-2.5 text-xs font-mono font-bold outline-hidden"
                    />
                  </div>
                </div>
              )}

              {/* BANK TRANSFER SECTION */}
              {paymentMethod === "transfer" && (
                <div className="space-y-3 text-xs">
                  <div className="p-3 bg-purple-50 rounded-xl border border-purple-200 text-purple-950">
                    Direct transfer to <strong>Meezan Bank Corporate Account</strong>.
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-[#71717A] block mb-1">
                      Bank Reference / Transaction ID:
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. TRX-20260909-001"
                      value={cardApprovalRef}
                      onChange={(e) => setCardApprovalRef(e.target.value)}
                      className="w-full bg-[#F9FAFB] border border-[#D4D4D8] focus:border-[#0D7A5F] rounded-xl p-2.5 text-xs font-mono font-bold outline-hidden"
                    />
                  </div>
                </div>
              )}

              {/* CUSTOMER ACCOUNT (CREDIT / KHATA) */}
              {paymentMethod === "credit" && (
                <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-950 space-y-1">
                  <p className="font-bold">On-Account / Khata Credit Sale</p>
                  <p>
                    Amount of {formatCurrency(grandTotal)} will be charged to{" "}
                    <strong>{selectedCustomer.name}</strong> under Trade Receivables (1100).
                  </p>
                </div>
              )}

              {/* SPLIT PAYMENT (CASH + CARD) */}
              {paymentMethod === "split" && (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-semibold text-[#71717A] block mb-1">
                        Cash Portion (PKR):
                      </label>
                      <input
                        type="number"
                        value={splitCashAmount}
                        onChange={(e) => setSplitCashAmount(e.target.value)}
                        className="w-full bg-[#F9FAFB] border border-[#D4D4D8] rounded-xl p-2.5 text-xs font-mono font-bold outline-hidden"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-[#71717A] block mb-1">
                        Card Portion (PKR):
                      </label>
                      <input
                        type="number"
                        value={splitCardAmount}
                        onChange={(e) => setSplitCardAmount(e.target.value)}
                        className="w-full bg-[#F9FAFB] border border-[#D4D4D8] rounded-xl p-2.5 text-xs font-mono font-bold outline-hidden"
                      />
                    </div>
                  </div>
                </div>
              )}

              {checkoutError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 font-semibold flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{checkoutError}</span>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-2 pt-2 border-t border-[#E4E4E7]">
                <button
                  type="button"
                  onClick={() => setShowCheckoutModal(false)}
                  className="px-4 py-2.5 rounded-xl border border-[#E4E4E7] text-xs font-bold text-[#71717A] hover:bg-[#F4F4F5] transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleCompleteCheckout}
                  disabled={isSubmittingCheckout}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-[#0D7A5F] hover:bg-[#0A634D] disabled:opacity-50 text-white font-bold text-xs shadow-md transition flex items-center justify-center gap-1.5"
                >
                  {isSubmittingCheckout ? "Processing Transaction..." : "Complete Sale & Print Receipt"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 6. 80MM THERMAL RECEIPT MODAL & PRINTER VIEW                              */}
      {/* ========================================================================= */}
      {showReceiptModal && completedSale && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl border border-[#E4E4E7] shadow-2xl max-w-sm w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Controls */}
            <div className="p-3 bg-[#FAFAFA] border-b border-[#E4E4E7] flex items-center justify-between print:hidden">
              <span className="text-xs font-bold text-[#18181B] flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-[#0D7A5F]" />
                Transaction Completed
              </span>
              <button
                type="button"
                onClick={() => setShowReceiptModal(false)}
                className="p-1 text-[#71717A] hover:text-[#18181B]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* 80mm Thermal Receipt Layout */}
            <div id="thermal-receipt" className="p-5 font-mono text-xs text-[#18181B] space-y-3 bg-white">
              {/* Header */}
              <div className="text-center space-y-0.5 border-b border-dashed border-[#A1A1AA] pb-3">
                <h2 className="text-sm font-black uppercase tracking-wider text-[#18181B]">
                  HVAC ENTERPRISE SERVICES
                </h2>
                <p className="text-[10px] text-[#71717A]">HVAC, Electrical & Counter Sales</p>
                <p className="text-[10px] text-[#71717A]">UAN: 042-111-0000 | NTN: 9482710-3</p>
                <p className="text-[10px] text-[#71717A]">Lahore, Pakistan</p>
              </div>

              {/* Receipt Meta */}
              <div className="text-[10px] space-y-0.5 border-b border-dashed border-[#A1A1AA] pb-2">
                <div className="flex justify-between">
                  <span>Receipt #:</span>
                  <span className="font-bold">{completedSale.saleNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span>Date:</span>
                  <span>{formatDateTime(completedSale.createdAt)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Cashier:</span>
                  <span>{completedSale.cashierName || "Fatima Noor"}</span>
                </div>
                <div className="flex justify-between">
                  <span>Customer:</span>
                  <span className="font-semibold">{completedSale.customerName}</span>
                </div>
              </div>

              {/* Items Table */}
              <div className="border-b border-dashed border-[#A1A1AA] pb-2 space-y-1">
                <div className="flex justify-between font-bold text-[10px] uppercase text-[#71717A]">
                  <span>Item</span>
                  <span>Total</span>
                </div>
                {completedSale.items?.map((it: any, i: number) => (
                  <div key={i} className="text-[11px] leading-tight">
                    <div className="flex justify-between">
                      <span className="font-bold">{it.product?.name || "Part"}</span>
                      <span>{formatCurrency(it.quantity * it.unitPrice)}</span>
                    </div>
                    <div className="text-[10px] text-[#71717A]">
                      {it.quantity} x {formatCurrency(it.unitPrice)}
                    </div>
                  </div>
                ))}
              </div>

              {/* Totals Breakdown */}
              <div className="text-[11px] space-y-0.5 border-b border-dashed border-[#A1A1AA] pb-2">
                <div className="flex justify-between text-[#71717A]">
                  <span>Subtotal:</span>
                  <span>{formatCurrency(completedSale.subtotal || completedSale.totalAmount)}</span>
                </div>
                {completedSale.discountAmount > 0 && (
                  <div className="flex justify-between text-rose-600">
                    <span>Discount:</span>
                    <span>-{formatCurrency(completedSale.discountAmount)}</span>
                  </div>
                )}
                {completedSale.taxAmount > 0 && (
                  <div className="flex justify-between text-emerald-700">
                    <span>Sales Tax (16% GST):</span>
                    <span>+{formatCurrency(completedSale.taxAmount)}</span>
                  </div>
                )}
                <div className="flex justify-between font-black text-sm pt-1 text-[#18181B]">
                  <span>TOTAL NET:</span>
                  <span>{formatCurrency(completedSale.totalAmount)}</span>
                </div>
              </div>

              {/* Tendered & Change */}
              <div className="text-[10px] space-y-0.5 border-b border-dashed border-[#A1A1AA] pb-2">
                <div className="flex justify-between">
                  <span>Paid via:</span>
                  <span className="uppercase font-bold">{completedSale.paymentMethod}</span>
                </div>
                <div className="flex justify-between">
                  <span>Amount Tendered:</span>
                  <span>{formatCurrency(completedSale.amountTendered || completedSale.totalAmount)}</span>
                </div>
                <div className="flex justify-between font-bold">
                  <span>Change Returned:</span>
                  <span>{formatCurrency(completedSale.changeGiven || 0)}</span>
                </div>
              </div>

              {/* Barcode representation & Footer policy */}
              <div className="text-center space-y-1 pt-1 text-[9px] text-[#71717A]">
                <div className="py-1 font-mono tracking-widest text-[11px] font-black border border-black/10 rounded">
                  ||||| | |||| ||| ||||||| | ||
                </div>
                <p>Thank you for your business!</p>
                <p>7-Day Warranty on original parts with invoice.</p>
                <p className="text-[8px] text-[#A1A1AA]">Enterprise ERP v2.6 · Verified Posting</p>
              </div>
            </div>

            {/* Print & Next Sale Buttons */}
            <div className="p-3 bg-[#FAFAFA] border-t border-[#E4E4E7] flex gap-2 print:hidden">
              <button
                type="button"
                onClick={() => window.print()}
                className="flex-1 py-2.5 px-3 rounded-xl bg-[#18181B] hover:bg-black text-white font-bold text-xs inline-flex items-center justify-center gap-1.5 transition"
              >
                <Printer className="w-4 h-4" />
                Print 80mm Receipt
              </button>
              <button
                type="button"
                onClick={() => setShowReceiptModal(false)}
                className="py-2.5 px-4 rounded-xl bg-[#0D7A5F] hover:bg-[#0A634D] text-white font-bold text-xs transition"
              >
                + Next Sale
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 7. OPEN REGISTER SHIFT MODAL                                              */}
      {/* ========================================================================= */}
      {showOpenShiftModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-[#E4E4E7] shadow-2xl max-w-sm w-full p-5 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-[#E4E4E7]">
              <h3 className="text-sm font-bold text-[#18181B] flex items-center gap-1.5">
                <Banknote className="w-4 h-4 text-[#0D7A5F]" />
                Open Cash Register Shift
              </h3>
              <button onClick={() => setShowOpenShiftModal(false)} className="text-[#71717A]">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-[#71717A] font-semibold block mb-1">Cashier / Operator Name:</label>
                <input
                  type="text"
                  value={cashierNameInput}
                  onChange={(e) => setCashierNameInput(e.target.value)}
                  className="w-full bg-[#F9FAFB] border border-[#D4D4D8] rounded-xl p-2.5 font-semibold text-xs outline-hidden"
                />
              </div>

              <div>
                <label className="text-[#71717A] font-semibold block mb-1">
                  Opening Cash Float in Drawer (PKR):
                </label>
                <input
                  type="number"
                  value={openingFloatInput}
                  onChange={(e) => setOpeningFloatInput(e.target.value)}
                  className="w-full bg-[#F9FAFB] border border-[#D4D4D8] rounded-xl p-2.5 font-mono font-bold text-base outline-hidden"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2 border-t border-[#E4E4E7]">
              <button
                type="button"
                onClick={() => setShowOpenShiftModal(false)}
                className="px-3 py-2 rounded-xl border border-[#E4E4E7] text-xs font-semibold text-[#71717A]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleOpenShift}
                disabled={shiftSubmitting}
                className="flex-1 py-2 rounded-xl bg-[#0D7A5F] hover:bg-[#0A634D] text-white font-bold text-xs shadow-xs"
              >
                {shiftSubmitting ? "Opening..." : "Confirm & Open Register"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 8. DRAWER CASH IN / CASH OUT MODAL                                        */}
      {/* ========================================================================= */}
      {showCashDropModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-[#E4E4E7] shadow-2xl max-w-sm w-full p-5 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-[#E4E4E7]">
              <h3 className="text-sm font-bold text-[#18181B] flex items-center gap-1.5">
                <DollarSign className="w-4 h-4 text-[#0D7A5F]" />
                Cash Drawer Drop / Payout
              </h3>
              <button onClick={() => setShowCashDropModal(false)} className="text-[#71717A]">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setDropType("cash_out")}
                  className={cn(
                    "py-2 rounded-xl text-xs font-bold border transition",
                    dropType === "cash_out"
                      ? "bg-rose-50 border-rose-300 text-rose-800"
                      : "bg-[#F4F4F5] border-[#E4E4E7] text-[#71717A]"
                  )}
                >
                  Cash Out (Drop/Payout)
                </button>
                <button
                  type="button"
                  onClick={() => setDropType("cash_in")}
                  className={cn(
                    "py-2 rounded-xl text-xs font-bold border transition",
                    dropType === "cash_in"
                      ? "bg-emerald-50 border-emerald-300 text-emerald-800"
                      : "bg-[#F4F4F5] border-[#E4E4E7] text-[#71717A]"
                  )}
                >
                  Cash In (Deposit)
                </button>
              </div>

              <div>
                <label className="text-[#71717A] font-semibold block mb-1">Amount (PKR):</label>
                <input
                  type="number"
                  placeholder="e.g. 1000"
                  value={dropAmount}
                  onChange={(e) => setDropAmount(e.target.value)}
                  className="w-full bg-[#F9FAFB] border border-[#D4D4D8] rounded-xl p-2.5 font-mono font-bold text-sm outline-hidden"
                />
              </div>

              <div>
                <label className="text-[#71717A] font-semibold block mb-1">Reason / Note:</label>
                <input
                  type="text"
                  placeholder="e.g. Paid courier or mid-day safe drop"
                  value={dropReason}
                  onChange={(e) => setDropReason(e.target.value)}
                  className="w-full bg-[#F9FAFB] border border-[#D4D4D8] rounded-xl p-2.5 text-xs outline-hidden"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2 border-t border-[#E4E4E7]">
              <button
                type="button"
                onClick={() => setShowCashDropModal(false)}
                className="px-3 py-2 rounded-xl border border-[#E4E4E7] text-xs font-semibold text-[#71717A]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCashDrop}
                disabled={shiftSubmitting || !dropAmount}
                className="flex-1 py-2 rounded-xl bg-[#0D7A5F] hover:bg-[#0A634D] disabled:opacity-50 text-white font-bold text-xs shadow-xs"
              >
                {shiftSubmitting ? "Recording..." : "Record Transaction"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 9. CLOSE REGISTER SHIFT (Z-REPORT) MODAL                                  */}
      {/* ========================================================================= */}
      {showCloseShiftModal && activeSession && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-[#E4E4E7] shadow-2xl max-w-md w-full p-5 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-[#E4E4E7]">
              <h3 className="text-sm font-bold text-[#18181B] flex items-center gap-1.5">
                <Banknote className="w-4 h-4 text-rose-600" />
                Close Register Shift & Generate Z-Report
              </h3>
              <button onClick={() => setShowCloseShiftModal(false)} className="text-[#71717A]">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 bg-[#F9FAFB] rounded-xl border border-[#EDEDED] space-y-1 text-xs">
              <div className="flex justify-between text-[#71717A]">
                <span>Opening Float:</span>
                <span className="font-mono">{formatCurrency(activeSession.openingFloat)}</span>
              </div>
              <div className="flex justify-between text-emerald-700 font-semibold">
                <span>Total Cash Sales:</span>
                <span className="font-mono">+{formatCurrency(activeSession.cashSalesAmount)}</span>
              </div>
              {activeSession.cashInTotal > 0 && (
                <div className="flex justify-between text-blue-700">
                  <span>Cash In Drops:</span>
                  <span className="font-mono">+{formatCurrency(activeSession.cashInTotal)}</span>
                </div>
              )}
              {activeSession.cashOutTotal > 0 && (
                <div className="flex justify-between text-rose-600">
                  <span>Cash Payouts:</span>
                  <span className="font-mono">-{formatCurrency(activeSession.cashOutTotal)}</span>
                </div>
              )}
              <div className="pt-1.5 border-t border-[#E4E4E7] flex justify-between font-bold text-sm text-[#18181B]">
                <span>Expected Drawer Cash:</span>
                <span className="font-mono font-black text-[#0D7A5F]">
                  {formatCurrency(activeSession.expectedCash || activeSession.openingFloat)}
                </span>
              </div>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-[#71717A] font-semibold block mb-1">
                  Actual Counted Cash in Drawer (PKR):
                </label>
                <input
                  type="number"
                  value={countedCashInput}
                  onChange={(e) => setCountedCashInput(e.target.value)}
                  className="w-full bg-[#F9FAFB] border border-[#D4D4D8] focus:border-[#0D7A5F] rounded-xl p-3 font-mono font-bold text-lg outline-hidden"
                />
              </div>

              {countedCashInput && (
                <div className="p-3 rounded-xl border flex items-center justify-between text-xs font-bold">
                  <span>Discrepancy (Over / Short):</span>
                  <span
                    className={cn(
                      "font-mono text-sm",
                      Number(countedCashInput) - (activeSession.expectedCash || 0) === 0
                        ? "text-emerald-700"
                        : Number(countedCashInput) - (activeSession.expectedCash || 0) > 0
                        ? "text-blue-700"
                        : "text-rose-600"
                    )}
                  >
                    {Number(countedCashInput) - (activeSession.expectedCash || 0) > 0 ? "+" : ""}
                    {formatCurrency(Number(countedCashInput) - (activeSession.expectedCash || 0))}
                  </span>
                </div>
              )}

              <div>
                <label className="text-[#71717A] font-semibold block mb-1">Shift Notes:</label>
                <input
                  type="text"
                  placeholder="e.g. Shift closed by Fatima with zero variance"
                  value={closeShiftNotes}
                  onChange={(e) => setCloseShiftNotes(e.target.value)}
                  className="w-full bg-[#F9FAFB] border border-[#D4D4D8] rounded-xl p-2.5 text-xs outline-hidden"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2 border-t border-[#E4E4E7]">
              <button
                type="button"
                onClick={() => setShowCloseShiftModal(false)}
                className="px-3 py-2 rounded-xl border border-[#E4E4E7] text-xs font-semibold text-[#71717A]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCloseShift}
                disabled={shiftSubmitting || !countedCashInput}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white font-bold text-xs shadow-xs"
              >
                {shiftSubmitting ? "Closing Shift..." : "Finalize & Close Shift (Z-Report)"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
