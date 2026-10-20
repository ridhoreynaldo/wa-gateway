import { requirePermission } from "@/modules/auth/guards";
import { createUserAction, resetPasswordAction, toggleUserAction } from "@/modules/users/actions";
import { listUsers } from "@/modules/users/repository";
import { Badge, btn, btnDanger, btnGhost, Card, fmtDate, input, label, PageTitle, Table, td, th } from "@/shared/ui";

export default async function UsersPage() {
  const me = await requirePermission("user:manage");
  const users = await listUsers();
  return (
    <>
      <PageTitle sub="Hanya superadmin. Admin hanya melihat nomor, list, dan broadcast miliknya sendiri.">Pengguna</PageTitle>
      <Card title="Tambah pengguna">
        <form action={createUserAction} className="grid gap-3 md:grid-cols-5">
          <div><label className={label}>Nama</label><input name="name" required className={input} /></div>
          <div><label className={label}>Email</label><input name="email" type="email" required className={input} /></div>
          <div><label className={label}>Password (min 8)</label><input name="password" type="password" minLength={8} required autoComplete="new-password" className={input} /></div>
          <div><label className={label}>Role</label><select name="role" className={input}><option value="admin">admin</option><option value="superadmin">superadmin</option></select></div>
          <div className="flex items-end"><button className={btn}>Tambah</button></div>
        </form>
      </Card>
      <Card title={`Semua pengguna (${users.length})`}>
        <Table>
          <thead><tr><th className={th}>Nama</th><th className={th}>Email</th><th className={th}>Role</th><th className={th}>Login terakhir</th><th className={th}>Aksi</th></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {users.map((u) => (
              <tr key={u.id} className={u.isActive ? "" : "opacity-50"}>
                <td className={td}>{u.name}</td><td className={td}>{u.email}</td><td className={td}><Badge v={u.role} /></td><td className={td}>{fmtDate(u.lastLoginAt)}</td>
                <td className={td}>
                  <div className="flex flex-wrap gap-2">
                    {u.id !== me.id && (
                      <form action={toggleUserAction}><input type="hidden" name="id" value={u.id} /><input type="hidden" name="active" value={String(!u.isActive)} />
                        <button className={u.isActive ? btnDanger : btnGhost}>{u.isActive ? "Nonaktifkan" : "Aktifkan"}</button></form>
                    )}
                    <form action={resetPasswordAction} className="flex gap-1"><input type="hidden" name="id" value={u.id} />
                      <input name="password" type="password" minLength={8} placeholder="password baru" autoComplete="new-password" className={`${input} !w-36`} /><button className={btnGhost}>Reset</button></form>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>
    </>
  );
}
