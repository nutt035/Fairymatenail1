"use client";
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { FileText, Printer, Loader2 } from 'lucide-react';
import { formatCurrency, cn } from '@/lib/utils';
import { format } from 'date-fns';
import Image from 'next/image'; // Import Image

// Type Definition
interface Receipt {
  id: string;
  invoice_no: string;
  customer_name: string;
  service_name: string;
  original_price: number;
  discount: number;
  final_price: number;
  created_at: string;
}

export default function ReceiptsPage() {
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Fetch Data ... (เหมือนเดิม)
  useEffect(() => {
    const fetchReceipts = async () => {
      try {
        const { data, error } = await supabase
          .from('receipts')
          .select('*')
          .order('created_at', { ascending: false });

        if (error) throw error;

        if (data) {
          setReceipts(data);
          if (data.length > 0) setSelectedId(data[0].id);
        }
      } catch (error) {
        console.error('Error fetching receipts:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchReceipts();
  }, []);

  const selectedReceipt = receipts.find(r => r.id === selectedId);

  if (loading) return <div className="h-[calc(100vh-8rem)] flex items-center justify-center"><Loader2 className="animate-spin text-primary" /></div>;

  return (
    <div className="flex flex-col lg:flex-row gap-6 h-auto lg:h-[calc(100vh-8rem)]">
      
      {/* CSS สำหรับการพิมพ์: ซ่อน Sidebar และปุ่มต่างๆ ให้เหลือแค่ใบเสร็จ */}
      <style jsx global>{`
        @media print {
            body * {
                visibility: hidden;
            }
            /* ให้แสดงเฉพาะส่วนที่เป็นใบเสร็จ */
            #printable-receipt, #printable-receipt * {
                visibility: visible;
            }
            /* จัดตำแหน่งให้เต็มหน้ากระดาษ */
            #printable-receipt {
                position: absolute;
                left: 0;
                top: 0;
                width: 100%;
                margin: 0;
                padding: 20px;
                background: white;
                box-shadow: none;
                border: none;
            }
            /* ซ่อน Scrollbar และปุ่มต่างๆ */
            aside, header, button, .no-print {
                display: none !important;
            }
        }
      `}</style>

      {/* List Column (ซ้าย) - ใส่ class no-print เพื่อซ่อนเวลาพิมพ์ */}
      <div className="w-full lg:w-1/3 bg-white rounded-[20px] shadow-soft flex flex-col overflow-hidden min-h-[300px] lg:min-h-0 no-print">
        <div className="p-6 border-b border-slate-50">
            <h2 className="text-xl font-bold text-slate-800">ประวัติใบเสร็จ</h2>
            <p className="text-sm text-slate-400">รายการทั้งหมด ({receipts.length})</p>
        </div>
        <div className="overflow-y-auto flex-1 max-h-[400px] lg:max-h-none custom-scroll">
            {receipts.map((receipt) => (
                <div 
                    key={receipt.id}
                    onClick={() => setSelectedId(receipt.id)}
                    className={cn(
                        "p-4 border-b border-slate-50 cursor-pointer flex items-center justify-between hover:bg-pink-50/30 transition-colors",
                        selectedId === receipt.id ? "bg-pink-50/50" : ""
                    )}
                >
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 shrink-0">
                            <FileText size={18} />
                        </div>
                        <div className="min-w-0">
                            <p className="font-bold text-slate-800 text-sm truncate">{receipt.customer_name}</p>
                            <p className="text-[10px] text-slate-400 truncate">
                                {receipt.invoice_no}
                            </p>
                        </div>
                    </div>
                    <span className="font-bold text-primary text-sm whitespace-nowrap">
                        {formatCurrency(receipt.final_price)}
                    </span>
                </div>
            ))}
        </div>
      </div>

      {/* Detail Column (ขวา) - นี่คือส่วนที่จะถูกพิมพ์ */}
      <div className="w-full lg:flex-1 bg-white rounded-[20px] shadow-soft flex flex-col relative overflow-hidden min-h-[500px]">
        {selectedReceipt ? (
            <>
                {/* ID สำหรับอ้างอิงตอน Print */}
                <div id="printable-receipt" className="flex-1 flex flex-col bg-white">
                    <div className="h-2 w-full bg-primary mb-6 print:mb-4" /> {/* แถบสี */}
                    
                    <div className="p-6 md:p-10 flex-1 flex flex-col">
                        {/* Header */}
                        <div className="flex flex-row justify-between items-start mb-8 gap-4">
                            <div>
                                <div className="flex items-center gap-3 mb-2">
                                    {/* เปลี่ยน Sparkles เป็น Logo Image */}
                                    <div className="relative w-12 h-12 rounded-full overflow-hidden border border-slate-100">
                                        <Image src="/logo.jpg" alt="Logo" fill className="object-cover" />
                                    </div>
                                    <h1 className="text-2xl font-bold tracking-tight text-primary">Fairymate</h1>
                                </div>
                                <p className="text-sm text-slate-400 pl-1">Nail Studio</p>
                            </div>
                            <div className="text-right">
                                <h2 className="text-2xl font-bold text-slate-800 tracking-tight">ใบเสร็จรับเงิน</h2>
                                <p className="text-slate-400 text-sm mt-1"># {selectedReceipt.invoice_no}</p>
                            </div>
                        </div>

                        {/* Customer Info */}
                        <div className="flex flex-row justify-between mb-8 border-b border-dashed border-slate-200 pb-8">
                            <div>
                                <p className="text-xs text-slate-400 uppercase mb-1">ลูกค้า</p>
                                <p className="font-bold text-lg text-slate-800">{selectedReceipt.customer_name}</p>
                            </div>
                            <div className="text-right">
                                <p className="text-xs text-slate-400 uppercase mb-1">วันที่</p>
                                <p className="font-medium text-slate-800">
                                    {format(new Date(selectedReceipt.created_at), 'dd/MM/yyyy HH:mm')}
                                </p>
                            </div>
                        </div>

                        {/* Items */}
                        <div className="space-y-4 mb-auto">
                            <div className="flex justify-between items-center text-sm">
                                <span className="font-medium text-slate-700">{selectedReceipt.service_name}</span>
                                <span className="font-bold text-slate-800">{formatCurrency(selectedReceipt.original_price)}</span>
                            </div>

                            {selectedReceipt.discount > 0 && (
                                <div className="flex justify-between items-center text-sm text-green-600">
                                    <span className="font-medium">ส่วนลด</span>
                                    <span className="font-bold">- {formatCurrency(selectedReceipt.discount)}</span>
                                </div>
                            )}
                        </div>

                        {/* Total */}
                        <div className="border-t border-slate-100 pt-6 mt-12">
                            <div className="flex justify-between items-center mb-8">
                                <span className="text-xl font-bold text-slate-800">ยอดรวมทั้งสิ้น</span>
                                <span className="text-3xl font-bold text-primary">
                                    {formatCurrency(selectedReceipt.final_price)}
                                </span>
                            </div>
                        </div>
                        
                        {/* Footer ในใบเสร็จ */}
                        <div className="text-center mt-8 text-xs text-slate-300">
                            ขอบคุณที่ใช้บริการ Fairymate Nail Studio
                        </div>
                    </div>
                </div>

                {/* ปุ่ม Print (ซ่อนตอนพิมพ์) */}
                <div className="p-6 border-t border-slate-50 flex justify-center bg-slate-50 no-print">
                    <button 
                        onClick={() => window.print()}
                        className="bg-[#1e293b] text-white px-8 py-3 rounded-xl font-medium flex items-center gap-3 hover:bg-slate-800 transition-colors shadow-lg"
                    >
                        <Printer size={18} /> พิมพ์ใบเสร็จ
                    </button>
                </div>
            </>
        ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-300">
                <FileText size={48} className="mb-4 opacity-20" />
                <p>เลือกรายการเพื่อดูใบเสร็จ</p>
            </div>
        )}
      </div>
    </div>
  );
}