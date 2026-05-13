import { Routes, Route, Navigate, useNavigate } from "react-router-dom"
import { useState, useEffect } from "react"
import LoginPage from "./components/LoginPage"
import AuthCallback from "./components/AuthCallback"
import FriendsPage from "./components/FriendsPage"
import RoundPage from "./components/RoundPage"
import HistoryPage from "./components/HistoryPage"
import { api } from "./api"

const TABS = [
  { id: "/", label: "🍽️", desc: "รอบ" },
  { id: "/friends", label: "👥", desc: "เพื่อน" },
  { id: "/history", label: "🕐", desc: "ประวัติ" },
]

function Layout({ children, user, onLogout }) {
  const navigate = useNavigate()
  const path = window.location.pathname

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-950 to-slate-900 text-white">
      <div className="sticky top-0 z-10 bg-black/20 backdrop-blur-md border-b border-white/10">
        <div className="max-w-lg mx-auto px-4 py-3 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <span className="text-xl">🍽️</span>
            <span className="font-bold text-white">Harbill</span>
          </div>
          <div className="flex items-center gap-3">
            {user?.avatar && <img src={user.avatar} className="w-7 h-7 rounded-full" alt="" />}
            <span className="text-sm text-white/70">{user?.name}</span>
            <button onClick={onLogout} className="text-xs text-white/40 hover:text-white/70">ออก</button>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 pt-5 pb-28">
        {children}
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-10">
        <div className="max-w-lg mx-auto">
          <div className="bg-black/30 backdrop-blur-xl border-t border-white/10 rounded-t-3xl">
            <div className="flex">
              {TABS.map(t => {
                const active = path === t.id
                return (
                  <button key={t.id} onClick={() => navigate(t.id)}
                    className={`flex-1 flex flex-col items-center py-3 gap-0.5 transition-all ${
                      active ? "text-white" : "text-white/30 hover:text-white/60"
                    }`}>
                    <span className="text-xl">{t.label}</span>
                    <span className={`text-xs font-medium ${active ? "text-purple-300" : ""}`}>{t.desc}</span>
                    {active && <div className="w-1 h-1 rounded-full bg-purple-400 mt-0.5"></div>}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function RequireAuth({ children, user, onLogout }) {
  if (!localStorage.getItem("token")) return <Navigate to="/login" replace />
  return <Layout user={user} onLogout={onLogout}>{children}</Layout>
}

export default function App() {
  const [user, setUser] = useState(null)
  const [checking, setChecking] = useState(true)
  const [editRound, setEditRound] = useState(null)
  const navigate = useNavigate()

  useEffect(() => {
    const token = localStorage.getItem("token")
    if (!token) {
      setChecking(false)
      return
    }

    // verify token กับ server ทุกครั้งที่เปิดแอป
    api.me()
      .then(u => {
        if (u?.id) {
          setUser(u)
          localStorage.setItem("user", JSON.stringify(u))
        } else {
          // token หมดอายุหรือใช้ไม่ได้
          localStorage.removeItem("token")
          localStorage.removeItem("user")
        }
      })
      .catch(() => {
        localStorage.removeItem("token")
        localStorage.removeItem("user")
      })
      .finally(() => setChecking(false))
  }, [])

  function handleLogout() {
    localStorage.removeItem("token")
    localStorage.removeItem("user")
    window.location.replace("/login")
  }

  function handleEditRound(round) {
    setEditRound(round)
    navigate("/")
  }

  // รอเช็ค token ก่อน render
  if (checking) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-white/40 text-sm">กำลังโหลด...</div>
      </div>
    )
  }

  return (
    <Routes>
      <Route path="/login" element={
        // ถ้า login แล้ว redirect ไป / เลย
        localStorage.getItem("token")
          ? <Navigate to="/" replace />
          : <LoginPage />
      } />
      <Route path="/auth" element={<AuthCallback />} />
      <Route path="/" element={
        <RequireAuth user={user} onLogout={handleLogout}>
          <RoundPage
            user={user}
            initialRound={editRound}
            onRoundConsumed={() => setEditRound(null)}
          />
        </RequireAuth>
      } />
      <Route path="/friends" element={
        <RequireAuth user={user} onLogout={handleLogout}>
          <FriendsPage />
        </RequireAuth>
      } />
      <Route path="/history" element={
        <RequireAuth user={user} onLogout={handleLogout}>
          <HistoryPage onEditRound={handleEditRound} />
        </RequireAuth>
      } />
    </Routes>
  )
}
