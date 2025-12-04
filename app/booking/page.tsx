"use client";
import { useState, useEffect } from 'react';
import Image from 'next/image';
import { Facebook } from 'lucide-react';
import DateCarousel from '@/components/DateCarousel';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';

export default function BookingPage() {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [slots, setSlots] = useState<any[]>([]);
  const [storeHours, setStoreHours] = useState(null);
  const [exceptionHours, setExceptionHours] = useState(null);

  // Base slots (fixed UI timeline)
  const baseSlots = [
    '13:00', '13:30', '14:00', '14:30', '15:00', '15:30',
    '16:00', '16:30', '17:00', '17:30', '18:00', '18:30',
    '19:00', '19:30', '20:00', '20:30', '21:00', '21:30'
  ];

  // -----------------------------
  // ดึงเวลาเปิด–ปิดร้าน
  // -----------------------------
  useEffect(() => {
    const fetchStoreHours = async () => {
      const weekday = selectedDate.getDay();
      const dateStr = selectedDate.toISOString().split('T')[0];

      // 1) เช็ค exception ก่อน
      const { data: exception } = await supabase
        .from("store_exceptions")
        .select("*")
        .eq("date", dateStr)
        .maybeSingle();

      if (exception) {
        setExceptionHours(exception);
        setStoreHours(null);
        return;
      }

      // 2) ถ้าไม่เจอ exception → ใช้ store_hours ปกติ
      const { data: hours } = await supabase
        .from("store_hours")
        .select("*")
        .eq("weekday", weekday)
        .single();

      setStoreHours(hours);
      setExceptionHours(null);
    };

    fetchStoreHours();
  }, [selectedDate]);


  // -----------------------------
  // ดึงคิว + คำนวณว่าเวลาว่างไหม
  // -----------------------------
  useEffect(() => {
    const fetchAvailability = async () => {
      const dateStr = selectedDate.toISOString().split('T')[0];

      // ดึงคิวทั้งหมดของวันนั้นที่ยังไม่ยกเลิก
      const { data: bookings } = await supabase
        .from('queues')
        .select('start_time, end_time')
        .eq('date', dateStr)
        .neq('status', 'cancelled');

      // เวลาร้านเปิด–ปิดของวันนั้น
      const openTime =
        exceptionHours?.open_time ||
        storeHours?.open_time ||
        null;

      const closeTime =
        exceptionHours?.close_time ||
        storeHours?.close_time ||
        null;

      const isClosed =
        exceptionHours?.is_closed ||
        storeHours?.is_closed ||
        false;

      const updatedSlots = baseSlots.map(slotTime => {
        const [h, m] = slotTime.split(':').map(Number);
        const slotStart = h + m / 60;
        const slotEnd = slotStart + 0.5;

        // ❌ ร้านปิดทั้งวัน
        if (isClosed) {
          return { time: slotTime, status: "CLOSED" };
        }

        // ❌ ถ้ายังไม่มีข้อมูล open/close ไม่ต้องเปิดให้จอง
        if (!openTime || !closeTime) {
          return { time: slotTime, status: "UNAVAILABLE" };
        }

        // แปลงเวลาเปิด–ปิด
        const [oh, om] = openTime.split(':').map(Number);
        const [ch, cm] = closeTime.split(':').map(Number);
        const open = oh + om / 60;
        const close = ch + cm / 60;

        // ❌ ถ้าอยู่ก่อนร้านเปิดหรือหลังร้านปิด
        if (slotStart < open || slotEnd > close) {
          return { time: slotTime, status: "UNAVAILABLE" };
        }

        // เช็คการทับซ้อนกับคิวที่มีแล้ว
        const isBusy = bookings?.some(b => {
          const [bh, bm] = b.start_time.split(':').map(Number);
          const [eh, em] = b.end_time.split(':').map(Number);
          const bookingStart = bh + bm / 60;
          const bookingEnd = eh + em / 60;
          return slotStart < bookingEnd && slotEnd > bookingStart;
        });

        if (isBusy) return { time: slotTime, status: "FULL" };

        return { time: slotTime, status: "OPEN" };
      });

      setSlots(updatedSlots);
    };

    fetchAvailability();
  }, [selectedDate, storeHours, exceptionHours]);


  // -----------------------------
  // RENDER UI
  // -----------------------------
  return (
    <div className="min-h-screen bg-[#FFF0F7]">
      <header className="bg-white px-6 py-4 flex justify-center items-center shadow-sm sticky top-0 z-50">
        <div className="flex flex-col items-center">
          <div className="w-12 h-12 rounded-full overflow-hidden border border-pink-200 mb-1 relative">
            <Image src="/logo.jpg" alt="Logo" fill className="object-cover" />
          </div>
          <h1 className="font-bold text-lg text-primary tracking-tight">Fairymate.Nail</h1>
        </div>
      </header>

      {/* Body */}
      <main className="max-w-md mx-auto p-6 space-y-6 pb-40">

        {/* Info Card */}
        <div className="bg-white/80 backdrop-blur-sm rounded-3xl p-6 text-center shadow-sm">
          <h2 className="text-xl font-bold text-slate-800 mb-2">ตารางคิวว่าง</h2>
          <p className="text-slate-500 text-sm">สีเขียวคือว่าง สามารถทักแชทจองได้เลยค่ะ</p>
        </div>

        {/* Date Carousel */}
        <div className="bg-white rounded-3xl p-6 shadow-soft">
          <DateCarousel selectedDate={selectedDate} onDateSelect={setSelectedDate} />
        </div>

        {/* Time Slots */}
        <div>
          <div className="flex items-center justify-between mb-4 px-2">
            <h3 className="font-bold text-slate-700">
              รอบเวลา (13:00 - 22:00)
            </h3>

            <div className="flex gap-3 text-[10px]">
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>ว่าง
              </div>
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 bg-slate-300 rounded-full"></div>เต็ม/ปิด
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            {slots.map((slot, idx) => (
              <div
                key={idx}
                className={cn(
                  "flex flex-col items-center justify-center py-3 rounded-2xl border transition-all cursor-default relative overflow-hidden",
                  slot.status === "OPEN"
                    ? "bg-white border-green-400/30 text-green-600 shadow-sm"
                    : slot.status === "FULL"
                    ? "bg-slate-100 border-transparent text-slate-400 opacity-60"
                    : slot.status === "UNAVAILABLE"
                    ? "bg-slate-100 border-transparent text-slate-300 opacity-40"
                    : "bg-slate-100 text-slate-300 opacity-50"
                )}
              >
                <span className="text-lg font-bold mb-0.5">
                  {slot.time}
                </span>

                <span className="text-[12px] font-bold tracking-wide">
                  {slot.status === "OPEN"
                    ? "ว่าง"
                    : slot.status === "FULL"
                    ? "เต็ม"
                    : "เริ่มไม่ได้"}
                </span>
              </div>
            ))}
          </div>
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
