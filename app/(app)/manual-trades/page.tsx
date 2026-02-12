"use client";

import { useEffect, useState } from "react";

export default function ManualTradesPage(){
  const [symbol,setSymbol]=useState("");
  const [pnl,setPnl]=useState("");
  const [rows,setRows]=useState<any[]>([]);

  async function load(){
    const r = await fetch("/api/manual-trades");
    const j = await r.json();
    if(j.ok) setRows(j.rows||[]);
  }

  async function add(){
    await fetch("/api/manual-trades",{
      method:"POST",
      headers:{ "content-type":"application/json" },
      body:JSON.stringify({ symbol, pnl:Number(pnl) })
    });
    setSymbol(""); setPnl("");
    await load();

    // 🔥 여기서 dashboard에 신호 보냄
    window.dispatchEvent(new Event("trades-updated"));
  }

  async function del(id:string){
    await fetch("/api/manual-trades?id="+id,{ method:"DELETE" });
    await load();
    window.dispatchEvent(new Event("trades-updated"));
  }

  useEffect(()=>{ load(); },[]);

  return (
    <div style={{padding:20,maxWidth:800}}>
      <h1>Manual Trades</h1>

      <div style={{marginBottom:20}}>
        <input placeholder="Symbol"
          value={symbol}
          onChange={e=>setSymbol(e.target.value)}
        />
        <input placeholder="PnL"
          value={pnl}
          onChange={e=>setPnl(e.target.value)}
        />
        <button onClick={add}>Add</button>
      </div>

      {rows.map(r=>(
        <div key={r.id}
          style={{border:"1px solid #ddd",padding:10,marginBottom:8}}>
          <div>{r.symbol} — {r.pnl}</div>
          <button onClick={()=>del(r.id)}>Delete</button>
        </div>
      ))}
    </div>
  );
}
