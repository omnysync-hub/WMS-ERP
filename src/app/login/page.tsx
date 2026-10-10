"use client";

import { FormEvent, useMemo, useState } from "react";
import { Eye, EyeOff, LockKeyhole, ShieldCheck, Wrench, ArrowRight, CheckCircle2 } from "lucide-react";
import { DEVELOPMENT_DEMO_PASSWORD, DEVELOPMENT_DEMO_USERS, ERP_ROLE_OPTIONS } from "@/lib/auth/erpRoles";

export default function LoginPage() {
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberLogin, setRememberLogin] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const demoEnabled = process.env.NODE_ENV !== "production" || process.env.NEXT_PUBLIC_ENABLE_DEMO_LOGIN === "true";
  const roleLabels = useMemo(() => Object.fromEntries(ERP_ROLE_OPTIONS.map((role) => [role.key, role.label])), []);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    if (!login.trim() || !password) {
      setError("Enter your username or email and password.");
      return;
    }
    setSubmitting(true);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ login: login.trim(), password, deviceLabel: navigator.userAgent }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Could not sign in.");
      if (rememberLogin) localStorage.setItem("workman_last_login", login.trim());
      else localStorage.removeItem("workman_last_login");
      const next = new URLSearchParams(window.location.search).get("next");
      if (data.user?.mustChangePassword) {
        window.location.assign("/change-password");
      } else {
        window.location.assign(next && next.startsWith("/") && !next.startsWith("//") ? next : "/dashboards");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not sign in. Please try again.");
      setSubmitting(false);
    }
  }

  function selectDemo(username: string) {
    setLogin(username);
    setPassword(DEVELOPMENT_DEMO_PASSWORD);
    setError("");
  }

  return (
    <main className="min-h-screen bg-[#0b1714] text-white grid lg:grid-cols-[1.08fr_0.92fr]">
      <section className="relative hidden lg:flex overflow-hidden px-14 py-12 flex-col justify-between border-r border-white/10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(16,185,129,0.22),transparent_38%),radial-gradient(circle_at_75%_80%,rgba(59,130,246,0.12),transparent_42%)]" />
        <div className="absolute -right-24 top-28 h-72 w-72 rounded-full border border-emerald-300/10" />
        <div className="absolute -right-10 top-42 h-44 w-44 rounded-full border border-emerald-300/10" />

        <div className="relative flex items-center gap-3">
          <div className="h-11 w-11 rounded-2xl bg-emerald-500 text-[#08211a] flex items-center justify-center shadow-lg shadow-emerald-950/30">
            <Wrench className="h-5 w-5" />
          </div>
          <div>
            <p className="font-extrabold tracking-tight text-lg">Workman Services</p>
            <p className="text-xs text-emerald-200/70">Operations command center</p>
          </div>
        </div>

        <div className="relative max-w-xl">
          <span className="inline-flex items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1.5 text-xs font-semibold text-emerald-200">
            <ShieldCheck className="h-3.5 w-3.5" /> Secure role-based workspace
          </span>
          <h1 className="mt-6 text-5xl font-black leading-[1.08] tracking-[-0.04em]">
            Every team sees the work that matters to them.
          </h1>
          <p className="mt-5 max-w-lg text-base leading-7 text-slate-300">
            Manage jobs, dispatch, stock, procurement, accounts, customer care, and approvals from one controlled workspace.
          </p>
          <div className="mt-8 grid grid-cols-2 gap-3 text-sm text-slate-200">
            {["Protected user sessions", "Role-specific access", "Automatic login lockout", "Immediate access revocation"].map((item) => (
              <div key={item} className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-3">
                <CheckCircle2 className="h-4 w-4 text-emerald-400" /> {item}
              </div>
            ))}
          </div>
        </div>

        <p className="relative text-xs text-slate-500">Authorized staff only · Activity is recorded for operational security</p>
      </section>

      <section className="flex min-h-screen items-center justify-center bg-[#f7f8f7] px-5 py-10 text-[#18181b] sm:px-10">
        <div className="w-full max-w-[460px]">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <div className="h-10 w-10 rounded-xl bg-[#0D7A5F] text-white flex items-center justify-center"><Wrench className="h-5 w-5" /></div>
            <div><p className="font-extrabold">Workman Services</p><p className="text-xs text-slate-500">Operations command center</p></div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_24px_80px_rgba(15,23,42,0.10)] sm:p-8">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#0D7A5F]">Welcome back</p>
              <h2 className="mt-2 text-3xl font-black tracking-tight">Sign in to your workspace</h2>
              <p className="mt-2 text-sm text-slate-500">Use the account provided by your administrator.</p>
            </div>

            <form onSubmit={handleSubmit} className="mt-7 space-y-4" noValidate>
              <div>
                <label htmlFor="login" className="mb-1.5 block text-xs font-bold text-slate-700">Username or email</label>
                <input
                  id="login"
                  autoComplete="username"
                  autoFocus
                  value={login}
                  onChange={(event) => setLogin(event.target.value)}
                  placeholder="e.g. dispatcher"
                  className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3.5 text-sm outline-none transition focus:border-[#0D7A5F] focus:ring-4 focus:ring-emerald-100"
                />
              </div>
              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <label htmlFor="password" className="text-xs font-bold text-slate-700">Password</label>
                  <span className="text-[11px] text-slate-400">Contact an admin to reset it</span>
                </div>
                <div className="relative">
                  <LockKeyhole className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-400" />
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="Enter your password"
                    className="h-11 w-full rounded-xl border border-slate-300 bg-white pl-10 pr-11 text-sm outline-none transition focus:border-[#0D7A5F] focus:ring-4 focus:ring-emerald-100"
                  />
                  <button type="button" onClick={() => setShowPassword((value) => !value)} className="absolute right-2.5 top-2.5 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label={showPassword ? "Hide password" : "Show password"}>
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <label className="flex w-fit cursor-pointer items-center gap-2 text-xs text-slate-600">
                <input type="checkbox" checked={rememberLogin} onChange={(event) => setRememberLogin(event.target.checked)} className="h-4 w-4 rounded border-slate-300 accent-[#0D7A5F]" />
                Remember my username on this device
              </label>

              {error && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-3 text-xs font-medium text-rose-700">{error}</div>}

              <button disabled={submitting} className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#0D7A5F] text-sm font-bold text-white shadow-lg shadow-emerald-900/10 transition hover:bg-[#0A624C] disabled:cursor-wait disabled:opacity-60">
                {submitting ? "Signing in…" : <>Sign in securely <ArrowRight className="h-4 w-4" /></>}
              </button>
            </form>

            {demoEnabled && (
              <div className="mt-7 border-t border-slate-200 pt-6">
                <div className="flex items-center justify-between gap-3">
                  <div><p className="text-xs font-bold text-slate-800">Demo accounts</p><p className="text-[11px] text-slate-500">For local testing only · password: <span className="font-mono font-bold">{DEVELOPMENT_DEMO_PASSWORD}</span></p></div>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {DEVELOPMENT_DEMO_USERS.map((user) => (
                    <button key={user.username} type="button" onClick={() => selectDemo(user.username)} className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 text-left transition hover:border-emerald-300 hover:bg-emerald-50">
                      <span className="block truncate text-[11px] font-bold text-slate-800">{roleLabels[user.role]}</span>
                      <span className="block truncate font-mono text-[10px] text-slate-500">{user.username}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
          <p className="mt-5 text-center text-[11px] text-slate-400">Your session is limited to one browser at a time and expires automatically.</p>
        </div>
      </section>
    </main>
  );
}
