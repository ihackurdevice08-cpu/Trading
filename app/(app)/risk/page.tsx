"use client";
import { useEffect, useState } from "react";

const fmt=(v:any)=> {
  const n = Number(v);
  if(!Number.isFinite(n)) return "-";
  return n.toLocaleString(undefined,{maximumFractionDigits:2});
};

export default function RiskPage(){
  const [risk,setRisk]=useState<any>(null);
  const [settings,setSettings]=useState<any>(null);
  const [msg,setMsg]=useState("");

  async function load(){
    setMsg("");
    const [r1,r2] = await Promise.all([
      fetch("/api/risk",{cache:"no-store"}).then(r=>r.json()),
      fetch("/api/risk-settings",{cache:"no-store"}).then(r=>r.json())
    ]);
    if(r1.ok) setRisk(r1); else setMsg(r1.error||"risk load failed");
    if(r2.ok) setSettings(r2.settings);
  }

  async function save(){
    setMsg("");
    const r = await fetch("/api/risk-settings",{
      method:"POST",
      headers:{ "content-type":"application/json"},
      body: JSON.stringify(settings)
    });
    const j = await r.json();
    if(!j.ok){ setMsg(j.error||"save failed"); return; }
    setMsg("✅ 저장 완료");
    load();
  }

  useEffect(()=>{ load(); },[]);
  if(!risk || !settings) return <div style={{padding:20}}>Loading...</div>;
  const s = risk.stats || {};

  return (
    <div style={{padding:20, maxWidth:1100}}>
      <h1 style={{margin:0}}>Risk Monitor</h1>
      {msg ? <div style={{margin:"10px 0",padding:10,border:"1px solid #eee"}}>{msg}</div> : null}

      <div style={{marginTop:12, border:"1px solid #eee", padding:12}}>
        <div style={{fontWeight:900}}>현재 상태</div>
        <div>State: <b>{risk.state}</b></div>
        <div>Reasons: {risk.reasons?.length ? risk.reasons.join(", ") : "-"}</div>
      </div>

      <div style={{marginTop:12, display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:12}}>
        <Card title="Seed" value={`${fmt(s.seed)} USDT`} />
        <Card title="Equity Now" value={`${fmt(s.equityNow)} USDT`} />
        <Card title="Cumulative PnL" value={`${fmt(s.cumPnl)} USDT / ${fmt(s.pnlPct)}%`} />
        <Card title="Peak Equity" value={`${fmt(s.peakEquity)} USDT`} />
        <Card title="Max Drawdown" value={`${fmt(s.maxDdUsd)} USDT / ${fmt(s.ddPct)}%`} />
        <Card title="Today PnL" value={`${fmt(s.todayPnl)} USDT`} />
        <Card title="Trades Today" value={`${fmt(s.tradesToday)}`} />
        <Card title="Trades This Hour" value={`${fmt(s.tradesThisHour)}`} />
        <Card title="Max Consec Losses" value={`${fmt(s.maxConsecLoss)}`} />
      </div>

      <div style={{marginTop:18, border:"1px solid #eee", padding:12}}>
        <div style={{fontWeight:900, marginBottom:10}}>Risk Rules (설정)</div>
        <Row label="Seed (USDT)"><input value={settings.seed_usd} onChange={e=>setSettings({...settings, seed_usd: e.target.value})}/></Row>
        <Row label="Max DD (USDT)"><input value={settings.max_dd_usd} onChange={e=>setSettings({...settings, max_dd_usd: e.target.value})}/></Row>
        <Row label="Max DD (%)"><input value={settings.max_dd_pct} onChange={e=>setSettings({...settings, max_dd_pct: e.target.value})}/></Row>
        <Row label="Max Daily Loss (USDT)"><input value={settings.max_daily_loss_usd} onChange={e=>setSettings({...settings, max_daily_loss_usd: e.target.value})}/></Row>
        <Row label="Max Daily Loss (%)"><input value={settings.max_daily_loss_pct} onChange={e=>setSettings({...settings, max_daily_loss_pct: e.target.value})}/></Row>
        <Row label="Max Consecutive Losses"><input value={settings.max_consecutive_losses} onChange={e=>setSettings({...settings, max_consecutive_losses: e.target.value})}/></Row>
        <Row label="Max Trades / Day"><input value={settings.max_trades_per_day} onChange={e=>setSettings({...settings, max_trades_per_day: e.target.value})}/></Row>
        <Row label="Max Trades / Hour"><input value={settings.max_trades_per_hour} onChange={e=>setSettings({...settings, max_trades_per_hour: e.target.value})}/></Row>

        <button onClick={save} style={{marginTop:10, padding:"8px 12px", fontWeight:900}}>Save</button>
      </div>
    </div>
  );
}

function Card({title,value}:{title:string,value:string}){
  return (
    <div style={{border:"1px solid #eee", padding:12}}>
      <div style={{opacity:.7, fontSize:12}}>{title}</div>
      <div style={{fontWeight:900}}>{value}</div>
    </div>
  );
}
function Row({label, children}:{label:string, children:any}){
  return (
    <div style={{display:"grid", gridTemplateColumns:"220px 1fr", gap:10, alignItems:"center", marginBottom:8}}>
      <div style={{opacity:.8}}>{label}</div>
      <div>{children}</div>
    </div>
  );
}
