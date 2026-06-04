import { useEffect, useRef, useState } from "react"
import { api } from "../api"

const proPromptpay = import.meta.env.VITE_PRO_PROMPTPAY || import.meta.env.VITE_SUPPORT_PROMPTPAY || "0980106920"
const proAmount = Number(import.meta.env.VITE_PRO_AMOUNT || 39)
const proDays = Number(import.meta.env.VITE_PRO_DAYS || 30)

function formatAmount(value) {
  return Number(value || 0).toLocaleString("th-TH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

const FEATURES = [
  "ไม่มีโฆษณาระหว่างใช้งาน",
  "ประวัติรอบไม่จำกัด",
  "คัดลอกรูป QR/สรุปแบบเหมาะกับแชร์ในแชท",
  "รองรับฟีเจอร์ Pro ใหม่ที่จะเพิ่มใน Harbill",
]

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
  const merchantInfo = tlv("00", "A000000677010111") + target
  const parts = [
    tlv("00", "01"),
    tlv("01", "12"),
    tlv("29", merchantInfo),
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

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="m20 6-11 11-5-5" />
    </svg>
  )
}

export default function ProPage({ user, onUserUpdate }) {
  const [qrUrl, setQrUrl] = useState("")
  const [reference, setReference] = useState("")
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState("")
  const requestLockRef = useRef(false)
  const isPro = user?.isPro || user?.plan === "pro"

  useEffect(() => {
    let cancelled = false

    async function buildQr() {
      const payload = buildPromptPayPayload(proPromptpay, proAmount)
      if (!payload) return
      const QRCode = await import("qrcode")
      const image = await QRCode.default.toDataURL(payload, {
        errorCorrectionLevel: "H",
        margin: 4,
        width: 320,
      })
      if (!cancelled) setQrUrl(image)
    }

    buildQr().catch(() => {})
    return () => { cancelled = true }
  }, [])

  async function requestManualActivation() {
    if (requestLockRef.current) return
    requestLockRef.current = true
    setSaving(true)
    setMessage("")
    try {
      const result = await api.requestProManual(reference || `manual-${Date.now()}`)
      setMessage(result.notificationSent
        ? "ส่งแจ้งโอนแล้วครับ รอตรวจสอบยอดก่อนเปิด Pro"
        : "รับคำขอแล้ว แต่ยังส่ง Telegram ไม่ได้ กรุณาแจ้งแอดมินอีกครั้ง"
      )
    } catch (error) {
      setMessage(error.message || "ยังส่งแจ้งโอนไม่สำเร็จ")
    } finally {
      requestLockRef.current = false
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-2xl border border-purple-400/20 bg-[#1c1c2e]">
        <div className="bg-gradient-to-r from-emerald-500 to-blue-500 px-5 py-5 text-white">
          <p className="text-xs font-bold uppercase tracking-wide text-white/80">Harbill Pro</p>
          <h1 className="mt-1 text-2xl font-extrabold">ใช้งานลื่นขึ้น และช่วยให้ Harbill อยู่ต่อ</h1>
          <p className="mt-2 text-sm text-white/80">เหมาะกับคนที่หารบิลบ่อย แชร์สรุปบ่อย หรืออยากสนับสนุนค่าเซิร์ฟเวอร์และ AI scan</p>
        </div>

        <div className="p-5">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-sm text-gray-400">เริ่มต้น</p>
              <p className="text-4xl font-extrabold text-white">฿{formatAmount(proAmount)}</p>
              <p className="text-xs text-gray-500">ต่อ {proDays} วัน</p>
            </div>
            <span className={`rounded-full px-3 py-1 text-xs font-bold ${isPro ? "bg-emerald-500/20 text-emerald-200" : "bg-white/10 text-gray-300"}`}>
              {isPro ? "Pro Active" : "Free"}
            </span>
          </div>

          <div className="mt-5 space-y-2">
            {FEATURES.map(feature => (
              <div key={feature} className="flex items-center gap-2 text-sm text-gray-200">
                <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-300">
                  <CheckIcon />
                </span>
                <span>{feature}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-[#1c1c2e] p-5">
        <p className="text-sm font-semibold text-white">จ่ายผ่าน PromptPay</p>
        <p className="mt-1 text-xs text-gray-500">สแกน QR แล้วกดแจ้งโอนด้านล่าง ระบบจะส่งคำขอให้แอดมินตรวจสอบก่อนเปิด Pro</p>

        <div className="mx-auto mt-4 w-fit rounded-2xl bg-white p-3">
          {qrUrl ? (
            <img src={qrUrl} alt="PromptPay QR สำหรับ Harbill Pro" className="h-56 w-56" />
          ) : (
            <div className="flex h-56 w-56 items-center justify-center text-xs text-slate-500">กำลังสร้าง QR...</div>
          )}
        </div>

        <div className="mt-4 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-center">
          <p className="text-xs text-emerald-100/70">สแกน QR เพื่อชำระ Harbill Pro</p>
          <p className="text-xs text-emerald-100/70">ยอด ฿{formatAmount(proAmount)}</p>
        </div>

        <input
          className="mt-4 w-full rounded-xl border border-gray-700 bg-[#13131f] px-3 py-2 text-sm outline-none focus:border-purple-500"
          placeholder="เลขอ้างอิง/เวลาที่โอน (ไม่บังคับ)"
          value={reference}
          onChange={e => setReference(e.target.value)}
        />

        <button
          type="button"
          onClick={requestManualActivation}
          disabled={saving}
          className="mt-3 w-full rounded-xl bg-purple-600 py-3 text-sm font-bold text-white transition-colors hover:bg-purple-500 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving ? "กำลังส่งแจ้งโอน..." : "แจ้งโอน"}
        </button>
        {message && <p className="mt-2 text-center text-xs text-emerald-300">{message}</p>}
      </div>
    </div>
  )
}
