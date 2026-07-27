import { useEffect } from "react"

export default function AuthCallback() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const token = params.get("token")
    const name = params.get("name")
    const avatar = params.get("avatar")

    if (token) {
      localStorage.setItem("token", token)
      localStorage.setItem("user", JSON.stringify({ name, avatar }))
      // ใช้ replace แทน navigate เพื่อล้าง URL params ออก
      const returnTo = localStorage.getItem("harbill:returnTo")
      localStorage.removeItem("harbill:returnTo")
      const safeReturnTo = returnTo?.startsWith("/") && !returnTo.startsWith("//")
        ? returnTo
        : "/app"
      window.location.replace(safeReturnTo)
    } else {
      window.location.replace("/login")
    }
  }, [])

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-600 to-pink-500 flex items-center justify-center">
      <p className="text-white text-lg">กำลังเข้าสู่ระบบ...</p>
    </div>
  )
}
