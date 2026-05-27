import { useEffect } from "react"

const supportUrl = import.meta.env.VITE_SUPPORT_URL
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
