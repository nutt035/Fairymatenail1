"use client";
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import StatusBadge from '@/components/ui/StatusBadge';
import { Clock, Receipt, Edit2, Check, X, Loader2 } from 'lucide-react';
import { formatCurrency, cn } from '@/lib/utils';

export default function Dashboard() {
  // Queue + Income States
  const [queues, setQueues] = useState<any[]>([]);
  const [todayIncome, setTodayIncome] = useState(0);
  const [monthlyIncome, setMonthlyIncome] = useState(0);
  const [goalAmount, setGoalAmount] = useState(150000);
  const [goalId, setGoalId] = useState<string | null>(null);

  // UI States
  const [loading, setLoading] = useState(true);
  const [isEditingGoal, setIsEditingGoal] = useState(false);
  const [tempGoal, setTempGoal] = useState("");

  // Store Hours States
  const [storeHours, setStoreHours] = useState<any[]>([]);
  const [loadingStoreHours, setLoadingStoreHours] = useState(true);

  const weekdayNames = ["อาทิตย์", "จันทร์", "อังคาร", "พุธ", "พฤหัส", "ศุกร์", "เสาร์"];

  useEffect(() => {
    fetchDashboardData();
    fetchStoreHours();
  }, []);

  // -----------------------------
  // Fetch Dashboard Data
  // -----------------------------
  const fetchDashboardData = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const startMonth = startOfMonth(new Date()).toISOString();
      const endMonth = endOfMonth(new Date()).toISOString();

      // 1. Today's Queues
      const { data: queueData } = await supabase
        .from('queues')
        .select('*')
        .eq('date', today)
        .order('start_time');

      if (queueData) setQueues(queueData);

      // 2. Today's Income
      const { data: todayReceipts } = await supabase
        .from('receipts')
        .select('final_price')
        .gte('created_at', `${today}T00:00:00`)
        .lte('created_at', `${today}T23:59:59`);
      
      const todayTotal = todayReceipts?.reduce((sum, r) => sum + r.final_price, 0) || 0;
      setTodayIncome(todayTotal);

      // 3. Monthly Income
      const { data: monthReceipts } = await supabase
        .from('receipts')
        .select('final_price')
        .gte('created_at', startMonth)
        .lte('created_at', endMonth);

      const monthTotal = monthReceipts?.reduce((sum, r) => sum + r.final_price, 0) || 0;
      setMonthlyIncome(monthTotal);

      // 4. Goal
      const { data: goalData } = await supabase
        .from('goals')
        .select('*')
        .limit(1)
        .single();
      
      if (goalData) {
        setGoalAmount(goalData.amount);
        setGoalId(goalData.id);
      }

    } catch (error) {
      console.error("Error fetching dashboard data:", error);
    } finally {
      setLoading(false);
    }
  };

  // -----------------------------
  // Fetch Store Hours
  // -----------------------------
  const fetchStoreHours = async () => {
    try {
      const { data } = await supabase
        .from("store_hours")
        .select("*")
        .order("weekday");

      if (data) setStoreHours(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingStoreHours(false);
    }
  };

  // -----------------------------
  // Store Hours Handlers
  // -----------------------------
  const updateLocalTime = (weekday: number, field: string, value: string) => {
    setStoreHours((prev) =>
      prev.map((d) =>
        d.weekday === weekday ? { ...d, [field]: value } : d
      )
    );
  };

  const toggleClosed = (weekday: number) => {
    setStoreHours((prev) =>
      prev.map((d) =>
        d.weekday === weekday
          ? { ...d, is_closed: !d.is_closed }
          : d
      )
    );
  };

  const saveStoreHours = async () => {
    try {
      for (const day of storeHours) {
        await supabase
          .from("store_hours")
          .update({
            open_time: day.open_time,
            close_time: day.close_time,
            is_closed: day.is_closed,
          })
          .eq("weekday", day.weekday);
      }
      alert("บันทึกเวลาเปิดร้านเรียบร้อยแล้ว!");
    } catch (err) {
      console.error(err);
      alert("เกิดข้อผิดพลาด");
    }
  };

  // -----------------------------
  // Save Goal
  // -----------------------------
  const handleSaveGoal = async () => {
    const newAmount = parseInt(tempGoal);
    if (isNaN(newAmount) || newAmount <= 0) return;

    try {
      if (goalId) {
        await supabase.from('goals').update({ amount: newAmount }).eq('id', goalId);
      } else {
        await supabase.from('goals').insert([{ amount: newAmount }]);
      }
      setGoalAmount(newAmount);
      setIsEditingGoal(false);
    } catch (error) {
      console.error("Error updating goal:", error);
      alert("เกิดข้อผิดพลาดในการบันทึกเป้าหมาย");
    }
  };

  const startEditing = () => {
    setTempGoal(goalAmount.toString());
    setIsEditingGoal(true);
  };

  // Progress
  const progressPercent = Math.min(100, Math.round((monthlyIncome / goalAmount) * 100));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 md:gap-8">

      {/* LEFT COLUMN — QUEUE LIST */}
      <div className="col-span-1 lg:col-span-7 space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <h1 className="text-2xl md:text-3xl font-bold text-slate-800">แดชบอร์ด</h1>
            <span className="bg-white border border-pink-100 text-primary px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap">
                {format(new Date(), 'd MMMM yyyy')}
            </span>
        </div>

        <div className="bg-white rounded-[20px] p-4 md:p-6 shadow-soft min-h-[400px] md:min-h-[500px]">
            <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                        <Clock size={16} className="text-primary" />
                    </div>
                    <h2 className="font-bold text-base md:text-lg">คิววันนี้ ({queues.length})</h2>
                </div>
                <Link 
                    href="/admin/queues" 
                    className="text-sm text-primary font-medium hover:underline hover:text-primary/80"
                >
                    ดูทั้งหมด
                </Link>
            </div>

            <div className="space-y-4">
                {loading ? (
                   <div className="flex justify-center py-10"><Loader2 className="animate-spin text-primary" /></div>
                ) : queues.map((q, idx) => {
                    const isNow = idx === 0 && q.status !== 'finished';
                    return (
                        <div key={q.id} className="flex items-center gap-3 md:gap-4 p-2 hover:bg-slate-50 rounded-xl transition-colors">
                            <div className={`flex flex-col items-center justify-center w-14 h-14 md:w-16 md:h-16 rounded-xl border shrink-0 ${isNow ? 'bg-primary border-primary text-white shadow-md shadow-primary/20' : 'bg-white border-slate-100 text-slate-500'}`}>
                                {isNow && <span className="text-[9px] md:text-[10px] font-bold mb-0.5">NOW</span>}
                                <span className={`font-bold ${isNow ? 'text-base md:text-lg' : 'text-xs md:text-sm'}`}>{q.start_time.slice(0,5)}</span>
                            </div>
                            <div className="flex-1 min-w-0">
                                <h3 className="font-bold text-slate-800 truncate">{q.customer_name}</h3>
                                <p className="text-sm text-slate-400 truncate">{q.service_name}</p>
                            </div>
                            <div className="shrink-0">
                                <StatusBadge status={q.status} />
                            </div>
                        </div>
                    )
                })}
                {!loading && queues.length === 0 && <p className="text-center text-slate-400 mt-10">ไม่มีคิวสำหรับวันนี้</p>}
            </div>
        </div>
      </div>

      {/* RIGHT COLUMN — STATS + STORE HOURS */}
      <div className="col-span-1 lg:col-span-5 space-y-6 pt-0 lg:pt-16">

         {/* Today Income */}
         <div className="bg-white rounded-[20px] p-6 shadow-soft">
            <div className="flex items-center gap-4 mb-4">
                <div className="p-3 bg-pink-50 rounded-2xl text-primary">
                    <Receipt size={24} />
                </div>
                <div>
                    <p className="text-xs text-slate-400 font-bold tracking-wider uppercase">รายได้วันนี้</p>
                    <p className="text-3xl font-bold text-slate-800">
                        {loading ? "..." : formatCurrency(todayIncome)}
                    </p>
                </div>
            </div>
         </div>

         {/* Monthly Goal */}
         <div className="bg-primary text-white rounded-[20px] p-8 shadow-lg shadow-primary/30 relative overflow-hidden">
             <div className="relative z-10">
                <div className="flex justify-between items-start">
                    <p className="text-white/80 text-xs font-bold tracking-wider uppercase mb-2">เป้าหมายเดือนนี้</p>
                    
                    {!isEditingGoal ? (
                        <button onClick={startEditing} className="p-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-white/80 hover:text-white">
                            <Edit2 size={14} />
                        </button>
                    ) : (
                        <div className="flex gap-2">
                             <button onClick={handleSaveGoal} className="p-1.5 bg-white text-primary rounded-lg hover:bg-white/90">
                                <Check size={14} />
                            </button>
                            <button onClick={() => setIsEditingGoal(false)} className="p-1.5 bg-white/10 text-white rounded-lg hover:bg-white/20">
                                <X size={14} />
                            </button>
                        </div>
                    )}
                </div>

                <div className="flex flex-wrap items-end gap-2 mb-4 min-h-[40px]">
                    <span className="text-3xl md:text-4xl font-bold">
                        {loading ? "..." : formatCurrency(monthlyIncome)}
                    </span>

                    <span className="text-white/60 mb-1 text-sm md:text-base flex items-center gap-1">
                        /
                        {isEditingGoal ? (
                             <input 
                                type="number" 
                                value={tempGoal}
                                onChange={(e) => setTempGoal(e.target.value)}
                                className="w-24 bg-white/20 border-b border-white text-white px-1 py-0.5 font-bold"
                             />
                        ) : (
                            <span>{loading ? "..." : (goalAmount / 1000).toFixed(0) + 'k'}</span>
                        )}
                    </span>
                </div>

                <div className="h-2 bg-black/20 rounded-full overflow-hidden mb-4">
                    <div 
                        className="h-full bg-white rounded-full transition-all duration-700" 
                        style={{ width: `${progressPercent}%` }}
                    ></div>
                </div>
             </div>
             
             <div className="absolute right-6 top-1/2 -translate-y-1/2 text-7xl md:text-8xl font-bold text-white/10 select-none">
                 {progressPercent}%
             </div>
         </div>

         {/* STORE HOURS CARD */}
         <div className="bg-white rounded-[20px] p-6 shadow-soft">
            <h2 className="font-bold text-lg mb-4">ตั้งเวลาเปิด–ปิดร้าน</h2>

            {loadingStoreHours ? (
                <div className="flex justify-center py-6">
                    <Loader2 className="animate-spin text-primary" />
                </div>
            ) : (
                <div className="space-y-4">
                    {storeHours.map((day) => (
                        <div key={day.weekday} className="flex items-center gap-3">
                            <span className="w-20 text-slate-600 font-medium">
                                {weekdayNames[day.weekday]}
                            </span>

                            {day.is_closed ? (
                                <span className="text-slate-400 italic">ปิดร้านทั้งวัน</span>
                            ) : (
                                <div className="flex items-center gap-2">
                                    <input
                                        type="time"
                                        value={day.open_time || ""}
                                        onChange={(e) =>
                                            updateLocalTime(day.weekday, "open_time", e.target.value)
                                        }
                                        className="border rounded-lg px-2 py-1 text-sm"
                                    />
                                    <span className="text-slate-400">–</span>
                                    <input
                                        type="time"
                                        value={day.close_time || ""}
                                        onChange={(e) =>
                                            updateLocalTime(day.weekday, "close_time", e.target.value)
                                        }
                                        className="border rounded-lg px-2 py-1 text-sm"
                                    />
                                </div>
                            )}

                            <button
                                onClick={() => toggleClosed(day.weekday)}
                                className={cn(
                                    "px-3 py-1 rounded-lg text-sm",
                                    day.is_closed
                                        ? "bg-primary text-white"
                                        : "bg-slate-100 text-slate-600"
                                )}
                            >
                                {day.is_closed ? "เปิดร้าน" : "ปิดร้าน"}
                            </button>
                        </div>
                    ))}
                </div>
            )}

            <button
                onClick={saveStoreHours}
                className="mt-6 w-full bg-primary text-white py-2 rounded-lg font-bold shadow hover:bg-primary/90"
            >
                บันทึกเวลาเปิด–ปิดร้าน
            </button>
         </div>

      </div>
    </div>
  );
}
