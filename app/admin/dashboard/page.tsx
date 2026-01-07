"use client";
import { format, startOfMonth, endOfMonth, subDays, eachDayOfInterval } from "date-fns";
import { th } from "date-fns/locale";
import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import StatusBadge from "@/components/ui/StatusBadge";
import {
  Clock, Receipt, Edit2, Check, X, Loader2, CalendarDays, TrendingUp, TrendingDown, Wallet,
} from "lucide-react";
import { formatCurrency, cn } from "@/lib/utils";

const weekdayNames = [
  "อาทิตย์",
  "จันทร์",
  "อังคาร",
  "พุธ",
  "พฤหัส",
  "ศุกร์",
  "เสาร์",
];

type StoreHour = {
  weekday: number;
  open_time: string | null;
  close_time: string | null;
  is_closed: boolean;
};

export default function Dashboard() {
  // Queue + Income States
  const [queues, setQueues] = useState<any[]>([]);
  const [todayIncome, setTodayIncome] = useState(0);
  const [monthlyIncome, setMonthlyIncome] = useState(0);
  const [goalAmount, setGoalAmount] = useState(150000);
  const [goalId, setGoalId] = useState<string | null>(null);

  // Profit States (NEW)
  const [monthlyExpenses, setMonthlyExpenses] = useState(0);
  const [todayExpenses, setTodayExpenses] = useState(0);
  const [weeklyData, setWeeklyData] = useState<{ date: string; income: number; expense: number }[]>([]);

  // UI States
  const [loading, setLoading] = useState(true);
  const [isEditingGoal, setIsEditingGoal] = useState(false);
  const [tempGoal, setTempGoal] = useState("");

  // Store hours (weekly)
  const [storeHours, setStoreHours] = useState<StoreHour[]>([]);
  const [loadingStoreHours, setLoadingStoreHours] = useState(true);

  // Special hours (exceptions)
  const [exceptionDate, setExceptionDate] = useState("");
  const [exceptionOpenTime, setExceptionOpenTime] = useState("");
  const [exceptionCloseTime, setExceptionCloseTime] = useState("");
  const [exceptionIsClosed, setExceptionIsClosed] = useState(false);
  const [loadingException, setLoadingException] = useState(false);
  const [savingException, setSavingException] = useState(false);

  useEffect(() => {
    fetchDashboardData();
    fetchStoreHours();
    fetchProfitData();
  }, []);

  // -----------------------------
  // Dashboard main data
  // -----------------------------
  const fetchDashboardData = async () => {
    try {
      const today = new Date().toISOString().split("T")[0];
      const startMonth = startOfMonth(new Date()).toISOString();
      const endMonth = endOfMonth(new Date()).toISOString();

      // 1) Today's queues
      const { data: queueData } = await supabase
        .from("queues")
        .select("*")
        .eq("date", today)
        .order("start_time");

      if (queueData) setQueues(queueData);

      // 2) Today income
      const { data: todayReceipts } = await supabase
        .from("receipts")
        .select("final_price")
        .gte("created_at", `${today}T00:00:00`)
        .lte("created_at", `${today}T23:59:59`);

      const todayTotal =
        todayReceipts?.reduce((sum, r) => sum + r.final_price, 0) || 0;
      setTodayIncome(todayTotal);

      // 3) Monthly income
      const { data: monthReceipts } = await supabase
        .from("receipts")
        .select("final_price")
        .gte("created_at", startMonth)
        .lte("created_at", endMonth);

      const monthTotal =
        monthReceipts?.reduce((sum, r) => sum + r.final_price, 0) || 0;
      setMonthlyIncome(monthTotal);

      // 4) Goal
      const { data: goalData } = await supabase
        .from("goals")
        .select("*")
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
  // Profit Data (NEW)
  // -----------------------------
  const fetchProfitData = async () => {
    try {
      const today = new Date();
      const todayStr = format(today, 'yyyy-MM-dd');
      const startMonth = format(startOfMonth(today), 'yyyy-MM-dd');
      const endMonth = format(endOfMonth(today), 'yyyy-MM-dd');
      const weekStart = format(subDays(today, 6), 'yyyy-MM-dd');

      // 1) Monthly expenses
      const { data: monthExpenses } = await supabase
        .from('expenses')
        .select('amount')
        .gte('date', startMonth)
        .lte('date', endMonth);

      const monthExpTotal = monthExpenses?.reduce((sum, e) => sum + (e.amount || 0), 0) || 0;
      setMonthlyExpenses(monthExpTotal);

      // 2) Today expenses
      const { data: todayExp } = await supabase
        .from('expenses')
        .select('amount')
        .eq('date', todayStr);

      const todayExpTotal = todayExp?.reduce((sum, e) => sum + (e.amount || 0), 0) || 0;
      setTodayExpenses(todayExpTotal);

      // 3) Weekly data for trend chart
      const last7Days = eachDayOfInterval({ start: subDays(today, 6), end: today });
      const weeklyDataArray: { date: string; income: number; expense: number }[] = [];

      for (const day of last7Days) {
        const dayStr = format(day, 'yyyy-MM-dd');

        // Get income for this day
        const { data: dayReceipts } = await supabase
          .from('receipts')
          .select('final_price')
          .gte('created_at', `${dayStr}T00:00:00`)
          .lte('created_at', `${dayStr}T23:59:59`);

        const dayIncome = dayReceipts?.reduce((sum, r) => sum + (r.final_price || 0), 0) || 0;

        // Get expense for this day
        const { data: dayExpenses } = await supabase
          .from('expenses')
          .select('amount')
          .eq('date', dayStr);

        const dayExpense = dayExpenses?.reduce((sum, e) => sum + (e.amount || 0), 0) || 0;

        weeklyDataArray.push({
          date: format(day, 'EEE', { locale: th }),
          income: dayIncome,
          expense: dayExpense,
        });
      }

      setWeeklyData(weeklyDataArray);
    } catch (error) {
      console.error("Error fetching profit data:", error);
    }
  };

  // -----------------------------
  // Weekly store hours
  // -----------------------------
  const fetchStoreHours = async () => {
    setLoadingStoreHours(true);
    try {
      const { data } = await supabase
        .from("store_hours")
        .select("*")
        .order("weekday");

      if (data && data.length > 0) {
        setStoreHours(
          data.map((d) => ({
            weekday: d.weekday,
            open_time: d.open_time,
            close_time: d.close_time,
            is_closed: d.is_closed,
          }))
        );
      } else {
        // ถ้ายังไม่มีข้อมูลใน table ให้สร้าง default ใน state ไว้ก่อน
        const defaultHours: StoreHour[] = Array.from({ length: 7 }, (_, i) => ({
          weekday: i,
          open_time: "13:00",
          close_time: "22:00",
          is_closed: i === 3, // พุธปิดทั้งวัน (แก้ทีหลังได้)
        }));
        setStoreHours(defaultHours);
      }
    } catch (err) {
      console.error("Error fetching store hours:", err);
    } finally {
      setLoadingStoreHours(false);
    }
  };

  const updateLocalTime = (
    weekday: number,
    field: "open_time" | "close_time",
    value: string
  ) => {
    setStoreHours((prev) =>
      prev.map((d) =>
        d.weekday === weekday ? { ...d, [field]: value } : d
      )
    );
  };

  const toggleClosed = (weekday: number) => {
    setStoreHours((prev) =>
      prev.map((d) =>
        d.weekday === weekday ? { ...d, is_closed: !d.is_closed } : d
      )
    );
  };

  const saveStoreHours = async () => {
    try {
      // ใช้ upsert เพื่อให้สร้าง row ใหม่ถ้ายังไม่มี
      const { error } = await supabase.from("store_hours").upsert(
        storeHours.map((d) => ({
          weekday: d.weekday,
          open_time: d.is_closed ? null : d.open_time,
          close_time: d.is_closed ? null : d.close_time,
          is_closed: d.is_closed,
        })),
        { onConflict: "weekday" }
      );

      if (error) throw error;
      alert("บันทึกเวลาเปิด–ปิดประจำสัปดาห์เรียบร้อยแล้ว");
    } catch (err) {
      console.error(err);
      alert("เกิดข้อผิดพลาดในการบันทึกเวลา");
    }
  };

  // -----------------------------
  // Special hours (store_exceptions)
  // -----------------------------
  const loadExceptionForDate = async (dateStr: string) => {
    if (!dateStr) return;
    setLoadingException(true);
    try {
      const { data } = await supabase
        .from("store_exceptions")
        .select("*")
        .eq("date", dateStr)
        .maybeSingle();

      if (data) {
        setExceptionOpenTime(data.open_time || "");
        setExceptionCloseTime(data.close_time || "");
        setExceptionIsClosed(data.is_closed);
      } else {
        // ถ้ายังไม่มี record ให้ reset เป็นค่า default ว่าง
        setExceptionOpenTime("");
        setExceptionCloseTime("");
        setExceptionIsClosed(false);
      }
    } catch (err) {
      console.error("Error loading exception:", err);
    } finally {
      setLoadingException(false);
    }
  };

  const handleExceptionDateChange = (value: string) => {
    setExceptionDate(value);
    loadExceptionForDate(value);
  };

  const saveException = async () => {
    if (!exceptionDate) {
      alert("กรุณาเลือกวันที่ก่อน");
      return;
    }

    setSavingException(true);
    try {
      const payload = {
        date: exceptionDate,
        open_time: exceptionIsClosed ? null : exceptionOpenTime || null,
        close_time: exceptionIsClosed ? null : exceptionCloseTime || null,
        is_closed: exceptionIsClosed,
      };

      const { error } = await supabase
        .from("store_exceptions")
        .upsert(payload, { onConflict: "date" });

      if (error) throw error;
      alert("บันทึกเวลาเปิด–ปิดพิเศษเรียบร้อยแล้ว");
    } catch (err) {
      console.error(err);
      alert("เกิดข้อผิดพลาดในการบันทึกเวลาพิเศษ");
    } finally {
      setSavingException(false);
    }
  };

  // -----------------------------
  // Goal handlers
  // -----------------------------
  const handleSaveGoal = async () => {
    const newAmount = parseInt(tempGoal);
    if (isNaN(newAmount) || newAmount <= 0) return;

    try {
      if (goalId) {
        await supabase
          .from("goals")
          .update({ amount: newAmount })
          .eq("id", goalId);
      } else {
        await supabase.from("goals").insert([{ amount: newAmount }]);
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

  const progressPercent = Math.min(
    100,
    Math.round((monthlyIncome / goalAmount) * 100)
  );

  // -----------------------------
  // RENDER
  // -----------------------------
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <h1 className="text-2xl md:text-3xl font-bold text-slate-800">
          แดชบอร์ด
        </h1>
        <span className="bg-white border border-pink-100 text-primary px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap">
          {format(new Date(), "d MMMM yyyy", { locale: th })}
        </span>
      </div>

      {/* Top Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Today Profit */}
        <div className={cn(
          "rounded-2xl p-4 shadow-sm relative overflow-hidden",
          (todayIncome - todayExpenses) >= 0
            ? "bg-gradient-to-br from-emerald-500 to-emerald-600"
            : "bg-gradient-to-br from-red-500 to-red-600"
        )}>
          <div className="relative z-10">
            <div className="flex items-center gap-1.5 mb-1">
              {(todayIncome - todayExpenses) >= 0 ? (
                <TrendingUp size={14} className="text-white/80" />
              ) : (
                <TrendingDown size={14} className="text-white/80" />
              )}
              <span className="text-white/80 text-[10px] font-bold uppercase">
                กำไรวันนี้
              </span>
            </div>
            <p className="text-xl font-black text-white">
              {loading ? "..." : formatCurrency(todayIncome - todayExpenses)}
            </p>
          </div>
        </div>

        {/* Today Income */}
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <div className="flex items-center gap-1.5 mb-1">
            <Receipt size={14} className="text-primary" />
            <span className="text-slate-400 text-[10px] font-bold uppercase">รายได้วันนี้</span>
          </div>
          <p className="text-xl font-bold text-slate-800">
            {loading ? "..." : formatCurrency(todayIncome)}
          </p>
        </div>

        {/* Monthly Income */}
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <div className="flex items-center gap-1.5 mb-1">
            <Wallet size={14} className="text-primary" />
            <span className="text-slate-400 text-[10px] font-bold uppercase">รายได้เดือนนี้</span>
          </div>
          <p className="text-xl font-bold text-slate-800">
            {formatCurrency(monthlyIncome)}
          </p>
        </div>

        {/* Net Profit */}
        <div className={cn(
          "rounded-2xl p-4 shadow-sm",
          (monthlyIncome - monthlyExpenses) >= 0 ? "bg-primary/10" : "bg-slate-100"
        )}>
          <div className="flex items-center gap-1.5 mb-1">
            <TrendingUp size={14} className="text-primary" />
            <span className="text-primary text-[10px] font-bold uppercase">กำไรเดือนนี้</span>
          </div>
          <p className={cn(
            "text-xl font-bold",
            (monthlyIncome - monthlyExpenses) >= 0 ? "text-primary" : "text-slate-600"
          )}>
            {formatCurrency(monthlyIncome - monthlyExpenses)}
          </p>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* LEFT COLUMN — TODAY QUEUES */}
        <div className="col-span-1 lg:col-span-7 space-y-4">

          <div className="bg-white rounded-[20px] p-4 md:p-6 shadow-soft min-h-[400px] md:min-h-[500px]">
            <div className="flex justify-between items-center mb-6">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <Clock size={16} className="text-primary" />
                </div>
                <h2 className="font-bold text-base md:text-lg">
                  คิววันนี้ ({queues.length})
                </h2>
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
                <div className="flex justify-center py-10">
                  <Loader2 className="animate-spin text-primary" />
                </div>
              ) : (
                queues.map((q, idx) => {
                  const isNow = idx === 0 && q.status !== "finished";
                  return (
                    <div
                      key={q.id}
                      className="flex items-center gap-3 md:gap-4 p-2 hover:bg-slate-50 rounded-xl transition-colors"
                    >
                      <div
                        className={cn(
                          "flex flex-col items-center justify-center w-14 h-14 md:w-16 md:h-16 rounded-xl border shrink-0",
                          isNow
                            ? "bg-primary border-primary text-white shadow-md shadow-primary/20"
                            : "bg-white border-slate-100 text-slate-500"
                        )}
                      >
                        {isNow && (
                          <span className="text-[9px] md:text-[10px] font-bold mb-0.5">
                            NOW
                          </span>
                        )}
                        <span
                          className={cn(
                            "font-bold",
                            isNow ? "text-base md:text-lg" : "text-xs md:text-sm"
                          )}
                        >
                          {q.start_time.slice(0, 5)}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-slate-800 truncate">
                          {q.customer_name}
                        </h3>
                        <p className="text-sm text-slate-400 truncate">
                          {q.service_name}
                        </p>
                      </div>
                      <div className="shrink-0">
                        <StatusBadge status={q.status} />
                      </div>
                    </div>
                  );
                })
              )}
              {!loading && queues.length === 0 && (
                <p className="text-center text-slate-400 mt-10">
                  ไม่มีคิวสำหรับวันนี้
                </p>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN — GOAL + STORE HOURS */}
        <div className="col-span-1 lg:col-span-5 space-y-4">
          {/* Weekly Trend Chart */}
          {weeklyData.length > 0 && (
            <div className="bg-white rounded-2xl p-4 shadow-soft">
              <p className="text-xs text-slate-500 font-bold uppercase mb-3">กำไร 7 วันล่าสุด</p>
              <div className="flex items-end justify-between gap-1 h-20">
                {weeklyData.map((day, idx) => {
                  const maxIncome = Math.max(...weeklyData.map(d => d.income), 1);
                  const height = (day.income / maxIncome) * 100;
                  const profit = day.income - day.expense;
                  return (
                    <div key={idx} className="flex-1 flex flex-col items-center gap-1">
                      <div
                        className={cn(
                          "w-full rounded-t-md transition-all duration-300",
                          profit >= 0 ? "bg-emerald-400" : "bg-red-400"
                        )}
                        style={{ height: `${Math.max(height, 8)}%` }}
                        title={`รายได้: ${formatCurrency(day.income)} / รายจ่าย: ${formatCurrency(day.expense)}`}
                      />
                      <span className="text-[9px] text-slate-400">{day.date}</span>
                    </div>
                  );
                })}
              </div>
              <div className="flex justify-center gap-4 mt-2 text-[10px] text-slate-400">
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-400"></span> กำไร
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-red-400"></span> ขาดทุน
                </span>
              </div>
            </div>
          )}

          {/* Monthly Goal */}
          <div className="bg-primary text-white rounded-[20px] p-8 shadow-lg shadow-primary/30 relative overflow-hidden">
            <div className="relative z-10">
              <div className="flex justify-between items-start">
                <p className="text-white/80 text-xs font-bold tracking-wider uppercase mb-2">
                  เป้าหมายเดือนนี้
                </p>

                {!isEditingGoal ? (
                  <button
                    onClick={startEditing}
                    className="p-1.5 bg-white/10 hover:bg白/20 rounded-lg text-white/80 hover:text-white"
                  >
                    <Edit2 size={14} />
                  </button>
                ) : (
                  <div className="flex gap-2">
                    <button
                      onClick={handleSaveGoal}
                      className="p-1.5 bg-white text-primary rounded-lg hover:bg-white/90"
                    >
                      <Check size={14} />
                    </button>
                    <button
                      onClick={() => setIsEditingGoal(false)}
                      className="p-1.5 bg-white/10 text-white rounded-lg hover:bg-white/20"
                    >
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
                    <span>
                      {loading ? "..." : (goalAmount / 1000).toFixed(0) + "k"}
                    </span>
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

          {/* CARD 1: Weekly store hours */}
          <div className="bg-white rounded-[20px] p-6 shadow-soft">
            <h2 className="font-bold text-lg mb-4">ตั้งเวลาเปิด–ปิดร้าน (ประจำสัปดาห์)</h2>

            {loadingStoreHours ? (
              <div className="flex justify-center py-6">
                <Loader2 className="animate-spin text-primary" />
              </div>
            ) : (
              <div className="space-y-3">
                {storeHours.map((day) => (
                  <div
                    key={day.weekday}
                    className="flex items-center gap-3 text-sm"
                  >
                    <span className="w-20 text-slate-600 font-medium">
                      {weekdayNames[day.weekday]}
                    </span>

                    {day.is_closed ? (
                      <span className="text-slate-400 italic flex-1">
                        ปิดร้านทั้งวัน
                      </span>
                    ) : (
                      <div className="flex items-center gap-2 flex-1">
                        <input
                          type="time"
                          value={day.open_time || ""}
                          onChange={(e) =>
                            updateLocalTime(
                              day.weekday,
                              "open_time",
                              e.target.value
                            )
                          }
                          className="border rounded-lg px-2 py-1 text-xs"
                        />
                        <span className="text-slate-400">–</span>
                        <input
                          type="time"
                          value={day.close_time || ""}
                          onChange={(e) =>
                            updateLocalTime(
                              day.weekday,
                              "close_time",
                              e.target.value
                            )
                          }
                          className="border rounded-lg px-2 py-1 text-xs"
                        />
                      </div>
                    )}

                    <button
                      onClick={() => toggleClosed(day.weekday)}
                      className={cn(
                        "px-3 py-1 rounded-lg text-xs font-medium",
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
              className="mt-5 w-full bg-primary text-white py-2.5 rounded-xl font-bold shadow hover:bg-primary/90"
            >
              บันทึกเวลาเปิด–ปิดประจำสัปดาห์
            </button>
          </div>

          {/* CARD 2: Special hours */}
          <div className="bg-white rounded-[20px] p-6 shadow-soft">
            <h2 className="font-bold text-lg mb-3">ตั้งเวลาเปิด–ปิดร้านพิเศษ (รายวัน)</h2>

            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <CalendarDays className="w-4 h-4 text-primary" />
                <input
                  type="date"
                  className="border rounded-lg px-3 py-1.5 text-sm flex-1"
                  value={exceptionDate}
                  onChange={(e) => handleExceptionDateChange(e.target.value)}
                />
              </div>

              {loadingException ? (
                <div className="flex justify-center py-4">
                  <Loader2 className="animate-spin text-primary" />
                </div>
              ) : (
                <>
                  {!exceptionIsClosed && (
                    <div className="flex items-center gap-2 text-sm">
                      <span className="w-14 text-slate-600">เวลา</span>
                      <input
                        type="time"
                        value={exceptionOpenTime}
                        onChange={(e) =>
                          setExceptionOpenTime(e.target.value)
                        }
                        className="border rounded-lg px-2 py-1 text-xs"
                      />
                      <span className="text-slate-400">–</span>
                      <input
                        type="time"
                        value={exceptionCloseTime}
                        onChange={(e) =>
                          setExceptionCloseTime(e.target.value)
                        }
                        className="border rounded-lg px-2 py-1 text-xs"
                      />
                    </div>
                  )}

                  <button
                    onClick={() =>
                      setExceptionIsClosed((prev) => !prev)
                    }
                    className={cn(
                      "px-3 py-1 rounded-lg text-xs font-medium",
                      exceptionIsClosed
                        ? "bg-primary text-white"
                        : "bg-slate-100 text-slate-600"
                    )}
                  >
                    {exceptionIsClosed ? "เปิดร้านวันนี้" : "ปิดร้านทั้งวัน"}
                  </button>
                </>
              )}
            </div>

            <button
              onClick={saveException}
              disabled={savingException}
              className="mt-5 w-full bg-primary text-white py-2.5 rounded-xl font-bold shadow hover:bg-primary/90 disabled:opacity-60"
            >
              {savingException ? "กำลังบันทึก..." : "บันทึกเวลาเปิด–ปิดร้านพิเศษ"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
