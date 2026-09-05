import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Orion 360 · Ramky One Orion Buyer Digital Twin',
  description: 'Explore your tower, floor, apartment, rooms, construction progress and interior estimate.',
};

export const viewport: Viewport = {
  themeColor: '#0A0A0A',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="bg-ink">
      <body className="bg-ink text-white antialiased">{children}</body>
    </html>
  );
}
