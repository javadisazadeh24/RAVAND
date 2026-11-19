import type { Metadata } from 'next';
import { Vazirmatn } from 'next/font/google';
import './globals.css';

const font = Vazirmatn({ subsets: ['arabic', 'latin'], variable: '--font-vazir', display: 'swap' });
export const metadata: Metadata = { title: 'راوند — سیستم مدیریت', icons: { icon: '/logo.png' } };

export default function Root({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fa" dir="rtl" className={font.variable}>
      <body style={{ fontFamily: 'var(--font-vazir), Tahoma, sans-serif' }}>{children}</body>
    </html>
  );
}
