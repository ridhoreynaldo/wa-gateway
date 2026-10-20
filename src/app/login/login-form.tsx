"use client";

import { useActionState } from "react";
import { loginAction, type LoginState } from "@/modules/auth/actions";
import { btn, input, label } from "@/shared/ui";

export function LoginForm() {
  const [state, formAction, pending] = useActionState<LoginState, FormData>(loginAction, {});
  return (
    <form action={formAction} className="space-y-4">
      <div>
        <label className={label} htmlFor="email">Email</label>
        <input id="email" name="email" type="email" required autoComplete="username" className={input} />
      </div>
      <div>
        <label className={label} htmlFor="password">Password</label>
        <input id="password" name="password" type="password" required autoComplete="current-password" className={input} />
      </div>
      {state.error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}
      <button className={`${btn} w-full`} disabled={pending}>{pending ? "Masuk…" : "Masuk"}</button>
    </form>
  );
}
