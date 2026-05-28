import { useEffect } from "react"

const supportUrl = import.meta.env.VITE_SUPPORT_URL
const affiliateUrl = import.meta.env.VITE_AFFILIATE_URL || "https://www.trip.com/t/Lzy8mEFNtU2"
const affiliateLabel = import.meta.env.VITE_AFFILIATE_LABEL || "ดีลสำหรับทริปถัดไป"
const affiliateText = import.meta.env.VITE_AFFILIATE_TEXT || "จองที่พัก ตั๋วเดินทาง หรือ eSIM สำหรับทริปหน้า"
const adsenseClient = import.meta.env.VITE_ADSENSE_CLIENT
const adsenseSlot = import.meta.env.VITE_ADSENSE_SLOT

function loadAdSenseScript() {
  if (!adsenseClient || document.querySelector("script[data-harbill-adsense]")) return

  const script = document.createElement("script")
  script.async = true
  script.crossOrigin = "anonymous"
  script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${adsenseClient}`
  script.dataset.harbillAdsense = "true"
  document.head.appendChild(script)
}

export function AdSlot({ className = "" }) {
  useEffect(() => {
    if (!adsenseClient || !adsenseSlot) return
    loadAdSenseScript()
    try {
      window.adsbygoogle = window.adsbygoogle || []
      window.adsbygoogle.push({})
    } catch {
      // Ad blockers or pending AdSense approval can block this safely.
    }
  }, [])

  if (!adsenseClient || !adsenseSlot) return null

  return (
    <div className={className}>
      <ins
        className="adsbygoogle block"
        style={{ display: "block" }}
        data-ad-client={adsenseClient}
        data-ad-slot={adsenseSlot}
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </div>
  )
}

export function SupportLink() {
  if (!supportUrl) return null

  return (
    <a
      href={supportUrl}
      target="_blank"
      rel="noreferrer"
      className="block text-center text-xs text-white/40 hover:text-white/70 transition-colors"
    >
      สนับสนุน Harbill
    </a>
  )
}

export function SupportCard({ className = "" }) {
  if (!supportUrl) return null

  return (
    <a
      href={supportUrl}
      target="_blank"
      rel="noreferrer"
      className={`block rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-center transition-colors hover:border-emerald-400/50 hover:bg-emerald-500/15 ${className}`}
    >
      <p className="text-sm font-semibold text-emerald-200">Harbill ช่วยประหยัดเวลาไหม?</p>
      <p className="mt-1 text-xs text-emerald-100/70">สนับสนุนค่าเซิร์ฟเวอร์และ AI scan ให้เว็บอยู่ต่อได้</p>
      <span className="mt-3 inline-flex rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-white">
        สนับสนุน Harbill
      </span>
    </a>
  )
}

export function AffiliateBanner({ className = "" }) {
  if (!affiliateUrl) return null

  return (
    <a
      href={affiliateUrl}
      target="_blank"
      rel="noreferrer"
      className={`block rounded-2xl border border-purple-500/20 bg-purple-500/10 p-4 transition-colors hover:border-purple-400/50 hover:bg-purple-500/15 ${className}`}
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-purple-200/80">{affiliateLabel}</p>
      <p className="mt-1 text-sm font-semibold text-white">{affiliateText}</p>
      <p className="mt-2 text-xs text-purple-100/60">เปิดในแท็บใหม่</p>
    </a>
  )
}
