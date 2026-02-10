import crypto from "crypto";

function keyFromSecret(secret: string) {
  return crypto.createHash("sha256").update(secret).digest();
}

export function decryptText(b64: string) {
  const secret = process.env.ENCRYPTION_SECRET!;
  const key = keyFromSecret(secret);

  const buf = Buffer.from(b64, "base64");
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const enc = buf.subarray(28);

  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  const out = Buffer.concat([decipher.update(enc), decipher.final()]);
  return out.toString("utf8");
}
