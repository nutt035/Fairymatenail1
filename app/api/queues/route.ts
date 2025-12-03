import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const date = searchParams.get('date');

  let query = supabase
    .from('queues')
    .select('*, services(name, duration_minutes)')
    .order('start_time', { ascending: true });

  if (date) {
    query = query.eq('date', date);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(request: Request) {
  const body = await request.json();
  const { customer_name, date, start_time, service_id } = body;

  // 1. Get Service Duration
  const { data: service } = await supabase.from('services').select('*').eq('id', service_id).single();
  if (!service) return NextResponse.json({ error: 'Service not found' }, { status: 400 });

  // 2. Calculate End Time (Simple logic)
  const [hours, mins] = start_time.split(':').map(Number);
  const startDate = new Date();
  startDate.setHours(hours, mins, 0);
  const endDate = new Date(startDate.getTime() + service.duration_minutes * 60000);
  const end_time = `${endDate.getHours().toString().padStart(2, '0')}:${endDate.getMinutes().toString().padStart(2, '0')}`;

  // 3. Check Overlap (Simplified for demo)
  // In real world, query database for overlaps

  // 4. Insert
  const { data, error } = await supabase.from('queues').insert([{
    customer_name, date, start_time, end_time, service_id, status: 'pending'
  }]).select();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data[0]);
}