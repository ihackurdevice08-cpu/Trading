import "server-only";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const admin = require("firebase-admin");

let initialized = false;

function init() {
  if (initialized || admin.apps.length > 0) return;
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId:   process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey:  (process.env.FIREBASE_PRIVATE_KEY ?? "").replace(/\\n/g, "\n"),
    }),
  });
  initialized = true;
}

export function adminDb() {
  init();
  return admin.firestore() as import("firebase-admin").firestore.Firestore;
}

export function adminAuth() {
  init();
  return admin.auth() as import("firebase-admin").auth.Auth;
}
