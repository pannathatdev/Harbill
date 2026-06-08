import { Routes, Route, Navigate, useNavigate, useLocation } from "react-router-dom"
import { useState, useEffect } from "react"
import LoginPage from "./components/LoginPage"
import AuthCallback from "./components/AuthCallback"
import LandingPage from "./components/LandingPage"
import FriendsPage from "./components/FriendsPage"
import RoundPage from "./components/RoundPage"
import HistoryPage from "./components/HistoryPage"
import DuesPage from "./components/DuesPage"
import PublicPayPage from "./components/PublicPayPage"
import ProPage from "./components/ProPage"
import AdminPage from "./components/AdminPage"
import { api } from "./api"
import { AdSlot, SupportLink } from "./components/Monetization"

const TABS = [
  { id: "/app", icon: BillIcon, labelTh: "รอบบิล", descTh: "หารบิล", labelEn: "Bills", descEn: "Split" },
  { id: "/dues", icon: DuesIcon, labelTh: "ยอดค้าง", descTh: "ติดตาม", labelEn: "Dues", descEn: "Track" },
  { id: "/friends", icon: ContactsIcon, labelTh: "รายชื่อ", descTh: "เพื่อน", labelEn: "Contacts", descEn: "People" },
  { id: "/history", icon: HistoryIcon, labelTh: "ประวัติ", descTh: "รอบเดิม", labelEn: "History", descEn: "Rounds" },
  { id: "/pro", icon: PlanIcon, labelTh: "สมาชิก", descTh: "Pro", labelEn: "Plan", descEn: "Pro" },
]

function BillIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 2v20" />
      <path d="M16 2v20" />
      <path d="M4 7h16" />
      <path d="M4 17h16" />
    </svg>
  )
}

function DuesIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 5h16" />
      <path d="M4 12h10" />
      <path d="M4 19h7" />
      <path d="M17 15l2 2 4-4" />
    </svg>
  )
}

function ContactsIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  )
}

function HistoryIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12a9 9 0 1 0 3-6.7" />
      <path d="M3 4v6h6" />
      <path d="M12 7v5l3 2" />
    </svg>
  )
}

function PlanIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2l3 7h7l-5.5 4.5 2 7L12 16l-6.5 4.5 2-7L2 9h7l3-7z" />
    </svg>
  )
}

function GlobeIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M2 12h20" />
      <path d="M12 2a15 15 0 0 1 0 20" />
      <path d="M12 2a15 15 0 0 0 0 20" />
    </svg>
  )
}

function SunIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2" />
      <path d="M12 20v2" />
      <path d="M4.93 4.93l1.41 1.41" />
      <path d="M17.66 17.66l1.41 1.41" />
      <path d="M2 12h2" />
      <path d="M20 12h2" />
      <path d="M4.93 19.07l1.41-1.41" />
      <path d="M17.66 6.34l1.41-1.41" />
    </svg>
  )
}

function MoonIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  )
}

function analyticsId(key, storage = localStorage) {
  const storageKey = `harbill:${key}`
  let value = storage.getItem(storageKey)
  if (!value) {
    value = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
    storage.setItem(storageKey, value)
  }
  return value
}

function LogoutIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="M16 17l5-5-5-5" />
      <path d="M21 12H9" />
    </svg>
  )
}

