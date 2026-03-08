/**
 * Supabase → Firebase Firestore 마이그레이션 스크립트
 *
 * 사용법:
 * 1. Supabase 대시보드 → Table Editor → 각 테이블 → Export CSV
 *    필요한 테이블: manual_trades, fills_raw, exchange_accounts,
 *                   risk_settings, withdrawals, user_settings
 * 2. CSV 파일들을 이 스크립트와 같은 폴더(scripts/)에 저장
 * 3. 아래 SUPABASE_UID_TO_FIREBASE_UID 값 입력
 * 4. node --experimental-vm-modules scripts/migrate-to-firebase.mjs
 *    (또는: cd scripts && node migrate-to-firebase.mjs)
 */

import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { readFileSync, existsSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dir = dirname(fileURLToPath(import.meta.url));

// ── ❶ 여기만 수정하세요 ─────────────────────────────────────
const SUPABASE_UID_TO_FIREBASE_UID = {
  // Supabase UUID          : Firebase UID
  // "xxxxxxxx-xxxx-...":  "AbCdEfGhIjKlMnOp...",
};
// ────────────────────────────────────────────────────────────

const SERVICE_ACCOUNT = JSON.parse(
  readFileSync(join(__dir, "../trading-monitor-fa03f-firebase-adminsdk-fbsvc-815952f839.json"), "utf8")
);

initializeApp({ credential: cert(SERVICE_ACCOUNT) });
const db = getFirestore();

// ── 유틸 ─────────────────────────────────────────────────────
function parseCsv(filename) {
  const path = join(__dir, filename);
  if (!existsSync(path)) { console.log(`  ⚠️  ${filename} 없음 — 건너뜀`); return null; }
  const lines = readFileSync(path, "utf8").split("\n").filter(Boolean);
  if (lines.length < 2) return [];
  const headers = parseCSVLine(lines[0]);
  return lines.slice(1).map(line => {
    const vals = parseCSVLine(line);
    return Object.fromEntries(headers.map((h, i) => [h, vals[i] ?? ""]));
  });
}
function parseCSVLine(line) {
  const result = []; let cur = ""; let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') { inQ = !inQ; }
    else if (c === "," && !inQ) { result.push(cur.trim()); cur = ""; }
    else { cur += c; }
  }
  result.push(cur.trim());
  return result;
}
const toTs  = v => { if (!v) return null; try { return Timestamp.fromDate(new Date(v)); } catch { return null; } };
const toNum = v => { if (v === "" || v == null) return null; const n = Number(v); return isFinite(n) ? n : null; };
const toArr = v => {
  if (!v) return [];
  try { const p = JSON.parse(v); return Array.isArray(p) ? p : [String(v)]; } catch {}
  return String(v).replace(/[{}"]/g, "").split(",").map(s => s.trim()).filter(Boolean);
};

async function batchWrite(writes) {
  const BATCH = 499;
  for (let i = 0; i < writes.length; i += BATCH) {
    const batch = db.batch();
    writes.slice(i, i + BATCH).forEach(({ ref, data }) => batch.set(ref, data, { merge: true }));
    await batch.commit();
    process.stdout.write(`\r  ${Math.min(i + BATCH, writes.length)}/${writes.length}`);
  }
  if (writes.length) console.log("");
}

// ── 마이그레이션 ─────────────────────────────────────────────
async function migrate(uid, fid) {
  const uRef = db.collection("users").doc(fid);

  // manual_trades
  console.log("\n📊 manual_trades...");
  const trades = parseCsv("manual_trades.csv");
  if (trades) {
    const rows = trades.filter(r => r.user_id === uid);
    await batchWrite(rows.map(r => ({
      ref: uRef.collection("manual_trades").doc(r.id),
      data: {
        symbol: r.symbol || "", side: r.side || "",
        opened_at: toTs(r.opened_at), closed_at: toTs(r.closed_at),
        pnl: toNum(r.pnl), tags: toArr(r.tags),
        notes: r.notes || null, group_id: r.group_id || null,
      },
    })));
    console.log(`  ✅ ${rows.length}건`);
  }

  // fills_raw
  console.log("\n📋 fills_raw...");
  const fills = parseCsv("fills_raw.csv");
  if (fills) {
    const rows = fills.filter(r => r.user_id === uid);
    await batchWrite(rows.map(r => ({
      ref: uRef.collection("fills_raw").doc(r.id),
      data: {
        account_id: r.account_id || null, exchange: r.exchange || "bitget",
        product_type: r.product_type || null, trade_id: r.trade_id || null,
        order_id: r.order_id || null, symbol: r.symbol || "",
        side: r.side || null, trade_side: r.trade_side || null,
        price: toNum(r.price), size: toNum(r.size),
        fee: toNum(r.fee), pnl: toNum(r.pnl), ts_ms: toNum(r.ts_ms),
        payload: (() => { try { return JSON.parse(r.payload || "{}"); } catch { return {}; } })(),
      },
    })));
    console.log(`  ✅ ${rows.length}건`);
  }

  // exchange_accounts
  console.log("\n🔑 exchange_accounts...");
  const accts = parseCsv("exchange_accounts.csv");
  if (accts) {
    const rows = accts.filter(r => r.user_id === uid);
    await batchWrite(rows.map(r => ({
      ref: uRef.collection("exchange_accounts").doc(r.id),
      data: {
        exchange: r.exchange || "", alias: r.alias || "",
        api_key_enc: r.api_key_enc || "", api_secret_enc: r.api_secret_enc || "",
        passphrase_enc: r.passphrase_enc || "",
        created_at: toTs(r.created_at), updated_at: toTs(r.updated_at),
      },
    })));
    console.log(`  ✅ ${rows.length}건`);
  }

  // risk_settings (단일 문서)
  console.log("\n⚙️  risk_settings...");
  const risks = parseCsv("risk_settings.csv");
  if (risks) {
    const r = risks.find(x => x.user_id === uid);
    if (r) {
      await uRef.collection("risk_settings").doc("default").set({
        seed_usd: toNum(r.seed_usd) ?? 10000,
        max_dd_usd: toNum(r.max_dd_usd) ?? 500,
        max_dd_pct: toNum(r.max_dd_pct) ?? 5,
        dd_mode: r.dd_mode || "drawdown",
        dd_floor_usd: toNum(r.dd_floor_usd),
        max_daily_loss_usd: toNum(r.max_daily_loss_usd) ?? 300,
        max_daily_loss_pct: toNum(r.max_daily_loss_pct) ?? 3,
        max_consecutive_losses: toNum(r.max_consecutive_losses) ?? 3,
        manual_trading_state: r.manual_trading_state || "auto",
        pnl_from: r.pnl_from || null,
      });
      console.log("  ✅ 완료");
    } else { console.log("  ⚠️  데이터 없음"); }
  }

  // withdrawals
  console.log("\n💸 withdrawals...");
  const wds = parseCsv("withdrawals.csv");
  if (wds) {
    const rows = wds.filter(r => r.user_id === uid);
    await batchWrite(rows.map(r => ({
      ref: uRef.collection("withdrawals").doc(r.id),
      data: {
        amount: toNum(r.amount) ?? 0, source: r.source || "profit",
        note: r.note || "", withdrawn_at: toTs(r.withdrawn_at),
      },
    })));
    console.log(`  ✅ ${rows.length}건`);
  }

  // user_settings
  console.log("\n🎨 user_settings...");
  const usettings = parseCsv("user_settings.csv");
  if (usettings) {
    const r = usettings.find(x => x.user_id === uid);
    if (r) {
      const appearance = (() => { try { return JSON.parse(r.appearance || "{}"); } catch { return {}; } })();
      await uRef.collection("user_settings").doc("default").set({ appearance });
      console.log("  ✅ 완료");
    } else { console.log("  ⚠️  데이터 없음"); }
  }
}

// ── 실행 ─────────────────────────────────────────────────────
async function main() {
  console.log("🚀 Supabase → Firebase 마이그레이션\n");

  const entries = Object.entries(SUPABASE_UID_TO_FIREBASE_UID);
  if (!entries.length) {
    console.log("❌ SUPABASE_UID_TO_FIREBASE_UID를 먼저 입력하세요!\n");
    console.log("방법:");
    console.log("  1. 앱에서 Firebase Google 로그인 완료");
    console.log("  2. Firebase Console → Authentication → Users → UID 복사");
    console.log("  3. Supabase Dashboard → Authentication → Users → UUID 복사");
    console.log("  4. 이 파일 상단 SUPABASE_UID_TO_FIREBASE_UID 객체에 입력");
    process.exit(1);
  }

  for (const [suid, fuid] of entries) {
    console.log(`\n👤 ${suid.slice(0,8)}... → ${fuid.slice(0,8)}...`);
    await migrate(suid, fuid);
  }

  console.log("\n\n🎉 완료! Firebase Console → Firestore에서 확인하세요.");
}

main().catch(e => { console.error("\n❌ 오류:", e.message); process.exit(1); });
