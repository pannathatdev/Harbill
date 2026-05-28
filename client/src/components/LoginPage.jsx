import { useEffect, useState } from "react"
import { api } from "../api"

const googleIcon = (
  <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">
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
    <main className="min-h-screen bg-[#f6f7fb] text-slate-900">
      <div className="mx-auto grid min-h-screen w-full max-w-6xl grid-cols-1 items-center gap-8 px-5 py-10 md:grid-cols-[1.05fr_0.95fr] md:px-8">
        <section className="space-y-7">
          <div className="inline-flex items-center gap-3 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 shadow-sm">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
            Secure access
          </div>

          <div className="max-w-xl space-y-4">
            <h1 className="text-4xl font-bold leading-tight text-slate-950 sm:text-5xl">
              Harbill
            </h1>
            <p className="text-lg leading-8 text-slate-600">
              ระบบจัดการและหารบิลสำหรับการใช้งานอย่างเป็นระเบียบ ปลอดภัย และเข้าถึงได้ด้วยบัญชี Google เท่านั้น
            </p>
          </div>

          <div className="grid max-w-xl grid-cols-1 gap-3 sm:grid-cols-3">
            {[
              ["Google", "เข้าสู่ระบบเดียว"],
              ["Protected", "ยืนยันตัวตนก่อนใช้งาน"],
              ["Organized", "ข้อมูลแยกตามบัญชี"]
            ].map(([label, value]) => (
              <div key={label} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                <p className="text-xs font-semibold uppercase text-slate-400">{label}</p>
                <p className="mt-1 text-sm font-semibold text-slate-800">{value}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-xl shadow-slate-200/70 sm:p-8">
          <div className="mb-8 space-y-2">
            <p className="text-sm font-semibold uppercase text-emerald-700">Harbill Account</p>
            <h2 className="text-2xl font-bold text-slate-950">เข้าสู่ระบบ</h2>
            <p className="text-sm leading-6 text-slate-500">
              ใช้บัญชี Google ที่ได้รับอนุญาตเพื่อเข้าใช้งานระบบ
            </p>
          </div>

          {error && (
            <div className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 text-red-700">
              {error}
            </div>
          )}

          <button
            onClick={googleLogin}
            disabled={loading}
            className="flex h-12 w-full items-center justify-center gap-3 rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-800 shadow-sm transition hover:border-slate-400 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {googleIcon}
            {loading ? "กำลังตรวจสอบระบบ..." : "เข้าสู่ระบบด้วย Google"}
          </button>

          <div className="mt-6 border-t border-slate-200 pt-5 text-xs leading-6 text-slate-500">
            การเข้าสู่ระบบด้วยอีเมลและรหัสผ่านถูกปิดใช้งานแล้ว
          </div>
        </section>
      </div>
    </main>
  )
}
