import { ownerScope, requirePermission } from "@/modules/auth/guards";
import { createCampaignAction } from "@/modules/broadcast/actions";
import { listLists } from "@/modules/lists/repository";
import { listSessions } from "@/modules/wa-sessions/repository";
import { btn, Card, input, label, PageTitle } from "@/shared/ui";

function Num({ name, text, def, min, max }: { name: string; text: string; def: number; min: number; max: number }) {
  return (
    <div>
      <label className={label} htmlFor={name}>{text}</label>
      <input id={name} name={name} type="number" defaultValue={def} min={min} max={max} required className={input} />
    </div>
  );
}

export default async function NewBroadcast() {
  const me = await requirePermission("broadcast:manage");
  const scope = ownerScope(me);
  const [sessions, lists] = await Promise.all([listSessions(scope), listLists(scope)]);

  return (
    <>
      <PageTitle sub="Default sudah profil “normal & aman”. Server menolak nilai di bawah batas aman.">Broadcast baru</PageTitle>
      <form action={createCampaignAction}>
        <Card title="Isi pesan">
          <div className="grid gap-4 md:grid-cols-3">
            <div><label className={label}>Nama campaign</label><input name="name" required minLength={2} className={input} /></div>
            <div><label className={label}>Kirim dari nomor</label>
              <select name="sessionId" required className={input}>{sessions.filter((s) => s.status === "connected").map((s) => <option key={s.id} value={s.id}>{s.name} ({s.phone})</option>)}</select></div>
            <div><label className={label}>List penerima</label>
              <select name="listId" required className={input}>{lists.map((l) => <option key={l.id} value={l.id}>{l.name} ({l.itemCount})</option>)}</select></div>
          </div>
          <div className="mt-4">
            <label className={label}>Template pesan</label>
            <textarea name="template" required rows={6} className={input} defaultValue={"{Halo|Hai|Selamat datang} {{name}}, ini informasi terbaru dari kami.\n\nBalas STOP jika tidak ingin menerima pesan lagi."} />
            <p className="mt-1 text-xs text-slate-500">
              <code>{"{{name}}"}</code> = nama penerima. <code>{"{Halo|Hai}"}</code> = dipilih acak per pesan (variasi isi mengurangi risiko banned). Cantumkan cara berhenti (STOP).
            </p>
          </div>
        </Card>

        <Card title="Pengaman kecepatan">
          <div className="grid gap-4 md:grid-cols-4">
            <Num name="minDelaySec" text="Jeda min antar pesan (dtk)" def={25} min={15} max={600} />
            <Num name="maxDelaySec" text="Jeda max antar pesan (dtk)" def={60} min={20} max={900} />
            <Num name="hourlyLimit" text="Maks per jam" def={40} min={1} max={60} />
            <Num name="dailyLimit" text="Maks per hari" def={200} min={1} max={300} />
            <Num name="batchSize" text="Istirahat tiap N pesan" def={20} min={5} max={50} />
            <Num name="batchPauseMinSec" text="Istirahat min (dtk)" def={180} min={60} max={1800} />
            <Num name="batchPauseMaxSec" text="Istirahat max (dtk)" def={420} min={90} max={3600} />
            <div />
            <Num name="windowStartHour" text="Jam mulai kirim" def={8} min={0} max={23} />
            <Num name="windowEndHour" text="Jam berhenti kirim" def={20} min={1} max={24} />
          </div>
          <p className="mt-3 text-xs text-slate-500">Batas harian juga dibatasi warm-up otomatis untuk nomor baru (mulai 20 pesan/hari, naik 25% per hari).</p>
        </Card>
        <button className={btn}>Simpan sebagai draft</button>
      </form>
    </>
  );
}
