import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { api } from "../api"

export default function LoginPage() {
  const [mode, setMode] = useState("login")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [name, setName] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  async function submit() {
    setLoading(true)
    setError("")
    try {
      const res = mode === "login"
        ? await api.login(email, password)
        : await api.register(email, password, name)

      if (res.error) { setError(res.error); setLoading(false); return }
      localStorage.setItem("token", res.token)
      localStorage.setItem("user", JSON.stringify(res.user))
      navigate("/")
    } catch {
      setError("เกิดข้อผิดพลาดครับ")
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-600 via-purple-600 to-pink-500 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">🍽️</div>
          <h1 className="text-3xl font-bold text-white">Harbill</h1>
          <p className="text-purple-200 text-sm mt-1">หารบิลง่ายๆ กับเพื่อน</p>
        </div>

        {/* Card */}
        <div className="bg-white/10 backdrop-blur-md rounded-3xl p-6 shadow-2xl border border-white/20">
          {/* Tab */}
          <div className="flex bg-white/10 rounded-2xl p-1 mb-6">
            {["login", "register"].map(m => (
              <button key={m} onClick={() => { setMode(m); setError("") }}
                className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-all ${
                  mode === m ? "bg-white text-purple-600 shadow" : "text-white/70"
                }`}>
                {m === "login" ? "เข้าสู่ระบบ" : "สมัครสมาชิก"}
              </button>
            ))}
          </div>

          <div className="space-y-3">
            {mode === "register" && (
              <input
                className="w-full bg-white/10 border border-white/20 rounded-2xl px-4 py-3 text-white placeholder-white/50 outline-none focus:border-white/60 text-sm"
                placeholder="ชื่อของคุณ"
                value={name}
                onChange={e => setName(e.target.value)}
              />
            )}
            <input
              className="w-full bg-white/10 border border-white/20 rounded-2xl px-4 py-3 text-white placeholder-white/50 outline-none focus:border-white/60 text-sm"
              placeholder="อีเมล"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              onKeyDown={e => e.key === "Enter" && submit()}
            />
            <input
              className="w-full bg-white/10 border border-white/20 rounded-2xl px-4 py-3 text-white placeholder-white/50 outline-none focus:border-white/60 text-sm"
              placeholder="รหัสผ่าน"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              onKeyDown={e => e.key === "Enter" && submit()}
            />
          </div>

          {error && <p className="text-red-300 text-xs mt-3 text-center">{error}</p>}

          <button onClick={submit} disabled={loading}
            className="w-full mt-5 bg-white text-purple-600 font-bold py-3 rounded-2xl hover:bg-purple-50 transition-all disabled:opacity-50 shadow-lg">
            {loading ? "กำลังโหลด..." : mode === "login" ? "เข้าสู่ระบบ" : "สมัครสมาชิก"}
          </button>

          <div className="flex items-center gap-3 my-4">
            <div className="flex-1 h-px bg-white/20"></div>
            <span className="text-white/40 text-xs">หรือ</span>
            <div className="flex-1 h-px bg-white/20"></div>
          </div>

          <button onClick={() => api.googleLogin()}
            className="w-full bg-white/10 border border-white/20 hover:bg-white/20 text-white font-medium py-3 rounded-2xl flex items-center justify-center gap-2 transition-all text-sm">
            <svg width="18" height="18" viewBox="0 0 48 48">
              <path fill="#FFC107" d="M43.6 20H24v8h11.3C33.7 33.1 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20c11 0 19.7-8 19.7-20 0-1.3-.1-2.7-.1-4z"/>
              <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.5 15.1 18.9 12 24 12c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/>
              <path fill="#4CAF50" d="M24 44c5.2 0 9.9-1.9 13.5-5.1l-6.2-5.2C29.3 35.3 26.8 36 24 36c-5.2 0-9.6-3-11.2-7.2l-6.5 5C9.6 39.6 16.3 44 24 44z"/>
              <path fill="#1976D2" d="M43.6 20H24v8h11.3c-.8 2.3-2.3 4.2-4.2 5.7l6.2 5.2C41.1 35.5 44 30.2 44 24c0-1.3-.1-2.7-.4-4z"/>
            </svg>
            เข้าสู่ระบบด้วย Google
          </button>
        </div>
      </div>
    </div>
  )
}