import Link from "next/link";
import { ownerScope, requirePermission } from "@/modules/auth/guards";
import { listGroups, listParticipants } from "@/modules/groups/repository";
import { listSessions } from "@/modules/wa-sessions/repository";
import { Badge, Card, PageTitle, Table, td, th } from "@/shared/ui";
import { SessionPicker } from "../session-picker";

type SP = Promise<{ s?: string; q?: string; g?: string }>;

export default async function GroupsPage({ searchParams }: { searchParams: SP }) {
  const me = await requirePermission("group:read");
  const sp = await searchParams;
  const sessions = await listSessions(ownerScope(me));
  const current = sessions.find((s) => s.id === sp.s) ?? sessions[0];
  const groups = current ? await listGroups(current.id, sp.q) : [];
  const selected = groups.find((g) => g.jid === sp.g);
  const members = current && selected ? await listParticipants(current.id, selected.jid) : [];

  return (
    <>
      <PageTitle sub="Grup & peserta hasil sinkron. Gunakan menu List Penerima → Impor dari grup untuk memasukkan peserta ke broadcast.">Grup</PageTitle>
      <SessionPicker sessions={sessions} selected={current?.id} q={sp.q} />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card title={`Grup (${groups.length})`}>
          <Table>
            <thead><tr><th className={th}>Nama grup</th><th className={th}>Anggota</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {groups.map((g) => (
                <tr key={g.jid} className={g.jid === sp.g ? "bg-emerald-50" : ""}>
                  <td className={td}><Link className="hover:underline" href={`/groups?s=${current!.id}&q=${encodeURIComponent(sp.q ?? "")}&g=${encodeURIComponent(g.jid)}`}>{g.subject}</Link></td>
                  <td className={td}>{g.size}</td>
                </tr>
              ))}
              {!groups.length && <tr><td className={td} colSpan={2}>Belum ada grup. Klik “Sync grup” di halaman Nomor WhatsApp.</td></tr>}
            </tbody>
          </Table>
        </Card>
        <Card title={selected ? `Peserta: ${selected.subject}` : "Peserta"}>
          {selected ? (
            <Table>
              <thead><tr><th className={th}>Nomor</th><th className={th}>Peran</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {members.map((m) => (
                  <tr key={m.jid}><td className={td}>{m.phone ?? <span className="text-slate-400">{m.jid}</span>}</td><td className={td}>{m.isAdmin ? <Badge v="admin" /> : "anggota"}</td></tr>
                ))}
              </tbody>
            </Table>
          ) : <p className="text-sm text-slate-500">Pilih grup di kiri.</p>}
        </Card>
      </div>
    </>
  );
}
