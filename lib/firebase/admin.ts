import { initializeApp, getApps, cert, App } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";

let app: App;

function getAdminApp(): App {
  if (!app && !getApps().length) {
    app = initializeApp({
      credential: cert({
        projectId:   process.env.FIREBASE_PROJECT_ID!,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL!,
        privateKey:  process.env.FIREBASE_PRIVATE_KEY!.replace(/\\n/g, "\n"),
      }),
    });
  }
  return app ?? getApps()[0]!;
}

export function adminDb() { return getFirestore(getAdminApp()); }
export function adminAuth() { return getAuth(getAdminApp()); }
