import "server-only";

const PROJECT_ID = process.env.FIREBASE_PROJECT_ID ?? process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "";
const BASE_URL   = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

/* ─── 타입 변환 유틸 ─────────────────────────────────────────── */

export type FireValue =
  | { stringValue:  string }
  | { integerValue: string }
  | { doubleValue:  number }
  | { booleanValue: boolean }
  | { nullValue:    null }
  | { timestampValue: string }
  | { arrayValue: { values?: FireValue[] } }
  | { mapValue: { fields?: Record<string, FireValue> } };

// JS 값 → Firestore wire 형식
export function toFireValue(v: any): FireValue {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === "boolean")         return { booleanValue: v };
  if (typeof v === "string")          return { stringValue: v };
  if (v instanceof Date)              return { timestampValue: v.toISOString() };
  if (typeof v === "number") {
    return Number.isInteger(v)
      ? { integerValue: String(v) }
      : { doubleValue: v };
  }
  if (Array.isArray(v)) {
    return { arrayValue: { values: v.map(toFireValue) } };
  }
  if (typeof v === "object") {
    const fields: Record<string, FireValue> = {};
    for (const [k, val] of Object.entries(v)) {
      if (val !== undefined) fields[k] = toFireValue(val);
    }
    return { mapValue: { fields } };
  }
  return { stringValue: String(v) };
}

// Firestore wire 형식 → JS 값
export function fromFireValue(fv: FireValue): any {
  if ("nullValue"      in fv) return null;
  if ("booleanValue"   in fv) return (fv as any).booleanValue;
  if ("stringValue"    in fv) return (fv as any).stringValue;
  if ("integerValue"   in fv) return Number((fv as any).integerValue);
  if ("doubleValue"    in fv) return (fv as any).doubleValue;
  if ("timestampValue" in fv) return new Date((fv as any).timestampValue);
  if ("arrayValue"     in fv) {
    const av = (fv as any).arrayValue;
    return (av.values ?? []).map(fromFireValue);
  }
  if ("mapValue" in fv) {
    const mv = (fv as any).mapValue;
    const obj: Record<string, any> = {};
    for (const [k, val] of Object.entries(mv.fields ?? {})) {
      obj[k] = fromFireValue(val as FireValue);
    }
    return obj;
  }
  return null;
}

// Firestore document → plain object
export function docToObject(doc: any): Record<string, any> {
  const fields = doc.fields ?? {};
  const obj: Record<string, any> = {};
  for (const [k, v] of Object.entries(fields)) {
    obj[k] = fromFireValue(v as FireValue);
  }
  // id 추출 (name의 마지막 세그먼트)
  if (doc.name) {
    obj.__id = doc.name.split("/").pop();
  }
  return obj;
}

/* ─── HTTP 헬퍼 ────────────────────────────────────────────────── */

// GET 요청 in-flight 중복 제거 — 동일 URL+token의 병렬 요청을 단일 fetch로 합침
const _inflight = new Map<string, Promise<any>>();

