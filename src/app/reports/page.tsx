"use client";

import React from "react";
import Link from "next/link";
import PageHeader from "@/components/layout/PageHeader";
import {
  BarChart3,
  FileText,
  CreditCard,
  Package,
  RotateCcw,
  ShoppingBag,
  ArrowRight,
  TrendingUp,
  Receipt,
  Users,
} from "lucide-react";

export default function ReportsDirectoryPage() {
  const reportSuites = [
    {
      title: "Financial Statements & Ledgers",
      description: "Balance Sheet, Profit & Loss, Trial Balance, Sub-Ledger Aging, and Bank Reconciliation.",
      icon: FileText,
      href: "/accounts?tab=reports",
      badge: "Finance",
      color: "from-emerald-600 to-teal-700",
    },
    {
      title: "Field Job Performance & Revenue",
      description: "Daily jobs audit, completed revenue by technician, and customer job breakdown.",
      icon: BarChart3,
      href: "/jobs/reports",
      badge: "Operations",
      color: "from-blue-600 to-indigo-700",
    },
    {
      title: "Sales Tax & Withholding Statement",
      description: "FBR and provincial sales tax returns, output tax collected, and vendor withholding.",
      icon: CreditCard,
      href: "/accounts/tax-report",
      badge: "Taxation",
      color: "from-amber-600 to-orange-700",
    },
    {
      title: "Procurement & Sourcing Analytics",
      description: "Purchase order aging, supplier fulfillment lead times, and spending by category.",
      icon: Receipt,
      href: "/procurement?tab=reports",
      badge: "Procurement",
      color: "from-purple-600 to-pink-700",
    },
    {
      title: "Warehouse & Stock Valuation",
      description: "Stock ledger movements, low-stock reorder thresholds, and inventory valuation.",
      icon: Package,
      href: "/inventory",
      badge: "Inventory",
      color: "from-cyan-600 to-blue-700",
    },
    {
      title: "System Audit & Mutation Rollbacks",
      description: "Tamper-evident system activity log, database rollback points, and financial mutation tracking.",
      icon: RotateCcw,
      href: "/audit",
      badge: "Compliance",
      color: "from-zinc-700 to-zinc-900",
    },
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      <PageHeader
        breadcrumbs={[
          { label: "Home", href: "/" },
          { label: "Reports Directory" },
        ]}
        title="Enterprise Reports & Business Intelligence"
        subtitle="Centralized access to operational, financial, inventory, and compliance reporting suites."
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {reportSuites.map((suite) => {
          const Icon = suite.icon;
          return (
            <Link
              key={suite.title}
              href={suite.href}
              className="group bg-white rounded-2xl border border-[#EDEDED] p-6 shadow-xs hover:shadow-md hover:border-[#0D7A5F] transition flex flex-col justify-between space-y-4"
            >
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-tr ${suite.color} text-white flex items-center justify-center shadow-xs`}>
                    <Icon className="w-6 h-6" />
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-[#F4F4F5] text-[#71717A] border border-[#EDEDED]">
                    {suite.badge}
                  </span>
                </div>
                <h3 className="text-base font-bold text-[#18181B] group-hover:text-[#0D7A5F] transition">
                  {suite.title}
                </h3>
                <p className="text-xs text-[#71717A] mt-1.5 leading-relaxed">
                  {suite.description}
                </p>
              </div>

              <div className="pt-3 border-t border-[#F4F4F5] flex items-center justify-between text-xs font-semibold text-[#0D7A5F]">
                <span>Open Report Suite</span>
                <ArrowRight className="w-4 h-4 transform group-hover:translate-x-1 transition" />
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
