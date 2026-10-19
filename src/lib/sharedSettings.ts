/**
 * Shared settings lists that used to live only in each browser's localStorage.
 * The server (/api/app-settings) is now the source of truth; localStorage is kept as a local cache
 * so the pages that already read these keys keep working unchanged.
 */
export const SHARED_SETTING_PERMISSIONS: Record<string, string[]> = {
  custom_job_types: ["jobs.manage", "settings.accounting"],
  custom_equipment_types: ["jobs.manage", "inventory.restock"],
  custom_hvac_brands: ["jobs.manage", "inventory.restock"],
  custom_hvac_models: ["jobs.manage", "inventory.restock"],
  workman_stock_units: ["inventory.stock_units"],
};

export const SHARED_SETTING_KEYS = Object.keys(SHARED_SETTING_PERMISSIONS);

function broadcast(key: string, value: unknown) {
  window.dispatchEvent(new Event("storage"));
  window.dispatchEvent(new CustomEvent(`${key}_updated`, { detail: value }));
}

/** Pull server values into localStorage (called once after sign-in, before pages render). */
export async function syncSharedSettingsFromServer(canWrite: (key: string) => boolean) {
  const response = await fetch("/api/app-settings", { cache: "no-store" });
  if (!response.ok) return;
  const data = await response.json().catch(() => ({}));
  const values = (data.settings || {}) as Record<string, unknown>;
  for (const key of SHARED_SETTING_KEYS) {
    if (values[key] !== undefined) {
      localStorage.setItem(key, JSON.stringify(values[key]));
      broadcast(key, values[key]);
    } else {
      // One-time migration: upload a list that so far only existed in this browser.
      const local = localStorage.getItem(key);
      if (local && canWrite(key)) {
        try {
          await pushSharedSetting(key, JSON.parse(local));
        } catch {
          // ignore; the next save will retry
        }
      }
    }
  }
}

/** Save a list to the server. Throws with the server's message when not allowed / invalid. */
export async function pushSharedSetting(key: string, value: unknown) {
  const response = await fetch("/api/app-settings", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ key, value }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Could not save this setting on the server.");
}
