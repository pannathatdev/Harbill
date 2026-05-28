import { useState, useEffect } from "react"
import { api } from "../api"

const SUMMARY_TEMPLATES = [
    { id: "pay", label: "พร้อมจ่าย" },
    { id: "short", label: "สั้น" },
    { id: "detail", label: "ละเอียด" },
    { id: "check", label: "ตรวจบิล" },
]

function ShareIcon() {
    return (
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="18" cy="5" r="3" />
            <circle cx="6" cy="12" r="3" />
            <circle cx="18" cy="19" r="3" />
            <path d="M8.59 13.51 15.42 17.49" />
            <path d="M15.41 6.51 8.59 10.49" />
        </svg>
    )
}

function CopyIcon() {
    return (
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="9" y="9" width="13" height="13" rx="2" />
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
        </svg>
    )
}

function SaveIcon() {
    return (
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2Z" />
            <path d="M17 21v-8H7v8" />
            <path d="M7 3v5h8" />
        </svg>
    )
}

function ImageCopyIcon() {
    return (
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="8" y="8" width="14" height="14" rx="2" />
            <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
            <circle cx="13.5" cy="13.5" r="1.5" />
            <path d="m22 18-3-3-5 5" />
        </svg>
    )
}

function EditIcon() {
    return (
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 20h9" />
            <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
        </svg>
    )
}

function PlusIcon() {
    return (
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14" />
            <path d="M12 5v14" />
        </svg>
    )
}

function CloseIcon() {
    return (
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 6 6 18" />
            <path d="m6 6 12 12" />
        </svg>
    )
}

function TrashIcon() {
    return (
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 6h18" />
            <path d="M8 6V4h8v2" />
            <path d="M19 6l-1 14H6L5 6" />
            <path d="M10 11v5" />
            <path d="M14 11v5" />
        </svg>
    )
}

