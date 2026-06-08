import { useMemo, useState } from "react"

const copy = {
  th: {
    title: "ยอดค้าง",
    subtitle: "บันทึกว่าใครค้างอะไร จ่ายแล้วหรือยัง และสรุปยอดรายเดือนให้เห็นชัด",
    addTitle: "เพิ่มรายการ",
    person: "คนที่ค้าง",
    item: "รายการ",
    amount: "ยอดเงิน",
    month: "เดือน",
    note: "หมายเหตุ",
    save: "บันทึก",
    all: "ทั้งหมด",
    unpaid: "ยังไม่จ่าย",
    paid: "จ่ายแล้ว",
    pending: "รอตรวจ",
    search: "ค้นหาชื่อหรือรายการ...",
    total: "ยอดทั้งหมด",
    outstanding: "ค้างรวม",
    settled: "จ่ายแล้ว",
    people: "คนที่มีรายการ",
    byPerson: "แยกตามคน",
    sendLink: "ส่งลิงก์จ่าย",
    copyText: "คัดลอกยอดค้าง",
    markPaid: "รับเงินแล้ว",
    markUnpaid: "ยังไม่จ่าย",
    uploadSlip: "แนบสลิป",
    copied: "คัดลอกแล้ว",
    linkCopied: "คัดลอกลิงก์แล้ว",
    slipAttached: "แนบสลิปแล้ว",
    noItems: "ไม่พบรายการตามตัวกรอง",
  },
  en: {
    title: "Dues",
    subtitle: "Track who owes what, payment status, and monthly outstanding balances.",
    addTitle: "Add item",
    person: "Person",
    item: "Item",
    amount: "Amount",
    month: "Month",
    note: "Note",
    save: "Save",
    all: "All",
    unpaid: "Unpaid",
    paid: "Paid",
    pending: "Review",
    search: "Search person or item...",
    total: "Total",
    outstanding: "Outstanding",
    settled: "Paid",
    people: "People",
    byPerson: "By person",
    sendLink: "Send pay link",
    copyText: "Copy dues",
    markPaid: "Mark paid",
    markUnpaid: "Mark unpaid",
    uploadSlip: "Attach slip",
    copied: "Copied",
    linkCopied: "Link copied",
    slipAttached: "Slip attached",
    noItems: "No items match the filters",
  },
}

const seedItems = [
  { id: 1, person: "JO", title: "ค่าข้าวกลางวัน", amount: 120, month: "2026-06", status: "unpaid", note: "ร้านตามสั่ง" },
  { id: 2, person: "JO", title: "ค่า Grab", amount: 250, month: "2026-06", status: "pending", note: "ส่งสลิปแล้ว รอตรวจ" },
  { id: 3, person: "JO", title: "ค่าน้ำ", amount: 50, month: "2026-06", status: "paid", note: "จ่าย 8 มิ.ย." },
  { id: 4, person: "Pond", title: "ค่าของขวัญ", amount: 200, month: "2026-06", status: "unpaid", note: "" },
  { id: 5, person: "Pond", title: "ค่าข้าว", amount: 100, month: "2026-06", status: "unpaid", note: "" },
  { id: 6, person: "tea", title: "ค่าเน็ตบ้าน", amount: 480, month: "2026-06", status: "paid", note: "เคลียร์แล้ว" },
]

