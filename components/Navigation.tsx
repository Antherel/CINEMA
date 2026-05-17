'use client';

import React from 'react';
import Link from 'next/link';
import {usePathname} from 'next/navigation';
import {useAuth} from '@/app/lib/AuthProvider';

/**
 * Navigation component with 3 main sections
 */
export default function Navigation() {
  const pathname = usePathname();
  const {user, logout} = useAuth();

  const handleLogout = async () => {
    try {
      await logout();
    } catch (err) {
      console.error('Logout failed:', err);
    }
  };

  const navItems = [
    {href: '/create-imagen', label: 'Crear una imagen', icon: '🖼️'},
    {href: '/create-batch', label: 'Crear lote', icon: '📸'},
    {href: '/view-projects', label: 'Ver proyectos', icon: '📁'},
  ];

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/');

  return (
    <nav
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '1rem',
        background: '#f8f8f8',
        borderBottom: '1px solid #ddd',
        marginBottom: '2rem',
      }}
    >
      <div style={{display: 'flex', gap: '0.5rem', flex: 1}}>
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            style={{
              padding: '0.75rem 1rem',
              textDecoration: 'none',
              color: isActive(item.href) ? '#667eea' : '#666',
              borderBottom: isActive(item.href) ? '3px solid #667eea' : 'none',
              fontWeight: isActive(item.href) ? '600' : '400',
              transition: 'all 0.2s',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            <span>{item.icon}</span>
            <span>{item.label}</span>
          </Link>
        ))}
      </div>

      <div style={{display: 'flex', alignItems: 'center', gap: '1rem'}}>
        <span style={{fontSize: '0.875rem', color: '#666'}}>
          {user?.email}
        </span>
        <button
          onClick={handleLogout}
          className="button buttonSecondary buttonSmall"
          style={{padding: '0.5rem 1rem'}}
        >
          Cerrar sesión
        </button>
      </div>
    </nav>
  );
}
