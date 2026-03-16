import "server-only";
import { initializeApp, getApps, cert, type App } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";

let _app: App | undefined;

function getAdminApp(): App {
  if (_app) return _app;
  if (getApps().length) return (_app = getApps()[0]!);
  _app = initializeApp({
    credential: cert({
      projectId:   process.env.FIREBASE_PROJECT_ID!,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL!,
      privateKey:  (process.env.FIREBASE_PRIVATE_KEY ?? "").replace(/\\n/g, "\n"),
    }),
  });
  return _app;
}

export function adminDb()   { return getFirestore(getAdminApp()); }
export function adminAuth() { return getAuth(getAdminApp()); }
