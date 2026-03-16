import "server-only";

// webpack이 정적 분석할 수 없도록 동적 문자열로 require
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function lazyRequire(mod: string): any {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require(/* webpackIgnore: true */ mod);
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
      privateKey:  (process.env.FIREBASE_PRIVATE_KEY ?? "").replace(/\\n/g, "\n"),
    }),
  });
  return _app;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function adminDb(): any {
  const { getFirestore } = lazyRequire("firebase-admin/firestore");
  return getFirestore(getApp());
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function adminAuth(): any {
  const { getAuth } = lazyRequire("firebase-admin/auth");
  return getAuth(getApp());
}