function formatMoney(value) {
  return Number(value || 0).toLocaleString("th-TH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

function statusStyle(status, darkMode) {
  if (status === "paid") return darkMode ? "bg-emerald-500/12 text-emerald-200" : "bg-emerald-50 text-emerald-700"
  if (status === "pending") return darkMode ? "bg-amber-500/12 text-amber-200" : "bg-amber-50 text-amber-700"
  return darkMode ? "bg-rose-500/12 text-rose-200" : "bg-rose-50 text-rose-700"
}

export default function DuesPage({ lang = "th", darkMode = true }) {
  const [items, setItems] = useState(seedItems)
  const [status, setStatus] = useState("all")
  const [month, setMonth] = useState("2026-06")
  const [query, setQuery] = useState("")
  const [form, setForm] = useState({ person: "", title: "", amount: "", note: "" })
  const [notice, setNotice] = useState("")
  const t = copy[lang]

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return items
      .filter(item => item.month === month)
      .filter(item => status === "all" || item.status === status)
      .filter(item => !q || `${item.person} ${item.title} ${item.note}`.toLowerCase().includes(q))
  }, [items, month, query, status])

  const stats = useMemo(() => {
    const monthItems = items.filter(item => item.month === month)
    const total = monthItems.reduce((sum, item) => sum + item.amount, 0)
    const paid = monthItems.filter(item => item.status === "paid").reduce((sum, item) => sum + item.amount, 0)
    const outstanding = monthItems.filter(item => item.status !== "paid").reduce((sum, item) => sum + item.amount, 0)
    const people = new Set(monthItems.map(item => item.person)).size
    return { total, paid, outstanding, people }
  }, [items, month])

  const grouped = useMemo(() => {
    return filtered.reduce((map, item) => {
      if (!map[item.person]) map[item.person] = []
      map[item.person].push(item)
      return map
    }, {})
  }, [filtered])

  function addItem() {
    const person = form.person.trim()
    const title = form.title.trim()
    const amount = parseFloat(form.amount)
    if (!person || !title || isNaN(amount)) return
    setItems(prev => [
      { id: Date.now(), person, title, amount, month, status: "unpaid", note: form.note.trim() },
      ...prev,
    ])
    setForm({ person: "", title: "", amount: "", note: "" })
  }

  function setItemStatus(id, nextStatus) {
    setItems(prev => prev.map(item => item.id === id ? { ...item, status: nextStatus } : item))
  }

  function showNotice(message) {
    setNotice(message)
    window.setTimeout(() => setNotice(""), 1800)
  }

  async function copyToClipboard(text, message) {
    try {
      await navigator.clipboard.writeText(text)
      showNotice(message)
    } catch {
      const textarea = document.createElement("textarea")
      textarea.value = text
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand("copy")
      document.body.removeChild(textarea)
      showNotice(message)
    }
  }

  function buildDuesText(person = null) {
    const rows = filtered.filter(item => item.status !== "paid" && (!person || item.person === person))
    const groupedRows = rows.reduce((map, item) => {
      if (!map[item.person]) map[item.person] = []
      map[item.person].push(item)
      return map
    }, {})

    return Object.entries(groupedRows).map(([name, dues]) => {
      const total = dues.reduce((sum, item) => sum + item.amount, 0)
      const lines = dues.map(item => `- ${item.title}: ฿${formatMoney(item.amount)}`).join("\n")
      return `${name}\n${t.outstanding}: ฿${formatMoney(total)}\n${lines}`
    }).join("\n\n")
  }

  function copyAllDues() {
    const text = buildDuesText() || t.noItems
    copyToClipboard(text, t.copied)
  }

  function copyPaymentLink(person) {
    const token = btoa(encodeURIComponent(`${person}:${month}`)).replace(/=+$/g, "")
    const url = `${window.location.origin}/pay/${token}?name=${encodeURIComponent(person)}`
    copyToClipboard(url, t.linkCopied)
  }

  function attachSlip(id, file) {
    if (!file) return
    setItems(prev => prev.map(item => item.id === id ? { ...item, status: "pending", note: `${t.slipAttached}: ${file.name}` } : item))
    showNotice(t.slipAttached)
  }

  const page = darkMode ? "bg-[#0f172a] text-slate-100" : "bg-[#f5f7fb] text-slate-950"
  const panel = darkMode ? "border-slate-700 bg-slate-900" : "border-slate-200 bg-white"
  const muted = darkMode ? "text-slate-400" : "text-slate-500"
  const input = darkMode
    ? "border-slate-700 bg-slate-950 text-slate-100 placeholder:text-slate-600 focus:border-sky-500"
    : "border-slate-200 bg-white text-slate-950 placeholder:text-slate-400 focus:border-sky-500"

  return (
    <main className={`-mx-4 -my-5 min-h-screen px-4 py-5 ${page}`}>
      <div className="mx-auto max-w-5xl space-y-5">
        <section className={`rounded-2xl border p-4 shadow-sm ${panel}`}>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className={`text-xs font-semibold uppercase ${muted}`}>Harbill Collect</p>
              <h1 className="mt-1 text-2xl font-black tracking-normal">{t.title}</h1>
              <p className={`mt-2 max-w-2xl text-sm leading-6 ${muted}`}>{t.subtitle}</p>
            </div>
            {notice && (
              <div className={`rounded-xl px-3 py-2 text-xs font-bold ${darkMode ? "bg-sky-500/15 text-sky-200" : "bg-sky-50 text-sky-700"}`}>
                {notice}
              </div>
            )}
          </div>
        </section>

        <section className="grid gap-3 sm:grid-cols-4">
          {[
            [t.outstanding, stats.outstanding, darkMode ? "text-rose-300" : "text-rose-600"],
            [t.settled, stats.paid, darkMode ? "text-emerald-300" : "text-emerald-600"],
            [t.total, stats.total, darkMode ? "text-sky-300" : "text-sky-600"],
            [t.people, stats.people, darkMode ? "text-slate-100" : "text-slate-700"],
          ].map(([label, value, color]) => (
            <div key={label} className={`rounded-2xl border p-4 shadow-sm ${panel}`}>
              <p className={`text-xs font-semibold ${muted}`}>{label}</p>
              <p className={`mt-2 text-xl font-black ${color}`}>{label === t.people ? value : `฿${formatMoney(value)}`}</p>
            </div>
          ))}
        </section>

        <section className={`rounded-2xl border p-4 shadow-sm ${panel}`}>
          <div className="grid gap-3 md:grid-cols-[1fr_1fr_140px_1fr_auto]">
            <input className={`rounded-xl border px-3 py-2 text-sm outline-none ${input}`} placeholder={t.person} value={form.person} onChange={e => setForm(v => ({ ...v, person: e.target.value }))} />
            <input className={`rounded-xl border px-3 py-2 text-sm outline-none ${input}`} placeholder={t.item} value={form.title} onChange={e => setForm(v => ({ ...v, title: e.target.value }))} />
            <input className={`rounded-xl border px-3 py-2 text-sm outline-none ${input}`} placeholder={t.amount} type="number" value={form.amount} onChange={e => setForm(v => ({ ...v, amount: e.target.value }))} />
            <input className={`rounded-xl border px-3 py-2 text-sm outline-none ${input}`} placeholder={t.note} value={form.note} onChange={e => setForm(v => ({ ...v, note: e.target.value }))} onKeyDown={e => e.key === "Enter" && addItem()} />
            <button onClick={addItem} className="rounded-xl bg-sky-600 px-4 py-2 text-sm font-bold text-white hover:bg-sky-500">
              {t.save}
            </button>
          </div>
        </section>

        <section className={`rounded-2xl border p-4 shadow-sm ${panel}`}>
          <div className="grid gap-3 md:grid-cols-[150px_180px_1fr]">
            <input className={`rounded-xl border px-3 py-2 text-sm outline-none ${input}`} type="month" value={month} onChange={e => setMonth(e.target.value)} />
            <select className={`rounded-xl border px-3 py-2 text-sm outline-none ${input}`} value={status} onChange={e => setStatus(e.target.value)}>
              <option value="all">{t.all}</option>
              <option value="unpaid">{t.unpaid}</option>
              <option value="pending">{t.pending}</option>
              <option value="paid">{t.paid}</option>
            </select>
            <input className={`rounded-xl border px-3 py-2 text-sm outline-none ${input}`} placeholder={t.search} value={query} onChange={e => setQuery(e.target.value)} />
          </div>
        </section>

        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-black">{t.byPerson}</h2>
            <button onClick={copyAllDues} className={`rounded-xl border px-3 py-2 text-xs font-semibold ${darkMode ? "border-slate-700 text-slate-300" : "border-slate-200 text-slate-600"}`}>
              {t.copyText}
            </button>
          </div>

          {Object.keys(grouped).length === 0 && (
            <div className={`rounded-2xl border p-8 text-center text-sm ${panel} ${muted}`}>{t.noItems}</div>
          )}

          {Object.entries(grouped).map(([person, personItems]) => {
            const outstanding = personItems.filter(item => item.status !== "paid").reduce((sum, item) => sum + item.amount, 0)
            return (
              <article key={person} className={`overflow-hidden rounded-2xl border shadow-sm ${panel}`}>
                <div className={`flex flex-col gap-3 border-b px-4 py-3 sm:flex-row sm:items-center sm:justify-between ${darkMode ? "border-slate-700" : "border-slate-100"}`}>
                  <div>
                    <p className="text-base font-black">{person}</p>
                    <p className={`mt-1 text-xs ${muted}`}>{t.outstanding} ฿{formatMoney(outstanding)}</p>
                  </div>
                  <button onClick={() => copyPaymentLink(person)} className="rounded-xl bg-slate-900 px-3 py-2 text-xs font-bold text-white hover:bg-slate-700">
                    {t.sendLink}
                  </button>
                </div>
                <div className={`divide-y ${darkMode ? "divide-slate-800" : "divide-slate-100"}`}>
                  {personItems.map(item => (
                    <div key={item.id} className="grid gap-3 px-4 py-3 sm:grid-cols-[1fr_auto_auto] sm:items-center">
                      <div>
                        <p className="text-sm font-semibold">{item.title}</p>
                        {item.note && <p className={`mt-1 text-xs ${muted}`}>{item.note}</p>}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-black">฿{formatMoney(item.amount)}</span>
                        <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${statusStyle(item.status, darkMode)}`}>
                          {t[item.status]}
                        </span>
                      </div>
                      <div className="flex gap-2 sm:justify-end">
                        <button
                          onClick={() => setItemStatus(item.id, item.status === "paid" ? "unpaid" : "paid")}
                          className={`rounded-xl border px-3 py-2 text-xs font-semibold ${darkMode ? "border-slate-700 text-slate-300" : "border-slate-200 text-slate-600"}`}
                        >
                          {item.status === "paid" ? t.markUnpaid : t.markPaid}
                        </button>
                        <label className={`cursor-pointer rounded-xl border px-3 py-2 text-xs font-semibold ${darkMode ? "border-slate-700 text-slate-300" : "border-slate-200 text-slate-600"}`}>
                          {t.uploadSlip}
                          <input
                            type="file"
                            accept="image/*,.pdf"
                            className="hidden"
                            onChange={e => attachSlip(item.id, e.target.files?.[0])}
                          />
                        </label>
                      </div>
                    </div>
                  ))}
                </div>
              </article>
            )
          })}
        </section>
      </div>
    </main>
  )
}
