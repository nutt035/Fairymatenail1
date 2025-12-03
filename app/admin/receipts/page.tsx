"use client";
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { FileText, Printer, Sparkles, Loader2 } from 'lucide-react';
import { formatCurrency, cn } from '@/lib/utils';
import { format } from 'date-fns';

// Type Definition ตาม Database Schema ล่าสุด
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

  // Fetch Data from Supabase
  useEffect(() => {
    const fetchReceipts = async () => {
      try {
        const { data, error } = await supabase
          .from('receipts')
          .select('*')
          .order('created_at', { ascending: false }); // เรียงจากล่าสุดไปเก่าสุด

        if (error) throw error;

        if (data) {
          setReceipts(data);
          // เลือกรายการแรกเป็น Default ถ้ามีข้อมูล
          if (data.length > 0) {
            setSelectedId(data[0].id);
          }
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

  // Loading State
  if (loading) {
    return (
      <div className="h-[calc(100vh-8rem)] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex flex-col lg:flex-row gap-6 h-auto lg:h-[calc(100vh-8rem)]">
      {/* List Column */}
      <div className="w-full lg:w-1/3 bg-white rounded-[20px] shadow-soft flex flex-col overflow-hidden min-h-[300px] lg:min-h-0">
        <div className="p-6 border-b border-slate-50">
            <h2 className="text-xl font-bold text-slate-800">Receipts History</h2>
            <p className="text-sm text-slate-400">All Transactions ({receipts.length})</p>
        </div>
        
        <div className="overflow-y-auto flex-1 max-h-[400px] lg:max-h-none custom-scroll">
            {receipts.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-40 text-slate-400">
                    <FileText size={32} className="mb-2 opacity-20" />
                    <p>No receipts found</p>
                </div>
            ) : (
                receipts.map((receipt) => (
                    <div 
                        key={receipt.id}
                        onClick={() => setSelectedId(receipt.id)}
                        className={cn(
                            "p-4 border-b border-slate-50 cursor-pointer flex items-center justify-between hover:bg-pink-50/30 transition-colors",
                            selectedId === receipt.id ? "bg-pink-50/50" : ""
                        )}
                    >
                        <div className="flex items-center gap-3 md:gap-4">
                            <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 shrink-0">
                                <FileText size={18} />
                            </div>
                            <div className="min-w-0">
                                <p className="font-bold text-slate-800 text-sm truncate">{receipt.customer_name}</p>
                                <p className="text-[10px] text-slate-400 truncate">
                                    {receipt.invoice_no} • {format(new Date(receipt.created_at), 'dd MMM yyyy')}
                                </p>
                            </div>
                        </div>
                        <span className="font-bold text-primary text-sm whitespace-nowrap">
                            {formatCurrency(receipt.final_price)}
                        </span>
                    </div>
                ))
            )}
        </div>
      </div>

      {/* Detail Column */}
      <div className="w-full lg:flex-1 bg-white rounded-[20px] shadow-soft flex flex-col relative overflow-hidden min-h-[500px]">
        {selectedReceipt ? (
            <>
                <div className="h-2 w-full bg-primary" />
                <div className="p-6 md:p-10 flex-1 flex flex-col">
                    {/* Invoice Header */}
                    <div className="flex flex-col md:flex-row justify-between items-start mb-8 md:mb-12 gap-4">
                        <div>
                            <div className="flex items-center gap-2 text-primary mb-1">
                                <Sparkles size={18} className="fill-current" />
                                <h1 className="text-2xl font-bold tracking-tight">Fairymate</h1>
                            </div>
                            <p className="text-xs text-slate-400 tracking-[0.2em] uppercase pl-7">Nail Studio</p>
                        </div>
                        <div className="text-left md:text-right">
                            <h2 className="text-2xl md:text-3xl font-bold text-slate-800 tracking-tight">INVOICE</h2>
                            <p className="text-slate-400 text-sm mt-1">{selectedReceipt.invoice_no}</p>
                        </div>
                    </div>

                    {/* Customer Info */}
                    <div className="flex flex-row justify-between mb-8 md:mb-12 border-b border-dashed border-slate-200 pb-8">
                        <div>
                            <p className="text-xs text-slate-400 uppercase mb-1">Customer</p>
                            <p className="font-bold text-lg text-slate-800">{selectedReceipt.customer_name}</p>
                        </div>
                        <div className="text-right">
                            <p className="text-xs text-slate-400 uppercase mb-1">Date</p>
                            <p className="font-medium text-slate-800">
                                {format(new Date(selectedReceipt.created_at), 'dd MMM yyyy, HH:mm')}
                            </p>
                        </div>
                    </div>

                    {/* Items List */}
                    <div className="space-y-4 mb-auto">
                        {/* Service Item */}
                        <div className="flex justify-between items-center text-sm">
                            <span className="font-medium text-slate-700">{selectedReceipt.service_name}</span>
                            <span className="font-bold text-slate-800">{formatCurrency(selectedReceipt.original_price)}</span>
                        </div>

                        {/* Discount Item (Show only if discount > 0) */}
                        {selectedReceipt.discount > 0 && (
                            <div className="flex justify-between items-center text-sm text-green-600">
                                <span className="font-medium">Discount</span>
                                <span className="font-bold">- {formatCurrency(selectedReceipt.discount)}</span>
                            </div>
                        )}
                    </div>

                    {/* Total Section */}
                    <div className="border-t border-slate-100 pt-6 mt-6">
                        <div className="flex justify-between items-center mb-8">
                            <span className="text-xl font-bold text-slate-800">Total</span>
                            <span className="text-2xl font-bold text-primary">
                                {formatCurrency(selectedReceipt.final_price)}
                            </span>
                        </div>

                        <div className="flex justify-center">
                            <button 
                                onClick={() => window.print()} // Simple print trigger
                                className="w-full md:w-auto bg-[#1e293b] text-white px-8 py-3 rounded-xl font-medium flex items-center justify-center gap-3 hover:bg-slate-800 transition-colors shadow-lg shadow-slate-200"
                            >
                                <Printer size={18} /> Reprint Invoice
                            </button>
                        </div>
                    </div>
                </div>
            </>
        ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-300">
                <FileText size={48} className="mb-4 opacity-20" />
                <p>Select a receipt to view details</p>
            </div>
        )}
      </div>
    </div>
  );
}