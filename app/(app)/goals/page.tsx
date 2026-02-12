"use client";
import { useEffect, useMemo, useState } from "react";

function num(v:any){
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}
function pct(cur:number, tar:number){
  if(!tar) return 0;
  return Math.max(0, Math.min(200, (cur / tar) * 100));
}

const TYPE_LABEL: Record<string,string> = {
  pnl: "수익(PnL) 목표",
  withdrawal: "출금 목표",
  counter: "횟수/카운트 목표",
  boolean: "체크(전략/심리) 목표",
};

export default function GoalsPage(){
  const [goals,setGoals]=useState<any[]>([]);
  const [history,setHistory]=useState<any[]>([]);
  const [title,setTitle]=useState("");
  const [target,setTarget]=useState("");
  const [type,setType]=useState<"pnl"|"withdrawal"|"counter"|"boolean">("pnl");
  const [busy,setBusy]=useState(false);
  const [msg,setMsg]=useState<string>("");

  async function load(){
    setMsg("");
    const r = await fetch("/api/goals-v2",{cache:"no-store"});
    const j = await r.json().catch(()=>({ok:false,error:"JSON parse failed"}));
    if(!j.ok){
      setMsg("불러오기 실패: " + (j.error || "unknown"));
      return;
    }
    setGoals(j.goals||[]);
    setHistory(j.history||[]);
  }

  async function create(){
    if(busy) return;
    setBusy(true);
    setMsg("");

    const trimmed = (title || "").trim();
    const isBool = type === "boolean";
    const t = isBool ? 1 : num(target);

    const payload = {
      title: trimmed || "(제목없음)",
      type,
      mode: (type==="pnl") ? "auto" : "manual",
      period: (type==="pnl") ? "monthly" : "none",
      target_value: t,                 // ✅ boolean도 1로 고정
      current_value: 0,
      unit: (type==="pnl" || type==="withdrawal") ? "usd" : "count",
    };

    try{
      const r = await fetch("/api/goals-v2",{
        method:"POST",
        headers:{ "content-type":"application/json"},
        body: JSON.stringify(payload)
      });
      const j = await r.json().catch(()=>({ok:false,error:"JSON parse failed"}));
      if(!j.ok){
        setMsg("생성 실패: " + (j.error || "unknown"));
        return;
      }
      setTitle("");
      setTarget("");
      await load();
      setMsg("✅ 목표가 생성되었습니다.");
    }catch(e:any){
      setMsg("생성 실패(네트워크): " + (e?.message || "unknown"));
    }finally{
      setBusy(false);
    }
  }

  async function completeBoolean(g:any){
    setBusy(true);
    setMsg("");
    try{
      const r = await fetch("/api/goals-v2",{
        method:"PATCH",
        headers:{ "content-type":"application/json"},
        body: JSON.stringify({ id: g.id, current_value: 1, target_value: 1 })
      });
      const j = await r.json().catch(()=>({ok:false,error:"JSON parse failed"}));
      if(!j.ok){
        setMsg("완료 처리 실패: " + (j.error || "unknown"));
        return;
      }
      await load();
      setMsg("✅ 완료 처리되었습니다.");
    }finally{
      setBusy(false);
    }
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

  const totalAchievedCount = useMemo(()=>completed.length,[completed]);

  const nonMoneyCount = useMemo(()=>{
    return completed.filter((h:any)=>!(h.type==="pnl" || h.type==="withdrawal")).length;
  },[completed]);

  return (
    <div style={{padding:20,maxWidth:1100}}>
      <h1 style={{margin:"0 0 10px 0"}}>Goals</h1>

      {msg ? (
        <div style={{margin:"10px 0", padding:10, border:"1px solid #eee", background:"#fafafa"}}>
          {msg}
        </div>
      ) : null}

      <div style={{border:"1px solid #eee", padding:12}}>
        <div style={{fontWeight:900, marginBottom:8}}>성과(누적)</div>
        <div>누적 출금 달성 금액: {totalWithdrawal.toLocaleString()}</div>
        <div>누적 금액 목표 달성 금액(PnL+출금): {totalAchievedAmount.toLocaleString()}</div>
        <div>누적 목표 달성 횟수(전체): {totalAchievedCount}</div>
        <div>누적 목표 달성 횟수(비-금액/체크형): {nonMoneyCount}</div>
      </div>

      <div style={{marginTop:12, border:"1px solid #eee", padding:12}}>
        <div style={{fontWeight:900, marginBottom:8}}>새 목표 만들기</div>
        <div style={{display:"flex", gap:8, flexWrap:"wrap", alignItems:"center"}}>
          <input
            placeholder="목표 제목"
            value={title}
            onChange={e=>setTitle(e.target.value)}
            style={{padding:"8px 10px"}}
          />
          <input
            placeholder={type==="boolean" ? "체크형은 숫자 불필요" : "목표 수치"}
            value={target}
            onChange={e=>setTarget(e.target.value)}
            disabled={type==="boolean"}
            style={{padding:"8px 10px"}}
          />
          <select value={type} onChange={e=>setType(e.target.value as any)} style={{padding:"8px 10px"}}>
            <option value="pnl">수익(PnL)</option>
            <option value="withdrawal">출금</option>
            <option value="counter">카운트</option>
            <option value="boolean">체크(전략/심리)</option>
          </select>
          <button onClick={create} disabled={busy} style={{padding:"8px 12px", fontWeight:900}}>
            {busy ? "처리중..." : "생성"}
          </button>
        </div>
      </div>

      <h2 style={{marginTop:18}}>진행중 목표</h2>
      {active.length===0 ? <div style={{opacity:.7}}>없음</div> : null}

      {active.map(g=>{
        const tv = num(g.target_value || 0) || 1;
        const cv = num(g.current_value || 0);
        const p = pct(cv, tv);
        return (
          <div key={g.id} style={{border:"1px solid #ddd",padding:12,marginBottom:12}}>
            <div style={{display:"flex", justifyContent:"space-between", gap:10}}>
              <div style={{fontWeight:900}}>{g.title}</div>
              <div style={{opacity:.7, fontSize:12}}>{TYPE_LABEL[g.type] || g.type}</div>
            </div>

            <div style={{marginTop:6}}>
              {g.type==="boolean" ? "체크형 목표" : `${cv} / ${tv}`}{" "}
              <span style={{opacity:.7}}>(달성률 {p.toFixed(1)}%)</span>
            </div>

            <div style={{background:"#eee",height:10, marginTop:8, borderRadius:6, overflow:"hidden"}}>
              <div style={{width:p+"%",height:"100%",background:"#333"}}/>
            </div>

            {g.type==="boolean" ? (
              <button onClick={()=>completeBoolean(g)} disabled={busy} style={{marginTop:10}}>
                완료 처리
              </button>
            ) : null}
          </div>
        );
      })}

      <h2 style={{marginTop:18}}>완료된 목표</h2>
      {completed.length===0 ? <div style={{opacity:.7}}>없음</div> : null}

      {completed.map((g:any)=>(
        <div key={g.id} style={{border:"1px solid #eee",padding:10,marginBottom:8,opacity:0.85}}>
          <div style={{fontWeight:800}}>
            {g.title} <span style={{opacity:.7}}>({TYPE_LABEL[g.type] || g.type})</span>
          </div>
          <div style={{fontSize:12, opacity:0.75}}>
            달성값: {g.target_value ?? "-"} {g.unit ?? ""} · {g.completed_at}
          </div>
        </div>
      ))}
    </div>
  );
}
