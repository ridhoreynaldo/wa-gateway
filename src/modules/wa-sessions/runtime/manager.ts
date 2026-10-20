import { randomUUID } from "node:crypto";
import type { Boom } from "@hapi/boom";
import { eq, ne } from "drizzle-orm";
import makeWASocket, {
  Browsers,
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  type WASocket,
} from "@whiskeysockets/baileys";
import { db } from "@/shared/db";
import { keys, redis } from "@/shared/redis";
import { logger } from "@/shared/logger";
import { pauseCampaignsForSession } from "@/modules/broadcast/repository";
import { waAuth, waSessions } from "../schema";
import { usePgAuthState } from "./auth-state";
import { registerHandlers, syncGroups } from "./handlers";

type Entry = { sock: WASocket; sessionId: string; renew: NodeJS.Timeout };

/** ID instance worker ini — dipakai lock kepemilikan sesi di Redis. */
const INSTANCE = randomUUID();
const OWNER_TTL = 90; // detik; diperbarui tiap 30 dtk

const sockets = new Map<string, Entry>();
const starting = new Set<string>();
const manualStop = new Set<string>();
const attempts = new Map<string, number>();
const qrRounds = new Map<string, number>();
const MAX_QR_ROUNDS = 6; // ±6 menit; lewat itu berhenti supaya tidak loop selamanya

export const getSocket = (sessionId: string) => sockets.get(sessionId)?.sock;

async function setStatus(id: string, status: (typeof waSessions.$inferSelect)["status"], extra: Partial<typeof waSessions.$inferInsert> = {}) {
  await db().update(waSessions).set({ status, ...extra }).where(eq(waSessions.id, id));
}

/** Hanya satu instance worker yang boleh memegang satu sesi (dua socket = WA memutus keduanya). */
async function acquireOwner(id: string): Promise<boolean> {
  const r = redis();
  if (await r.set(keys.owner(id), INSTANCE, "EX", OWNER_TTL, "NX")) return true;
  return (await r.get(keys.owner(id))) === INSTANCE;
}
const renewOwner = (id: string) => redis().expire(keys.owner(id), OWNER_TTL).catch(() => undefined);
async function releaseOwner(id: string) {
  const r = redis();
  if ((await r.get(keys.owner(id))) === INSTANCE) await r.del(keys.owner(id));
}

function dropEntry(id: string) {
  const e = sockets.get(id);
  if (e) clearInterval(e.renew);
  sockets.delete(id);
}

