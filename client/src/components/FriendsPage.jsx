import { useState, useEffect } from "react"
import { api } from "../api"
import { PageHeader } from "./HelpTip"

const BANKS = [
  "กสิกรไทย", "กรุงเทพ", "กรุงไทย", "ไทยพาณิชย์",
  "ทหารไทยธนชาต", "กรุงศรี", "ออมสิน", "ธ.ก.ส.", "พร้อมเพย์อย่างเดียว"
]

export default function FriendsPage() {
  const [friends, setFriends] = useState([])
  const [groups, setGroups] = useState([])
  const [paymentInfo, setPaymentInfo] = useState({})
  const [view, setView] = useState("friends")
  const [friendInput, setFriendInput] = useState("")
  const [groupInput, setGroupInput] = useState("")
  const [editPayment, setEditPayment] = useState(null)
  const [payForm, setPayForm] = useState({
    bank_name: "", account_number: "", promptpay: "", display_name: ""
  })

  useEffect(() => { load() }, [])

  async function load() {
    const [f, g, p] = await Promise.all([
      api.getFriends(), api.getGroups(), api.getPaymentInfo()
    ])
    setFriends(f)
    setGroups(g)
    const pm = {}
    p.forEach(item => pm[item.friend_name] = item)
    setPaymentInfo(pm)
  }

  async function addFriend() {
    const name = friendInput.trim()
    if (!name) return
    await api.addFriend(name)
    setFriendInput("")
    load()
  }

  async function deleteFriend(id) {
    await api.deleteFriend(id)
    load()
  }

  async function addGroup() {
    const name = groupInput.trim()
    if (!name) return
    await api.addGroup(name)
    setGroupInput("")
    load()
  }

  async function deleteGroup(id) {
    await api.deleteGroup(id)
    load()
  }

  async function addMember(gid, name) {
    await api.addGroupMember(gid, name)
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
    await api.savePaymentInfo({
      friend_name: editPayment,
      ...payForm
    })
    setEditPayment(null)
    load()
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

      {/* ── เพื่อน ── */}
      {view === "friends" && (
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
            <button onClick={addFriend}
              className="bg-emerald-600 hover:bg-emerald-500 px-4 rounded-xl text-sm font-medium">
              + เพิ่ม
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
                      className="text-xs text-purple-400 hover:text-purple-300"
                    >
                      {paymentInfo[f.name] ? "แก้บัญชี" : "+ บัญชี"}
                    </button>
                    <button onClick={() => deleteFriend(f.id)}
                      className="text-xs text-gray-700 hover:text-red-400">ลบ</button>
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
                      />
                    )}

                    <input
                      className="w-full bg-[#13131f] border border-gray-700 rounded-lg px-3 py-2 text-sm outline-none focus:border-purple-500"
                      placeholder="เบอร์พร้อมเพย์ (ถ้ามี)"
                      value={payForm.promptpay}
                      onChange={e => setPayForm(p => ({ ...p, promptpay: e.target.value }))}
                    />

                    <div className="flex gap-2 pt-1">
                      <button onClick={savePayment}
                        className="flex-1 bg-emerald-600 hover:bg-emerald-500 py-2 rounded-lg text-sm font-medium">
                        บันทึก
                      </button>
                      {paymentInfo[f.name] && (
                        <button onClick={() => deletePayment(f.name)}
                          className="px-3 bg-[#13131f] hover:bg-red-900 py-2 rounded-lg text-xs text-gray-500 hover:text-red-400">
                          ลบ
                        </button>
                      )}
                      <button onClick={() => setEditPayment(null)}
                        className="px-3 bg-[#13131f] py-2 rounded-lg text-xs text-gray-600">
                        ยกเลิก
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))
          }
        </div>
      )}

      {/* ── กลุ่ม ── */}
      {view === "groups" && (
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
              <button onClick={addGroup}
                className="bg-emerald-600 hover:bg-emerald-500 px-4 rounded-xl text-sm font-medium">
                + สร้าง
              </button>
            </div>
          </div>

          {groups.map(group => (
            <div key={group.id} className="bg-[#1c1c2e] rounded-2xl p-4 space-y-3">
              <div className="flex justify-between items-center">
                <p className="text-sm font-medium">{group.name}</p>
                <button onClick={() => deleteGroup(group.id)}
                  className="text-xs text-gray-700 hover:text-red-400">ลบกลุ่ม</button>
              </div>
              <div className="flex flex-wrap gap-2">
                {group.members.length === 0
                  ? <p className="text-xs text-gray-700">ยังไม่มีสมาชิก</p>
                  : group.members.map(name => (
                    <span key={name} className="flex items-center gap-1 bg-[#13131f] px-3 py-1 rounded-full text-xs">
                      {name}
                      <button onClick={() => removeMember(group.id, name)}
                        className="text-gray-700 hover:text-red-400">✕</button>
                    </span>
                  ))
                }
              </div>
              <select
                className="w-full bg-[#13131f] border border-gray-700 rounded-xl px-3 py-2 text-sm outline-none"
                value=""
                onChange={e => { if (e.target.value) addMember(group.id, e.target.value) }}
              >
                <option value="">+ เพิ่มสมาชิก...</option>
                {friends.filter(f => !group.members.includes(f.name)).map(f => (
                  <option key={f.id} value={f.name}>{f.name}</option>
                ))}
              </select>
            </div>
          ))}
        </div>
      )}
    </div>
    </>
  )

}