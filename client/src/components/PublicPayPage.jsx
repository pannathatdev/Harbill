import { useEffect, useState } from "react"
import { useParams } from "react-router-dom"
import { api } from "../api"

function formatMoney(value) {
  return Number(value || 0).toLocaleString("th-TH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
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
  if (!digits || !Number.isFinite(amount) || amount <= 0) return ""

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
    tlv("54", Number(amount).toFixed(2)),
    tlv("58", "TH"),
    tlv("59", "HARBILL"),
    tlv("60", "BANGKOK"),
  ].join("")
  const withoutCrc = `${parts}6304`
  return `${withoutCrc}${crc16Ccitt(withoutCrc)}`
}

export default function PublicPayPage({ darkMode = true }) {
  const { token } = useParams()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [qrUrl, setQrUrl] = useState("")
  const [qrLoading, setQrLoading] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    api.getPublicPayment(token)
      .then(result => {
        if (!cancelled) setData(result)
      })
      .catch(err => {
        if (!cancelled) setError(err.message || "เปิดลิงก์ไม่ได้")
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [token])

  useEffect(() => {
    let cancelled = false

    async function buildQr() {
      const payload = buildPromptPayPayload(data?.payment?.promptpay, Number(data?.total || 0))
      if (!payload) {
        setQrUrl("")
        setQrLoading(false)
        return
      }

      setQrLoading(true)
      try {
        const QRCode = await import("qrcode")
        const image = await QRCode.default.toDataURL(payload, {
          errorCorrectionLevel: "H",
          margin: 3,
          width: 360,
        })
        if (!cancelled) setQrUrl(image)
      } finally {
        if (!cancelled) setQrLoading(false)
      }
    }

    buildQr()
    return () => { cancelled = true }
  }, [data?.payment?.promptpay, data?.total])

  const page = darkMode ? "bg-[#0f172a] text-slate-100" : "bg-[#f5f7fb] text-slate-950"
  const panel = darkMode ? "border-slate-700 bg-slate-900" : "border-slate-200 bg-white"
  const muted = darkMode ? "text-slate-400" : "text-slate-500"
  const softPanel = darkMode ? "border-slate-800 bg-slate-950/60" : "border-slate-100 bg-slate-50"
  const divider = darkMode ? "divide-slate-800 border-slate-700" : "divide-slate-100 border-slate-200"
  const payPanel = darkMode ? "border-sky-500/20 bg-sky-500/10" : "border-sky-200 bg-sky-50"
  const payText = darkMode ? "text-sky-100" : "text-sky-950"
  const payMuted = darkMode ? "text-sky-200/75" : "text-sky-700"

  return (
    <main className={`min-h-screen px-4 py-8 ${page}`}>
      <div className="mx-auto max-w-4xl space-y-4">
        <section className={`rounded-2xl border p-5 shadow-sm ${panel}`}>
          <p className={`text-xs font-bold uppercase ${muted}`}>Harbill Payment</p>
          <h1 className="mt-2 text-2xl font-black">ยอดที่ต้องชำระ</h1>
          {loading && (
            <div className={`mt-6 rounded-2xl p-6 text-center ${softPanel}`}>
              <span className="mx-auto block h-6 w-6 animate-spin rounded-full border-2 border-sky-500 border-t-transparent" />
              <p className={`mt-3 text-sm font-semibold ${muted}`}>กำลังโหลดข้อมูล...</p>
            </div>
          )}
          {error && !loading && (
            <div className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-700">
              {error}
            </div>
          )}
          {data && !loading && (
            <>
              <div className="mt-5 rounded-2xl bg-slate-950 p-4 text-white">
                <p className="text-sm text-slate-300">{data.person}</p>
                <p className="mt-1 text-3xl font-black">฿{formatMoney(data.total)}</p>
                <p className="mt-1 text-xs text-slate-400">เดือน {data.month}</p>
              </div>

              <div className={`mt-4 divide-y rounded-2xl border ${divider}`}>
                {data.items.length === 0 ? (
                  <p className="p-4 text-center text-sm text-emerald-700">ไม่มีรายการค้างชำระแล้ว</p>
                ) : data.items.map(item => (
                  <div key={item.id} className="flex items-start justify-between gap-3 p-4">
                    <div>
                      <p className="text-sm font-bold">{item.title}</p>
                      {item.note && <p className={`mt-1 text-xs ${muted}`}>{item.note}</p>}
                    </div>
                    <p className="shrink-0 text-sm font-black">฿{formatMoney(item.amount)}</p>
                  </div>
                ))}
              </div>

              {data.payment?.promptpay ? (
                <div className={`mt-4 grid gap-4 rounded-2xl border p-4 sm:grid-cols-[220px_1fr] sm:items-center ${payPanel}`}>
                  <div className="rounded-2xl bg-white p-3 shadow-sm">
                    {qrLoading ? (
                      <div className="grid aspect-square place-items-center">
                        <span className="h-6 w-6 animate-spin rounded-full border-2 border-sky-500 border-t-transparent" />
                      </div>
                    ) : qrUrl ? (
                      <img src={qrUrl} alt="PromptPay QR" className="h-full w-full rounded-xl" />
                    ) : (
                      <div className="grid aspect-square place-items-center text-center text-xs font-semibold text-slate-400">
                        สร้าง QR ไม่ได้
                      </div>
                    )}
                  </div>
                  <div>
                    <p className={`text-xs font-bold uppercase ${payMuted}`}>PromptPay QR</p>
                    <p className={`mt-1 text-2xl font-black ${payText}`}>฿{formatMoney(data.total)}</p>
                    <p className={`mt-2 text-sm font-bold ${payText}`}>{data.payment.promptpay}</p>
                    <p className={`mt-1 text-xs leading-5 ${payMuted}`}>สแกน QR นี้เพื่อโอนยอดตามรายการค้างทั้งหมด แล้วส่งสลิปให้เจ้าของยอดตรวจสอบ</p>
                  </div>
                </div>
              ) : (
                <div className={`mt-4 rounded-2xl border p-4 text-sm font-semibold ${darkMode ? "border-amber-500/20 bg-amber-500/10 text-amber-100" : "border-amber-200 bg-amber-50 text-amber-800"}`}>
                  เจ้าของยอดยังไม่ได้ตั้งค่าพร้อมเพย์ จึงยังสร้าง QR ชำระเงินไม่ได้
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </main>
  )
}
