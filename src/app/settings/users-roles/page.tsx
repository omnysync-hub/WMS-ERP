"use client";

import React, { useState } from "react";
import PageHeader from "@/components/layout/PageHeader";
import { useRole, SystemUser, RoleType } from "@/contexts/RoleContext";
import { PERMISSION_GROUPS, ALL_PERMISSION_KEYS } from "@/lib/permissions";
import {
  Users,
  ShieldCheck,
  Plus,
  Search,
  CheckCircle2,
  AlertTriangle,
  Lock,
  Unlock,
  Edit2,
  Trash2,
  Sliders,
  Briefcase,
  MapPin,
  Package,
  ShoppingCart,
  CreditCard,
  UserCheck,
  Check,
  X,
  Layers,
  Sparkles,
  User,
  Filter,
} from "lucide-react";

export default function UsersAndRolesSettingsPage() {
  const {
    activeRole,
    currentRole,
    setRole,
    availablePersonas,
    rolePermissions,
    updateRolePermissions,
    toggleRolePermission,
    createRole,
    deleteRole,
    users,
    activeUser,
    setActiveUserId,
    createUser,
    updateUser,
    toggleUserStatus,
    deleteUser,
    setUserPermissionOverride,
  } = useRole();

  const [activeTab, setActiveTab] = useState<"users" | "roles" | "overrides">("users");
  const [selectedRoleKey, setSelectedRoleKey] = useState<string>("storekeeper");
  const [userSearch, setUserSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [notification, setNotification] = useState("");

  // Modals
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState<SystemUser | null>(null);
  const [showCreateRoleModal, setShowCreateRoleModal] = useState(false);
  const [selectedUserForOverride, setSelectedUserForOverride] = useState<SystemUser | null>(null);

  // New User Form State
  const [formName, setFormName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formUsername, setFormUsername] = useState("");
  const [formRole, setFormRole] = useState<RoleType>("call_center");
  const [formDesignation, setFormDesignation] = useState("");
  const [formDepartment, setFormDepartment] = useState("Customer Care & Operations");
  const [formStatus, setFormStatus] = useState<"active" | "suspended">("active");

  // New Role Form State
  const [newRoleKey, setNewRoleKey] = useState("");
  const [newRoleName, setNewRoleName] = useState("");
  const [newRoleDesignation, setNewRoleDesignation] = useState("");
  const [newRoleDepartment, setNewRoleDepartment] = useState("");
  const [newRoleDesc, setNewRoleDesc] = useState("");
  const [cloneFromRole, setCloneFromRole] = useState<string>("call_center");

  const notify = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(""), 4000);
  };

  const handleOpenAddUser = () => {
    setEditingUser(null);
    setFormName("");
    setFormEmail("");
    setFormUsername("");
    setFormRole("call_center");
    setFormDesignation("Operations Coordinator");
    setFormDepartment("Customer Care & Operations");
    setFormStatus("active");
    setShowAddUserModal(true);
  };

  const handleOpenEditUser = (user: SystemUser) => {
    setEditingUser(user);
    setFormName(user.name);
    setFormEmail(user.email);
    setFormUsername(user.username);
    setFormRole(user.role);
    setFormDesignation(user.designation);
    setFormDepartment(user.department);
    setFormStatus(user.status);
    setShowAddUserModal(true);
  };

  const handleSaveUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formUsername.trim()) {
      return alert("Name and Username are required");
    }

    const persona = availablePersonas.find((p) => p.role === formRole);
    const badgeColor = persona?.badgeColor || "bg-teal-600 text-white";

    if (editingUser) {
      updateUser(editingUser.id, {
        name: formName.trim(),
        email: formEmail.trim(),
        username: formUsername.trim(),
        role: formRole,
        designation: formDesignation.trim(),
        department: formDepartment.trim(),
        status: formStatus,
        badgeColor,
      });
      notify(`User '${formName}' updated successfully`);
    } else {
      createUser({
        name: formName.trim(),
        email: formEmail.trim(),
        username: formUsername.trim(),
        role: formRole,
        designation: formDesignation.trim(),
        department: formDepartment.trim(),
        status: formStatus,
        avatar: formName
          .split(" ")
          .map((n) => n[0])
          .join("")
          .slice(0, 2)
          .toUpperCase(),
        badgeColor,
      });
      notify(`New user '${formName}' created successfully`);
    }

    setShowAddUserModal(false);
  };

  const handleCreateRoleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanKey = newRoleKey.trim().toLowerCase().replace(/\s+/g, "_");
    if (!cleanKey || !newRoleName.trim()) {
      return alert("Role key and display name are required");
    }

    if (availablePersonas.some((p) => p.role === cleanKey)) {
      return alert(`Role key '${cleanKey}' already exists`);
    }

    const clonedPermissions = rolePermissions[cloneFromRole] || {};

    createRole(
      {
        id: `role-${cleanKey}-${Date.now().toString().slice(-4)}`,
        name: newRoleName.trim(),
        role: cleanKey,
        designation: newRoleDesignation.trim() || newRoleName.trim(),
        department: newRoleDepartment.trim() || "Operations",
        email: `${cleanKey}@company.com`,
        avatar: cleanKey.slice(0, 2).toUpperCase(),
        badgeColor: "bg-indigo-600 text-white",
        description: newRoleDesc.trim() || `Custom defined ERP role for ${newRoleName}`,
        primaryModules: ["Jobs", "Inventory"],
      },
      clonedPermissions
    );

    setSelectedRoleKey(cleanKey);
    setShowCreateRoleModal(false);
    notify(`Custom role '${newRoleName}' created and configured with cloned permissions`);
  };

  const handleEnableAllForGroup = (roleKey: string, groupKeys: string[]) => {
    const patch: Record<string, boolean> = {};
    groupKeys.forEach((k) => (patch[k] = true));
    updateRolePermissions(roleKey, patch);
    notify(`All sub-parts enabled for ${roleKey}`);
  };

  const handleDisableAllForGroup = (roleKey: string, groupKeys: string[]) => {
    const patch: Record<string, boolean> = {};
    groupKeys.forEach((k) => (patch[k] = false));
    updateRolePermissions(roleKey, patch);
    notify(`All sub-parts disabled for ${roleKey}`);
  };

  const filteredUsers = users.filter((u) => {
    const matchRole = roleFilter === "all" || u.role === roleFilter;
    const q = userSearch.toLowerCase();
    const matchSearch =
      !q ||
      u.name.toLowerCase().includes(q) ||
      u.username.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      u.designation.toLowerCase().includes(q);
    return matchRole && matchSearch;
  });

  const getModuleIcon = (iconName: string) => {
    switch (iconName) {
      case "Briefcase":
        return <Briefcase className="w-4 h-4 text-blue-600" />;
      case "MapPin":
        return <MapPin className="w-4 h-4 text-emerald-600" />;
      case "Package":
        return <Package className="w-4 h-4 text-amber-600" />;
      case "ShoppingCart":
        return <ShoppingCart className="w-4 h-4 text-purple-600" />;
      case "CreditCard":
        return <CreditCard className="w-4 h-4 text-teal-600" />;
      case "UserCheck":
        return <UserCheck className="w-4 h-4 text-rose-600" />;
      default:
        return <ShieldCheck className="w-4 h-4 text-[#0D7A5F]" />;
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <PageHeader
        breadcrumbs={[
          { label: "Settings", href: "/settings" },
          { label: "Users & Granular Role Permissions" },
        ]}
        title="Software Settings: User Accounts & Granular Role Access"
        subtitle="Manage user accounts, create custom ERP roles, toggle account statuses on/off, and toggle every single sub-action permission across all modules."
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowCreateRoleModal(true)}
              className="h-8 px-3 rounded-lg border border-[#D4D4D8] hover:bg-[#F4F4F5] text-xs font-semibold text-[#18181B] inline-flex items-center gap-1.5 transition shadow-xs"
            >
              <Plus className="w-3.5 h-3.5 text-[#71717A]" />
              New User Role
            </button>
            <button
              onClick={handleOpenAddUser}
              className="h-8 px-3.5 rounded-lg bg-[#0D7A5F] hover:bg-[#0A624C] text-xs font-semibold text-white inline-flex items-center gap-1.5 transition shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              Create New User
            </button>
          </div>
        }
      />

      {notification && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-medium rounded-lg flex items-center justify-between animate-in fade-in duration-150">
          <span className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            {notification}
          </span>
          <button
            onClick={() => setNotification("")}
            className="text-emerald-700 hover:text-emerald-900 font-bold"
          >
            ✕
          </button>
        </div>
      )}

      {/* Impersonation & Active Testing Banner */}
      <div className="p-3.5 bg-slate-900 text-white rounded-xl shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-white/10 flex items-center justify-center text-emerald-400 font-bold font-mono">
            {activeUser.avatar || "ERP"}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold">{activeUser.name}</span>
              <span className="text-[10px] px-2 py-0.2 rounded-full font-mono font-bold bg-white/20 text-emerald-300">
                Current Active Session: {activeRole.toUpperCase()}
              </span>
              {activeUser.status === "suspended" && (
                <span className="text-[10px] px-2 py-0.2 rounded-full font-mono font-bold bg-rose-600 text-white">
                  ACCOUNT SUSPENDED
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Testing permissions live in real-time. Changes to toggles take immediate effect across all menus and buttons.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[11px] text-slate-300 font-mono">Switch Active User:</span>
          <select
            value={activeUser.id}
            onChange={(e) => setActiveUserId(e.target.value)}
            className="bg-slate-800 border border-slate-700 text-xs text-white rounded-lg px-2.5 py-1.5 outline-none focus:ring-1 focus:ring-[#0D7A5F]"
          >
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name} ({u.role}) {u.status === "suspended" ? "[SUSPENDED]" : ""}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Main Tab Controls */}
      <div className="flex items-center border-b border-[#E4E4E7] gap-2 overflow-x-auto bg-white px-4 rounded-xl border shadow-xs">
        <button
          onClick={() => setActiveTab("users")}
          className={`h-11 px-4 text-xs font-semibold inline-flex items-center gap-2 border-b-2 transition ${
            activeTab === "users"
              ? "border-[#0D7A5F] text-[#0D7A5F]"
              : "border-transparent text-[#71717A] hover:text-[#18181B]"
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          <span>User Accounts & Status Controls ({users.length})</span>
        </button>

        <button
          onClick={() => setActiveTab("roles")}
          className={`h-11 px-4 text-xs font-semibold inline-flex items-center gap-2 border-b-2 transition ${
            activeTab === "roles"
              ? "border-[#0D7A5F] text-[#0D7A5F]"
              : "border-transparent text-[#71717A] hover:text-[#18181B]"
          }`}
        >
          <Sliders className="w-3.5 h-3.5" />
          <span>Granular Sub-Part Permission Matrix</span>
        </button>
      </div>

      {/* TAB 1: USER ACCOUNTS DIRECTORY */}
      {activeTab === "users" && (
        <div className="bg-white rounded-xl border border-[#E4E4E7] shadow-xs overflow-hidden space-y-0">
          {/* Filters Bar */}
          <div className="px-5 py-3.5 bg-[#FAFAFA] border-b border-[#E4E4E7] flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative min-w-[240px]">
                <Search className="w-3.5 h-3.5 text-[#71717A] absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Search user name, username, email..."
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-[#D4D4D8] text-xs bg-white text-[#18181B] focus:outline-none focus:ring-1 focus:ring-[#0D7A5F]"
                />
              </div>

              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="bg-white border border-[#D4D4D8] text-xs text-[#18181B] rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#0D7A5F]"
              >
                <option value="all">All Roles ({availablePersonas.length})</option>
                {availablePersonas.map((p) => (
                  <option key={p.role} value={p.role}>
                    {p.name} ({p.role})
                  </option>
                ))}
              </select>
            </div>

            <span className="text-xs font-mono text-[#71717A]">
              {users.filter((u) => u.status === "active").length} active accounts •{" "}
              {users.filter((u) => u.status === "suspended").length} suspended
            </span>
          </div>

          {/* Users Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[#E4E4E7] text-[11px] font-semibold text-[#71717A] uppercase tracking-wider bg-[#F4F4F5]">
                  <th className="py-2.5 px-4">User & Credentials</th>
                  <th className="py-2.5 px-4">Assigned Role</th>
                  <th className="py-2.5 px-4">Designation & Department</th>
                  <th className="py-2.5 px-4 text-center">Account Access</th>
                  <th className="py-2.5 px-4 text-center">Status</th>
                  <th className="py-2.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E4E4E7] text-[#18181B]">
                {filteredUsers.map((u) => {
                  const isActive = u.status === "active";
                  return (
                    <tr
                      key={u.id}
                      className={`hover:bg-[#FAFAFA] transition ${
                        !isActive ? "bg-rose-50/20" : ""
                      }`}
                    >
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-mono font-bold text-xs ${u.badgeColor}`}>
                            {u.avatar || u.name[0]}
                          </div>
                          <div>
                            <div className="font-bold text-[#18181B] flex items-center gap-1.5">
                              {u.name}
                              {u.id === activeUser.id && (
                                <span className="text-[9px] px-1.5 py-0.2 rounded font-mono font-bold bg-[#0D7A5F]/10 text-[#0D7A5F]">
                                  YOU
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-[#71717A] font-mono">
                              @{u.username} • {u.email}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider bg-slate-100 text-slate-800 border border-slate-200">
                          {u.role.replace(/_/g, " ")}
                        </span>
                      </td>

                      <td className="py-3 px-4">
                        <div className="font-medium text-[#18181B]">{u.designation}</div>
                        <div className="text-[10px] text-[#71717A]">{u.department}</div>
                      </td>

                      {/* Instant Toggle Button */}
                      <td className="py-3 px-4 text-center">
                        <button
                          type="button"
                          onClick={() => toggleUserStatus(u.id)}
                          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold transition shadow-2xs border ${
                            isActive
                              ? "bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100"
                              : "bg-rose-50 text-rose-700 border-rose-300 hover:bg-rose-100"
                          }`}
                          title={isActive ? "Click to suspend account access" : "Click to restore account access"}
                        >
                          {isActive ? (
                            <>
                              <Unlock className="w-3 h-3 text-emerald-600" />
                              <span>Access Granted</span>
                            </>
                          ) : (
                            <>
                              <Lock className="w-3 h-3 text-rose-600" />
                              <span>Suspended</span>
                            </>
                          )}
                        </button>
                      </td>

                      <td className="py-3 px-4 text-center">
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full font-bold border font-mono ${
                            isActive
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                              : "bg-rose-100 text-rose-800 border-rose-300"
                          }`}
                        >
                          {isActive ? "ACTIVE" : "LOCKED"}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleOpenEditUser(u)}
                            className="p-1 rounded text-[#71717A] hover:text-[#18181B] hover:bg-[#F4F4F5] transition"
                            title="Edit User"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          {u.role !== "admin" && (
                            <button
                              onClick={() => {
                                if (confirm(`Are you sure you want to delete user ${u.name}?`)) {
                                  deleteUser(u.id);
                                }
                              }}
                              className="p-1 rounded text-[#71717A] hover:text-rose-600 hover:bg-rose-50 transition"
                              title="Delete User"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: ROLES & GRANULAR PERMISSION MATRIX */}
      {activeTab === "roles" && (
        <div className="space-y-6">
          {/* Role Selector Header */}
          <div className="bg-white p-4 rounded-xl border border-[#E4E4E7] shadow-xs">
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-[#E4E4E7]">
              <div>
                <h3 className="text-xs font-bold text-[#18181B] uppercase tracking-wider">
                  Select Role to Configure Granular Permissions
                </h3>
                <p className="text-[11px] text-[#71717A] mt-0.5">
                  Toggle on/off every single sub-action, button, and financial column for this role
                </p>
              </div>

              <button
                onClick={() => setShowCreateRoleModal(true)}
                className="px-3 py-1.5 bg-[#0D7A5F] hover:bg-[#0A624C] text-white text-xs font-bold rounded-lg transition inline-flex items-center gap-1.5 shadow-2xs"
              >
                <Plus className="w-3.5 h-3.5" /> Create Custom Role
              </button>
            </div>

            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              {availablePersonas.map((p) => {
                const isSelected = selectedRoleKey === p.role;
                return (
                  <button
                    key={p.role}
                    type="button"
                    onClick={() => setSelectedRoleKey(p.role)}
                    className={`py-2 px-3.5 rounded-xl border text-xs font-bold transition whitespace-nowrap flex items-center gap-2 ${
                      isSelected
                        ? "bg-[#0D7A5F]/10 border-[#0D7A5F] text-[#0D7A5F] shadow-xs"
                        : "bg-[#FAFAFA] border-[#E4E4E7] text-[#71717A] hover:border-slate-300"
                    }`}
                  >
                    <span className="w-2 h-2 rounded-full bg-current" />
                    <span>{p.name}</span>
                    <span className="text-[10px] font-mono font-normal opacity-70">({p.role})</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Active Role Meta Card */}
          {(() => {
            const persona = availablePersonas.find((p) => p.role === selectedRoleKey);
            const currentPerms = rolePermissions[selectedRoleKey] || {};
            const totalPermsCount = ALL_PERMISSION_KEYS.length;
            const enabledCount = ALL_PERMISSION_KEYS.filter((k) => currentPerms[k]).length;

            return (
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-[#18181B]">{persona?.name || selectedRoleKey}</span>
                    <span className="text-[10px] px-2 py-0.2 rounded-full font-mono font-bold bg-white text-slate-800 border border-slate-300">
                      KEY: {selectedRoleKey}
                    </span>
                  </div>
                  <p className="text-xs text-[#71717A] mt-1">{persona?.description}</p>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <div className="text-xs font-bold font-mono text-[#18181B]">
                      {enabledCount} / {totalPermsCount} Enabled
                    </div>
                    <div className="text-[10px] text-[#71717A]">Granular permissions</div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleEnableAllForGroup(selectedRoleKey, ALL_PERMISSION_KEYS)}
                      className="text-[11px] font-bold px-2.5 py-1 rounded border border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 transition"
                    >
                      Enable All
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDisableAllForGroup(selectedRoleKey, ALL_PERMISSION_KEYS)}
                      className="text-[11px] font-bold px-2.5 py-1 rounded border border-rose-300 bg-rose-50 text-rose-800 hover:bg-rose-100 transition"
                    >
                      Disable All
                    </button>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Granular Permission Groups Matrix */}
          <div className="space-y-6">
            {PERMISSION_GROUPS.map((group) => {
              const groupKeys = group.permissions.map((p) => p.key);
              const currentPerms = rolePermissions[selectedRoleKey] || {};
              const groupEnabledCount = groupKeys.filter((k) => currentPerms[k]).length;

              return (
                <div
                  key={group.id}
                  className="bg-white rounded-xl border border-[#E4E4E7] shadow-xs overflow-hidden"
                >
                  {/* Module Header */}
                  <div className="px-5 py-3.5 bg-[#FAFAFA] border-b border-[#E4E4E7] flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className="p-1.5 rounded-lg bg-white border border-[#E4E4E7]">
                        {getModuleIcon(group.iconName)}
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-[#18181B] flex items-center gap-2">
                          <span>{group.name}</span>
                          <span className="text-[10px] font-mono px-2 py-0.2 rounded-full bg-slate-100 text-slate-700">
                            {groupEnabledCount}/{group.permissions.length} ON
                          </span>
                        </h4>
                        <p className="text-[11px] text-[#71717A] mt-0.5">{group.description}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleEnableAllForGroup(selectedRoleKey, groupKeys)}
                        className="text-[10px] font-semibold text-emerald-700 hover:underline px-2 py-0.5 rounded hover:bg-emerald-50"
                      >
                        All ON
                      </button>
                      <span>•</span>
                      <button
                        type="button"
                        onClick={() => handleDisableAllForGroup(selectedRoleKey, groupKeys)}
                        className="text-[10px] font-semibold text-rose-600 hover:underline px-2 py-0.5 rounded hover:bg-rose-50"
                      >
                        All OFF
                      </button>
                    </div>
                  </div>

                  {/* Sub-Parts Grid */}
                  <div className="divide-y divide-[#E4E4E7]">
                    {group.permissions.map((perm) => {
                      const isGranted = Boolean(currentPerms[perm.key]);

                      return (
                        <div
                          key={perm.key}
                          className="p-4 flex items-center justify-between hover:bg-[#FAFAFA] transition gap-4 text-xs"
                        >
                          <div className="max-w-2xl">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-[#18181B]">{perm.label}</span>
                              <span className="text-[10px] font-mono text-[#A1A1AA]">({perm.key})</span>
                            </div>
                            <p className="text-[11px] text-[#71717A] mt-0.5">{perm.description}</p>
                          </div>

                          {/* Interactive Toggle Switch */}
                          <div className="flex items-center gap-2 shrink-0">
                            <span
                              className={`text-[10px] font-mono font-bold ${
                                isGranted ? "text-emerald-700" : "text-[#A1A1AA]"
                              }`}
                            >
                              {isGranted ? "ALLOWED" : "BLOCKED"}
                            </span>
                            <button
                              type="button"
                              onClick={() => toggleRolePermission(selectedRoleKey, perm.key)}
                              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                                isGranted ? "bg-[#0D7A5F]" : "bg-slate-300"
                              }`}
                              aria-label={`Toggle ${perm.label}`}
                            >
                              <span
                                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                                  isGranted ? "translate-x-5" : "translate-x-0"
                                }`}
                              />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* CREATE / EDIT USER MODAL */}
      {showAddUserModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white border border-[#EDEDED] rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150 text-[#18181B]">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#EDEDED] bg-[#F8FAFC]">
              <div>
                <h4 className="text-sm font-bold text-[#18181B] flex items-center gap-2">
                  <User className="w-4 h-4 text-[#0D7A5F]" />
                  {editingUser ? `Edit User: ${editingUser.name}` : "Create New ERP User Account"}
                </h4>
                <p className="text-[11px] text-[#71717A] mt-0.5">
                  Configure login username, assigned role, and initial account status
                </p>
              </div>
              <button
                onClick={() => setShowAddUserModal(false)}
                className="text-[#71717A] hover:text-[#18181B] text-lg font-bold px-2 py-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveUser} className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-mono text-[#71717A] mb-1">Full Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Asad Mehmood"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    className="w-full bg-white border border-[#D4D4D8] rounded-lg px-3 py-1.5 text-xs text-[#18181B] focus:ring-1 focus:ring-[#0D7A5F] outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-mono text-[#71717A] mb-1">Username (Login) *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. asad.ops"
                    value={formUsername}
                    onChange={(e) => setFormUsername(e.target.value)}
                    className="w-full bg-white border border-[#D4D4D8] rounded-lg px-3 py-1.5 text-xs text-[#18181B] font-mono focus:ring-1 focus:ring-[#0D7A5F] outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-mono text-[#71717A] mb-1">Official Email</label>
                  <input
                    type="email"
                    placeholder="asad@company.com"
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    className="w-full bg-white border border-[#D4D4D8] rounded-lg px-3 py-1.5 text-xs text-[#18181B] focus:ring-1 focus:ring-[#0D7A5F] outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-mono text-[#71717A] mb-1">Assigned Role *</label>
                  <select
                    value={formRole}
                    onChange={(e) => setFormRole(e.target.value as any)}
                    className="w-full bg-white border border-[#D4D4D8] rounded-lg px-3 py-1.5 text-xs text-[#18181B] outline-none"
                  >
                    {availablePersonas.map((p) => (
                      <option key={p.role} value={p.role}>
                        {p.name} ({p.role})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-mono text-[#71717A] mb-1">Job Designation</label>
                  <input
                    type="text"
                    placeholder="e.g. Operations Coordinator"
                    value={formDesignation}
                    onChange={(e) => setFormDesignation(e.target.value)}
                    className="w-full bg-white border border-[#D4D4D8] rounded-lg px-3 py-1.5 text-xs text-[#18181B] outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-mono text-[#71717A] mb-1">Department</label>
                  <input
                    type="text"
                    placeholder="e.g. Customer Care & Dispatch"
                    value={formDepartment}
                    onChange={(e) => setFormDepartment(e.target.value)}
                    className="w-full bg-white border border-[#D4D4D8] rounded-lg px-3 py-1.5 text-xs text-[#18181B] outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-mono text-[#71717A] mb-1">Account Access Status *</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setFormStatus("active")}
                    className={`p-2.5 rounded-lg border text-left flex items-center gap-2 transition ${
                      formStatus === "active"
                        ? "bg-emerald-50 border-emerald-500 text-emerald-800"
                        : "bg-white border-[#D4D4D8] text-[#71717A]"
                    }`}
                  >
                    <Unlock className="w-4 h-4 text-emerald-600" />
                    <div>
                      <div className="font-bold text-xs">Active</div>
                      <div className="text-[10px]">Normal system login</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFormStatus("suspended")}
                    className={`p-2.5 rounded-lg border text-left flex items-center gap-2 transition ${
                      formStatus === "suspended"
                        ? "bg-rose-50 border-rose-500 text-rose-800"
                        : "bg-white border-[#D4D4D8] text-[#71717A]"
                    }`}
                  >
                    <Lock className="w-4 h-4 text-rose-600" />
                    <div>
                      <div className="font-bold text-xs">Suspended</div>
                      <div className="text-[10px]">All access revoked</div>
                    </div>
                  </button>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-[#EDEDED]">
                <button
                  type="button"
                  onClick={() => setShowAddUserModal(false)}
                  className="px-4 py-2 rounded-lg border border-[#D4D4D8] text-xs text-[#71717A] hover:bg-[#F4F4F5]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-lg bg-[#0D7A5F] hover:bg-[#0A624C] text-white text-xs font-bold shadow-xs transition"
                >
                  {editingUser ? "Save Changes" : "Create User Account"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CREATE NEW ROLE MODAL */}
      {showCreateRoleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white border border-[#EDEDED] rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150 text-[#18181B]">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#EDEDED] bg-[#F8FAFC]">
              <div>
                <h4 className="text-sm font-bold text-[#18181B] flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-[#0D7A5F]" />
                  Create New User Role
                </h4>
                <p className="text-[11px] text-[#71717A] mt-0.5">
                  Define custom role identifier, title, department, and clone initial permissions
                </p>
              </div>
              <button
                onClick={() => setShowCreateRoleModal(false)}
                className="text-[#71717A] hover:text-[#18181B] text-lg font-bold px-2 py-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateRoleSubmit} className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-mono text-[#71717A] mb-1">
                    Role Key (Identifier) *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. workshop_lead, field_supervisor"
                    value={newRoleKey}
                    onChange={(e) => setNewRoleKey(e.target.value)}
                    className="w-full bg-white border border-[#D4D4D8] rounded-lg px-3 py-1.5 text-xs text-[#18181B] font-mono focus:ring-1 focus:ring-[#0D7A5F] outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-mono text-[#71717A] mb-1">
                    Role Display Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Workshop Lead Supervisor"
                    value={newRoleName}
                    onChange={(e) => setNewRoleName(e.target.value)}
                    className="w-full bg-white border border-[#D4D4D8] rounded-lg px-3 py-1.5 text-xs text-[#18181B] focus:ring-1 focus:ring-[#0D7A5F] outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-mono text-[#71717A] mb-1">Default Designation</label>
                  <input
                    type="text"
                    placeholder="e.g. Lead Technical Supervisor"
                    value={newRoleDesignation}
                    onChange={(e) => setNewRoleDesignation(e.target.value)}
                    className="w-full bg-white border border-[#D4D4D8] rounded-lg px-3 py-1.5 text-xs text-[#18181B] outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-mono text-[#71717A] mb-1">Department</label>
                  <input
                    type="text"
                    placeholder="e.g. Technical Services"
                    value={newRoleDepartment}
                    onChange={(e) => setNewRoleDepartment(e.target.value)}
                    className="w-full bg-white border border-[#D4D4D8] rounded-lg px-3 py-1.5 text-xs text-[#18181B] outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-mono text-[#71717A] mb-1">
                  Clone Initial Permissions From Template *
                </label>
                <select
                  value={cloneFromRole}
                  onChange={(e) => setCloneFromRole(e.target.value)}
                  className="w-full bg-white border border-[#D4D4D8] rounded-lg px-3 py-2 text-xs text-[#18181B] outline-none"
                >
                  {availablePersonas.map((p) => (
                    <option key={p.role} value={p.role}>
                      Clone from: {p.name} ({p.role})
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-[#71717A] mt-1">
                  You can fine-tune every individual sub-part toggle immediately after creation.
                </p>
              </div>

              <div>
                <label className="block text-[11px] font-mono text-[#71717A] mb-1">Description</label>
                <textarea
                  rows={2}
                  placeholder="e.g. Manages physical appliance repairs and workshop stock consumption"
                  value={newRoleDesc}
                  onChange={(e) => setNewRoleDesc(e.target.value)}
                  className="w-full bg-white border border-[#D4D4D8] rounded-lg p-2.5 text-xs text-[#18181B] outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-[#EDEDED]">
                <button
                  type="button"
                  onClick={() => setShowCreateRoleModal(false)}
                  className="px-4 py-2 rounded-lg border border-[#D4D4D8] text-xs text-[#71717A] hover:bg-[#F4F4F5]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-lg bg-[#0D7A5F] hover:bg-[#0A624C] text-white text-xs font-bold shadow-xs transition"
                >
                  Create & Configure Role
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
