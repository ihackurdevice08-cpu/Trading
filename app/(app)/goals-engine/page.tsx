"use client";

import { useEffect, useState } from "react";

function pct(c:number,t:number){
  if(!t) return 0;
  return Math.min(200,(c/t)*100);
}

export default function GoalsEngine(){
  const [goals,setGoals]=useState<any[]>([]);
  const [title,setTitle]=useState("");
  const [target,setTarget]=useState("");
  const [type,setType]=useState("pnl");
  const [period,setPeriod]=useState("monthly");

  async function load(){
    const r = await fetch("/api/goals-v2");
    const j = await r.json();
    if(j.ok) setGoals(j.goals);
  }

  async function create(){
    await fetch("/api/goals-v2",{
      method:"POST",
      headers:{ "content-type":"application/json"},
      body:JSON.stringify({
        title,
        type,
        mode:type==="pnl"?"auto":"manual",
        period,
        target_value:Number(target),
        unit:type==="pnl"?"usd":"count"
      })
    });
    setTitle(""); setTarget("");
    load();
  }

  useEffect(()=>{ load(); },[]);

  return (
    <div style={{ padding:20, maxWidth:1000 }}>
      <h1>Goal Engine</h1>

      <div style={{ marginBottom:20 }}>
        <input placeholder="Goal title" value={title} onChange={e=>setTitle(e.target.value)} />
        <input placeholder="Target" value={target} onChange={e=>setTarget(e.target.value)} />
        <select value={type} onChange={e=>setType(e.target.value)}>
          <option value="pnl">PnL</option>
          <option value="counter">Counter</option>
          <option value="withdrawal">Withdrawal</option>
          <option value="boolean">Boolean</option>
        </select>
        <select value={period} onChange={e=>setPeriod(e.target.value)}>
          <option value="daily">Daily</option>
          <option value="weekly">Weekly</option>
          <option value="monthly">Monthly</option>
          <option value="none">None</option>
        </select>
        <button onClick={create}>Create</button>
      </div>

      {goals.map(g=>{
        const progress = pct(g.current_value, g.target_value||1);
        return (
          <div key={g.id} style={{ border:"1px solid #ddd", padding:12, marginBottom:12 }}>
            <div><b>{g.title}</b> ({g.type})</div>
            <div>{g.current_value} / {g.target_value}</div>
            <div style={{ background:"#eee", height:10 }}>
              <div style={{ width:progress+"%", height:"100%", background:"#333" }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
