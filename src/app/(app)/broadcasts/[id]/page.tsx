import { notFound } from "next/navigation";
import { ownerScope, requirePermission } from "@/modules/auth/guards";
import { cancelCampaignAction, deleteCampaignAction, pauseCampaignAction, startCampaignAction } from "@/modules/broadcast/actions";
import { campaignRecipientsPage, getCampaign } from "@/modules/broadcast/repository";
import { Badge, btn, btnDanger, btnGhost, Card, fmtDate, PageTitle, Table, td, th } from "@/shared/ui";
import { AutoRefresh } from "../../auto-refresh";

type Status = "pending" | "sent" | "failed" | "skipped";

export default async function CampaignDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ f?: string }> }) {
  const me = await requirePermission("broadcast:manage");
  const { id } = await params;
  const { f } = await searchParams;
  const row = await getCampaign(id, ownerScope(me));
  if (!row) notFound();
  const { c } = row;
  const filter = (["pending", "sent", "failed", "skipped"] as const).find((x) => x === f) as Status | undefined;
  const recipients = await campaignRecipientsPage(id, filter, 100);
  const done = c.sentCount + c.failedCount + c.skippedCount;
  const pct = c.total ? Math.round((done / c.total) * 100) : 0;
  const hid = <input type="hidden" name="id" value={id} />;

  return (
    <>
      {c.status === "running" && <AutoRefresh ms={5000} />}
      <PageTitle sub={`Nomor: ${row.sessionName} (${row.sessionStatus})`}>{c.name}</PageTitle>

      <Card
        title="Status"
        right={
          <div className="flex gap-2">
            {(c.status === "draft" || c.status === "paused") && <form action={startCampaignAction}>{hid}<button className={btn} disabled={row.sessionStatus !== "connected"}>{c.status === "draft" ? "Mulai" : "Lanjutkan"}</button></form>}
            {c.status === "running" && <form action={pauseCampaignAction}>{hid}<button className={btnGhost}>Jeda</button></form>}
            {["draft", "running", "paused"].includes(c.status) && <form action={cancelCampaignAction}>{hid}<button className={btnDanger}>Batalkan</button></form>}
            {c.status !== "running" && <form action={deleteCampaignAction}>{hid}<button className={btnDanger}>Hapus</button></form>}
          </div>
        }
      >
        <div className="mb-3 flex items-center gap-3"><Badge v={c.status} /><span className="text-sm">{done}/{c.total} ({pct}%)</span></div>
        <div className="mb-4 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full bg-emerald-500" style={{ width: `${pct}%` }} /></div>
        {c.pauseReason && c.status === "paused" && <p className="mb-3 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">{c.pauseReason}</p>}
        <dl className="grid grid-cols-2 gap-3 text-sm md:grid-cols-5">
          <div><dt className="text-slate-500">Terkirim</dt><dd className="font-semibold">{c.sentCount}</dd></div>
          <div><dt className="text-slate-500">Gagal</dt><dd className="font-semibold">{c.failedCount}</dd></div>
          <div><dt className="text-slate-500">Dilewati</dt><dd className="font-semibold">{c.skippedCount}</dd></div>
          <div><dt className="text-slate-500">Jeda</dt><dd className="font-semibold">{c.minDelaySec}–{c.maxDelaySec} dtk</dd></div>
          <div><dt className="text-slate-500">Jam kirim</dt><dd className="font-semibold">{c.windowStartHour}:00–{c.windowEndHour}:00</dd></div>
          <div><dt className="text-slate-500">Maks/jam</dt><dd className="font-semibold">{c.hourlyLimit}</dd></div>
          <div><dt className="text-slate-500">Maks/hari</dt><dd className="font-semibold">{c.dailyLimit}</dd></div>
          <div><dt className="text-slate-500">Mulai</dt><dd className="font-semibold">{fmtDate(c.startedAt)}</dd></div>
          <div><dt className="text-slate-500">Selesai</dt><dd className="font-semibold">{fmtDate(c.finishedAt)}</dd></div>
        </dl>
      </Card>

      <Card title="Template"><pre className="whitespace-pre-wrap text-sm">{c.template}</pre></Card>

      <Card title="Penerima (100 pertama)" right={
        <div className="flex gap-1 text-xs">
          {[undefined, "pending", "sent", "failed", "skipped"].map((s) => (
            <a key={s ?? "all"} href={s ? `?f=${s}` : "?"} className={`rounded px-2 py-1 ${filter === s ? "bg-emerald-100" : "hover:bg-slate-100"}`}>{s ?? "semua"}</a>
          ))}
        </div>
      }>
        <Table>
          <thead><tr><th className={th}>Nomor</th><th className={th}>Nama</th><th className={th}>Status</th><th className={th}>Waktu</th><th className={th}>Keterangan</th></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {recipients.map((r) => (
              <tr key={r.id}><td className={td}>{r.phone}</td><td className={td}>{r.name ?? "—"}</td><td className={td}><Badge v={r.status} /></td><td className={td}>{fmtDate(r.sentAt)}</td><td className={`${td} text-xs text-slate-500`}>{r.error}</td></tr>
            ))}
          </tbody>
        </Table>
      </Card>
    </>
  );
}
