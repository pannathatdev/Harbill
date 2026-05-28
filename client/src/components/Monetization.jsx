import { useEffect, useState } from "react"

const supportUrl = import.meta.env.VITE_SUPPORT_URL
const supportPromptpay = import.meta.env.VITE_SUPPORT_PROMPTPAY || "0980106920"
const supportAmount = import.meta.env.VITE_SUPPORT_AMOUNT ? Number(import.meta.env.VITE_SUPPORT_AMOUNT) : null
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

function tlv(id, value) {
  const text = String(value)
  return `${id}${String(text.length).padStart(2, "0")}${text}`
}

function crc16Ccitt(input) {
  let crc = 0xFFFF
  for (let i = 0; i < input.length; i++) {
    crc ^= input.charCodeAt(i) << 8
    for (let bit = 0; bit < 8; bit++) {
      crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) : (crc << 1)
      crc &= 0xFFFF
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0")
}

function buildPromptPayPayload(promptpay, amount) {
  const digits = String(promptpay || "").replace(/\D/g, "")
  if (!digits) return ""

  const target = digits.length === 10 && digits.startsWith("0")
    ? tlv("01", `0066${digits.slice(1)}`)
    : tlv(digits.length === 13 ? "02" : "01", digits)

  const parts = [
    tlv("00", "01"),
    tlv("01", "12"),
    tlv("29", tlv("00", "A000000677010111") + target),
    tlv("52", "0000"),
    tlv("53", "764"),
    Number.isFinite(amount) && amount > 0 ? tlv("54", amount.toFixed(2)) : "",
    tlv("58", "TH"),
    tlv("59", "HARBILL"),
    tlv("60", "BANGKOK"),
  ].join("")
  const withoutCrc = `${parts}6304`
  return `${withoutCrc}${crc16Ccitt(withoutCrc)}`
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
  if (supportUrl) {
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

  if (!supportPromptpay) return null

  return (
    <span className="block text-center text-xs text-white/40">
      สนับสนุน Harbill ผ่านพร้อมเพย์
    </span>
  )
}

export function SupportCard({ className = "" }) {
  const [qrUrl, setQrUrl] = useState("")
  const [showQr, setShowQr] = useState(false)

  useEffect(() => {
    if (supportUrl || !supportPromptpay) return
    let cancelled = false

    async function buildQr() {
      const QRCode = await import("qrcode")
      const payload = buildPromptPayPayload(supportPromptpay, supportAmount)
      if (!payload) return
      const image = await QRCode.default.toDataURL(payload, {
        errorCorrectionLevel: "M",
        margin: 1,
        width: 180,
      })
      if (!cancelled) setQrUrl(image)
    }

    buildQr().catch(() => {})
    return () => { cancelled = true }
  }, [])

  if (supportUrl) {
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

  if (!supportPromptpay) return null

  return (
    <div className={`rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-center ${className}`}>
      <p className="text-sm font-semibold text-emerald-200">Harbill ช่วยประหยัดเวลาไหม?</p>
      <p className="mt-1 text-xs text-emerald-100/70">สนับสนุนค่าเซิร์ฟเวอร์และ AI scan ให้เว็บอยู่ต่อได้</p>
      <button
        type="button"
        onClick={() => setShowQr(true)}
        className="mt-3 inline-flex rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-400"
      >
        สแกน QR สนับสนุน
      </button>
      <p className="mt-1 text-xs text-emerald-100/70">
        {supportAmount ? `ยอดแนะนำ ฿${supportAmount.toFixed(2)}` : "กรอกยอดสนับสนุนเองในแอปธนาคาร"}
      </p>
      {showQr && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm">
          <div className="w-full max-w-xs rounded-2xl border border-white/10 bg-[#181827] p-5 text-center shadow-2xl">
            <p className="text-sm font-semibold text-white">สนับสนุน Harbill</p>
            <p className="mt-1 text-xs text-gray-400">
              {supportAmount ? `สแกนจ่าย ฿${supportAmount.toFixed(2)}` : "สแกนแล้วกรอกยอดเอง"}
            </p>
            <div className="mx-auto mt-4 w-fit rounded-2xl bg-white p-3">
              {qrUrl ? (
                <img src={qrUrl} alt="PromptPay QR สนับสนุน Harbill" className="h-48 w-48" />
              ) : (
                <div className="flex h-48 w-48 items-center justify-center text-xs text-slate-500">กำลังสร้าง QR...</div>
              )}
            </div>
            <button
              type="button"
              onClick={() => setShowQr(false)}
              className="mt-4 w-full rounded-xl bg-white/10 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-white/15"
            >
              ปิด
            </button>
          </div>
        </div>
      )}
    </div>
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
