"use client";
import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { 
  FileText, 
  Send, 
  Loader2, 
  Plus, 
  CheckCircle, 
  AlertCircle, 
  Image as ImageIcon,
  Receipt as ReceiptIcon
} from 'lucide-react';
import { formatCurrency, cn } from '@/lib/utils';
import { format } from 'date-fns';
import { th } from 'date-fns/locale';
import Image from 'next/image';
import html2canvas from 'html2canvas';

// --- Types ---
interface Queue {
  id: string;
  customer_name: string;
  service_name: string;
  date: string;
  price: number;
  status: string;
}

interface Receipt {
  id: string;
  queue_id: string;
  invoice_no: string;
  customer_name: string;
  service_name: string;
  original_price: number;
  discount: number;
  final_price: number;
  created_at: string;
}

export default function ReceiptsPage() {
  // Data States
  const [finishedQueues, setFinishedQueues] = useState<Queue[]>([]);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [sendingLine, setSendingLine] = useState(false); // สถานะกำลังส่งรูป
  
  // UI Selection States
  const [selectedQueueId, setSelectedQueueId] = useState<string | null>(null);
  const [activeReceipt, setActiveReceipt] = useState<Receipt | null>(null);

  // Modal States
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [discount, setDiscount] = useState('');

  // Ref สำหรับจับภาพใบเสร็จ
  const receiptRef = useRef<HTMLDivElement>(null);

  // --- 1. Fetch Data: ดึงงานที่เสร็จแล้ว + ใบเสร็จ ---
  const fetchData = async () => {
    try {
      // 1. ดึงคิวที่จบงานแล้ว (เรียงใหม่สุดไปเก่าสุด)
      const { data: queuesData } = await supabase
        .from('queues')
        .select('*')
        .eq('status', 'finished')
        .order('date', { ascending: false })
        .order('start_time', { ascending: false });

      // 2. ดึงใบเสร็จทั้งหมด
      const { data: receiptsData } = await supabase
        .from('receipts')
        .select('*');

      if (queuesData) setFinishedQueues(queuesData);
      if (receiptsData) setReceipts(receiptsData);

      // Auto-select รายการแรกถ้ายังไม่ได้เลือกอะไร
      if (queuesData && queuesData.length > 0 && !selectedQueueId) {
        setSelectedQueueId(queuesData[0].id);
      }

    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // หาใบเสร็จของคิวที่เลือก (ถ้ามี)
  useEffect(() => {
    if (selectedQueueId) {
      const foundReceipt = receipts.find(r => r.queue_id === selectedQueueId);
      setActiveReceipt(foundReceipt || null);
    }
  }, [selectedQueueId, receipts]);


  // --- 2. ฟังก์ชันส่งเข้า LINE (ผ่าน Messaging API) ---
  const handleSendLine = async () => {
    if (!receiptRef.current || !activeReceipt) return;
    setSendingLine(true);

    try {
      // A. แปลง HTML เป็นรูปภาพ (Blob)
      const canvas = await html2canvas(receiptRef.current, { 
        scale: 2, // เพิ่มความชัด 2 เท่า
        backgroundColor: '#ffffff', // พื้นหลังสีขาว
        useCORS: true // อนุญาตให้โหลดรูปข้ามโดเมน (ถ้ามี)
      });
      
      const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.9));
      if (!blob) throw new Error("ไม่สามารถสร้างรูปภาพได้");

      // B. อัปโหลดรูปขึ้น Supabase Storage
      const fileName = `receipt-${activeReceipt.invoice_no}-${Date.now()}.jpg`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('receipts') // ⚠️ ต้องสร้าง Bucket ชื่อ 'receipts' ใน Supabase ก่อนนะครับ
        .upload(fileName, blob, {
          contentType: 'image/jpeg',
          upsert: true
        });

      if (uploadError) throw uploadError;

      // C. ขอ Public URL ของรูป
      const { data: { publicUrl } } = supabase.storage
        .from('receipts')
        .getPublicUrl(fileName);

      // D. ยิงเข้า API หลังบ้านของเรา (เพื่อส่งต่อไป LINE)
      const res = await fetch('/api/line', { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageUrl: publicUrl,
          message: `🧾 บิลคุณ ${activeReceipt.customer_name}\nยอดชำระ: ${formatCurrency(activeReceipt.final_price)}`
        })
      });
      
      if (res.ok) {
        alert('ส่งรูปใบเสร็จเข้า LINE เรียบร้อย! ✅');
      } else {
        const err = await res.json();
        alert('ส่งไม่ผ่าน: ' + (err.error || 'Unknown error'));
      }

    } catch (err: any) {
      console.error(err);
      alert('เกิดข้อผิดพลาด: ' + (err.message || 'Unknown error'));
    } finally {
      setSendingLine(false);
    }
  };

  // --- 3. สร้างใบเสร็จใหม่ ---
  const handleCreateReceipt = async () => {
    if (!selectedQueueId) return;
    const queue = finishedQueues.find(q => q.id === selectedQueueId);
    if (!queue) return;

    const discountVal = parseInt(discount) || 0;
    const finalPrice = Math.max(0, queue.price - discountVal);
    
    // Gen เลข Invoice (INV-YYMMDD-XXXX) หรือแบบสั้นๆ
    const invNo = `INV-${Date.now().toString().slice(-6)}`;

    const newReceipt = {
      queue_id: queue.id,
      customer_name: queue.customer_name,
      service_name: queue.service_name,
      original_price: queue.price,
      discount: discountVal,
      final_price: finalPrice,
      invoice_no: invNo
    };

    const { error } = await supabase.from('receipts').insert([newReceipt]);

    if (!error) {
      await fetchData(); // โหลดข้อมูลใหม่
      setIsCreateModalOpen(false);
      setDiscount('');
    } else {
      alert('สร้างใบเสร็จไม่สำเร็จ: ' + error.message);
    }
  };

  if (loading) return <div className="h-screen flex justify-center items-center bg-[#F8F9FA]"><Loader2 className="animate-spin text-primary w-8 h-8"/></div>;

  return (
    // ⭐ ล็อกจอด้วย h-[100dvh] overflow-hidden
    <div className="flex flex-col lg:flex-row gap-4 lg:gap-6 h-[100dvh] p-4 lg:p-6 overflow-hidden bg-[#F8F9FA] w-full max-w-[100vw]">
      
      {/* --- Left Column: รายชื่อลูกค้า (List) --- */}
      <div className="w-full lg:w-1/3 bg-white rounded-3xl shadow-sm flex flex-col overflow-hidden border border-slate-100 h-1/3 lg:h-full shrink-0">
        <div className="p-4 border-b border-slate-50 bg-white z-10 flex justify-between items-center">
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <CheckCircle className="text-primary" size={20}/> ประวัติงาน
            </h2>
            <span className="text-xs text-slate-400 bg-slate-50 px-2 py-1 rounded-lg">{finishedQueues.length} รายการ</span>
        </div>
        
        <div className="overflow-y-auto flex-1 p-2 space-y-1">
            {finishedQueues.map((q) => {
                const hasReceipt = receipts.some(r => r.queue_id === q.id);
                const isSelected = selectedQueueId === q.id;

                return (
                    <div 
                        key={q.id}
                        onClick={() => setSelectedQueueId(q.id)}
                        className={cn(
                            "p-3 rounded-2xl cursor-pointer transition-all border flex justify-between items-center active:scale-[0.98]",
                            isSelected 
                                ? "bg-primary/5 border-primary/30 shadow-sm" 
                                : "bg-white border-slate-50 hover:bg-slate-50 hover:border-slate-200"
                        )}
                    >
                        <div className="min-w-0 flex-1 pr-2">
                            <div className="font-bold text-slate-800 text-sm truncate">{q.customer_name}</div>
                            <div className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-1">
                                <span>{format(new Date(q.date), 'd MMM', {locale: th})}</span>
                                <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                                <span className="truncate max-w-[100px]">{q.service_name}</span>
                            </div>
                        </div>

                        <div className="text-right shrink-0">
                            {hasReceipt ? (
                                <div className="flex flex-col items-end">
                                    <span className="text-sm font-bold text-slate-700">฿{q.price}</span>
                                    <span className="text-[9px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded-md mt-0.5 font-medium flex items-center gap-0.5">
                                        <FileText size={8}/> มีบิล
                                    </span>
                                </div>
                            ) : (
                                <div className="flex flex-col items-end">
                                    <span className="text-sm font-bold text-slate-400 line-through">฿{q.price}</span>
                                    <span className="text-[9px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded-md mt-0.5 font-medium flex items-center gap-0.5 animate-pulse">
                                        <AlertCircle size={8}/> รอออก
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>
                );
            })}
            
            {finishedQueues.length === 0 && (
                <div className="text-center py-10 text-slate-400 text-sm">ยังไม่มีงานที่เสร็จสิ้น</div>
            )}
        </div>
      </div>

      {/* --- Right Column: Detail & Receipt --- */}
      <div className="flex-1 bg-white lg:bg-slate-100/50 lg:border lg:border-slate-200 rounded-3xl flex flex-col items-center justify-center p-2 relative overflow-hidden h-2/3 lg:h-full w-full">
        
        {selectedQueueId && activeReceipt ? (
            // CASE 1: มีใบเสร็จแล้ว -> โชว์ + ปุ่มส่ง
            <div className="w-full max-w-sm flex flex-col h-full overflow-hidden">
                
                {/* Scroll Area */}
                <div className="flex-1 overflow-y-auto no-scrollbar flex flex-col items-center pt-4 pb-20 px-2">
                    
                    {/* --- AREA ใบเสร็จ (สำหรับ html2canvas) --- */}
                    <div 
                        ref={receiptRef}
                        className="bg-white p-6 md:p-8 shadow-xl w-full text-slate-800 relative mb-4"
                        style={{ minHeight: '450px', borderRadius: '0px' }} // เหลี่ยมเพื่อให้เหมือนกระดาษจริงเวลาส่งรูป
                    >
                        {/* Decorations */}
                        <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 rounded-bl-full"/>
                        
                        {/* Header */}
                        <div className="flex justify-between items-start mb-6 relative z-10">
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 rounded-full border border-slate-100 relative overflow-hidden bg-slate-50">
                                    <Image src="/logo.jpg" alt="Logo" fill className="object-cover"/>
                                </div>
                                <div>
                                    <h1 className="text-lg font-bold text-primary tracking-tight">Fairymate</h1>
                                    <p className="text-[10px] text-slate-400 uppercase tracking-wider">Nail Studio</p>
                                </div>
                            </div>
                            <div className="text-right">
                                <div className="text-[9px] text-slate-400 uppercase tracking-widest mb-0.5">Receipt No.</div>
                                <div className="text-sm font-bold text-slate-700 font-mono tracking-wide">{activeReceipt.invoice_no}</div>
                            </div>
                        </div>

                        <div className="border-t border-dashed border-slate-200 my-5 opacity-70"></div>

                        {/* Info */}
                        <div className="flex justify-between mb-6 text-sm relative z-10">
                            <div>
                                <p className="text-[10px] text-slate-400 uppercase mb-0.5">Customer</p>
                                <p className="font-bold text-slate-800">{activeReceipt.customer_name}</p>
                            </div>
                            <div className="text-right">
                                <p className="text-[10px] text-slate-400 uppercase mb-0.5">Date / Time</p>
                                <p className="font-medium text-slate-600">
                                    {format(new Date(activeReceipt.created_at), 'd MMM yy HH:mm', {locale: th})}
                                </p>
                            </div>
                        </div>

                        {/* Items */}
                        <div className="space-y-3 mb-8 relative z-10 min-h-[100px]">
                            <div className="flex justify-between items-start text-sm">
                                <span className="font-medium text-slate-600 w-2/3">{activeReceipt.service_name}</span>
                                <span className="font-bold text-slate-800">{formatCurrency(activeReceipt.original_price)}</span>
                            </div>
                            
                            {activeReceipt.discount > 0 && (
                                <div className="flex justify-between items-center text-sm text-green-600 bg-green-50 p-2 rounded-lg">
                                    <span className="text-xs">ส่วนลดพิเศษ</span>
                                    <span className="font-bold">- {formatCurrency(activeReceipt.discount)}</span>
                                </div>
                            )}
                        </div>

                        {/* Total */}
                        <div className="bg-slate-50 p-4 rounded-xl flex justify-between items-center relative z-10 border border-slate-100">
                            <span className="font-bold text-slate-600 text-sm">ยอดชำระสุทธิ</span>
                            <span className="text-2xl font-black text-primary">{formatCurrency(activeReceipt.final_price)}</span>
                        </div>

                        <div className="mt-8 text-center">
                            <p className="text-[10px] text-slate-300 uppercase tracking-widest">Thank you</p>
                            <p className="text-[9px] text-slate-300 mt-1">Fairymate Nail Studio</p>
                        </div>
                    </div>
                    {/* --- End Receipt Area --- */}

                </div>

                {/* --- Action Bar (Fixed Bottom of Right Column) --- */}
                <div className="absolute bottom-0 left-0 right-0 p-4 bg-white/90 backdrop-blur-md border-t border-slate-100 z-20">
                    <button 
                        onClick={handleSendLine}
                        disabled={sendingLine}
                        className="w-full bg-[#06C755] hover:bg-[#05b54d] text-white py-3.5 rounded-xl font-bold text-base shadow-lg shadow-green-200 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                    >
                        {sendingLine ? <Loader2 className="animate-spin" size={20}/> : <Send size={20} />}
                        {sendingLine ? 'กำลังส่งรูป...' : 'ส่งเข้าไลน์ฉันทันที'}
                    </button>
                </div>

            </div>
        ) : selectedQueueId && !activeReceipt ? (
            // CASE 2: มีงานแต่ยังไม่มีใบเสร็จ
            <div className="text-center p-6 w-full max-w-xs bg-white rounded-3xl shadow-sm border border-slate-100">
                <div className="w-16 h-16 bg-pink-50 text-primary rounded-full flex items-center justify-center mx-auto mb-4 animate-bounce">
                    <ReceiptIcon size={32} />
                </div>
                <h3 className="text-lg font-bold text-slate-700">ยังไม่ออกใบเสร็จ</h3>
                <p className="text-slate-400 text-sm mb-6">ลูกค้ารายนี้ยังไม่มีเอกสารใบเสร็จ</p>
                
                <button 
                    onClick={() => setIsCreateModalOpen(true)}
                    className="w-full bg-primary text-white py-3 rounded-xl font-bold shadow-lg shadow-primary/20 hover:scale-[1.02] transition-transform flex items-center justify-center gap-2"
                >
                    <Plus size={20} /> ออกใบเสร็จเดี๋ยวนี้
                </button>
            </div>
        ) : (
            // CASE 3: ยังไม่เลือกอะไร
            <div className="text-center text-slate-300 flex flex-col items-center">
                <ImageIcon size={48} className="mb-2 opacity-30"/>
                <p className="text-sm">แตะรายชื่อทางซ้ายเพื่อดูข้อมูล</p>
            </div>
        )}

      </div>

      {/* --- Create Modal --- */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in w-full h-full">
            <div className="bg-white w-full max-w-xs rounded-3xl p-6 shadow-2xl animate-in zoom-in-95">
                <h3 className="text-lg font-bold mb-1 text-center text-slate-800">ออกใบเสร็จรับเงิน</h3>
                <p className="text-xs text-center text-slate-400 mb-6">ระบุส่วนลดถ้ามี (ไม่บังคับ)</p>
                
                <div className="mb-6 relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">฿</span>
                    <input 
                        type="number" 
                        value={discount}
                        onChange={(e) => setDiscount(e.target.value)}
                        placeholder="0"
                        className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 pl-8 text-center font-bold text-2xl text-primary focus:ring-4 focus:ring-primary/10 outline-none transition-all"
                    />
                    <label className="absolute -top-2.5 left-3 bg-white px-1 text-[10px] font-bold text-slate-400 uppercase">ส่วนลด (Discount)</label>
                </div>

                <div className="flex gap-3">
                    <button onClick={() => setIsCreateModalOpen(false)} className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200">ยกเลิก</button>
                    <button onClick={handleCreateReceipt} className="flex-1 py-3 bg-primary text-white rounded-xl font-bold shadow-lg shadow-primary/20 hover:bg-primary/90">ยืนยัน</button>
                </div>
            </div>
        </div>
      )}

    </div>
  );
}