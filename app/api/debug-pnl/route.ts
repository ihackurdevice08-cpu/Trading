import { NextResponse } from "next/server";
import { getAuthUserId } from "@/lib/firebase/serverAuth";
import { adminDb } from "@/lib/firebase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function toIso(v: any) { return v?.toDate?.()?.toISOString() ?? v ?? null; }

export async function GET() {
  const uid = await getAuthUserId();
  if (!uid) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const db = adminDb();
  const userRef = db.collection("users").doc(uid);

  const [tradesSnap, fillsSnap, rsSnap, wdSnap] = await Promise.all([
    userRef.collection("manual_trades").orderBy("opened_at", "desc").get(),
    userRef.collection("fills_raw").get(),
    userRef.collection("risk_settings").doc("default").get(),
    userRef.collection("withdrawals").get(),
  ]);

  const rows = tradesSnap.docs.map(d => ({ id: d.id, ...d.data(),
    opened_at: toIso(d.data().opened_at) }));

  const withPnl = rows.filter(r => r.pnl != null);
  const nullPnl = rows.filter(r => r.pnl == null);
  const sumPnl  = withPnl.reduce((s, r) => s + Number(r.pnl), 0);

  const byTag: Record<string, { count: number; sum: number }> = {};
  for (const r of rows) {
    const tag = Array.isArray(r.tags) ? (r.tags[0] || "no-tag") : "no-tag";
    if (!byTag[tag]) byTag[tag] = { count: 0, sum: 0 };
    byTag[tag].count++;
    byTag[tag].sum += Number((r as any).pnl || 0);
  }

  const top10 = [...rows].filter(r => r.pnl != null)
    .sort((a, b) => Math.abs(Number(b.pnl)) - Math.abs(Number(a.pnl)))
    .slice(0, 10).map(r => ({
      id: r.id, symbol: (r as any).symbol, side: (r as any).side,
      opened_at: String(r.opened_at || "").slice(0, 16), pnl: Number(r.pnl),
      tags: (r as any).tags,
    }));

  const fillRows = fillsSnap.docs.map(d => d.data());
  const closeFills = fillRows.filter(f => String(f.trade_side || "").toLowerCase().includes("close"));
  const fillSumPnl = closeFills.reduce((s, f) => s + Number(f.pnl || 0), 0);
  const fillSumFee = fillRows.reduce((s, f) => s + Number(f.fee || 0), 0);

  const seed = Number(rsSnap.exists ? rsSnap.data()?.seed_usd ?? 0 : 0);
  const wdRows = wdSnap.docs.map(d => d.data());
  const totalWithdrawal = wdRows.reduce((s, r) => s + Number(r.amount || 0), 0);

  return NextResponse.json({
    summary: {
      seed, total_trades: rows.length,
      with_pnl: withPnl.length, null_pnl: nullPnl.length,
      sum_pnl: Number(sumPnl.toFixed(2)),
      equity_formula: `${seed} + ${sumPnl.toFixed(2)} - ${totalWithdrawal.toFixed(2)} = ${(seed + sumPnl - totalWithdrawal).toFixed(2)}`,
      total_withdrawal: Number(totalWithdrawal.toFixed(2)),
    },
    fills_raw: {
      total: fillRows.length, close_fills: closeFills.length,
      sum_pnl_from_fills: Number(fillSumPnl.toFixed(2)), sum_fee: Number(fillSumFee.toFixed(2)),
      net_if_fee_included: Number((fillSumPnl + fillSumFee).toFixed(2)),
    },
    by_tag: Object.entries(byTag).map(([tag, v]) => ({ tag, count: v.count, sum: Number(v.sum.toFixed(2)) }))
      .sort((a, b) => b.count - a.count),
    top10_by_abs_pnl: top10, withdrawals: wdRows,
  });
}