function Layout({ children, user, onLogout, lang, onLangChange, darkMode, onThemeChange }) {
  const navigate = useNavigate()
  const path = window.location.pathname
  const isPro = user?.isPro || user?.plan === "pro"
  const contentWidth = "max-w-4xl"
  const shell = darkMode ? "bg-[#0f172a] text-white" : "bg-[#f5f7fb] text-slate-950"
  const topbar = darkMode ? "border-white/10 bg-slate-950/90" : "border-slate-200 bg-white/95"
  const brandText = darkMode ? "text-white" : "text-slate-950"
  const mutedText = darkMode ? "text-white/70" : "text-slate-500"
  const iconButton = darkMode
    ? "border-white/10 bg-white/5 text-white/45 hover:border-red-400/40 hover:bg-red-500/10 hover:text-red-200"
    : "border-slate-200 bg-slate-50 text-slate-500 hover:border-red-200 hover:bg-red-50 hover:text-red-600"
  const nav = darkMode ? "border-white/10 bg-slate-950/95" : "border-slate-200 bg-white/95"

  return (
    <div className={`min-h-screen ${shell}`}>
      <div className={`sticky top-0 z-10 border-b backdrop-blur-sm ${topbar}`}>
        <div className={`${contentWidth} mx-auto px-4 py-3 flex justify-between items-center`}>
          <div className="flex items-center gap-2">
            <span className="text-xl">🍽️</span>
            <span className={`font-bold ${brandText}`}>Harbill</span>
          </div>
          <div className="flex items-center gap-3">
            {user?.avatar && <img src={user.avatar} className="w-7 h-7 rounded-full" alt="" />}
            <span className={`hidden text-sm sm:inline ${mutedText}`}>{user?.name}</span>
            <button
              onClick={onThemeChange}
              title={darkMode ? "เปลี่ยนเป็นโหมดสว่าง" : "เปลี่ยนเป็นโหมดมืด"}
              aria-label={darkMode ? "เปลี่ยนเป็นโหมดสว่าง" : "เปลี่ยนเป็นโหมดมืด"}
              className={`inline-flex h-8 w-8 items-center justify-center rounded-xl border ${darkMode ? "border-white/10 bg-white/5 text-white/70" : "border-slate-200 bg-slate-50 text-slate-600"}`}
            >
              {darkMode ? <MoonIcon /> : <SunIcon />}
            </button>
            <button
              onClick={onLangChange}
              title={lang === "th" ? "Switch to English" : "เปลี่ยนเป็นภาษาไทย"}
              aria-label={lang === "th" ? "Switch to English" : "เปลี่ยนเป็นภาษาไทย"}
              className={`relative inline-flex h-8 w-8 items-center justify-center rounded-xl border ${darkMode ? "border-white/10 bg-white/5 text-white/70" : "border-slate-200 bg-slate-50 text-slate-600"}`}
            >
              <GlobeIcon />
              <span className={`absolute -bottom-1 -right-1 rounded px-1 text-[9px] font-black ${darkMode ? "bg-slate-800 text-sky-200" : "bg-white text-sky-700"}`}>
                {lang === "th" ? "TH" : "EN"}
              </span>
            </button>
            <button
              onClick={onLogout}
              title="ออกจากระบบ"
              aria-label="ออกจากระบบ"
              className={`inline-flex h-8 w-8 items-center justify-center rounded-xl border transition-all ${iconButton}`}
            >
              <LogoutIcon />
            </button>
          </div>
        </div>
      </div>

      <div className={`${contentWidth} mx-auto px-4 pt-5 pb-28`}>
        {children}
        {!isPro && path !== "/dues" && (
          <div className="mt-6 space-y-3">
            <AdSlot className="overflow-hidden rounded-2xl bg-white/5 border border-white/10 px-2 py-3" />
            <SupportLink />
          </div>
        )}
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-10">
        <div className={`${contentWidth} mx-auto`}>
          <div className={`rounded-t-3xl border-t backdrop-blur-sm ${nav}`}>
            <div className="flex">
              {TABS.map(t => {
                const active = path === t.id
                const label = lang === "th" ? t.labelTh : t.labelEn
                const desc = lang === "th" ? t.descTh : t.descEn
                const Icon = t.icon
                return (
                  <button key={t.id} onClick={() => navigate(t.id)}
                    title={label}
                    aria-label={label}
                    className={`flex-1 flex flex-col items-center py-3 gap-0.5 transition-all ${
                      active
                        ? darkMode ? "text-white" : "text-slate-950"
                        : darkMode ? "text-white/35 hover:text-white/65" : "text-slate-400 hover:text-slate-700"
                    }`}>
                    <Icon />
                    <span className={`text-[11px] font-medium ${active ? "text-sky-300" : ""}`}>{desc}</span>
                    {active && <div className="w-1 h-1 rounded-full bg-sky-400 mt-0.5"></div>}
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

function RequireAuth({ children, user, onLogout, lang, onLangChange, darkMode, onThemeChange }) {
  if (!localStorage.getItem("token")) return <Navigate to="/login" replace />
  return <Layout user={user} onLogout={onLogout} lang={lang} onLangChange={onLangChange} darkMode={darkMode} onThemeChange={onThemeChange}>{children}</Layout>
}

export default function App() {
  const [user, setUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("user") || "null")
    } catch {
      return null
    }
  })
  const [checking, setChecking] = useState(true)
  const [editRound, setEditRound] = useState(null)
  const [lang, setLang] = useState(() => localStorage.getItem("harbill:lang") || "th")
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem("harbill:theme") !== "light")
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    localStorage.setItem("harbill:lang", lang)
  }, [lang])

  useEffect(() => {
    localStorage.setItem("harbill:theme", darkMode ? "dark" : "light")
    document.documentElement.dataset.theme = darkMode ? "dark" : "light"
  }, [darkMode])

  function toggleLanguage() {
    setLang(value => value === "th" ? "en" : "th")
  }

  function toggleTheme() {
    setDarkMode(value => !value)
  }

  useEffect(() => {
    const metaDescription = document.querySelector('meta[name="description"]')
    const map = {
      "/": {
        title: "Harbill (หารบิล) - แอปหารบิล สรุปยอด และสร้าง QR พร้อมเพย์",
        description: "Harbill แอปหารบิลภาษาไทย ช่วยแยกค่าอาหาร ค่าใช้จ่ายทริป สรุปยอดต่อคน และสร้าง QR พร้อมเพย์ให้โอนง่าย",
      },
      "/app": {
        title: "Harbill (หารบิล) | เปิดรอบหารบิล",
        description: "เปิดรอบหารบิล เลือกเพื่อน เพิ่มรายการ และสรุปยอดพร้อม QR พร้อมเพย์ด้วย Harbill",
      },
      "/friends": {
        title: "Harbill (หารบิล) | รายชื่อเพื่อนและกลุ่ม",
        description: "จัดการรายชื่อเพื่อนและกลุ่มที่ใช้แยกบิลบ่อย เพื่อเปิดรอบใหม่ได้เร็วขึ้น",
      },
      "/history": {
        title: "Harbill (หารบิล) | ประวัติการหารบิล",
        description: "ดูประวัติรอบก่อนหน้า แก้ไขรายการ และกลับมาเริ่มทริปใหม่ได้ทันที",
      },
      "/dues": {
        title: "Harbill | ยอดค้างและเช็กยอดโอน",
        description: "บันทึกยอดค้างรายคน ดูว่าใครยังไม่จ่ายอะไร และติดตามสถานะการโอนในแต่ละเดือน",
      },
      "/login": {
        title: "Harbill (หารบิล) | เข้าสู่ระบบ",
        description: "เข้าสู่ระบบ Harbill ด้วยบัญชี Google เพื่อเริ่มแยกบิลทริป",
      },
    }
    const seo = map[location.pathname] || map["/"]
    document.title = seo.title
    if (metaDescription) metaDescription.setAttribute("content", seo.description)
  }, [location.pathname])

  useEffect(() => {
    if (sessionStorage.getItem("harbill:visitTracked")) return
    sessionStorage.setItem("harbill:visitTracked", "true")

    const visitorKey = analyticsId("visitor")
    const sessionKey = analyticsId("session", sessionStorage)
    api.trackPageView({
      visitorKey,
      sessionKey,
      path: `${location.pathname}${location.search}`,
      hostname: window.location.hostname,
      referrer: document.referrer,
    })
  }, [])

  useEffect(() => {
    const token = localStorage.getItem("token")
    if (!token) {
      setChecking(false)
      return
    }

    // verify token กับ server ทุกครั้งที่เปิดแอป
    if (localStorage.getItem("user")) {
      setChecking(false)
    }

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
    navigate("/app")
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
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={
        // ถ้า login แล้ว redirect ไป / เลย
        localStorage.getItem("token")
          ? <Navigate to="/app" replace />
          : <LoginPage />
      } />
      <Route path="/auth" element={<AuthCallback />} />
      <Route path="/pay/:token" element={<PublicPayPage />} />
      <Route path="/app" element={
        <RequireAuth user={user} onLogout={handleLogout} lang={lang} onLangChange={toggleLanguage} darkMode={darkMode} onThemeChange={toggleTheme}>
          <RoundPage
            user={user}
            initialRound={editRound}
            onRoundConsumed={() => setEditRound(null)}
          />
        </RequireAuth>
      } />
      <Route path="/friends" element={
        <RequireAuth user={user} onLogout={handleLogout} lang={lang} onLangChange={toggleLanguage} darkMode={darkMode} onThemeChange={toggleTheme}>
          <FriendsPage />
        </RequireAuth>
      } />
      <Route path="/history" element={
        <RequireAuth user={user} onLogout={handleLogout} lang={lang} onLangChange={toggleLanguage} darkMode={darkMode} onThemeChange={toggleTheme}>
          <HistoryPage user={user} onEditRound={handleEditRound} />
        </RequireAuth>
      } />
      <Route path="/dues" element={
        <RequireAuth user={user} onLogout={handleLogout} lang={lang} onLangChange={toggleLanguage} darkMode={darkMode} onThemeChange={toggleTheme}>
          <DuesPage lang={lang} darkMode={darkMode} />
        </RequireAuth>
      } />
      <Route path="/pro" element={
        <RequireAuth user={user} onLogout={handleLogout} lang={lang} onLangChange={toggleLanguage} darkMode={darkMode} onThemeChange={toggleTheme}>
          <ProPage user={user} onUserUpdate={setUser} />
        </RequireAuth>
      } />
      <Route path="/admin" element={
        <RequireAuth user={user} onLogout={handleLogout} lang={lang} onLangChange={toggleLanguage} darkMode={darkMode} onThemeChange={toggleTheme}>
          <AdminPage />
        </RequireAuth>
      } />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
