import "server-only";

// firebase-admin 전체를 단일 require로 로드 (서브패키지 경로 없음)
/* eslint-disable @typescript-eslint/no-require-imports */
/* eslint-disable @typescript-eslint/no-explicit-any */

function parsePrivateKey(raw: string | undefined): string {
  if (!raw) throw new Error("FIREBASE_PRIVATE_KEY 없음");
  let key = raw.replace(/^["']|["']$/g, "");
  if (!key.includes("\n")) key = key.replace(/\\n/g, "\n");
  return key;
}

let _db: any   = null;
let _auth: any = null;

function getAdmin() {
  if (_db && _auth) return { db: _db, auth: _auth };

  const admin = require("firebase-admin");

  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId:   process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey:  parsePrivateKey(process.env.FIREBASE_PRIVATE_KEY),
      }),
    });
  }

  _db   = admin.firestore();
  _auth = admin.auth();
  return { db: _db, auth: _auth };
}

export function adminDb():   any { return getAdmin().db; }
export function adminAuth(): any { return getAdmin().auth; }
