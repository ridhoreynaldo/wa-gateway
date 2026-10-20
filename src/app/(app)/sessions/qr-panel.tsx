"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type State = { status: string; phone: string | null; qr: string | null };

/** Polling QR tiap 2 dtk selama nomor belum tersambung. */
export function QrPanel({ sessionId, initialStatus }: { sessionId: string; initialStatus: string }) {
  const router = useRouter();
  const [s, setS] = useState<State>({ status: initialStatus, phone: null, qr: null });

  useEffect(() => {
    let stop = false;
    const tick = async () => {
      try {
        const res = await fetch(`/api/sessions/${sessionId}/qr`, { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as State;
        if (stop) return;
        setS(data);
        if (data.status === "connected" || data.status === "disconnected") {
          router.refresh();
          stop = true;
        }
      } catch { /* abaikan, coba lagi */ }
    };
    void tick();
    const t = setInterval(() => !stop && void tick(), 2000);
    return () => { stop = true; clearInterval(t); };
  }, [sessionId, router]);

  if (s.status === "connected") return <p className="text-sm text-emerald-700">Tersambung ✔</p>;
  if (s.qr)
    return (
      <div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={s.qr} alt="QR WhatsApp" width={240} height={240} className="rounded-md border border-slate-200" />
        <p className="mt-2 text-xs text-slate-500">WhatsApp → Perangkat tertaut → Tautkan perangkat → scan QR ini.</p>
      </div>
    );
  return <p className="text-sm text-slate-500">Menyiapkan QR… ({s.status})</p>;
}
