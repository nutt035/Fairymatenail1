"use client";
import { useState, useEffect } from "react";
import Image from "next/image";
import { Facebook } from "lucide-react";
import DateCarousel from "@/components/DateCarousel";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";

type SlotStatus = "OPEN" | "FULL" | "UNAVAILABLE" | "CLOSED";

type Slot = {
  time: string;
  status: SlotStatus;
};

export default function BookingPage() {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [slots, setSlots] = useState<Slot[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // base slots 30 นาที
  const baseSlots = [
    "13:00",
    "13:30",
    "14:00",
    "14:30",
    "15:00",
    "15:30",
    "16:00",
    "16:30",
    "17:00",
    "17:30",
    "18:00",
    "18:30",
    "19:00",
    "19:30",
    "20:00",
    "20:30",
    "21:00",
    "21:30",
  ];

  // helper แปลง "HH:MM" → ชั่วโมงทศนิยม
  const timeToFloat = (t: string | null): number | null => {
    if (!t) return null;
    const [h, m] = t.split(":").map(Number);
    return h + m / 60;
  };

  // โหลด slot ทุกครั้งที่เปลี่ยนวัน
  useEffect(() => {
    const fetchAvailability = async () => {
      setIsLoading(true);
      const dateStr = selectedDate.toISOString().split("T")[0];
      const weekday = selectedDate.getDay();

      try {
        // 1) เวลาพิเศษของวันนั้นก่อน
        const { data: exception } = await supabase
          .from("store_exceptions")
          .select("*")
          .eq("date", dateStr)
          .maybeSingle();

        let openTime: string | null = null;
        let closeTime: string | null = null;
        let isClosed = false;

        if (exception) {
          openTime = exception.open_time;
          closeTime = exception.close_time;
          isClosed = exception.is_closed;
        } else {
          // 2) ถ้าไม่มี exception ใช้เวลา weekly
          const { data: hour } = await supabase
            .from("store_hours")
            .select("*")
            .eq("weekday", weekday)
            .maybeSingle();

          if (hour) {
            openTime = hour.open_time;
            closeTime = hour.close_time;
            isClosed = hour.is_closed;
          }
        }

        // 3) ดึงคิวของวันนั้น
        const { data: bookings } = await supabase
          .from("queues")
          .select("start_time, end_time, status")
          .eq("date", dateStr)
          .neq("status", "cancelled");

        const open = timeToFloat(openTime);
        const close = timeToFloat(closeTime);

        const newSlots: Slot[] = baseSlots.map((slotTime) => {
          const [h, m] = slotTime.split(":").map(Number);
          const slotStart = h + m / 60;
          const slotEnd = slotStart + 0.5;

          // ปิดทั้งวัน
          if (isClosed) {
            return { time: slotTime, status: "CLOSED" };
          }

          // ไม่มีเวลาเปิดร้านที่ชัดเจน
          if (open === null || close === null) {
            return { time: slotTime, status: "UNAVAILABLE" };
          }

          // นอกช่วงเวลาเปิดร้าน
          if (slotStart < open || slotEnd > close) {
            return { time: slotTime, status: "UNAVAILABLE" };
          }

          // มีคิวทับหรือไม่
          const hasBooking = bookings?.some((b) => {
            const bStart = timeToFloat(b.start_time)!;
            const bEnd = timeToFloat(b.end_time)!;
            // overlap
            return slotStart < bEnd && slotEnd > bStart;
          });

          if (hasBooking) return { time: slotTime, status: "FULL" };

          // ช่วงที่ "เริ่มไม่ได้" ใกล้คิวถัดไป (เพื่อกันคิวใหม่ซ้อน)
          const nextBooking = bookings
            ?.map((b) => ({
              start: timeToFloat(b.start_time)!,
              end: timeToFloat(b.end_time)!,
            }))
            .filter((b) => b.start >= slotEnd) // ต้องเป็นคิวถัดไปจริง ๆ
            .sort((a, b) => a.start - b.start)[0];

          if (nextBooking) {
            // ถ้าช่องนี้เหลือเวลาไม่ถึง 1 ชั่วโมงก่อนคิวถัดไป → เริ่มไม่ได้
            const remain = nextBooking.start - slotStart;
            if (remain < 1) {
              return { time: slotTime, status: "UNAVAILABLE" };
            }
          }

          return { time: slotTime, status: "OPEN" };
        });

        setSlots(newSlots);
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAvailability();
  }, [selectedDate]);

  // helper: css ของแต่ละ status
  const slotBgClass = (status: SlotStatus) => {
    if (status === "OPEN") return "bg-emerald-400/90";
    if (status === "FULL") return "bg-pink-500";
    if (status === "CLOSED") return "bg-slate-200";
    return "bg-slate-100"; // UNAVAILABLE
  };

  const slotOpacityClass = (status: SlotStatus) => {
    if (status === "OPEN") return "opacity-100";
    if (status === "FULL") return "opacity-100";
    if (status === "CLOSED") return "opacity-60";
    return "opacity-60";
  };

  return (
    <div className="min-h-screen bg-[#FFF0F7]">
      {/* HEADER */}
      <header className="bg-white px-6 py-4 flex justify-center items-center shadow-sm sticky top-0 z-50">
        <div className="flex flex-col items-center">
          <div className="w-12 h-12 rounded-full overflow-hidden border border-pink-200 mb-1 relative">
            <Image src="/logo.jpg" alt="Logo" fill className="object-cover" />
          </div>
          <h1 className="font-bold text-lg text-primary tracking-tight">
            Fairymate.Nail
          </h1>
        </div>
      </header>

      <main className="max-w-md mx-auto p-6 space-y-6 pb-40">
        {/* INFO CARD */}
        <div className="bg-white/80 backdrop-blur-sm rounded-3xl p-6 text-center shadow-sm">
          <h2 className="text-xl font-bold text-slate-800 mb-2">ตารางคิวว่าง</h2>
          <p className="text-slate-500 text-sm">
            ดูช่วงเวลาที่ว่างแล้วทักแชทเพื่อจองคิวได้เลยค่ะ 💅
          </p>
        </div>

        {/* DATE SELECTOR */}
        <div className="bg-white rounded-3xl p-6 shadow-soft">
          <DateCarousel
            selectedDate={selectedDate}
            onDateSelect={setSelectedDate}
          />
        </div>

        {/* TIMELINE BAR */}
        <div className="bg-white rounded-3xl p-6 shadow-soft space-y-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-bold text-slate-800 text-sm">
              ช่วงเวลาเปิดให้บริการ (13:00 - 22:00)
            </h3>
            <div className="flex gap-3 text-[10px] text-slate-500">
              <div className="flex items-center gap-1">
                <span className="w-3 h-3 rounded-full bg-emerald-400/90" /> ว่าง
              </div>
              <div className="flex items-center gap-1">
                <span className="w-3 h-3 rounded-full bg-pink-500" /> เต็ม
              </div>
              <div className="flex items-center gap-1">
                <span className="w-3 h-3 rounded-full bg-slate-200" /> เริ่มไม่ได้
              </div>
            </div>
          </div>

          {isLoading ? (
            <p className="text-center text-slate-400 py-6 text-sm">
              กำลังโหลดข้อมูลคิว...
            </p>
          ) : (
            <div className="space-y-2">
              {/* เวลาแถวบน */}
              <div className="flex justify-between text-[10px] text-slate-400">
                {slots.map((s) => (
                  <span key={"top-" + s.time}>{s.time}</span>
                ))}
              </div>

              {/* แถบ timeline */}
              <div className="flex h-10 items-stretch rounded-3xl bg-slate-100/60 px-1 py-1 gap-1">
                {slots.map((slot, i) => {
                  const prev = slots[i - 1];
                  const next = slots[i + 1];
                  const isStart = !prev || prev.status !== slot.status;
                  const isEnd = !next || next.status !== slot.status;

                  return (
                    <div
                      key={slot.time}
                      className={cn(
                        "flex-1 flex items-center justify-center text-[11px] font-semibold text-white",
                        slotBgClass(slot.status),
                        slotOpacityClass(slot.status),
                        "transition-all",
                        "shadow-sm",
                        "overflow-hidden",
                        isStart && "rounded-l-2xl",
                        isEnd && "rounded-r-2xl"
                      )}
                    >
                      {/* แสดง label เวลาเฉพาะ block ที่เป็นคิวเต็ม และเป็นจุดเริ่ม */}
                      {slot.status === "FULL" && isStart && slot.time}
                    </div>
                  );
                })}
              </div>

              {/* เวลาแถวล่าง */}
              <div className="flex justify-between text-[10px] text-slate-400">
                {slots.map((s) => (
                  <span key={"bottom-" + s.time}>{s.time}</span>
                ))}
              </div>

              {/* note */}
              <p className="text-[11px] text-slate-400 mt-1">
                *ช่วงเวลา “เริ่มไม่ได้” คือเวลาที่ใกล้กับการจองคิวถัดไป
                ไม่เพียงพอสำหรับเริ่มรับบริการใหม่
              </p>
            </div>
          )}
        </div>
      </main>

      {/* CTA */}
      <div className="fixed bottom-0 left-0 w-full p-4 bg-white border-t border-slate-100 shadow-[0_-4px_20px_-5px_rgba(0,0,0,0.1)] z-50">
        <div className="max-w-md mx-auto">
          <a
            href="https://www.facebook.com/messages/t/583498464852057"
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-center gap-3 w-full bg-[#1877F2] text-white py-4 rounded-2xl font-bold text-lg hover:bg-[#166fe5] transition-colors shadow-blue-200 shadow-lg active:scale-[0.98]"
          >
            <Facebook className="fill-white" />
            ทักแชทจองคิว
          </a>
          <p className="text-center text-xs text-slate-400 mt-3">
            *ทางร้านขอสงวนสิทธิ์ให้คิวลูกค้าที่โอนมัดจำก่อนนะคะ
          </p>
        </div>
      </div>
    </div>
  );
}
