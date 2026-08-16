import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { notifyNewBooking } from '@/lib/bookingNotifications';

const SLOT_MINUTES = 30;

export async function GET(request: Request) {
  const supabaseAdmin = getSupabaseAdmin();
  const url = new URL(request.url);
  const date = url.searchParams.get('date');
  const selectedServiceId = url.searchParams.get('serviceId');

  const { data: services, error: servicesError } = await supabaseAdmin
    .from('services')
    .select('id,name,price,duration_minutes')
    .eq('is_active', true)
    .order('price');

  if (servicesError) return serverError(servicesError.message);
  if (!date) return NextResponse.json({ services, slots: [] });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date < todayInBangkok()) {
    return NextResponse.json({ error: 'วันที่ไม่ถูกต้อง' }, { status: 400 });
  }

  const weekday = new Date(`${date}T12:00:00+07:00`).getDay();
  const [{ data: hours, error: hoursError }, { data: queues, error: queuesError }] = await Promise.all([
    supabaseAdmin.from('store_hours').select('open_time,close_time,is_closed').eq('weekday', weekday).maybeSingle(),
    supabaseAdmin.from('queues').select('start_time,end_time,status').eq('date', date).neq('status', 'cancelled'),
  ]);

  if (hoursError || queuesError) return serverError(hoursError?.message || queuesError?.message || 'Query failed');
  if (!hours || hours.is_closed) return NextResponse.json({ services, slots: [], closed: true });

  const selectedService = services?.find((service) => String(service.id) === selectedServiceId);
  const duration = Number(selectedService?.duration_minutes || SLOT_MINUTES);
  const slots = buildSlots(hours.open_time, hours.close_time, queues ?? [], duration);
  return NextResponse.json({ services, slots, closed: false });
}

export async function POST(request: Request) {
  const supabaseAdmin = getSupabaseAdmin();
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'ข้อมูลไม่ถูกต้อง' }, { status: 400 });
  }

  const customerName = clean(body.customerName, 100);
  const customerPhone = clean(body.customerPhone, 30);
  const date = clean(body.date, 10);
  const startTime = clean(body.startTime, 5);
  const serviceId = clean(body.serviceId, 100);
  const customerNote = clean(body.note, 300);

  if (!customerName || !/^0\d{8,9}$/.test(customerPhone.replace(/[ -]/g, '')) ||
      !/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(startTime) || !serviceId) {
    return NextResponse.json({ error: 'กรุณากรอกข้อมูลให้ครบและตรวจสอบเบอร์โทร' }, { status: 400 });
  }
  if (date < todayInBangkok()) return NextResponse.json({ error: 'ไม่สามารถจองวันที่ผ่านมาแล้ว' }, { status: 400 });

  const { data: service, error: serviceError } = await supabaseAdmin
    .from('services')
    .select('id,name,price,duration_minutes,is_active')
    .eq('id', serviceId)
    .eq('is_active', true)
    .single();
  if (serviceError || !service) return NextResponse.json({ error: 'ไม่พบบริการที่เลือก' }, { status: 400 });

  const endTime = addMinutes(startTime, Number(service.duration_minutes));
  const weekday = new Date(`${date}T12:00:00+07:00`).getDay();
  const { data: hours } = await supabaseAdmin
    .from('store_hours')
    .select('open_time,close_time,is_closed')
    .eq('weekday', weekday)
    .maybeSingle();
  if (!hours || hours.is_closed || startTime < hours.open_time.slice(0, 5) || endTime > hours.close_time.slice(0, 5)) {
    return NextResponse.json({ error: 'เวลานี้อยู่นอกเวลาทำการ' }, { status: 409 });
  }

  const { data: overlap, error: overlapError } = await supabaseAdmin
    .from('queues')
    .select('id')
    .eq('date', date)
    .neq('status', 'cancelled')
    .lt('start_time', endTime)
    .gt('end_time', startTime)
    .limit(1);
  if (overlapError) return serverError(overlapError.message);
  if (overlap?.length) return NextResponse.json({ error: 'เวลานี้มีผู้จองแล้ว กรุณาเลือกเวลาใหม่' }, { status: 409 });

  const note = [`โทร: ${customerPhone}`, customerNote].filter(Boolean).join('\n');
  const { data: booking, error: insertError } = await supabaseAdmin.from('queues').insert({
    customer_name: customerName,
    service_name: service.name,
    date,
    start_time: startTime,
    end_time: endTime,
    price: service.price,
    note,
    status: 'pending',
  }).select('id,customer_name,service_name,date,start_time,end_time,price,status').single();

  if (insertError) return serverError(insertError.message);
  const notifications = await notifyNewBooking({
    customerName,
    customerPhone,
    bookingDate: date,
    startTime,
    serviceName: service.name,
    price: Number(service.price),
  });
  return NextResponse.json({ booking, notifications }, { status: 201 });
}

function buildSlots(open: string, close: string, queues: Array<{ start_time: string; end_time: string }>, duration: number) {
  const result: Array<{ time: string; available: boolean }> = [];
  for (let minute = toMinutes(open); minute + duration <= toMinutes(close); minute += SLOT_MINUTES) {
    const time = fromMinutes(minute);
    const end = fromMinutes(minute + duration);
    const available = !queues.some((queue) => time < queue.end_time.slice(0, 5) && end > queue.start_time.slice(0, 5));
    result.push({ time, available });
  }
  return result;
}

function addMinutes(time: string, minutes: number) { return fromMinutes(toMinutes(time) + minutes); }
function toMinutes(time: string) { const [h, m] = time.slice(0, 5).split(':').map(Number); return h * 60 + m; }
function fromMinutes(value: number) { return `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`; }
function clean(value: unknown, max: number) { return typeof value === 'string' ? value.trim().slice(0, max) : ''; }
function todayInBangkok() { return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok' }).format(new Date()); }
function serverError(detail: string) { console.error('Public booking API:', detail); return NextResponse.json({ error: 'ระบบขัดข้อง กรุณาลองใหม่' }, { status: 500 }); }
