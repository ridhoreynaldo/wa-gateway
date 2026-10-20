import { randomBytes, scrypt as _scrypt, timingSafeEqual, type BinaryLike } from "node:crypto";

const scrypt = (pw: BinaryLike, salt: BinaryLike, len: number, opts: { N: number; r: number; p: number }) =>
  new Promise<Buffer>((res, rej) => _scrypt(pw, salt, len, { ...opts, maxmem: 128 * 1024 * 1024 }, (e, k) => (e ? rej(e) : res(k))));

const P = { N: 2 ** 15, r: 8, p: 1 };

/** Format: scrypt$<salt hex>$<hash hex> — tanpa dependency native. */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scrypt(password, salt, 64, P);
  return `scrypt$${salt.toString("hex")}$${key.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [alg, saltHex, hashHex] = stored.split("$");
  if (alg !== "scrypt" || !saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, "hex");
  const actual = await scrypt(password, Buffer.from(saltHex, "hex"), expected.length, P);
  return timingSafeEqual(actual, expected);
}
