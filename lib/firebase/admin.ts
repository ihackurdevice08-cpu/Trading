import "server-only";

let _adminApp: any = null;

function getApp() {
  if (_adminApp) return _adminApp;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { initializeApp, getApps, cert } = require("firebase-admin/app");
  if (getApps().length > 0) { _adminApp = getApps()[0]; return _adminApp; }
  _adminApp = initializeApp({
    credential: cert({
      projectId:   process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey:  (process.env.FIREBASE_PRIVATE_KEY ?? "").replace(/\\n/g, "\n"),
    }),
  });
  return _adminApp;
}

export function adminDb() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { getFirestore } = require("firebase-admin/firestore");
  return getFirestore(getApp());
}

export function adminAuth() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { getAuth } = require("firebase-admin/auth");
  return getAuth(getApp());
}
