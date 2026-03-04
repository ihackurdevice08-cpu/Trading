import { NextResponse } from "next/server";
import { getAuthUserId } from "@/lib/supabase/serverAuth";
import { supabaseServer } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const uid = await getAuthUserId();
  if (!uid) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const sb = supabaseServer();

  // 1. 전체 집계
  const { data: all } = await sb
    .from("manual_trades")
    .select("id, symbol, side, opened_at, pnl, tags, notes")
    .eq("user_id", uid)
    .order("opened_at", { ascending: false });

  const rows = all || [];
  const total       = rows.length;
  const withPnl     = rows.filter(r => r.pnl != null);
  const nullPnl     = rows.filter(r => r.pnl == null);
  const sumPnl      = withPnl.reduce((s, r) => s + Number(r.pnl), 0);

  // 2. 태그별 분류
  const byTag: Record<string, { count: number; sum: number }> = {};
  for (const r of rows) {
    const tag = Array.isArray(r.tags) ? (r.tags[0] || "no-tag") : "no-tag";
    if (!byTag[tag]) byTag[tag] = { count: 0, sum: 0 };
    byTag[tag].count++;
    byTag[tag].sum += Number(r.pnl || 0);
  }

  // 3. pnl 절댓값 TOP 10
  const top10 = [...rows]
    .filter(r => r.pnl != null)
    .sort((a, b) => Math.abs(Number(b.pnl)) - Math.abs(Number(a.pnl)))
    .slice(0, 10)
    .map(r => ({
      id: r.id,
      symbol: r.symbol,
      side: r.side,
      opened_at: r.opened_at?.slice(0, 16),
      pnl: Number(r.pnl),
      tags: r.tags,
      // notes에서 fee_included 확인
      fee_included: (() => {
        try { return JSON.parse(r.notes || "{}").fee_included ?? false; } catch { return "parse_err"; }
      })(),
      fee: (() => {
        try { return JSON.parse(r.notes || "{}").fee ?? null; } catch { return null; }
      })(),
    }));

  // 4. 중복 id 확인
  const idSet = new Set<string>();
  const dupes: string[] = [];
  for (const r of rows) {
    if (idSet.has(r.id)) dupes.push(r.id);
    idSet.add(r.id);
  }

  // 5. fills_raw 집계
  const { data: fills } = await sb
    .from("fills_raw")
    .select("id, pnl, fee, trade_side, ts_ms")
    .eq("user_id", uid);

  const fillRows = fills || [];
  const closeFills = fillRows.filter(f => String(f.trade_side || "").toLowerCase().includes("close"));
  const fillSumPnl = closeFills.reduce((s, f) => s + Number(f.pnl || 0), 0);
  const fillSumFee = fillRows.reduce((s, f) => s + Number(f.fee || 0), 0);

  // 6. 리스크 설정 (seed)
  const { data: rs } = await sb.from("risk_settings").select("seed_usd").eq("user_id", uid).maybeSingle();
  const seed = Number(rs?.seed_usd || 0);

  // 7. 출금 합계
  const { data: wd } = await sb.from("withdrawals").select("amount, source").eq("user_id", uid);
  const wdRows = wd || [];
  const totalWithdrawal = wdRows.reduce((s, r) => s + Number(r.amount || 0), 0);

  return NextResponse.json({
    summary: {
      seed,
      total_trades: total,
      with_pnl: withPnl.length,
      null_pnl: nullPnl.length,
      sum_pnl: Number(sumPnl.toFixed(2)),
      equity_formula: `${seed} + ${sumPnl.toFixed(2)} - ${totalWithdrawal.toFixed(2)} = ${(seed + sumPnl - totalWithdrawal).toFixed(2)}`,
      total_withdrawal: Number(totalWithdrawal.toFixed(2)),
    },
    fills_raw: {
      total: fillRows.length,
      close_fills: closeFills.length,
      sum_pnl_from_fills: Number(fillSumPnl.toFixed(2)),
      sum_fee: Number(fillSumFee.toFixed(2)),
      net_if_fee_included: Number((fillSumPnl + fillSumFee).toFixed(2)),
    },
    by_tag: Object.entries(byTag).map(([tag, v]) => ({
      tag, count: v.count, sum: Number(v.sum.toFixed(2))
    })).sort((a, b) => b.count - a.count),
    duplicate_ids: dupes.length,
    top10_by_abs_pnl: top10,
    withdrawals: wdRows,
  });
}
