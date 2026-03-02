import crypto from "crypto";

function keyFromSecret(secret: string) {
  // 32 bytes key
  return crypto.createHash("sha256").update(secret).digest();
}

export function encryptText(plain: string) {
  const secret = process.env.ENCRYPTION_SECRET!;
  const key = keyFromSecret(secret);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString("base64");
}
