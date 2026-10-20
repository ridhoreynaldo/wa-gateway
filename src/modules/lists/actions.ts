"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { action } from "@/shared/action";
import { AppError, notFound } from "@/shared/errors";
import { parseNumbers } from "./parse";
import { ownerScope, requirePermission } from "@/modules/auth/guards";
import { audit } from "@/modules/audit/service";
import { getSession } from "@/modules/wa-sessions/repository";
import { contactsWithPhone } from "@/modules/contacts/repository";
import { listParticipants } from "@/modules/groups/repository";
import { addItems, deleteList, getList, insertList, removeBlacklist, removeItem } from "./repository";

const uuid = z.string().uuid();

async function mine(listId: string) {
  const me = await requirePermission("list:manage");
  const l = await getList(listId, ownerScope(me));
  if (!l) throw notFound();
  return { me, l };
}

export const createListAction = action(async (form: FormData) => {
  const me = await requirePermission("list:manage");
  const name = z.string().trim().min(2).max(80).parse(form.get("name"));
  const l = await insertList(me.id, name);
  await audit(me.id, "list.create", l.id);
  redirect(`/lists/${l.id}`);
});

export const addNumbersAction = action(async (form: FormData) => {
  const { me, l } = await mine(uuid.parse(form.get("listId")));
  const { items, invalid } = parseNumbers(z.string().max(500_000).parse(form.get("numbers")));
  if (!items.length) throw new AppError(`Tidak ada nomor valid (${invalid} baris ditolak)`);
  const n = await addItems(l.id, items);
  await audit(me.id, "list.add_numbers", l.id, { added: n, invalid });
  revalidatePath(`/lists/${l.id}`);
});

export const importGroupAction = action(async (form: FormData) => {
  const { me, l } = await mine(uuid.parse(form.get("listId")));
  const s = await getSession(uuid.parse(form.get("sessionId")), ownerScope(me));
  if (!s) throw notFound();
  const groupJid = z.string().min(5).parse(form.get("groupJid"));
  const parts = await listParticipants(s.id, groupJid);
  const items = parts.filter((p) => p.phone && p.phone !== s.phone).map((p) => ({ phone: p.phone!, name: null }));
  const n = await addItems(l.id, items);
  await audit(me.id, "list.import_group", l.id, { groupJid, added: n });
  revalidatePath(`/lists/${l.id}`);
});

export const importContactsAction = action(async (form: FormData) => {
  const { me, l } = await mine(uuid.parse(form.get("listId")));
  const s = await getSession(uuid.parse(form.get("sessionId")), ownerScope(me));
  if (!s) throw notFound();
  const rows = await contactsWithPhone(s.id);
  const n = await addItems(l.id, rows.map((r) => ({ phone: r.phone!, name: r.name })));
  await audit(me.id, "list.import_contacts", l.id, { added: n });
  revalidatePath(`/lists/${l.id}`);
});

export const removeItemAction = action(async (form: FormData) => {
  const { l } = await mine(uuid.parse(form.get("listId")));
  await removeItem(l.id, z.string().parse(form.get("phone")));
  revalidatePath(`/lists/${l.id}`);
});

export const deleteListAction = action(async (form: FormData) => {
  const { me, l } = await mine(uuid.parse(form.get("listId")));
  await deleteList(l.id);
  await audit(me.id, "list.delete", l.id);
  redirect("/lists");
});

export const removeBlacklistAction = action(async (form: FormData) => {
  const me = await requirePermission("list:manage");
  const ownerId = ownerScope(me) ?? uuid.parse(form.get("ownerId"));
  await removeBlacklist(ownerId, z.string().parse(form.get("phone")));
  revalidatePath("/lists");
});
