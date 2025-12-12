"use client";
import { useState, useEffect } from "react";
import Image from "next/image";
import { Facebook, Calendar, Clock } from "lucide-react";
import DateCarousel from "@/components/DateCarousel";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { format, getDay, addDays, isPast, isSameDay } from 'date-fns';

type SlotStatus = "OPEN" | "FULL" | "UNAVAILABLE" | "CLOSED";

type Slot = {
  time: string;
  status: SlotStatus;
};

type AvailabilityMap = Record<string, 'OPEN' | 'FULL' | 'CLOSED' | 'NONE'>;


export default function BookingPage() {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [slots, setSlots] = useState<Slot[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [availabilityMap, setAvailabilityMap] = useState<AvailabilityMap>({}); // NEW STATE - สำหรับ Carousel

  // --- Mock Data/Helpers (ในโค้ดจริงต้องใช้ API) ---
  const baseSlots = [
    "13:00", "13:30", "14:00", "14:30", "15:00", "15:30",
    "16:00", "16:30", "17:00", "17:30", "18:00", "18:30",
    "19:00", "19:30", "20:00", "20:30", "21:00", "21:30"
  ];
  const minServiceDuration = 1;

  const timeToFloat = (t: string | null): number | null => {
    if (!t) return null;
    const [h, m] = t.split(":").map(Number);
    return h + m / 60;
  };

  // --- 1. Fetch สถานะว่างสำหรับ Carousel ทั้งแถบ ---
  const fetchAllAvailability = async (daysToShow = 14) => {
    const dates = Array.from({ length: daysToShow }, (_, i) => addDays(new Date(), i));
    const startDate = format(dates[0], 'yyyy-MM-dd');
    const endDate = format(dates[dates.length - 1], 'yyyy-MM-dd');

    try {
      // Fetch data from supabase (queues, store_hours)
      const { data: queuesData } = await supabase
        .from("queues")
        .select("date, start_time, end_time, status")
        .gte("date", startDate)
        .lte("date", endDate)
        .neq("status", "cancelled");

      const { data: storeHoursData } = await supabase
        .from("store_hours")
        .select("*");

      const newMap: AvailabilityMap = {};

      for (const date of dates) {
        const dateStr = format(date, 'yyyy-MM-dd');
        const weekday = getDay(date);

        // Check store hours (using mock logic since we don't have store_exceptions data)
        const hour = storeHoursData?.find(h => h.weekday === weekday);

        let isClosed = hour?.is_closed || false;
        let open = timeToFloat(hour?.open_time || null);
        let close = timeToFloat(hour?.close_time || null);

        if (isClosed || !open || !close) {
          newMap[dateStr] = 'CLOSED';
          continue;
        }

        // Check for available slots
        const dayBookings = queuesData?.filter(q => q.date === dateStr) || [];
        let hasOpenSlot = false;

        for (const slotTime of baseSlots) {
          const [h, m] = slotTime.split(":").map(Number);
          const slotStart = h + m / 60;
          const slotEnd = slotStart + 0.5;

          if (slotStart < open || slotEnd > close) continue;

          const hasBooking = dayBookings.some((b) => {
            const bStart = timeToFloat(b.start_time)!;
            const bEnd = timeToFloat(b.end_time)!;
            return slotStart < bEnd && slotEnd > bStart;
          });

          if (!hasBooking) {
            hasOpenSlot = true;
            break;
          }
        }

        if (isPast(date) && !isSameDay(date, new Date())) {
          newMap[dateStr] = 'NONE';
        } else if (hasOpenSlot) {
          newMap[dateStr] = 'OPEN';
        } else {
          newMap[dateStr] = 'FULL';
        }
      }

      setAvailabilityMap(newMap);
    } catch (error) {
      console.error("Error fetching availability range:", error);
    }
  };


  // --- 2. Fetch Slot ละเอียดสำหรับวันที่เลือก ---
  const fetchSelectedDaySlots = async () => {
    setIsLoading(true);
    const dateStr = selectedDate.toISOString().split("T")[0];
    const weekday = selectedDate.getDay();

    try {
      // Fetch actual data for the selected date here in real scenario
      const { data: bookings } = await supabase
        .from("queues")
        .select("start_time, end_time, status")
        .eq("date", dateStr)
        .neq("status", "cancelled");

      const { data: hour } = await supabase
        .from("store_hours")
        .select("*")
        .eq("weekday", weekday)
        .maybeSingle();

      const open = timeToFloat(hour?.open_time || null);
      const close = timeToFloat(hour?.close_time || null);
      const isClosed = hour?.is_closed || false;


      const updatedSlots: Slot[] = baseSlots.map((slotTime) => {
        const [h, m] = slotTime.split(":").map(Number);
        const slotStart = h + m / 60;
        const slotEnd = slotStart + 0.5;

        if (isClosed) return { time: slotTime, status: "CLOSED" };
        if (open === null || close === null) return { time: slotTime, status: "UNAVAILABLE" };

        if (slotStart < open || slotEnd > close) return { time: slotTime, status: "UNAVAILABLE" };

        const hasBooking = bookings?.some((b) => {
          const bStart = timeToFloat(b.start_time)!;
          const bEnd = timeToFloat(b.end_time)!;
          return slotStart < bEnd && slotEnd > bStart;
        });

        if (hasBooking) return { time: slotTime, status: "FULL" };

        return { time: slotTime, status: "OPEN" };
      });

      setSlots(updatedSlots);
    } finally {
      setIsLoading(false);
    }
  };


  useEffect(() => {
    fetchAllAvailability();
  }, []);

  useEffect(() => {
    fetchSelectedDaySlots();
  }, [selectedDate]);


  // Helper for status badge for the selected day itself
  const selectedDayStatus = availabilityMap[format(selectedDate, 'yyyy-MM-dd')] || 'NONE';
  let statusColor = "text-slate-500";
  if (selectedDayStatus === 'OPEN') statusColor = "text-emerald-500";
  if (selectedDayStatus === 'FULL' || selectedDayStatus === 'CLOSED') statusColor = "text-pink-500";


  return (
    <div className="min-h-screen bg-[#FFF0F7] w-full max-w-[100vw] overflow-x-hidden">
      {/* HEADER (เหมือนเดิม) */}
      <header className="bg-white px-6 py-4 flex justify-center items-center shadow-sm sticky top-0 z-50">
        <div className="flex flex-col items-center">
          <div className="w-12 h-12 rounded-full overflow-hidden border border-pink-200 mb-1 relative">
            <Image src="/logo.jpg" alt="Logo" fill className="object-cover" />
          </div>
          <h1 className="font-bold text-lg text-primary tracking-tight">Fairymate.Nail</h1>
        </div>
      </header>

      {/* CONTENT */}
      <main className="max-w-md mx-auto p-6 space-y-6 pb-40">

        {/* Intro */}
        <div className="bg-white/80 rounded-3xl p-6 text-center shadow-sm">
          <h2 className="text-xl font-bold text-slate-800 mb-2">จองคิวง่ายๆ แค่ 2 ขั้นตอน</h2>
          <p className="text-slate-500 text-sm">เลือกวันว่าง แล้วเลือกเวลาที่ต้องการ 💅</p>
        </div>

        {/* Date Selector Area (Simple and Clear) */}
        <div className="bg-white rounded-3xl p-4 shadow-soft">
          <h3 className="font-bold text-slate-800 mb-4 text-lg flex items-center gap-2">
            <Calendar size={20} className="text-primary" /> 1. เลือกวันว่าง
          </h3>
          <DateCarousel
            selectedDate={selectedDate}
            onDateSelect={setSelectedDate}
            availabilityMap={availabilityMap} // <-- ส่งสถานะไปให้ Carousel จัดการ
          />
          {/* Status Indicator for selected date */}
          <div className={cn("mt-4 text-center font-bold text-sm", statusColor)}>
            {selectedDayStatus === 'OPEN' && <span>✅ วันที่ {format(selectedDate, 'd MMM')} ยังมีคิวว่าง</span>}
            {selectedDayStatus === 'FULL' && <span>❌ วันที่ {format(selectedDate, 'd MMM')} คิวเต็มแล้ว</span>}
            {selectedDayStatus === 'CLOSED' && <span>🚫 วันที่ {format(selectedDate, 'd MMM')} ปิดร้าน</span>}
            {(selectedDayStatus === 'NONE' || (isPast(selectedDate) && !isSameDay(selectedDate, new Date()))) && <span>👆 เลือกวันอื่นที่มีสีเขียวค่ะ</span>}
          </div>
        </div>

        {/* SLOT BLOCKS */}
        <div className="bg-white rounded-3xl p-6 shadow-soft">
          <h3 className="font-bold text-slate-800 mb-4 text-lg flex items-center gap-2">
            <Clock size={20} className="text-primary" /> 2. เลือกเวลา
          </h3>

          {isLoading ? (
            <p className="text-center text-slate-400 py-4 text-sm">กำลังโหลด...</p>
          ) : (
            <div className="grid grid-cols-3 gap-3">
              {slots.map((slot) => (
                <button
                  key={slot.time}
                  disabled={slot.status !== 'OPEN'}
                  className={cn(
                    "rounded-xl py-3 flex flex-col items-center text-sm font-semibold transition-all active:scale-95",
                    slot.status === "OPEN"
                      ? "bg-emerald-100 text-emerald-600 border border-emerald-300 hover:bg-emerald-200"
                      : slot.status === "FULL"
                        ? "bg-pink-100 text-pink-600 border border-pink-300 opacity-80 cursor-not-allowed"
                        : slot.status === "CLOSED"
                          ? "bg-slate-200 text-slate-400 border border-slate-300 opacity-60 cursor-not-allowed"
                          : "bg-slate-100 text-slate-400 border border-slate-200 opacity-60 cursor-not-allowed"
                  )}
                >
                  <span className="text-base font-bold">{slot.time}</span>
                  <span className="text-[10px] mt-1">
                    {slot.status === "OPEN" ? "ว่าง!" : slot.status === "FULL" ? "เต็ม" : slot.status === "CLOSED" ? "ปิดร้าน" : "ไม่ว่าง"}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* CTA (เหมือนเดิม) */}
      <div className="fixed bottom-0 left-0 w-full p-4 bg-white border-t border-slate-100 shadow-[0_-4px_20px_-5px_rgba(0,0,0,0.1)] z-50">
        <div className="max-w-md mx-auto">
          <a
            href="https://www.facebook.com/messages/t/583498464852057"
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-center gap-3 w-full bg-[#1877F2] text-white py-4 rounded-2xl font-bold text-lg hover:bg-[#166fe5] transition"
          >
            <Facebook className="fill-white" /> ทักแชทเพื่อจองคิว
          </a>
        </div>
      </div>
    </div>
  );
}