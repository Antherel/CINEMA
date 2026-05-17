import type {ReactNode} from 'react';
import './globals.css';

export const metadata = {
  title: 'VideoClip Batch Studio',
  description: 'Generador local de lotes de imagenes con Gemini y Next.js.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}