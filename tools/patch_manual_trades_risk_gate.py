from pathlib import Path
import re

p = Path("app/(app)/manual-trades/page.tsx")
s = p.read_text(encoding="utf-8")

if "riskGateAck" in s and "/api/risk-log" in s:
    print("already patched:", p)
    raise SystemExit(0)

# 1) state 추가: risk gate ack + banner msg
#    (최대한 안전하게: useState 선언 근처에 삽입)
needle = "const [saving, setSaving] = useState(false);"
if needle not in s:
    print("skip: cannot find saving state line")
    raise SystemExit(0)

insert_state = """
  const [riskGate, setRiskGate] = useState<any>(null); // { state, reasons, message }
  const [riskGateAck, setRiskGateAck] = useState(false);
"""

s = s.replace(needle, needle + "\n" + insert_state)

# 2) submit 함수(저장 함수)에서 저장 전에 risk 체크
#    manual-trades 페이지는 구현이 여러 버전일 수 있어서 "async function submit" 또는 "async function save"를 탐색
m = re.search(r"async function (submit|save|create)\s*\(\)\s*\{", s)
if not m:
    print("skip: cannot find submit/save/create function")
    raise SystemExit(0)

fn_name = m.group(1)

# 함수 시작 지점 이후에 risk 체크 코드 삽입 (첫 줄 바로 아래)
start = m.end()

risk_check = f"""
    // ---------------------------
    // Risk Gate: STOP/SLOWDOWN이어도 입력은 허용하되,
    // 경고 메시지 표시 + risk_events에 기록
    // ---------------------------
    try {{
      const r = await fetch("/api/risk", {{ cache: "no-store" }});
      const j = await r.json();
      if (j?.ok && (j.state === "STOP" || j.state === "SLOWDOWN")) {{
        const message =
          j.state === "STOP"
            ? "지금은 리스크 신호가 많이 쌓여 있어요. 사람이라면 흔들릴 수 있어요. 다만 이번 입력은 ‘기록’으로 남기고, 속도를 크게 줄이는 걸 추천해요."
            : "리스크 신호가 감지됐어요. 괜찮아요—이번 기록을 남기고, 다음 진입은 한 템포만 늦추면 충분히 좋아져요.";

        setRiskGate({{ state: j.state, reasons: j.reasons || [], message }});

        // 사용자가 아직 확인(체크) 안 했으면, 저장을 잠시 멈춘다
        if (!riskGateAck) {{
          return;
        }}
      }} else {{
        setRiskGate(null);
      }}
    }} catch (e) {{
      // risk check 실패해도 입력은 막지 않는다
      setRiskGate(null);
    }}
"""

# 주입: 함수 첫 중괄호 직후에 넣기
s = s[:start] + "\n" + risk_check + s[start:]

# 3) 실제 저장 성공 후 risk_events에 기록 (STOP/SLOWDOWN일 때만)
# 저장 성공 지점을 찾기 어렵기 때문에, "setSaving(false);" 직전에 넣는 방식으로 처리
# (이미 성공 플로우 끝나기 직전이라 안전)
marker2 = "setSaving(false);"
if marker2 not in s:
    print("skip: cannot find setSaving(false)")
    raise SystemExit(0)

log_block = """
    // Risk Gate: event log
    if (riskGate?.state === "STOP" || riskGate?.state === "SLOWDOWN") {
      try {
        await fetch ("/api/risk-log", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            kind: "warning",
            state: riskGate.state,
            reasons: riskGate.reasons || [],
            message: riskGate.message,
            meta: { source: "manual-trades" }
          })
        });
      } catch (e) {}
    }
"""

# 가장 마지막 setSaving(false) 앞에 삽입(첫 occurrence만)
s = s.replace(marker2, log_block + "\n" + marker2, 1)

# 4) UI: 상단에 RiskGate 경고 배너 + 확인 체크박스 추가
# 페이지 최상단 return 안에서 <h1> 다음 줄에 넣기 (존재 여부 체크)
h1_pat = re.search(r"<h1[^>]*>.*?</h1>", s, flags=re.DOTALL)
if not h1_pat:
    print("skip: cannot find h1")
    raise SystemExit(0)

banner = """
      {riskGate ? (
        <div style={{ marginTop: 12, padding: 12, borderRadius: 12, border: "1px solid #eee", background: "#fff7ed" }}>
          <div style={{ fontWeight: 900, marginBottom: 6 }}>
            Risk: {riskGate.state} {riskGate.reasons?.length ? "· " + riskGate.reasons.join(", ") : ""}
          </div>
          <div style={{ opacity: 0.9 }}>{riskGate.message}</div>
          <label style={{ display: "flex", gap: 8, marginTop: 10, alignItems: "center" }}>
            <input type="checkbox" checked={riskGateAck} onChange={(e) => setRiskGateAck(e.target.checked)} />
            <span style={{ fontSize: 13, opacity: 0.85 }}>
              확인했습니다. 그래도 이번 기록은 남기겠습니다.
            </span>
          </label>
        </div>
      ) : null}
"""

# h1 태그 뒤에 배너 삽입
s = s[:h1_pat.end()] + "\n" + banner + s[h1_pat.end():]

p.write_text(s, encoding="utf-8")
print("patched:", p, "function:", fn_name)
