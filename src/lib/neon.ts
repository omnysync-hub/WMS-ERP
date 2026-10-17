import { prisma } from "@/lib/prisma";

export interface NeonServiceStatus {
  postgres: {
    connected: boolean;
    branch: string;
    unpooled: boolean;
    latencyMs?: number;
    error?: string;
  };
  functions: {
    helloUrl: string | null;
    status: "ok" | "error" | "unconfigured";
    response?: string;
    error?: string;
  };
}

/**
 * Invoke a deployed Neon Serverless Function via its base URL
 */
export async function callNeonFunction(
  functionName: "hello",
  options?: RequestInit
): Promise<{ ok: boolean; status: number; text: string }> {
  const baseUrl = process.env.NEON_FUNCTION_HELLO_BASE_URL;
  if (!baseUrl) {
    throw new Error("NEON_FUNCTION_HELLO_BASE_URL is not configured.");
  }

  const normalizedUrl = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  const res = await fetch(normalizedUrl, {
    method: "GET",
    ...options,
  });

  const text = await res.text();
  return {
    ok: res.ok,
    status: res.status,
    text,
  };
}

/**
 * Diagnostics and end-to-end connectivity check for all configured Neon services
 */
export async function getNeonServiceStatus(): Promise<NeonServiceStatus> {
  const branch = process.env.NEON_BRANCH || "production";
  const hasUnpooled = Boolean(process.env.DATABASE_URL_UNPOOLED);

  // 1. Check Neon Postgres
  let postgresConnected = false;
  let latencyMs: number | undefined;
  let postgresError: string | undefined;

  try {
    const start = Date.now();
    await prisma.$queryRaw`SELECT 1 as connected`;
    latencyMs = Date.now() - start;
    postgresConnected = true;
  } catch (err: unknown) {
    postgresError = err instanceof Error ? err.message : String(err);
  }

  // 2. Check Neon Functions
  const helloUrl = process.env.NEON_FUNCTION_HELLO_BASE_URL || null;
  let functionStatus: "ok" | "error" | "unconfigured" = "unconfigured";
  let functionResponse: string | undefined;
  let functionError: string | undefined;

  if (helloUrl) {
    try {
      const res = await callNeonFunction("hello");
      if (res.ok) {
        functionStatus = "ok";
        functionResponse = res.text;
      } else {
        functionStatus = "error";
        functionError = `HTTP ${res.status}: ${res.text}`;
      }
    } catch (err: unknown) {
      functionStatus = "error";
      functionError = err instanceof Error ? err.message : String(err);
    }
  }

  return {
    postgres: {
      connected: postgresConnected,
      branch,
      unpooled: hasUnpooled,
      latencyMs,
      error: postgresError,
    },
    functions: {
      helloUrl,
      status: functionStatus,
      response: functionResponse,
      error: functionError,
    },
  };
}
