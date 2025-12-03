"use client";
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import StatusBadge from '@/components/ui/StatusBadge';
import { Clock, Receipt, Edit2, Check, X, Loader2 } from 'lucide-react';
import { formatCurrency, cn } from '@/lib/utils';

export default function Dashboard() {
  // Data States
  const [queues, setQueues] = useState<any[]>([]);
  const [todayIncome, setTodayIncome] = useState(0);
  const [monthlyIncome, setMonthlyIncome] = useState(0);
  const [goalAmount, setGoalAmount] = useState(150000);
  const [goalId, setGoalId] = useState<string | null>(null);
  
  // UI States
  const [loading, setLoading] = useState(true);
  const [isEditingGoal, setIsEditingGoal] = useState(false);
  const [tempGoal, setTempGoal] = useState("");

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const startMonth = startOfMonth(new Date()).toISOString();
      const endMonth = endOfMonth(new Date()).toISOString();

      // 1. Fetch Today's Queues
      const { data: queueData } = await supabase
        .from('queues')
        .select('*')
        .eq('date', today)
        .order('start_time');
      if (queueData) setQueues(queueData);

      // 2. Fetch Today's Income (จากตาราง receipts)
      const { data: todayReceipts } = await supabase
        .from('receipts')
        .select('final_price')
        .gte('created_at', `${today}T00:00:00`)
        .lte('created_at', `${today}T23:59:59`);
      
      const todayTotal = todayReceipts?.reduce((sum, r) => sum + r.final_price, 0) || 0;
      setTodayIncome(todayTotal);

      // 3. Fetch Monthly Income (จากตาราง receipts)
      const { data: monthReceipts } = await supabase
        .from('receipts')
        .select('final_price')
        .gte('created_at', startMonth)
        .lte('created_at', endMonth);

      const monthTotal = monthReceipts?.reduce((sum, r) => sum + r.final_price, 0) || 0;
      setMonthlyIncome(monthTotal);

      // 4. Fetch Goal Target
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

  const handleSaveGoal = async () => {
    const newAmount = parseInt(tempGoal);
    if (isNaN(newAmount) || newAmount <= 0) return;

    try {
      if (goalId) {
        // Update existing
        await supabase.from('goals').update({ amount: newAmount }).eq('id', goalId);
      } else {
        // Create new if not exists (fallback)
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

  // Calculate Percentage
  const progressPercent = Math.min(100, Math.round((monthlyIncome / goalAmount) * 100));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 md:gap-8">
      {/* Left Column - Queue List */}
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

      {/* Right Column - Stats */}
      <div className="col-span-1 lg:col-span-5 space-y-6 pt-0 lg:pt-16">
         {/* Income Card */}
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

         {/* Editable Goal Card */}
         <div className="bg-primary text-white rounded-[20px] p-8 shadow-lg shadow-primary/30 relative overflow-hidden transition-all">
             <div className="relative z-10">
                <div className="flex justify-between items-start">
                    <p className="text-white/80 text-xs font-bold tracking-wider uppercase mb-2">เป้าหมายเดือนนี้</p>
                    
                    {/* Edit Button */}
                    {!isEditingGoal ? (
                        <button onClick={startEditing} className="p-1.5 bg-white/10 hover:bg-white/20 rounded-lg transition-colors text-white/80 hover:text-white">
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
                    
                    {/* Editable Target Area */}
                    <span className="text-white/60 mb-1 text-sm md:text-base flex items-center gap-1">
                        / 
                        {isEditingGoal ? (
                             <input 
                                type="number" 
                                autoFocus
                                value={tempGoal}
                                onChange={(e) => setTempGoal(e.target.value)}
                                className="w-24 bg-white/20 border-b border-white text-white px-1 py-0.5 focus:outline-none focus:bg-white/30 rounded-sm font-bold"
                             />
                        ) : (
                            <span>{loading ? "..." : (goalAmount / 1000).toFixed(0) + 'k'}</span>
                        )}
                    </span>
                </div>

                {/* Progress Bar */}
                <div className="h-2 bg-black/20 rounded-full overflow-hidden mb-4">
                    <div 
                        className="h-full bg-white rounded-full transition-all duration-1000 ease-out" 
                        style={{ width: `${progressPercent}%` }}
                    ></div>
                </div>
             </div>
             
             {/* Big Percentage Background */}
             <div className="absolute right-6 top-1/2 -translate-y-1/2 text-7xl md:text-8xl font-bold text-white/10 select-none pointer-events-none">
                 {progressPercent}%
             </div>
         </div>
      </div>
    </div>
  );
}