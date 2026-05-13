import { useState, useEffect } from "react"
import { api } from "../api"
import html2canvas from "html2canvas"
import { useRef } from "react"
import QRCode from "qrcode"

const SUMMARY_TEMPLATES = [
    { id: "pay", label: "พร้อมจ่าย" },
    { id: "short", label: "สั้น" },
    { id: "detail", label: "ละเอียด" },
    { id: "check", label: "ตรวจบิล" },
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
        tlv("54", Number(amount).toFixed(2)),
        tlv("58", "TH"),
        tlv("59", "HARBILL"),
        tlv("60", "BANGKOK"),
    ].join("")
    const withoutCrc = `${parts}6304`
    return `${withoutCrc}${crc16Ccitt(withoutCrc)}`
}

export default function RoundPage({ user, initialRound, onRoundConsumed }) {
    const [step, setStep] = useState("setup")
    const [friends, setFriends] = useState([])
    const [groups, setGroups] = useState([])
    const [roundName, setRoundName] = useState("")
    const [selected, setSelected] = useState([])
    const [round, setRound] = useState(null)
    const [items, setItems] = useState([])
    const [manualName, setManualName] = useState("")
    const [manualPrice, setManualPrice] = useState("")
    const [scannedItems, setScannedItems] = useState([])
    const [scanning, setScanning] = useState(false)
    const [scanError, setScanError] = useState("")
    const [editingItemId, setEditingItemId] = useState(null)
    const [editingName, setEditingName] = useState("")
    const [editingPrice, setEditingPrice] = useState("")
    const [receiptTotal, setReceiptTotal] = useState("")
    const [discountAmount, setDiscountAmount] = useState("")
    const [discountMode, setDiscountMode] = useState("equal")
    const [ownerPromptpay, setOwnerPromptpay] = useState("")
    const [showPromptpayForm, setShowPromptpayForm] = useState(false)
    const [summaryTemplate, setSummaryTemplate] = useState("pay")
    const [qrCodes, setQrCodes] = useState({})
    const [copied, setCopied] = useState(false)
    const summaryRef = useRef(null)
    const [paymentInfo, setPaymentInfo] = useState({})

    // เพิ่มเพื่อนใหม่ inline
    const [newFriendInput, setNewFriendInput] = useState("")
    const [showAddFriend, setShowAddFriend] = useState(false)

    useEffect(() => { loadFriends() }, [])

    useEffect(() => { loadPaymentInfo() }, [])

    async function loadPaymentInfo() {
        const p = await api.getPaymentInfo()
        const pm = {}
        p.forEach(item => {
            pm[item.friend_name] = item
        })
        setPaymentInfo(pm)
        const ownerName = user?.name || "เจ้าของบิล"
        setOwnerPromptpay(pm[ownerName]?.promptpay || "")
    }

    // รับ round จาก history page
    useEffect(() => {
        if (initialRound) {
            setRound(initialRound)
            setSelected(initialRound.joiners || [])
            setItems(initialRound.items || [])
            setStep("items")
            onRoundConsumed()
        }
    }, [initialRound])

    async function loadFriends() {
        const [f, g] = await Promise.all([api.getFriends(), api.getGroups()])
        setFriends(f)
        setGroups(g)
    }

    async function shareAsImage() {
        if (!summaryRef.current) return
        const canvas = await html2canvas(summaryRef.current, {
            backgroundColor: "#13131f",
            scale: 2,
        })
        const blob = await new Promise(r => canvas.toBlob(r, "image/png"))

        // ถ้า browser รองรับ Web Share API (มือถือ)
        if (navigator.share && navigator.canShare({ files: [new File([blob], "summary.png", { type: "image/png" })] })) {
            await navigator.share({
                files: [new File([blob], "summary.png", { type: "image/png" })],
                title: round.name,
            })
        } else {
            // fallback — ดาวน์โหลดรูป
            const url = URL.createObjectURL(blob)
            const a = document.createElement("a")
            a.href = url
            a.download = `${round.name}-summary.png`
            a.click()
            URL.revokeObjectURL(url)
        }
    }

    function togglePerson(name) {
        setSelected(prev =>
            prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name]
        )
    }

    function loadGroup(group) {
        const names = group.members.filter(n => !selected.includes(n))
        setSelected(prev => [...prev, ...names])
    }

    async function startRound() {
        if (selected.length === 0) return alert("เลือกคนร่วมรอบก่อนนะครับ")
        const r = await api.createRound(roundName || "รอบใหม่", selected)
        setRound(r)
        setItems([])
        setReceiptTotal("")
        setDiscountAmount("")
        setShowPromptpayForm(false)
        setStep("items")
    }

    async function handleScan(e) {
        const file = e.target.files[0]
        if (!file) return
        setScanning(true)
        setScanError("")
        try {
            const { items: scanned, error } = await api.scanReceipt(file)
            if (error) throw new Error(error)
            setScannedItems(scanned.map(item => ({
                name: item.name || "",
                price: item.price || 0
            })))
        } catch {
            setScanError("อ่านไม่ได้ครับ ลองรูปที่ชัดกว่านี้")
        }
        setScanning(false)
        e.target.value = ""
    }

    function updateScannedItem(index, field, value) {
      setScannedItems(prev => prev.map((item, i) => i === index ? { ...item, [field]: value } : item))
    }

    async function addScannedItem(index) {
      const item = scannedItems[index]
      const name = item.name.trim()
      const price = parseFloat(item.price)
      if (!name || isNaN(price)) return
      await addItemToRound(name, price, selected)
      setScannedItems(prev => prev.filter((_, i) => i !== index))
    }

    async function addAllScannedItems() {
      for (const item of scannedItems) {
        const name = item.name.trim()
        const price = parseFloat(item.price)
        if (!name || isNaN(price)) continue
        await addItemToRound(name, price, selected)
      }
      setScannedItems([])
    }

    function removeScannedItem(index) {
      setScannedItems(prev => prev.filter((_, i) => i !== index))
    }

    async function addItemToRound(name, price, splitWith) {
        const item = await api.addItem(round.id, name, price, splitWith)
        setItems(prev => [...prev, item])
    }

    async function addManual() {
        const name = manualName.trim()
        const price = parseFloat(manualPrice)
        if (!name || isNaN(price)) return
        await addItemToRound(name, price, selected)
        setManualName("")
        setManualPrice("")
    }

    async function toggleSplit(itemId, name) {
        const item = items.find(i => i.id === itemId)
        const current = item.splitWith || []
        const updated = current.includes(name)
            ? current.filter(n => n !== name)
            : [...current, name]
        await api.updateSplits(itemId, updated)
        setItems(prev => prev.map(i => i.id === itemId ? { ...i, splitWith: updated } : i))
    }

    async function setItemSplit(itemId, splitWith) {
        await api.updateSplits(itemId, splitWith)
        setItems(prev => prev.map(i => i.id === itemId ? { ...i, splitWith } : i))
    }

    async function copySplitFromPrevious(index) {
        if (index === 0) return
        const previous = items[index - 1]
        const current = items[index]
        await setItemSplit(current.id, previous.splitWith || [])
    }

    function startEditItem(item) {
        setEditingItemId(item.id)
        setEditingName(item.name)
        setEditingPrice(String(item.price))
    }

    function cancelEditItem() {
        setEditingItemId(null)
        setEditingName("")
        setEditingPrice("")
    }

    async function saveEditItem() {
        const name = editingName.trim()
        const price = parseFloat(editingPrice)
        if (!editingItemId || !name || isNaN(price)) return

        try {
            const updated = await api.updateItem(editingItemId, name, price)
            setItems(prev => prev.map(item =>
                item.id === editingItemId ? { ...item, name: updated.name, price: updated.price } : item
            ))
            cancelEditItem()
        } catch (err) {
            alert(err.message || "บันทึกรายการไม่สำเร็จ")
        }
    }

    async function deleteItem(itemId) {
        await api.deleteItem(itemId)
        setItems(prev => prev.filter(i => i.id !== itemId))
        if (editingItemId === itemId) cancelEditItem()
    }

    async function saveOwnerPromptpay() {
        const ownerName = user?.name || "เจ้าของบิล"
        const promptpay = ownerPromptpay.trim()
        const existing = paymentInfo[ownerName] || {}
        await api.savePaymentInfo({
            friend_name: ownerName,
            bank_name: existing.bank_name || "พร้อมเพย์อย่างเดียว",
            account_number: existing.account_number || "",
            promptpay,
            display_name: existing.display_name || ownerName
        })
        await loadPaymentInfo()
        setShowPromptpayForm(false)
    }

    // เพิ่มเพื่อนใหม่ inline แล้วเพิ่มเข้ารอบเลย
    async function addFriendInline() {
        const name = newFriendInput.trim()
        if (!name) return
        await api.addFriend(name)
        await loadFriends()
        // เพิ่มเข้า selected และ round_members
        setSelected(prev => [...prev, name])
        if (round) {
            await api.addRoundMember(round.id, name)
            setRound(prev => ({ ...prev, joiners: [...prev.joiners, name] }))
        }
        setNewFriendInput("")
        setShowAddFriend(false)
    }

    async function finishRound() {
        await api.closeRound(round.id)
        setStep("summary")
    }

    function resetRound() {
        setStep("setup")
        setRound(null)
        setItems([])
        setSelected([])
        setRoundName("")
        setReceiptTotal("")
        setDiscountAmount("")
        setShowPromptpayForm(false)
    }

