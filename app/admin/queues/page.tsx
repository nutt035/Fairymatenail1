"use client";
import { useState, useEffect } from 'react';
import DateCarousel from '@/components/DateCarousel';
import StatusBadge from '@/components/ui/StatusBadge';
import { supabase } from '@/lib/supabase';
import { Plus, X, Edit, CheckCircle, AlertCircle, Trash2 } from 'lucide-react'; // เพิ่ม Trash2
import { formatCurrency } from '@/lib/utils';

// Types
interface Queue {
  id: string;
  customer_name: string;
  service_name: string;
  date: string;
  start_time: string;
  end_time: string;
  price: number;
  note: string;
  status: 'pending' | 'in_progress' | 'finished';
}

export default function QueueManagement() {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [queues, setQueues] = useState<Queue[]>([]);

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isFinishModalOpen, setIsFinishModalOpen] = useState(false);
  const [editingQueue, setEditingQueue] = useState<Queue | null>(null);

  // Form data
  const [formData, setFormData] = useState({
    customer_name: '',
    service_name: '',
    date: '',
    start_time: '',
    end_time: '',
    price: '',
    note: ''
  });

  const [finishData, setFinishData] = useState({
    queue_id: '',
    discount: '0'
  });

  const [error, setError] = useState('');

  // Load queues
  useEffect(() => {
    fetchQueues();
  }, [selectedDate]);

  const fetchQueues = async () => {
    const dateStr = selectedDate.toISOString().split('T')[0];
    const { data } = await supabase
      .from('queues')
      .select('*')
      .eq('date', dateStr)
      .neq('status', 'finished')
      .order('start_time');

    if (data) setQueues(data);
  };

  // Time overlap checking
  const checkOverlap = (targetDate: string, start: string, end: string, excludeId?: string) => {
    const dateStr = selectedDate.toISOString().split('T')[0];
    if (targetDate !== dateStr) return false;

    return queues.some(q => {
      if (excludeId && q.id === excludeId) return false;
      return (start < q.end_time && end > q.start_time);
    });
  };

  // Modals
  const handleOpenAdd = () => {
    setEditingQueue(null);
    const dateStr = selectedDate.toISOString().split('T')[0];
    setFormData({
      customer_name: '',
      service_name: '',
      date: dateStr,
      start_time: '',
      end_time: '',
      price: '',
      note: ''
    });
    setError('');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (q: Queue) => {
    setEditingQueue(q);
    setFormData({
      customer_name: q.customer_name,
      service_name: q.service_name,
      date: q.date,
      start_time: q.start_time.slice(0, 5),
      end_time: q.end_time.slice(0, 5),
      price: q.price.toString(),
      note: q.note || ''
    });
    setError('');
    setIsModalOpen(true);
  };

  const handleOpenFinish = (q: Queue) => {
    setFinishData({ queue_id: q.id, discount: '0' });
    setIsFinishModalOpen(true);
  };

  // --- ฟังก์ชันลบข้อมูล (เพิ่มใหม่) ---
  const handleDelete = async () => {
    if (!editingQueue) return;

    // ถามยืนยันก่อนลบ
    const isConfirmed = confirm(`คุณแน่ใจหรือไม่ว่าต้องการลบคิวของ "${editingQueue.customer_name}"? \nการกระทำนี้ไม่สามารถย้อนกลับได้`);
    
    if (isConfirmed) {
      const { error } = await supabase.from('queues').delete().eq('id', editingQueue.id);
      
      if (error) {
        setError('ไม่สามารถลบข้อมูลได้: ' + error.message);
      } else {
        setIsModalOpen(false); // ปิด Modal
        fetchQueues(); // โหลดข้อมูลใหม่
      }
    }
  };

  // Submit Add/Edit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (formData.start_time >= formData.end_time) {
      setError('เวลาสิ้นสุดต้องมากกว่าเวลาเริ่ม');
      return;
    }

    if (checkOverlap(formData.date, formData.start_time, formData.end_time, editingQueue?.id)) {
      setError('เวลานี้มีการจองชนกับคิวอื่นในวันนี้');
      return;
    }

    const payload = {
      customer_name: formData.customer_name,
      service_name: formData.service_name,
      date: formData.date,
      start_time: formData.start_time,
      end_time: formData.end_time,
      price: parseInt(formData.price) || 0,
      note: formData.note
    };

    if (editingQueue) {
      const { error } = await supabase.from('queues').update(payload).eq('id', editingQueue.id);
      if (error) setError(error.message);
    } else {
      const { error } = await supabase.from('queues').insert([payload]);
      if (error) setError(error.message);
    }

    if (!error) {
      setIsModalOpen(false);
      fetchQueues();
    }
  };

  // Finish job
  const handleFinishJob = async () => {
    const queue = queues.find(q => q.id === finishData.queue_id);
    if (!queue) return;

    const discount = parseInt(finishData.discount) || 0;
    const finalPrice = Math.max(0, queue.price - discount);

    const { error: receiptError } = await supabase.from('receipts').insert([{
      queue_id: queue.id,
      customer_name: queue.customer_name,
      service_name: queue.service_name,
      original_price: queue.price,
      discount,
      final_price: finalPrice, // แก้ไขชื่อ field ให้ตรงกับ DB (บางทีอาจเป็น final_price หรือ finalPrice แล้วแต่ setup)
      invoice_no: `INV-${Date.now().toString().slice(-6)}`
    }]);

    if (receiptError) {
      alert('Error creating receipt: ' + receiptError.message);
      return;
    }

    await supabase.from('queues')
      .update({ status: 'finished' })
      .eq('id', queue.id);

    setIsFinishModalOpen(false);
    fetchQueues();
  };

  return (
    <div className="h-full flex flex-col relative">

      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-800">Queue Management</h1>
          <p className="text-slate-400 mt-1 text-sm md:text-base">จัดการคิวลูกค้าประจำวัน</p>
        </div>

        <button
          onClick={handleOpenAdd}
          className="w-full md:w-auto bg-primary hover:bg-primary/90 text-white px-5 py-3 rounded-xl 
                     font-medium flex justify-center items-center gap-2 shadow-lg shadow-primary/20 transition-all"
        >
          <Plus size={20} /> เพิ่มคิวใหม่
        </button>
      </div>

      {/* Content */}
      <div className="bg-white rounded-[20px] shadow-soft p-4 md:p-6 flex-1 flex flex-col overflow-hidden">
        <DateCarousel
          selectedDate={selectedDate}
          onDateSelect={setSelectedDate}
          className="mb-4 md:mb-6 border-b border-slate-50 pb-4 md:pb-6"
        />

        {/* Queue list */}
        <div className="overflow-y-auto pr-0 md:pr-2 space-y-3 md:space-y-4 flex-1">

          {queues.map(q => (
            <div key={q.id}
              className="group relative flex flex-col md:flex-row bg-white border border-slate-100 
                         rounded-2xl p-3 md:p-4 transition-all hover:shadow-md hover:border-primary/20 gap-3 md:gap-0">

              {/* Indicator */}
              {q.status === 'in_progress' && (
                <>
                  <div className="absolute left-0 top-4 bottom-4 w-1 bg-primary rounded-r-full hidden md:block"></div>
                  <div className="absolute top-0 left-4 right-4 h-1 bg-primary rounded-b-full md:hidden"></div>
                </>
              )}

              <div className="md:pl-4 flex-1">
                <div className="flex justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="bg-slate-100 text-slate-600 px-2 py-1 md:px-3 md:py-1 rounded-lg 
                                    text-xs md:text-sm font-bold font-mono">
                      {q.start_time.slice(0, 5)} - {q.end_time.slice(0, 5)}
                    </div>

                    {q.note && (
                      <span className="text-[10px] md:text-xs text-orange-500 bg-orange-50 
                                       px-2 py-1 rounded-md border border-orange-100">
                        {q.note}
                      </span>
                    )}
                  </div>
                  <StatusBadge status={q.status} />
                </div>

                <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-3 md:mb-0 gap-2">
                  <div className="min-w-0 pr-2">
                    <h3 className="text-base md:text-lg font-bold text-slate-800 truncate">{q.customer_name}</h3>
                    <p className="text-primary text-sm md:text-base font-medium truncate">{q.service_name}</p>
                  </div>
                  <p className="font-bold text-slate-700 text-base md:text-lg whitespace-nowrap">
                    {formatCurrency(q.price)}
                  </p>
                </div>

                {/* Action buttons */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 md:gap-3 mt-2 md:mt-4 pt-3 md:pt-4 border-t border-slate-50">

                  <button
                    onClick={() => handleOpenEdit(q)}
                    className="py-2 rounded-xl border border-slate-200 text-slate-600 text-xs md:text-sm font-medium 
                               hover:bg-slate-50 flex justify-center items-center gap-2"
                  >
                    <Edit size={16} /> แก้ไข
                  </button>

                  <button
                    onClick={() => handleOpenFinish(q)}
                    className="py-2 rounded-xl bg-green-500 text-white text-xs md:text-sm font-medium 
                               hover:bg-green-600 shadow-md shadow-green-200 flex justify-center items-center gap-2"
                  >
                    <CheckCircle size={16} /> จบงาน
                  </button>

                </div>
              </div>
            </div>
          ))}

          {queues.length === 0 && (
            <div className="text-center py-20 text-slate-300">ไม่มีคิวสำหรับวันนี้</div>
          )}
        </div>
      </div>

      {/* ADD / EDIT MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/40 z-[60] flex items-center justify-center px-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-lg md:max-w-2xl p-4 md:p-6 shadow-2xl 
                          overflow-y-auto max-h-[85vh]">

            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-slate-800">
                {editingQueue ? "แก้ไขข้อมูลคิว" : "เพิ่มคิวใหม่"}
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">

              {/* Row 1 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">ชื่อลูกค้า</label>
                  <input
                    required
                    type="text"
                    className="w-full p-3 rounded-xl border border-slate-200"
                    value={formData.customer_name}
                    onChange={e => setFormData({ ...formData, customer_name: e.target.value })}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">บริการ</label>
                  <input
                    required
                    type="text"
                    className="w-full p-3 rounded-xl border border-slate-200"
                    value={formData.service_name}
                    onChange={e => setFormData({ ...formData, service_name: e.target.value })}
                  />
                </div>
              </div>

              {/* Row 2 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">วันที่จอง</label>
                  <input
                    required
                    type="date"
                    className="w-full p-3 rounded-xl border border-slate-200"
                    value={formData.date}
                    onChange={e => setFormData({ ...formData, date: e.target.value })}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">ราคา (บาท)</label>
                  <input
                    type="number"
                    className="w-full p-3 rounded-xl border border-slate-200"
                    value={formData.price}
                    onChange={e => setFormData({ ...formData, price: e.target.value })}
                  />
                </div>
              </div>

              {/* Row 3 */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">เวลาเริ่ม</label>
                  <input
                    required
                    type="time"
                    className="w-full p-3 rounded-xl border border-slate-200"
                    value={formData.start_time}
                    onChange={e => setFormData({ ...formData, start_time: e.target.value })}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">เวลาจบ</label>
                  <input
                    required
                    type="time"
                    className="w-full p-3 rounded-xl border border-slate-200"
                    value={formData.end_time}
                    onChange={e => setFormData({ ...formData, end_time: e.target.value })}
                  />
                </div>
              </div>

              {/* Row 4 */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">โน้ตเพิ่มเติม (ไม่บังคับ)</label>
                <textarea
                  className="w-full p-3 rounded-xl border border-slate-200 h-20 resize-none"
                  value={formData.note}
                  onChange={e => setFormData({ ...formData, note: e.target.value })}
                />
              </div>

              {/* Error */}
              {error && (
                <div className="bg-red-50 text-red-500 p-3 rounded-xl text-sm flex items-center gap-2">
                  <AlertCircle size={16} /> {error}
                </div>
              )}

              {/* Button Group (แก้ไขส่วนนี้เพื่อเพิ่มปุ่มลบ) */}
              <div className="flex gap-3 mt-4 pt-2">
                {/* ปุ่มลบ (แสดงเฉพาะตอนแก้ไข) */}
                {editingQueue && (
                  <button
                    type="button"
                    onClick={handleDelete}
                    className="px-4 py-3 bg-red-50 text-red-500 rounded-xl font-bold hover:bg-red-100 transition-colors flex items-center justify-center"
                    title="ลบคิวนี้"
                  >
                    <Trash2 size={20} />
                  </button>
                )}
                
                <button
                  type="submit"
                  className="flex-1 bg-primary text-white py-3 rounded-xl font-bold hover:bg-primary/90"
                >
                  บันทึกข้อมูล
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* FINISH MODAL */}
      {isFinishModalOpen && (
        <div className="fixed inset-0 bg-black/40 z-[60] flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl">

            <h2 className="text-xl font-bold text-slate-800 mb-4">จบงาน & ชำระเงิน</h2>
            <p className="text-slate-500 text-sm mb-6">
              กรุณาระบุส่วนลด (ถ้ามี) ก่อนออกใบเสร็จ
            </p>

            <div className="mb-6">
              <label className="block text-sm font-medium text-slate-700 mb-2">ส่วนลด (บาท)</label>
              <input
                type="number"
                className="w-full p-3 rounded-xl border border-slate-200 text-lg font-bold text-primary"
                value={finishData.discount}
                onChange={e => setFinishData({ ...finishData, discount: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <button
                onClick={() => setIsFinishModalOpen(false)}
                className="py-3 bg-slate-100 text-slate-600 rounded-xl font-medium"
              >
                ยกเลิก
              </button>

              <button
                onClick={handleFinishJob}
                className="py-3 bg-green-500 text-white rounded-xl font-bold hover:bg-green-600"
              >
                ยืนยันจบงาน
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}