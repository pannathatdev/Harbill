import { useEffect, useState } from "react"
import { api } from "../api"

function formatNumber(value) {
  return new Intl.NumberFormat("th-TH").format(Number(value || 0))
}

function formatMoney(value) {
  return new Intl.NumberFormat("th-TH", {
    style: "currency",
    currency: "THB",
    maximumFractionDigits: 2,
  }).format(Number(value || 0))
}

function formatMb(value) {
  return `${Number(value || 0).toLocaleString("th-TH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} MB`
}

function Metric({ label, value, sub }) {
  return (
    <div className="rounded-xl border border-white/10 bg-[#1c1c2e] p-4">
      <p className="text-xs font-semibold text-gray-500">{label}</p>
      <p className="mt-2 text-2xl font-extrabold text-white">{value}</p>
      {sub && <p className="mt-1 text-xs text-gray-500">{sub}</p>}
    </div>
  )
}

function ListTable({ title, rows, empty, renderRow }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#1c1c2e] p-4">
      <p className="text-sm font-semibold text-white">{title}</p>
      <div className="mt-3 space-y-2">
        {rows?.length ? rows.map(renderRow) : (
          <p className="rounded-xl bg-[#13131f] px-3 py-3 text-center text-xs text-gray-600">{empty}</p>
        )}
      </div>
    </div>
  )
}

