import "server-only";
import { cookies } from "next/headers";
import { adminAuth } from "./admin";

export async function getAuthUserId(): Promise<string | null> {
  try {
    const store = await cookies();
    const token = store.get("__session")?.value;
    if (!token) return null;
    const decoded = await adminAuth().verifyIdToken(token);
    return decoded.uid;
  } catch {
    return null;
  }
}
