import { useState, useEffect } from "react"
import { api } from "../api"
import { PageHeader } from "./HelpTip"

function EditIcon() {
    return (
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 20h9" />
            <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
        </svg>
    )
}

function ChevronIcon({ open }) {
    return (
        <svg viewBox="0 0 24 24" className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m6 9 6 6 6-6" />
        </svg>
    )
}

export default function HistoryPage({ onEditRound }) {
    const [rounds, setRounds] = useState([])
    const [open, setOpen] = useState(null)

    useEffect(() => { load() }, [])

    async function load() {
        const all = await api.getRounds({ skipCache: true })
        setRounds(all)
    }

    async function reopenRound(round) {
        await api.reopenRound(round.id)
        onEditRound(round)
    }
    return (
        <>
        <PageHeader
          title="ประวัติ"
          desc={
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              <li>รอบที่ปิดแล้วทั้งหมดจะแสดงที่นี่</li>
              <li>กดที่รอบเพื่อดูรายละเอียดและยอดแต่ละคน</li>
              <li>ใช้ปุ่มไอคอนแก้ไขเมื่ออยากกลับไปแก้รายการ</li>
            </ul>
          }
        />
        <div className="space-y-4">
            {rounds.length === 0
                ? <div className="bg-[#1c1c2e] rounded-2xl p-8 text-center text-gray-700 text-sm">ยังไม่มีประวัติ</div>
                : rounds.map(r => {
                    const total = r.items.reduce((s, i) => s + i.price, 0)
                    const date = new Date(r.created_at).toLocaleDateString("th-TH", {
                        year: "numeric", month: "short", day: "numeric"
                    })
                    const isOpen = open === r.id

                    const totals = {}
                    r.joiners.forEach(n => totals[n] = 0)
r.items.forEach(item => {
  const sp = item.splitWith || []
  if (sp.length === 0) return
  const share = item.price / sp.length  // หารตามจริง
  sp.forEach(n => {
    if (totals[n] !== undefined) totals[n] += share
  })
})

// ปัดขึ้นแค่ตอนสรุป
r.joiners.forEach(n => {
  totals[n] = Math.ceil((totals[n] || 0) * 100) / 100
})

                    // ปัดขึ้นอีกรอบ
                    r.joiners.forEach(n => {
                        totals[n] = Math.ceil((totals[n] || 0) * 100) / 100
                    })

                    return (
                        <div key={r.id} className="bg-[#1c1c2e] rounded-2xl overflow-hidden">
                            {/* header */}
                            <div
                                className="flex justify-between items-center p-4 cursor-pointer hover:bg-[#252540]"
                                onClick={() => setOpen(isOpen ? null : r.id)}
                            >
                                <div>
                                    <p className="font-medium text-sm">{r.name}</p>
                                    <p className="text-xs text-gray-600">{date} • {r.joiners.length} คน • {r.closed_at ? "ปิดแล้ว" : "ยังไม่ปิด"}</p>
                                </div>
                                <div className="flex items-center gap-3">
                                    <span className="text-emerald-400 font-semibold">฿{total.toFixed(2)}</span>
                                    <span className="text-gray-600">
                                        <ChevronIcon open={isOpen} />
                                    </span>
                                </div>
                            </div>

                            {/* detail */}
                            {isOpen && (
                                <div className="px-4 pb-4 space-y-3 border-t border-gray-800">

                                    {/* รายการ */}
                                    <div className="pt-3 space-y-1">
                                        <p className="text-xs text-gray-600 mb-2">รายการ</p>
                                        {r.items.map(item => {
                                            const sp = item.splitWith || []
                                            return (
                                                <div key={item.id} className="flex justify-between items-start bg-[#13131f] px-3 py-2 rounded-xl">
                                                    <div>
                                                        <p className="text-sm">{item.name}</p>
                                                        <p className="text-xs text-gray-600">{sp.join(", ") || "ไม่มีคนหาร"}</p>
                                                    </div>
                                                    <span className="text-emerald-400 text-sm">฿{item.price.toFixed(2)}</span>
                                                </div>
                                            )
                                        })}
                                    </div>

                                    {/* ยอดแต่ละคน */}
                                    <div className="space-y-2">
                                        <p className="text-xs text-gray-600">💰 แต่ละคนจ่าย</p>
                                        {r.joiners.map(name => (
                                            <div key={name} className="flex justify-between bg-[#13131f] px-3 py-2 rounded-xl text-sm">
                                                <span>{name}</span>
                                                <span className="text-purple-400 font-medium">฿{(totals[name] || 0).toFixed(2)}</span>
                                            </div>
                                        ))}
                                    </div>

                                    {/* ปุ่มแก้ไข */}
                                    <button
                                        onClick={() => reopenRound(r)}
                                        title="เปิดแก้ไขรอบนี้"
                                        aria-label="เปิดแก้ไขรอบนี้"
                                        className="w-full inline-flex items-center justify-center gap-2 bg-[#252540] hover:bg-[#2e2e50] py-2.5 rounded-xl text-sm text-gray-300 font-medium"
                                    >
                                        <EditIcon />
                                        <span>เปิดแก้ไขรอบนี้</span>
                                    </button>
                                </div>
                            )}
                        </div>
                    )
                })
            }
        </div>
        </>
    )
}