function IconButton({ onClick, title, children, className = "" }) {
    return (
        <button
            type="button"
            onClick={onClick}
            title={title}
            aria-label={title}
            className={`inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-[#1c1c2e] text-gray-400 transition-all hover:border-purple-500/60 hover:text-white ${className}`}
        >
            {children}
        </button>
    )
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
    const [copiedText, setCopiedText] = useState(false)
    const [copiedQr, setCopiedQr] = useState(false)
    const [copiedPerson, setCopiedPerson] = useState("")
    const [showQrCopyPanel, setShowQrCopyPanel] = useState(false)
    const [qrCopyModalMessage, setQrCopyModalMessage] = useState("")
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

    function safeFileName(value) {
        return String(value || "person")
            .trim()
            .replace(/[\\/:*?"<>|]+/g, "-")
            .replace(/\s+/g, "-")
    }

    function canvasToBlob(canvas) {
        return new Promise((resolve, reject) => {
            canvas.toBlob(blob => {
                if (blob) resolve(blob)
                else reject(new Error("Cannot create image"))
            }, "image/png")
        })
    }

    function loadImage(src) {
        return new Promise((resolve, reject) => {
            const image = new Image()
            image.onload = () => resolve(image)
            image.onerror = reject
            image.src = src
        })
    }

    function drawCenteredText(ctx, text, x, y, maxWidth, lineHeight) {
        const words = String(text || "").split(" ")
        const lines = []
        let line = ""

        words.forEach(word => {
            const next = line ? `${line} ${word}` : word
            if (ctx.measureText(next).width <= maxWidth || !line) {
                line = next
            } else {
                lines.push(line)
                line = word
            }
        })
        if (line) lines.push(line)

        lines.forEach((value, index) => {
            ctx.fillText(value, x, y + index * lineHeight)
        })

        return y + Math.max(lines.length, 1) * lineHeight
    }

    async function buildPersonQrCanvas(name) {
        if (!ownerPayment?.promptpay || !qrCodes[name]) return null

        const amount = totals[name] || 0
        const qrImage = await loadImage(qrCodes[name])
        const canvas = document.createElement("canvas")
        canvas.width = 720
        canvas.height = 900
        const ctx = canvas.getContext("2d")

        ctx.fillStyle = "#ffffff"
        ctx.fillRect(0, 0, canvas.width, canvas.height)
        ctx.fillStyle = "#101827"
        ctx.textAlign = "center"
        ctx.textBaseline = "top"

        ctx.font = "700 44px system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
        drawCenteredText(ctx, name, canvas.width / 2, 56, 600, 54)

        ctx.font = "700 72px system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
        ctx.fillStyle = "#6d28d9"
        ctx.fillText(`฿${amount.toFixed(2)}`, canvas.width / 2, 145)

        ctx.drawImage(qrImage, 160, 250, 400, 400)

        ctx.fillStyle = "#111827"
        ctx.font = "700 28px system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
        ctx.fillText(`พร้อมเพย์ ${ownerPayment.promptpay}`, canvas.width / 2, 700)

        ctx.fillStyle = "#4b5563"
        ctx.font = "500 24px system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
        ctx.fillText(`โอนเข้า ${ownerName}`, canvas.width / 2, 742)
        ctx.fillText(round.name, canvas.width / 2, 790)

        return canvas
    }

    async function buildPersonQrFile(name) {
        const canvas = await buildPersonQrCanvas(name)
        if (!canvas) return null
        const blob = await canvasToBlob(canvas)
        return new File([blob], `${safeFileName(round.name)}-${safeFileName(name)}-qr.png`, { type: "image/png" })
    }

    async function buildAllPersonQrFiles() {
        const files = []
        for (const name of selected) {
            const file = await buildPersonQrFile(name)
            if (file) files.push(file)
        }
        return files
    }

    async function copyQrFilesToClipboard(files) {
        if (!navigator.clipboard?.write || !window.ClipboardItem) return false

        await navigator.clipboard.write(
            files.map(file => new ClipboardItem({ [file.type]: file }))
        )
        return true
    }

    async function shareFile(file, title) {
        if (navigator.share && navigator.canShare?.({ files: [file] })) {
            await navigator.share({ files: [file], title })
            return
        }
        setShowQrCopyPanel(true)
        alert("แชร์รูปไม่ได้ เปิดแผง QR ให้คัดลอกแทนครับ")
    }

    async function sharePersonImage(name) {
        const file = await buildPersonQrFile(name)
        if (!file) {
            alert("ยังไม่มี QR ให้แชร์ กรุณาตั้งค่าพร้อมเพย์ก่อนครับ")
            return
        }
        await shareFile(file, `${round.name} - ${name}`)
    }

    async function copyPersonImage(name) {
        const file = await buildPersonQrFile(name)
        if (!file) {
            alert("ยังไม่มี QR ให้คัดลอก กรุณาตั้งค่าพร้อมเพย์ก่อนครับ")
            return
        }

        if (!navigator.clipboard?.write || !window.ClipboardItem) {
            setShowQrCopyPanel(true)
            alert("เบราว์เซอร์นี้คัดลอกรูปไม่ได้ เปิดแผง QR ให้แทนครับ")
            return
        }

        try {
            await copyQrFilesToClipboard([file])
            setCopiedQr(true)
            setCopiedPerson(name)
            setTimeout(() => {
                setCopiedQr(false)
                setCopiedPerson("")
            }, 2500)
        } catch (error) {
            console.error(error)
            setShowQrCopyPanel(true)
            alert("คัดลอกรูปไม่ได้ เปิดแผง QR ให้แทนครับ")
        }
    }

    async function shareAllPersonImages() {
        const files = await buildAllPersonQrFiles()

        if (files.length === 0) {
            alert("ยังไม่มี QR ให้แชร์ กรุณาตั้งค่าพร้อมเพย์ก่อนครับ")
            return
        }

        if (navigator.share && navigator.canShare?.({ files })) {
            try {
                await navigator.share({ files, title: round.name })
            } catch (error) {
                if (error?.name !== "AbortError") {
                    console.error(error)
                    const copiedImages = await copyQrFilesToClipboard(files).catch(() => false)
                    if (copiedImages) {
                        setCopiedQr(true)
                        setTimeout(() => setCopiedQr(false), 2500)
                        alert("แชร์ไม่สำเร็จ เลยคัดลอกรูป QR ทั้งหมดให้แล้วครับ ลองวางในแชทได้เลย")
                    } else {
                        setShowQrCopyPanel(true)
                    }
                }
            }
            return
        }

        const copiedImages = await copyQrFilesToClipboard(files).catch(() => false)
        if (copiedImages) {
            setCopiedQr(true)
            setTimeout(() => setCopiedQr(false), 2500)
            alert("คัดลอกรูป QR ทั้งหมดแล้ว ลองวางในแชทได้เลยครับ")
        } else {
            setShowQrCopyPanel(true)
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

    async function addNameToRoundSelection(name) {
        const cleanName = String(name || "").trim()
        if (!cleanName) return

        const existingFriend = friends.find(f => f.name.trim().toLowerCase() === cleanName.toLowerCase())
        const finalName = existingFriend?.name || cleanName

        if (!existingFriend) {
            try {
                await api.addFriend(finalName)
                await loadFriends()
            } catch (err) {
                if (!String(err.message || "").includes("ถูกใช้")) throw err
            }
        }

        setSelected(prev => prev.includes(finalName) ? prev : [...prev, finalName])

        if (round && !round.joiners?.includes(finalName)) {
            await api.addRoundMember(round.id, finalName)
            setRound(prev => ({ ...prev, joiners: [...(prev.joiners || []), finalName] }))
        }
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
        await addNameToRoundSelection(name)
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
        await api.reopenRound(round.id)
        setStep("items")
    }

    async function copyText(text) {
        if (navigator.clipboard?.writeText && window.isSecureContext) {
            await navigator.clipboard.writeText(text)
            return true
        }

        const textarea = document.createElement("textarea")
        textarea.value = text
        textarea.setAttribute("readonly", "")
        textarea.style.position = "fixed"
        textarea.style.left = "-9999px"
        textarea.style.top = "0"
        document.body.appendChild(textarea)
        textarea.focus()
        textarea.select()

        try {
            return document.execCommand("copy")
        } finally {
            document.body.removeChild(textarea)
        }
    }

    async function copyToClipboard() {
        try {
            const copiedText = await copyText(buildSummaryText())
            if (!copiedText) {
                alert("คัดลอกไม่ได้ กรุณาลองเลือกข้อความจากตัวอย่างแล้วคัดลอกเองครับ")
                return
            }
            setCopiedText(true)
            setTimeout(() => setCopiedText(false), 2500)
        } catch (error) {
            console.error(error)
            alert("คัดลอกไม่ได้ กรุณาลองเลือกข้อความจากตัวอย่างแล้วคัดลอกเองครับ")
        }
    }

    async function copyAllQrImages() {
        try {
            const files = await buildAllPersonQrFiles()
            if (files.length === 0) {
                setQrCopyModalMessage("ยังไม่มี QR ให้คัดลอก กรุณาตั้งค่าพร้อมเพย์ก่อนครับ")
                setShowQrCopyPanel(true)
                return
            }

            const copiedImages = await copyQrFilesToClipboard(files)
            if (!copiedImages) {
                setQrCopyModalMessage("เบราว์เซอร์นี้คัดลอกรูปหลายรูปไม่ได้ เปิดแผง QR ให้คัดลอกทีละรูปแทนครับ")
                setShowQrCopyPanel(true)
                return
            }

            setCopiedQr(true)
            setTimeout(() => setCopiedQr(false), 2500)
        } catch (error) {
            console.error(error)
            setQrCopyModalMessage("คัดลอกรูปไม่ได้ เปิดแผง QR ให้คัดลอกทีละรูปแทนครับ")
            setShowQrCopyPanel(true)
        }
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

            const QRCode = await import("qrcode")
            const next = {}
            for (const name of selected) {
                const amount = totals[name] || 0
                if (amount <= 0) continue
                const payload = buildPromptPayPayload(ownerPayment.promptpay, amount)
                if (!payload) continue
                next[name] = await QRCode.default.toDataURL(payload, {
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
                <div className="flex gap-2 rounded-xl bg-[#13131f] p-2">
                    <input
                        className="min-w-0 flex-1 bg-[#1c1c2e] border border-gray-700 rounded-lg px-3 py-2 text-sm outline-none focus:border-purple-500"
                        placeholder="พิมพ์ชื่อเพื่อนใหม่ หรือชื่อเดิม..."
                        value={newFriendInput}
                        onChange={e => setNewFriendInput(e.target.value)}
                        onKeyDown={e => e.key === "Enter" && addFriendInline()}
                    />
                    <button
                        onClick={addFriendInline}
                        title="เพิ่มเข้ารอบ"
                        aria-label="เพิ่มเข้ารอบ"
                        className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-600 text-white hover:bg-emerald-500"
                    >
                        <PlusIcon />
                    </button>
                </div>
                {friends.length === 0
                    ? <p className="text-sm text-gray-700 text-center py-2">พิมพ์ชื่อด้านบนเพื่อเพิ่มคนเข้ารอบได้เลย</p>
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
                    <div className="rounded-xl border border-purple-500/20 bg-purple-500/10 px-3 py-2">
                        <p className="text-xs font-medium text-purple-200">เลือกแล้ว {selected.length} คน</p>
                        <p className="mt-1 text-xs text-gray-400">{selected.join(", ")}</p>
                    </div>
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
                        title={ownerPayment?.promptpay ? "แก้" : "เพิ่ม"}
                        aria-label={ownerPayment?.promptpay ? "แก้" : "เพิ่ม"}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-[#13131f] text-emerald-400 transition-colors hover:text-emerald-300"
                    >
                        {ownerPayment?.promptpay ? <EditIcon /> : <PlusIcon />}
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
                          className="flex-1 inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 py-2 rounded-xl text-sm font-medium">
                          <PlusIcon />
                          <span>เพิ่มรายการนี้</span>
                        </button>
                        <button onClick={() => removeScannedItem(index)}
                          title="ลบรายการ"
                          aria-label="ลบรายการ"
                          className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-[#13131f] text-gray-500 hover:bg-red-600 hover:text-white">
                          <TrashIcon />
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
                                                title="บันทึก"
                                                aria-label="บันทึก"
                                                className="flex-1 inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 py-2 rounded-xl text-sm font-medium">
                                                <SaveIcon />
                                                <span>บันทึก</span>
                                            </button>
                                            <button onClick={cancelEditItem}
                                                title="ยกเลิก"
                                                aria-label="ยกเลิก"
                                                className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-[#1c1c2e] text-gray-500 hover:bg-[#252540] hover:text-white">
                                                <CloseIcon />
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
                                            <button onClick={() => startEditItem(item)} title="แก้ไข" aria-label="แก้ไข" className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-white/5 text-gray-500 hover:bg-purple-600 hover:text-white">
                                                <EditIcon />
                                            </button>
                                            <button onClick={() => deleteItem(item.id)} title="ลบ" aria-label="ลบ" className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-white/5 text-gray-600 hover:bg-red-600 hover:text-white">
                                                <TrashIcon />
                                            </button>
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
                    <IconButton onClick={backToEdit} title="แก้ไขรอบ">
                        <EditIcon />
                    </IconButton>
                    <IconButton onClick={resetRound} title="เปิดรอบใหม่">
                        <PlusIcon />
                    </IconButton>
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
                    title="คัดลอกข้อความสรุป"
                    className={`flex-1 inline-flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-semibold transition-all ${copiedText
                        ? "bg-emerald-700 text-emerald-200"
                        : "bg-emerald-600 hover:bg-emerald-500 text-white"
                        }`}
                >
                    <CopyIcon />
                    <span>{copiedText ? "คัดลอกแล้ว" : "คัดลอก"}</span>
                </button>
                <button
                    onClick={copyAllQrImages}
                    title="คัดลอก QR ทุกคน"
                    className={`flex-1 inline-flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-semibold transition-all ${copiedQr
                        ? "bg-purple-800 text-purple-100"
                        : "bg-purple-600 hover:bg-purple-500 text-white"
                        }`}
                >
                    <ImageCopyIcon />
                    <span>{copiedQr ? "คัดลอก QR แล้ว" : "คัดลอก QR"}</span>
                </button>
            </div>

            {/* preview ข้อความ */}
            <div className="bg-[#1c1c2e] rounded-2xl p-4">
                <p className="text-xs text-gray-500 mb-2">ตัวอย่างข้อความ</p>
                <pre className="text-xs text-gray-400 whitespace-pre-wrap font-mono leading-relaxed">
                    {buildSummaryText()}
                </pre>
            </div>

            {showQrCopyPanel && (
                <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/65 px-4 pb-4 pt-16 backdrop-blur-sm sm:items-center">
                    <div className="w-full max-w-lg overflow-hidden rounded-3xl border border-white/10 bg-[#181827] shadow-2xl shadow-black/40">
                        <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
                            <div>
                                <p className="text-sm font-semibold text-white">คัดลอก QR</p>
                                <p className="text-xs text-gray-500 mt-0.5">{qrCopyModalMessage || "กดคัดลอกรูปทีละคน แล้ววางในแชทได้เลย"}</p>
                            </div>
                            <button
                                onClick={() => {
                                    setShowQrCopyPanel(false)
                                    setQrCopyModalMessage("")
                                }}
                                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-gray-400 transition-all hover:bg-white/10 hover:text-white"
                                title="ปิด"
                                aria-label="ปิด"
                            >
                                <CloseIcon />
                            </button>
                        </div>
                        <div className="max-h-[72vh] overflow-y-auto p-4">
                            {selected.filter(name => qrCodes[name]).length > 0 ? (
                                <div className="grid grid-cols-2 gap-3">
                                    {selected.filter(name => qrCodes[name]).map(name => {
                                        const amount = totals[name] || 0
                                        return (
                                            <div key={name} className="rounded-2xl border border-white/10 bg-[#10101a] p-3 text-center shadow-lg shadow-black/10">
                                                <p className="truncate text-sm font-semibold text-white">{name}</p>
                                                <p className="mt-0.5 text-xs font-semibold text-purple-300">฿{amount.toFixed(2)}</p>
                                                <div className="my-3 rounded-2xl bg-white p-2">
                                                    <img src={qrCodes[name]} alt={`QR พร้อมเพย์ ${name}`} className="mx-auto aspect-square w-full max-w-36" />
                                                </div>
                                                <button
                                                    onClick={() => copyPersonImage(name)}
                                                    className={`inline-flex w-full items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-semibold text-white transition-all ${copiedPerson === name ? "bg-emerald-700" : "bg-emerald-600 hover:bg-emerald-500"}`}
                                                >
                                                    <ImageCopyIcon />
                                                    <span>{copiedPerson === name ? "คัดลอกแล้ว" : "คัดลอกรูปนี้"}</span>
                                                </button>
                                            </div>
                                        )
                                    })}
                                </div>
                            ) : (
                                <div className="rounded-2xl border border-white/10 bg-[#10101a] p-6 text-center text-sm text-gray-300">
                                    <p>{qrCopyModalMessage || "ยังไม่มี QR ให้แสดงในตอนนี้"}</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* card สำหรับ screenshot — ใส่ ref ตรงนี้ */}
            <div className="bg-[#13131f] rounded-2xl p-5 space-y-4">
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
    <div key={name} className="space-y-2">
      <div className="bg-[#10101a] border border-gray-800 rounded-xl overflow-hidden">
      <div className="flex justify-between items-start gap-3 px-4 py-3">
        <div className="min-w-0 flex-1">
          <p className="text-base font-semibold text-white">{name}</p>
          {discount > 0 && (
            <p className="text-xs text-emerald-600 mt-0.5">ก่อนลด ฿{beforeDiscount.toFixed(2)} • ลด ฿{discountCut.toFixed(2)}</p>
          )}
          {ownerPayment?.promptpay && (
            <p className="text-xs text-gray-600 mt-1">โอนเข้า {ownerName}</p>
          )}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          <div className="flex gap-1.5">
            <button onClick={() => copyPersonImage(name)} title="คัดลอกรูป QR คนนี้" aria-label="คัดลอกรูป QR คนนี้" className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-white/5 text-gray-500 hover:bg-emerald-600 hover:text-white transition-colors">
              <ImageCopyIcon />
            </button>
            <button onClick={() => sharePersonImage(name)} title="แชร์รูปคนนี้" aria-label="แชร์รูปคนนี้" className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-white/5 text-gray-500 hover:bg-purple-600 hover:text-white transition-colors">
              <ShareIcon />
            </button>
          </div>
          <div className="text-right">
          <p className="text-xs text-gray-600">ยอดโอน</p>
          <p className="text-2xl font-bold text-purple-300">฿{amount.toFixed(2)}</p>
          </div>
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
      </div>
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