export default function AdminPage() {
  const [summary, setSummary] = useState(null)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(() => Boolean(localStorage.getItem("harbill:adminToken")))
  const [adminToken, setAdminToken] = useState(() => localStorage.getItem("harbill:adminToken") || "")
  const [password, setPassword] = useState("")
  const [code, setCode] = useState("")
  const [verifying, setVerifying] = useState(false)

  useEffect(() => {
    if (adminToken) load(adminToken)
  }, [])

  async function unlockAdmin(e) {
    e.preventDefault()
    setVerifying(true)
    setError("")
    try {
      const session = await api.createAdminSession(password, code)
      localStorage.setItem("harbill:adminToken", session.token)
      setAdminToken(session.token)
      setPassword("")
      setCode("")
      await load(session.token)
    } catch (err) {
      localStorage.removeItem("harbill:adminToken")
      setAdminToken("")
      setError(err.message || "ปลดล็อกหลังบ้านไม่สำเร็จ")
    } finally {
      setVerifying(false)
    }
  }

  async function lockAdmin() {
    localStorage.removeItem("harbill:adminToken")
    setAdminToken("")
    setSummary(null)
    setError("")
  }

  async function load(token = adminToken) {
    if (!token) return
    setLoading(true)
    setError("")
    try {
      setSummary(await api.getAdminSummary(token))
    } catch (err) {
      if (/admin|session|401|verification|required|expired/i.test(err.message || "")) {
        localStorage.removeItem("harbill:adminToken")
        setAdminToken("")
      }
      setError(err.message || "โหลดข้อมูลหลังบ้านไม่สำเร็จ")
    } finally {
      setLoading(false)
    }
  }

  if (!adminToken) {
    return (
      <div className="space-y-4">
        <div>
          <h1 className="text-lg font-bold text-white">Admin Dashboard</h1>
          <p className="mt-1 text-xs text-gray-500">ต้องยืนยันรหัสผ่านหลังบ้านและรหัส 6 หลักจาก Authenticator</p>
        </div>
        <form onSubmit={unlockAdmin} className="rounded-2xl border border-white/10 bg-[#1c1c2e] p-5">
          <p className="text-sm font-semibold text-white">ปลดล็อกหลังบ้าน</p>
          <input
            className="mt-4 w-full rounded-xl border border-gray-700 bg-[#13131f] px-3 py-2 text-sm outline-none focus:border-purple-500"
            type="password"
            placeholder="รหัสผ่านหลังบ้าน"
            value={password}
            onChange={e => setPassword(e.target.value)}
            autoComplete="current-password"
          />
          <input
            className="mt-3 w-full rounded-xl border border-gray-700 bg-[#13131f] px-3 py-2 text-center text-lg font-bold tracking-[0.35em] outline-none focus:border-purple-500"
            inputMode="numeric"
            maxLength={6}
            placeholder="000000"
            value={code}
            onChange={e => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            autoComplete="one-time-code"
          />
          <button
            type="submit"
            disabled={verifying || !password || code.length !== 6}
            className="mt-4 w-full rounded-xl bg-purple-600 py-3 text-sm font-bold text-white hover:bg-purple-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {verifying ? "กำลังตรวจสอบ..." : "เข้าสู่หลังบ้าน"}
          </button>
          {error && <p className="mt-3 text-center text-xs text-red-300">{error}</p>}
        </form>
      </div>
    )
  }

  if (loading) {
    return <div className="rounded-2xl bg-[#1c1c2e] p-8 text-center text-sm text-gray-500">กำลังโหลดหลังบ้าน...</div>
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-5 text-center">
        <p className="text-sm font-semibold text-red-200">เข้าไม่ได้หรือยังไม่ได้ตั้งสิทธิ์</p>
        <p className="mt-1 text-xs text-red-100/70">{error}</p>
      </div>
    )
  }

  const totals = summary?.totals || {}
  const costs = summary?.costs || {}
  const env = summary?.environment || {}
  const scanUsage = summary?.scanUsage || {}
  const database = summary?.database || {}
  const dbUsedPercent = Number(database.usedPercent || 0)

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-white">Admin Dashboard</h1>
          <p className="mt-1 text-xs text-gray-500">อัปเดตล่าสุด {new Date(summary.generatedAt).toLocaleString("th-TH")}</p>
        </div>
        <button
          type="button"
          onClick={() => load()}
          className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-gray-300 hover:bg-white/10"
        >
          รีเฟรช
        </button>
        <button
          type="button"
          onClick={lockAdmin}
          className="rounded-xl border border-red-400/20 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-200 hover:bg-red-500/15"
        >
          ล็อก
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Metric label="ผู้ใช้ทั้งหมด" value={formatNumber(totals.users)} sub={`+${formatNumber(totals.usersLast7)} ใน 7 วัน`} />
        <Metric label="Pro Active" value={formatNumber(totals.activePro)} sub="สมาชิกที่ยังไม่หมดอายุ" />
        <Metric label="ผู้เข้าชม" value={formatNumber(totals.visitors)} sub={`วันนี้ ${formatNumber(totals.visitorsToday)} · 7 วัน ${formatNumber(totals.visitorsLast7)}`} />
        <Metric label="Visits" value={formatNumber(totals.pageViews)} sub={`วันนี้ ${formatNumber(totals.pageViewsToday)} · 7 วัน ${formatNumber(totals.pageViewsLast7)}`} />
        <Metric label="รอบที่สร้าง" value={formatNumber(totals.rounds)} sub={`ปิดแล้ว ${formatNumber(totals.closedRounds)} รอบ`} />
        <Metric label="AI scans" value={formatNumber(totals.scans)} sub={`วันนี้ ${formatNumber(totals.scansToday)} · 7 วัน ${formatNumber(totals.scansLast7)}`} />
      </div>

      <div className="rounded-2xl border border-blue-500/20 bg-blue-500/10 p-4">
        <p className="text-sm font-semibold text-blue-100">อัปสลิป / AI scan</p>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <Metric label="สถานะผู้ใช้" value="Free quota" sub={`Free ${scanUsage.freeDailyLimit ?? "-"} ครั้ง/วัน · Pro ไม่จำกัด`} />
          <Metric label="วันนี้" value={formatNumber(totals.scansToday)} sub={`ทั้งหมด ${formatNumber(totals.scans)} ครั้ง`} />
        </div>
      </div>

      <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-amber-100">Database storage</p>
            <p className="mt-1 text-xs text-amber-100/70">
              ใช้ {formatMb(database.mb)}{database.limitMb ? ` จาก ${formatMb(database.limitMb)}` : ""} · {formatNumber(database.tablesCount)} tables
            </p>
          </div>
          <p className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold ${dbUsedPercent >= 80 ? "bg-red-500/20 text-red-200" : "bg-emerald-500/20 text-emerald-200"}`}>
            {database.usedPercent == null ? "no limit" : `${dbUsedPercent.toFixed(1)}%`}
          </p>
        </div>
        {database.limitMb && (
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-black/20">
            <div
              className={`h-full ${dbUsedPercent >= 80 ? "bg-red-400" : "bg-emerald-400"}`}
              style={{ width: `${Math.min(dbUsedPercent, 100)}%` }}
            />
          </div>
        )}
        <p className="mt-2 text-xs text-amber-100/60">Data {formatMb(database.dataMb)} · Index {formatMb(database.indexMb)}</p>
      </div>

      <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4">
        <p className="text-sm font-semibold text-emerald-100">ต้นทุนคร่าว ๆ</p>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <Metric label="AI cost" value={formatMoney(costs.estimatedAiCostThb)} sub={`${formatMoney(costs.aiScanCostThb)} / scan`} />
          <Metric label="รวมต่อเดือน" value={formatMoney(costs.estimatedTotalCostThb)} sub={`server ${formatMoney(costs.serverMonthlyCostThb)}`} />
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-[#1c1c2e] p-4">
        <p className="text-sm font-semibold text-white">Domain / Environment</p>
        <div className="mt-3 space-y-2 text-xs text-gray-400">
          <p className="truncate rounded-xl bg-[#13131f] px-3 py-2">Client: {env.clientUrl || "-"}</p>
          <p className="truncate rounded-xl bg-[#13131f] px-3 py-2">API: {env.apiBaseUrl || "-"}</p>
          <p className="truncate rounded-xl bg-[#13131f] px-3 py-2">Request host: {env.requestHost || "-"}</p>
          <p className="truncate rounded-xl bg-[#13131f] px-3 py-2">Node env: {env.nodeEnv || "-"}</p>
        </div>
      </div>

      <ListTable
        title="AI scan รายวัน"
        rows={scanUsage.daily}
        empty="ยังไม่มีการอัปสลิป"
        renderRow={row => (
          <div key={row.date} className="flex items-center justify-between gap-3 rounded-xl bg-[#13131f] px-3 py-2 text-sm">
            <span className="min-w-0 truncate text-gray-300">{new Date(row.date).toLocaleDateString("th-TH")}</span>
            <span className="shrink-0 text-xs text-gray-500">{formatNumber(row.scans)} ครั้ง · {formatNumber(row.users)} คน</span>
          </div>
        )}
      />

      <ListTable
        title="Domain ที่มี traffic"
        rows={summary.domains}
        empty="ยังไม่มีข้อมูล domain"
        renderRow={row => (
          <div key={row.hostname} className="flex items-center justify-between gap-3 rounded-xl bg-[#13131f] px-3 py-2 text-sm">
            <span className="min-w-0 truncate text-gray-300">{row.hostname}</span>
            <span className="shrink-0 text-xs text-gray-500">{formatNumber(row.visitors)} คน · {formatNumber(row.views)} views</span>
          </div>
        )}
      />

      <ListTable
        title="หน้าแรกที่คนเข้ามา"
        rows={summary.topPaths}
        empty="ยังไม่มี visit"
        renderRow={row => (
          <div key={row.path} className="flex items-center justify-between gap-3 rounded-xl bg-[#13131f] px-3 py-2 text-sm">
            <span className="min-w-0 truncate text-gray-300">{row.path}</span>
            <span className="shrink-0 text-xs text-gray-500">{formatNumber(row.visitors)} คน · {formatNumber(row.views)} views</span>
          </div>
        )}
      />

      <ListTable
        title="ผู้ใช้ล่าสุด"
        rows={summary.recentUsers}
        empty="ยังไม่มีผู้ใช้"
        renderRow={user => (
          <div key={user.id} className="rounded-xl bg-[#13131f] px-3 py-2">
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="min-w-0 truncate text-gray-200">{user.name || user.email}</span>
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${user.isPro ? "bg-emerald-500/20 text-emerald-200" : "bg-white/10 text-gray-500"}`}>
                {user.isPro ? "PRO" : "FREE"}
              </span>
            </div>
            <p className="mt-0.5 truncate text-xs text-gray-600">{user.email}</p>
          </div>
        )}
      />
    </div>
  )
}
