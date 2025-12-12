'use client';

import { format, addDays, isSameDay, isPast } from 'date-fns';
import { th } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Check, X } from 'lucide-react';

interface DateCarouselProps {
  selectedDate: Date;
  onDateSelect: (date: Date) => void;
  daysToShow?: number;
  className?: string;
  // NEW PROP: Pass availability status to show on the button
  availabilityMap?: Record<string, 'OPEN' | 'FULL' | 'CLOSED' | 'NONE'>;
}

export default function DateCarousel({ selectedDate, onDateSelect, daysToShow = 14, className, availabilityMap = {} }: DateCarouselProps) {
  const today = new Date();
  const dates = Array.from({ length: daysToShow }, (_, i) => addDays(today, i));

  return (
    <div className={cn("w-full overflow-x-auto no-scrollbar pb-2", className)}>
      <div className="flex gap-3">
        {dates.map((date) => {
          const isSelected = isSameDay(date, selectedDate);
          const dateStr = format(date, 'yyyy-MM-dd');
          const status = availabilityMap[dateStr] || 'NONE';
          const isPastDate = isPast(date) && !isSameDay(date, today);

          let buttonClass = "bg-white border-slate-100 text-slate-400 hover:border-primary/30";
          let statusElement = null;

          if (isPastDate) {
            buttonClass = "bg-slate-50 border-slate-100 text-slate-300 cursor-not-allowed opacity-60";
            statusElement = <span className="text-[10px]">ผ่านไปแล้ว</span>;
          } else if (status === 'OPEN') {
            buttonClass = "bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100";
            statusElement = <Check size={12} className="text-emerald-500" />;
          } else if (status === 'FULL' || status === 'NONE') {
            buttonClass = "bg-pink-50 border-pink-200 text-pink-700 cursor-not-allowed opacity-80";
            statusElement = <X size={12} className="text-pink-500" />;
          } else if (status === 'CLOSED') {
            buttonClass = "bg-red-50 border-red-200 text-red-700 cursor-not-allowed opacity-80";
            statusElement = <X size={12} className="text-red-500" />;
          }

          if (isSelected && !isPastDate) {
            buttonClass = "bg-primary border-primary text-white shadow-lg shadow-primary/30";
            statusElement = <span className="text-[10px] font-bold">เลือกแล้ว</span>;
          } else if (isSelected && isPastDate) {
            buttonClass = "bg-slate-300 border-slate-400 text-slate-600 opacity-80";
            statusElement = <span className="text-[10px]">เลือกแล้ว</span>;
          }


          return (
            <button
              key={date.toISOString()}
              onClick={() => {
                // อนุญาตให้เลือกเฉพาะวันที่ไม่ใช่ในอดีตและมีสถานะ OPEN
                if (!isPastDate && status === 'OPEN') {
                  onDateSelect(date);
                }
              }}
              disabled={isPastDate || status === 'FULL' || status === 'CLOSED'}
              className={cn(
                "flex flex-col items-center justify-center min-w-[70px] h-[80px] rounded-xl border transition-all duration-200 active:scale-[0.98] shrink-0",
                buttonClass
              )}
            >
              <span className={cn(
                "text-xs font-medium uppercase",
                isSelected ? "text-white/80" : ""
              )}>
                {format(date, 'EEE', { locale: th }).slice(0, 2)}
              </span>
              <span className={cn(
                "text-2xl font-bold mt-0.5",
                isSelected ? "text-white" : ""
              )}>
                {format(date, 'd')}
              </span>
              <div className={cn(
                "mt-1 w-full text-center text-[10px] font-bold",
                isSelected ? "text-white/90" : ""
              )}>
                {statusElement}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}