export async function startSession(id: string): Promise<void> {
  if (sockets.has(id) || starting.has(id)) return;
  starting.add(id);
  manualStop.delete(id);
  qrRounds.delete(id); // mulai fresh; bug lama: hitungan QR lama ikut terbawa → langsung berhenti
  const log = logger.child({ session: id });
  try {
    if (!(await acquireOwner(id))) {
      log.warn("sesi sedang dipegang instance worker lain, dilewati");
      return;
    }
    await setStatus(id, "connecting");
    const { state, saveCreds } = await usePgAuthState(id);
    const { version } = await fetchLatestBaileysVersion().catch(() => ({ version: undefined }));
    const bLog = log.child({ lib: "baileys" });
    bLog.level = "warn";

    const sock = makeWASocket({
      version,
      logger: bLog,
      auth: { creds: state.creds, keys: makeCacheableSignalKeyStore(state.keys, bLog) },
      browser: Browsers.ubuntu("Chrome"),
      syncFullHistory: false,
      markOnlineOnConnect: false,
      generateHighQualityLinkPreview: false,
    });
    sockets.set(id, { sock, sessionId: id, renew: setInterval(() => void renewOwner(id), 30_000) });
    registerHandlers(sock, id, log);

    sock.ev.on("creds.update", () => void saveCreds().catch((e) => log.error(e, "saveCreds gagal")));

    sock.ev.on("connection.update", (u) => {
      void (async () => {
        if (u.qr) {
          const rounds = (qrRounds.get(id) ?? 0) + 1;
          qrRounds.set(id, rounds);
          if (rounds > MAX_QR_ROUNDS) return void stopSession(id);
          await redis().set(keys.qr(id), u.qr, "EX", 70);
          await setStatus(id, "qr");
        }
        if (u.connection === "open") {
          attempts.delete(id);
          qrRounds.delete(id);
          await redis().del(keys.qr(id));
          const phone = sock.user?.id.split(":")[0]?.split("@")[0] ?? null;
          await setStatus(id, "connected", { phone, lastConnectedAt: new Date() });
          log.info({ phone }, "tersambung");
          void syncGroups(sock, id, log);
        }
        if (u.connection === "close") {
          dropEntry(id);
          const code = (u.lastDisconnect?.error as Boom | undefined)?.output?.statusCode;
          if (manualStop.has(id)) return;
          if (code === DisconnectReason.loggedOut || code === DisconnectReason.forbidden) {
            // 401 = user mencabut tautan, 403 = akun dibatasi/diblokir WA. Hentikan semua broadcast nomor ini.
            const reason = code === DisconnectReason.forbidden ? "Nomor dibatasi/diblokir oleh WhatsApp (403)" : "Nomor logout dari WhatsApp";
            log.warn({ code }, reason);
            await pauseCampaignsForSession(id, `Auto-pause: ${reason}`);
            await wipeAuth(id);
            await setStatus(id, "logged_out", { phone: null });
            await releaseOwner(id);
            return;
          }
          const n = (attempts.get(id) ?? 0) + 1;
          attempts.set(id, n);
          const delay = Math.min(30_000, 1000 * 2 ** Math.min(n, 5));
          log.warn({ code, n, delay }, "terputus, reconnect");
          await setStatus(id, "connecting");
          setTimeout(() => void startSession(id), delay);
        }
      })().catch((e) => log.error(e, "connection.update handler gagal"));
    });
  } catch (e) {
    log.error(e, "gagal start sesi");
    dropEntry(id);
    await releaseOwner(id);
    await setStatus(id, "disconnected").catch(() => undefined);
  } finally {
    starting.delete(id);
  }
}

export async function stopSession(id: string): Promise<void> {
  manualStop.add(id);
  const e = sockets.get(id);
  dropEntry(id);
  e?.sock.end(undefined);
  await redis().del(keys.qr(id));
  await releaseOwner(id);
  await setStatus(id, "disconnected");
}

export async function logoutSession(id: string): Promise<void> {
  manualStop.add(id);
  const e = sockets.get(id);
  dropEntry(id);
  try {
    await e?.sock.logout();
  } catch {
    e?.sock.end(undefined);
  }
  await pauseCampaignsForSession(id, "Auto-pause: nomor di-logout").catch(() => undefined);
  await wipeAuth(id);
  await redis().del(keys.qr(id));
  await releaseOwner(id);
  await setStatus(id, "logged_out", { phone: null }).catch(() => undefined); // baris bisa sudah dihapus
}

export async function resync(id: string) {
  const sock = getSocket(id);
  if (sock) await syncGroups(sock, id, logger.child({ session: id }));
}

const wipeAuth = (id: string) => db().delete(waAuth).where(eq(waAuth.sessionId, id));

/** Saat worker boot: nyalakan ulang semua nomor yang pernah login, bergiliran supaya tidak connect serentak. */
export async function bootSessions() {
  const rows = await db().select({ id: waSessions.id }).from(waSessions).where(ne(waSessions.status, "logged_out"));
  for (const r of rows) {
    await startSession(r.id);
    await new Promise((res) => setTimeout(res, 1500 + Math.random() * 1500));
  }
  logger.info({ count: rows.length, instance: INSTANCE }, "sesi WA dinyalakan");
}

export async function shutdownAll() {
  for (const [id, e] of sockets) {
    manualStop.add(id);
    clearInterval(e.renew);
    e.sock.end(undefined);
    await releaseOwner(id);
  }
  sockets.clear();
}
