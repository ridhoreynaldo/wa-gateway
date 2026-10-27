import { ownerScope, requirePermission } from "@/modules/auth/guards";
import {
  connectSessionAction, createSessionAction, deleteSessionAction, disconnectSessionAction,
  logoutSessionAction, resyncSessionAction,
} from "@/modules/wa-sessions/actions";
import { listSessions } from "@/modules/wa-sessions/repository";
import { warmupLimit } from "@/modules/broadcast/limits";
import { Badge, btn, btnDanger, btnGhost, Card, fmtDate, input, PageTitle, Table, td, th } from "@/shared/ui";
import { QrPanel } from "./qr-panel";

export default async function SessionsPage() {
  const me = await requirePermission("session:manage");
  const sessions = await listSessions(ownerScope(me));

  return (
    <>
      <PageTitle sub="Scan QR untuk menautkan nomor. Tiap nomor punya batas kirim & warm-up sendiri.">Nomor WhatsApp</PageTitle>

      <Card title="Tambah nomor">
        <form action={createSessionAction} className="flex gap-2">
          <input name="name" placeholder="Nama (mis. CS Toko A)" required minLength={2} className={input} />
          <button className={btn}>Tambah & scan</button>
        </form>
      </Card>

      <Card title={`Daftar nomor (${sessions.length})`}>
        <Table>
          <thead><tr><th className={th}>Nama</th><th className={th}>Nomor</th><th className={th}>Status</th><th className={th}>Batas hari ini</th><th className={th}>Pemilik</th><th className={th}></th></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {sessions.map((s) => (
              <tr key={s.id} className="align-top">
                <td className={td}>
                  <div className="font-medium">{s.name}</div>
                  <div className="text-xs text-slate-400">terakhir tersambung {fmtDate(s.lastConnectedAt)}</div>
                </td>
                <td className={td}>{s.phone ?? "—"}</td>
                <td className={td}>
                  <Badge v={s.status} />
                  {(s.status === "qr" || s.status === "connecting") && (
                    <div className="mt-3"><QrPanel sessionId={s.id} initialStatus={s.status} /></div>
                  )}
                </td>
                <td className={td}>≤ {warmupLimit(s.warmupStartedAt)} pesan (warm-up)</td>
                <td className={td}>{s.ownerName}</td>
                <td className={`${td} space-y-1 text-right`}>
                  <div className="flex flex-wrap justify-end gap-1">
                    {s.status !== "connected" && (
                      <form action={connectSessionAction}><input type="hidden" name="id" value={s.id} /><button className={btn}>{s.status === "logged_out" ? "Scan ulang" : "Hubungkan"}</button></form>
                    )}
                    {s.status === "connected" && (
                      <>
                        <form action={resyncSessionAction}><input type="hidden" name="id" value={s.id} /><button className={btnGhost}>Sync grup</button></form>
                        <form action={disconnectSessionAction}><input type="hidden" name="id" value={s.id} /><button className={btnGhost}>Putus</button></form>
                        <form action={logoutSessionAction}><input type="hidden" name="id" value={s.id} /><button className={btnGhost}>Logout WA</button></form>
                      </>
                    )}
                    <form action={deleteSessionAction}><input type="hidden" name="id" value={s.id} /><button className={btnDanger}>Hapus</button></form>
                  </div>
                </td>
              </tr>
            ))}
            {!sessions.length && <tr><td className={td} colSpan={6}>Belum ada nomor.</td></tr>}
          </tbody>
        </Table>
      </Card>
    </>
  );
}
