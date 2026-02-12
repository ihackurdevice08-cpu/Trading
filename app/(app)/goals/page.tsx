"use client";
import { useEffect, useMemo, useState } from "react";

function pct(c:number,t:number){
  if(!t) return 0;
  return Math.min(200,(c/t)*100);
}
function num(v:any){
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export default function GoalsPage(){
  const [goals,setGoals]=useState<any[]>([]);
  const [history,setHistory]=useState<any[]>([]);
  const [title,setTitle]=useState("");
  const [target,setTarget]=useState("");
  const [type,setType]=useState("pnl");

  async function load(){
    const r = await fetch("/api/goals-v2",{cache:"no-store"});
    const j = await r.json();
    if(j.ok){
      setGoals(j.goals||[]);
      setHistory(j.history||[]);
    }
  }

  async function create(){
    const t = num(target);
    const isBoolean = type === "boolean";
    await fetch("/api/goals-v2",{
      method:"POST",
      headers:{ "content-type":"application/json"},
      body:JSON.stringify({
        title: title || "(untitled)",
        type,
        mode: (type==="pnl") ? "auto" : "manual",
        period: (type==="pnl") ? "monthly" : "none",
        target_value: isBoolean ? null : t,
        current_value: 0,
        unit: (type==="pnl" || type==="withdrawal") ? "usd" : "count"
      })
    });
    setTitle(""); setTarget("");
    load();
  }

  async function completeBoolean(g:any){
    await fetch("/api/goals-v2",{
      method:"PATCH",
      headers:{ "content-type":"application/json"},
      body:JSON.stringify({ id:g.id, current_value: 1, target_value: 1, unit: g.unit })
    });
    load();
  }

  useEffect(()=>{ load(); },[]);

  const active = useMemo(()=>goals.filter(g=>g.status==="active"),[goals]);
  const completed = useMemo(()=>history,[history]);

  const totalWithdrawal = useMemo(()=>{
    return completed
      .filter((h:any)=>h.type==="withdrawal")
      .reduce((a:number,b:any)=>a+num(b.target_value),0);
  },[completed]);

  const totalAchievedAmount = useMemo(()=>{
    return completed
      .filter((h:any)=>h.type==="pnl" || h.type==="withdrawal")
      .reduce((a:number,b:any)=>a+num(b.target_value),0);
  },[completed]);

  const totalAchievedCount = useMemo(()=>{
    return completed.length;
  },[completed]);

  const nonMoneyCount = useMemo(()=>{
    return completed.filter((h:any)=>!(h.type==="pnl" || h.type==="withdrawal")).length;
  },[completed]);

  return (
    <div style={{padding:20,maxWidth:1100}}>
      <h1 style={{margin:0}}>Goals</h1>

      <div style={{marginTop:16, border:"1px solid #eee", padding:12}}>
        <div style={{fontWeight:800, marginBottom:8}}>Achievements</div>
        <div>누적 출금 달성 금액: {totalWithdrawal.toLocaleString()}</div>
        <div>누적 금액 목표 달성 금액(PnL+출금): {totalAchievedAmount.toLocaleString()}</div>
        <div>누적 목표 달성 횟수(전체): {totalAchievedCount}</div>
        <div>누적 목표 달성 횟수(비-금액/체크형): {nonMoneyCount}</div>
      </div>

      <div style={{marginTop:16, border:"1px solid #eee", padding:12}}>
        <div style={{fontWeight:800, marginBottom:8}}>Create Goal</div>
        <div style={{display:"flex", gap:8, flexWrap:"wrap"}}>
          <input placeholder="Goal title" value={title} onChange={e=>setTitle(e.target.value)} />
          <input placeholder="Target (숫자, boolean은 비워도 됨)" value={target} onChange={e=>setTarget(e.target.value)} />
          <select value={type} onChange={e=>setType(e.target.value)}>
            <option value="pnl">PnL</option>
            <option value="withdrawal">Withdrawal</option>
            <option value="counter">Counter</option>
            <option value="boolean">Boolean</option>
          </select>
          <button onClick={create}>Create</button>
        </div>
      </div>

      <h2 style={{marginTop:22}}>Active Goals</h2>
      {active.length===0 ? <div style={{opacity:.7}}>없음</div> : null}
      {active.map(g=>{
        const tv = g.target_value == null ? 1 : num(g.target_value);
        const cv = num(g.current_value);
        const progress = pct(cv, tv);
        return (
          <div key={g.id} style={{border:"1px solid #ddd",padding:12,marginBottom:12}}>
            <div style={{display:"flex", justifyContent:"space-between", gap:10}}>
              <div><b>{g.title}</b> ({g.type})</div>
              <div style={{opacity:.7, fontSize:12}}>{g.mode}{g.period ? ` · ${g.period}` : ""}</div>
            </div>
            <div style={{marginTop:6}}>{cv} / {g.target_value ?? "-"}</div>
            <div style={{background:"#eee",height:10, marginTop:8}}>
              <div style={{width:progress+"%",height:"100%",background:"#333"}}/>
            </div>
            {g.type==="boolean" ? (
              <button style={{marginTop:10}} onClick={()=>completeBoolean(g)}>Complete</button>
            ) : null}
          </div>
        );
      })}

      <h2 style={{marginTop:22}}>Completed Goals</h2>
      {completed.length===0 ? <div style={{opacity:.7}}>없음</div> : null}
      {completed.map((g:any)=>(
        <div key={g.id} style={{border:"1px solid #eee",padding:10,marginBottom:8,opacity:0.8}}>
          <div>{g.title} — {g.type} — {g.target_value ?? ""} {g.unit ?? ""}</div>
          <div style={{fontSize:12, opacity:0.7}}>{g.completed_at}</div>
        </div>
      ))}
    </div>
  );
}
