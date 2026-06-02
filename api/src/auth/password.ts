import argon2 from "argon2";

// argon2id — obecnie rekomendowany algorytm do haseł (odporny na ataki
// GPU i side-channel). Domyślne parametry biblioteki są sensowne.
export function hashPassword(plain: string): Promise<string> {
  return argon2.hash(plain, { type: argon2.argon2id });
}

export function verifyPassword(hash: string, plain: string): Promise<boolean> {
  return argon2.verify(hash, plain);
}
