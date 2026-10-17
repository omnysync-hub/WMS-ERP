"use client";

import React, { useState, useEffect } from "react";
import SideDrawer from "@/components/ui/SideDrawer";
import SearchableSelect from "@/components/ui/SearchableSelect";
import { User, AlertCircle, Building2, Phone, ShieldCheck, Landmark } from "lucide-react";

interface EditEmployeeDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  employee: any;
  managers?: any[];
  onEmployeeUpdated?: () => void;
}

export default function EditEmployeeDrawer({
  isOpen,
  onClose,
  employee,
  managers = [],
  onEmployeeUpdated,
}: EditEmployeeDrawerProps) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [cnic, setCnic] = useState("");
  const [emergencyContactName, setEmergencyContactName] = useState("");
  const [emergencyContactPhone, setEmergencyContactPhone] = useState("");
  const [address, setAddress] = useState("");

  const [role, setRole] = useState("technician");
  const [department, setDepartment] = useState("Operations");
  const [designation, setDesignation] = useState("");
  const [employmentType, setEmploymentType] = useState("Full-time");
  const [salary, setSalary] = useState("0");
  const [status, setStatus] = useState("Active");
  const [probationStatus, setProbationStatus] = useState("Confirmed");
  const [reportingManagerId, setReportingManagerId] = useState("");

  const [bankName, setBankName] = useState("");
  const [bankAccountTitle, setBankAccountTitle] = useState("");
  const [bankAccountNumber, setBankAccountNumber] = useState("");
  const [bankIban, setBankIban] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (isOpen && employee) {
      setName(employee.name || "");
      setPhone(employee.phone || "");
      setEmail(employee.email || "");
      setCnic(employee.cnic || "");
      setEmergencyContactName(employee.emergencyContactName || "");
      setEmergencyContactPhone(employee.emergencyContactPhone || "");
      setAddress(employee.address || "");

      setRole(employee.role || "technician");
      setDepartment(employee.department || "Operations");
      setDesignation(employee.designation || "");
      setEmploymentType(employee.employmentType || "Full-time");
      setSalary(String(employee.salary || 0));
      setStatus(employee.status || "Active");
      setProbationStatus(employee.probationStatus || "Confirmed");
      setReportingManagerId(employee.reportingManagerId || "");

      setBankName(employee.bankName || "");
      setBankAccountTitle(employee.bankAccountTitle || "");
      setBankAccountNumber(employee.bankAccountNumber || "");
      setBankIban(employee.bankIban || "");
      setErrorMsg("");
    }
  }, [isOpen, employee]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !phone) {
      setErrorMsg("Name and phone number are required.");
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMsg("");

      const res = await fetch(`/api/hrm/employees/${employee.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          phone: phone.trim(),
          email: email.trim() || null,
          cnic: cnic.trim() || null,
          emergencyContactName: emergencyContactName.trim() || null,
          emergencyContactPhone: emergencyContactPhone.trim() || null,
          address: address.trim() || null,
          role,
          department,
          designation: designation.trim() || role,
          employmentType,
          salary: Number(salary) || 0,
          status,
          probationStatus,
          reportingManagerId: reportingManagerId || null,
          bankName: bankName.trim() || null,
          bankAccountTitle: bankAccountTitle.trim() || null,
          bankAccountNumber: bankAccountNumber.trim() || null,
          bankIban: bankIban.trim() || null,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to update employee");
      }

      onEmployeeUpdated?.();
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
      title="Edit Employee Profile"
      subtitle={`Update personal identity, contact, role, salary & bank details for ${employee?.name || "Staff"}`}
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
            form="edit-employee-form"
            disabled={isSubmitting}
            className="h-9 px-4 rounded-lg bg-[#0D7A5F] hover:bg-[#0A624C] text-xs font-semibold text-white inline-flex items-center gap-1.5 transition shadow-xs disabled:opacity-50"
          >
            <User className="w-3.5 h-3.5" />
            {isSubmitting ? "Saving Changes..." : "Save Employee Details"}
          </button>
        </div>
      }
    >
      <form id="edit-employee-form" onSubmit={handleSubmit} className="space-y-5 pb-6 text-zinc-900">
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
            <label className="block text-xs font-medium text-zinc-700 mb-1">
              Full Legal Name <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full h-9 px-3 text-xs bg-white border border-zinc-300 rounded-lg text-zinc-900 focus:border-[#0D7A5F] focus:ring-1 focus:ring-[#0D7A5F] outline-none shadow-2xs"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1">
                Primary Mobile Phone <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="e.g. 03001234567"
                className="w-full h-9 px-3 text-xs bg-white border border-zinc-300 rounded-lg text-zinc-900 focus:border-[#0D7A5F] focus:ring-1 focus:ring-[#0D7A5F] outline-none shadow-2xs"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1">
                Corporate Email Address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@workmanservices.pk"
                className="w-full h-9 px-3 text-xs bg-white border border-zinc-300 rounded-lg text-zinc-900 focus:border-[#0D7A5F] focus:ring-1 focus:ring-[#0D7A5F] outline-none shadow-2xs"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1">
                CNIC Number (National ID)
              </label>
              <input
                type="text"
                value={cnic}
                onChange={(e) => setCnic(e.target.value)}
                placeholder="e.g. 35201-1234567-1"
                className="w-full h-9 px-3 text-xs bg-white border border-zinc-300 rounded-lg font-mono text-zinc-900 focus:border-[#0D7A5F] focus:ring-1 focus:ring-[#0D7A5F] outline-none shadow-2xs"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1">
                Residential Address
              </label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="e.g. House #42, St 5, Gulberg III, Lahore"
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
                value={emergencyContactName}
                onChange={(e) => setEmergencyContactName(e.target.value)}
                placeholder="e.g. Muhammad Aslam (Father / Spouse)"
                className="w-full h-9 px-3 text-xs bg-white border border-zinc-300 rounded-lg text-zinc-900 focus:border-[#0D7A5F] focus:ring-1 focus:ring-[#0D7A5F] outline-none shadow-2xs"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1">
                Emergency Phone Number
              </label>
              <input
                type="text"
                value={emergencyContactPhone}
                onChange={(e) => setEmergencyContactPhone(e.target.value)}
                placeholder="e.g. 03217654321"
                className="w-full h-9 px-3 text-xs bg-white border border-zinc-300 rounded-lg font-mono text-zinc-900 focus:border-[#0D7A5F] focus:ring-1 focus:ring-[#0D7A5F] outline-none shadow-2xs"
              />
            </div>
          </div>
        </div>

        {/* 3. Employment & Organization */}
        <div className="space-y-3 p-3.5 bg-zinc-50 border border-zinc-200 rounded-xl">
          <h3 className="text-xs font-bold text-zinc-800 flex items-center gap-1.5">
            <Building2 className="w-3.5 h-3.5 text-[#0D7A5F]" />
            Employment & Organization
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1">
                Department
              </label>
              <SearchableSelect
                value={department}
                onChange={setDepartment}
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
            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1">
                Role Classification
              </label>
              <SearchableSelect
                value={role}
                onChange={setRole}
                options={[
                  { value: "technician", label: "Technician (Field HVAC)" },
                  { value: "dispatcher", label: "Dispatcher (Ops Coordinator)" },
                  { value: "storekeeper", label: "Storekeeper (Warehouse)" },
                  { value: "accountant", label: "Accountant (Finance)" },
                  { value: "call_center", label: "Call Center Agent" },
                  { value: "hr", label: "HR Manager / Officer" },
                  { value: "admin", label: "System Administrator" },
                ]}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1">
                Official Designation / Title
              </label>
              <input
                type="text"
                value={designation}
                onChange={(e) => setDesignation(e.target.value)}
                placeholder="e.g. Senior Inverter HVAC Specialist"
                className="w-full h-9 px-3 text-xs bg-white border border-zinc-300 rounded-lg text-zinc-900 focus:border-[#0D7A5F] focus:ring-1 focus:ring-[#0D7A5F] outline-none shadow-2xs"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1">
                Employment Type
              </label>
              <SearchableSelect
                value={employmentType}
                onChange={setEmploymentType}
                options={[
                  { value: "Full-time", label: "Full-time Regular" },
                  { value: "Contract", label: "Fixed-Term Contract" },
                  { value: "Probation", label: "Probationary Period" },
                  { value: "Part-time", label: "Part-time" },
                ]}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1">
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
            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1">
                Employment Status
              </label>
              <SearchableSelect
                value={status}
                onChange={setStatus}
                options={[
                  { value: "Active", label: "Active" },
                  { value: "On Leave", label: "On Leave" },
                  { value: "Resigning", label: "Resigning" },
                  { value: "Terminated", label: "Terminated" },
                  { value: "Inactive", label: "Inactive" },
                ]}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1">
                Probation Status
              </label>
              <SearchableSelect
                value={probationStatus}
                onChange={setProbationStatus}
                options={[
                  { value: "Confirmed", label: "Confirmed Staff" },
                  { value: "On Probation", label: "On Probation" },
                ]}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-700 mb-1">
              Reporting Manager
            </label>
            <SearchableSelect
              value={reportingManagerId}
              onChange={setReportingManagerId}
              placeholder="-- No Direct Manager (Executive) --"
              clearable={true}
              options={[
                { value: "", label: "-- No Direct Manager (Executive) --" },
                ...managers
                  .filter((m) => m.id !== employee?.id)
                  .map((m) => ({
                    value: String(m.id),
                    label: `${m.name} (${m.designation || m.role})`,
                  })),
              ]}
            />
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
                placeholder="e.g. Muhammad Murtaza"
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
