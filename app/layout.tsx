import type { Metadata } from "next";
import { Prompt } from "next/font/google";
import "./globals.css";

// FONT
const prompt = Prompt({
  subsets: ["latin", "thai"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-prompt",
});

export const metadata: Metadata = {
  title: "Fairymate Nail",
  description: "Queue Management System",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        {/* ⭐ สำคัญมาก: แก้ปัญหาหน้าเว็บกว้างเกินจอมือถือทั้งหมด */}
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>

      <body
        className={`
          ${prompt.variable} font-sans 
          bg-[#F8F9FA] text-slate-800 antialiased
          min-h-screen w-full 
          overflow-x-hidden  /* ⭐ ป้องกันเว็บล้นด้านข้าง */
        `}
      >
        {/* ⭐ กันเนื้อหาไม่ให้กว้างผิดปกติบนมือถือ */}
        <div className="w-full max-w-full mx-auto">
          {children}
        </div>
      </body>
    </html>
  );
}
