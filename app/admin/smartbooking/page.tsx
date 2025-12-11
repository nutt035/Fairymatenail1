'use client';

import React, { useState } from 'react';
import { Save, CheckCircle, Edit2, Trash2, Coins, CalendarDays } from 'lucide-react';

// Type ข้อมูล
type QueueItem = {
  id: number;
  date: number; 
  timeDisplay: string;
  description: string;
  totalPrice: number;
  deposit: number;
  status: 'pending' | 'completed';
  isExpanded: boolean; 
};

export default function SmartLazyBooking() {
  const [inputText, setInputText] = useState('');
  
  // Mockup ข้อมูลหลายๆ วัน เพื่อทดสอบระบบ Scroll
  const [queues, setQueues] = useState<QueueItem[]>([
    { id: 1, date: 9, timeDisplay: '10:00-12:00', description: 'ทาสีลูกแก้ว', totalPrice: 450, deposit: 100, status: 'completed', isExpanded: false },
    { id: 2, date: 10, timeDisplay: '13:00-15:00', description: 'ต่อ PVC', totalPrice: 1200, deposit: 500, status: 'pending', isExpanded: false },
    { id: 3, date: 12, timeDisplay: '09:00-10:00', description: 'ตัดหนัง', totalPrice: 200, deposit: 0, status: 'pending', isExpanded: false },
    { id: 4, date: 15, timeDisplay: '16:00-18:00', description: 'ทาสีเจล+เพ้นท์', totalPrice: 800, deposit: 300, status: 'pending', isExpanded: false },
  ]);

  // --- Parser V.3 ---
  const parseInput = (text: string) => {
    let processText = text.trim();
    let date = new Date().getDate();

    const dateMatch = processText.match(/^(\d{1,2})\s+/);
    if (dateMatch) {
      date = parseInt(dateMatch[1]);
      processText = processText.replace(/^(\d{1,2})\s+/, '');
    }

    const timeRegex = /(\d{1,2}[:.]\d{2})\s*-\s*(\d{1,2}[:.]\d{2})/;
    const timeMatch = processText.match(timeRegex);
    let timeDisplay = '??:??';
    if (timeMatch) {
      timeDisplay = `${timeMatch[1].replace('.', ':')} - ${timeMatch[2].replace('.', ':')}`;
      processText = processText.replace(timeRegex, '').trim();
    }

    const priceRegex = /(\d+)(\/(\d+))?$/;
    const priceMatch = processText.match(priceRegex);
    let totalPrice = 0; let deposit = 0;
    
    if (priceMatch) {
      totalPrice = parseInt(priceMatch[1]);
      if (priceMatch[3]) deposit = parseInt(priceMatch[3]);
      processText = processText.replace(priceRegex, '').trim();
    }

    return { date, timeDisplay, description: processText, totalPrice, deposit };
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const data = parseInput(inputText);
    if (data.description) {
      const newQueue: QueueItem = {
        id: Date.now(),
        ...data,
        status: 'pending',
        isExpanded: false
      };
      setQueues([...queues, newQueue]);
      setInputText('');
      
      // Auto scroll ไปหาวันที่เพิ่งเพิ่ม (Optional UX)
      setTimeout(() => scrollToDate(data.date), 100);
    }
  };

  const handleEdit = (item: QueueItem) => {
    let textBack = `${item.date} ${item.timeDisplay} ${item.description} ${item.totalPrice}`;
    if (item.deposit > 0) textBack += `/${item.deposit}`;
    setInputText(textBack.trim());
    handleDelete(item.id);
  };

  // Helpers
  const toggleStatus = (id: number) => {
    setQueues(queues.map(q => q.id === id ? { ...q, status: q.status === 'pending' ? 'completed' : 'pending' } : q));
  };
  const toggleExpand = (id: number) => {
    setQueues(queues.map(q => q.id === id ? { ...q, isExpanded: !q.isExpanded } : { ...q, isExpanded: false }));
  };
  const handleDelete = (id: number) => {
    setQueues(queues.filter(q => q.id !== id));
  };
  
  // ฟังก์ชันวาร์ป (Scroll to Anchor)
  const scrollToDate = (dateNum: number) => {
    const element = document.getElementById(`date-section-${dateNum}`);
    if (element) {
        // คำนวณ offset นิดหน่อยเพื่อให้หัวข้อไม่ไปมุดใต้ Header
        const headerOffset = 180; 
        const elementPosition = element.getBoundingClientRect().top;
        const offsetPosition = elementPosition + window.pageYOffset - headerOffset;
      
        window.scrollTo({
            top: offsetPosition,
            behavior: "smooth"
        });
    }
  };

  // Group & Sort
  const groupedQueues = queues.sort((a, b) => {
     if (a.date !== b.date) return a.date - b.date;
     return a.timeDisplay.localeCompare(b.timeDisplay);
  }).reduce((acc, queue) => {
    if (!acc[queue.date]) acc[queue.date] = [];
    acc[queue.date].push(queue);
    return acc;
  }, {} as Record<number, QueueItem[]>);

  const availableDates = Object.keys(groupedQueues).map(Number);
  const todayDate = new Date().getDate();
  const cashCollected = queues.filter(q => q.date === todayDate && q.status === 'completed').reduce((sum, q) => sum + (q.totalPrice - q.deposit), 0);

  return (
    <div className="min-h-screen bg-gray-50 max-w-md mx-auto font-sans relative pb-40">
      
      {/* 1. Main Header (Sticky Layer 1) */}
      <div className="bg-white px-5 pt-5 pb-2 sticky top-0 z-30 border-b border-gray-100">
         <div className="text-gray-500 text-xs mb-1">รายได้หน้าร้านวันนี้</div>
         <div className="text-3xl font-bold text-pink-600">฿{cashCollected.toLocaleString()}</div>
      </div>

      {/* 2. Quick Date Jump Bar (Sticky Layer 2) */}
      <div className="sticky top-[85px] z-20 bg-gray-50/95 backdrop-blur-sm py-2 px-2 shadow-sm overflow-x-auto whitespace-nowrap scrollbar-hide">
         <div className="flex gap-2">
            {availableDates.map(d => (
                <button 
                    key={d} 
                    onClick={() => scrollToDate(d)}
                    className={`px-4 py-1.5 rounded-full text-sm font-bold transition-all shadow-sm border
                        ${d === todayDate 
                            ? 'bg-pink-600 text-white border-pink-600' 
                            : 'bg-white text-gray-600 border-gray-200 hover:bg-pink-50'
                        }`}
                >
                    {d === todayDate ? 'วันนี้' : `${d} ธ.ค.`}
                </button>
            ))}
            {availableDates.length === 0 && <span className="text-xs text-gray-400 pl-2">ยังไม่มีคิว... เริ่มจดเลย!</span>}
         </div>
      </div>

      {/* Loop แสดงผลตามวันที่ */}
      <div className="pt-2">
        {availableDates.map((dateNum) => {
            const isToday = dateNum === todayDate;
            return (
            <div key={dateNum} id={`date-section-${dateNum}`} className="mb-8 px-4 scroll-mt-24">
                
                {/* หัวข้อวันที่ (Static ในเนื้อหา) */}
                <div className="flex items-center gap-2 mb-3">
                    <CalendarDays size={18} className={isToday ? "text-pink-600" : "text-gray-400"}/>
                    <span className={`text-lg font-bold ${isToday ? 'text-pink-600' : 'text-gray-700'}`}>
                        {dateNum} ธันวาคม
                    </span>
                </div>

                <div className="space-y-3">
                {groupedQueues[dateNum].map((q) => (
                    <div key={q.id} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                    {/* Main Content */}
                    <div 
                        onClick={() => toggleExpand(q.id)}
                        className={`p-3 flex justify-between items-start cursor-pointer transition-colors ${q.status === 'completed' ? 'opacity-60 bg-gray-50' : 'hover:bg-pink-50/30'}`}
                    >
                        <div className="flex gap-3">
                            <div className="flex flex-col items-center min-w-[50px]">
                                <span className="font-bold text-gray-800 text-sm">{q.timeDisplay.split('-')[0]}</span>
                                <span className="text-[10px] text-gray-400">{q.timeDisplay.split('-')[1]}</span>
                            </div>
                            <div>
                                <div className={`font-medium text-sm ${q.status === 'completed' && 'line-through'}`}>{q.description}</div>
                                <div className="flex items-center gap-2 mt-1">
                                    <div className="text-xs bg-gray-100 px-1.5 py-0.5 rounded text-gray-600">
                                    เหลือ: <span className="font-bold text-pink-600">฿{q.totalPrice - q.deposit}</span>
                                    </div>
                                    {q.deposit > 0 && (
                                    <div className="text-[10px] text-green-600 flex items-center">
                                        <Coins size={10} className="mr-0.5"/> มัดจำ {q.deposit}
                                    </div>
                                    )}
                                </div>
                            </div>
                        </div>
                        <div className="flex flex-col items-center">
                            {q.status === 'completed' ? <CheckCircle size={20} className="text-green-500" /> : <div className={`w-5 h-5 rounded-full border-2 ${q.isExpanded ? 'border-pink-400 bg-pink-400' : 'border-gray-200'}`}></div>}
                        </div>
                    </div>

                    {/* Actions Panel */}
                    {q.isExpanded && (
                        <div className="bg-pink-50 p-2 flex justify-end gap-2 animate-in slide-in-from-top-2">
                            <button onClick={(e) => {e.stopPropagation(); handleEdit(q);}} className="bg-white text-yellow-500 border border-yellow-200 px-3 py-2 rounded-lg shadow-sm text-xs font-bold flex items-center gap-1">
                                <Edit2 size={14}/> แก้ไข
                            </button>
                            <button onClick={(e) => {e.stopPropagation(); handleDelete(q.id)}} className="bg-white text-red-500 border border-red-200 px-3 py-2 rounded-lg shadow-sm text-xs font-bold flex items-center gap-1">
                                <Trash2 size={14}/> ลบ
                            </button>
                            <button onClick={(e) => {e.stopPropagation(); toggleStatus(q.id); toggleExpand(q.id);}} className="bg-pink-600 text-white px-4 py-2 rounded-lg shadow-sm text-xs font-bold flex items-center gap-1">
                                {q.status === 'completed' ? 'ยกเลิก' : 'รับเงิน'}
                            </button>
                        </div>
                    )}
                    </div>
                ))}
                </div>
            </div>
            );
        })}
      </div>

      {/* Input Zone */}
      <div className="fixed bottom-0 left-0 right-0 bg-white p-3 border-t shadow-[0_-5px_20px_rgba(0,0,0,0.05)] max-w-md mx-auto z-40">
         <form onSubmit={handleSubmit}>
            <div className="text-[10px] text-gray-400 mb-1 ml-1">
               พิมพ์: <b>วันที่ เวลา รายการ ราคา/มัดจำ</b> (ไม่ต้องใส่วันก็ได้)
            </div>
            <div className="flex gap-2">
                <input
                    type="text"
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    placeholder="เช่น 12 10.00-12.00 ตัดหนัง 200"
                    className="flex-1 bg-gray-100 text-base px-4 py-3 rounded-xl outline-none focus:ring-2 focus:ring-pink-400 w-full"
                />
                <button type="submit" className="bg-pink-600 text-white px-4 rounded-xl shadow-md active:scale-95 transition-transform">
                    <Save size={20}/>
                </button>
            </div>
         </form>
      </div>
    </div>
  );
}