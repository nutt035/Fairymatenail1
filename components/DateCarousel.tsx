"use client";
import { format, addDays, isSameDay } from 'date-fns';
import { cn } from '@/lib/utils';

interface DateCarouselProps {
  selectedDate: Date;
  onDateSelect: (date: Date) => void;
  daysToShow?: number;
  className?: string;
}

export default function DateCarousel({ selectedDate, onDateSelect, daysToShow = 14, className }: DateCarouselProps) {
  const dates = Array.from({ length: daysToShow }, (_, i) => addDays(new Date(), i));

  return (
    <div className={cn("w-full overflow-x-auto no-scrollbar pb-2", className)}>
      <div className="flex gap-3">
        {dates.map((date) => {
          const isSelected = isSameDay(date, selectedDate);
          return (
            <button
              key={date.toISOString()}
              onClick={() => onDateSelect(date)}
              className={cn(
                "flex flex-col items-center justify-center min-w-[70px] h-[80px] rounded-2xl border transition-all duration-200",
                isSelected
                  ? "bg-primary border-primary text-white shadow-lg shadow-primary/30"
                  : "bg-white border-slate-100 text-slate-400 hover:border-primary/30"
              )}
            >
              <span className="text-xs font-medium uppercase">{format(date, 'EEE')}</span>
              <span className="text-2xl font-bold mt-1">{format(date, 'd')}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}