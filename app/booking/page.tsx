'use client';

import Image from 'next/image';
import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, CheckCircle2, Clock3, Loader2, Sparkles } from 'lucide-react';

interface Service { id: string; name: string; price: number; duration_minutes: number }
interface Slot { time: string; available: boolean }

export default function BookingPage() {
  const [date, setDate] = useState(today());
  const [services, setServices] = useState<Service[]>([]);
  const [serviceId, setServiceId] = useState('');
  const [slots, setSlots] = useState<Slot[]>([]);
  const [startTime, setStartTime] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const service = useMemo(() => services.find((item) => item.id === serviceId), [services, serviceId]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setStartTime('');
    setError('');
    const query = new URLSearchParams({ date });
    if (serviceId) query.set('serviceId', serviceId);
    fetch(`/api/public/booking?${query}`)
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || 'โหลดข้อมูลไม่สำเร็จ');
        if (!active) return;
        setServices(payload.services || []);
        setSlots(payload.slots || []);
        setServiceId((current) => current || payload.services?.[0]?.id || '');
      })
      .catch((reason) => active && setError(reason.message))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [date, serviceId]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    setSuccess('');
    try {
      const response = await fetch('/api/public/booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerName, customerPhone, date, startTime, serviceId, note }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'จองคิวไม่สำเร็จ');
      setSuccess(`จองคิววันที่ ${date} เวลา ${startTime} สำเร็จแล้ว`);
      setCustomerName('');
      setCustomerPhone('');
      setNote('');
      setStartTime('');
      const refreshed = await fetch(`/api/public/booking?${new URLSearchParams({ date, serviceId })}`).then((res) => res.json());
      setSlots(refreshed.slots || []);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'จองคิวไม่สำเร็จ');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-[#fff4f8] to-white px-4 py-8 text-slate-800">
      <div className="mx-auto max-w-lg">
        <header className="mb-6 flex flex-col items-center text-center">
          <div className="relative mb-3 h-20 w-20 overflow-hidden rounded-full border-4 border-white shadow-lg">
            <Image src="/logo.jpg" alt="Fairymate Nail" fill className="object-cover" priority />
          </div>
          <h1 className="text-2xl font-black text-pink-600">Fairymate.Nail</h1>
          <p className="mt-1 text-sm text-slate-500">เลือกบริการและเวลาที่สะดวกได้เลยค่ะ</p>
        </header>

        <form onSubmit={submit} className="space-y-5 rounded-3xl bg-white p-5 shadow-xl shadow-pink-100/60 sm:p-7">
          <Section title="1. เลือกบริการ" icon={<Sparkles size={19} />}>
            <select value={serviceId} onChange={(e) => setServiceId(e.target.value)} required className="field">
              {services.map((item) => (
                <option key={item.id} value={item.id}>{item.name} — ฿{Number(item.price).toLocaleString('th-TH')} ({item.duration_minutes} นาที)</option>
              ))}
            </select>
          </Section>

          <Section title="2. เลือกวันที่" icon={<CalendarDays size={19} />}>
            <input type="date" min={today()} value={date} onChange={(e) => setDate(e.target.value)} required className="field" />
          </Section>

          <Section title="3. เลือกเวลา" icon={<Clock3 size={19} />}>
            {loading ? <div className="flex justify-center py-5"><Loader2 className="animate-spin text-pink-500" /></div> : (
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {slots.map((slot) => (
                  <button key={slot.time} type="button" disabled={!slot.available}
                    onClick={() => setStartTime(slot.time)}
                    className={`rounded-xl border px-2 py-3 text-sm font-bold transition ${startTime === slot.time ? 'border-pink-500 bg-pink-500 text-white' : slot.available ? 'border-pink-200 bg-pink-50 text-pink-700 hover:border-pink-400' : 'cursor-not-allowed border-slate-100 bg-slate-100 text-slate-300 line-through'}`}>
                    {slot.time}
                  </button>
                ))}
                {!slots.length && <p className="col-span-full py-3 text-center text-sm text-slate-400">วันนี้ร้านปิดหรือไม่มีคิวว่าง</p>}
              </div>
            )}
            {service && <p className="mt-2 text-xs text-slate-400">บริการนี้ใช้เวลาประมาณ {service.duration_minutes} นาที ระบบจะตรวจเวลาว่างอีกครั้งก่อนยืนยัน</p>}
          </Section>

          <Section title="4. ข้อมูลผู้จอง" icon={<CheckCircle2 size={19} />}>
            <div className="space-y-3">
              <input value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="ชื่อผู้จอง" maxLength={100} required className="field" />
              <input value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} placeholder="เบอร์โทร เช่น 0812345678" inputMode="tel" maxLength={20} required className="field" />
              <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="รายละเอียดเพิ่มเติม (ถ้ามี)" maxLength={300} rows={3} className="field resize-none" />
            </div>
          </Section>

          {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm font-medium text-red-600">{error}</p>}
          {success && <p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm font-medium text-emerald-700">{success}</p>}

          <button type="submit" disabled={submitting || !startTime || !serviceId}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-pink-500 py-4 text-lg font-black text-white shadow-lg shadow-pink-200 transition hover:bg-pink-600 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none">
            {submitting && <Loader2 size={20} className="animate-spin" />}
            {submitting ? 'กำลังจอง...' : 'ยืนยันการจองคิว'}
          </button>
        </form>
      </div>
      <style jsx>{` .field { width: 100%; border-radius: 0.75rem; border: 1px solid #e2e8f0; background: #f8fafc; padding: 0.75rem 1rem; outline: none; } .field:focus { border-color: #ec4899; box-shadow: 0 0 0 3px rgb(236 72 153 / .12); background: white; } `}</style>
    </main>
  );
}

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return <section><h2 className="mb-3 flex items-center gap-2 font-bold text-slate-700"><span className="text-pink-500">{icon}</span>{title}</h2>{children}</section>;
}

function today() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok' }).format(new Date());
}
