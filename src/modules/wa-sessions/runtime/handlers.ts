import type { Logger } from "pino";
import { proto, type Contact, type WASocket, type WAMessage } from "@whiskeysockets/baileys";
import { jidToPhone } from "@/shared/phone";
import { keys, redis } from "@/shared/redis";
import { upsertContacts, type ContactInput } from "@/modules/contacts/repository";
import { replaceGroups } from "@/modules/groups/repository";
import { bumpStatus, logIncoming } from "@/modules/messaging/repository";
import { optOut } from "@/modules/lists/repository";

const STOP_WORDS = /^\s*(stop|berhenti|unsubscribe|batal berlangganan)\s*[.!]*\s*$/i;

function toContact(c: Partial<Contact>): ContactInput | null {
  if (!c.id || c.id.endsWith("@g.us") || c.id.endsWith("@broadcast")) return null;
  const phone = jidToPhone(c.id) ?? (c.phoneNumber ? jidToPhone(c.phoneNumber) : null);
  return { jid: c.id, name: c.name ?? null, notify: c.notify ?? null, phone };
}

const textOf = (m: WAMessage): string =>
  m.message?.conversation ??
  m.message?.extendedTextMessage?.text ??
  m.message?.imageMessage?.caption ??
  m.message?.videoMessage?.caption ??
  m.message?.buttonsResponseMessage?.selectedDisplayText ??
  m.message?.listResponseMessage?.title ??
  "";

export function registerHandlers(sock: WASocket, sessionId: string, log: Logger) {
  const saveContacts = (list: Partial<Contact>[]) => {
    const rows = list.map(toContact).filter((r): r is ContactInput => !!r);
    if (rows.length) void upsertContacts(sessionId, rows).catch((e) => log.error(e, "simpan kontak gagal"));
  };

  sock.ev.on("contacts.upsert", saveContacts);
  sock.ev.on("contacts.update", saveContacts);
  sock.ev.on("messaging-history.set", (h) => saveContacts(h.contacts ?? []));

  sock.ev.on("messages.upsert", ({ messages, type }) => {
    if (type !== "notify") return;
    for (const m of messages) {
      void (async () => {
        const jid = m.key.remoteJid;
        if (!jid || m.key.fromMe || jid.endsWith("@g.us") || jid === "status@broadcast") return;
        // v7: remoteJid bisa berupa LID; remoteJidAlt berisi nomor aslinya
        const phone = jidToPhone(m.key.remoteJidAlt ?? jid) ?? jidToPhone(jid);
        if (!phone) return;
        const body = textOf(m);
        await logIncoming({ sessionId, phone, body: body.slice(0, 4000), waMessageId: m.key.id ?? undefined });
        // Balasan dari orang yang baru kita kirimi: tandai dibaca setelah jeda manusiawi.
        // Percakapan dua arah yang 'dibaca' adalah sinyal akun normal, bukan bot broadcast.
        if (await redis().exists(keys.recent(sessionId, phone))) {
          setTimeout(() => void sock.readMessages([m.key]).catch(() => undefined), 2000 + Math.random() * 6000);
        }
        if (STOP_WORDS.test(body)) {
          await optOut(sessionId, phone);
          log.info({ phone }, "opt-out (STOP)");
        }
      })().catch((e) => log.error(e, "proses pesan masuk gagal"));
    }
  });

  sock.ev.on("messages.update", (updates) => {
    for (const u of updates) {
      const id = u.key.id;
      const st = u.update.status;
      if (!id || !u.key.fromMe || st == null) continue;
      if (st === proto.WebMessageInfo.Status.DELIVERY_ACK) void bumpStatus(id, "delivered").catch(() => undefined);
      else if (st >= proto.WebMessageInfo.Status.READ) void bumpStatus(id, "read").catch(() => undefined);
    }
  });
}

export async function syncGroups(sock: WASocket, sessionId: string, log: Logger) {
  try {
    const all = await sock.groupFetchAllParticipating();
    const groups = Object.values(all).map((g) => ({
      jid: g.id,
      subject: g.subject,
      participants: g.participants.map((p) => ({
        jid: p.id,
        phone: jidToPhone(p.phoneNumber ?? "") ?? jidToPhone(p.id),
        isAdmin: !!p.admin,
      })),
    }));
    await replaceGroups(sessionId, groups);
    log.info({ groups: groups.length }, "grup tersinkron");
  } catch (e) {
    log.error(e, "sinkron grup gagal");
  }
}
