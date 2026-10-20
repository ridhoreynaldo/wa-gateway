import Link from "next/link";
import { cookies } from "next/headers";
import { logoutAction } from "@/modules/auth/actions";
import { requireUser } from "@/modules/auth/guards";
import { can, type Permission } from "@/modules/auth/rbac";
import { Badge, btnGhost } from "@/shared/ui";

export const dynamic = "force-dynamic";

const NAV: { href: string; label: string; perm?: Permission }[] = [
  { href: "/", label: "Dashboard" },
  { href: "/sessions", label: "Nomor WhatsApp", perm: "session:manage" },
  { href: "/contacts", label: "Kontak", perm: "contact:read" },
  { href: "/groups", label: "Grup", perm: "group:read" },
  { href: "/lists", label: "List Penerima", perm: "list:manage" },
  { href: "/broadcasts", label: "Broadcast", perm: "broadcast:manage" },
  { href: "/api-keys", label: "API Key", perm: "apikey:manage" },
  { href: "/users", label: "Pengguna", perm: "user:manage" },
  { href: "/audit", label: "Audit Log", perm: "audit:read" },
];

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const flash = (await cookies()).get("wagw_flash")?.value;
  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-56 shrink-0 flex-col border-r border-slate-200 bg-white p-4 md:flex">
        <div className="mb-6 text-lg font-bold text-emerald-700">WA Gateway</div>
        <nav className="flex-1 space-y-1">
          {NAV.filter((n) => !n.perm || can(user.role, n.perm)).map((n) => (
            <Link key={n.href} href={n.href} className="block rounded-md px-3 py-2 text-sm text-slate-700 hover:bg-slate-100">
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="mt-4 border-t border-slate-100 pt-4 text-sm">
          <div className="truncate font-medium">{user.name}</div>
          <div className="mb-2 mt-1"><Badge v={user.role} /></div>
          <form action={logoutAction}><button className={`${btnGhost} w-full`}>Keluar</button></form>
        </div>
      </aside>
      <main className="min-w-0 flex-1 p-4 md:p-8">
        {/* nav ringkas untuk layar kecil */}
        <nav className="mb-4 flex gap-2 overflow-x-auto md:hidden">
          {NAV.filter((n) => !n.perm || can(user.role, n.perm)).map((n) => (
            <Link key={n.href} href={n.href} className="whitespace-nowrap rounded-md bg-white px-3 py-1.5 text-xs shadow-sm">{n.label}</Link>
          ))}
        </nav>
        {flash && <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{flash}</div>}
        {children}
      </main>
    </div>
  );
}
