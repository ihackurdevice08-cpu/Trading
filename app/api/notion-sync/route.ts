import { NextResponse } from "next/server";
import { getAuthUserId } from "@/lib/firebase/serverAuth";
import { adminDb } from "@/lib/firebase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function bad(msg: string, status = 400) { return NextResponse.json({ ok: false, error: msg }, { status }); }

// 노션 API 헬퍼
async function notionRequest(path: string, method: string, token: string, body?: any) {
  const res = await fetch(`https://api.notion.com/v1${path}`, {
    method,
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type":  "application/json",
      "Notion-Version": "2022-06-28",
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json?.message ?? `Notion API 오류 ${res.status}`);
  return json;
}

function sign(v: number) { return v >= 0 ? "+" : ""; }
function fmt(v: number, d = 2) { return v.toLocaleString("ko-KR", { minimumFractionDigits: d, maximumFractionDigits: d }); }

export async function POST(req: Request) {
  const uid = await getAuthUserId();
  if (!uid) return bad("unauthorized", 401);

  const body = await req.json().catch(() => ({}));
  const { date, trades, stats } = body;
  // date: "YYYY-MM-DD"
  // trades: Trade[]  (오늘 거래 배열)
  // stats: { totalPnl, wins, losses, wr, avgW, avgL, fundingPnl, bestTrade, worstTrade, symbols, mistakeCount }

  if (!date || !trades || !stats) return bad("date, trades, stats 필요");

  const snap = await adminDb().collection("users").doc(uid).collection("user_settings").doc("default").get();
  const notion = snap.exists ? (snap.data()?.notion ?? {}) : {};

  if (!notion.token)       return bad("노션 Integration Token이 설정되지 않았습니다");
  if (!notion.database_id) return bad("노션 데이터베이스 ID가 설정되지 않았습니다");

  const s = stats;

  // 심볼별 텍스트
  const symbolLines = (s.symbols ?? []).map((sym: any) =>
    `${sym.sym}: ${sym.pnl >= 0 ? "+" : ""}${fmt(sym.pnl)} USDT (${sym.count}건 · ${sym.wr}%)`
  );

  // 실수 태그 텍스트
  const mistakeLines = Object.entries(s.mistakeCount ?? {}).map(([tag, cnt]) => `${tag}: ${cnt}회`);

  // 노션 블록 배열 구성
  const children: any[] = [
    // 요약 섹션
    heading2("📈 요약"),
    table2col([
      ["총 PnL", `${sign(s.totalPnl)}${fmt(s.totalPnl)} USDT`],
      ...(s.fundingPnl !== 0 ? [["펀딩피", `${sign(s.fundingPnl)}${fmt(s.fundingPnl)} USDT`]] : []),
      ["거래 수", `${trades.length}건 (${s.wins}승 ${s.losses}패)`],
      ...(s.wr != null      ? [["승률",     `${fmt(s.wr, 1)}%`]] : []),
      ...(s.avgW != null    ? [["평균 익절", `+${fmt(s.avgW)} USDT`]] : []),
      ...(s.avgL != null    ? [["평균 손절", `${fmt(s.avgL)} USDT`]] : []),
      ...(s.bestTrade       ? [["🏆 최고",  `${s.bestTrade.symbol} +${fmt(s.bestTrade.pnl)}`]] : []),
      ...(s.worstTrade?.pnl < 0 ? [["💀 최악", `${s.worstTrade.symbol} ${fmt(s.worstTrade.pnl)}`]] : []),
    ] as [string,string][]),

    // 심볼별
    ...(symbolLines.length > 0 ? [
      heading2("💹 심볼별 성과"),
      ...symbolLines.map((l: string) => bullet(l)),
    ] : []),

    // 실수 태그
    ...(mistakeLines.length > 0 ? [
      heading2("⚠️ 오늘의 패턴"),
      ...mistakeLines.map((l: string) => bullet(l)),
    ] : []),

    // 반성/계획 템플릿
    heading2("📝 오늘의 반성"),
    paragraph(""),
    heading2("🎯 내일 계획"),
    paragraph(""),
  ];

  // 노션 페이지 생성
  const page = await notionRequest("/pages", "POST", notion.token, {
    parent: { database_id: notion.database_id },
    properties: {
      // 노션 DB의 타이틀 속성 이름이 다를 수 있으나 "Name"이 기본
      Name: {
        title: [{ text: { content: `📊 ${date} 마감 리포트` } }],
      },
      // 날짜 속성이 있으면 설정 (없으면 노션이 무시)
      Date: {
        date: { start: date },
      },
      // PnL 속성
      PnL: {
        number: Number(s.totalPnl.toFixed(2)),
      },
    },
    children,
  });

  return NextResponse.json({ ok: true, page_url: page.url, page_id: page.id });
}

// ── 노션 블록 헬퍼 ──────────────────────────────────────────
function heading2(text: string) {
  return { object: "block", type: "heading_2", heading_2: { rich_text: [{ text: { content: text } }] } };
}
function bullet(text: string) {
  return { object: "block", type: "bulleted_list_item", bulleted_list_item: { rich_text: [{ text: { content: text } }] } };
}
function paragraph(text: string) {
  return { object: "block", type: "paragraph", paragraph: { rich_text: [{ text: { content: text } }] } };
}
function table2col(rows: [string, string][]) {
  return {
    object: "block",
    type: "table",
    table: {
      table_width: 2,
      has_column_header: true,
      has_row_header: false,
      children: [
        // 헤더 행
        tableRow(["항목", "값"]),
        // 데이터 행
        ...rows.map(([k, v]) => tableRow([k, v])),
      ],
    },
  };
}
function tableRow(cells: string[]) {
  return {
    object: "block",
    type: "table_row",
    table_row: {
      cells: cells.map(c => [{ type: "text", text: { content: c } }]),
    },
  };
}