function calcRawTotals() {
  const totals = {}
  selected.forEach(n => totals[n] = 0)

  items.forEach(item => {
    const sp = item.splitWith || []
    if (sp.length === 0) return
    const share = item.price / sp.length  // หารตามจริง ไม่ปัดเศษ
    sp.forEach(n => {
      if (totals[n] !== undefined) totals[n] += share
    })
  })

  return totals
}

function calcDiscounts(rawTotals) {
  const discounts = {}
  selected.forEach(n => discounts[n] = 0)

  const discount = Math.max(0, parseFloat(discountAmount) || 0)
  if (discount <= 0 || selected.length === 0) return discounts

  if (discountMode === "weighted") {
    const rawTotal = selected.reduce((sum, name) => sum + (rawTotals[name] || 0), 0)
    if (rawTotal <= 0) return discounts
    selected.forEach(name => {
      discounts[name] = Math.min(rawTotals[name] || 0, discount * ((rawTotals[name] || 0) / rawTotal))
    })
    return discounts
  }

  const perPerson = discount / selected.length
  selected.forEach(name => {
    discounts[name] = Math.min(rawTotals[name] || 0, perPerson)
  })
  return discounts
}

function calcTotals() {
  const rawTotals = calcRawTotals()
  const discounts = calcDiscounts(rawTotals)
  const totals = {}

  selected.forEach(name => {
    totals[name] = Math.ceil(Math.max(0, (rawTotals[name] || 0) - (discounts[name] || 0)) * 100) / 100
  })

  return totals
}

