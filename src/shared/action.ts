import { cookies, headers } from "next/headers";
import { redirect, unstable_rethrow } from "next/navigation";
import { ZodError } from "zod";
import { AppError } from "@/shared/errors";

/**
 * Bungkus server action: AppError/ZodError diubah jadi pesan "flash" yang tampil di layout,
 * lalu user dikembalikan ke halaman asal. (Di production Next menyembunyikan pesan error biasa.)
 */
export function action<A extends unknown[], R>(fn: (...args: A) => Promise<R>) {
  return async (...args: A): Promise<R | undefined> => {
    try {
      return await fn(...args);
    } catch (e) {
      unstable_rethrow(e);
      let msg: string;
      if (e instanceof AppError) msg = e.message;
      else if (e instanceof ZodError) msg = "Input tidak valid: " + e.issues.map((i) => i.message).join(", ");
      else throw e;
      (await cookies()).set("wagw_flash", msg.slice(0, 300), { httpOnly: true, maxAge: 5, path: "/", sameSite: "lax" });
      const ref = (await headers()).get("referer");
      let back = "/";
      try { if (ref) { const u = new URL(ref); back = u.pathname + u.search; } } catch { /* ignore */ }
      redirect(back);
    }
  };
}
