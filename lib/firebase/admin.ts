import "server-only";

function lazyRequire(mod: string): any {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require(/* webpackIgnore: true */ mod);
}

function parsePrivateKey(raw: string | undefined): string {
  if (!raw) throw new Error("FIREBASE_PRIVATE_KEY 환경 변수가 없습니다");
  // 앞뒤 따옴표 제거
  let key = raw.replace(/^["']|["']$/g, "");
  // 이미 실제 줄바꿈이 있으면 그대로, 없으면 \n → 줄바꿈 변환
  if (!key.includes("\n")) {
    key = key.replace(/\\n/g, "\n");
  }
  return key;
}

let _app: any = null;

function getApp(): any {
  if (_app) return _app;
  const { initializeApp, getApps, cert } = lazyRequire("firebase-admin/app");
  if (getApps().length > 0) return (_app = getApps()[0]);
  _app = initializeApp({
    credential: cert({
      projectId:   process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey:  parsePrivateKey(process.env.FIREBASE_PRIVATE_KEY),
    }),
  });
  return _app;
}

export function adminDb(): any {
  const { getFirestore } = lazyRequire("firebase-admin/firestore");
  return getFirestore(getApp());
}

export function adminAuth(): any {
  const { getAuth } = lazyRequire("firebase-admin/auth");
  return getAuth(getApp());
}
