import { redirect } from "next/navigation";
import { getCurrentUser } from "@/modules/auth/session";
import { LoginForm } from "./login-form";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (await getCurrentUser()) redirect("/");
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="mb-1 text-xl font-semibold">WA Gateway</h1>
        <p className="mb-6 text-sm text-slate-500">Masuk untuk mengelola nomor & broadcast</p>
        <LoginForm />
      </div>
    </main>
  );
}
