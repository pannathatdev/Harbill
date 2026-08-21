import { useEffect, useMemo, useState } from "react"
import { api } from "../api"

function currentMonth() {
  return new Date().toISOString().slice(0, 7)
}

function tg() {
  return window.Telegram?.WebApp || null
}

function emptyItem() {
  return { key: `${Date.now()}-${Math.random()}`, title: "", amount: "", debtors: [] }
}

function formatMoney(value) {
  return Number(value || 0).toLocaleString("th-TH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

export default function TelegramAddDuePage() {
  const params = new URLSearchParams(window.location.search)
  const webApp = tg()
  const startParam = webApp?.initDataUnsafe?.start_param || ""
  const paymentToken = startParam.match(/^pay_([a-f0-9]+)$/i)?.[1] || ""
  const chatId = params.get("chat_id") || (paymentToken ? "" : startParam)
  const initData = webApp?.initData || ""
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savingPayment, setSavingPayment] = useState(false)
  const [error, setError] = useState("")
  const [context, setContext] = useState(null)
  const [month, setMonth] = useState(currentMonth())
  const [note, setNote] = useState("")
  const [promptPay, setPromptPay] = useState("")
  const [paymentDisplayName, setPaymentDisplayName] = useState("")
  const [items, setItems] = useState(() => [emptyItem()])

  useEffect(() => {
    webApp?.ready?.()
    webApp?.expand?.()
  }, [webApp])

  useEffect(() => {
    if (!paymentToken) return
    if (!initData) {
      setError("กรุณาเปิดลิงก์ชำระจาก Telegram")
      setLoading(false)
      return
    }
    let cancelled = false
    api.authenticateTelegramWebApp(initData)
      .then(result => {
        if (cancelled) return
        localStorage.setItem("token", result.token)
        localStorage.setItem("user", JSON.stringify(result.user))
        window.location.replace(`/pay/${paymentToken}`)
      })
      .catch(err => {
        if (!cancelled) setError(err.message || "เข้าสู่ระบบด้วย Telegram ไม่สำเร็จ")
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [initData, paymentToken])

  useEffect(() => {
    if (paymentToken) return
    if (!initData || !chatId) {
      setError("เปิดหน้านี้จากปุ่มใน Telegram Group เท่านั้น")
      setLoading(false)
      return
    }

    let cancelled = false
    api.getTelegramWebAppContext({ initData, chatId })
      .then(data => {
        if (!cancelled) {
          setContext(data)
          setPromptPay(data.member?.promptPay || "")
          setPaymentDisplayName(data.member?.paymentDisplayName || data.member?.name || "")
        }
      })
      .catch(err => {
        if (!cancelled) setError(err.message || "เชื่อม Telegram ไม่สำเร็จ")
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [chatId, initData, paymentToken])

  const people = useMemo(() => {
    const currentName = context?.member?.name || ""
    const byName = new Map()
    ;(context?.friends || []).forEach(friend => {
      if (friend.name && friend.name !== currentName) byName.set(friend.name, friend)
    })
    return [...byName.values()]
  }, [context])

  function updateItem(key, changes) {
    setItems(value => value.map(item => item.key === key ? { ...item, ...changes } : item))
  }

  function toggleDebtor(key, name) {
    const item = items.find(row => row.key === key)
    if (!item) return
    updateItem(key, {
      debtors: item.debtors.includes(name)
        ? item.debtors.filter(value => value !== name)
        : [...item.debtors, name]
    })
  }

  async function submit(event) {
    event.preventDefault()
    if (saving) return
    setSaving(true)
    setError("")
    try {
      await api.createTelegramWebAppDue({
        initData,
        chatId,
        month,
        note,
        items: items.map(item => ({
          title: item.title.trim(),
          amount: Number(item.amount),
          debtors: item.debtors.map(name => {
            const person = people.find(value => value.name === name)
            return { name, userId: person?.userId || null }
          })
        }))
      })
      webApp?.HapticFeedback?.notificationOccurred?.("success")
      webApp?.close?.()
    } catch (err) {
      setError(err.message || "บันทึกไม่สำเร็จ")
    } finally {
      setSaving(false)
    }
  }

  async function savePaymentInfo() {
    if (savingPayment) return
    setSavingPayment(true)
    setError("")
    try {
      const result = await api.saveTelegramWebAppPaymentInfo({
        initData,
        chatId,
        promptpay: promptPay,
        displayName: paymentDisplayName
      })
      setPromptPay(result.promptpay)
      setPaymentDisplayName(result.displayName)
      setContext(value => ({
        ...value,
        member: { ...value.member, hasPromptPay: true, promptPay: result.promptpay, paymentDisplayName: result.displayName }
      }))
      webApp?.HapticFeedback?.notificationOccurred?.("success")
    } catch (err) {
      setError(err.message || "บันทึกพร้อมเพย์ไม่สำเร็จ")
    } finally {
      setSavingPayment(false)
    }
  }

  const canSubmit = context?.member?.hasPromptPay && month && items.length > 0 && items.every(item => (
    item.title.trim() && Number(item.amount) > 0 && item.debtors.length > 0
  ))

  return (
    <main className="min-h-screen bg-slate-950 px-3 py-4 text-white">
      <div className="mx-auto max-w-md">
        <header className="mb-4">
          <p className="text-[11px] font-bold uppercase tracking-wide text-sky-300">Harbill Telegram</p>
          <h1 className="mt-1 text-2xl font-black">เพิ่มรายการ</h1>
          <p className="mt-1 text-sm text-slate-300">เจ้าหนี้: {context?.member?.name || "-"}</p>
        </header>

        {loading && <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-center text-sm text-slate-300">กำลังโหลดข้อมูล...</div>}
        {!loading && error && <div className="mb-3 rounded-xl border border-rose-300/20 bg-rose-400/10 p-3 text-sm font-bold text-rose-100">{error}</div>}

        {!loading && context && (
          <form onSubmit={submit} className="space-y-3">
            <section className="rounded-2xl border border-white/10 bg-white/5 p-3">
              <p className="text-sm font-black">รายชื่อคนในรายการ</p>
              <p className="mt-2 text-xs text-slate-400">แสดงเฉพาะสมาชิกที่ยืนยันบัญชี Telegram กับ Harbill แล้ว</p>
            </section>

            <section className={`rounded-2xl border p-3 ${context.member.hasPromptPay ? "border-emerald-300/20 bg-emerald-400/10" : "border-amber-300/20 bg-amber-400/10"}`}>
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-black">พร้อมเพย์รับเงินของคุณ</p>
                <span className={`text-xs font-bold ${context.member.hasPromptPay ? "text-emerald-200" : "text-amber-200"}`}>
                  {context.member.hasPromptPay ? "บันทึกแล้ว" : "ต้องตั้งค่าก่อน"}
                </span>
              </div>
              <div className="mt-3 grid gap-2">
                <input
                  value={paymentDisplayName}
                  onChange={event => setPaymentDisplayName(event.target.value)}
                  className="rounded-xl border border-white/10 bg-slate-900 px-3 py-2.5 text-sm outline-none focus:border-sky-400"
                  placeholder="ชื่อบัญชีรับเงิน"
                />
                <input
                  value={promptPay}
                  onChange={event => setPromptPay(event.target.value)}
                  inputMode="numeric"
                  className="rounded-xl border border-white/10 bg-slate-900 px-3 py-2.5 text-sm outline-none focus:border-sky-400"
                  placeholder="เบอร์โทร 10 หลัก หรือเลขประจำตัว 13 หลัก"
                />
                <button
                  type="button"
                  onClick={savePaymentInfo}
                  disabled={savingPayment || !paymentDisplayName.trim() || !promptPay.trim()}
                  className="rounded-xl bg-emerald-600 px-3 py-2.5 text-sm font-black disabled:bg-slate-700 disabled:text-slate-400"
                >
                  {savingPayment ? "กำลังบันทึก..." : context.member.hasPromptPay ? "อัปเดตพร้อมเพย์" : "บันทึกพร้อมเพย์"}
                </button>
              </div>
            </section>

            {items.map((item, index) => (
              <section key={item.key} className="rounded-2xl border border-white/10 bg-white/5 p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-black">รายการที่ {index + 1}</p>
                  {items.length > 1 && (
                    <button type="button" onClick={() => setItems(value => value.filter(row => row.key !== item.key))} className="text-xs font-bold text-rose-300">ลบ</button>
                  )}
                </div>
                <div className="mt-3 grid grid-cols-[1fr_110px] gap-2">
                  <input
                    value={item.title}
                    onChange={event => updateItem(item.key, { title: event.target.value })}
                    className="min-w-0 rounded-xl border border-white/10 bg-slate-900 px-3 py-2.5 text-sm outline-none focus:border-sky-400"
                    placeholder="ชื่อรายการ"
                  />
                  <input
                    type="number"
                    inputMode="decimal"
                    value={item.amount}
                    onChange={event => updateItem(item.key, { amount: event.target.value })}
                    className="min-w-0 rounded-xl border border-white/10 bg-slate-900 px-3 py-2.5 text-sm outline-none focus:border-sky-400"
                    placeholder="ยอดรวม"
                  />
                </div>
                <p className="mt-2 text-[11px] font-semibold leading-5 text-slate-400">
                  ช่องจำนวนเงินคือ <span className="text-sky-200">ยอดรวมของรายการ</span> ระบบจะหารเท่ากันให้คนที่เลือก ไม่ใช่ยอดต่อคน
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {people.map(person => {
                    const selected = item.debtors.includes(person.name)
                    return (
                      <button
                        key={person.name}
                        type="button"
                        onClick={() => toggleDebtor(item.key, person.name)}
                        className={`rounded-full border px-3 py-1.5 text-xs font-bold ${selected ? "border-sky-300 bg-sky-400/20 text-sky-100" : "border-white/10 bg-slate-900 text-slate-300"}`}
                      >
                        {selected ? "✓ " : ""}{person.name}{person.linked ? "" : " · ยังไม่เชื่อม"}
                      </button>
                    )
                  })}
                  {people.length === 0 && <p className="text-xs text-slate-400">เพิ่มชื่อด้านบนก่อน</p>}
                </div>
                {item.debtors.length > 0 && Number(item.amount) > 0 && (
                  <div className="mt-3 rounded-xl border border-sky-300/20 bg-sky-400/10 px-3 py-2.5 text-xs leading-5 text-sky-100">
                    <p className="font-black">สรุปก่อนบันทึก</p>
                    <p>
                      ยอดรวม ฿{formatMoney(item.amount)} ÷ {item.debtors.length} คน
                      {item.debtors.length === 1
                        ? ` = ฿${formatMoney(item.amount)} สำหรับคนที่เลือก`
                        : ` ≈ คนละ ฿${formatMoney(Number(item.amount) / item.debtors.length)}`}
                    </p>
                    <p className="text-sky-200/75">ผู้จ่าย: {item.debtors.join(", ")}</p>
                  </div>
                )}
              </section>
            ))}

            <button type="button" onClick={() => setItems(value => [...value, emptyItem()])} className="w-full rounded-xl border border-dashed border-sky-400/40 px-4 py-2.5 text-sm font-bold text-sky-200">＋ เพิ่มอีกรายการ</button>

            <section className="grid grid-cols-2 gap-2">
              <label className="block">
                <span className="text-xs font-bold text-slate-300">เดือน</span>
                <input type="month" value={month} onChange={event => setMonth(event.target.value)} className="mt-1 w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-2.5 text-sm outline-none" />
              </label>
              <label className="block">
                <span className="text-xs font-bold text-slate-300">หมายเหตุ</span>
                <input value={note} onChange={event => setNote(event.target.value)} className="mt-1 w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-2.5 text-sm outline-none" placeholder="ไม่บังคับ" />
              </label>
            </section>

            <button type="submit" disabled={!canSubmit || saving} className="w-full rounded-xl bg-sky-500 px-4 py-3 text-sm font-black text-white disabled:bg-slate-700 disabled:text-slate-400">
              {saving ? "กำลังบันทึก..." : `บันทึก ${items.length} รายการ`}
            </button>
          </form>
        )}
      </div>
    </main>
  )
}
