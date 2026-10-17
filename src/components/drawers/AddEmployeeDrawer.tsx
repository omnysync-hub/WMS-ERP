"use client";

import React, { useState } from "react";
import SideDrawer from "@/components/ui/SideDrawer";
import SearchableSelect from "@/components/ui/SearchableSelect";
import { Users, AlertCircle, User, Phone, Building2, Landmark } from "lucide-react";

interface AddEmployeeDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  managers?: any[];
  initialValues?: {
    name?: string;
    phone?: string;
    email?: string;
    role?: string;
    department?: string;
    designation?: string;
    salary?: string;
  };
  onEmployeeAdded?: () => void;
}

export default function AddEmployeeDrawer({
  isOpen,
  onClose,
  managers = [],
  initialValues,
  onEmployeeAdded,
}: AddEmployeeDrawerProps) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [cnic, setCnic] = useState("");
  const [address, setAddress] = useState("");
  const [emergencyContactName, setEmergencyContactName] = useState("");
  const [emergencyContactPhone, setEmergencyContactPhone] = useState("");

  const [role, setRole] = useState("technician");
  const [department, setDepartment] = useState("Operations");
  const [designation, setDesignation] = useState("");
  const [employmentType, setEmploymentType] = useState("Full-time");
  const [salary, setSalary] = useState("6000");
  const [reportingManagerId, setReportingManagerId] = useState("");
  const [probationMonths, setProbationMonths] = useState("3");

  const [bankName, setBankName] = useState("");
  const [bankAccountTitle, setBankAccountTitle] = useState("");
  const [bankAccountNumber, setBankAccountNumber] = useState("");
  const [bankIban, setBankIban] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  React.useEffect(() => {
    if (isOpen && initialValues) {
      if (initialValues.name) setName(initialValues.name);
      if (initialValues.phone) setPhone(initialValues.phone);
      if (initialValues.email) setEmail(initialValues.email);
      if (initialValues.role) setRole(initialValues.role);
      if (initialValues.department) setDepartment(initialValues.department);
      if (initialValues.designation) setDesignation(initialValues.designation);
      if (initialValues.salary) setSalary(initialValues.salary);
    }
  }, [isOpen, initialValues]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !phone) {
      setErrorMsg("Name and phone number are required.");
      return;
    }

    const phoneDigits = phone.replace(/\D/g, "");
    if (phoneDigits.length !== 11) {
      setErrorMsg("Employee phone number must be exactly 11 digits (e.g. 03001234567).");
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMsg("");

      const probationEndDate =
        probationMonths !== "0"
          ? new Date(Date.now() + Number(probationMonths) * 30 * 24 * 60 * 60 * 1000).toISOString()
          : undefined;

      const res = await fetch("/api/hrm/employees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          phone: phone.trim(),
          email: email.trim() || undefined,
          cnic: cnic.trim() || undefined,
          address: address.trim() || undefined,
          emergencyContactName: emergencyContactName.trim() || undefined,
          emergencyContactPhone: emergencyContactPhone.trim() || undefined,
          role,
          department,
          designation: designation.trim() || undefined,
          employmentType,
          salary: Number(salary) || 0,
          reportingManagerId: reportingManagerId || undefined,
          probationEndDate,
          bankName: bankName.trim() || undefined,
          bankAccountTitle: bankAccountTitle.trim() || undefined,
          bankAccountNumber: bankAccountNumber.trim() || undefined,
          bankIban: bankIban.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to create employee");
      }

      onEmployeeAdded?.();
      // Reset form
      setName("");
      setPhone("");
      setEmail("");
      setCnic("");
      setAddress("");
      setEmergencyContactName("");
      setEmergencyContactPhone("");
      setDesignation("");
      setBankName("");
      setBankAccountTitle("");
      setBankAccountNumber("");
      setBankIban("");
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
      subtitle="Register staff member, assign designation, reporting manager, CNIC, emergency contact, and bank account"
      width="max-w-2xl"
      footer={
        <div className="flex items-center justify-end gap-2 w-full">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-zinc-600 hover:text-zinc-900 border border-zinc-300 rounded-lg transition"
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
      <form id="add-employee-form" onSubmit={handleSubmit} className="space-y-4 pb-6 text-zinc-900">
        {errorMsg && (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-lg flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* 1. Personal & Contact Details */}
        <div className="space-y-3 p-3.5 bg-zinc-50 border border-zinc-200 rounded-xl">
          <h3 className="text-xs font-bold text-zinc-800 flex items-center gap-1.5">
            <User className="w-3.5 h-3.5 text-[#0D7A5F]" />
            Personal & Contact Information
          </h3>

          <div>
            <label className="block text-xs font-semibold text-zinc-800 mb-1">
              Full Legal Name <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Rashid Mansoor"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full h-9 px-3 text-xs bg-white border border-zinc-300 rounded-lg text-zinc-900 focus:border-[#0D7A5F] focus:ring-1 focus:ring-[#0D7A5F] outline-none shadow-2xs"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-zinc-800 mb-1">
                Mobile Phone <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. 03001234567"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full h-9 px-3 text-xs bg-white border border-zinc-300 rounded-lg text-zinc-900 focus:border-[#0D7A5F] focus:ring-1 focus:ring-[#0D7A5F] outline-none shadow-2xs"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-zinc-800 mb-1">
                Work Email Address
              </label>
              <input
                type="email"
                placeholder="rashid@workmanservices.pk"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full h-9 px-3 text-xs bg-white border border-zinc-300 rounded-lg text-zinc-900 focus:border-[#0D7A5F] focus:ring-1 focus:ring-[#0D7A5F] outline-none shadow-2xs"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-zinc-800 mb-1">
                CNIC Number (National ID)
              </label>
              <input
                type="text"
                placeholder="e.g. 35201-1234567-1"
                value={cnic}
                onChange={(e) => setCnic(e.target.value)}
                className="w-full h-9 px-3 text-xs bg-white border border-zinc-300 rounded-lg font-mono text-zinc-900 focus:border-[#0D7A5F] focus:ring-1 focus:ring-[#0D7A5F] outline-none shadow-2xs"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-zinc-800 mb-1">
                Residential Address
              </label>
              <input
                type="text"
                placeholder="e.g. House #14, Street 2, Gulberg, Lahore"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="w-full h-9 px-3 text-xs bg-white border border-zinc-300 rounded-lg text-zinc-900 focus:border-[#0D7A5F] focus:ring-1 focus:ring-[#0D7A5F] outline-none shadow-2xs"
              />
            </div>
          </div>
        </div>

        {/* 2. Emergency Contact */}
        <div className="space-y-3 p-3.5 bg-zinc-50 border border-zinc-200 rounded-xl">
          <h3 className="text-xs font-bold text-zinc-800 flex items-center gap-1.5">
            <Phone className="w-3.5 h-3.5 text-rose-600" />
            Emergency Contact Information
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1">
                Emergency Contact Person Name
              </label>
              <input
                type="text"
                placeholder="e.g. Muhammad Aslam (Father / Spouse)"
                value={emergencyContactName}
                onChange={(e) => setEmergencyContactName(e.target.value)}
                className="w-full h-9 px-3 text-xs bg-white border border-zinc-300 rounded-lg text-zinc-900 focus:border-[#0D7A5F] focus:ring-1 focus:ring-[#0D7A5F] outline-none shadow-2xs"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1">
                Emergency Phone Number
              </label>
              <input
                type="text"
                placeholder="e.g. 03217654321"
                value={emergencyContactPhone}
                onChange={(e) => setEmergencyContactPhone(e.target.value)}
                className="w-full h-9 px-3 text-xs bg-white border border-zinc-300 rounded-lg font-mono text-zinc-900 focus:border-[#0D7A5F] focus:ring-1 focus:ring-[#0D7A5F] outline-none shadow-2xs"
              />
            </div>
          </div>
        </div>

        {/* 3. Role & Organization */}
        <div className="space-y-3 p-3.5 bg-zinc-50 border border-zinc-200 rounded-xl">
          <h3 className="text-xs font-bold text-zinc-800 flex items-center gap-1.5">
            <Building2 className="w-3.5 h-3.5 text-[#0D7A5F]" />
            Employment & Organization
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-zinc-800 mb-1">
                Role Classification *
              </label>
              <SearchableSelect
                value={role}
                onChange={setRole}
                placeholder="Select Role"
                searchPlaceholder="Search role..."
                options={[
                  { value: "technician", label: "Field HVAC Technician" },
                  { value: "dispatcher", label: "Operations Dispatcher" },
                  { value: "storekeeper", label: "Storekeeper / Inventory" },
                  { value: "accountant", label: "Finance / Accountant" },
                  { value: "call_center", label: "Call Center Agent" },
                  { value: "hr", label: "Human Resources Officer" },
                  { value: "admin", label: "System Administrator" },
                ]}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-800 mb-1">
                Department *
              </label>
              <SearchableSelect
                value={department}
                onChange={setDepartment}
                placeholder="Select Department"
                searchPlaceholder="Search department..."
                options={[
                  { value: "Operations", label: "Operations (Field Services)" },
                  { value: "Accounts", label: "Accounts & Finance" },
                  { value: "HR", label: "Human Resources" },
                  { value: "Maintenance", label: "Maintenance & Workshop" },
                  { value: "Sales", label: "Sales & Client Success" },
                  { value: "Management", label: "Executive Management" },
                ]}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-800 mb-1">
              Official Designation / Title
            </label>
            <input
              type="text"
              placeholder="e.g. Senior HVAC Inverter Specialist"
              value={designation}
              onChange={(e) => setDesignation(e.target.value)}
              className="w-full h-9 px-3 text-xs bg-white border border-zinc-300 rounded-lg text-zinc-900 focus:border-[#0D7A5F] focus:ring-1 focus:ring-[#0D7A5F] outline-none shadow-2xs"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-zinc-800 mb-1">
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
              <label className="block text-xs font-semibold text-zinc-800 mb-1">
                Monthly Base Salary (PKR)
              </label>
              <input
                type="number"
                min="0"
                value={salary}
                onChange={(e) => setSalary(e.target.value)}
                className="w-full h-9 px-3 text-xs font-mono font-bold bg-white border border-zinc-300 rounded-lg text-zinc-900 focus:border-[#0D7A5F] focus:ring-1 focus:ring-[#0D7A5F] outline-none shadow-2xs"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-zinc-800 mb-1">
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
              <label className="block text-xs font-semibold text-zinc-800 mb-1">
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
        </div>

        {/* 4. Bank & Disbursement Details */}
        <div className="space-y-3 p-3.5 bg-zinc-50 border border-zinc-200 rounded-xl">
          <h3 className="text-xs font-bold text-zinc-800 flex items-center gap-1.5">
            <Landmark className="w-3.5 h-3.5 text-[#0D7A5F]" />
            Bank Account & Payroll Disbursement
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1">
                Bank Name
              </label>
              <input
                type="text"
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
                placeholder="e.g. Meezan Bank / HBL / Bank Alfalah"
                className="w-full h-9 px-3 text-xs bg-white border border-zinc-300 rounded-lg text-zinc-900 focus:border-[#0D7A5F] focus:ring-1 focus:ring-[#0D7A5F] outline-none shadow-2xs"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1">
                Account Title (Beneficiary Name)
              </label>
              <input
                type="text"
                value={bankAccountTitle}
                onChange={(e) => setBankAccountTitle(e.target.value)}
                placeholder="e.g. Rashid Mansoor"
                className="w-full h-9 px-3 text-xs bg-white border border-zinc-300 rounded-lg text-zinc-900 focus:border-[#0D7A5F] focus:ring-1 focus:ring-[#0D7A5F] outline-none shadow-2xs"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1">
                Account Number
              </label>
              <input
                type="text"
                value={bankAccountNumber}
                onChange={(e) => setBankAccountNumber(e.target.value)}
                placeholder="e.g. 02010103984721"
                className="w-full h-9 px-3 text-xs bg-white border border-zinc-300 rounded-lg font-mono text-zinc-900 focus:border-[#0D7A5F] focus:ring-1 focus:ring-[#0D7A5F] outline-none shadow-2xs"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1">
                IBAN Number
              </label>
              <input
                type="text"
                value={bankIban}
                onChange={(e) => setBankIban(e.target.value)}
                placeholder="e.g. PK36MEZN0002010103984721"
                className="w-full h-9 px-3 text-xs bg-white border border-zinc-300 rounded-lg font-mono text-zinc-900 uppercase focus:border-[#0D7A5F] focus:ring-1 focus:ring-[#0D7A5F] outline-none shadow-2xs"
              />
            </div>
          </div>
        </div>
      </form>
    </SideDrawer>
  );
}
