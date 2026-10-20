import { cookies } from "next/headers";
import { ownerScope, requirePermission } from "@/modules/auth/guards";
import { createApiKeyAction, deleteApiKeyAction } from "@/modules/api-keys/actions";
import { listApiKeys } from "@/modules/api-keys/service";
import { listSessions } from "@/modules/wa-sessions/repository";
import { btn, btnDanger, Card, fmtDate, input, label, PageTitle, Table, td, th } from "@/shared/ui";

export default async function ApiKeysPage() {
  const me = await requirePermission("apikey:manage");
  const scope = ownerScope(me);
  const [keys, sessions] = await Promise.all([listApiKeys(scope), listSessions(scope)]);
  const fresh = (await cookies()).get("wagw_newkey")?.value;

  return (
    <>
      <PageTitle sub="Kirim pesan dari aplikasi lain lewat REST. Pesan API berbagi jeda per-nomor dengan broadcast.">API Key</PageTitle>
      {fresh && (
        <div className="mb-6 rounded-md border border-emerald-300 bg-emerald-50 p-4 text-sm">
          <div className="mb-1 font-medium">Simpan key ini sekarang — tidak akan ditampilkan lagi:</div>
          <code className="break-all">{fresh}</code>
        </div>
      )}
      <Card title="Buat API key">
        <form action={createApiKeyAction} className="grid gap-3 md:grid-cols-3">
          <div><label className={label}>Nama</label><input name="name" required className={input} /></div>
          <div><label className={label}>Nomor WhatsApp</label><select name="sessionId" className={input}>{sessions.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
          <div className="flex items-end"><button className={btn}>Buat</button></div>
        </form>
      </Card>
      <Card title="Contoh penggunaan">
        <pre className="overflow-x-auto text-xs">{`curl -X POST https://DOMAIN-ANDA/api/v1/messages \\
  -H "Authorization: Bearer wagw_xxxxxxxx" \\
  -H "Content-Type: application/json" \\
  -d '{"to":"081234567890","text":"Halo dari API"}'`}</pre>
      </Card>
      <Card title="Key aktif">
        <Table>
          <thead><tr><th className={th}>Nama</th><th className={th}>Prefix</th><th className={th}>Nomor</th><th className={th}>Terakhir dipakai</th><th className={th}></th></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {keys.map((k) => (
              <tr key={k.id}><td className={td}>{k.name}</td><td className={td}><code>{k.prefix}…</code></td><td className={td}>{k.sessionName}</td><td className={td}>{fmtDate(k.lastUsedAt)}</td>
                <td className={`${td} text-right`}><form action={deleteApiKeyAction}><input type="hidden" name="id" value={k.id} /><button className={btnDanger}>Hapus</button></form></td></tr>
            ))}
          </tbody>
        </Table>
      </Card>
    </>
  );
}
