// 텔레그램 경제지표 알림 크론 엔드포인트
// 환경 변수: TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, CRON_SECRET

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
  if (!secret) return true;
  const auth = req.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

export async function GET(req: Request) {
  if (!authOk(req)) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const now   = new Date();
  const hour  = now.getUTCHours();
  const min   = now.getUTCMinutes();
  const dow   = now.getUTCDay(); // 0=일, 5=금
  const today = now.toISOString().slice(0, 10);
  const results: string[] = [];

  try {
    // 금/일 00:00 UTC → 다음 주 주간 요약
    if ((dow === 5 || dow === 0) && hour === 0 && min < 15) {
      const [from, to] = getNextWeekRange();
      const events = await fetchHighImpactUSEvents(from, to);
      await sendTelegram(formatWeeklySummary(events, `${from} ~ ${to}`));
      results.push(`weekly_summary: ${events.length}건`);
    }

    // 평일 00:00 UTC → 당일 예고
    if (dow >= 1 && dow <= 5 && hour === 0 && min < 15) {
      const events = await fetchHighImpactUSEvents(today, today);
      const msg = formatDailySummary(events, today);
      if (msg) { await sendTelegram(msg); results.push(`daily_preview: ${events.length}건`); }
    }

    // 15분마다 → 발표 전 알림 + 발표 후 수치
    {
      const events = await fetchHighImpactUSEvents(today, getDateRange(0, 2)[1]);
      const nowMs  = now.getTime();
      const ALERT_WINDOWS = [720, 240, 60, 15];

      for (const e of events) {
        const eventMs = Date.parse(e.date);
        if (isNaN(eventMs)) continue;
        const diffMin = Math.round((eventMs - nowMs) / 60000);

        for (const target of ALERT_WINDOWS) {
          if (Math.abs(diffMin - target) <= 7) {
            await sendTelegram(formatPreAlert(e, target));
            results.push(`pre_alert_${target}m: ${e.event}`);
          }
        }

        if (diffMin >= -14 && diffMin < 0 && e.actual != null) {
          await sendTelegram(formatActualAlert(e));
          results.push(`actual: ${e.event} = ${e.actual}`);
        }
      }
    }

  } catch (err: any) {
    console.error("[telegram-cron]", err);
    return NextResponse.json({ ok: false, error: err.message });
  }

  return NextResponse.json({ ok: true, results, ts: now.toISOString() });
}
