"use client";

import { useEffect, useMemo, useState } from "react";

type Goals = { y:any; m:any; w:any; d:any };
type Stats = { monthPnL:number; weekPnL:number; todayPnL:number };

function n(v:any){
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
}
function fmt(v:number){
  if (!Number.isFinite(v)) return "-";
  return v.toLocaleString(undefined, { maximumFractionDigits: 2 });
}
function pct(done:number, target:number){
  if (!Number.isFinite(done) || !Number.isFinite(target) || target === 0) return 0;
  const p = (done/target)*100;
  return Math.max(0, Math.min(200, p)); // 200%까지만 표시
}

export default function GoalsPage(){
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const [goals, setGoals] = useState<Goals>({ y:{}, m:{}, w:{}, d:{} });
  const [stats, setStats] = useState<Stats>({ monthPnL:0, weekPnL:0, todayPnL:0 });

  // 입력(목표값)
  const [dTarget, setDTarget] = useState<string>("");
  const [wTarget, setWTarget] = useState<string>("");
  const [mTarget, setMTarget] = useState<string>("");

  async function load(){
    setLoading(true);
    setErr("");
    try{
      const [a,b] = await Promise.all([
        fetch("/api/goals", { cache:"no-store" }).then(r=>r.json()),
        fetch("/api/dashboard", { cache:"no-store" }).then(r=>r.json()),
      ]);

      if (!a.ok) throw new Error(a.error || "goals api error");
      if (!b.ok) throw new Error(b.error || "dashboard api error");

      setGoals(a.goals);
      setStats({
        monthPnL: n(b.stats?.monthPnL),
        weekPnL: n(b.stats?.weekPnL),
        todayPnL: n(b.stats?.todayPnL),
      });

      const d = a.goals?.d?.target ?? "";
      const w = a.goals?.w?.target ?? "";
      const m = a.goals?.m?.target ?? "";
      setDTarget(d === "" ? "" : String(d));
      setWTarget(w === "" ? "" : String(w));
      setMTarget(m === "" ? "" : String(m));
    }catch(e:any){
      setErr(e?.message || "error");
    }finally{
      setLoading(false);
    }
  }

  async function save(){
    setErr("");
    try{
      const next = {
        ...goals,
        d: { ...(goals.d||{}), target: dTarget === "" ? null : Number(dTarget) },
        w: { ...(goals.w||{}), target: wTarget === "" ? null : Number(wTarget) },
        m: { ...(goals.m||{}), target: mTarget === "" ? null : Number(mTarget) },
      };

      const res = await fetch("/api/goals", {
        method: "POST",
        headers: { "content-type":"application/json" },
        body: JSON.stringify(next),
      });
      const j = await res.json();
      if (!j.ok) throw new Error(j.error || "save failed");
      await load();
      alert("저장 완료");
    }catch(e:any){
      setErr(e?.message || "error");
    }
  }

  useEffect(()=>{ load(); }, []);

  const dT = dTarget === "" ? 0 : Number(dTarget);
  const wT = wTarget === "" ? 0 : Number(wTarget);
  const mT = mTarget === "" ? 0 : Number(mTarget);

  const dP = useMemo(()=>pct(stats.todayPnL, dT), [stats.todayPnL, dT]);
  const wP = useMemo(()=>pct(stats.weekPnL, wT), [stats.weekPnL, wT]);
  const mP = useMemo(()=>pct(stats.monthPnL, mT), [stats.monthPnL, mT]);

  if (loading) return <div style={{ padding: 20 }}>Loading...</div>;
  if (err) return <div style={{ padding: 20 }}>Error: {err}</div>;

  return (
    <div style={{ padding: 20, maxWidth: 980 }}>
      <h1 style={{ fontSize: 24, fontWeight: 900, marginBottom: 10 }}>Goals</h1>

      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:16 }}>
        <GoalCard
          title="Daily"
          done={stats.todayPnL}
          target={dT}
          progress={dP}
          input={dTarget}
          setInput={setDTarget}
        />
        <GoalCard
          title="Weekly"
          done={stats.weekPnL}
          target={wT}
          progress={wP}
          input={wTarget}
          setInput={setWTarget}
        />
        <GoalCard
          title="Monthly"
          done={stats.monthPnL}
          target={mT}
          progress={mP}
          input={mTarget}
          setInput={setMTarget}
        />
      </div>

      <div style={{ marginTop: 16, display:"flex", gap:10 }}>
        <button onClick={save} style={S.primary}>저장</button>
        <button onClick={load} style={S.secondary}>새로고침</button>
      </div>

      <div style={{ marginTop: 10, opacity: 0.7, fontSize: 12 }}>
        * 진행률은 수동 거래(manual_trades) 기반 PnL로 계산됨
      </div>
    </div>
  );
}

function GoalCard({
  title, done, target, progress, input, setInput
}:{ title:string; done:number; target:number; progress:number; input:string; setInput:(v:string)=>void }){
  return (
    <div style={S.card}>
      <div style={{ fontSize: 13, opacity: 0.7 }}>{title}</div>
      <div style={{ fontSize: 22, fontWeight: 900, marginTop: 6 }}>{fmt(done)}</div>
      <div style={{ marginTop: 6, fontSize: 12, opacity: 0.7 }}>
        Target: {target ? fmt(target) : "-"}
      </div>

      <div style={S.barWrap}>
        <div style={{ ...S.barFill, width: `${progress}%` }} />
      </div>
      <div style={{ fontSize: 12, opacity: 0.7, marginTop: 6 }}>
        Progress: {progress.toFixed(1)}%
      </div>

      <div style={{ marginTop: 10, display:"grid", gap:6 }}>
        <div style={{ fontSize: 12, opacity: 0.7 }}>Set Target</div>
        <input
          value={input}
          onChange={(e)=>setInput(e.target.value)}
          placeholder="예: 500"
          style={S.input}
        />
      </div>
    </div>
  );
}

const S:any = {
  card: { padding:16, borderRadius:12, border:"1px solid rgba(0,0,0,.08)", background:"white" },
  input: { padding:"10px 12px", borderRadius:10, border:"1px solid rgba(0,0,0,.10)", outline:"none" },
  barWrap: { height:10, borderRadius:999, background:"rgba(0,0,0,.06)", overflow:"hidden", marginTop:10 },
  barFill: { height:"100%", background:"rgba(0,0,0,.55)" },
  primary: { padding:"10px 14px", borderRadius:10, border:"1px solid rgba(0,0,0,.10)", background:"#111", color:"white", fontWeight:900, cursor:"pointer" },
  secondary: { padding:"10px 14px", borderRadius:10, border:"1px solid rgba(0,0,0,.10)", background:"white", fontWeight:900, cursor:"pointer" },
};
