import { btnGhost, input } from "@/shared/ui";

/** Form GET: pilih nomor + kolom cari. Semua state ada di URL (bisa di-bookmark, tanpa client JS). */
export function SessionPicker({
  sessions, selected, q, extra,
}: {
  sessions: { id: string; name: string; phone: string | null }[];
  selected?: string;
  q?: string;
  extra?: boolean;
}) {
  return (
    <form className="mb-4 flex flex-wrap gap-2">
      <select name="s" defaultValue={selected} className={`${input} !w-auto`}>
        {sessions.map((s) => (
          <option key={s.id} value={s.id}>{s.name} {s.phone ? `(${s.phone})` : ""}</option>
        ))}
      </select>
      {extra !== false && <input name="q" defaultValue={q} placeholder="Cari…" className={`${input} !w-64`} />}
      <button className={btnGhost}>Tampilkan</button>
    </form>
  );
}
