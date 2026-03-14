import type { CalendarEvent } from "./fetch";

const DOW_KO = ["일", "월", "화", "수", "목", "금", "토"];

function kstTime(isoDate: string): string {
  const d = new Date(isoDate);
  if (isNaN(d.getTime())) return "시간미정";
  const kst = new Date(d.getTime() + 9 * 3600_000);
  const h = String(kst.getUTCHours()).padStart(2, "0");
  const m = String(kst.getUTCMinutes()).padStart(2, "0");
  return `${h}:${m} KST`;
}

function utcTime(isoDate: string): string {
  const d = new Date(isoDate);
  if (isNaN(d.getTime())) return "시간미정";
  const h = String(d.getUTCHours()).padStart(2, "0");
  const m = String(d.getUTCMinutes()).padStart(2, "0");
  return `${h}:${m} UTC`;
}

function dateLabel(isoDate: string): string {
  const d = new Date(isoDate);
  if (isNaN(d.getTime())) return isoDate.slice(0, 10);
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const dow = DOW_KO[d.getUTCDay()];
  return `${mm}/${dd} (${dow})`;
}

/** 주간 요약 메시지 (금/일 00:00 UTC 발송) */
export function formatWeeklySummary(events: CalendarEvent[], weekLabel: string): string {
  if (events.length === 0)
    return `📅 <b>다음 주 🇺🇸 고영향 지표 없음</b>\n─\n조용한 한 주가 될 것 같습니다.`;

  const byDay: Record<string, CalendarEvent[]> = {};
  for (const e of events) {
    const day = e.date.slice(0, 10);
    if (!byDay[day]) byDay[day] = [];
    byDay[day].push(e);
  }

  let msg = `📅 <b>다음 주 🇺🇸 주요 경제지표</b> (${weekLabel})\n`;
  msg += `━━━━━━━━━━━━━━━━\n`;

  for (const [day, evts] of Object.entries(byDay).sort()) {
    msg += `\n🔴 <b>${dateLabel(day + "T00:00:00")}</b>\n`;
    for (const e of evts) {
      const fc = e.forecast != null ? `  예측 <code>${e.forecast}</code>` : "";
      const pv = e.previous != null ? `  이전 <code>${e.previous}</code>` : "";
      msg += `  • ${utcTime(e.date)} — <b>${e.event}</b>${fc}${pv}\n`;
    }
  }

  msg += `━━━━━━━━━━━━━━━━\n`;
  msg += `총 <b>${events.length}개</b> 고영향 지표`;
  return msg;
}

/** 당일 예고 (평일 00:00 UTC) */
export function formatDailySummary(events: CalendarEvent[], todayLabel: string): string {
  if (events.length === 0) return "";  // 지표 없으면 알림 안 보냄

  let msg = `🗓 <b>오늘 🇺🇸 주요 경제지표</b> — ${todayLabel}\n`;
  msg += `━━━━━━━━━━━━━━━\n`;
  for (const e of events) {
    const fc = e.forecast != null ? `  예측 <code>${e.forecast}</code>` : "";
    const pv = e.previous != null ? `  이전 <code>${e.previous}</code>` : "";
    msg += `🔴 ${utcTime(e.date)}  <b>${e.event}</b>${fc}${pv}\n`;
  }
  return msg.trim();
}

/** 발표 전 알림 (12h/4h/1h/15min) */
export function formatPreAlert(e: CalendarEvent, minutesBefore: number): string {
  const labels: Record<number, string> = {
    720: "12시간", 240: "4시간", 60: "1시간", 15: "15분"
  };
  const label = labels[minutesBefore] || `${minutesBefore}분`;
  const fc = e.forecast != null ? `\n📊 예측 <code>${e.forecast}</code>  |  이전 <code>${e.previous ?? "—"}</code>` : "";

  return [
    `⏰ <b>${label} 후 발표</b>`,
    `🇺🇸 <b>${e.event}</b>`,
    `🕐 ${utcTime(e.date)}  (${kstTime(e.date)})`,
    fc,
  ].filter(Boolean).join("\n");
}

/** 발표 후 수치 */
export function formatActualAlert(e: CalendarEvent): string {
  const actual   = e.actual   ?? "—";
  const forecast = e.forecast ?? "—";
  const previous = e.previous ?? "—";

  let direction = "";
  if (e.actual != null && e.forecast != null) {
    const a = parseFloat(String(e.actual).replace("%", ""));
    const f = parseFloat(String(e.forecast).replace("%", ""));
    if (!isNaN(a) && !isNaN(f)) {
      direction = a > f ? "\n📈 <b>예측 상회</b> (USD 강세 가능)" : a < f ? "\n📉 <b>예측 하회</b> (USD 약세 가능)" : "\n➡️ 예측 부합";
    }
  }

  return [
    `🚨 <b>방금 발표</b>`,
    `🇺🇸 <b>${e.event}</b>`,
    `✅ 실제 <code>${actual}</code>  |  예측 <code>${forecast}</code>  |  이전 <code>${previous}</code>`,
    direction,
  ].filter(Boolean).join("\n");
}
