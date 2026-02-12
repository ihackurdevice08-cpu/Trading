"use client";

import { useEffect, useMemo, useState } from "react";

function fmt(n:any){
  const v = Number(n);
  if(!Number.isFinite(v)) return "-";
  return v.toLocaleString(undefined,{maximumFractionDigits:2});
}
function pct(cur:number,tar:number){
  if(!tar) return 0;
  return Math.min(200,(cur/tar)*100);
}

export default function DashboardPage(){
  const [stats,setStats]=useState<any>(null);
  const [goals,setGoals]=useState<any[]>([]);
  const [err,setErr]=useState("");

  async function load(){
    try{
      const [a,b]=await Promise.all([
        fetch("/api/dashboard",{cache:"no-store"}).then(r=>r.json()),
        fetch("/api/goals-v2",{cache:"no-store"}).then(r=>r.json())
      ]);
      if(a.ok) setStats(a.stats);
      if(b.ok) setGoals(b.goals||[]);
    }catch(e:any){
      setErr(e?.message||"error");
    }
  }

  useEffect(()=>{
    load();

    // 15초 자동 갱신
    const id = setInterval(load,15000);

    // trades 업데이트 이벤트 감지
    function handler(){ load(); }
    window.addEventListener("trades-updated",handler);

    return ()=>{
      clearInterval(id);
      window.removeEventListener("trades-updated",handler);
    };
  },[]);

  if(err) return <div style={{padding:20}}>Error: {err}</div>;
  if(!stats) return <div style={{padding:20}}>Loading...</div>;

  return (
    <div style={{padding:20,maxWidth:1100}}>
      <h1>Dashboard</h1>

      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:16}}>
        <Card title="Today" value={fmt(stats.todayPnL)} />
        <Card title="Week" value={fmt(stats.weekPnL)} />
        <Card title="Month" value={fmt(stats.monthPnL)} />
      </div>

      <div style={{marginTop:30}}>
        <h2>Active Goals</h2>
        {goals.map(g=>{
          const progress = pct(Number(g.current_value||0),Number(g.target_value||1));
          return (
            <div key={g.id} style={{marginBottom:12,border:"1px solid #ddd",padding:12}}>
              <div><b>{g.title}</b></div>
              <div>{fmt(g.current_value)} / {fmt(g.target_value)}</div>
              <div style={{background:"#eee",height:8}}>
                <div style={{width:progress+"%",height:"100%",background:"#333"}}/>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Card({title,value}:{title:string,value:string}){
  return (
    <div style={{border:"1px solid #ddd",padding:16}}>
      <div>{title}</div>
      <div style={{fontSize:20,fontWeight:700}}>{value}</div>
    </div>
  );
}
