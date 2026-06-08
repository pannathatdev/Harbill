import { useEffect, useState } from "react"
import { useParams } from "react-router-dom"
import { api } from "../api"

function formatMoney(value) {
  return Number(value || 0).toLocaleString("th-TH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

export default function PublicPayPage() {
  const { token } = useParams()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

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

  return (
    <main className="min-h-screen bg-[#f5f7fb] px-4 py-8 text-slate-950">
      <div className="mx-auto max-w-4xl space-y-4">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-bold uppercase text-slate-500">Harbill Payment</p>
          <h1 className="mt-2 text-2xl font-black">ยอดที่ต้องชำระ</h1>
          {loading && (
            <div className="mt-6 rounded-2xl bg-slate-50 p-6 text-center">
              <span className="mx-auto block h-6 w-6 animate-spin rounded-full border-2 border-sky-500 border-t-transparent" />
              <p className="mt-3 text-sm font-semibold text-slate-500">กำลังโหลดข้อมูล...</p>
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

              <div className="mt-4 divide-y divide-slate-100 rounded-2xl border border-slate-200">
                {data.items.length === 0 ? (
                  <p className="p-4 text-center text-sm text-emerald-700">ไม่มีรายการค้างชำระแล้ว</p>
                ) : data.items.map(item => (
                  <div key={item.id} className="flex items-start justify-between gap-3 p-4">
                    <div>
                      <p className="text-sm font-bold">{item.title}</p>
                      {item.note && <p className="mt-1 text-xs text-slate-500">{item.note}</p>}
                    </div>
                    <p className="shrink-0 text-sm font-black">฿{formatMoney(item.amount)}</p>
                  </div>
                ))}
              </div>

              {data.payment?.promptpay && (
                <div className="mt-4 rounded-2xl border border-sky-200 bg-sky-50 p-4">
                  <p className="text-xs font-bold uppercase text-sky-700">PromptPay</p>
                  <p className="mt-1 text-lg font-black text-sky-950">{data.payment.promptpay}</p>
                  <p className="mt-1 text-xs text-sky-700">โอนแล้วส่งสลิปให้เจ้าของยอดตรวจสอบ</p>
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </main>
  )
}
