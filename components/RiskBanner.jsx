"use client";
import { useEffect, useState } from "react";

export default function RiskBanner(){
  const [data,setData]=useState(null);

  useEffect(()=>{
    let alive=true;
    fetch("/api/risk",{cache:"no-store"})
      .then(r=>r.json())
      .then(j=>{ if(alive) setData(j); })
      .catch(()=>{});
    return ()=>{ alive=false; };
  },[]);

  if(!data?.ok) return null;
  if(data.state==="NORMAL") return null;

  const msg =
    data.state==="STOP"
      ? "지금은 리스크가 꽤 쌓였어요. 사람이라면 흔들릴 수 있어요. 다만 지금부터는 ‘기록을 남기면서’ 속도를 확 줄이는 게 이득입니다."
      : "리스크 신호가 감지됐어요. 괜찮아요—한 템포만 늦추고, 기록을 남기면서 더 안전하게 가면 됩니다.";

  return (
    <div style={{border:"1px solid #eee", background:"#fff7ed", padding:12, borderRadius:12, marginBottom:12}}>
      <div style={{fontWeight:900, marginBottom:6}}>
        Risk: {data.state} {data.reasons?.length ? `· ${data.reasons.join(", ")}` : ""}
      </div>
      <div style={{opacity:.9}}>{msg}</div>
      <div style={{marginTop:8, fontSize:12, opacity:.75}}>
        (STOP이어도 입력/기록은 가능. 다만 속도는 줄이는 걸 추천)
      </div>
    </div>
  );
}
