"use client";

import React, { useState } from "react";
import SideDrawer from "@/components/ui/SideDrawer";
import SearchableSelect from "@/components/ui/SearchableSelect";
import { Users, AlertCircle } from "lucide-react";

interface AddEmployeeDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  managers?: any[];
  onEmployeeAdded?: () => void;
}

export default function AddEmployeeDrawer({
  isOpen,
  onClose,
  managers = [],
  onEmployeeAdded,
}: AddEmployeeDrawerProps) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("technician");
  const [department, setDepartment] = useState("Operations");
  const [designation, setDesignation] = useState("");
  const [employmentType, setEmploymentType] = useState("Full-time");
  const [salary, setSalary] = useState("6000");
  const [reportingManagerId, setReportingManagerId] = useState("");
  const [probationMonths, setProbationMonths] = useState("3");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !phone) {
      setErrorMsg("Name and phone number are required.");
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMsg("");

      const probationEndDate = probationMonths !== "0"
        ? new Date(Date.now() + Number(probationMonths) * 30 * 24 * 60 * 60 * 1000).toISOString()
        : undefined;

      const res = await fetch("/api/hrm/employees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          phone,
          email: email || undefined,
          role,
          department,
          designation: designation || undefined,
          employmentType,
          salary: Number(salary) || 0,
          reportingManagerId: reportingManagerId || undefined,
          probationEndDate,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error);
      }

      onEmployeeAdded?.();
      // Reset form
      setName("");
      setPhone("");
      setEmail("");
      setDesignation("");
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SideDrawer
      isOpen={isOpen}
      onClose={onClose}
      title="Add New Employee"
      subtitle="Register staff member, assign designation, reporting manager, and probation terms"
      footer={
        <div className="flex items-center justify-end gap-2 w-full">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-[#71717A] hover:text-[#18181B] transition rounded-lg"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="add-employee-form"
            disabled={isSubmitting}
            className="h-9 px-4 rounded-lg bg-[#0D7A5F] hover:bg-[#0A624C] text-xs font-semibold text-white inline-flex items-center gap-1.5 transition shadow-xs disabled:opacity-50"
          >
            <Users className="w-3.5 h-3.5" />
            {isSubmitting ? "Saving..." : "Create Employee Record"}
          </button>
        </div>
      }
    >
      <form id="add-employee-form" onSubmit={handleSubmit} className="space-y-4">
        {errorMsg && (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-lg flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <div>
          <label className="block text-xs font-semibold text-[#18181B] mb-1">
            Full Legal Name *
          </label>
          <input
            type="text"
            required
            placeholder="e.g. Rashid Mansoor"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full h-9 px-3 text-xs bg-[#F4F4F5] border border-[#E4E4E7] rounded-lg text-[#18181B] focus:bg-white focus:border-[#0D7A5F] focus:outline-none"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-[#18181B] mb-1">
              Mobile Phone *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. +971 50 111 2233"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full h-9 px-3 text-xs bg-[#F4F4F5] border border-[#E4E4E7] rounded-lg text-[#18181B] focus:bg-white focus:border-[#0D7A5F] focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#18181B] mb-1">
              Work Email
            </label>
            <input
              type="email"
              placeholder="rashid@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full h-9 px-3 text-xs bg-[#F4F4F5] border border-[#E4E4E7] rounded-lg text-[#18181B] focus:bg-white focus:border-[#0D7A5F] focus:outline-none"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-[#18181B] mb-1">
              Role Classification *
            </label>
            <SearchableSelect
              value={role}
              onChange={setRole}
              placeholder="Select Role"
              searchPlaceholder="Search role..."
              options={[
                { value: "technician", label: "Technician" },
                { value: "dispatcher", label: "Dispatcher" },
                { value: "accountant", label: "Accountant" },
                { value: "storekeeper", label: "Storekeeper" },
                { value: "call_center", label: "Call Center / CSR" },
                { value: "admin", label: "Administrator / Director" },
              ]}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#18181B] mb-1">
              Department *
            </label>
            <SearchableSelect
              value={department}
              onChange={setDepartment}
              placeholder="Select Department"
              searchPlaceholder="Search department..."
              options={[
                { value: "Operations", label: "Operations" },
                { value: "Accounts", label: "Accounts & Finance" },
                { value: "HR", label: "Human Resources" },
                { value: "Maintenance", label: "Maintenance" },
                { value: "Sales", label: "Sales & Projects" },
                { value: "Management", label: "Management" },
              ]}
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-[#18181B] mb-1">
            Job Title / Designation
          </label>
          <input
            type="text"
            placeholder="e.g. Senior Chiller Overhaul Specialist"
            value={designation}
            onChange={(e) => setDesignation(e.target.value)}
            className="w-full h-9 px-3 text-xs bg-[#F4F4F5] border border-[#E4E4E7] rounded-lg text-[#18181B] focus:bg-white focus:border-[#0D7A5F] focus:outline-none"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-[#18181B] mb-1">
              Employment Type
            </label>
            <SearchableSelect
              value={employmentType}
              onChange={setEmploymentType}
              placeholder="Select Employment Type"
              searchPlaceholder="Search type..."
              options={[
                { value: "Full-time", label: "Full-time Regular" },
                { value: "Contract", label: "Fixed-Term Contract" },
                { value: "Probation", label: "Probationary Period" },
                { value: "Part-time", label: "Part-time" },
              ]}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#18181B] mb-1">
              Monthly Base Salary ($)
            </label>
            <input
              type="number"
              min="0"
              value={salary}
              onChange={(e) => setSalary(e.target.value)}
              className="w-full h-9 px-3 text-xs font-mono font-bold bg-[#F4F4F5] border border-[#E4E4E7] rounded-lg text-[#18181B] focus:bg-white focus:border-[#0D7A5F] focus:outline-none"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-[#18181B] mb-1">
              Reporting Manager
            </label>
            <SearchableSelect
              value={reportingManagerId}
              onChange={setReportingManagerId}
              placeholder="-- No Direct Manager --"
              searchPlaceholder="Search manager..."
              clearable={true}
              options={[
                { value: "", label: "-- No Direct Manager --" },
                ...managers.map((m) => ({
                  value: String(m.id),
                  label: `${m.name} (${m.designation || m.role})`,
                })),
              ]}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#18181B] mb-1">
              Probation Term
            </label>
            <SearchableSelect
              value={probationMonths}
              onChange={setProbationMonths}
              placeholder="Select Probation"
              searchPlaceholder="Search term..."
              options={[
                { value: "3", label: "3 Months (Standard)" },
                { value: "6", label: "6 Months (Executive/Tech)" },
                { value: "0", label: "None (Confirmed from Day 1)" },
              ]}
            />
          </div>
        </div>
      </form>
    </SideDrawer>
  );
}
