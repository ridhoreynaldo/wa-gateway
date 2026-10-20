import Link from "next/link";
import { ownerScope, requirePermission } from "@/modules/auth/guards";
import { countContacts, listContacts } from "@/modules/contacts/repository";
import { listSessions } from "@/modules/wa-sessions/repository";
import { btnGhost, Card, PageTitle, Table, td, th } from "@/shared/ui";
import { SessionPicker } from "../session-picker";

type SP = Promise<{ s?: string; q?: string; after?: string }>;

export default async function ContactsPage({ searchParams }: { searchParams: SP }) {
  const me = await requirePermission("contact:read");
  const sp = await searchParams;
  const sessions = await listSessions(ownerScope(me));
  const current = sessions.find((s) => s.id === sp.s) ?? sessions[0];

  // ownership sudah dijamin: current berasal dari daftar milik user
  const [page, total] = current
    ? await Promise.all([listContacts(current.id, { q: sp.q, after: sp.after }), countContacts(current.id)])
    : [null, 0];

  return (
    <>
      <PageTitle sub="Kontak yang tersinkron dari nomor WhatsApp. Pagination keyset (cepat walau ribuan data).">Kontak</PageTitle>
      <SessionPicker sessions={sessions} selected={current?.id} q={sp.q} />
      <Card title={`Kontak (${total.toLocaleString("id-ID")})`}>
        <Table>
          <thead><tr><th className={th}>Nama</th><th className={th}>Nama tampil WA</th><th className={th}>Nomor</th></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {page?.items.map((c) => (
              <tr key={c.jid}><td className={td}>{c.name ?? "—"}</td><td className={td}>{c.notify ?? "—"}</td><td className={td}>{c.phone ?? <span className="text-slate-400">{c.jid}</span>}</td></tr>
            ))}
            {!page?.items.length && <tr><td className={td} colSpan={3}>Belum ada kontak. Pastikan nomor tersambung; kontak muncul setelah sinkronisasi pertama.</td></tr>}
          </tbody>
        </Table>
        {page?.nextCursor && (
          <div className="mt-4">
            <Link className={btnGhost} href={`/contacts?s=${current!.id}&q=${encodeURIComponent(sp.q ?? "")}&after=${encodeURIComponent(page.nextCursor)}`}>Berikutnya →</Link>
          </div>
        )}
      </Card>
    </>
  );
}
