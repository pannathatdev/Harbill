import { useEffect, useMemo, useState } from "react"
import { api } from "../api"

const STORAGE_KEY = "harbill:dues:v1"

const copy = {
  th: {
    title: "ยอดค้าง",
    subtitle: "บันทึกรายการค้างจ่ายรายคน ตรวจสถานะการชำระ และเก็บหลักฐานสลิปไว้ดูย้อนหลัง",
    source: "ข้อมูลมาจากรายการที่คุณบันทึกในหน้านี้ และเก็บไว้ในเครื่องนี้ชั่วคราว ก่อนต่อเข้าฐานข้อมูลจริง",
    dbSource: "ข้อมูลนี้โหลดจากฐานข้อมูลของบัญชีคุณ",
    person: "ชื่อผู้ค้าง",
    item: "รายการ",
    amount: "ยอดเงิน",
    note: "หมายเหตุ",
    save: "เพิ่มรายการ",
    all: "ทั้งหมด",
    unpaid: "ยังไม่จ่าย",
    paid: "จ่ายแล้ว",
    pending: "รอตรวจ",
    search: "ค้นหาชื่อ รายการ หรือหมายเหตุ...",
    total: "ยอดทั้งหมด",
    outstanding: "ยอดค้าง",
    settled: "รับแล้ว",
    people: "จำนวนคน",
    byPerson: "รายการแยกตามคน",
    sendLink: "ส่งลิงก์ชำระ",
    copyText: "คัดลอกยอดค้าง",
    markPaid: "รับเงินแล้ว",
    markUnpaid: "กลับเป็นค้าง",
    uploadSlip: "แนบสลิป",
    viewSlip: "ดูสลิป",
    noItems: "ยังไม่มีรายการในเดือนนี้",
    emptyHint: "เพิ่มชื่อ รายการ และยอดเงินด้านบน เพื่อเริ่มติดตามยอดค้าง",
    copied: "คัดลอกข้อความแล้ว",
    linkReady: "ลิงก์ชำระเงิน",
    slipAttached: "แนบสลิปแล้ว",
    close: "ปิด",
    copyLink: "คัดลอกลิงก์",
    linkHelp: "ลิงก์นี้เป็นตัวอย่างหน้าชำระเงิน ขั้นถัดไปต้องต่อ route /pay และฐานข้อมูลจริง",
    dataNote: "Prototype นี้ยังไม่อัปโหลดไฟล์ขึ้น server สลิปจะแสดงได้ใน session ปัจจุบันเท่านั้น",
    loading: "กำลังโหลดข้อมูลยอดค้าง...",
  },
  en: {
    title: "Dues",
    subtitle: "Record per-person balances, review payment status, and keep slip evidence visible.",
    source: "Data comes from items saved on this page and is stored locally for now before connecting to the database.",
    dbSource: "This data is loaded from your account database.",
    person: "Person",
    item: "Item",
    amount: "Amount",
    note: "Note",
    save: "Add item",
    all: "All",
    unpaid: "Unpaid",
    paid: "Paid",
    pending: "Review",
    search: "Search person, item, or note...",
    total: "Total",
    outstanding: "Outstanding",
    settled: "Received",
    people: "People",
    byPerson: "By person",
    sendLink: "Payment link",
    copyText: "Copy dues",
    markPaid: "Mark paid",
    markUnpaid: "Mark unpaid",
    uploadSlip: "Attach slip",
    viewSlip: "View slip",
    noItems: "No items for this month",
    emptyHint: "Add a person, item, and amount above to start tracking dues.",
    copied: "Copied",
    linkReady: "Payment link",
    slipAttached: "Slip attached",
    close: "Close",
    copyLink: "Copy link",
    linkHelp: "This is a payment-page preview. The next step is wiring /pay and the real database.",
    dataNote: "This prototype does not upload files yet. Slip previews are available only in the current session.",
    loading: "Loading dues...",
  },
}

