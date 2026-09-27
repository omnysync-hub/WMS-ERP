const fs = require("fs");
const path = "src/contexts/RoleContext.tsx";
let s = fs.readFileSync(path, "utf8").replace(/\r\n/g, "\n");

const old = `      const savedPermissions = localStorage.getItem("workman_role_permissions");
      if (savedPermissions) {
        setRolePermissions(JSON.parse(savedPermissions));
      }`;

const neu = `      const savedPermissions = localStorage.getItem("workman_role_permissions");
      if (savedPermissions) {
        // Merge with defaults so newly added procurement.* keys are not stuck false/undefined
        const parsed = JSON.parse(savedPermissions) as Record<string, Record<string, boolean>>;
        const merged: Record<string, Record<string, boolean>> = { ...DEFAULT_ROLE_PERMISSIONS };
        for (const [roleKey, perms] of Object.entries(parsed)) {
          merged[roleKey] = { ...(DEFAULT_ROLE_PERMISSIONS[roleKey] || {}), ...perms };
          // Prefer default for brand-new keys that were absent in the saved blob
          const defaults = DEFAULT_ROLE_PERMISSIONS[roleKey] || {};
          for (const [pk, pv] of Object.entries(defaults)) {
            if (perms[pk] === undefined) {
              merged[roleKey][pk] = pv;
            }
          }
        }
        // Ensure new roles (purchasing/manager) exist even if absent from saved blob
        for (const roleKey of Object.keys(DEFAULT_ROLE_PERMISSIONS)) {
          if (!merged[roleKey]) merged[roleKey] = DEFAULT_ROLE_PERMISSIONS[roleKey];
        }
        setRolePermissions(merged);
      }`;

if (!s.includes(old)) {
  if (s.includes("newly added procurement")) {
    console.log("already merged");
  } else {
    throw new Error("savedPermissions block not found");
  }
} else {
  s = s.replace(old, neu);
  fs.writeFileSync(path, s.replace(/\n/g, "\r\n"));
  console.log("localStorage merge OK");
}
