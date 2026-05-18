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
    <nav className="appNav">
      <div className="appNavLinks">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`appNavLink ${isActive(item.href) ? 'appNavLinkActive' : ''}`}
          >
            <span>{item.icon}</span>
            <span>{item.label}</span>
          </Link>
        ))}
      </div>

      <div className="appNavUser">
        <span className="appNavEmail">
          {user?.email}
        </span>
        <button
          onClick={handleLogout}
          className="button buttonSecondary buttonSmall appNavLogout"
        >
          Cerrar sesión
        </button>
      </div>
    </nav>
  );
}
