import type { ReactNode } from "react";

export const btn =
  "inline-flex items-center justify-center rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50 cursor-pointer";
export const btnGhost =
  "inline-flex items-center justify-center rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100 cursor-pointer";
export const btnDanger =
  "inline-flex items-center justify-center rounded-md border border-red-300 bg-white px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 cursor-pointer";
export const input =
  "w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500";
export const label = "mb-1 block text-xs font-medium text-slate-600";
export const th = "px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500";
export const td = "px-3 py-2 text-sm";

export function Card({ title, children, right }: { title?: string; children: ReactNode; right?: ReactNode }) {
  return (
    <section className="mb-6 rounded-lg border border-slate-200 bg-white shadow-sm">
      {title && (
        <header className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <h2 className="text-sm font-semibold">{title}</h2>
          {right}
        </header>
      )}
      <div className="p-4">{children}</div>
    </section>
  );
}

export function PageTitle({ children, sub }: { children: ReactNode; sub?: string }) {
  return (
    <div className="mb-5">
      <h1 className="text-xl font-semibold">{children}</h1>
      {sub && <p className="mt-1 text-sm text-slate-500">{sub}</p>}
    </div>
  );
}

const tones: Record<string, string> = {
  connected: "bg-emerald-100 text-emerald-700",
  running: "bg-emerald-100 text-emerald-700",
  completed: "bg-sky-100 text-sky-700",
  qr: "bg-amber-100 text-amber-700",
  connecting: "bg-amber-100 text-amber-700",
  paused: "bg-amber-100 text-amber-700",
  draft: "bg-slate-100 text-slate-600",
  disconnected: "bg-slate-100 text-slate-600",
  cancelled: "bg-slate-100 text-slate-600",
  logged_out: "bg-red-100 text-red-700",
  failed: "bg-red-100 text-red-700",
  sent: "bg-emerald-100 text-emerald-700",
  pending: "bg-slate-100 text-slate-600",
  skipped: "bg-amber-100 text-amber-700",
  superadmin: "bg-violet-100 text-violet-700",
  admin: "bg-sky-100 text-sky-700",
};

export const Badge = ({ v }: { v: string }) => (
  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${tones[v] ?? "bg-slate-100 text-slate-600"}`}>{v}</span>
);

export const Table = ({ children }: { children: ReactNode }) => (
  <div className="overflow-x-auto">
    <table className="w-full divide-y divide-slate-100">{children}</table>
  </div>
);

export const fmtDate = (d: Date | null | undefined) =>
  d ? new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: process.env.TZ_APP ?? "Asia/Jakarta" }).format(d) : "—";
