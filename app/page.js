"use client";

import { useState } from "react";

export default function Home() {
  const [loading, setLoading] = useState(false);

  return (
    <main style={{ padding: 40 }}>
      <h1>Man Cave</h1>

      <button
        onClick={() => {
          setLoading(true);
          // fetch 하지 말고 "이동" 해야 한다 (OAuth는 브라우저 네비게이션 플로우)
          window.location.href = "/auth/signin";
        }}
        disabled={loading}
        style={{
          padding: "10px 14px",
          border: "1px solid #ccc",
          borderRadius: 8,
          cursor: "pointer",
          opacity: loading ? 0.7 : 1,
        }}
      >
        {loading ? "로딩..." : "Google 로그인"}
      </button>
    </main>
  );
}
