from pathlib import Path

p = Path("app/(app)/dashboard/page.tsx")
s = p.read_text(encoding="utf-8")

if "Row 5 — Goals" in s:
    print("already patched:", p)
    exit(0)

# 1) useEffect import 추가
if "useEffect" not in s:
    s = s.replace('import { useMemo, useState } from "react";', 'import { useEffect, useMemo, useState } from "react";')

# 2) 컴포넌트 내부에 goals state + fetch 추가
marker = "export default function DashboardPage() {"
idx = s.find(marker)
if idx == -1:
    print("skip: cannot find DashboardPage")
    exit(0)

# DashboardPage 시작 직후에 삽입
insert_state = """
  const [goals, setGoals] = useState<any[]>([]);
  useEffect(() => {
    let alive = true;
    fetch("/api/goals-v2", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => {
        if (!alive) return;
        if (j?.ok) setGoals(j.goals || []);
      })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  const goalPct = (cur:number, tgt:number)=> (tgt>0 ? Math.max(0, Math.min(200, (cur/tgt)*100)) : 0);
  const goalBar = (cur:number, tgt:number)=> (
    <div style={{height:10, background:"rgba(0,0,0,0.08)", borderRadius:999, overflow:"hidden"}}>
      <div style={{width:`${goalPct(cur,tgt)}%`, height:"100%", background:"rgba(0,0,0,0.55)"}} />
    </div>
  );
"""

# 삽입 위치: 첫 줄 "const { appearance }" 다음 라인에 넣기
s = s.replace(
    "  const { appearance } = useAppearance();",
    "  const { appearance } = useAppearance();\n" + insert_state
)

# 3) Row 4 아래에 Row 5 삽입
row4_marker = "      {/* Row 4 */}"
if row4_marker not in s:
    print("skip: cannot find Row4 marker")
    exit(0)

# Row4 블록 끝난 다음(전부 OFF 안내문 앞)에 삽입하기 위해 안내문 마커로 split
hint = "      {!appearance.showRow1Status && !appearance.showRow2AssetPerf && !appearance.showRow3Behavior && !appearance.showRow4Overtrade ? ("
if hint not in s:
    print("skip: cannot find dashboard all-off hint")
    exit(0)

row5 = """
      {/* Row 5 */}
      {(appearance as any).showRow5Goals ? (
        <Card title="Row 5 — Goals">
          {(!goals || goals.length===0) ? (
            <div style={{ color: "var(--text-muted)" }}>진행중 목표가 없습니다.</div>
          ) : (
            <div style={{ display:"grid", gap: 12 }}>
              {goals.slice(0,6).map((g:any)=> {
                const cur = Number(g.current_value||0);
                const tgt = Number(g.target_value||0);
                const isBool = String(g.type)==="boolean";
                return (
                  <div key={g.id} style={{ padding: 12, borderRadius: 12, border: "1px solid var(--line-soft)", background: "rgba(0,0,0,0.12)" }}>
                    <div style={{ display:"flex", justifyContent:"space-between", gap:10 }}>
                      <div style={{ fontWeight: 900 }}>{g.title || "(untitled)"}</div>
                      <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{String(g.type)}</div>
                    </div>
                    <div style={{ marginTop: 8 }}>
                      {isBool ? (
                        <div style={{ color:"var(--text-muted)" }}>1회성 목표 (Goals 탭에서 달성 처리)</div>
                      ) : (
                        <div style={{ display:"flex", justifyContent:"space-between", gap:10, color:"var(--text-muted)" }}>
                          <div>{cur.toLocaleString()} / {tgt.toLocaleString()}</div>
                          <div>{goalPct(cur,tgt).toFixed(1)}%</div>
                        </div>
                      )}
                      <div style={{ marginTop: 8 }}>
                        {isBool ? goalBar(0,1) : goalBar(cur,tgt)}
                      </div>
                    </div>
                  </div>
                );
              })}
              <a href="/goals" style={{ textDecoration:"none", fontWeight: 900, opacity: .9 }}>Goals로 이동 →</a>
            </div>
          )}
        </Card>
      ) : null}

"""

s = s.replace(hint, row5 + "\n" + hint)

p.write_text(s, encoding="utf-8")
print("patched:", p)