function formatMoney(value) {
  return Number(value || 0).toLocaleString("th-TH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

function statusClass(status, darkMode) {
  if (status === "paid") return darkMode ? "bg-emerald-400/10 text-emerald-200" : "bg-emerald-50 text-emerald-700"
  if (status === "pending") return darkMode ? "bg-amber-400/10 text-amber-200" : "bg-amber-50 text-amber-700"
  return darkMode ? "bg-rose-400/10 text-rose-200" : "bg-rose-50 text-rose-700"
}

function readStoredItems() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export default function DuesPage({ lang = "th", darkMode = true }) {
  const [items, setItems] = useState(readStoredItems)
  const [status, setStatus] = useState("all")
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7))
  const [query, setQuery] = useState("")
  const [form, setForm] = useState({ person: "", title: "", amount: "", note: "" })
  const [notice, setNotice] = useState("")
  const [linkModal, setLinkModal] = useState(null)
  const [slipModal, setSlipModal] = useState(null)
  const [loading, setLoading] = useState(true)
  const [usingDatabase, setUsingDatabase] = useState(false)
  const t = copy[lang] || copy.th

  useEffect(() => {
    if (usingDatabase) return
    const serializable = items.map(({ slipUrl, ...item }) => item)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(serializable))
  }, [items, usingDatabase])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    api.getDues({ month })
      .then(rows => {
        if (cancelled) return
        setItems(rows)
        setUsingDatabase(true)
      })
      .catch(() => {
        if (!cancelled) setUsingDatabase(false)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [month])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return items
      .filter(item => item.month === month)
      .filter(item => status === "all" || item.status === status)
      .filter(item => !q || `${item.person} ${item.title} ${item.note || ""}`.toLowerCase().includes(q))
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

  function showNotice(message) {
    setNotice(message)
    window.setTimeout(() => setNotice(""), 1800)
  }

  async function copyToClipboard(text, message = t.copied) {
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      const textarea = document.createElement("textarea")
      textarea.value = text
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand("copy")
      document.body.removeChild(textarea)
    }
    showNotice(message)
  }

  function addItem() {
    const person = form.person.trim()
    const title = form.title.trim()
    const amount = parseFloat(form.amount)
    if (!person || !title || Number.isNaN(amount)) return

    const draft = {
      id: window.crypto?.randomUUID?.() || String(Date.now()),
      person,
      title,
      amount,
      month,
      status: "unpaid",
      note: form.note.trim(),
      createdAt: new Date().toISOString(),
    }

    if (usingDatabase) {
      api.addDue(draft)
        .then(saved => setItems(prev => [saved, ...prev]))
        .catch(() => {
          setUsingDatabase(false)
          setItems(prev => [draft, ...prev])
        })
    } else {
      setItems(prev => [draft, ...prev])
    }
    setForm({ person: "", title: "", amount: "", note: "" })
  }

  function setItemStatus(id, nextStatus) {
    const optimistic = item => item.id === id ? { ...item, status: nextStatus, paidAt: nextStatus === "paid" ? new Date().toISOString() : null } : item
    setItems(prev => prev.map(optimistic))
    if (usingDatabase) {
      api.updateDue(id, { status: nextStatus })
        .then(saved => setItems(prev => prev.map(item => item.id === id ? { ...item, ...saved } : item)))
        .catch(() => showNotice("บันทึกสถานะไม่สำเร็จ"))
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
      const lines = dues.map(item => `- ${item.title}: ฿${formatMoney(item.amount)}${item.note ? ` (${item.note})` : ""}`).join("\n")
      return `${name}\n${t.outstanding}: ฿${formatMoney(total)}\n${lines}`
    }).join("\n\n")
  }

  function copyAllDues() {
    copyToClipboard(buildDuesText() || t.noItems)
  }

  function openPaymentLink(person) {
    const personItems = items.filter(item => item.month === month && item.person === person && item.status !== "paid")
    const total = personItems.reduce((sum, item) => sum + item.amount, 0)
    const token = btoa(encodeURIComponent(`${person}:${month}`)).replace(/=+$/g, "")
    setLinkModal({
      person,
      total,
      url: `${window.location.origin}/pay/${token}?name=${encodeURIComponent(person)}`,
      text: buildDuesText(person),
    })
  }

  function attachSlip(id, file) {
    if (!file) return
    const slipUrl = URL.createObjectURL(file)
    const applySlip = saved => setItems(prev => prev.map(item => item.id === id ? {
      ...item,
      ...saved,
      status: "pending",
      slipName: file.name,
      slipType: file.type || "file",
      slipUrl,
      note: item.note || t.slipAttached,
    } : item))
    if (usingDatabase) {
      api.attachDueSlip(id, file)
        .then(saved => applySlip(saved))
        .catch(() => applySlip({}))
    } else {
      applySlip({})
    }
    showNotice(t.slipAttached)
  }

  const page = darkMode ? "bg-[#0f172a] text-slate-100" : "bg-[#f5f7fb] text-slate-950"
  const panel = darkMode ? "border-slate-700 bg-slate-900" : "border-slate-200 bg-white"
  const softPanel = darkMode ? "border-slate-800 bg-slate-950/60" : "border-slate-100 bg-slate-50"
  const muted = darkMode ? "text-slate-400" : "text-slate-500"
  const input = darkMode
    ? "border-slate-700 bg-slate-950 text-slate-100 placeholder:text-slate-600 focus:border-sky-500"
    : "border-slate-200 bg-white text-slate-950 placeholder:text-slate-400 focus:border-sky-500"
  const outlineButton = darkMode
    ? "border-slate-700 text-slate-300 hover:border-sky-500 hover:text-sky-200"
    : "border-slate-200 text-slate-600 hover:border-sky-300 hover:text-sky-700"

  return (
    <main className={`-mx-4 -my-5 min-h-screen px-4 py-5 ${page}`}>
      <div className="mx-auto max-w-5xl space-y-5">
        <section className={`rounded-2xl border p-4 shadow-sm ${panel}`}>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className={`text-xs font-semibold uppercase ${muted}`}>Harbill Collect</p>
              <h1 className="mt-1 text-2xl font-black tracking-normal">{t.title}</h1>
              <p className={`mt-2 max-w-2xl text-sm leading-6 ${muted}`}>{t.subtitle}</p>
              <p className={`mt-3 rounded-xl border px-3 py-2 text-xs leading-5 ${softPanel} ${muted}`}>{usingDatabase ? t.dbSource : t.source}</p>
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
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-black">{t.byPerson}</h2>
            <button onClick={copyAllDues} className={`rounded-xl border px-3 py-2 text-xs font-semibold ${outlineButton}`}>
              {t.copyText}
            </button>
          </div>

          {loading && (
            <div className={`rounded-2xl border p-8 text-center ${panel}`}>
              <span className="mx-auto block h-6 w-6 animate-spin rounded-full border-2 border-sky-500 border-t-transparent" />
              <p className={`mt-3 text-sm font-bold ${muted}`}>{t.loading}</p>
            </div>
          )}

          {!loading && Object.keys(grouped).length === 0 && (
            <div className={`rounded-2xl border p-8 text-center ${panel}`}>
              <p className="text-sm font-bold">{t.noItems}</p>
              <p className={`mt-2 text-xs ${muted}`}>{t.emptyHint}</p>
            </div>
          )}

          {!loading && Object.entries(grouped).map(([person, personItems]) => {
            const outstanding = personItems.filter(item => item.status !== "paid").reduce((sum, item) => sum + item.amount, 0)
            return (
              <article key={person} className={`overflow-hidden rounded-2xl border shadow-sm ${panel}`}>
                <div className={`flex flex-col gap-3 border-b px-4 py-3 sm:flex-row sm:items-center sm:justify-between ${darkMode ? "border-slate-700" : "border-slate-100"}`}>
                  <div>
                    <p className="text-base font-black">{person}</p>
                    <p className={`mt-1 text-xs ${muted}`}>{t.outstanding} ฿{formatMoney(outstanding)}</p>
                  </div>
                  <button onClick={() => openPaymentLink(person)} className="rounded-xl bg-slate-900 px-3 py-2 text-xs font-bold text-white hover:bg-slate-700">
                    {t.sendLink}
                  </button>
                </div>
                <div className={`divide-y ${darkMode ? "divide-slate-800" : "divide-slate-100"}`}>
                  {personItems.map(item => (
                    <div key={item.id} className="grid gap-3 px-4 py-3 lg:grid-cols-[1fr_auto_auto] lg:items-center">
                      <div>
                        <p className="text-sm font-semibold">{item.title}</p>
                        {(item.note || item.slipName) && <p className={`mt-1 text-xs ${muted}`}>{item.slipName || item.note}</p>}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-black">฿{formatMoney(item.amount)}</span>
                        <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${statusClass(item.status, darkMode)}`}>
                          {t[item.status]}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-2 lg:justify-end">
                        <button
                          onClick={() => setItemStatus(item.id, item.status === "paid" ? "unpaid" : "paid")}
                          className={`rounded-xl border px-3 py-2 text-xs font-semibold ${outlineButton}`}
                        >
                          {item.status === "paid" ? t.markUnpaid : t.markPaid}
                        </button>
                        {item.slipUrl && (
                          <button onClick={() => setSlipModal(item)} className={`rounded-xl border px-3 py-2 text-xs font-semibold ${outlineButton}`}>
                            {t.viewSlip}
                          </button>
                        )}
                        <label className={`cursor-pointer rounded-xl border px-3 py-2 text-xs font-semibold ${outlineButton}`}>
                          {t.uploadSlip}
                          <input type="file" accept="image/*,.pdf" className="hidden" onChange={e => attachSlip(item.id, e.target.files?.[0])} />
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

      {linkModal && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/60 px-4">
          <div className={`w-full max-w-lg rounded-2xl border p-5 shadow-2xl ${panel}`}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className={`text-xs font-bold uppercase ${muted}`}>{t.linkReady}</p>
                <h3 className="mt-1 text-xl font-black">{linkModal.person}</h3>
                <p className={`mt-1 text-sm ${muted}`}>{t.outstanding} ฿{formatMoney(linkModal.total)}</p>
              </div>
              <button onClick={() => setLinkModal(null)} className={`rounded-xl border px-3 py-2 text-xs font-bold ${outlineButton}`}>{t.close}</button>
            </div>
            <div className={`mt-4 rounded-xl border p-3 text-sm break-all ${softPanel}`}>{linkModal.url}</div>
            <pre className={`mt-3 max-h-44 overflow-auto rounded-xl border p-3 text-xs leading-5 whitespace-pre-wrap ${softPanel}`}>{linkModal.text || t.noItems}</pre>
            <p className={`mt-3 text-xs leading-5 ${muted}`}>{t.linkHelp}</p>
            <button onClick={() => copyToClipboard(linkModal.url, t.copied)} className="mt-4 w-full rounded-xl bg-sky-600 px-4 py-3 text-sm font-bold text-white hover:bg-sky-500">
              {t.copyLink}
            </button>
          </div>
        </div>
      )}

      {slipModal && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/70 px-4">
          <div className={`w-full max-w-2xl rounded-2xl border p-5 shadow-2xl ${panel}`}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-xl font-black">{slipModal.title}</h3>
                <p className={`mt-1 text-sm ${muted}`}>{slipModal.person} • ฿{formatMoney(slipModal.amount)}</p>
              </div>
              <button onClick={() => setSlipModal(null)} className={`rounded-xl border px-3 py-2 text-xs font-bold ${outlineButton}`}>{t.close}</button>
            </div>
            <div className={`mt-4 rounded-2xl border p-3 ${softPanel}`}>
              {String(slipModal.slipType || "").startsWith("image/") ? (
                <img src={slipModal.slipUrl} alt={slipModal.slipName || "slip"} className="max-h-[70vh] w-full rounded-xl object-contain" />
              ) : (
                <a href={slipModal.slipUrl} target="_blank" rel="noreferrer" className="text-sm font-bold text-sky-400 underline">
                  {slipModal.slipName}
                </a>
              )}
            </div>
            <p className={`mt-3 text-xs leading-5 ${muted}`}>{t.dataNote}</p>
          </div>
        </div>
      )}
    </main>
  )
}
