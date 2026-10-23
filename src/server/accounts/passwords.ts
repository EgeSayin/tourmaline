import { randomBytes, scrypt, type ScryptOptions, timingSafeEqual } from "node:crypto";

// OWASP's scrypt settings for 32 MiB a hash. Each hash records its own, so these can change.
const COST = { N: 2 ** 15, r: 8, p: 3 };
const KEY_BYTES = 64;

function derive(password: string, salt: Buffer, { N, r, p }: typeof COST): Promise<Buffer> {
  const options: ScryptOptions = { N, r, p, maxmem: 256 * N * r };
  return new Promise((resolve, reject) =>
    scrypt(password, salt, KEY_BYTES, options, (error, key) => (error ? reject(error) : resolve(key))),
  );
}

/** `scrypt$N$r$p$salt$key`, in base64url. */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await derive(password, salt, COST);
  return ["scrypt", COST.N, COST.r, COST.p, salt.toString("base64url"), key.toString("base64url")].join("$");
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const [, N, r, p, salt, key] = hash.split("$");
  const expected = Buffer.from(key, "base64url");
  const actual = await derive(password, Buffer.from(salt, "base64url"), { N: +N, r: +r, p: +p });
  return timingSafeEqual(actual, expected);
}

let unused: Promise<string> | undefined;

/** Checked against when no account has the name, so a sign-in takes as long whether or not it exists. */
export function unusedHash(): Promise<string> {
  return (unused ??= hashPassword(randomBytes(16).toString("base64url")));
}