async function req(
  method: string,
  url: string,
  token: string,
  body?: unknown
): Promise<any> {
  // GET 요청만 deduplication (쓰기는 중복 방지 불필요)
  if (method === "GET" && !body) {
    const key = url;
    const existing = _inflight.get(key);
    if (existing) return existing;

    const promise = fetch(url, {
      method: "GET",
      headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
      cache: "no-store",
    }).then(async res => {
      _inflight.delete(key);
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`Firestore REST GET ${url} → ${res.status}: ${text}`);
      }
      return res.json().catch(() => null);
    }).catch(err => {
      _inflight.delete(key);
      throw err;
    });

    _inflight.set(key, promise);
    return promise;
  }

  // POST/PATCH/DELETE — 그대로 실행
  const res = await fetch(url, {
    method,
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type":  "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Firestore REST ${method} ${url} → ${res.status}: ${text}`);
  }
  return res.json().catch(() => null);
}

/* ─── CRUD 연산 ────────────────────────────────────────────────── */

// 단일 문서 GET
export async function getDoc(
  token: string,
  path: string          // e.g. "users/uid/manual_trades/docId"
): Promise<Record<string, any> | null> {
  try {
    const doc = await req("GET", `${BASE_URL}/${path}`, token);
    if (!doc || doc.error) return null;
    return docToObject(doc);
  } catch {
    return null;
  }
}

// 컬렉션 LIST (단순 전체 조회)
export async function listDocs(
  token: string,
  path: string,          // e.g. "users/uid/manual_trades"
  pageSize = 5000
): Promise<Record<string, any>[]> {
  const url  = `${BASE_URL}/${path}?pageSize=${pageSize}`;
  const data = await req("GET", url, token);
  if (!data?.documents) return [];
  return data.documents.map(docToObject);
}

// Structured Query (필터/정렬)
export async function queryDocs(
  token: string,
  collectionPath: string,   // e.g. "users/uid/manual_trades"
  query: Record<string, any>
): Promise<Record<string, any>[]> {
  const parentPath = collectionPath.split("/").slice(0, -1).join("/");
  const collectionId = collectionPath.split("/").pop();
  const url = `${BASE_URL}/${parentPath}:runQuery`;

  const body = {
    structuredQuery: {
      from: [{ collectionId }],
      ...query,
    },
  };

  const results = await req("POST", url, token, body);
  if (!Array.isArray(results)) return [];
  return results
    .filter((r: any) => r.document)
    .map((r: any) => docToObject(r.document));
}

// 문서 SET (upsert)
export async function setDoc(
  token: string,
  path: string,
  data: Record<string, any>,
  merge = false
): Promise<void> {
  const fields: Record<string, FireValue> = {};
  for (const [k, v] of Object.entries(data)) {
    if (v !== undefined) fields[k] = toFireValue(v);
  }

  if (merge) {
    // PATCH with updateMask
    const mask = Object.keys(fields).map(f => `updateMask.fieldPaths=${encodeURIComponent(f)}`).join("&");
    await req("PATCH", `${BASE_URL}/${path}?${mask}`, token, { fields });
  } else {
    await req("PATCH", `${BASE_URL}/${path}`, token, { fields });
  }
}

// 문서 ADD (새 doc ID 자동 생성)
export async function addDoc(
  token: string,
  collectionPath: string,
  data: Record<string, any>
): Promise<string> {
  const fields: Record<string, FireValue> = {};
  for (const [k, v] of Object.entries(data)) {
    if (v !== undefined) fields[k] = toFireValue(v);
  }
  const doc = await req("POST", `${BASE_URL}/${collectionPath}`, token, { fields });
  return doc?.name?.split("/").pop() ?? "";
}

// 문서 DELETE
export async function deleteDoc(
  token: string,
  path: string
): Promise<void> {
  await req("DELETE", `${BASE_URL}/${path}`, token);
}

// Batch write (최대 500)
export async function batchWrite(
  token: string,
  writes: Array<{
    type: "set" | "delete";
    path: string;
    data?: Record<string, any>;
    merge?: boolean;
  }>
): Promise<void> {
  const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents:batchWrite`;

  const DOC_PREFIX = `projects/${PROJECT_ID}/databases/(default)/documents`;
  const firestoreWrites = writes.map(w => {
    if (w.type === "delete") {
      return { delete: `${DOC_PREFIX}/${w.path}` };
    }
    const fields: Record<string, FireValue> = {};
    for (const [k, v] of Object.entries(w.data ?? {})) {
      if (v !== undefined) fields[k] = toFireValue(v);
    }
    if (w.merge) {
      return {
        update: { name: `${DOC_PREFIX}/${w.path}`, fields },
        updateMask: { fieldPaths: Object.keys(fields) },
      };
    }
    return { update: { name: `${DOC_PREFIX}/${w.path}`, fields } };
  });

  // 500개씩 나눠서 처리
  for (let i = 0; i < firestoreWrites.length; i += 500) {
    await req("POST", url, token, { writes: firestoreWrites.slice(i, i + 500) });
  }
}
