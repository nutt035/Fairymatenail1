"use client";
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { formatCurrency, cn } from '@/lib/utils';
import {
    Package,
    Plus,
    Search,
    Edit2,
    Trash2,
    AlertTriangle,
    Loader2,
    X,
    Check,
    Filter,
} from 'lucide-react';

// --- Types ---
interface StockItem {
    id: string;
    name: string;
    quantity: number;
    unit: string;
    min_quantity: number;
    cost_per_unit: number;
    category: string;
    image_url?: string;
    created_at?: string;
    updated_at?: string;
}

const STOCK_CATEGORIES = [
    'ทั้งหมด',
    'สีเจล',
    'อะคริลิค/ต่อเล็บ',
    'สติ๊กเกอร์/อาร์ต',
    'อุปกรณ์',
    'วัสดุสิ้นเปลือง',
    'อื่นๆ',
];

export default function StockManagement() {
    const [stockItems, setStockItems] = useState<StockItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('ทั้งหมด');

    // Modal states
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<StockItem | null>(null);

    // Form state
    const [formData, setFormData] = useState({
        name: '',
        quantity: 0,
        unit: 'ชิ้น',
        min_quantity: 5,
        cost_per_unit: 0,
        category: 'อื่นๆ',
    });

    // Fetch stock items from real database
    const fetchStock = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('stock_items')
                .select('*')
                .order('name');

            if (error) {
                console.error('Error fetching stock:', error);
                setStockItems([]);
            } else {
                setStockItems(data || []);
            }
        } catch (err) {
            console.error('Error fetching stock:', err);
            setStockItems([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchStock();
    }, []);

    // Filter items
    const filteredItems = stockItems.filter(item => {
        const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesCategory = selectedCategory === 'ทั้งหมด' || item.category === selectedCategory;
        return matchesSearch && matchesCategory;
    });

    // Stock status helper
    const getStockStatus = (item: StockItem) => {
        if (item.quantity === 0) return { label: 'หมด', color: 'bg-red-100 text-red-600' };
        if (item.quantity <= item.min_quantity) return { label: 'ใกล้หมด', color: 'bg-amber-100 text-amber-600' };
        return { label: 'ปกติ', color: 'bg-emerald-100 text-emerald-600' };
    };

    // Handle form submit
    const handleSubmit = async () => {
        if (!formData.name.trim()) {
            alert('กรุณาระบุชื่อสินค้า');
            return;
        }

        try {
            if (editingItem) {
                // Update existing
                const { error } = await supabase
                    .from('stock_items')
                    .update({
                        name: formData.name,
                        quantity: formData.quantity,
                        unit: formData.unit,
                        min_quantity: formData.min_quantity,
                        cost_per_unit: formData.cost_per_unit,
                        category: formData.category,
                        updated_at: new Date().toISOString(),
                    })
                    .eq('id', editingItem.id);

                if (error) throw error;
            } else {
                // Insert new
                const { error } = await supabase
                    .from('stock_items')
                    .insert([{
                        name: formData.name,
                        quantity: formData.quantity,
                        unit: formData.unit,
                        min_quantity: formData.min_quantity,
                        cost_per_unit: formData.cost_per_unit,
                        category: formData.category,
                    }]);

                if (error) throw error;
            }

            setIsModalOpen(false);
            setEditingItem(null);
            resetForm();
            fetchStock();
        } catch (err) {
            console.error('Error saving stock:', err);
            alert('เกิดข้อผิดพลาดในการบันทึก');
        }
    };

    // Handle delete
    const handleDelete = async (id: string) => {
        if (!confirm('ลบรายการนี้?')) return;

        try {
            const { error } = await supabase
                .from('stock_items')
                .delete()
                .eq('id', id);

            if (error) throw error;
            fetchStock();
        } catch (err) {
            console.error('Error deleting stock:', err);
            alert('เกิดข้อผิดพลาดในการลบ');
        }
    };

    // Open edit modal
    const openEditModal = (item: StockItem) => {
        setEditingItem(item);
        setFormData({
            name: item.name,
            quantity: item.quantity,
            unit: item.unit,
            min_quantity: item.min_quantity,
            cost_per_unit: item.cost_per_unit,
            category: item.category,
        });
        setIsModalOpen(true);
    };

    // Reset form
    const resetForm = () => {
        setFormData({
            name: '',
            quantity: 0,
            unit: 'ชิ้น',
            min_quantity: 5,
            cost_per_unit: 0,
            category: 'อื่นๆ',
        });
    };

    // Count stats
    const lowStockCount = stockItems.filter(i => i.quantity <= i.min_quantity && i.quantity > 0).length;
    const outOfStockCount = stockItems.filter(i => i.quantity === 0).length;
    const totalValue = stockItems.reduce((sum, i) => sum + (i.quantity * i.cost_per_unit), 0);

    return (
        <div className="min-h-screen bg-[#F8F9FA] pb-8">
            {/* Header */}
            <div className="mb-6">
                <h1 className="text-2xl md:text-3xl font-bold text-slate-800 flex items-center gap-2">
                    <Package className="text-primary" size={28} />
                    จัดการสต็อก
                </h1>
                <p className="text-slate-500 mt-1">จัดการอุปกรณ์และวัสดุทำเล็บ</p>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
                    <p className="text-xs text-slate-400 font-medium uppercase">รายการทั้งหมด</p>
                    <p className="text-2xl font-bold text-slate-800 mt-1">{stockItems.length}</p>
                </div>
                <div className="bg-white rounded-2xl p-4 shadow-sm border border-amber-100">
                    <p className="text-xs text-amber-500 font-medium uppercase flex items-center gap-1">
                        <AlertTriangle size={12} /> ใกล้หมด
                    </p>
                    <p className="text-2xl font-bold text-amber-600 mt-1">{lowStockCount}</p>
                </div>
                <div className="bg-white rounded-2xl p-4 shadow-sm border border-red-100">
                    <p className="text-xs text-red-500 font-medium uppercase">หมดสต็อก</p>
                    <p className="text-2xl font-bold text-red-600 mt-1">{outOfStockCount}</p>
                </div>
                <div className="bg-white rounded-2xl p-4 shadow-sm border border-primary/20">
                    <p className="text-xs text-primary font-medium uppercase">มูลค่ารวม</p>
                    <p className="text-2xl font-bold text-primary mt-1">{formatCurrency(totalValue)}</p>
                </div>
            </div>

            {/* Search & Filter Bar */}
            <div className="bg-white rounded-2xl p-4 shadow-sm mb-4">
                <div className="flex flex-col md:flex-row gap-3">
                    {/* Search */}
                    <div className="flex-1 relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="ค้นหาสินค้า..."
                            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                        />
                    </div>

                    {/* Category Filter */}
                    <div className="flex gap-2 overflow-x-auto pb-1">
                        {STOCK_CATEGORIES.map(cat => (
                            <button
                                key={cat}
                                onClick={() => setSelectedCategory(cat)}
                                className={cn(
                                    "px-3 py-2 rounded-xl text-xs font-medium whitespace-nowrap transition-colors",
                                    selectedCategory === cat
                                        ? "bg-primary text-white shadow-md"
                                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                                )}
                            >
                                {cat}
                            </button>
                        ))}
                    </div>

                    {/* Add Button */}
                    <button
                        onClick={() => {
                            resetForm();
                            setEditingItem(null);
                            setIsModalOpen(true);
                        }}
                        className="flex items-center gap-2 px-4 py-2.5 bg-primary text-white rounded-xl font-bold shadow-md shadow-primary/20 hover:bg-primary/90 transition-colors shrink-0"
                    >
                        <Plus size={18} />
                        <span className="hidden md:inline">เพิ่มสินค้า</span>
                    </button>
                </div>
            </div>

            {/* Stock Items Grid */}
            {loading ? (
                <div className="flex justify-center py-20">
                    <Loader2 className="animate-spin text-primary" size={32} />
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredItems.map(item => {
                        const status = getStockStatus(item);
                        return (
                            <div
                                key={item.id}
                                className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 hover:shadow-md transition-all"
                            >
                                <div className="flex justify-between items-start mb-3">
                                    <div className="flex-1 min-w-0">
                                        <h3 className="font-bold text-slate-800 truncate">{item.name}</h3>
                                        <p className="text-xs text-slate-400">{item.category}</p>
                                    </div>
                                    <span className={cn("px-2 py-1 rounded-lg text-[10px] font-bold uppercase", status.color)}>
                                        {status.label}
                                    </span>
                                </div>

                                <div className="flex items-end justify-between">
                                    <div>
                                        <p className="text-3xl font-black text-slate-800">
                                            {item.quantity}
                                            <span className="text-sm font-medium text-slate-400 ml-1">{item.unit}</span>
                                        </p>
                                        <p className="text-xs text-slate-400 mt-1">
                                            ต้นทุน: {formatCurrency(item.cost_per_unit)}/{item.unit}
                                        </p>
                                    </div>

                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => openEditModal(item)}
                                            className="p-2 bg-slate-100 rounded-lg text-slate-500 hover:bg-slate-200 transition-colors"
                                        >
                                            <Edit2 size={16} />
                                        </button>
                                        <button
                                            onClick={() => handleDelete(item.id)}
                                            className="p-2 bg-red-50 rounded-lg text-red-500 hover:bg-red-100 transition-colors"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </div>

                                {item.quantity <= item.min_quantity && item.quantity > 0 && (
                                    <div className="mt-3 p-2 bg-amber-50 rounded-lg flex items-center gap-2 text-amber-600 text-xs">
                                        <AlertTriangle size={14} />
                                        <span>สต็อกต่ำกว่า {item.min_quantity} {item.unit}</span>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {filteredItems.length === 0 && !loading && (
                <div className="text-center py-20 text-slate-400">
                    <Package size={48} className="mx-auto mb-4 opacity-50" />
                    <p>ไม่พบรายการสินค้า</p>
                </div>
            )}

            {/* Add/Edit Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-white rounded-3xl w-full max-w-md p-6 shadow-2xl animate-in zoom-in-95">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-bold text-slate-800">
                                {editingItem ? 'แก้ไขสินค้า' : 'เพิ่มสินค้าใหม่'}
                            </h3>
                            <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                                <X size={24} />
                            </button>
                        </div>

                        <div className="space-y-4">
                            {/* Name */}
                            <div>
                                <label className="text-xs font-bold text-slate-400 uppercase">ชื่อสินค้า</label>
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 mt-1 focus:ring-2 focus:ring-primary/30 outline-none"
                                    placeholder="เช่น สีเจล OPI #01"
                                />
                            </div>

                            {/* Quantity & Unit */}
                            <div className="flex gap-3">
                                <div className="flex-1">
                                    <label className="text-xs font-bold text-slate-400 uppercase">จำนวน</label>
                                    <input
                                        type="number"
                                        value={formData.quantity}
                                        onChange={(e) => setFormData({ ...formData, quantity: Number(e.target.value) })}
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 mt-1 focus:ring-2 focus:ring-primary/30 outline-none"
                                    />
                                </div>
                                <div className="w-24">
                                    <label className="text-xs font-bold text-slate-400 uppercase">หน่วย</label>
                                    <select
                                        value={formData.unit}
                                        onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 mt-1 focus:ring-2 focus:ring-primary/30 outline-none"
                                    >
                                        <option value="ชิ้น">ชิ้น</option>
                                        <option value="ขวด">ขวด</option>
                                        <option value="กระปุก">กระปุก</option>
                                        <option value="ถุง">ถุง</option>
                                        <option value="แผ่น">แผ่น</option>
                                        <option value="กล่อง">กล่อง</option>
                                    </select>
                                </div>
                            </div>

                            {/* Min Quantity & Cost */}
                            <div className="flex gap-3">
                                <div className="flex-1">
                                    <label className="text-xs font-bold text-slate-400 uppercase">แจ้งเตือนเมื่อต่ำกว่า</label>
                                    <input
                                        type="number"
                                        value={formData.min_quantity}
                                        onChange={(e) => setFormData({ ...formData, min_quantity: Number(e.target.value) })}
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 mt-1 focus:ring-2 focus:ring-primary/30 outline-none"
                                    />
                                </div>
                                <div className="flex-1">
                                    <label className="text-xs font-bold text-slate-400 uppercase">ต้นทุน/หน่วย (฿)</label>
                                    <input
                                        type="number"
                                        value={formData.cost_per_unit}
                                        onChange={(e) => setFormData({ ...formData, cost_per_unit: Number(e.target.value) })}
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 mt-1 focus:ring-2 focus:ring-primary/30 outline-none"
                                    />
                                </div>
                            </div>

                            {/* Category */}
                            <div>
                                <label className="text-xs font-bold text-slate-400 uppercase">หมวดหมู่</label>
                                <select
                                    value={formData.category}
                                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 mt-1 focus:ring-2 focus:ring-primary/30 outline-none"
                                >
                                    {STOCK_CATEGORIES.filter(c => c !== 'ทั้งหมด').map(cat => (
                                        <option key={cat} value={cat}>{cat}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {/* Buttons */}
                        <div className="flex gap-3 mt-6">
                            <button
                                onClick={() => setIsModalOpen(false)}
                                className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200 transition-colors"
                            >
                                ยกเลิก
                            </button>
                            <button
                                onClick={handleSubmit}
                                className="flex-1 py-3 bg-primary text-white rounded-xl font-bold shadow-lg shadow-primary/20 hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
                            >
                                <Check size={18} />
                                บันทึก
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
