import crypto from "crypto";

// 프로세스 생명주기 동안 키 캐싱 (매 호출마다 SHA256 방지)
let _cachedKey: Buffer | null = null;
function getDerivedKey(): Buffer {
  if (_cachedKey) return _cachedKey;
  const secret = process.env.ENCRYPTION_SECRET;
  if (!secret) throw new Error("ENCRYPTION_SECRET 환경변수 없음");
  _cachedKey = crypto.createHash("sha256").update(secret).digest();
  return _cachedKey;
}

export function encryptText(plain: string): string {
  const key    = getDerivedKey();
  const iv     = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const enc    = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag    = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString("base64");
}
