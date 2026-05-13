import { useState } from "react"

export function HelpTip({ children }) {
  return (
    <div style={{
      background: "rgba(124,58,237,0.08)",
      border: "1px solid rgba(124,58,237,0.2)",
      borderRadius: 12,
      padding: "10px 14px",
      fontSize: 13,
      color: "#a78bfa",
      lineHeight: 1.6,
      marginBottom: 16
    }}>
      💡 {children}
    </div>
  )
}

export function PageHeader({ title, desc }) {
  const [show, setShow] = useState(false)
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>{title}</h1>
        <button
          onClick={() => setShow(v => !v)}
          style={{
            background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 20,
            padding: "4px 12px",
            color: "#888",
            fontSize: 12,
            cursor: "pointer"
          }}
        >
          {show ? "ซ่อน" : "❓ วิธีใช้"}
        </button>
      </div>
      {show && (
        <div style={{
          marginTop: 12,
          background: "rgba(124,58,237,0.08)",
          border: "1px solid rgba(124,58,237,0.2)",
          borderRadius: 12,
          padding: "14px 16px",
          fontSize: 13,
          color: "#c4b5fd",
          lineHeight: 1.8
        }}>
          {desc}
        </div>
      )}
    </div>
  )
}