import crypto from "crypto";

let _cachedKey: Buffer | null = null;
function getDerivedKey(): Buffer {
  if (_cachedKey) return _cachedKey;
  const secret = process.env.ENCRYPTION_SECRET;
  if (!secret) throw new Error("ENCRYPTION_SECRET 환경변수 없음");
  _cachedKey = crypto.createHash("sha256").update(secret).digest();
  return _cachedKey;
}

export function decryptText(b64: string): string {
  const key     = getDerivedKey();
  const buf     = Buffer.from(b64, "base64");
  const iv      = buf.subarray(0, 12);
  const tag     = buf.subarray(12, 28);
  const enc     = buf.subarray(28);
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString("utf8");
}
