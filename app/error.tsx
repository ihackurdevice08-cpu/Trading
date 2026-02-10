"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html>
      <body style={{ margin: 0, fontFamily: "ui-sans-serif, system-ui", background: "#0b0c10", color: "#e9ecf1" }}>
        <div style={{ maxWidth: 860, margin: "40px auto", padding: 20 }}>
          <div style={{ fontWeight: 900, fontSize: 22, marginBottom: 10 }}>Application Error</div>
          <div style={{ opacity: 0.8, marginBottom: 16 }}>
            아래 메시지가 원인입니다. 그대로 복사해서 보내면 즉시 수정합니다.
          </div>

          <pre
            style={{
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: 12,
              padding: 14,
              lineHeight: 1.55,
            }}
          >
            {String(error?.message || error)}
          </pre>

          {error?.digest ? (
            <div style={{ opacity: 0.75, marginTop: 10, fontSize: 12 }}>digest: {error.digest}</div>
          ) : null}

          <button
            onClick={() => reset()}
            style={{
              marginTop: 18,
              padding: "10px 12px",
              borderRadius: 12,
              border: "1px solid rgba(255,255,255,0.16)",
              background: "rgba(210,194,165,0.12)",
              color: "#e9ecf1",
              fontWeight: 900,
              cursor: "pointer",
            }}
          >
            Retry
          </button>
        </div>
      </body>
    </html>
  );
}
