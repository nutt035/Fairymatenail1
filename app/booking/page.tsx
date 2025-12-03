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

  // สร้างช่วงเวลา (Slot) ทุกๆ 30 นาที
  const baseSlots = [
    '13:00', '13:30', '14:00', '14:30', '15:00', '15:30', 
    '16:00', '16:30', '17:00', '17:30', '18:00', '18:30', 
    '19:00', '19:30', '20:00', '20:30', '21:00', '21:30'
  ];

  useEffect(() => {
    const fetchAvailability = async () => {
        const dateStr = selectedDate.toISOString().split('T')[0];
        
        // ดึงคิวทั้งหมดของวันนั้นที่ยังไม่ยกเลิก
        const { data: bookings } = await supabase
            .from('queues')
            .select('start_time, end_time')
            .eq('date', dateStr)
            .neq('status', 'cancelled');

        const updatedSlots = baseSlots.map(slotTime => {
            // แปลงเวลา Slot เป็นตัวเลขเพื่อเปรียบเทียบ (เช่น "13:30" -> 13.5)
            const [h, m] = slotTime.split(':').map(Number);
            const slotStart = h + m / 60;
            const slotEnd = slotStart + (30 / 60); // Slot ยาว 30 นาที

            const isBusy = bookings?.some(b => {
                // แปลงเวลา Booking เป็นตัวเลข
                const [bh, bm] = b.start_time.split(':').map(Number);
                const [eh, em] = b.end_time.split(':').map(Number);
                const bookingStart = bh + bm / 60;
                const bookingEnd = eh + em / 60;

                // Logic: เช็คการทับซ้อน (Overlap)
                // ช่วงเวลาทับกันถ้า: (Slot เริ่ม ก่อน Booking จบ) และ (Slot จบ หลัง Booking เริ่ม)
                return slotStart < bookingEnd && slotEnd > bookingStart;
            });

            return { time: slotTime, status: isBusy ? 'FULL' : 'OPEN' };
        });
        setSlots(updatedSlots);
    };
    fetchAvailability();
  }, [selectedDate]);

  return (
    <div className="min-h-screen bg-[#FFF0F7]">
      {/* Header */}
      <header className="bg-white px-6 py-4 flex justify-center items-center shadow-sm sticky top-0 z-50">
        <div className="flex flex-col items-center">
             <div className="w-12 h-12 rounded-full overflow-hidden border border-pink-200 mb-1 relative">
                <Image src="/logo.jpg" alt="Logo" fill className="object-cover" />
             </div>
             <h1 className="font-bold text-lg text-primary tracking-tight">Fairymate.Nail</h1>
        </div>
      </header>

      {/* เพิ่ม pb-40 เพื่อแก้ปัญหาเลื่อนลงไม่สุด */}
      <main className="max-w-md mx-auto p-6 space-y-6 pb-40">
        
        {/* Info Card */}
        <div className="bg-white/80 backdrop-blur-sm rounded-3xl p-6 text-center shadow-sm">
            <h2 className="text-xl font-bold text-slate-800 mb-2">ตารางคิวว่าง</h2>
            <p className="text-slate-500 text-sm">สีเขียวคือว่าง สามารถทักแชทจองได้เลยค่ะ</p>
        </div>

        {/* Date Selector */}
        <div className="bg-white rounded-3xl p-6 shadow-soft">
            <DateCarousel selectedDate={selectedDate} onDateSelect={setSelectedDate} />
        </div>

        {/* Time Slots Grid */}
        <div>
          <div className="flex items-center justify-between mb-4 px-2">
            <h3 className="font-bold text-slate-700">รอบเวลา (13:00 - 22:00)</h3>
            <div className="flex gap-3 text-[10px]">
                <div className="flex items-center gap-1"><div className="w-2 h-2 bg-green-500 rounded-full"></div>ว่าง</div>
                <div className="flex items-center gap-1"><div className="w-2 h-2 bg-slate-300 rounded-full"></div>เต็ม</div>
            </div>
          </div>
          
          <div className="grid grid-cols-3 gap-3">
            {slots.map((slot, idx) => (
                <div
                key={idx}
                className={cn(
                    "flex flex-col items-center justify-center py-3 rounded-2xl border transition-all cursor-default relative overflow-hidden",
                    slot.status === 'OPEN'
                        ? "bg-white border-green-400/30 text-green-600 shadow-sm" // สไตล์ตอนว่าง
                        : "bg-slate-100 border-transparent text-slate-400 opacity-60" // สไตล์ตอนเต็ม
                )}
                >
                <span className={cn(
                    "text-lg font-bold mb-0.5",
                    slot.status === 'FULL' && "line-through decoration-slate-300" // ขีดฆ่าเวลาถ้าเต็ม
                )}>
                    {slot.time}
                </span>
                
                <span className={cn(
                    "text-[12px] font-bold tracking-wide",
                    slot.status === 'OPEN' ? "text-green-500" : "text-slate-400"
                )}>
                    {slot.status === 'OPEN' ? 'ว่าง' : 'เต็ม'}
                </span>
                </div>
            ))}
          </div>
        </div>
      </main>

      {/* Floating Action Button (CTA) */}
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