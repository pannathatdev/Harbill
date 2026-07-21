import { useEffect, useState } from "react"

export default function PwaInstallPrompt() {
  const [installEvent, setInstallEvent] = useState(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const onInstallAvailable = event => {
      event.preventDefault()
      setInstallEvent(event)
      setVisible(true)
    }
    const onInstalled = () => {
      setInstallEvent(null)
      setVisible(false)
    }

    window.addEventListener("beforeinstallprompt", onInstallAvailable)
    window.addEventListener("appinstalled", onInstalled)
    return () => {
      window.removeEventListener("beforeinstallprompt", onInstallAvailable)
      window.removeEventListener("appinstalled", onInstalled)
    }
  }, [])

  async function install() {
    if (!installEvent) return
    await installEvent.prompt()
    await installEvent.userChoice
    setInstallEvent(null)
    setVisible(false)
  }

  if (!visible) return null

  return (
    <aside className="fixed bottom-4 left-4 right-4 z-[100] mx-auto flex max-w-md items-center gap-3 rounded-2xl border border-emerald-400/30 bg-slate-900 p-3 text-white shadow-2xl">
      <img src="/favicon.svg" alt="" className="h-11 w-11 rounded-xl" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">ติดตั้ง Harbill</p>
        <p className="text-xs text-slate-300">เปิดใช้งานจากหน้าจอหลักได้สะดวกขึ้น</p>
      </div>
      <button type="button" onClick={install} className="rounded-xl bg-emerald-500 px-3 py-2 text-sm font-semibold text-slate-950">
        ติดตั้ง
      </button>
      <button type="button" onClick={() => setVisible(false)} className="px-1 text-xl text-slate-400" aria-label="ปิด">
        ×
      </button>
    </aside>
  )
}
