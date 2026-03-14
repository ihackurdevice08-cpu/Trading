/**
 * 텔레그램 경제지표 알림 크론 엔드포인트
 *
 * 스케줄 (vercel.json에 등록):
 *   - "0 0 * * 5,0"  → 금/일 00:00 UTC  : 다음 주 주간 요약
 *   - "0 0 * * 1-5"  → 평일 00:00 UTC   : 당일 지표 예고
 *   - "*/15 * * * *" → 15분마다          : 발표 전 알림 + 발표 후 수치
 *
 * Vercel Hobby 플랜: 크론 2개 / 하루 1회 제한
 * → Pro 플랜이거나 외부 cron(cron-job.org)으로 이 endpoint 직접 호출 시 모두 동작
 *
 * 환경 변수:
 *   TELEGRAM_BOT_TOKEN   BotFather에서 발급
 *   TELEGRAM_CHAT_ID     채팅/채널 ID
 *   CRON_SECRET          Vercel 자동 생성 (인증용)
 *   TRADING_ECONOMICS_KEY (선택, 기본 guest:guest)
 */

import { NextResponse } from "next/server";
import { sendTelegram } from "@/lib/telegram/send";
import { fetchHighImpactUSEvents, getNextWeekRange, getDateRange } from "@/lib/calendar/fetch";
import {
  formatWeeklySummary,
  formatDailySummary,
  formatPreAlert,
  formatActualAlert,
} from "@/lib/calendar/format";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

function authOk(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true; // 미설정 시 통과 (개발용)
  const auth = req.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

function utcNow() { return new Date(); }

export async function GET(req: Request) {
  if (!authOk(req)) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const now     = utcNow();
  const hour    = now.getUTCHours();
  const min     = now.getUTCMinutes();
  const dow     = now.getUTCDay();   // 0=일, 5=금
  const today   = now.toISOString().slice(0, 10);
  const results: string[] = [];

  try {
    // ── ① 금/일 00:00 UTC → 다음 주 주간 요약 ──────────────
    if ((dow === 5 || dow === 0) && hour === 0 && min < 15) {
      const [from, to] = getNextWeekRange();
      const events = await fetchHighImpactUSEvents(from, to);
      const msg = formatWeeklySummary(events, `${from} ~ ${to}`);
      await sendTelegram(msg);
      results.push(`weekly_summary: ${events.length}건`);
    }

    // ── ② 평일(월~금) 00:00 UTC → 당일 예고 ────────────────
    if (dow >= 1 && dow <= 5 && hour === 0 && min < 15) {
      const [from, to] = [today, today];
      const events = await fetchHighImpactUSEvents(from, to);
      const msg = formatDailySummary(events, today);
      if (msg) { await sendTelegram(msg); results.push(`daily_preview: ${events.length}건`); }
      else       results.push("daily_preview: 오늘 지표 없음");
    }

    // ── ③ 15분마다 → 발표 전 알림 + 발표 후 수치 ─────────────
    {
      // 향후 13시간 이내 지표 조회 (12h 전 알림 커버)
      const [from] = getDateRange(0, 1);
      const events = await fetchHighImpactUSEvents(from, getDateRange(0, 2)[1]);
      const nowMs  = now.getTime();
      const ALERT_WINDOWS = [720, 240, 60, 15]; // 분

      for (const e of events) {
        const eventMs = Date.parse(e.date);
        if (isNaN(eventMs)) continue;
        const diffMin = Math.round((eventMs - nowMs) / 60000);

        // 발표 전 알림: 각 창 ±7분 이내
        for (const target of ALERT_WINDOWS) {
          if (Math.abs(diffMin - target) <= 7) {
            await sendTelegram(formatPreAlert(e, target));
            results.push(`pre_alert_${target}m: ${e.event}`);
          }
        }

        // 발표 후 수치: 발표 직후 (0~14분 경과) + actual 있을 때
        if (diffMin >= -14 && diffMin < 0 && e.actual != null) {
          await sendTelegram(formatActualAlert(e));
          results.push(`actual: ${e.event} = ${e.actual}`);
        }
      }
    }

  } catch (err: any) {
    console.error("[telegram-cron] 오류:", err);
    return NextResponse.json({ ok: false, error: err.message });
  }

  return NextResponse.json({ ok: true, results, ts: now.toISOString() });
}
