import { eq, sql } from "drizzle-orm";
import { db } from "@/shared/db";
import { redis } from "@/shared/redis";
import { requireUser, ownerScope } from "@/modules/auth/guards";
import { campaigns } from "@/modules/broadcast/schema";
import { localParts } from "@/modules/broadcast/limits";
import { todayStats } from "@/modules/messaging/repository";
import { listSessions } from "@/modules/wa-sessions/repository";
import { Card, PageTitle } from "@/shared/ui";
import { AutoRefresh } from "./auto-refresh";

function Stat({ label, value, tone = "" }: { label: string; value: number | string; tone?: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="text-xs text-slate-500">{label}</div>
      <div className={`mt-1 text-2xl font-semibold ${tone}`}>{value}</div>
    </div>
  );
}

export default async function Dashboard() {
  const me = await requireUser();
  const scope = ownerScope(me);
  const sessions = await listSessions(scope);

  // awal hari lokal → filter statistik "hari ini"
  const lp = localParts();
  const startOfDay = new Date(Date.now() - (lp.hour * 60 + lp.minute) * 60_000);
  const [stats, running, beat] = await Promise.all([
    todayStats(sessions.map((s) => s.id), startOfDay),
    db().select({ n: sql<number>`count(*)::int` }).from(campaigns).where(scope ? sql`${campaigns.status} = 'running' and ${campaigns.ownerId} = ${scope}` : eq(campaigns.status, "running")),
    redis().get("wa:worker:heartbeat"),
  ]);
  const sum = (dir: string, st?: string) => stats.filter((s) => s.direction === dir && (!st || s.status === st)).reduce((a, b) => a + b.n, 0);
  const workerUp = beat && Date.now() - Number(beat) < 45_000;

  return (
    <>
      <AutoRefresh ms={10000} />
      <PageTitle sub={`Halo, ${me.name}`}>Dashboard</PageTitle>
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Nomor tersambung" value={`${sessions.filter((s) => s.status === "connected").length}/${sessions.length}`} />
        <Stat label="Broadcast berjalan" value={running[0]?.n ?? 0} />
        <Stat label="Pesan keluar hari ini" value={sum("out")} />
        <Stat label="Pesan masuk hari ini" value={sum("in")} />
        <Stat label="Terkirim" value={sum("out", "sent") + sum("out", "delivered") + sum("out", "read")} tone="text-emerald-600" />
        <Stat label="Dibaca" value={sum("out", "read")} tone="text-sky-600" />
        <Stat label="Gagal" value={sum("out", "failed")} tone="text-red-600" />
        <Stat label="Worker" value={workerUp ? "online" : "OFFLINE"} tone={workerUp ? "text-emerald-600" : "text-red-600"} />
      </div>
      <Card title="Catatan keamanan">
        <ul className="list-disc space-y-1 pl-5 text-sm text-slate-600">
          <li>Gunakan nomor yang sudah aktif/punya riwayat chat normal. Nomor baru wajib melewati warm-up.</li>
          <li>Kirim hanya ke penerima yang memang setuju menerima pesan; sertakan cara berhenti (balas STOP).</li>
          <li>Baileys bukan API resmi — risiko banned tidak bisa dihilangkan 100%.</li>
        </ul>
      </Card>
    </>
  );
}
