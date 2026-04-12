'use client';

import React from 'react';
import Image from 'next/image';
import { X, LogOut } from 'lucide-react';
import './AppLayout.css';

export function AppSidebarMobile({ items, activeItem, onNavigate, isOpen, onClose, user, loading, displayName, primaryRole, avatarLabel, onLogout, t }) {
    if (!isOpen) return null;

    return (
        <div className="app-sidebar-mobile-overlay" onClick={onClose}>
            <div className="app-sidebar-mobile-drawer" onClick={e => e.stopPropagation()}>
                <div className="app-sidebar-mobile-header">
                    <Image
                        src="/images/Logo.png"
                        alt="KKU Competency"
                        width={28}
                        height={28}
                        className="logo-img"
                    />
                    <span>KKU Competency</span>
                    <button className="app-sidebar-mobile-close" onClick={onClose}>
                        <X size={20} />
                    </button>
                </div>
                <div className="app-sidebar-mobile-items">
                    {items.map((item) => (
                        <button
                            key={item.id}
                            className={`app-sidebar-mobile-item ${activeItem === item.id ? 'active' : ''}`}
                            onClick={() => { onNavigate(item.id); onClose(); }}
                        >
                            {item.icon && <item.icon size={20} />}
                            <span>{item.label}</span>
                        </button>
                    ))}
                </div>
                <div className="app-sidebar-mobile-user">
                    <div className="avatar">{avatarLabel}</div>
                    <div className="app-sidebar-mobile-user-info">
                        <span className="app-sidebar-mobile-user-name">
                            {loading ? t('loading') : displayName}
                        </span>
                        <span className="app-sidebar-mobile-user-role">Role: {primaryRole}</span>
                    </div>
                </div>
                {user && (
                    <div className="app-sidebar-mobile-logout">
                        <button
                            className="app-sidebar-mobile-logout-btn"
                            onClick={() => { onLogout?.(); onClose(); }}
                        >
                            <LogOut size={16} />
                            <span>{t('logout')}</span>
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}