import { useEffect, useMemo, useState } from "react"
import { api } from "../api"

function currentMonth() {
  return new Date().toISOString().slice(0, 7)
}

function tg() {
  return window.Telegram?.WebApp || null
}

export default function TelegramAddDuePage() {
  const params = new URLSearchParams(window.location.search)
  const webApp = tg()
  const chatId = params.get("chat_id") || webApp?.initDataUnsafe?.start_param || ""
  const initData = webApp?.initData || ""
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [context, setContext] = useState(null)
  const [form, setForm] = useState({
    title: "",
    amount: "",
    month: currentMonth(),
    note: "",
    debtors: []
  })

  useEffect(() => {
    webApp?.ready?.()
    webApp?.expand?.()
  }, [webApp])

  useEffect(() => {
    if (!initData || !chatId) {
      setError("เปิดหน้านี้จากปุ่มใน Telegram เท่านั้น")
      setLoading(false)
      return
    }

    let cancelled = false
    api.getTelegramWebAppContext({ initData, chatId })
      .then(data => {
        if (!cancelled) setContext(data)
      })
      .catch(err => {
        if (!cancelled) setError(err.message || "เชื่อม Telegram ไม่สำเร็จ")
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [chatId, initData])

  const friends = useMemo(() => {
    const currentName = context?.member?.name || ""
    return (context?.friends || []).filter(friend => friend.name && friend.name !== currentName)
  }, [context])

  function toggleDebtor(name) {
    setForm(value => ({
      ...value,
      debtors: value.debtors.includes(name)
        ? value.debtors.filter(item => item !== name)
        : [...value.debtors, name]
    }))
  }

  async function submit(e) {
    e.preventDefault()
    if (saving) return
    setSaving(true)
    setError("")
    try {
      await api.createTelegramWebAppDue({ ...form, initData, chatId })
      webApp?.showPopup?.({ title: "บันทึกแล้ว", message: "เพิ่มรายการเข้า Harbill แล้ว", buttons: [{ type: "ok" }] })
      webApp?.close?.()
    } catch (err) {
      setError(err.message || "บันทึกไม่สำเร็จ")
    } finally {
      setSaving(false)
    }
  }

  const canSubmit = form.title.trim() && Number(form.amount) > 0 && form.month && form.debtors.length > 0

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-5 text-white">
      <div className="mx-auto max-w-md">
        <div className="mb-5">
          <p className="text-xs font-bold uppercase tracking-wide text-sky-300">Harbill Telegram</p>
          <h1 className="mt-1 text-2xl font-black">เพิ่มรายการ</h1>
          <p className="mt-2 text-sm leading-6 text-slate-300">
            คนสร้างรายการคือคนรับเงิน: {context?.member?.name || "-"}
          </p>
        </div>

        {loading && (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-center text-sm text-slate-300">
            กำลังโหลดข้อมูล...
          </div>
        )}

        {!loading && error && (
          <div className="mb-4 rounded-2xl border border-rose-300/20 bg-rose-400/10 p-4 text-sm font-bold text-rose-100">
            {error}
          </div>
        )}

        {!loading && context && (
          <form onSubmit={submit} className="space-y-4">
            <label className="block">
              <span className="text-xs font-bold text-slate-300">ชื่อรายการ</span>
              <input
                className="mt-2 w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-3 text-sm outline-none focus:border-sky-400"
                value={form.title}
                onChange={e => setForm(value => ({ ...value, title: e.target.value }))}
                placeholder="เช่น ข้าวเย็น"
              />
            </label>

            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="text-xs font-bold text-slate-300">ยอดรวม</span>
                <input
                  type="number"
                  inputMode="decimal"
                  className="mt-2 w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-3 text-sm outline-none focus:border-sky-400"
                  value={form.amount}
                  onChange={e => setForm(value => ({ ...value, amount: e.target.value }))}
                  placeholder="900"
                />
              </label>
              <label className="block">
                <span className="text-xs font-bold text-slate-300">เดือน</span>
                <input
                  type="month"
                  className="mt-2 w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-3 text-sm outline-none focus:border-sky-400"
                  value={form.month}
                  onChange={e => setForm(value => ({ ...value, month: e.target.value }))}
                />
              </label>
            </div>

            <section className="rounded-2xl border border-white/10 bg-white/5 p-3">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-black">คนที่ต้องจ่ายคืน</p>
                  <p className="mt-1 text-xs text-slate-400">เลือกสมาชิกกลุ่มที่เชื่อมบัญชีแล้ว</p>
                </div>
                <span className="rounded-full bg-sky-400/15 px-2.5 py-1 text-xs font-black text-sky-100">
                  {form.debtors.length}
                </span>
              </div>

              <div className="grid gap-2">
                {friends.map(friend => {
                  const checked = form.debtors.includes(friend.name)
                  return (
                    <button
                      key={friend.id || friend.name}
                      type="button"
                      onClick={() => toggleDebtor(friend.name)}
                      className={`flex items-center justify-between rounded-xl border px-3 py-3 text-left text-sm font-bold ${
                        checked
                          ? "border-sky-300 bg-sky-400/15 text-sky-50"
                          : "border-white/10 bg-slate-950 text-slate-200"
                      }`}
                    >
                      <span>{friend.name}</span>
                      <span className={`h-5 w-5 rounded-md border ${checked ? "border-sky-200 bg-sky-300" : "border-white/20"}`} />
                    </button>
                  )
                })}
                {friends.length === 0 && (
                  <p className="rounded-xl border border-white/10 bg-slate-950 p-3 text-sm text-slate-400">
                    ยังไม่มีสมาชิกที่เลือกได้ ให้สมาชิกส่งคำสั่ง /connect ในกลุ่มก่อน
                  </p>
                )}
              </div>
            </section>

            <label className="block">
              <span className="text-xs font-bold text-slate-300">หมายเหตุ</span>
              <input
                className="mt-2 w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-3 text-sm outline-none focus:border-sky-400"
                value={form.note}
                onChange={e => setForm(value => ({ ...value, note: e.target.value }))}
                placeholder="ไม่บังคับ"
              />
            </label>

            <button
              type="submit"
              disabled={!canSubmit || saving}
              className="w-full rounded-xl bg-sky-500 px-4 py-3 text-sm font-black text-white disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
            >
              {saving ? "กำลังบันทึก..." : "บันทึกรายการ"}
            </button>
          </form>
        )}
      </div>
    </main>
  )
}
