import { useEffect, useRef, useState } from "react"
import { api } from "../api"

export default function TelegramConnectPage() {
  const started = useRef(false)
  const [error, setError] = useState("")

  useEffect(() => {
    if (started.current) return
    started.current = true
    localStorage.setItem("harbill:returnTo", "/telegram/connect")

    api.createTelegramConnectToken()
      .then(connection => {
        if (!connection.deepLink) throw new Error("ไม่พบลิงก์สำหรับเปิด Telegram")
        window.location.replace(connection.deepLink)
      })
      .catch(err => setError(err.message || "เชื่อม Telegram ไม่สำเร็จ"))
  }, [])

  return (
    <main className="grid min-h-[100svh] place-items-center bg-slate-950 px-4 text-white">
      <section className="w-full max-w-sm rounded-2xl border border-white/10 bg-white/5 p-6 text-center">
        <p className="text-xs font-bold uppercase tracking-wide text-sky-300">Harbill Telegram</p>
        <h1 className="mt-2 text-xl font-black">กำลังเชื่อมบัญชี</h1>
        {error ? (
          <>
            <p className="mt-4 rounded-xl bg-rose-500/10 p-3 text-sm font-semibold text-rose-200">{error}</p>
            <button type="button" onClick={() => window.location.reload()} className="mt-4 w-full rounded-xl bg-sky-600 px-4 py-3 text-sm font-bold">
              ลองอีกครั้ง
            </button>
          </>
        ) : (
          <>
            <span className="mx-auto mt-5 block h-7 w-7 animate-spin rounded-full border-2 border-sky-400 border-t-transparent" />
            <p className="mt-4 text-sm text-slate-300">ระบบจะเปิดบอท Telegram ให้กด Start เพื่อยืนยันตัวตน</p>
          </>
        )}
      </section>
    </main>
  )
}
