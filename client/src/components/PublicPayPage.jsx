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
  const [slipFile, setSlipFile] = useState(null)
  const [slipPreview, setSlipPreview] = useState("")
  const [uploadingSlip, setUploadingSlip] = useState(false)
  const [uploadMessage, setUploadMessage] = useState("")

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

  useEffect(() => {
    if (!slipFile) {
      setSlipPreview("")
      return
    }
    if (!String(slipFile.type || "").startsWith("image/")) {
      setSlipPreview("")
      return
    }
    const url = URL.createObjectURL(slipFile)
    setSlipPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [slipFile])

  function fileSafeName() {
    const name = String(data?.person || "payment").replace(/[^\wก-๙-]+/g, "-")
    return `harbill-qr-${name}-${data?.month || "due"}.png`
  }

  async function saveQrImage() {
    if (!qrUrl) return
    const link = document.createElement("a")
    link.href = qrUrl
    link.download = fileSafeName()
    document.body.appendChild(link)
    link.click()
    link.remove()
  }

  async function sharePayment() {
    const text = `Harbill: ${data?.person || ""} ยอดชำระ ฿${formatMoney(data?.total)}`
    if (navigator.share) {
      await navigator.share({ title: "Harbill Payment", text, url: window.location.href })
      return
    }
    await navigator.clipboard?.writeText(window.location.href)
    setUploadMessage("คัดลอกลิงก์แล้ว")
  }

  async function uploadSlip() {
    if (!slipFile) {
      setUploadMessage("กรุณาเลือกรูปสลิปก่อน")
      return
    }
    setUploadingSlip(true)
    setUploadMessage("")
    try {
      const result = await api.uploadPublicPaymentSlip(token, slipFile)
      setData(result)
      setSlipFile(null)
      setUploadMessage("ส่งสลิปแล้ว รอเจ้าของยอดตรวจรับเงิน")
    } catch (err) {
      setUploadMessage(err.message || "ส่งสลิปไม่สำเร็จ")
    } finally {
      setUploadingSlip(false)
    }
  }

  const page = darkMode ? "bg-[#0f172a] text-slate-100" : "bg-[#f5f7fb] text-slate-950"
  const panel = darkMode ? "border-slate-700 bg-slate-900" : "border-slate-200 bg-white"
  const muted = darkMode ? "text-slate-400" : "text-slate-500"
  const softPanel = darkMode ? "border-slate-800 bg-slate-950/60" : "border-slate-100 bg-slate-50"
  const divider = darkMode ? "divide-slate-800 border-slate-700" : "divide-slate-100 border-slate-200"
  const payPanel = darkMode ? "border-sky-500/20 bg-sky-500/10" : "border-sky-200 bg-sky-50"
  const payText = darkMode ? "text-sky-100" : "text-sky-950"
  const payMuted = darkMode ? "text-sky-200/75" : "text-sky-700"
  const button = darkMode
    ? "border-slate-700 bg-slate-950/60 text-slate-100 hover:border-sky-500 hover:text-sky-100"
    : "border-slate-200 bg-white text-slate-700 hover:border-sky-300 hover:text-sky-800"
  const primaryButton = "bg-sky-600 text-white hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-60"

  return (
    <main className={`min-h-[100svh] overflow-x-hidden px-3 py-4 sm:px-4 sm:py-8 ${page}`}>
      <div className="mx-auto w-full max-w-3xl space-y-4">
        <section className={`rounded-2xl border p-4 shadow-sm sm:p-5 ${panel}`}>
          <p className={`text-xs font-bold uppercase ${muted}`}>Harbill Payment</p>
          <h1 className="mt-2 text-xl font-black sm:text-2xl">ยอดที่ต้องชำระ</h1>
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
                <p className="mt-1 text-3xl font-black sm:text-4xl">฿{formatMoney(data.total)}</p>
                <p className="mt-1 text-xs text-slate-400">เดือน {data.month}</p>
              </div>

              <div className={`mt-4 divide-y rounded-2xl border ${divider}`}>
                {data.items.length === 0 ? (
                  <p className="p-4 text-center text-sm text-emerald-700">ไม่มีรายการค้างชำระแล้ว</p>
                ) : data.items.map(item => (
                  <div key={item.id} className="grid gap-2 p-4 sm:grid-cols-[1fr_auto] sm:items-start">
                    <div className="min-w-0">
                      <p className="text-sm font-bold">{item.title}</p>
                      {item.note && <p className={`mt-1 text-xs ${muted}`}>{item.note}</p>}
                      {item.slipName && <p className="mt-1 text-xs font-semibold text-amber-500">ส่งสลิปแล้ว รอตรวจ</p>}
                    </div>
                    <p className="text-right text-sm font-black sm:text-left">฿{formatMoney(item.amount)}</p>
                  </div>
                ))}
              </div>

              {data.payment?.promptpay ? (
                <div className={`mt-4 grid gap-4 rounded-2xl border p-4 ${payPanel}`}>
                  <div className="mx-auto w-full max-w-[320px] rounded-2xl bg-white p-3 shadow-sm">
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
                  <div className="text-center sm:text-left">
                    <p className={`text-xs font-bold uppercase ${payMuted}`}>PromptPay QR</p>
                    <p className={`mt-1 text-2xl font-black ${payText}`}>฿{formatMoney(data.total)}</p>
                    <p className={`mt-2 text-sm font-bold ${payText}`}>{data.payment.promptpay}</p>
                    <p className={`mt-1 text-xs leading-5 ${payMuted}`}>สแกน QR นี้เพื่อโอนยอดตามรายการค้างทั้งหมด แล้วส่งสลิปให้เจ้าของยอดตรวจสอบ</p>
                    <div className="mt-4 grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={saveQrImage}
                        disabled={!qrUrl || qrLoading}
                        className={`rounded-xl px-4 py-3 text-sm font-bold transition-colors ${primaryButton}`}
                      >
                        บันทึก QR
                      </button>
                      <button
                        type="button"
                        onClick={sharePayment}
                        className={`rounded-xl border px-4 py-3 text-sm font-bold transition-colors ${button}`}
                      >
                        แชร์ลิงก์
                      </button>
                    </div>
                    <p className={`mt-2 text-[11px] leading-5 ${payMuted}`}>บนมือถือบางรุ่นถ้าปุ่มบันทึกไม่ทำงาน ให้กดค้างที่รูป QR แล้วเลือกบันทึกรูปภาพ</p>
                  </div>
                </div>
              ) : (
                <div className={`mt-4 rounded-2xl border p-4 text-sm font-semibold ${darkMode ? "border-amber-500/20 bg-amber-500/10 text-amber-100" : "border-amber-200 bg-amber-50 text-amber-800"}`}>
                  เจ้าของยอดยังไม่ได้ตั้งค่าพร้อมเพย์ จึงยังสร้าง QR ชำระเงินไม่ได้
                </div>
              )}

              {data.items.length > 0 && (
                <div className={`mt-4 rounded-2xl border p-4 ${panel}`}>
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                      <p className="text-sm font-black">ส่งสลิปให้เจ้าของยอด</p>
                      <p className={`mt-1 text-xs leading-5 ${muted}`}>หลังโอนแล้ว อัปโหลดสลิปที่นี่ ระบบจะเปลี่ยนรายการเป็น “รอตรวจ” ให้เจ้าของเข้ามากดรับเงินแล้ว</p>
                    </div>
                    <span className={`text-xs font-bold ${muted}`}>สูงสุด 5MB</span>
                  </div>

                  <label className={`mt-4 flex min-h-32 cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed p-4 text-center transition-colors ${darkMode ? "border-slate-700 bg-slate-950/50 text-slate-300 hover:border-sky-500" : "border-slate-300 bg-slate-50 text-slate-600 hover:border-sky-400"}`}>
                    {slipPreview ? (
                      <img src={slipPreview} alt="ตัวอย่างสลิป" className="max-h-56 w-full rounded-xl object-contain" />
                    ) : (
                      <>
                        <span className="text-sm font-bold">{slipFile ? slipFile.name : "แตะเพื่อเลือกรูปสลิป"}</span>
                        <span className={`mt-1 text-xs ${muted}`}>รองรับรูปภาพหรือ PDF</span>
                      </>
                    )}
                    <input
                      type="file"
                      accept="image/*,.pdf"
                      className="hidden"
                      onChange={event => setSlipFile(event.target.files?.[0] || null)}
                    />
                  </label>

                  <button
                    type="button"
                    onClick={uploadSlip}
                    disabled={uploadingSlip || !slipFile}
                    className={`mt-3 w-full rounded-xl px-4 py-3 text-sm font-bold transition-colors ${primaryButton}`}
                  >
                    {uploadingSlip ? "กำลังส่งสลิป..." : "ส่งสลิป"}
                  </button>
                  {uploadMessage && (
                    <p className={`mt-3 rounded-xl px-3 py-2 text-center text-xs font-bold ${uploadMessage.includes("ไม่") || uploadMessage.includes("กรุณา") ? "bg-rose-500/10 text-rose-400" : "bg-emerald-500/10 text-emerald-400"}`}>
                      {uploadMessage}
                    </p>
                  )}
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </main>
  )
}
