"use client";
import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { formatCurrency, cn } from '@/lib/utils';
import {
  Send,
  Loader2,
  CalendarDays,
  CheckCircle,
  X,
  Edit2,
  Trash2,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import StatusBadge from '@/components/ui/StatusBadge';
import { format, isToday, parseISO, startOfMonth, endOfMonth, addMonths, subMonths, eachDayOfInterval, isSameDay, isSameMonth } from 'date-fns';
import { th } from 'date-fns/locale';

// --- Types ---
interface Queue {
  id: string;
  customer_name: string; // This stores the Queue Number (e.g., '01')
  service_name: string;
  date: string;
  start_time: string;
  end_time: string;
  price: number;
  note: string;
  status: 'pending' | 'in_progress' | 'finished';
}

export default function QueueManagement() {
  const [queues, setQueues] = useState<Queue[]>([]);
  const [loading, setLoading] = useState(true);

  // Input & UI States
  const [inputText, setInputText] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Month Navigation State (NEW)
  const [viewMonth, setViewMonth] = useState(new Date());

  // Modal States
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingQueue, setEditingQueue] = useState<Queue | null>(null);

  // Ref for scrolling
  const listRef = useRef<HTMLDivElement>(null);

  // --- Fetch Data (Order by Date then Time) ---
  const fetchQueues = async () => {
    try {
      // Use viewMonth to determine date range
      const startDate = format(startOfMonth(viewMonth), 'yyyy-MM-dd');
      const endDate = format(endOfMonth(viewMonth), 'yyyy-MM-dd');

      console.log('🔍 Fetching queues for:', startDate, 'to', endDate);

      const { data, error } = await supabase
        .from('queues')
        .select('*')
        .gte('date', startDate)
        .lte('date', endDate)
        .neq('status', 'cancelled')
        .order('date', { ascending: true }) // ✅ เรียงตามวันที่จริงก่อน
        .order('start_time', { ascending: true }); // ✅ แล้วเรียงตามเวลา

      console.log('📦 Query result:', { data, error });

      if (error) throw error;
      if (data) setQueues(data);
    } catch (err) {
      console.error('Error fetching queues:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQueues();
  }, [viewMonth]); // Re-fetch when month changes

  // --- Scroll to Date (Handle DateCarousel Click) ---
  const handleDateSelect = (date: Date) => {
    setSelectedDate(date);
    const dateStr = format(date, 'yyyy-MM-dd');
    const element = document.getElementById(`date-section-${dateStr}`);

    if (element && listRef.current) {
      const topPos = element.offsetTop - 10;
      listRef.current.scrollTo({
        top: topPos,
        behavior: 'smooth'
      });
    }
  };

  // --- Magic Parser (V.6 - Auto Queue, Flexible Price/Note, Auto Deposit Note) ---
  const handleMagicSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    let text = inputText.trim();
    const now = new Date();
    let targetDate = format(now, 'yyyy-MM-dd');
    let startTime = '';
    let endTime = '';
    let price = 0;
    let deposit = 0; // NEW: สำหรับเก็บยอดมัดจำ

    let serviceName = 'บริการทั่วไป';
    let note = '';
    let processText = text;

    // 1. หา Date (DD/MM/YY หรือ DD/MM/YYYY)
    const thaiDateRegex = /^(\d{1,2})[/\.](\d{1,2})[/\.](\d{2,4})\s+/;
    const dateMatch = processText.match(thaiDateRegex);
    if (dateMatch) {
      let day = parseInt(dateMatch[1]);
      let month = parseInt(dateMatch[2]);
      let year = parseInt(dateMatch[3]);

      // แปลงปี พ.ศ. (2568) เป็น ค.ศ. (2025)
      if (year > 2300) {
        year -= 543;
      } else if (year < 100) { // เช่น ปี 68
        // ใช้ logic ที่ปลอดภัยกว่า: ถ้าปีย่อ < 70 ให้ถือเป็น 20xx
        // เช่น 68 -> 2068 ซึ่งผิด (ควรเป็น 2025)
        // เนื่องจากเราอยู่ในปี 2025 (พ.ศ. 2568) ให้ปี 68 แปลงเป็น 2025
        if (year === (now.getFullYear() % 100) || year === (now.getFullYear() % 100) + 1) {
          // ถือว่าผู้ใช้พิมพ์ปีปัจจุบัน หรือ ปีถัดไป
          year = year + 2000;
        } else {
          // Fallback to current year logic if date is far in the past/future
          year = year + 2000;
        }
      }

      const parsedDate = new Date(year, month - 1, day);
      if (isNaN(parsedDate.getTime())) {
        targetDate = format(now, 'yyyy-MM-dd'); // Fallback to today
      } else {
        targetDate = format(parsedDate, 'yyyy-MM-dd');
      }

      processText = processText.replace(thaiDateRegex, '');
    }

    // 2. หา Time (HH:MM-HH:MM) หรือ (HH:MM)
    const timeRangeRegex = /(\d{1,2}[:.]\d{2})\s*-\s*(\d{1,2}[:.]\d{2})/;
    const singleTimeRegex = /(\d{1,2}[:.]\d{2})/;
    let timeMatch = processText.match(timeRangeRegex);

    if (timeMatch) {
      startTime = timeMatch[1].replace('.', ':').padStart(5, '0');
      endTime = timeMatch[2].replace('.', ':').padStart(5, '0');
      processText = processText.replace(timeRangeRegex, '').trim();
    } else {
      timeMatch = processText.match(singleTimeRegex);
      if (timeMatch) {
        startTime = timeMatch[1].replace('.', ':').padStart(5, '0');
        const [h, m] = startTime.split(':').map(Number);
        const endD = new Date();
        endD.setHours(h + 1, m);
        endTime = `${String(endD.getHours()).padStart(2, '0')}:${String(endD.getMinutes()).padStart(2, '0')}`;
        processText = processText.replace(singleTimeRegex, '').trim();
      }
    }

    // 3. Extract Price & Deposit (Flexible location)
    // หาตัวเลข 3-4 หลัก ที่อาจตามด้วย "มัดจำ" และ "ตัวเลข"
    const depositRegex = /(มัดจำ|มัดจำ\s+)(\d{2,4})/i;
    const priceRegex = /(\d{3,4})/; // หาตัวเลขราคา

    // 3.1 หา Deposit ก่อน
    const depositMatch = processText.match(depositRegex);
    if (depositMatch) {
      deposit = parseInt(depositMatch[2]);
      processText = processText.replace(depositRegex, '').trim();
    }

    // 3.2 หา Price จากส่วนที่เหลือ
    const priceMatch = processText.match(priceRegex);
    if (priceMatch) {
      price = parseInt(priceMatch[1]);
      processText = processText.replace(priceRegex, '').trim();
    }

    // 4. แยก Service Name และ Note (สิ่งที่เหลือทั้งหมด)
    const parts = processText.split(/\s+/).filter(p => p.length > 0);

    // Service Name คือคำแรกๆ (เดาจากประสบการณ์เพื่อน) ส่วนที่เหลือคือโน้ต
    if (parts.length > 0) {
      serviceName = parts[0];
      note = parts.slice(1).join(' ');
    }

    // 5. Auto Generate Note (มัดจำ)
    if (deposit > 0 && price > 0) {
      const remaining = price - deposit;
      note = `หักมัดจำแล้ว ${formatCurrency(deposit)} เหลือจ่าย ${formatCurrency(remaining)}. ${note}`.trim();
    } else if (deposit > 0 && price === 0) {
      note = `รับมัดจำแล้ว ${formatCurrency(deposit)}. (ยังไม่ระบุราคารวม). ${note}`.trim();
    }

    // Final cleanup
    serviceName = serviceName.trim() || 'บริการทั่วไป';
    note = note.trim();


    // 6. Calculate Queue Number (NEW LOGIC)
    let customerName = 'ลูกค้าทั่วไป';

    if (startTime) {
      // 1. Get all existing queues for the targetDate
      const { data: existingQueues } = await supabase
        .from('queues')
        .select('id')
        .eq('date', targetDate)
        .neq('status', 'finished')
        .neq('status', 'cancelled');

      // 2. Count them and add 1 for the new queue
      const queueCount = (existingQueues || []).length + 1;
      // 3. Format as 01, 02, 03...
      customerName = String(queueCount).padStart(2, '0');

      // 7. Save to Supabase
      const insertData = {
        customer_name: customerName, // <-- เลขคิวอัตโนมัติ
        service_name: serviceName,
        date: targetDate,
        start_time: startTime,
        end_time: endTime,
        price: price,
        note: note,
        status: 'pending'
      };

      console.log('📝 Inserting queue:', insertData);

      const { data: insertedData, error: insertError } = await supabase
        .from('queues')
        .insert([insertData])
        .select();

      console.log('✅ Insert result:', { insertedData, insertError });

      if (!insertError) {
        setInputText('');
        fetchQueues();
      } else {
        console.error('❌ Insert error:', insertError);
        alert("บันทึกไม่สำเร็จ: " + insertError.message);
      }
    } else {
      alert("กรุณาระบุเวลาด้วยครับ (เช่น 13:00)");
    }
  };

  // --- Actions ---
  const handleStatusChange = async (id: string, newStatus: string) => {
    await supabase.from('queues').update({ status: newStatus }).eq('id', id);
    fetchQueues();
    setExpandedId(null);
  };

  const handleDelete = async (id: string) => {
    if (confirm('ลบคิวนี้?')) {
      await supabase.from('queues').delete().eq('id', id);
      fetchQueues();
    }
  };

  const handleOpenEdit = (q: Queue) => {
    setEditingQueue(q);
    setIsEditModalOpen(true);
  };

  // --- Group Data ---
  const groupedQueues = queues.reduce((acc, queue) => {
    const d = queue.date;
    if (!acc[d]) acc[d] = [];
    acc[d].push(queue);
    return acc;
  }, {} as Record<string, Queue[]>);

  // คำนวณยอดเงินของวันที่เลือก (รวมทั้งหมด)
  const selectedDateStr = format(selectedDate, 'yyyy-MM-dd');
  const totalSelectedDate = (groupedQueues[selectedDateStr] || []).reduce((sum, q) => sum + q.price, 0);

  // --- UI Components ---
  const EditModal = () => {
    // FIX: ใช้ Local State เพื่อไม่ให้ Re-render ขณะพิมพ์
    const [tempData, setTempData] = useState({
      customer_name: editingQueue?.customer_name || '',
      service_name: editingQueue?.service_name || '',
      note: editingQueue?.note || '',
      start_time: editingQueue?.start_time.slice(0, 5) || '',
      end_time: editingQueue?.end_time.slice(0, 5) || '',
      price: editingQueue?.price || 0,
    });

    // ตั้งค่าเริ่มต้นเมื่อ Modal ถูกเปิด
    useEffect(() => {
      if (editingQueue) {
        setTempData({
          customer_name: editingQueue.customer_name,
          service_name: editingQueue.service_name,
          note: editingQueue.note,
          start_time: editingQueue.start_time.slice(0, 5),
          end_time: editingQueue.end_time.slice(0, 5),
          price: editingQueue.price,
        });
      }
    }, [editingQueue]);

    if (!editingQueue) return null;

    const handleSaveEdit = async () => {
      // UPDATE: ใช้ tempData ที่เสถียรแล้วส่งไป Supabase
      await supabase.from('queues').update({
        customer_name: tempData.customer_name,
        service_name: tempData.service_name,
        start_time: tempData.start_time,
        end_time: tempData.end_time,
        price: tempData.price,
        note: tempData.note,
      }).eq('id', editingQueue.id);
      fetchQueues();
      setIsEditModalOpen(false);
    };

    const handleChange = (field: keyof typeof tempData, value: string | number) => {
      setTempData(prev => ({ ...prev, [field]: value }));
    };


    return (
      <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in w-full h-full">
        <div className="bg-white rounded-3xl w-full max-w-sm p-6 shadow-2xl animate-in zoom-in-95">
          <h3 className="text-xl font-bold mb-4 text-slate-800">แก้ไขข้อมูล</h3>
          <div className="space-y-4">
            <div>
              <label className="text-xs font-bold text-slate-400 uppercase">เลขคิว (ลูกค้า)</label>
              <input
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 mt-1 outline-none focus:ring-2 focus:ring-primary/30"
                value={tempData.customer_name}
                onChange={e => handleChange('customer_name', e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-400 uppercase">บริการ</label>
              <input
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 mt-1 outline-none focus:ring-2 focus:ring-primary/30"
                value={tempData.service_name}
                onChange={e => handleChange('service_name', e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-400 uppercase">โน้ต</label>
              <input
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 mt-1 outline-none focus:ring-2 focus:ring-primary/30"
                value={tempData.note}
                onChange={e => handleChange('note', e.target.value)}
              />
            </div>
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="text-xs font-bold text-slate-400 uppercase">เริ่ม</label>
                <input
                  type="time"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 mt-1 text-center outline-none focus:ring-2 focus:ring-primary/30"
                  value={tempData.start_time}
                  onChange={e => handleChange('start_time', e.target.value)}
                />
              </div>
              <div className="flex-1">
                <label className="text-xs font-bold text-slate-400 uppercase">จบ</label>
                <input
                  type="time"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 mt-1 text-center outline-none focus:ring-2 focus:ring-primary/30"
                  value={tempData.end_time}
                  onChange={e => handleChange('end_time', e.target.value)}
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-bold text-slate-400 uppercase">ราคา</label>
              <input
                type="number"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 mt-1 font-bold text-primary text-lg outline-none focus:ring-2 focus:ring-primary/30"
                value={tempData.price}
                onChange={e => handleChange('price', Number(e.target.value))}
              />
            </div>
          </div>
          <div className="flex gap-3 mt-6">
            <button onClick={() => setIsEditModalOpen(false)} className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold">ยกเลิก</button>
            <button
              onClick={handleSaveEdit}
              className="flex-1 py-3 bg-primary text-white rounded-xl font-bold shadow-lg shadow-primary/20"
            >บันทึก</button>
          </div>
        </div>
      </div>
    );
  };

  // --- Main Render ---
  return (
    <div className="flex flex-col h-[100dvh] w-full max-w-[100vw] overflow-x-hidden bg-[#F8F9FA] relative">

      {/* 1. Header + Month Navigation */}
      <div className="bg-white shadow-sm z-30 shrink-0 w-600px">
        <div className="px-5 pt-4 pb-2 flex justify-between items-center border-b border-slate-50 bg-white">
          <div>
            <h1 className="text-sm font-bold text-slate-500 flex items-center gap-1 uppercase tracking-wide">
              <CalendarDays className="text-primary" size={16} />
              ยอดรวม {format(selectedDate, 'd MMM', { locale: th })}
            </h1>
          </div>
          <div className="text-right">
            <p className="text-4xl font-black text-slate-800 tracking-tighter leading-none drop-shadow-sm">
              {formatCurrency(totalSelectedDate)}
            </p>
            <p className="text-[10px] text-slate-400 font-medium mt-0.5">
              (รวมทุกคิวในวันที่เลือก)
            </p>
          </div>
        </div>

        {/* Month Navigation */}
        <div className="py-2 px-4 w-full border-b border-slate-50">
          <div className="flex items-center justify-between gap-2">
            {/* Previous Month */}
            <button
              onClick={() => setViewMonth(subMonths(viewMonth, 1))}
              className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors"
            >
              <ChevronLeft size={20} />
            </button>

            {/* Current Month Display */}
            <div className="flex-1 text-center">
              <h2 className="text-lg font-bold text-slate-800">
                {format(viewMonth, 'MMMM yyyy', { locale: th })}
              </h2>
              <p className="text-xs text-slate-400">
                {queues.length} คิว • รวม {formatCurrency(queues.reduce((sum, q) => sum + q.price, 0))}
              </p>
            </div>

            {/* Next Month */}
            <button
              onClick={() => setViewMonth(addMonths(viewMonth, 1))}
              className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors"
            >
              <ChevronRight size={20} />
            </button>

            {/* Today Button */}
            <button
              onClick={() => {
                setViewMonth(new Date());
                setSelectedDate(new Date());
              }}
              className="px-3 py-2 rounded-xl bg-primary text-white text-xs font-bold shadow-md shadow-primary/20 hover:bg-primary/90 transition-colors"
            >
              วันนี้
            </button>
          </div>
        </div>

        {/* Day Picker Carousel - Full Month (scroll to see more) */}
        <div className="py-2 px-3 max-w-6xl overflow-x-auto no-scrollbar">
          <div className="flex gap-3 pb-2" style={{ width: 'max-content' }}>
            {eachDayOfInterval({
              start: startOfMonth(viewMonth),
              end: endOfMonth(viewMonth)
            }).map((day) => {
              const dayStr = format(day, 'yyyy-MM-dd');
              const hasQueues = queues.some(q => q.date === dayStr);
              const isSelected = isSameDay(day, selectedDate);
              const isTodayDay = isToday(day);
              const dayQueuesCount = queues.filter(q => q.date === dayStr).length;

              return (
                <button
                  key={dayStr}
                  onClick={() => {
                    setSelectedDate(day);
                    const element = document.getElementById(`date-section-${dayStr}`);
                    if (element && listRef.current) {
                      const topPos = element.offsetTop - 10;
                      listRef.current.scrollTo({
                        top: topPos,
                        behavior: 'smooth'
                      });
                    }
                  }}
                  className={cn(
                    "flex flex-col items-center justify-center min-w-[90px] h-[85px] rounded-xl border transition-all duration-200 shrink-0",
                    isSelected
                      ? "bg-primary border-primary text-white shadow-lg shadow-primary/30"
                      : isTodayDay
                        ? "bg-primary/10 border-primary/30 text-primary"
                        : hasQueues
                          ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                          : "bg-white border-slate-100 text-slate-400 hover:border-primary/30"
                  )}
                >
                  <span className={cn(
                    "text-xs font-medium uppercase",
                    isSelected ? "text-white/80" : ""
                  )}>
                    {format(day, 'EEE', { locale: th }).slice(0, 2)}
                  </span>
                  <span className={cn(
                    "text-2xl font-bold mt-0.5",
                    isSelected ? "text-white" : ""
                  )}>
                    {format(day, 'd')}
                  </span>
                  {hasQueues && (
                    <span className={cn(
                      "text-[10px] font-bold mt-1",
                      isSelected ? "text-white/80" : "text-emerald-600"
                    )}>
                      {dayQueuesCount} คิว
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* 2. Scrollable List Area */}
      <div
        ref={listRef}
        className="flex-1 overflow-y-auto overflow-x-hidden px-4 pt-2 pb-32 space-y-4 w-full bg-[#F8F9FA]"
      >
        {loading ? (
          <div className="flex justify-center py-10"><Loader2 className="animate-spin text-primary" /></div>
        ) : (
          Object.keys(groupedQueues).map((dateStr) => {
            const dateObj = parseISO(dateStr);
            let dateLabel = format(dateObj, 'EEEE d MMM', { locale: th });
            const isTodayDate = isToday(dateObj);

            return (
              <div key={dateStr} id={`date-section-${dateStr}`} className="w-full pt-2">
                {/* Date Heading */}
                <div className="flex items-center gap-2 mb-2 sticky top-0 bg-[#F8F9FA]/95 backdrop-blur-sm py-2 z-10 w-full">
                  <div className={cn("w-1.5 h-4 rounded-full", isTodayDate ? "bg-primary" : "bg-slate-300")}></div>
                  <h3 className={cn("text-sm font-bold uppercase", isTodayDate ? "text-primary" : "text-slate-500")}>
                    {dateLabel} {isTodayDate && "(วันนี้)"}
                  </h3>
                </div>

                {/* Queue Cards */}
                <div className="space-y-2.5 w-full">
                  {groupedQueues[dateStr].map((q) => (
                    <div
                      key={q.id}
                      onClick={() => setExpandedId(expandedId === q.id ? null : q.id)}
                      className={cn(
                        "bg-white rounded-xl shadow-[0_2px_8px_-2px_rgba(0,0,0,0.05)] border border-slate-100 overflow-hidden transition-all duration-200 cursor-pointer w-full select-none",
                        q.status === 'finished' ? "opacity-60 grayscale-[0.3]" : "active:scale-[0.98]",
                        expandedId === q.id ? "ring-2 ring-primary ring-offset-2" : ""
                      )}
                    >
                      <div className="p-3.5 flex gap-3 items-center">
                        {/* Time */}
                        <div className="flex flex-col items-center justify-center min-w-[50px] bg-slate-50 rounded-lg py-1.5 px-1 border border-slate-100">
                          <span className="font-black text-slate-700 text-sm leading-none">{q.start_time.slice(0, 5)}</span>
                          <span className="text-[10px] text-slate-400 font-medium mt-1 leading-none">{q.end_time.slice(0, 5)}</span>
                        </div>

                        {/* Info (แสดงเลขคิว + บริการ/โน้ต) */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <h4 className={cn("font-black text-slate-800 text-base truncate", q.status === 'finished' && "line-through")}>
                              {q.customer_name} {/* <--- เลขคิว */}
                            </h4>
                            {q.status === 'finished' && <CheckCircle size={14} className="text-green-500 shrink-0" />}
                          </div>
                          <div className="text-xs text-slate-500 truncate mt-0.5">{q.service_name}</div> {/* <--- ชื่อบริการ */}
                          {q.note && <div className="text-[10px] text-orange-500 truncate mt-0.5">Note: {q.note}</div>} {/* <--- โน้ต */}
                        </div>

                        {/* Price */}
                        <div className="text-right shrink-0">
                          <div className="font-black text-primary text-lg leading-tight">฿{q.price}</div>
                          <div className="scale-90 origin-right">
                            <StatusBadge status={q.status} />
                          </div>
                        </div>
                      </div>

                      {/* Action Panel */}
                      {expandedId === q.id && (
                        <div className="bg-slate-50 p-2 flex justify-end gap-2 border-t border-slate-100 animate-in slide-in-from-top-2">
                          <button onClick={(e) => { e.stopPropagation(); handleOpenEdit(q); }}
                            className="flex items-center gap-1 px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-600 shadow-sm">
                            <Edit2 size={14} /> แก้ไข
                          </button>

                          <button onClick={(e) => { e.stopPropagation(); handleDelete(q.id); }}
                            className="flex items-center gap-1 px-3 py-2 bg-white border border-red-100 rounded-lg text-xs font-bold text-red-500 shadow-sm">
                            <Trash2 size={14} /> ลบ
                          </button>

                          {q.status !== 'finished' ? (
                            <button onClick={(e) => { e.stopPropagation(); handleStatusChange(q.id, 'finished'); }}
                              className="flex items-center gap-1 px-4 py-2 bg-green-500 text-white rounded-lg text-xs font-bold shadow-md shadow-green-200 ml-auto">
                              <CheckCircle size={14} /> จบงาน
                            </button>
                          ) : (
                            <button onClick={(e) => { e.stopPropagation(); handleStatusChange(q.id, 'pending'); }}
                              className="flex items-center gap-1 px-4 py-2 bg-slate-200 text-slate-600 rounded-lg text-xs font-bold ml-auto">
                              <X size={14} /> ยกเลิกจบ
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* 3. Input Bar (Magic Input) */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-slate-100 px-4 py-3 pb-safe w-full max-w-[100vw]">
        <div className="max-w-md mx-auto w-full">
          <form onSubmit={handleMagicSubmit} className="flex gap-2 items-center">
            <div className="flex-1 relative">
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder='เช่น 13/12/68 13:00-15:00 ต่อปกติ 339 มัดจำ 100'
                className="w-full bg-slate-100 text-slate-800 rounded-xl px-4 py-3 text-base focus:bg-white focus:ring-2 focus:ring-primary/50 outline-none transition-all placeholder:text-slate-400"
              />
            </div>
            <button
              type="submit"
              disabled={!inputText.trim()}
              className="bg-primary text-white w-12 h-12 rounded-xl flex items-center justify-center shadow-lg shadow-primary/20 disabled:bg-slate-200 disabled:shadow-none transition-all active:scale-95 shrink-0"
            >
              <Send size={20} />
            </button>
          </form>
          <div className="text-[10px] text-center text-slate-400 mt-2 font-medium">
            รูปแบบ: <b>วันที่/เดือน/ปี เวลาเริ่ม-จบ รายการ ราคา [มัดจำ XX] [โน้ต]</b>
          </div>
        </div>
        <div className="h-1 md:hidden"></div>
      </div>

      {/* Edit Modal (พร้อม Local State Fix) */}
      {isEditModalOpen && <EditModal />}
    </div>
  );
}
