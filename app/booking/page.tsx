"use client";
import { useState, useEffect } from 'react';
import Image from 'next/image';
import { Facebook } from 'lucide-react';
import DateCarousel from '@/components/DateCarousel';
import { format } from 'date-fns';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';

export default function BookingPage() {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [slots, setSlots] = useState<any[]>([]);

  // Generate Fixed Time Slots for Display
  const baseSlots = [
    '13:00', '13:30', '14:00', '14:30', '15:00', '15:30', 
    '16:00', '16:30', '17:00', '17:30', '18:00', '18:30', 
    '19:00', '19:30', '20:00', '20:30', '21:00', '21:30'
  ];

  useEffect(() => {
    const fetchAvailability = async () => {
        const dateStr = selectedDate.toISOString().split('T')[0];
        
        // Fetch booked queues
        const { data: bookings } = await supabase
            .from('queues')
            .select('start_time, end_time')
            .eq('date', dateStr)
            .neq('status', 'cancelled'); // Assuming you might have cancelled status later

        // Calculate status for each slot
        const updatedSlots = baseSlots.map(time => {
            const isBooked = bookings?.some(b => {
                // Logic: Slot time falls within a booked range
                // Note: Simple string comparison works for HH:MM format
                return time >= b.start_time.slice(0,5) && time < b.end_time.slice(0,5);
            });
            return { time, status: isBooked ? 'FULL' : 'OPEN' };
        });
        setSlots(updatedSlots);
    };
    fetchAvailability();
  }, [selectedDate]);

  return (
    <div className="min-h-screen bg-[#FFF0F7]"> {/* Pinkish background like logo */}
      {/* Header */}
      <header className="bg-white px-6 py-4 flex justify-center items-center shadow-sm sticky top-0 z-50">
        <div className="flex flex-col items-center">
             <div className="w-12 h-12 rounded-full overflow-hidden border border-pink-200 mb-1 relative">
                <Image src="/logo.jpg" alt="Logo" fill className="object-cover" />
             </div>
             <h1 className="font-bold text-lg text-primary tracking-tight">Fairymate.Nail</h1>
        </div>
      </header>

      <main className="max-w-md mx-auto p-6 space-y-6 pb-24">
        {/* Info Card */}
        <div className="bg-white/80 backdrop-blur-sm rounded-3xl p-6 text-center shadow-sm">
            <h2 className="text-xl font-bold text-slate-800 mb-2">ตารางคิวว่าง</h2>
            <p className="text-slate-500 text-sm">กรุณาเช็ควันและเวลาที่ว่างก่อนจองนะคะ</p>
        </div>

        {/* Date Selector */}
        <div className="bg-white rounded-3xl p-6 shadow-soft">
            <DateCarousel selectedDate={selectedDate} onDateSelect={setSelectedDate} />
        </div>

        {/* Time Slots Grid */}
        <div>
          <div className="flex items-center justify-between mb-4 px-2">
            <h3 className="font-bold text-slate-700">Available Slots</h3>
            <span className="text-xs text-slate-400">13:00 - 22:00</span>
          </div>
          
          <div className="grid grid-cols-3 gap-3">
            {slots.map((slot, idx) => (
                <div
                key={idx}
                className={cn(
                    "flex flex-col items-center justify-center py-3 rounded-2xl border transition-all cursor-default",
                    slot.status === 'OPEN'
                        ? "bg-white border-green-200 text-green-600"
                        : "bg-slate-100 border-transparent text-slate-400 opacity-60"
                )}
                >
                <span className="text-lg font-bold mb-0.5">{slot.time}</span>
                <span className={cn(
                    "text-[10px] font-bold tracking-wider uppercase",
                    slot.status === 'OPEN' ? "text-green-500" : "text-slate-400"
                )}>
                    {slot.status}
                </span>
                </div>
            ))}
          </div>
        </div>
      </main>

      {/* Floating Action Button (CTA) */}
      <div className="fixed bottom-0 left-0 w-full p-4 bg-white border-t border-slate-100 shadow-lg z-50">
        <div className="max-w-md mx-auto">
            <a 
                href="https://www.facebook.com/messages/t/583498464852057" // <-- ใส่ลิงก์ Facebook ของร้านตรงนี้
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-center gap-3 w-full bg-[#1877F2] text-white py-4 rounded-2xl font-bold text-lg hover:bg-[#166fe5] transition-colors shadow-blue-200 shadow-lg"
            >
                <Facebook className="fill-white" />
                จองคิวผ่าน Facebook
            </a>
            <p className="text-center text-xs text-slate-400 mt-3">
                *ลูกค้าไม่สามารถจองผ่านเว็บได้ กรุณาทักแชทเพื่อยืนยันคิวค่ะ
            </p>
        </div>
      </div>
    </div>
  );
}