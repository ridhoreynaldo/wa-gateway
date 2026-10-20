const SPIN = /\{([^{}]*\|[^{}]*)\}/;

const pick = (a: string[]) => a[Math.floor(Math.random() * a.length)] ?? "";

/**
 * Render template: {{name}} / {{var}} diganti data penerima,
 * {Halo|Hai|Selamat pagi} dipilih acak (spintax) supaya tiap pesan sedikit berbeda.
 */
export function renderTemplate(tpl: string, data: Record<string, string | null | undefined>): string {
  let out = tpl.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k: string) => data[k] ?? "");
  for (let i = 0; i < 20 && SPIN.test(out); i++) {
    out = out.replace(SPIN, (_, body: string) => pick(body.split("|")));
  }
  return out.trim();
}
