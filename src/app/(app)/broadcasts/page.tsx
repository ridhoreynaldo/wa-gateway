import Link from "next/link";
import { ownerScope, requirePermission } from "@/modules/auth/guards";
import { listCampaigns } from "@/modules/broadcast/repository";
import { Badge, btn, btnGhost, Card, fmtDate, PageTitle, Table, td, th } from "@/shared/ui";
import { AutoRefresh } from "../auto-refresh";

export default async function BroadcastsPage() {
  const me = await requirePermission("broadcast:manage");
  const rows = await listCampaigns(ownerScope(me));
  const anyRunning = rows.some((r) => r.status === "running");

  return (
    <>
      {anyRunning && <AutoRefresh ms={8000} />}
      <PageTitle sub="Broadcast dikirim pelan dengan jeda acak, batas per jam/hari, dan jam kirim — agar nomor tetap aman.">Broadcast</PageTitle>
      <div className="mb-4"><Link href="/broadcasts/new" className={btn}>+ Broadcast baru</Link></div>
      <Card>
        <Table>
          <thead><tr><th className={th}>Nama</th><th className={th}>Nomor</th><th className={th}>Status</th><th className={th}>Progres</th><th className={th}>Dibuat</th><th className={th}></th></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((c) => {
              const done = c.sent + c.failed + c.skipped;
              return (
                <tr key={c.id}>
                  <td className={td}>{c.name}</td><td className={td}>{c.sessionName}</td><td className={td}><Badge v={c.status} /></td>
                  <td className={td}>{done}/{c.total} <span className="text-xs text-slate-400">(✔{c.sent} ✖{c.failed} ↷{c.skipped})</span></td>
                  <td className={td}>{fmtDate(c.createdAt)}</td>
                  <td className={`${td} text-right`}><Link href={`/broadcasts/${c.id}`} className={btnGhost}>Detail</Link></td>
                </tr>
              );
            })}
            {!rows.length && <tr><td className={td} colSpan={6}>Belum ada broadcast.</td></tr>}
          </tbody>
        </Table>
      </Card>
    </>
  );
}
