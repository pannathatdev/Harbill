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
    copyPersonText: "คัดลอกยอดคนนี้",
    copyPaymentMessage: "คัดลอกข้อความพร้อมลิงก์",
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
    linkHelp: "ส่งลิงก์นี้ให้คนจ่าย เขาจะเห็น QR ตามยอดจริงและอัปโหลดสลิปกลับเข้าระบบได้",
    dataNote: "สลิปนี้โหลดจากฐานข้อมูลของรายการค้าง และจะยังอยู่ให้ตรวจย้อนหลังหลังรีเฟรชหน้า",
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
    copyPersonText: "Copy this person",
    copyPaymentMessage: "Copy message with link",
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
    linkHelp: "Send this link to the payer. They can scan the exact QR amount and upload the slip back into this record.",
    dataNote: "This slip is loaded from the due record and remains available after refresh.",
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

function CopyIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  )
}

function LinkIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 13a5 5 0 0 0 7.07 0l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.07 0l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  )
}

function UndoIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 14 4 9l5-5" />
      <path d="M4 9h10a6 6 0 0 1 0 12h-4" />
    </svg>
  )
}

function UploadIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 16V4" />
      <path d="m7 9 5-5 5 5" />
      <path d="M20 16v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-4" />
    </svg>
  )
}

function ImageIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="9" cy="9" r="2" />
      <path d="m21 15-3.5-3.5L9 20" />
    </svg>
  )
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

  function buildDuesText(person = null, paymentUrl = "") {
    const rows = filtered.filter(item => item.status !== "paid" && (!person || item.person === person))
    const groupedRows = rows.reduce((map, item) => {
      if (!map[item.person]) map[item.person] = []
      map[item.person].push(item)
      return map
    }, {})

    return Object.entries(groupedRows).map(([name, dues]) => {
      const total = dues.reduce((sum, item) => sum + item.amount, 0)
      const lines = dues.map((item, index) => {
        const note = item.note ? `\n   หมายเหตุ: ${item.note}` : ""
        const statusText = item.status === "pending" ? " (ส่งสลิปแล้ว รอตรวจ)" : ""
        return `${index + 1}. ${item.title}${statusText}\n   ยอดชำระ: ฿${formatMoney(item.amount)}${note}`
      }).join("\n")
      const paymentLine = paymentUrl ? `\n\nลิงก์ชำระ/ส่งสลิป:\n${paymentUrl}` : ""
      return [
        "Harbill - รายการยอดค้าง",
        `ผู้ชำระ: ${name}`,
        `เดือน: ${month}`,
        "",
        "รายการที่ต้องชำระ:",
        lines,
        "",
        `รวมยอดชำระ: ฿${formatMoney(total)}${paymentLine}`,
      ].join("\n")
    }).join("\n\n")
  }

  function copyAllDues() {
    copyToClipboard(buildDuesText() || t.noItems)
  }

  function openPaymentLink(person) {
    const personItems = items.filter(item => item.month === month && item.person === person && item.status !== "paid")
    const total = personItems.reduce((sum, item) => sum + item.amount, 0)
    const fallbackToken = btoa(encodeURIComponent(`${person}:${month}`)).replace(/=+$/g, "")
    const fallback = {
      person,
      total,
      url: `${window.location.origin}/pay/${fallbackToken}?name=${encodeURIComponent(person)}`,
      text: "",
    }
    fallback.text = buildDuesText(person, fallback.url)

    if (!usingDatabase) {
      setLinkModal(fallback)
      return
    }

    api.createDuePayLink({ person, month })
      .then(result => setLinkModal({ ...fallback, url: result.url, text: buildDuesText(person, result.url) }))
      .catch(() => setLinkModal(fallback))
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

  async function openSlipModal(item) {
    if (item.slipUrl?.startsWith("blob:")) {
      setSlipModal(item)
      return
    }

    if (!usingDatabase || !item.slipName) return

    try {
      const blob = await api.getDueSlipBlob(item.id)
      const slipUrl = URL.createObjectURL(blob)
      const next = {
        ...item,
        slipUrl,
        slipType: item.slipType || blob.type || "file",
      }
      setItems(prev => prev.map(row => row.id === item.id ? { ...row, slipUrl, slipType: next.slipType } : row))
      setSlipModal(next)
    } catch (err) {
      showNotice(err.message || "เปิดสลิปไม่ได้")
    }
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
  const iconButton = `inline-flex h-10 w-10 items-center justify-center rounded-xl border transition-colors ${outlineButton}`

  return (
    <main className={`-mx-4 -my-5 min-h-screen px-4 py-5 ${page}`}>
      <div className="mx-auto max-w-4xl space-y-5">
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
            <button
              onClick={copyAllDues}
              title={t.copyText}
              aria-label={t.copyText}
              className={iconButton}
            >
              <CopyIcon />
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
                  <div className="flex gap-2">
                    <button
                      onClick={() => copyToClipboard(buildDuesText(person))}
                      title={t.copyPersonText}
                      aria-label={t.copyPersonText}
                      className={iconButton}
                    >
                      <CopyIcon />
                    </button>
                    <button
                      onClick={() => openPaymentLink(person)}
                      title={t.sendLink}
                      aria-label={t.sendLink}
                      className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-white hover:bg-slate-700"
                    >
                      <LinkIcon />
                    </button>
                  </div>
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
                          title={item.status === "paid" ? t.markUnpaid : t.markPaid}
                          aria-label={item.status === "paid" ? t.markUnpaid : t.markPaid}
                          className={iconButton}
                        >
                          {item.status === "paid" ? <UndoIcon /> : <CheckIcon />}
                        </button>
                        {(item.slipUrl || item.slipName) && (
                          <button
                            onClick={() => openSlipModal(item)}
                            title={t.viewSlip}
                            aria-label={t.viewSlip}
                            className={iconButton}
                          >
                            <ImageIcon />
                          </button>
                        )}
                        <label
                          title={t.uploadSlip}
                          aria-label={t.uploadSlip}
                          className={`cursor-pointer ${iconButton}`}
                        >
                          <UploadIcon />
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
            <button onClick={() => copyToClipboard(linkModal.text || linkModal.url, t.copied)} className="mt-4 w-full rounded-xl bg-sky-600 px-4 py-3 text-sm font-bold text-white hover:bg-sky-500">
              {t.copyPaymentMessage}
            </button>
            <button onClick={() => copyToClipboard(linkModal.url, t.copied)} className={`mt-2 w-full rounded-xl border px-4 py-3 text-sm font-bold ${outlineButton}`}>
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