function buildPaymentBlock(ownerName, ownerPayment) {
  if (!ownerPayment?.promptpay) return ""
  return [
    `*** โอนเข้า ${ownerName} ***`,
    `พร้อมเพย์: ${ownerPayment.promptpay}`,
    `${"─".repeat(28)}`,
    "",
  ].join("\n")
}

    // สร้างข้อความสำเร็จรูปพร้อมส่งแชท
function buildSummaryText() {
  const rawTotals = calcRawTotals()
  const discounts = calcDiscounts(rawTotals)
  const totals = calcTotals()
  const grandTotal = items.reduce((s, i) => s + i.price, 0)
  const discount = Math.max(0, parseFloat(discountAmount) || 0)
  const collectTotal = selected.reduce((sum, name) => sum + (totals[name] || 0), 0)
  const ownerName = user?.name || "เจ้าของบิล"
  const ownerPayment = paymentInfo[ownerName]
  const date = new Date().toLocaleDateString("th-TH", {
    year: "numeric", month: "long", day: "numeric"
  })

  const paymentBlock = buildPaymentBlock(ownerName, ownerPayment)
  const unpaidItems = items.filter(item => (item.splitWith || []).length === 0)
  let text = `🍽️ ${round.name} — ${date}\n`

  if (summaryTemplate === "pay") {
    text += `${"─".repeat(28)}\n`
    text += `รวม ฿${grandTotal.toFixed(2)}\n\n`
    if (discount > 0) {
      text += `ส่วนลดรวม ฿${discount.toFixed(2)} (${discountMode === "weighted" ? "ตามสัดส่วนยอดเดิม" : "เฉลี่ยเท่ากัน"})\n`
      text += `ยอดหลังหักที่ต้องเก็บรวม ฿${collectTotal.toFixed(2)}\n\n`
    }
    text += paymentBlock
    text += `💰 ยอดที่ต้องโอน\n`
    selected.forEach(name => {
      const amount = totals[name] || 0
      text += `• ${name}  ฿${amount.toFixed(2)}\n`
    })
    if (discount > 0) text += `\n*ยอดนี้หักส่วนลดรวม ฿${discount.toFixed(2)} แล้ว\n`
    if (ownerPayment?.promptpay) text += `\nสแกน QR ได้จากรูปสรุป หรือโอนด้วยพร้อมเพย์ด้านบน\n`
    return text
  }

  if (summaryTemplate === "short") {
    text += `${"─".repeat(28)}\n`
    selected.forEach(name => {
      const amount = totals[name] || 0
      text += `• ${name}  ฿${amount.toFixed(2)}\n`
    })
    text += discount > 0
      ? `รวมหลังหัก ฿${collectTotal.toFixed(2)}\n\n`
      : `รวม ฿${grandTotal.toFixed(2)}\n\n`
    text += paymentBlock
    return text
  }

  if (summaryTemplate === "check") {
    text += `${"─".repeat(28)}\n`
    text += `ยอดรายการ ฿${grandTotal.toFixed(2)}\n`
    if (discount > 0) {
      text += `ส่วนลดรวม ฿${discount.toFixed(2)} (${discountMode === "weighted" ? "ตามสัดส่วนยอดเดิม" : "เฉลี่ยเท่ากัน"})\n`
      text += `ยอดเก็บหลังหัก ฿${collectTotal.toFixed(2)}\n`
    }
    if (hasReceiptTotal) {
      text += `ยอดสลิป ฿${parsedReceiptTotal.toFixed(2)}\n`
      text += Math.abs(receiptDiff) < 0.01
        ? `สถานะ: ยอดตรง\n`
        : `สถานะ: ${receiptDiff > 0 ? "ขาด" : "เกิน"} ฿${Math.abs(receiptDiff).toFixed(2)}\n`
    }
    text += `รายการที่ยังไม่ได้เลือกคนหาร: ${unpaidItems.length}\n`
    unpaidItems.forEach(item => {
      text += `• ${item.name} ฿${item.price.toFixed(2)}\n`
    })
    text += `\n${paymentBlock}`
    text += `💰 แต่ละคนจ่าย\n`
    selected.forEach(name => {
      const amount = totals[name] || 0
      const cut = discounts[name] || 0
      text += `• ${name}  ฿${amount.toFixed(2)}`
      if (discount > 0) text += ` (ลด ฿${cut.toFixed(2)} จาก ฿${(rawTotals[name] || 0).toFixed(2)})`
      text += `\n`
    })
    return text
  }

  text += `${"─".repeat(28)}\n`

  items.forEach(item => {
    const sp = item.splitWith || []
    const perHead = sp.length > 0 ? ` (${sp.length} คน คนละ ฿${(Math.ceil(item.price / sp.length * 100) / 100).toFixed(2)})` : ""
    text += `• ${item.name}  ฿${item.price.toFixed(2)}${perHead}\n`
  })

  text += `${"─".repeat(28)}\n`
  text += `รวม ฿${grandTotal.toFixed(2)}\n\n`
  if (discount > 0) {
    text += `ส่วนลดรวม ฿${discount.toFixed(2)} (${discountMode === "weighted" ? "ตามสัดส่วนยอดเดิม" : "เฉลี่ยเท่ากัน"})\n`
    text += `ยอดหลังหักที่ต้องเก็บรวม ฿${collectTotal.toFixed(2)}\n\n`
  }
  text += paymentBlock
  text += `💰 แต่ละคนจ่าย\n`

  selected.forEach(name => {
    const amount = totals[name] || 0
    const cut = discounts[name] || 0
    text += `• ${name}  ฿${amount.toFixed(2)}`
    if (discount > 0) text += ` (ลด ฿${cut.toFixed(2)})`
    text += `\n`
  })

  return text
}

    async function backToEdit() {
        // เปิดรอบใหม่ใน db (ล้าง closed_at)
        await fetch(`http://localhost:3001/rounds/${round.id}/reopen`, {
            method: "PATCH"
        })
        setStep("items")
    }

    async function copyToClipboard() {
        const text = buildSummaryText()
        await navigator.clipboard.writeText(text)
        setCopied(true)
        setTimeout(() => setCopied(false), 2500)
    }

    const rawTotals = calcRawTotals()
    const discounts = calcDiscounts(rawTotals)
    const totals = calcTotals()
    const grandTotal = items.reduce((s, i) => s + i.price, 0)
    const discount = Math.max(0, parseFloat(discountAmount) || 0)
    const collectTotal = selected.reduce((sum, name) => sum + (totals[name] || 0), 0)
    const parsedReceiptTotal = parseFloat(receiptTotal)
    const hasReceiptTotal = receiptTotal !== "" && !isNaN(parsedReceiptTotal)
    const receiptDiff = hasReceiptTotal ? parsedReceiptTotal - grandTotal : 0
    const ownerName = user?.name || "เจ้าของบิล"
    const ownerPayment = paymentInfo[ownerName]
    const totalsKey = selected.map(name => `${name}:${(totals[name] || 0).toFixed(2)}`).join("|")

    useEffect(() => {
        let cancelled = false

        async function buildQrCodes() {
            if (step !== "summary" || !ownerPayment?.promptpay) {
                setQrCodes({})
                return
            }

            const next = {}
            for (const name of selected) {
                const amount = totals[name] || 0
                if (amount <= 0) continue
                const payload = buildPromptPayPayload(ownerPayment.promptpay, amount)
                if (!payload) continue
                next[name] = await QRCode.toDataURL(payload, {
                    errorCorrectionLevel: "M",
                    margin: 1,
                    width: 180,
                })
            }

            if (!cancelled) setQrCodes(next)
        }

        buildQrCodes()
        return () => { cancelled = true }
    }, [step, ownerPayment?.promptpay, totalsKey])

    // ─── SETUP ───────────────────────────────────────────────
    if (step === "setup") return (
        <div className="space-y-4">
            <h1 className="text-lg font-semibold">เปิดรอบใหม่</h1>

            <div className="bg-[#1c1c2e] rounded-2xl p-4 space-y-3">
                <p className="text-xs text-gray-500">ชื่อรอบ (ไม่บังคับ)</p>
                <input
                    className="w-full bg-[#13131f] border border-gray-700 rounded-xl px-3 py-2 text-sm outline-none focus:border-purple-500"
                    placeholder="เช่น ข้าวเที่ยง, ทริปเขาใหญ่..."
                    value={roundName}
                    onChange={e => setRoundName(e.target.value)}
                />
            </div>

            {groups.length > 0 && (
                <div className="bg-[#1c1c2e] rounded-2xl p-4 space-y-2">
                    <p className="text-xs text-gray-500">ดึงจากกลุ่ม</p>
                    <div className="flex flex-wrap gap-2">
                        {groups.map(g => (
                            <button key={g.id} onClick={() => loadGroup(g)}
                                className="px-3 py-1.5 bg-[#13131f] border border-gray-700 hover:border-purple-500 rounded-xl text-xs">
                                {g.name} ({g.members.length})
                            </button>
                        ))}
                    </div>
                </div>
            )}

            <div className="bg-[#1c1c2e] rounded-2xl p-4 space-y-2">
                <p className="text-xs text-gray-500">เลือกคนร่วมรอบ</p>
                {friends.length === 0
                    ? <p className="text-sm text-gray-700 text-center py-2">ไปเพิ่มเพื่อนที่แท็บ "เพื่อน / กลุ่ม" ก่อนครับ</p>
                    : <div className="flex flex-wrap gap-2">
                        {friends.map(f => {
                            const on = selected.includes(f.name)
                            return (
                                <button key={f.id} onClick={() => togglePerson(f.name)}
                                    className={`px-3 py-2 rounded-xl text-sm font-medium transition-all ${on ? "bg-purple-600 text-white" : "bg-[#13131f] text-gray-400 border border-gray-700"
                                        }`}>
                                    {f.name}
                                </button>
                            )
                        })}
                    </div>
                }
                {selected.length > 0 && (
                    <p className="text-xs text-gray-600 mt-1">เลือกแล้ว {selected.length} คน: {selected.join(", ")}</p>
                )}
            </div>

            <button onClick={startRound}
                className="w-full bg-emerald-600 hover:bg-emerald-500 py-3 rounded-2xl text-sm font-semibold">
                เริ่มรอบนี้ →
            </button>
        </div>
    )

    // ─── ITEMS ───────────────────────────────────────────────
    if (step === "items") return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-lg font-semibold">{round.name}</h1>
                    <p className="text-xs text-gray-600">{selected.join(", ")}</p>
                </div>
                <button onClick={finishRound}
                    className="bg-purple-600 hover:bg-purple-500 px-4 py-2 rounded-xl text-sm font-medium">
                    สรุปยอด →
                </button>
            </div>

            <div className="bg-[#1c1c2e] rounded-2xl p-4 space-y-3">
                <div className="flex justify-between items-start gap-3">
                    <div>
                        <p className="text-xs text-gray-500">พร้อมเพย์รับเงิน</p>
                        {ownerPayment?.promptpay && !showPromptpayForm ? (
                            <p className="text-lg font-semibold text-emerald-400 mt-1">{ownerPayment.promptpay}</p>
                        ) : (
                            <p className="text-xs text-gray-600 mt-0.5">ใส่ครั้งเดียว ระบบจะใส่ในข้อความสรุปทุกครั้ง</p>
                        )}
                    </div>
                    <button
                        onClick={() => setShowPromptpayForm(v => !v)}
                        className="text-xs text-emerald-400 hover:text-emerald-300 bg-[#13131f] px-3 py-1.5 rounded-lg"
                    >
                        {ownerPayment?.promptpay ? "แก้" : "เพิ่ม"}
                    </button>
                </div>
                {showPromptpayForm && (
                    <div className="flex gap-2">
                        <input
                            className="flex-1 bg-[#13131f] border border-gray-700 rounded-xl px-3 py-2 text-sm outline-none focus:border-purple-500"
                            placeholder="เบอร์พร้อมเพย์ที่ให้เพื่อนโอน"
                            value={ownerPromptpay}
                            onChange={e => setOwnerPromptpay(e.target.value)}
                            onKeyDown={e => e.key === "Enter" && saveOwnerPromptpay()}
                        />
                        <button onClick={saveOwnerPromptpay}
                            className="bg-emerald-600 hover:bg-emerald-500 px-3 rounded-xl text-sm font-medium">
                            บันทึก
                        </button>
                    </div>
                )}
            </div>

            {/* อัปสลิป */}
            <div className="bg-[#1c1c2e] rounded-2xl p-4">
                <p className="text-xs text-gray-500 mb-3">อัปโหลดสลิป / เมนู</p>
                <label className={`flex items-center justify-center gap-2 border-2 border-dashed rounded-xl p-4 cursor-pointer transition-colors ${scanning ? "border-purple-500 text-purple-400" : "border-gray-700 hover:border-purple-500 text-gray-500"
                    }`}>
                    <input type="file" accept="image/*" className="hidden" onChange={handleScan} disabled={scanning} />
                    {scanning ? "กำลังอ่าน AI..." : "แตะเพื่ออัปโหลดสลิป / เมนู"}
                </label>
                {scanError && <p className="text-red-400 text-xs mt-2">{scanError}</p>}
            </div>

            {scannedItems.length > 0 && (
              <div className="bg-[#1c1c2e] rounded-2xl p-4 space-y-3">
                <p className="text-xs text-gray-500">รายการจากสลิป (แก้ไขแล้วกด + เพื่อเพิ่ม)</p>
                <div className="space-y-3">
                  {scannedItems.map((item, index) => (
                    <div key={index} className="bg-[#13131f] rounded-xl p-3 space-y-2">
                      <div className="flex gap-2">
                        <input
                          className="flex-1 bg-[#13131f] border border-gray-700 rounded-xl px-3 py-2 text-sm outline-none focus:border-purple-500"
                          placeholder="ชื่อรายการ"
                          value={item.name}
                          onChange={e => updateScannedItem(index, "name", e.target.value)}
                        />
                        <input
                          className="w-28 bg-[#13131f] border border-gray-700 rounded-xl px-3 py-2 text-sm outline-none focus:border-purple-500"
                          placeholder="ราคา"
                          type="number"
                          value={item.price}
                          onChange={e => updateScannedItem(index, "price", e.target.value)}
                        />
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => addScannedItem(index)}
                          className="flex-1 bg-emerald-600 hover:bg-emerald-500 py-2 rounded-xl text-sm font-medium">
                          + เพิ่มรายการนี้
                        </button>
                        <button onClick={() => removeScannedItem(index)}
                          className="flex-1 bg-[#13131f] hover:bg-red-900 py-2 rounded-xl text-sm text-gray-400">
                          ลบรายการ
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                <button onClick={addAllScannedItems}
                  className="w-full bg-purple-600 hover:bg-purple-500 py-3 rounded-2xl text-sm font-medium">
                  เพิ่มทั้งหมด
                </button>
              </div>
            )}

            {/* เพิ่มรายการเอง */}
            <div className="bg-[#1c1c2e] rounded-2xl p-4 space-y-2">
                <p className="text-xs text-gray-500">เพิ่มรายการเอง</p>
                <div className="flex gap-2">
                    <input
                        className="flex-1 bg-[#13131f] border border-gray-700 rounded-xl px-3 py-2 text-sm outline-none focus:border-purple-500"
                        placeholder="ชื่อรายการ..."
                        value={manualName}
                        onChange={e => setManualName(e.target.value)}
                        onKeyDown={e => e.key === "Enter" && addManual()}
                    />
                    <input
                        className="w-24 bg-[#13131f] border border-gray-700 rounded-xl px-3 py-2 text-sm outline-none focus:border-purple-500"
                        placeholder="ราคา"
                        type="number"
                        value={manualPrice}
                        onChange={e => setManualPrice(e.target.value)}
                        onKeyDown={e => e.key === "Enter" && addManual()}
                    />
                    <button onClick={addManual}
                        className="bg-emerald-600 hover:bg-emerald-500 px-3 rounded-xl text-sm font-medium">+</button>
                </div>
            </div>

            <div className="bg-[#1c1c2e] rounded-2xl p-4 space-y-3">
                <div className="flex justify-between items-center gap-3">
                    <div>
                        <p className="text-xs text-gray-500">เช็กยอดรวมจากสลิป</p>
                        <p className="text-xs text-gray-600 mt-0.5">ใส่ยอดท้ายสลิปเพื่อเทียบกับรายการที่เพิ่มแล้ว</p>
                    </div>
                    <input
                        className="w-32 bg-[#13131f] border border-gray-700 rounded-xl px-3 py-2 text-sm text-right outline-none focus:border-purple-500"
                        placeholder="ยอดสลิป"
                        type="number"
                        value={receiptTotal}
                        onChange={e => setReceiptTotal(e.target.value)}
                    />
                </div>
                {hasReceiptTotal && (
                    <div className={`rounded-xl px-3 py-2 text-xs ${Math.abs(receiptDiff) < 0.01 ? "bg-emerald-900/30 text-emerald-300" : "bg-amber-900/30 text-amber-300"}`}>
                        {Math.abs(receiptDiff) < 0.01
                            ? `ยอดตรงแล้ว: ฿${grandTotal.toFixed(2)}`
                            : `ยอดรายการ ฿${grandTotal.toFixed(2)} | ต่างจากสลิป ${receiptDiff > 0 ? "ขาด" : "เกิน"} ฿${Math.abs(receiptDiff).toFixed(2)}`
                        }
                    </div>
                )}
            </div>

            <div className="bg-[#1c1c2e] rounded-2xl p-4 space-y-3">
                <div className="flex justify-between items-center gap-3">
                    <div>
                        <p className="text-xs text-gray-500">ส่วนลดพิเศษทั้งบิล</p>
                        <p className="text-xs text-gray-600 mt-0.5">เช่น ลดรวม 1000 แล้วกระจายให้คนในรอบ</p>
                    </div>
                    <input
                        className="w-32 bg-[#13131f] border border-gray-700 rounded-xl px-3 py-2 text-sm text-right outline-none focus:border-purple-500"
                        placeholder="0"
                        type="number"
                        value={discountAmount}
                        onChange={e => setDiscountAmount(e.target.value)}
                    />
                </div>
                <div className="grid grid-cols-2 gap-2">
                    <button onClick={() => setDiscountMode("equal")}
                        className={`py-2 rounded-xl text-xs font-medium ${discountMode === "equal" ? "bg-purple-600 text-white" : "bg-[#13131f] text-gray-500 border border-gray-700"}`}>
                        เฉลี่ยเท่ากัน
                    </button>
                    <button onClick={() => setDiscountMode("weighted")}
                        className={`py-2 rounded-xl text-xs font-medium ${discountMode === "weighted" ? "bg-purple-600 text-white" : "bg-[#13131f] text-gray-500 border border-gray-700"}`}>
                        ตามสัดส่วนยอด
                    </button>
                </div>
                {discount > 0 && (
                    <div className="rounded-xl px-3 py-2 text-xs bg-emerald-900/30 text-emerald-300 space-y-1">
                        <p>จะกระจายส่วนลดรวม ฿{discount.toFixed(2)} แบบ{discountMode === "weighted" ? "ตามสัดส่วนยอดเดิม" : "เฉลี่ยเท่ากัน"} โดยไม่เปลี่ยนยอดรวมจากสลิป</p>
                        <p>ยอดที่ต้องเก็บหลังหักส่วนลด: ฿{collectTotal.toFixed(2)}</p>
                    </div>
                )}
            </div>

            {/* รายการ + เลือกคนหาร */}
            {items.length > 0 && (
                <div className="bg-[#1c1c2e] rounded-2xl p-4 space-y-3">
                    <div className="flex justify-between items-center">
                        <p className="text-xs text-gray-500">รายการ — แตะชื่อเพื่อเลือก/ยกเลิกหาร</p>
                        <div className="flex gap-3">
                            {/* ปุ่มเพิ่มเพื่อนใหม่ inline */}
                            <button
                                onClick={() => setShowAddFriend(v => !v)}
                                className="text-xs text-purple-400 hover:text-purple-300"
                            >
                                + เพิ่มคนในรอบ
                            </button>
                        </div>
                    </div>

                    {/* inline add friend */}
                    {showAddFriend && (
                        <div className="flex gap-2 bg-[#13131f] p-2 rounded-xl">
                            <input
                                className="flex-1 bg-[#1c1c2e] border border-gray-700 rounded-lg px-3 py-2 text-sm outline-none focus:border-purple-500"
                                placeholder="ชื่อเพื่อนใหม่..."
                                value={newFriendInput}
                                onChange={e => setNewFriendInput(e.target.value)}
                                onKeyDown={e => e.key === "Enter" && addFriendInline()}
                            />
                            <button onClick={addFriendInline}
                                className="bg-emerald-600 hover:bg-emerald-500 px-3 rounded-lg text-sm">
                                เพิ่ม
                            </button>
                        </div>
                    )}

                    {items.map((item, index) => {
                        const sp = item.splitWith || []
                        const perHead = sp.length > 0 ? (item.price / sp.length).toFixed(2) : "-"
                        const isEditing = editingItemId === item.id
                        return (
                            <div key={item.id} className="bg-[#13131f] rounded-xl p-3 space-y-2">
                                {isEditing ? (
                                    <div className="space-y-2">
                                        <div className="flex gap-2">
                                            <input
                                                className="flex-1 bg-[#1c1c2e] border border-gray-700 rounded-xl px-3 py-2 text-sm outline-none focus:border-purple-500"
                                                placeholder="ชื่อรายการ"
                                                value={editingName}
                                                onChange={e => setEditingName(e.target.value)}
                                                onKeyDown={e => e.key === "Enter" && saveEditItem()}
                                            />
                                            <input
                                                className="w-28 bg-[#1c1c2e] border border-gray-700 rounded-xl px-3 py-2 text-sm outline-none focus:border-purple-500"
                                                placeholder="ราคา"
                                                type="number"
                                                value={editingPrice}
                                                onChange={e => setEditingPrice(e.target.value)}
                                                onKeyDown={e => e.key === "Enter" && saveEditItem()}
                                            />
                                        </div>
                                        <div className="flex gap-2">
                                            <button onClick={saveEditItem}
                                                className="flex-1 bg-emerald-600 hover:bg-emerald-500 py-2 rounded-xl text-sm font-medium">
                                                บันทึก
                                            </button>
                                            <button onClick={cancelEditItem}
                                                className="flex-1 bg-[#1c1c2e] hover:bg-[#252540] py-2 rounded-xl text-sm text-gray-400">
                                                ยกเลิก
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <p className="text-sm font-medium">{item.name}</p>
                                            <p className="text-xs text-gray-600 mt-0.5">
                                                {sp.length > 0 ? `หาร ${sp.length} คน • คนละ ฿${perHead}` : "ยังไม่ได้เลือกคน"}
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-emerald-400 text-sm">฿{item.price.toFixed(2)}</span>
                                            <button onClick={() => startEditItem(item)} className="text-gray-500 hover:text-purple-300 text-sm">แก้</button>
                                            <button onClick={() => deleteItem(item.id)} className="text-gray-700 hover:text-red-400 text-sm">✕</button>
                                        </div>
                                    </div>
                                )}
                                <div className="flex flex-wrap gap-1.5 border-t border-gray-800 pt-2">
                                    <button onClick={() => setItemSplit(item.id, selected)}
                                        className="px-2.5 py-1 rounded-full text-xs bg-emerald-900/40 text-emerald-300 hover:bg-emerald-800/60">
                                        ทุกคน
                                    </button>
                                    <button onClick={() => setItemSplit(item.id, [])}
                                        className="px-2.5 py-1 rounded-full text-xs bg-[#1c1c2e] text-gray-500 border border-gray-700 hover:text-gray-300">
                                        เคลียร์
                                    </button>
                                    {index > 0 && (
                                        <button onClick={() => copySplitFromPrevious(index)}
                                            className="px-2.5 py-1 rounded-full text-xs bg-[#1c1c2e] text-purple-300 border border-purple-900/60 hover:border-purple-500">
                                            เหมือนรายการก่อน
                                        </button>
                                    )}
                                </div>
                                <div className="flex flex-wrap gap-1.5">
                                    {selected.map(name => {
                                        const on = sp.includes(name)
                                        return (
                                            <button key={name} onClick={() => toggleSplit(item.id, name)}
                                                className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all ${on ? "bg-purple-600 text-white" : "bg-[#1c1c2e] text-gray-500 border border-gray-700"
                                                    }`}>
                                                {on ? "✓ " : ""}{name}
                                            </button>
                                        )
                                    })}
                                </div>
                            </div>
                        )
                    })}

                    <div className="flex justify-between text-sm pt-2 border-t border-gray-800">
                        <span className="text-gray-500">รวม</span>
                        <span className="text-emerald-400 font-semibold">฿{grandTotal.toFixed(2)}</span>
                    </div>
                </div>
            )}
        </div>
    )

    // ─── SUMMARY ─────────────────────────────────────────────
    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <h1 className="text-lg font-semibold">สรุปรอบ: {round.name}</h1>
                <div className="flex gap-2">
                    <button
                        onClick={backToEdit}
                        className="text-xs text-gray-500 hover:text-gray-300 bg-[#1c1c2e] px-3 py-1.5 rounded-lg"
                    >
                        ✏️ แก้ไข
                    </button>
                    <button onClick={resetRound} className="text-xs text-gray-600 hover:text-gray-400">
                        + รอบใหม่
                    </button>
                </div>
            </div>

            <div className="bg-[#1c1c2e] rounded-2xl p-4 space-y-3">
                <p className="text-xs text-gray-500">เทมเพลตข้อความ</p>
                <div className="grid grid-cols-4 gap-2">
                    {SUMMARY_TEMPLATES.map(template => (
                        <button key={template.id}
                            onClick={() => setSummaryTemplate(template.id)}
                            className={`py-2 rounded-xl text-xs font-medium transition-all ${summaryTemplate === template.id
                                ? "bg-purple-600 text-white"
                                : "bg-[#13131f] text-gray-500 border border-gray-700 hover:text-gray-300"
                                }`}>
                            {template.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* ปุ่ม 2 อัน */}
            <div className="flex gap-2">
                <button
                    onClick={copyToClipboard}
                    className={`flex-1 py-3 rounded-2xl text-sm font-semibold transition-all ${copied
                        ? "bg-emerald-700 text-emerald-200"
                        : "bg-emerald-600 hover:bg-emerald-500 text-white"
                        }`}
                >
                    {copied ? "✓ คัดลอกแล้ว!" : "📋 คัดลอกข้อความ"}
                </button>
                <button
                    onClick={shareAsImage}
                    className="flex-1 py-3 rounded-2xl text-sm font-semibold bg-purple-600 hover:bg-purple-500 text-white"
                >
                    🖼️ แชร์เป็นรูป
                </button>
            </div>

            {/* preview ข้อความ */}
            <div className="bg-[#1c1c2e] rounded-2xl p-4">
                <p className="text-xs text-gray-500 mb-2">ตัวอย่างข้อความ</p>
                <pre className="text-xs text-gray-400 whitespace-pre-wrap font-mono leading-relaxed">
                    {buildSummaryText()}
                </pre>
            </div>

            {/* card สำหรับ screenshot — ใส่ ref ตรงนี้ */}
            <div ref={summaryRef} className="bg-[#13131f] rounded-2xl p-5 space-y-4">
                {/* header */}
                <div className="text-center border-b border-gray-800 pb-4">
                    <p className="text-base font-bold text-white">🍽️ {round.name}</p>
                    <p className="text-xs text-gray-500 mt-1">
                        {new Date().toLocaleDateString("th-TH", { year: "numeric", month: "long", day: "numeric" })}
                    </p>
                </div>

                {/* รายการ */}
                <div className="space-y-1.5">
                    <p className="text-xs text-gray-600 mb-2">รายการ</p>
                    {items.map(item => {
                        const sp = item.splitWith || []
                        return (
                            <div key={item.id} className="flex justify-between text-sm">
                                <span className="text-gray-300">{item.name}</span>
                                <span className="text-emerald-400">฿{item.price.toFixed(2)}</span>
                            </div>
                        )
                    })}
                    <div className="flex justify-between text-sm font-semibold pt-2 border-t border-gray-800 mt-2">
                        <span className="text-gray-400">รวม</span>
                        <span className="text-emerald-400">฿{grandTotal.toFixed(2)}</span>
                    </div>
                    {discount > 0 && (
                        <>
                            <div className="flex justify-between text-xs pt-2 text-emerald-300">
                                <span>ส่วนลดรวม ({discountMode === "weighted" ? "ตามสัดส่วนยอด" : "เฉลี่ยเท่ากัน"})</span>
                                <span>- ฿{discount.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between text-sm font-semibold pt-2 border-t border-gray-800 mt-2">
                                <span className="text-gray-400">ยอดเก็บหลังหัก</span>
                                <span className="text-emerald-400">฿{collectTotal.toFixed(2)}</span>
                            </div>
                        </>
                    )}
                </div>

                {ownerPayment?.promptpay && (
                    <div className="border-t border-gray-800 pt-4">
                        <div className="bg-emerald-900/30 border border-emerald-800/60 rounded-xl px-4 py-3 text-center">
                            <p className="text-xs text-emerald-200">โอนเข้า {ownerName}</p>
                            <p className="text-lg font-semibold text-emerald-300 mt-0.5">พร้อมเพย์ {ownerPayment.promptpay}</p>
                        </div>
                    </div>
                )}

                {/* แต่ละคนจ่าย */}
                <div className="space-y-3 border-t border-gray-800 pt-4">
                    <div className="flex justify-between items-center">
                        <p className="text-xs text-gray-600">💰 แต่ละคนจ่าย</p>
                        {ownerPayment?.promptpay && (
                            <p className="text-xs text-emerald-500">QR พร้อมสแกน</p>
                        )}
                    </div>
                   {selected.map(name => {
  const amount = totals[name] || 0
  const beforeDiscount = rawTotals[name] || 0
  const discountCut = discounts[name] || 0
  const myItems = items.filter(i => (i.splitWith || []).includes(name))
  return (
    <div key={name} className="bg-[#10101a] border border-gray-800 rounded-xl overflow-hidden">
      <div className="flex justify-between items-start gap-3 px-4 py-3">
        <div>
          <p className="text-base font-semibold text-white">{name}</p>
          {discount > 0 && (
            <p className="text-xs text-emerald-600 mt-0.5">ก่อนลด ฿{beforeDiscount.toFixed(2)} • ลด ฿{discountCut.toFixed(2)}</p>
          )}
          {ownerPayment?.promptpay && (
            <p className="text-xs text-gray-600 mt-1">โอนเข้า {ownerName}</p>
          )}
        </div>
        <div className="text-right">
          <p className="text-xs text-gray-600">ยอดโอน</p>
          <p className="text-2xl font-bold text-purple-300">฿{amount.toFixed(2)}</p>
        </div>
      </div>
      {qrCodes[name] && (
        <div className="px-4 pb-4">
          <div className="bg-white rounded-xl p-3 text-center">
            <img src={qrCodes[name]} alt={`QR พร้อมเพย์ ${name}`} className="w-40 h-40 mx-auto" />
            <p className="text-[11px] text-gray-700 mt-2 font-semibold">พร้อมเพย์ {ownerPayment.promptpay}</p>
            <p className="text-[11px] text-gray-500">สแกนเพื่อจ่าย ฿{amount.toFixed(2)}</p>
          </div>
        </div>
      )}
      {myItems.length > 0 && (
        <div className="px-4 pb-3 space-y-1 border-t border-gray-800">
          {myItems.map(item => {
            const share = Math.ceil(item.price / (item.splitWith || []).length * 100) / 100
            return (
              <div key={item.id} className="flex justify-between text-xs text-gray-600 pt-1">
                <span>{item.name}</span>
                <span>฿{share.toFixed(2)}</span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
})}
                </div>
            </div>

            <button onClick={resetRound}
                className="w-full bg-[#1c1c2e] hover:bg-[#252540] py-3 rounded-2xl text-sm font-medium text-gray-400">
                เปิดรอบใหม่
            </button>
        </div>
    )
}
