"use client";
import { useState } from "react";
import Sidebar from "@/components/Sidebar";
import { Menu } from "lucide-react";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-[#F8F9FA]">
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
      
      {/* Main Content Area */}
      <main className="flex-1 md:ml-64 transition-all duration-300 w-full">
        {/* Mobile Header (แสดงเฉพาะมือถือ) */}
        <header className="md:hidden h-16 bg-white border-b border-slate-100 flex items-center px-4 sticky top-0 z-30 justify-between">
           <div className="flex items-center gap-3">
             <button onClick={() => setIsSidebarOpen(true)} className="text-slate-600 hover:text-primary">
                <Menu size={24} />
             </button>
             <span className="font-bold text-primary">Fairymate</span>
           </div>
        </header>

        {/* Page Content */}
        <div className="p-4 md:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}