import { useState, useEffect, useRef } from "react"
import { api } from "../api"
import { PageHeader } from "./HelpTip"

const BANKS = [
  "กสิกรไทย", "กรุงเทพ", "กรุงไทย", "ไทยพาณิชย์",
  "ทหารไทยธนชาต", "กรุงศรี", "ออมสิน", "ธ.ก.ส.", "พร้อมเพย์อย่างเดียว"
]

function IconButton({ onClick, title, children, className = "" }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={title}
      className={`inline-flex h-8 w-8 items-center justify-center rounded-lg bg-white/5 text-gray-500 transition-all hover:bg-white/10 hover:text-white ${className}`}
    >
      {children}
    </button>
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

function SaveIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2Z" />
      <path d="M17 21v-8H7v8" />
      <path d="M7 3v5h8" />
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

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  )
}

export default function FriendsPage() {
  const [friends, setFriends] = useState([])
  const [groups, setGroups] = useState([])
  const [paymentInfo, setPaymentInfo] = useState({})
  const [view, setView] = useState("friends")
  const [friendInput, setFriendInput] = useState("")
  const [groupInput, setGroupInput] = useState("")
  const [editingGroupId, setEditingGroupId] = useState(null)
  const [editingGroupName, setEditingGroupName] = useState("")
  const [newMemberInputs, setNewMemberInputs] = useState({})
  const [editPayment, setEditPayment] = useState(null)
  const [payForm, setPayForm] = useState({
    bank_name: "", account_number: "", promptpay: "", display_name: ""
  })
  const [loading, setLoading] = useState(true)
  const [busyAction, setBusyAction] = useState("")
  const promptpayInputRef = useRef(null)

  useEffect(() => { load() }, [])

  useEffect(() => {
    if (editPayment) promptpayInputRef.current?.focus()
  }, [editPayment])

  async function load() {
    setLoading(true)
    try {
      const [f, g, p] = await Promise.all([
        api.getFriends(), api.getGroups(), api.getPaymentInfo()
      ])
      setFriends(f)
      setGroups(g)
      const pm = {}
      p.forEach(item => pm[item.friend_name] = item)
      setPaymentInfo(pm)
    } finally {
      setLoading(false)
    }
  }

  async function addFriend() {
    const name = friendInput.trim()
    if (!name) return
    setBusyAction("friend")
    try {
      await api.addFriend(name)
      setFriendInput("")
      await load()
    } finally {
      setBusyAction("")
    }
  }

  async function deleteFriend(id) {
    await api.deleteFriend(id)
    load()
  }

  async function addGroup() {
    const name = groupInput.trim()
    if (!name) return
    setBusyAction("group")
    try {
      await api.addGroup(name)
      setGroupInput("")
      await load()
    } finally {
      setBusyAction("")
    }
  }

  async function deleteGroup(id) {
    await api.deleteGroup(id)
    load()
  }

  function startEditGroup(group) {
    setEditingGroupId(group.id)
    setEditingGroupName(group.name)
  }

  function cancelEditGroup() {
    setEditingGroupId(null)
    setEditingGroupName("")
  }

  async function saveGroupName() {
    const name = editingGroupName.trim()
    if (!name || !editingGroupId) return
    await api.updateGroup(editingGroupId, name)
    cancelEditGroup()
    load()
  }

  async function addMember(gid, name) {
    await api.addGroupMember(gid, name)
    load()
  }

  async function addNewMemberToGroup(group) {
    const name = (newMemberInputs[group.id] || "").trim()
    if (!name) return

    const existing = friends.find(f => f.name.trim().toLowerCase() === name.toLowerCase())
    if (!existing) await api.addFriend(name)
    await api.addGroupMember(group.id, existing?.name || name)
    setNewMemberInputs(prev => ({ ...prev, [group.id]: "" }))
    load()
  }

  async function removeMember(gid, name) {
    await api.removeGroupMember(gid, name)
    load()
  }

  function openPaymentEdit(friend) {
    setEditPayment(friend.name)
    const existing = paymentInfo[friend.name]
    setPayForm({
      bank_name: existing?.bank_name || "",
      account_number: existing?.account_number || "",
      promptpay: existing?.promptpay || "",
      display_name: existing?.display_name || friend.name
    })
  }

  async function savePayment() {
    const promptpay = payForm.promptpay.trim()
    const bankName = payForm.bank_name || (promptpay ? "พร้อมเพย์อย่างเดียว" : "")
    setBusyAction(`payment:${editPayment}`)
    try {
      await api.savePaymentInfo({
        friend_name: editPayment,
        ...payForm,
        bank_name: bankName,
        account_number: bankName === "พร้อมเพย์อย่างเดียว" ? "" : payForm.account_number,
        promptpay
      })
      setEditPayment(null)
      await load()
    } finally {
      setBusyAction("")
    }
  }

  async function deletePayment(name) {
    await api.deletePaymentInfo(name)
    load()
  }

  function paymentSummary(name) {
    const p = paymentInfo[name]
    if (!p) return null
    if (p.promptpay && p.bank_name === "พร้อมเพย์อย่างเดียว") return `พร้อมเพย์ ${p.promptpay}`
    if (p.promptpay && p.bank_name) return `${p.bank_name} ${p.account_number} | พพ. ${p.promptpay}`
    if (p.bank_name) return `${p.bank_name} ${p.account_number}`
    return null
  }

  return (
    <>
      <PageHeader
        title="เพื่อน / กลุ่ม"
        desc={
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            <li><b>เพื่อน</b> — เพิ่มชื่อเพื่อนไว้ที่นี่ก่อน ระบบจะจำไว้ตลอด ไม่ต้องพิมซ้ำทุกรอบ</li>
            <li><b>กลุ่ม</b> — จัดกลุ่มเพื่อน เช่น "กลุ่มงาน" "กลุ่มบ้าน" ตอนเปิดรอบกดดึงทั้งกลุ่มมาได้เลยทีเดียว</li>
            <li><b>บัญชี</b> — กด "+ บัญชี" ใส่เลขพร้อมเพย์หรือธนาคาร ตอนสรุปยอดจะแสดงให้เพื่อนโอนได้เลย</li>
          </ul>
        }
      />
      <div className="space-y-4">
      <div className="flex gap-2 mb-2">
        {[
          { id: "friends", label: "เพื่อน" },
          { id: "groups", label: "กลุ่ม" },
        ].map(v => (
          <button key={v.id} onClick={() => setView(v.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium ${
              view === v.id ? "bg-purple-600 text-white" : "bg-[#252540] text-gray-400"
            }`}>
            {v.label}
          </button>
        ))}
      </div>
      {loading && (
        <div className="rounded-2xl bg-[#1c1c2e] p-6 text-center text-sm text-gray-500">
          กำลังโหลดข้อมูล...
        </div>
      )}

      {/* ── เพื่อน ── */}
      {!loading && view === "friends" && (
        <div className="bg-[#1c1c2e] rounded-2xl p-4 space-y-3">
          <p className="text-xs text-gray-500">รายชื่อเพื่อนทั้งหมด</p>
          <div className="flex gap-2">
            <input
              className="flex-1 bg-[#13131f] border border-gray-700 rounded-xl px-3 py-2 text-sm outline-none focus:border-purple-500"
              placeholder="ชื่อเพื่อน..."
              value={friendInput}
              onChange={e => setFriendInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && addFriend()}
            />
            <button
              onClick={addFriend}
              disabled={busyAction === "friend"}
              className="bg-emerald-600 hover:bg-emerald-500 px-4 rounded-xl text-sm font-medium disabled:cursor-not-allowed disabled:opacity-60">
              {busyAction === "friend" ? "กำลัง..." : "+ เพิ่ม"}
            </button>
          </div>

          {friends.length === 0
            ? <p className="text-center text-gray-700 text-sm py-2">ยังไม่มีเพื่อน</p>
            : friends.map(f => (
              <div key={f.id}>
                <div className="flex items-center justify-between bg-[#13131f] px-3 py-2 rounded-xl">
                  <div>
                    <p className="text-sm">{f.name}</p>
                    {paymentSummary(f.name) && (
                      <p className="text-xs text-gray-600 mt-0.5">{paymentSummary(f.name)}</p>
                    )}
                  </div>
                  <div className="flex gap-2 items-center">
                    <button
                      onClick={() => openPaymentEdit(f)}
                      title={paymentInfo[f.name] ? "แก้บัญชี" : "เพิ่มบัญชี"}
                      aria-label={paymentInfo[f.name] ? "แก้บัญชี" : "เพิ่มบัญชี"}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-purple-500/10 text-purple-300 transition-all hover:bg-purple-600 hover:text-white"
                    >
                      {paymentInfo[f.name] ? <EditIcon /> : <PlusIcon />}
                    </button>
                    <IconButton onClick={() => deleteFriend(f.id)} title="ลบเพื่อน" className="hover:bg-red-600 hover:text-white">
                      <TrashIcon />
                    </IconButton>
                  </div>
                </div>

                {/* form แก้บัญชี */}
                {editPayment === f.name && (
                  <div className="bg-[#252540] rounded-xl p-3 mt-1 space-y-2">
                    <p className="text-xs text-gray-500">ข้อมูลการรับเงิน</p>

                    <input
                      className="w-full bg-[#13131f] border border-gray-700 rounded-lg px-3 py-2 text-sm outline-none focus:border-purple-500"
                      placeholder="ชื่อที่แสดง เช่น บัญชีสมชาย"
                      value={payForm.display_name}
                      onChange={e => setPayForm(p => ({ ...p, display_name: e.target.value }))}
                      onKeyDown={e => e.key === "Enter" && savePayment()}
                    />

                    <select
                      className="w-full bg-[#13131f] border border-gray-700 rounded-lg px-3 py-2 text-sm outline-none"
                      value={payForm.bank_name}
                      onChange={e => setPayForm(p => ({ ...p, bank_name: e.target.value }))}
                    >
                      <option value="">เลือกธนาคาร...</option>
                      {BANKS.map(b => <option key={b} value={b}>{b}</option>)}
                    </select>

                    {payForm.bank_name && payForm.bank_name !== "พร้อมเพย์อย่างเดียว" && (
                      <input
                        className="w-full bg-[#13131f] border border-gray-700 rounded-lg px-3 py-2 text-sm outline-none focus:border-purple-500"
                        placeholder="เลขบัญชี เช่น 123-4-56789-0"
                        value={payForm.account_number}
                        onChange={e => setPayForm(p => ({ ...p, account_number: e.target.value }))}
                        onKeyDown={e => e.key === "Enter" && savePayment()}
                      />
                    )}

                    <input
                      ref={promptpayInputRef}
                      className="w-full bg-[#13131f] border border-gray-700 rounded-lg px-3 py-2 text-sm outline-none focus:border-purple-500"
                      placeholder="เบอร์พร้อมเพย์ (ถ้ามี)"
                      value={payForm.promptpay}
                      onChange={e => setPayForm(p => ({ ...p, promptpay: e.target.value }))}
                      onKeyDown={e => e.key === "Enter" && savePayment()}
                    />

                    <div className="flex gap-2 pt-1">
                      <button onClick={savePayment}
                        disabled={busyAction === `payment:${editPayment}`}
                        title="บันทึก"
                        aria-label="บันทึก"
                        className="flex-1 inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 py-2 rounded-lg text-sm font-medium disabled:cursor-not-allowed disabled:opacity-60">
                        <SaveIcon />
                        <span>{busyAction === `payment:${editPayment}` ? "กำลังบันทึก..." : "บันทึก"}</span>
                      </button>
                      {paymentInfo[f.name] && (
                        <IconButton onClick={() => deletePayment(f.name)} title="ลบบัญชี" className="h-9 w-9 bg-[#13131f] hover:bg-red-600 hover:text-white">
                          <TrashIcon />
                        </IconButton>
                      )}
                      <IconButton onClick={() => setEditPayment(null)} title="ยกเลิก" className="h-9 w-9 bg-[#13131f]">
                        <CloseIcon />
                      </IconButton>
                    </div>
                  </div>
                )}
              </div>
            ))
          }
        </div>
      )}

      {/* ── กลุ่ม ── */}
      {!loading && view === "groups" && (
        <div className="space-y-3">
          <div className="bg-[#1c1c2e] rounded-2xl p-4">
            <p className="text-xs text-gray-500 mb-3">สร้างกลุ่มใหม่</p>
            <div className="flex gap-2">
              <input
                className="flex-1 bg-[#13131f] border border-gray-700 rounded-xl px-3 py-2 text-sm outline-none focus:border-purple-500"
                placeholder="ชื่อกลุ่ม เช่น กลุ่มงาน..."
                value={groupInput}
                onChange={e => setGroupInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && addGroup()}
              />
              <button
                onClick={addGroup}
                disabled={busyAction === "group"}
                className="bg-emerald-600 hover:bg-emerald-500 px-4 rounded-xl text-sm font-medium disabled:cursor-not-allowed disabled:opacity-60">
                {busyAction === "group" ? "กำลัง..." : "+ สร้าง"}
              </button>
            </div>
          </div>

          {groups.map(group => (
            <div key={group.id} className="bg-[#1c1c2e] rounded-2xl p-4 space-y-3">
              <div className="flex justify-between items-center">
                {editingGroupId === group.id ? (
                  <div className="flex flex-1 items-center gap-2">
                    <input
                      className="min-w-0 flex-1 bg-[#13131f] border border-gray-700 rounded-xl px-3 py-2 text-sm outline-none focus:border-purple-500"
                      value={editingGroupName}
                      onChange={e => setEditingGroupName(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === "Enter") saveGroupName()
                        if (e.key === "Escape") cancelEditGroup()
                      }}
                      autoFocus
                    />
                    <IconButton onClick={saveGroupName} title="บันทึกชื่อกลุ่ม" className="bg-emerald-600 text-white hover:bg-emerald-500">
                      <SaveIcon />
                    </IconButton>
                    <IconButton onClick={cancelEditGroup} title="ยกเลิก">
                      <CloseIcon />
                    </IconButton>
                  </div>
                ) : (
                  <>
                    <button
                      onClick={() => startEditGroup(group)}
                      className="min-w-0 flex-1 text-left"
                      title="แก้ไขชื่อกลุ่ม"
                    >
                      <p className="truncate text-sm font-medium text-white">{group.name}</p>
                    </button>
                    <div className="flex items-center gap-2">
                      <IconButton onClick={() => startEditGroup(group)} title="แก้ไขชื่อกลุ่ม" className="hover:bg-purple-600 hover:text-white">
                        <EditIcon />
                      </IconButton>
                      <IconButton onClick={() => deleteGroup(group.id)} title="ลบกลุ่ม" className="hover:bg-red-600 hover:text-white">
                        <TrashIcon />
                      </IconButton>
                    </div>
                  </>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {group.members.length === 0
                  ? <p className="text-xs text-gray-700">ยังไม่มีสมาชิก</p>
                  : group.members.map(name => (
                    <span key={name} className="flex items-center gap-1 bg-[#13131f] px-3 py-1 rounded-full text-xs">
                      {name}
                      <button onClick={() => removeMember(group.id, name)}
                        title="ลบสมาชิก"
                        aria-label="ลบสมาชิก"
                        className="inline-flex h-5 w-5 items-center justify-center rounded-full text-gray-600 hover:bg-red-600 hover:text-white">
                        <CloseIcon />
                      </button>
                    </span>
                  ))
                }
              </div>
              <div className="flex gap-2">
                <div className="flex-1">
                  <input
                    list={`group-members-${group.id}`}
                    className="w-full bg-[#13131f] border border-gray-700 rounded-xl px-3 py-2 text-sm outline-none focus:border-purple-500"
                    placeholder="พิมพ์ชื่อเพื่อนแล้วกดเพิ่ม..."
                    value={newMemberInputs[group.id] || ""}
                    onChange={e => setNewMemberInputs(prev => ({ ...prev, [group.id]: e.target.value }))}
                    onKeyDown={e => {
                      if (e.key === "Enter") addNewMemberToGroup(group)
                    }}
                  />
                  <datalist id={`group-members-${group.id}`}>
                    {friends.filter(f => !group.members.includes(f.name)).map(f => (
                      <option key={f.id} value={f.name} />
                    ))}
                  </datalist>
                </div>
                <button onClick={() => addNewMemberToGroup(group)}
                  className="bg-emerald-600 hover:bg-emerald-500 px-4 rounded-xl text-sm font-medium">
                  + เพิ่ม
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
    </>
  )

}
