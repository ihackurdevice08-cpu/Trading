export interface CalendarEvent {
  id:       string;
  date:     string;   // ISO e.g. "2026-03-17T13:30:00"
  country:  string;
  category: string;
  event:    string;
  actual:   string | null;
  forecast: string | null;
  previous: string | null;
  importance: number; // 1~3
}

const TE_BASE = "https://api.tradingeconomics.com/calendar/country/united%20states";

/**
 * Trading Economics에서 미국 별3개(importance=3) 지표 조회
 * fromDate/toDate: "YYYY-MM-DD"
 */
export async function fetchHighImpactUSEvents(
  fromDate: string,
  toDate: string
): Promise<CalendarEvent[]> {
  const key = process.env.TRADING_ECONOMICS_KEY || "guest:guest";
  const url = `${TE_BASE}/${fromDate}/${toDate}?c=${key}&importance=3`;

  const res = await fetch(url, {
    headers: { "Accept": "application/json" },
    next: { revalidate: 0 },
  });

  if (!res.ok) throw new Error(`Trading Economics API 오류 ${res.status}`);

  const raw: any[] = await res.json();

  return raw
    .filter(e => e.Country?.toLowerCase().includes("united states") || e.Currency === "USD")
    .map(e => ({
      id:         String(e.CalendarId || e.Id || Math.random()),
      date:       e.Date || "",
      country:    e.Country || "United States",
      category:   e.Category || "",
      event:      e.Event || e.Category || "",
      actual:     e.Actual   ?? null,
      forecast:   e.Forecast ?? null,
      previous:   e.Previous ?? null,
      importance: Number(e.Importance) || 3,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/** UTC 기준 오늘~7일 후 날짜 범위 */
export function getDateRange(offsetStart = 0, offsetEnd = 7): [string, string] {
  const from = new Date(Date.now() + offsetStart * 86400_000);
  const to   = new Date(Date.now() + offsetEnd   * 86400_000);
  return [from.toISOString().slice(0, 10), to.toISOString().slice(0, 10)];
}

/** 다음 주 월~일 범위 계산 */
export function getNextWeekRange(): [string, string] {
  const now = new Date();
  const dow  = now.getUTCDay(); // 0=일
  const toMon = (dow === 0 ? 1 : 8 - dow); // 다음 월요일까지 남은 일수
  const mon = new Date(now.getTime() + toMon * 86400_000);
  const sun = new Date(mon.getTime() + 6   * 86400_000);
  return [mon.toISOString().slice(0, 10), sun.toISOString().slice(0, 10)];
}
