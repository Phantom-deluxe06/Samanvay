import type { Metadata } from 'next';
import localFont from 'next/font/local';
import { Providers } from '@/components/shell/Providers';
import './globals.css';

// Inter bundled from @fontsource-variable/inter so the app works offline after npm install.
const inter = localFont({ src: '../../node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2', variable: '--font-inter', weight: '100 900', display: 'swap' });

export const metadata: Metadata = {
  title: 'Samanvay · AICTE Complaint Monitoring',
  description: 'AI-assisted single-window dashboard to monitor complaint cases across AICTE Bureaus and Cells. Prototype with synthetic data (SIH 2026 PS 26264).',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="font-sans">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
