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
    "13:00","13:30","14:00","14:30","15:00","15:30",
    "16:00","16:30","17:00","17:30","18:00","18:30",
    "19:00","19:30","20:00","20:30","21:00","21:30"
  ];

  const timeToFloat = (t: string | null): number | null => {
    if (!t) return null;
    const [h, m] = t.split(":").map(Number);
    return h + m / 60;
  };

  useEffect(() => {
    const fetchAvailability = async () => {
      setIsLoading(true);
      const dateStr = selectedDate.toISOString().split("T")[0];
      const weekday = selectedDate.getDay();

      try {
        // ตรวจเวลาเปิดร้านพิเศษก่อน
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
          // ถ้าไม่มี exception → ใช้ store_hours
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

        // ดึงคิวในวันนั้น
        const { data: bookings } = await supabase
          .from("queues")
          .select("start_time, end_time, status")
          .eq("date", dateStr)
          .neq("status", "cancelled");

        const open = timeToFloat(openTime);
        const close = timeToFloat(closeTime);

        const updatedSlots: Slot[] = baseSlots.map((slotTime) => {
          const [h, m] = slotTime.split(":").map(Number);
          const slotStart = h + m / 60;
          const slotEnd = slotStart + 0.5;

          if (isClosed) return { time: slotTime, status: "CLOSED" };
          if (open === null || close === null)
            return { time: slotTime, status: "UNAVAILABLE" };

          if (slotStart < open || slotEnd > close)
            return { time: slotTime, status: "UNAVAILABLE" };

          // เช็ค FULL จากคิวจริง
          const hasBooking = bookings?.some((b) => {
            const bStart = timeToFloat(b.start_time)!;
            const bEnd = timeToFloat(b.end_time)!;
            return slotStart < bEnd && slotEnd > bStart; // overlap
          });
          if (hasBooking) return { time: slotTime, status: "FULL" };

          return { time: slotTime, status: "OPEN" };
        });

        setSlots(updatedSlots);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAvailability();
  }, [selectedDate]);

  const statusColor = (s: SlotStatus) => {
    switch (s) {
      case "OPEN": return "bg-emerald-100 text-emerald-600 border border-emerald-300";
      case "FULL": return "bg-pink-100 text-pink-600 border border-pink-300";
      case "UNAVAILABLE": return "bg-slate-100 text-slate-400 border border-slate-200";
      case "CLOSED": return "bg-slate-200 text-slate-400 border border-slate-300";
    }
  };

  const statusLabel = (s: SlotStatus) => {
    switch (s) {
      case "OPEN": return "ว่าง";
      case "FULL": return "เต็ม";
      case "UNAVAILABLE": return "เริ่มไม่ได้";
      case "CLOSED": return "ปิดร้าน";
    }
  };

  return (
    <div className="min-h-screen bg-[#FFF0F7]">
      {/* HEADER */}
      <header className="bg-white px-6 py-4 flex justify-center items-center shadow-sm sticky top-0 z-50">
        <div className="flex flex-col items-center">
          <div className="w-12 h-12 rounded-full overflow-hidden border border-pink-200 mb-1 relative">
            <Image src="/logo.jpg" alt="Logo" fill className="object-cover"/>
          </div>
          <h1 className="font-bold text-lg text-primary tracking-tight">
              Fairymate.Nail
          </h1>
        </div>
      </header>

      {/* MAIN */}
      <main className="max-w-md mx-auto p-6 space-y-6 pb-40">

        {/* Info */}
        <div className="bg-white/80 rounded-3xl p-6 text-center shadow-sm">
          <h2 className="text-xl font-bold text-slate-800 mb-2">ตารางคิวว่าง</h2>
          <p className="text-slate-500 text-sm">ดูช่วงเวลาที่ว่างได้จากด้านล่างค่ะ 💅</p>
        </div>

        {/* Date Selector */}
        <div className="bg-white rounded-3xl p-6 shadow-soft">
          <DateCarousel selectedDate={selectedDate} onDateSelect={setSelectedDate} />
        </div>

        {/* Slots (Block UI) */}
        <div className="bg-white rounded-3xl p-6 shadow-soft">
          <h3 className="font-bold text-slate-800 mb-4">
            เลือกเวลาที่ต้องการ
          </h3>

          {isLoading ? (
            <p className="text-center text-slate-400 py-4 text-sm">
              กำลังโหลด...
            </p>
          ) : (
            <div className="grid grid-cols-3 gap-3">
              {slots.map((slot) => (
                <div
                  key={slot.time}
                  className={cn(
                    "rounded-2xl py-3 flex flex-col items-center",
                    "text-sm font-semibold",
                    "transition-all",
                    statusColor(slot.status)
                  )}
                >
                  <span className="text-base font-bold">{slot.time}</span>
                  <span className="text-[12px] mt-1">
                    {statusLabel(slot.status)}
                  </span>
                </div>
              ))}
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
        </div>
      </div>
    </div>
  );
}
