"use client";
import { useEffect, useMemo, useState } from "react";

const n = (v:any)=> (Number.isFinite(Number(v)) ? Number(v) : 0);
const clamp = (x:number, a:number, b:number)=> Math.max(a, Math.min(b, x));
const pct = (cur:number, tgt:number)=> tgt>0 ? clamp((cur/tgt)*100, 0, 200) : 0;

function Bar({cur,tgt}:{cur:number,tgt:number}){
  const p = pct(cur,tgt);
  return (
    <div style={{height:10, background:"rgba(0,0,0,0.08)", borderRadius:999, overflow:"hidden"}}>
      <div style={{width:`${p}%`, height:"100%", background:"rgba(0,0,0,0.55)"}} />
    </div>
  );
}

export default function GoalsPage(){
  const [goals,setGoals] = useState<any[]>([]);
  const [history,setHistory] = useState<any[]>([]);
  const [busy,setBusy] = useState(false);
  const [err,setErr] = useState("");

  // create form
  const [title,setTitle] = useState("");
  const [type,setType] = useState<"pnl"|"withdrawal"|"counter"|"boolean">("pnl");
  const [target,setTarget] = useState("");

  async function load(){
    setErr("");
    const r = await fetch("/api/goals-v2?includeCompleted=1", { cache:"no-store" });
    const j = await r.json().catch(()=>null);
    if(!j?.ok){ setErr(j?.error || "불러오기 실패"); return; }
    // 여기서는 goals에 completed도 같이 받아오되, 화면에서 분리해서 보여줌
    setGoals(j.goals || []);
    setHistory(j.history || []);
  }

  async function create(){
    setErr("");
    setBusy(true);
    try{
      const payload:any = {
        title: title.trim(),
        type,
        period:"monthly",
      };
      if(type !== "boolean"){
        payload.target_value = n(target);
        if(!payload.target_value) { setErr("목표 수치(숫자)를 입력해줘"); return; }
      }
      const r = await fetch("/api/goals-v2",{
        method:"POST",
        headers:{ "content-type":"application/json"},
        body: JSON.stringify(payload),
      });
      const j = await r.json().catch(()=>null);
      if(!j?.ok){ setErr(j?.error || "생성 실패"); return; }
      setTitle(""); setTarget("");
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function markDone(g:any){
    setErr("");
    setBusy(true);
    try{
      const r = await fetch("/api/goals-v2",{
        method:"PATCH",
        headers:{ "content-type":"application/json"},
        body: JSON.stringify({ id:g.id, current_value: (g.type==="boolean") ? 1 : g.target_value }),
      });
      const j = await r.json().catch(()=>null);
      if(!j?.ok){ setErr(j?.error || "처리 실패"); return; }
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function archiveGoal(g:any){
    if(!confirm("이 목표를 숨김(아카이브)할까요? (복구 가능)")) return;
    const r = await fetch(`/api/goals-v2?id=${encodeURIComponent(g.id)}`, { method:"DELETE" });
    const j = await r.json().catch(()=>null);
    if(!j?.ok){ setErr(j?.error || "숨김 실패"); return; }
    await load();
  }

  async function hardDelete(g:any){
    if(!confirm("⚠️ 완전 삭제할까요? (히스토리/누적 통계에서도 사라짐)")) return;
    const r = await fetch(`/api/goals-v2?id=${encodeURIComponent(g.id)}&hard=1`, { method:"DELETE" });
    const j = await r.json().catch(()=>null);
    if(!j?.ok){ setErr(j?.error || "삭제 실패"); return; }
    await load();
  }

  useEffect(()=>{ load(); },[]);

  const active = useMemo(()=> goals.filter(g=>g.status==="active"), [goals]);
  const completed = useMemo(()=> goals.filter(g=>g.status==="completed"), [goals]);

  // 누적 통계(히스토리 기반)
  const totalAchievedAmount = useMemo(()=>(
    (history||[]).filter((h:any)=> String(h.unit)==="usd").reduce((a:number,b:any)=> a + n(b.target_value), 0)
  ), [history]);

  const totalWithdrawal = useMemo(()=>(
    (history||[]).filter((h:any)=> String(h.type)==="withdrawal").reduce((a:number,b:any)=> a + n(b.target_value), 0)
  ), [history]);

  const totalCountGoals = useMemo(()=>(
    (history||[]).filter((h:any)=> String(h.unit)!=="usd").length
  ), [history]);

  const typeLabel = (t:string)=>{
    if(t==="pnl") return "수익(PnL)";
    if(t==="withdrawal") return "출금";
    if(t==="counter") return "횟수/체크";
    if(t==="boolean") return "1회성(체크)";
    return t;
  };

  return (
    <div style={{padding:20, maxWidth:1100}}>
      <h1 style={{marginTop:0}}>Goals</h1>

      {err ? <div style={{border:"1px solid #eee", padding:10, marginBottom:12}}>{err}</div> : null}

      <div style={{border:"1px solid #eee", padding:12, marginBottom:12}}>
        <div style={{fontWeight:900, marginBottom:8}}>성과(누적)</div>
        <div>누적 목표 달성 금액: <b>{totalAchievedAmount.toLocaleString()}</b></div>
        <div>누적 출금 달성 금액: <b>{totalWithdrawal.toLocaleString()}</b></div>
        <div>누적 목표 달성 횟수(비-금액): <b>{totalCountGoals}</b></div>
        <div>총 완료 횟수: <b>{(history||[]).length}</b></div>
      </div>

      <div style={{border:"1px solid #eee", padding:12, marginBottom:18}}>
        <div style={{fontWeight:900, marginBottom:8}}>새 목표 만들기</div>
        <div style={{display:"grid", gridTemplateColumns:"1.2fr 1fr 1fr auto", gap:8, alignItems:"center"}}>
          <input placeholder="목표 제목" value={title} onChange={e=>setTitle(e.target.value)} />
          <input placeholder={type==="boolean" ? "목표 수치 없음" : "목표 수치(숫자)"} value={target} onChange={e=>setTarget(e.target.value)} disabled={type==="boolean"} />
          <select value={type} onChange={e=>setType(e.target.value as any)}>
            <option value="pnl">수익(PnL)</option>
            <option value="withdrawal">출금</option>
            <option value="counter">횟수/체크</option>
            <option value="boolean">1회성(체크)</option>
          </select>
          <button onClick={create} disabled={busy} style={{padding:"8px 12px", fontWeight:900}}>
            {busy ? "처리중..." : "생성"}
          </button>
        </div>
      </div>

      <h2 style={{marginTop:0}}>진행중 목표</h2>
      {active.length===0 ? <div style={{opacity:.7}}>없음</div> : null}
      {active.map((g:any)=>{
        const cur = n(g.current_value);
        const tgt = n(g.target_value);
        return (
          <div key={g.id} style={{border:"1px solid #eee", padding:12, marginBottom:10}}>
            <div style={{display:"flex", justifyContent:"space-between", gap:10}}>
              <div style={{fontWeight:900}}>{g.title || "(untitled)"}</div>
              <div style={{opacity:.7}}>{typeLabel(String(g.type))} 목표</div>
            </div>

            {g.type==="boolean" ? (
              <div style={{marginTop:10}}>
                <Bar cur={cur} tgt={1} />
                <div style={{marginTop:6, opacity:.8}}>미완료</div>
              </div>
            ) : (
              <div style={{marginTop:10}}>
                <div style={{display:"flex", justifyContent:"space-between", gap:10, opacity:.8}}>
                  <div>{cur.toLocaleString()} / {tgt.toLocaleString()}</div>
                  <div>달성률 {pct(cur,tgt).toFixed(1)}%</div>
                </div>
                <Bar cur={cur} tgt={tgt} />
              </div>
            )}

            <div style={{marginTop:10, display:"flex", gap:8, flexWrap:"wrap"}}>
              {g.type==="boolean" ? (
                <button onClick={()=>markDone(g)} disabled={busy} style={{padding:"6px 10px"}}>달성 처리</button>
              ) : null}
              <button onClick={()=>archiveGoal(g)} disabled={busy} style={{padding:"6px 10px"}}>숨김</button>
              <button onClick={()=>hardDelete(g)} disabled={busy} style={{padding:"6px 10px"}}>완전삭제</button>
            </div>
          </div>
        );
      })}

      <h2 style={{marginTop:18}}>완료된 목표 (대시보드에는 안 보이게)</h2>
      {completed.length===0 ? <div style={{opacity:.7}}>없음</div> : null}
      {completed.map((g:any)=>(
        <div key={g.id} style={{border:"1px solid #eee", padding:12, marginBottom:10, opacity:.75}}>
          <div style={{display:"flex", justifyContent:"space-between", gap:10}}>
            <div style={{fontWeight:900}}>{g.title || "(untitled)"}</div>
            <div style={{opacity:.7}}>{typeLabel(String(g.type))}</div>
          </div>
          <div style={{marginTop:8}}>
            {g.type==="boolean" ? "완료" : `${n(g.target_value).toLocaleString()} 달성`}
          </div>
          <div style={{marginTop:10, display:"flex", gap:8, flexWrap:"wrap"}}>
            <button onClick={()=>archiveGoal(g)} style={{padding:"6px 10px"}}>숨김</button>
            <button onClick={()=>hardDelete(g)} style={{padding:"6px 10px"}}>완전삭제</button>
          </div>
        </div>
      ))}
    </div>
  );
}
