import { useEffect, useState } from "react"
import { api } from "../api"

const googleIcon = (
  <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true" style={{ flexShrink: 0 }}>
    <path fill="#FFC107" d="M43.6 20H24v8h11.3C33.7 33.1 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20c11 0 19.7-8 19.7-20 0-1.3-.1-2.7-.1-4z" />
    <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.5 15.1 18.9 12 24 12c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
    <path fill="#4CAF50" d="M24 44c5.2 0 9.9-1.9 13.5-5.1l-6.2-5.2C29.3 35.3 26.8 36 24 36c-5.2 0-9.6-3-11.2-7.2l-6.5 5C9.6 39.6 16.3 44 24 44z" />
    <path fill="#1976D2" d="M43.6 20H24v8h11.3c-.8 2.3-2.3 4.2-4.2 5.7l6.2 5.2C41.1 35.5 44 30.2 44 24c0-1.3-.1-2.7-.4-4z" />
  </svg>
)

export default function LoginPage() {
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(true)
  const [googleStatus, setGoogleStatus] = useState(null)

  useEffect(() => {
    document.title = "Harbill | ระบบจัดการและหารบิล"

    const params = new URLSearchParams(window.location.search)
    if (params.get("error")?.startsWith("google")) {
      setError("เข้าสู่ระบบด้วย Google ไม่สำเร็จ กรุณาตรวจสอบการตั้งค่า OAuth")
    }

    api.googleStatus()
      .then(setGoogleStatus)
      .catch(() => {
        setGoogleStatus({ enabled: false })
        setError("ไม่สามารถเชื่อมต่อระบบเข้าสู่ระบบได้ในขณะนี้")
      })
      .finally(() => setLoading(false))
  }, [])

  function googleLogin() {
    if (loading) return
    if (!googleStatus?.enabled) {
      setError("Google Sign-In ยังไม่พร้อมใช้งาน กรุณาติดต่อผู้ดูแลระบบ")
      return
    }
    setError("")
    api.googleLogin()
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700&family=DM+Sans:ital,wght@0,300;0,400;0,500;1,300&display=swap');

        .hb-page {
          min-height: 100vh;
          background: linear-gradient(135deg, #0a0f1e 0%, #111827 60%, #0f1c2e 100%);
          display: flex;
          align-items: stretch;
          font-family: 'DM Sans', sans-serif;
          position: relative;
          overflow: hidden;
        }
        .hb-page::before {
          content: '';
          position: fixed;
          inset: 0;
          background:
            radial-gradient(ellipse 60% 60% at 20% 50%, rgba(29,158,117,0.07) 0%, transparent 70%),
            radial-gradient(ellipse 40% 40% at 80% 20%, rgba(83,74,183,0.09) 0%, transparent 70%);
          pointer-events: none;
        }

        /* ── LEFT ── */
        .hb-left {
          flex: 1.1;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          padding: 2.5rem 3rem 2.5rem 3.5rem;
          position: relative;
          z-index: 1;
        }
        .hb-logo-row {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .hb-logo-dot {
          width: 10px;
          height: 10px;
          border-radius: 50%;
          background: #1d9e75;
          box-shadow: 0 0 0 3px rgba(29,158,117,0.2);
        }
        .hb-logo-text {
          font-size: 15px;
          font-weight: 500;
          color: rgba(255,255,255,0.9);
          letter-spacing: 0.03em;
        }
        .hb-hero {
          margin-top: auto;
          padding-bottom: 2rem;
        }
        .hb-eyebrow {
          font-size: 11px;
          font-weight: 500;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: #1d9e75;
          margin-bottom: 1.1rem;
        }
        .hb-title {
          font-family: 'Playfair Display', serif;
          font-size: clamp(2.4rem, 4vw, 3.2rem);
          font-weight: 700;
          color: #fff;
          line-height: 1.12;
          margin: 0 0 1.1rem;
        }
        .hb-title-accent {
          color: #1d9e75;
        }
        .hb-desc {
          font-size: 14px;
          font-weight: 300;
          color: rgba(255,255,255,0.4);
          line-height: 1.85;
          max-width: 380px;
        }
        .hb-features {
          display: flex;
          gap: 1.5rem;
          margin-top: 2.5rem;
          flex-wrap: wrap;
        }
        .hb-feat {
          border-top: 0.5px solid rgba(255,255,255,0.1);
          padding-top: 0.85rem;
          min-width: 80px;
        }
        .hb-feat-label {
          font-size: 10px;
          font-weight: 500;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: rgba(255,255,255,0.25);
          margin-bottom: 4px;
        }
        .hb-feat-val {
          font-size: 13px;
          font-weight: 400;
          color: rgba(255,255,255,0.65);
        }

        /* ── RIGHT ── */
        .hb-right {
          width: 400px;
          background: rgba(255,255,255,0.04);
          backdrop-filter: blur(24px);
          -webkit-backdrop-filter: blur(24px);
          border-left: 0.5px solid rgba(255,255,255,0.08);
          display: flex;
          flex-direction: column;
          justify-content: center;
          padding: 3rem 2.5rem;
          position: relative;
          z-index: 1;
        }
        .hb-status-chip {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          background: rgba(29,158,117,0.1);
          border: 0.5px solid rgba(29,158,117,0.25);
          border-radius: 999px;
          padding: 4px 10px;
          font-size: 11px;
          color: rgba(29,158,117,0.9);
          margin-bottom: 2rem;
          width: fit-content;
        }
        .hb-pulse {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #1d9e75;
          animation: hbPulse 2s infinite;
          flex-shrink: 0;
        }
        @keyframes hbPulse {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.35; }
        }
        .hb-right-eyebrow {
          font-size: 11px;
          font-weight: 500;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: #1d9e75;
          margin-bottom: 0.5rem;
        }
        .hb-right-title {
          font-family: 'Playfair Display', serif;
          font-size: 1.75rem;
          font-weight: 700;
          color: #fff;
          margin: 0 0 0.5rem;
        }
        .hb-right-sub {
          font-size: 13px;
          color: rgba(255,255,255,0.38);
          line-height: 1.7;
          margin-bottom: 2rem;
        }

        /* Error */
        .hb-error {
          background: rgba(224,75,74,0.12);
          border: 0.5px solid rgba(224,75,74,0.3);
          border-radius: 8px;
          padding: 11px 14px;
          font-size: 13px;
          color: #f09595;
          margin-bottom: 1.25rem;
          line-height: 1.6;
        }

        /* Google button */
        .hb-google-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          width: 100%;
          height: 50px;
          border-radius: 10px;
          background: rgba(255,255,255,0.07);
          border: 0.5px solid rgba(255,255,255,0.14);
          color: rgba(255,255,255,0.85);
          font-family: 'DM Sans', sans-serif;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: background 0.2s, border-color 0.2s, transform 0.15s;
          position: relative;
          overflow: hidden;
        }
        .hb-google-btn::after {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(90deg,
            rgba(29,158,117,0) 0%,
            rgba(29,158,117,0.12) 50%,
            rgba(29,158,117,0) 100%);
          opacity: 0;
          transition: opacity 0.3s;
        }
        .hb-google-btn:not(:disabled):hover {
          background: rgba(255,255,255,0.11);
          border-color: rgba(255,255,255,0.22);
          transform: translateY(-1px);
        }
        .hb-google-btn:not(:disabled):hover::after {
          opacity: 1;
        }
        .hb-google-btn:not(:disabled):active {
          transform: translateY(0) scale(0.99);
        }
        .hb-google-btn:disabled {
          cursor: not-allowed;
          opacity: 0.5;
        }

        /* Divider */
        .hb-divider {
          display: flex;
          align-items: center;
          gap: 12px;
          margin: 1.5rem 0;
        }
        .hb-divider-line {
          flex: 1;
          height: 0.5px;
          background: rgba(255,255,255,0.08);
        }
        .hb-divider-text {
          font-size: 11px;
          color: rgba(255,255,255,0.22);
        }

        /* Footer note */
        .hb-note {
          font-size: 12px;
          color: rgba(255,255,255,0.22);
          text-align: center;
          line-height: 1.65;
        }
        .hb-note span {
          color: rgba(29,158,117,0.65);
        }

        /* Responsive */
        @media (max-width: 768px) {
          .hb-page { flex-direction: column; }
          .hb-left  { padding: 2rem 1.5rem 1.5rem; }
          .hb-right { width: 100%; border-left: none; border-top: 0.5px solid rgba(255,255,255,0.08); padding: 2rem 1.5rem; }
          .hb-hero  { padding-bottom: 1rem; }
        }
      `}</style>

      <main className="hb-page">
        {/* ── LEFT: Hero ── */}
        <section className="hb-left">
          <div className="hb-logo-row">
            <div className="hb-logo-dot" />
            <span className="hb-logo-text">Harbill</span>
          </div>

          <div className="hb-hero">
            <p className="hb-eyebrow">Bill Management System</p>
            <h1 className="hb-title">
              จัดการบิล<br />
              อย่าง<span className="hb-title-accent">เป็นระเบียบ</span>
            </h1>
            <p className="hb-desc">
              ระบบหารบิลที่ปลอดภัย เข้าถึงได้เฉพาะบัญชี Google
              ที่ได้รับอนุญาต พร้อมจัดการข้อมูลแยกตามผู้ใช้
            </p>
            <div className="hb-features">
              {[
                ["Access",   "Google Only"],
                ["Security", "Verified Auth"],
                ["Data",     "Per Account"],
              ].map(([label, val]) => (
                <div key={label} className="hb-feat">
                  <p className="hb-feat-label">{label}</p>
                  <p className="hb-feat-val">{val}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── RIGHT: Login card ── */}
        <section className="hb-right">
          <div className="hb-status-chip">
            <span className="hb-pulse" />
            ระบบพร้อมใช้งาน
          </div>

          <p className="hb-right-eyebrow">Harbill Account</p>
          <h2 className="hb-right-title">เข้าสู่ระบบ</h2>
          <p className="hb-right-sub">
            ใช้บัญชี Google ที่ได้รับอนุญาตเพื่อเข้าใช้งานระบบ
          </p>

          {error && (
            <div className="hb-error">{error}</div>
          )}

          <button
            onClick={googleLogin}
            disabled={loading}
            className="hb-google-btn"
          >
            {googleIcon}
            {loading ? "กำลังตรวจสอบระบบ..." : "เข้าสู่ระบบด้วย Google"}
          </button>

          <div className="hb-divider">
            <div className="hb-divider-line" />
            <span className="hb-divider-text">หรือ</span>
            <div className="hb-divider-line" />
          </div>

          <p className="hb-note">
            การเข้าสู่ระบบด้วยอีเมลและรหัสผ่าน<br />
            <span>ถูกปิดใช้งานแล้ว</span>
          </p>
        </section>
      </main>
    </>
  )
}