import { Link } from "react-router-dom"

const features = [
  {
    title: "หารบิลกับเพื่อน",
    desc: "เลือกคนร่วมโต๊ะ เพิ่มรายการอาหาร แล้วให้ Harbill คำนวณยอดที่แต่ละคนต้องจ่าย",
  },
  {
    title: "สรุปยอดพร้อมโอน",
    desc: "ดูยอดรวม ยอดรายคน ส่วนลด และข้อความสรุปสำหรับส่งต่อในแชทได้ทันที",
  },
  {
    title: "QR พร้อมเพย์",
    desc: "สร้าง QR สำหรับยอดของแต่ละคนเมื่อมีข้อมูลพร้อมเพย์ ลดการพิมพ์เลขผิด",
  },
  {
    title: "จำเพื่อนและกลุ่ม",
    desc: "บันทึกรายชื่อเพื่อน กลุ่มประจำ และบัญชีรับเงินเพื่อเปิดรอบใหม่ได้เร็วขึ้น",
  },
]

const steps = [
  "เปิดรอบและเลือกเพื่อน",
  "เพิ่มรายการจากบิลหรือสลิป",
  "เลือกคนที่หารแต่ละรายการ",
  "สรุปยอดและส่ง QR ให้โอน",
]

const searchTopics = [
  "แอปหารบิล",
  "โปรแกรมหารบิล",
  "แยกบิลค่าอาหาร",
  "หารค่าอาหารกับเพื่อน",
  "หารเงินกับเพื่อน",
  "สรุปยอดโอน",
  "QR พร้อมเพย์",
  "หารค่าใช้จ่ายทริป",
]

