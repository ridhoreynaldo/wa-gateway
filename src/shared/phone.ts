/** Normalisasi nomor ke format internasional tanpa '+' (default Indonesia). */
export function normalizePhone(input: string, defaultCountry = "62"): string | null {
  let d = input.replace(/[^\d]/g, "");
  if (!d) return null;
  if (d.startsWith("00")) d = d.slice(2);
  else if (d.startsWith("0")) d = defaultCountry + d.slice(1);
  else if (d.startsWith("8")) d = defaultCountry + d;
  return d.length >= 8 && d.length <= 15 ? d : null;
}

export const phoneToJid = (phone: string) => `${phone}@s.whatsapp.net`;

export function jidToPhone(jid: string): string | null {
  const m = /^(\d+)(?::\d+)?@s\.whatsapp\.net$/.exec(jid);
  return m?.[1] ?? null;
}
