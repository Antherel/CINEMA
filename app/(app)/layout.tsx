import React, {ReactNode} from 'react';
import Navigation from '@/components/Navigation';

/**
 * Shared layout for authenticated app pages
 * Includes persistent navigation menu
 */
export default function AppLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div>
      <Navigation />
      {children}
    </div>
  );
}
