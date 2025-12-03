"use client";
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, CalendarClock, Receipt, User, X } from 'lucide-react';
import { cn } from '@/lib/utils';

const menuItems = [
  { href: '/admin/dashboard', label: 'แดชบอร์ด', icon: LayoutDashboard },
  { href: '/admin/queues', label: 'หน้าจัดการคิว', icon: CalendarClock },
  { href: '/admin/receipts', label: 'ใบเสร็จย้อนหลัง', icon: Receipt },
];

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const pathname = usePathname();

  return (
    <>
      {/* Mobile Overlay (พื้นหลังสีดำจาง ๆ เวลากดเมนูในมือถือ) */}
      <div 
        className={cn(
            "fixed inset-0 bg-black/50 z-40 md:hidden transition-opacity duration-200",
            isOpen ? "opacity-100 visible" : "opacity-0 invisible"
        )}
        onClick={onClose}
      />

      {/* Sidebar Content */}
      <aside className={cn(
        "fixed left-0 top-0 z-50 h-screen w-64 bg-white border-r border-slate-100 flex flex-col transition-transform duration-300 ease-in-out md:translate-x-0",
        isOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="p-6 flex flex-col items-center gap-4 border-b border-slate-50 relative">
          {/* Close Button (Mobile Only) */}
          <button onClick={onClose} className="absolute right-4 top-4 text-slate-400 md:hidden">
            <X size={24} />
          </button>

          {/* Logo Section */}
          <div className="relative w-24 h-24 rounded-full overflow-hidden border-2 border-primary/20 shadow-md">
              <Image 
                  src="/logo.jpg" 
                  alt="Fairymate Logo" 
                  fill 
                  className="object-cover"
              />
          </div>
          <h1 className="text-xl font-bold text-primary tracking-tight">Fairymate.Nail</h1>
        </div>

        <nav className="flex-1 px-4 space-y-2 mt-6 overflow-y-auto">
          {menuItems.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose} // ปิดเมนูเมื่อกดเลือก (ในมือถือ)
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-2xl transition-all duration-200",
                  isActive 
                    ? "bg-primary/10 text-primary font-medium" 
                    : "text-slate-500 hover:bg-slate-50 hover:text-slate-700"
                )}
              >
                <Icon size={20} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-100">
          <Link href="/booking" target="_blank" className="flex items-center gap-3 px-4 py-3 rounded-2xl text-slate-500 hover:bg-slate-50 transition-colors">
              <User size={20} />
              <span className="text-sm">หน้าลูกค้าดูคิว</span>
          </Link>
        </div>
      </aside>
    </>
  );
}