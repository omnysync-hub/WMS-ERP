/**
 * Client helper: attach ERP demo actor headers to procurement API fetches.
 * Server RBAC reads the same headers via requireProcurementPermission.
 */
"use client";

export function procurementActorHeaders(
  role: string,
  name?: string,
  userId?: string
): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "x-actor-role": role || "anonymous",
  };
  if (name) headers["x-actor-name"] = name;
  if (userId) headers["x-user-id"] = userId;
  return headers;
}

export async function procurementFetch(
  input: RequestInfo | URL,
  init: RequestInit & { role: string; actorName?: string; userId?: string }
) {
  const { role, actorName, userId, headers: extra, ...rest } = init;
  const headers = {
    ...procurementActorHeaders(role, actorName, userId),
    ...(extra || {}),
  };
  return fetch(input, { ...rest, headers });
}
