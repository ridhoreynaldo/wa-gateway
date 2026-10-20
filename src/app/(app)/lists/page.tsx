import Link from "next/link";
import { ownerScope, requirePermission } from "@/modules/auth/guards";
import { createListAction, removeBlacklistAction } from "@/modules/lists/actions";
import { listBlacklist, listLists } from "@/modules/lists/repository";
import { btn, btnGhost, Card, fmtDate, input, PageTitle, Table, td, th } from "@/shared/ui";

export default async function ListsPage() {
  const me = await requirePermission("list:manage");
  const scope = ownerScope(me);
  const [lists, bl] = await Promise.all([listLists(scope), listBlacklist(scope)]);

  return (
    <>
      <PageTitle sub="Kumpulan nomor tujuan broadcast. Isi manual, tempel dari Excel, atau impor dari grup/kontak.">List Penerima</PageTitle>
      <Card title="Buat list baru">
        <form action={createListAction} className="flex gap-2">
          <input name="name" required minLength={2} placeholder="Nama list (mis. Pelanggan Jakarta)" className={input} />
          <button className={btn}>Buat</button>
        </form>
      </Card>
      <Card title={`Semua list (${lists.length})`}>
        <Table>
          <thead><tr><th className={th}>Nama</th><th className={th}>Jumlah nomor</th><th className={th}>Dibuat</th><th className={th}></th></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {lists.map((l) => (
              <tr key={l.id}><td className={td}>{l.name}</td><td className={td}>{l.itemCount.toLocaleString("id-ID")}</td><td className={td}>{fmtDate(l.createdAt)}</td>
                <td className={`${td} text-right`}><Link href={`/lists/${l.id}`} className={btnGhost}>Buka</Link></td></tr>
            ))}
            {!lists.length && <tr><td className={td} colSpan={4}>Belum ada list.</td></tr>}
          </tbody>
        </Table>
      </Card>
      <Card title={`Blacklist / opt-out (${bl.length})`}>
        <p className="mb-3 text-sm text-slate-500">Nomor yang membalas “STOP” otomatis masuk sini dan tidak akan dikirimi broadcast lagi.</p>
        <Table>
          <thead><tr><th className={th}>Nomor</th><th className={th}>Alasan</th><th className={th}>Sejak</th><th className={th}></th></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {bl.map((b) => (
              <tr key={b.ownerId + b.phone}><td className={td}>{b.phone}</td><td className={td}>{b.reason}</td><td className={td}>{fmtDate(b.createdAt)}</td>
                <td className={`${td} text-right`}>
                  <form action={removeBlacklistAction}><input type="hidden" name="phone" value={b.phone} /><input type="hidden" name="ownerId" value={b.ownerId} /><button className={btnGhost}>Hapus</button></form>
                </td></tr>
            ))}
          </tbody>
        </Table>
      </Card>
    </>
  );
}
