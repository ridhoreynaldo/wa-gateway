import { desc, eq } from "drizzle-orm";
import { db } from "@/shared/db";
import { requirePermission } from "@/modules/auth/guards";
import { auditLogs } from "@/modules/audit/schema";
import { users } from "@/modules/users/schema";
import { Card, fmtDate, PageTitle, Table, td, th } from "@/shared/ui";

export default async function AuditPage() {
  await requirePermission("audit:read");
  // LEFT JOIN sekali → nama user tanpa N+1
  const rows = await db()
    .select({ id: auditLogs.id, action: auditLogs.action, target: auditLogs.target, meta: auditLogs.meta, ip: auditLogs.ip, at: auditLogs.createdAt, user: users.email })
    .from(auditLogs)
    .leftJoin(users, eq(users.id, auditLogs.userId))
    .orderBy(desc(auditLogs.createdAt))
    .limit(200);
  return (
    <>
      <PageTitle sub="200 aktivitas terakhir">Audit Log</PageTitle>
      <Card>
        <Table>
          <thead><tr><th className={th}>Waktu</th><th className={th}>User</th><th className={th}>Aksi</th><th className={th}>Target</th><th className={th}>IP</th></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((r) => (
              <tr key={r.id}><td className={td}>{fmtDate(r.at)}</td><td className={td}>{r.user ?? "—"}</td><td className={td}>{r.action}</td><td className={`${td} text-xs text-slate-500`}>{r.target}</td><td className={td}>{r.ip}</td></tr>
            ))}
          </tbody>
        </Table>
      </Card>
    </>
  );
}
