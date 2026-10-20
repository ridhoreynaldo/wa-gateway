import { notFound } from "next/navigation";
import { ownerScope, requirePermission } from "@/modules/auth/guards";
import { addNumbersAction, deleteListAction, importContactsAction, importGroupAction, removeItemAction } from "@/modules/lists/actions";
import { getList, listItems } from "@/modules/lists/repository";
import { listGroups } from "@/modules/groups/repository";
import { listSessions } from "@/modules/wa-sessions/repository";
import { btn, btnDanger, btnGhost, Card, input, label, PageTitle, Table, td, th } from "@/shared/ui";

export default async function ListDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ s?: string }> }) {
  const me = await requirePermission("list:manage");
  const { id } = await params;
  const sp = await searchParams;
  const scope = ownerScope(me);
  const list = await getList(id, scope);
  if (!list) notFound();

  const [items, sessions] = await Promise.all([listItems(id), listSessions(scope)]);
  const src = sessions.find((s) => s.id === sp.s) ?? sessions[0];
  const groups = src ? await listGroups(src.id) : [];

  return (
    <>
      <PageTitle sub={`${items.length >= 500 ? "500+ (ditampilkan 500 pertama)" : items.length} nomor`}>{list.name}</PageTitle>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Tambah nomor manual">
          <form action={addNumbersAction} className="space-y-2">
            <input type="hidden" name="listId" value={id} />
            <label className={label}>Satu nomor per baris, opsional <code>nomor,nama</code>. Format 08xx / 62xx / +62 otomatis dinormalisasi.</label>
            <textarea name="numbers" rows={6} required className={input} placeholder={"081234567890,Budi\n+62 812-9999-0000,Siti"} />
            <button className={btn}>Tambahkan</button>
          </form>
        </Card>

        <Card title="Impor dari WhatsApp">
          <form className="mb-3 flex gap-2">
            <select name="s" defaultValue={src?.id} className={input}>{sessions.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
            <button className={btnGhost}>Pilih</button>
          </form>
          {src ? (
            <div className="space-y-4">
              <form action={importGroupAction} className="flex gap-2">
                <input type="hidden" name="listId" value={id} /><input type="hidden" name="sessionId" value={src.id} />
                <select name="groupJid" required className={input}>{groups.map((g) => <option key={g.jid} value={g.jid}>{g.subject} ({g.size})</option>)}</select>
                <button className={btn}>Impor peserta</button>
              </form>
              <form action={importContactsAction}>
                <input type="hidden" name="listId" value={id} /><input type="hidden" name="sessionId" value={src.id} />
                <button className={btnGhost}>Impor semua kontak nomor ini</button>
              </form>
            </div>
          ) : <p className="text-sm text-slate-500">Tambahkan nomor WhatsApp dulu.</p>}
        </Card>
      </div>

      <Card title="Isi list" right={<form action={deleteListAction}><input type="hidden" name="listId" value={id} /><button className={btnDanger}>Hapus list</button></form>}>
        <Table>
          <thead><tr><th className={th}>Nomor</th><th className={th}>Nama</th><th className={th}></th></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {items.map((i) => (
              <tr key={i.phone}><td className={td}>{i.phone}</td><td className={td}>{i.name ?? "—"}</td>
                <td className={`${td} text-right`}><form action={removeItemAction}><input type="hidden" name="listId" value={id} /><input type="hidden" name="phone" value={i.phone} /><button className={btnGhost}>×</button></form></td></tr>
            ))}
          </tbody>
        </Table>
      </Card>
    </>
  );
}
