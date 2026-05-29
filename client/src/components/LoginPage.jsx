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
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@500;700&family=DM+Sans:wght@300;400;500;600&display=swap');

        .hb-page {
          min-height: 100vh;
          display: grid;
          grid-template-columns: minmax(0, 1fr) 440px;
          background: linear-gradient(130deg, #090f1f 0%, #10192b 56%, #14213a 100%);
          font-family: 'DM Sans', sans-serif;
          position: relative;
          overflow: hidden;
        }
        .hb-page::before {
          content: "";
          position: fixed;
          inset: 0;
          background:
            radial-gradient(70% 65% at 22% 52%, rgba(19, 147, 112, 0.12) 0%, transparent 70%),
            radial-gradient(45% 45% at 86% 18%, rgba(35, 64, 130, 0.22) 0%, transparent 72%);
          pointer-events: none;
        }

        .hb-left {
          padding: clamp(1.25rem, 2.6vw, 3rem);
          display: flex;
          justify-content: center;
          position: relative;
          z-index: 1;
        }
        .hb-left-inner {
          width: 100%;
          max-width: 700px;
          min-height: min(84vh, 820px);
          display: flex;
          flex-direction: column;
        }
        .hb-logo-row {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          margin-top: 0.25rem;
        }
        .hb-logo-dot {
          width: 10px;
          height: 10px;
          border-radius: 999px;
          background: #16986f;
          box-shadow: 0 0 0 3px rgba(22, 152, 111, 0.25);
        }
        .hb-logo-text {
          font-size: 1rem;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.9);
          letter-spacing: 0.02em;
        }

        .hb-hero {
          margin: auto 0;
          padding: 2rem 0;
        }
        .hb-eyebrow {
          font-size: 0.72rem;
          text-transform: uppercase;
          letter-spacing: 0.14em;
          color: #22a27b;
          font-weight: 600;
          margin: 0 0 1.2rem;
        }
        .hb-title {
          margin: 0;
          font-family: 'Playfair Display', serif;
          font-size: clamp(2.1rem, 4.5vw, 3.9rem);
          line-height: 1.12;
          color: #f8fbff;
          max-width: 13ch;
        }
        .hb-title-accent {
          color: #24ab82;
        }
        .hb-desc {
          margin-top: 1.2rem;
          max-width: 44ch;
          font-size: 0.95rem;
          line-height: 1.9;
          color: rgba(255, 255, 255, 0.63);
        }
        .hb-features {
          margin-top: 2rem;
          display: flex;
          gap: 1.05rem;
          flex-wrap: wrap;
        }
        .hb-feat {
          min-width: 106px;
          padding-top: 0.75rem;
          border-top: 1px solid rgba(255, 255, 255, 0.14);
        }
        .hb-feat-label {
          margin: 0;
          font-size: 0.62rem;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: rgba(255, 255, 255, 0.42);
          font-weight: 600;
        }
        .hb-feat-val {
          margin: 0.3rem 0 0;
          font-size: 0.85rem;
          color: rgba(255, 255, 255, 0.82);
          font-weight: 500;
        }

        .hb-right {
          background: linear-gradient(180deg, rgba(255, 255, 255, 0.06), rgba(255, 255, 255, 0.03));
          border-left: 1px solid rgba(255, 255, 255, 0.12);
          backdrop-filter: blur(18px);
          -webkit-backdrop-filter: blur(18px);
          padding: clamp(1.25rem, 2.2vw, 2.3rem);
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
          z-index: 1;
        }
        .hb-right-inner {
          width: 100%;
          max-width: 350px;
        }
        .hb-status-chip {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          border-radius: 999px;
          padding: 0.33rem 0.65rem;
          font-size: 0.7rem;
          border: 1px solid rgba(22, 152, 111, 0.33);
          background: rgba(22, 152, 111, 0.13);
          color: #31b38d;
          margin-bottom: 1.6rem;
        }
        .hb-pulse {
          width: 7px;
          height: 7px;
          border-radius: 999px;
          background: #1fa97f;
          animation: hbPulse 2.1s ease-in-out infinite;
        }
        @keyframes hbPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.35; }
        }

        .hb-right-eyebrow {
          margin: 0 0 0.45rem;
          font-size: 0.72rem;
          letter-spacing: 0.11em;
          text-transform: uppercase;
          color: #22a27b;
          font-weight: 600;
        }
        .hb-right-title {
          margin: 0;
          color: #f8fbff;
          font-family: 'Playfair Display', serif;
          font-size: 2rem;
          line-height: 1.2;
        }
        .hb-right-sub {
          margin: 0.8rem 0 1.7rem;
          color: rgba(255, 255, 255, 0.56);
          line-height: 1.75;
          font-size: 0.9rem;
        }

        .hb-error {
          margin-bottom: 1rem;
          border-radius: 0.65rem;
          border: 1px solid rgba(221, 84, 84, 0.38);
          background: rgba(221, 84, 84, 0.13);
          color: #f2a3a3;
          font-size: 0.84rem;
          line-height: 1.55;
          padding: 0.62rem 0.8rem;
        }

        .hb-google-btn {
          width: 100%;
          height: 50px;
          border-radius: 0.72rem;
          border: 1px solid rgba(255, 255, 255, 0.16);
          background: rgba(255, 255, 255, 0.08);
          color: #eaf2f8;
          font-size: 0.95rem;
          font-weight: 600;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          cursor: pointer;
          transition: transform 140ms ease, background 160ms ease, border-color 160ms ease;
        }
        .hb-google-btn:hover:not(:disabled) {
          transform: translateY(-1px);
          border-color: rgba(255, 255, 255, 0.26);
          background: rgba(255, 255, 255, 0.12);
        }
        .hb-google-btn:disabled {
          opacity: 0.58;
          cursor: not-allowed;
        }

        .hb-divider {
          margin: 1.35rem 0;
          display: flex;
          align-items: center;
          gap: 0.65rem;
        }
        .hb-divider-line {
          flex: 1;
          height: 1px;
          background: rgba(255, 255, 255, 0.09);
        }
        .hb-divider-text {
          font-size: 0.7rem;
          color: rgba(255, 255, 255, 0.32);
        }

        .hb-note {
          margin: 0;
          text-align: center;
          line-height: 1.7;
          font-size: 0.78rem;
          color: rgba(255, 255, 255, 0.35);
        }
        .hb-note span {
          color: rgba(36, 171, 130, 0.72);
          font-weight: 500;
        }

        @media (max-width: 1280px) {
          .hb-page {
            grid-template-columns: minmax(0, 1fr) 400px;
          }
          .hb-left-inner {
            max-width: 620px;
          }
          .hb-title {
            font-size: clamp(2rem, 4.2vw, 3.4rem);
          }
        }

        @media (max-width: 1024px) {
          .hb-page {
            grid-template-columns: 1fr;
          }
          .hb-left {
            padding: 1.35rem 1.05rem 0.8rem;
          }
          .hb-left-inner {
            min-height: auto;
            max-width: 100%;
          }
          .hb-hero {
            margin: 1.25rem 0 0.5rem;
            padding: 0;
          }
          .hb-desc {
            max-width: 60ch;
          }
          .hb-right {
            border-left: none;
            border-top: 1px solid rgba(255, 255, 255, 0.1);
            padding: 1.1rem 1rem 1.6rem;
          }
          .hb-right-inner {
            max-width: 560px;
          }
        }

        @media (max-width: 768px) {
          .hb-left {
            padding: 1.1rem 0.95rem 0.6rem;
          }
          .hb-hero {
            margin: 1rem 0 0.2rem;
          }
          .hb-desc {
            font-size: 0.9rem;
            line-height: 1.8;
            max-width: 50ch;
          }
          .hb-feat {
            min-width: 96px;
          }
          .hb-right {
            padding: 1rem 0.95rem 1.4rem;
          }
          .hb-status-chip {
            margin-bottom: 1.2rem;
          }
        }

        @media (max-width: 640px) {
          .hb-title {
            font-size: clamp(2rem, 8vw, 2.8rem);
          }
          .hb-features {
            gap: 0.9rem;
          }
          .hb-right-title {
            font-size: 1.7rem;
          }
          .hb-right-sub {
            margin-bottom: 1.25rem;
          }
          .hb-google-btn {
            height: 48px;
            font-size: 0.9rem;
          }
          .hb-note {
            font-size: 0.75rem;
          }
        }

        @media (max-width: 420px) {
          .hb-left {
            padding-left: 0.8rem;
            padding-right: 0.8rem;
          }
          .hb-title {
            font-size: clamp(1.8rem, 9vw, 2.25rem);
          }
          .hb-eyebrow {
            font-size: 0.66rem;
          }
          .hb-features {
            gap: 0.7rem;
          }
          .hb-feat {
            min-width: 84px;
            padding-top: 0.55rem;
          }
        }
      `}</style>

      <main className="hb-page">
        <section className="hb-left">
          <div className="hb-left-inner">
            <div className="hb-logo-row">
              <div className="hb-logo-dot" />
              <span className="hb-logo-text">Harbill</span>
            </div>

            <div className="hb-hero">
              <p className="hb-eyebrow">Bill Management System</p>
              <h1 className="hb-title">
                จัดการบิล
                <br />
                อย่าง<span className="hb-title-accent">เป็นระเบียบ</span>
              </h1>
              <p className="hb-desc">
                ระบบหารบิลที่ปลอดภัย เข้าถึงได้เฉพาะบัญชี Google ที่ได้รับอนุญาต พร้อมจัดการข้อมูลแยกตามผู้ใช้
              </p>
              <div className="hb-features">
                {[
                  ["Access", "Google Only"],
                  ["Security", "Verified Auth"],
                  ["Data", "Per Account"],
                ].map(([label, val]) => (
                  <div key={label} className="hb-feat">
                    <p className="hb-feat-label">{label}</p>
                    <p className="hb-feat-val">{val}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="hb-right">
          <div className="hb-right-inner">
            <div className="hb-status-chip">
              <span className="hb-pulse" />
              ระบบพร้อมใช้งาน
            </div>

            <p className="hb-right-eyebrow">Harbill Account</p>
            <h2 className="hb-right-title">เข้าสู่ระบบ</h2>
            <p className="hb-right-sub">
              ใช้บัญชี Google ที่ได้รับอนุญาตเพื่อเข้าใช้งานระบบ
            </p>

            {error && <div className="hb-error">{error}</div>}

            <button onClick={googleLogin} disabled={loading} className="hb-google-btn">
              {googleIcon}
              {loading ? "กำลังตรวจสอบระบบ..." : "เข้าสู่ระบบด้วย Google"}
            </button>

            <div className="hb-divider">
              <div className="hb-divider-line" />
              <span className="hb-divider-text">หรือ</span>
              <div className="hb-divider-line" />
            </div>

            <p className="hb-note">
              การเข้าสู่ระบบด้วยอีเมลและรหัสผ่าน
              <br />
              <span>ถูกปิดใช้งานแล้ว</span>
            </p>
          </div>
        </section>
      </main>
    </>
  )
}
