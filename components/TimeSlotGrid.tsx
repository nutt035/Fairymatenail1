import { cn } from '@/lib/utils';

interface TimeSlotProps {
  time: string;
  status: 'OPEN' | 'FULL';
  onClick?: () => void;
  selected?: boolean;
}

export default function TimeSlotGrid({ slots, onSelect, selectedTime }: { slots: any[], onSelect: (time: string) => void, selectedTime: string | null }) {
  return (
    <div className="grid grid-cols-3 gap-3">
      {slots.map((slot, idx) => (
        <button
          key={idx}
          disabled={slot.status === 'FULL'}
          onClick={() => onSelect(slot.time)}
          className={cn(
            "flex flex-col items-center justify-center py-4 rounded-2xl border transition-all",
            slot.status === 'OPEN' && selectedTime === slot.time
                ? "bg-primary text-white border-primary shadow-lg shadow-primary/20"
                : slot.status === 'OPEN'
                ? "bg-white border-green-100 hover:bg-green-50/50"
                : "bg-slate-50 border-transparent cursor-not-allowed opacity-60"
          )}
        >
          <span className={cn(
            "text-xl font-bold mb-1",
            slot.status === 'OPEN' && selectedTime !== slot.time ? "text-green-600" : (slot.status === 'FULL' ? "text-slate-400" : "text-white")
          )}>
            {slot.time}
          </span>
          <span className={cn(
            "text-[10px] font-bold tracking-wider",
             slot.status === 'OPEN' && selectedTime !== slot.time ? "text-green-500" : (slot.status === 'FULL' ? "text-slate-400" : "text-white/90")
          )}>
            {slot.status}
          </span>
        </button>
      ))}
    </div>
  );
}