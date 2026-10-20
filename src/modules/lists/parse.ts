import { normalizePhone } from "@/shared/phone";
import type { ItemInput } from "./repository";

/** Format per baris: `nomor` atau `nomor,nama` (pemisah , ; tab |). */
export function parseNumbers(text: string): { items: ItemInput[]; invalid: number } {
  const items: ItemInput[] = [];
  let invalid = 0;
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const [raw, ...rest] = line.split(/[,;\t|]/);
    const phone = normalizePhone(raw ?? "");
    if (!phone) invalid++;
    else items.push({ phone, name: rest.join(" ").trim() || null });
  }
  return { items, invalid };
}