export default function LandingPage() {
  const hasToken = Boolean(localStorage.getItem("token"))

  return (
    <main className="min-h-screen bg-[#0b1020] text-white">
      <section className="border-b border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.18),transparent_34%),linear-gradient(135deg,#0b1020_0%,#111827_58%,#07131f_100%)]">
        <div className="mx-auto grid min-h-[92vh] max-w-6xl items-center gap-10 px-5 py-10 md:grid-cols-[1.05fr_0.95fr] md:px-8">
          <div>
            <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-sm font-semibold text-emerald-200">
              <span className="h-2 w-2 rounded-full bg-emerald-300" />
              แอปหารบิลภาษาไทย
            </div>
            <h1 className="max-w-2xl text-4xl font-black leading-tight tracking-normal text-white md:text-6xl">
              Harbill ช่วยหารบิล สรุปยอด และสร้าง QR พร้อมเพย์ให้เพื่อนโอนง่าย
            </h1>
            <p className="mt-5 max-w-xl text-base leading-8 text-slate-300 md:text-lg">
              ตัวช่วยแยกค่าอาหาร ค่าทริป และค่าใช้จ่ายกับเพื่อน เพิ่มรายการจากบิล เลือกคนที่หารแต่ละรายการ แล้วสรุปยอดรายคนแบบพร้อมส่งต่อ
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                to={hasToken ? "/app" : "/login"}
                className="inline-flex items-center justify-center rounded-xl bg-emerald-500 px-5 py-3 text-sm font-bold text-slate-950 transition-colors hover:bg-emerald-400"
              >
                เริ่มหารบิล
              </Link>
              <a
                href="#how-it-works"
                className="inline-flex items-center justify-center rounded-xl border border-white/15 bg-white/5 px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-white/10"
              >
                ดูวิธีใช้งาน
              </a>
            </div>
            <div className="mt-8 grid max-w-lg grid-cols-3 gap-3 text-sm text-slate-300">
              <div className="border-l border-emerald-400/50 pl-3">
                <p className="font-bold text-white">เร็ว</p>
                <p className="mt-1 text-xs leading-5 text-slate-400">เปิดรอบใหม่ได้ในไม่กี่คลิก</p>
              </div>
              <div className="border-l border-sky-400/50 pl-3">
                <p className="font-bold text-white">ชัด</p>
                <p className="mt-1 text-xs leading-5 text-slate-400">เห็นยอดแยกของแต่ละคน</p>
              </div>
              <div className="border-l border-amber-300/50 pl-3">
                <p className="font-bold text-white">พร้อมโอน</p>
                <p className="mt-1 text-xs leading-5 text-slate-400">แนบ QR พร้อมเพย์ได้</p>
              </div>
            </div>
          </div>

          <div className="mx-auto w-full max-w-sm rounded-[2rem] border border-white/15 bg-slate-950/80 p-4 shadow-2xl shadow-black/40">
            <div className="rounded-[1.5rem] border border-white/10 bg-[#111827] p-4">
              <div className="flex items-center justify-between border-b border-white/10 pb-4">
                <div>
                  <p className="text-xs font-semibold text-emerald-300">รอบล่าสุด</p>
                  <p className="mt-1 text-lg font-bold text-white">มื้อเย็นกับเพื่อน</p>
                </div>
                <div className="rounded-xl bg-emerald-400/10 px-3 py-2 text-right">
                  <p className="text-xs text-emerald-200">รวม</p>
                  <p className="font-black text-emerald-300">฿1,480</p>
                </div>
              </div>
              <div className="mt-4 space-y-3">
                {[
                  ["น้ำ", "฿120", "ทุกคน"],
                  ["พิซซ่า", "฿620", "4 คน"],
                  ["ของหวาน", "฿260", "2 คน"],
                ].map(([name, price, split]) => (
                  <div key={name} className="flex items-center justify-between rounded-xl bg-white/5 px-3 py-2">
                    <div>
                      <p className="text-sm font-semibold text-white">{name}</p>
                      <p className="text-xs text-slate-500">{split}</p>
                    </div>
                    <p className="text-sm font-bold text-emerald-300">{price}</p>
                  </div>
                ))}
              </div>
              <div className="mt-4 rounded-2xl border border-sky-300/20 bg-sky-300/10 p-3">
                <p className="text-xs font-semibold text-sky-200">ยอดที่ต้องโอน</p>
                <div className="mt-3 space-y-2">
                  {[
                    ["Pipo", "฿370.00"],
                    ["Friend A", "฿555.00"],
                    ["Friend B", "฿555.00"],
                  ].map(([name, amount]) => (
                    <div key={name} className="flex items-center justify-between text-sm">
                      <span className="text-slate-300">{name}</span>
                      <span className="font-black text-white">{amount}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="mt-4 grid grid-cols-[88px_1fr] gap-3 rounded-2xl bg-white p-3 text-slate-900">
                <div className="grid aspect-square grid-cols-5 gap-1 rounded-lg bg-slate-100 p-2">
                  {Array.from({ length: 25 }).map((_, index) => (
                    <span
                      key={index}
                      className={index % 2 === 0 || index === 7 || index === 18 ? "bg-slate-900" : "bg-transparent"}
                    />
                  ))}
                </div>
                <div className="self-center">
                  <p className="text-xs font-bold text-blue-900">PromptPay QR</p>
                  <p className="mt-1 text-lg font-black">฿370.00</p>
                  <p className="mt-1 text-xs text-slate-500">พร้อมส่งให้เพื่อนสแกน</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="how-it-works" className="mx-auto max-w-6xl px-5 py-14 md:px-8">
        <h2 className="text-2xl font-black text-white md:text-3xl">Harbill ใช้ทำอะไรได้บ้าง</h2>
        <p className="mt-3 max-w-2xl leading-7 text-slate-400">
          ออกแบบมาสำหรับคนที่ต้องหารค่าอาหาร ค่าเดินทาง หรือค่าใช้จ่ายร่วมกันบ่อยๆ โดยเฉพาะกลุ่มเพื่อนที่ต้องการสรุปยอดให้จบในแชทเดียว
        </p>
        <div className="mt-8 grid gap-4 md:grid-cols-4">
          {features.map(item => (
            <article key={item.title} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
              <h3 className="text-base font-bold text-white">{item.title}</h3>
              <p className="mt-3 text-sm leading-6 text-slate-400">{item.desc}</p>
            </article>
          ))}
        </div>
        <div className="mt-8 rounded-2xl border border-white/10 bg-[#0f172a] p-5">
          <h2 className="text-xl font-black text-white">แอปหารบิลสำหรับแยกค่าอาหารและค่าใช้จ่ายกับเพื่อน</h2>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-400">
            Harbill เป็นโปรแกรมหารบิลภาษาไทยที่ช่วยแยกบิลค่าอาหาร หารค่าใช้จ่ายทริป หารเงินกับเพื่อน
            และสรุปยอดโอนรายคน เหมาะกับมื้ออาหาร ร้านอาหาร คาเฟ่ ทริปสั้น ๆ หรือกิจกรรมที่หลายคนจ่ายรวมกัน
            แล้วต้องการยอดที่ชัดเจนพร้อม QR พร้อมเพย์
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {searchTopics.map(topic => (
              <span key={topic} className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-slate-300">
                {topic}
              </span>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-white/10 bg-white/[0.03]">
        <div className="mx-auto grid max-w-6xl gap-8 px-5 py-14 md:grid-cols-[0.8fr_1.2fr] md:px-8">
          <div>
            <h2 className="text-2xl font-black text-white md:text-3xl">วิธีเริ่มหารบิล</h2>
            <p className="mt-3 leading-7 text-slate-400">
              เหมาะกับร้านอาหาร คาเฟ่ ทริปสั้นๆ หรือกิจกรรมที่หลายคนจ่ายรวมกันแล้วต้องแยกยอดภายหลัง
            </p>
          </div>
          <ol className="grid gap-3 sm:grid-cols-2">
            {steps.map((step, index) => (
              <li key={step} className="rounded-2xl border border-white/10 bg-[#0f172a] p-4">
                <p className="text-sm font-black text-emerald-300">ขั้นตอน {index + 1}</p>
                <p className="mt-2 font-bold text-white">{step}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>
    </main>
  )
}
