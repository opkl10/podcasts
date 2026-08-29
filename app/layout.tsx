import type { Metadata } from "next";
import "./globals.css";
import Link from "next/link";
import { Mic, Radio, ListMusic, PlusCircle, Sparkles } from "lucide-react";

export const metadata: Metadata = {
  title: "CastFlow Studio | מערכת ניהול, מחקר ואולפן פודקאסטים",
  description: "אולפן הקלטת פודקאסטים מתקדם, כלי מחקר ואג'נדה לפי פרק, תמיכה במצלמות אייפון ושעון הקלטה חי.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="he" dir="rtl" className="dark" suppressHydrationWarning>
      <body className="min-h-screen bg-[#0b0d11] text-slate-100 font-sans antialiased selection:bg-indigo-500 selection:text-white flex flex-col" suppressHydrationWarning>
        {/* Top Studio Navbar */}
        <header className="sticky top-0 z-40 w-full border-b border-slate-800/80 bg-[#0e1117]/90 backdrop-blur-md">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
            {/* Logo and Brand */}
            <div className="flex items-center gap-3">
              <Link href="/" className="flex items-center gap-2.5 group">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-purple-600 to-pink-500 p-0.5 shadow-lg shadow-indigo-500/20 group-hover:scale-105 transition-transform duration-200">
                  <div className="w-full h-full bg-[#0e1117] rounded-[10px] flex items-center justify-center">
                    <Mic className="w-5 h-5 text-indigo-400 group-hover:text-pink-400 transition-colors" />
                  </div>
                </div>
                <div className="flex flex-col">
                  <div className="flex items-center gap-1.5">
                    <span className="font-extrabold text-lg tracking-tight bg-gradient-to-r from-white via-slate-200 to-indigo-200 bg-clip-text text-transparent">
                      CastFlow
                    </span>
                    <span className="text-[10px] font-semibold uppercase tracking-wider bg-indigo-500/20 text-indigo-400 px-1.5 py-0.5 rounded border border-indigo-500/30">
                      Studio
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-400 font-medium">
                    ניהול, מחקר ואולפן הקלטות
                  </span>
                </div>
              </Link>
            </div>

            {/* Navigation links */}
            <nav className="hidden md:flex items-center gap-1">
              <Link
                href="/"
                className="flex items-center gap-2 px-3.5 py-2 text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-800/60 rounded-lg transition-colors"
              >
                <ListMusic className="w-4 h-4 text-indigo-400" />
                כל הפרקים
              </Link>
            </nav>

            {/* Actions */}
            <div className="flex items-center gap-3">
              <Link
                href="/episodes/new"
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 rounded-lg shadow-md shadow-indigo-600/20 hover:shadow-indigo-600/30 active:scale-95 transition-all duration-200"
              >
                <PlusCircle className="w-4 h-4" />
                <span>פרק חדש</span>
              </Link>
            </div>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {children}
        </main>

        {/* Minimal Footer */}
        <footer className="border-t border-slate-800/60 bg-[#090b0e] py-6 text-center text-xs text-slate-500">
          <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
              <span>CastFlow Studio • הקלטת וידאו ואודיו HD • תמיכה במצלמות iPhone</span>
            </div>
            <p>שמירה מקומית מאובטחת • ללא הגבלת זמן הקלטה</p>
          </div>
        </footer>
      </body>
    </html>
  );
}
