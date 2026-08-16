'use client';

import React from 'react';
import Image from 'next/image';
import { ChevronLeft, ChevronRight, LogOut, Menu, X } from 'lucide-react';
import ThemeToggle from '../ThemeToggle';
import LanguageSwitcher from '../LanguageSwitcher';
import './AppLayout.css';

function SidebarItems({ items, activeItem, onNavigate, className }) {
    return (
        <nav className={className} aria-label="Main navigation">
            {items.map((item) => {
                const Icon = item.icon;
                const isActive = activeItem === item.id;

                return (
                    <button
                        key={item.id}
                        type="button"
                        className={`app-sidebar__item ${isActive ? 'active' : ''}`}
                        onClick={() => onNavigate(item.id)}
                        title={item.label}
                        aria-current={isActive ? 'page' : undefined}
                    >
                        {Icon && <Icon size={19} strokeWidth={1.9} />}
                        <span>{item.label}</span>
                    </button>
                );
            })}
        </nav>
    );
}

function SidebarUserSummary({ displayName, primaryRole, avatarLabel, loading, t, onLogout }) {
    return (
        <div className="app-sidebar__user">
            <div className="avatar">{avatarLabel}</div>
            <div className="app-sidebar__user-info">
                <strong>{loading ? t('loading') : displayName}</strong>
                <span>{primaryRole}</span>
            </div>
            {onLogout && (
                <button
                    type="button"
                    className="app-sidebar__logout"
                    onClick={onLogout}
                    aria-label={t('logout')}
                    title={t('logout')}
                >
                    <LogOut size={17} />
                    <span>{t('logout')}</span>
                </button>
            )}
        </div>
    );
}

export function AppSidebar({
    items,
    activeItem,
    onNavigate,
    collapsed,
    onToggleCollapsed,
    displayName,
    primaryRole,
    avatarLabel,
    loading,
    onLogout,
    t,
}) {
    return (
        <aside className={`app-sidebar ${collapsed ? 'app-sidebar--collapsed' : ''}`} aria-label="Application sidebar">
            <div className="app-sidebar__header">
                <div className="app-sidebar__brand">
                    <Image
                        src="/images/Logo.png"
                        alt="KKU Competency"
                        width={38}
                        height={38}
                        className="app-sidebar__logo"
                        priority
                    />
                    <span>KKU Competency</span>
                </div>
                <button
                    type="button"
                    className="app-sidebar__collapse"
                    onClick={onToggleCollapsed}
                    aria-label={collapsed ? 'Expand navigation' : 'Collapse navigation'}
                    title={collapsed ? 'Expand navigation' : 'Collapse navigation'}
                >
                    {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
                </button>
            </div>

            <p className="app-sidebar__section-label">{t('menu_management') || 'Management'}</p>
            <SidebarItems
                items={items}
                activeItem={activeItem}
                onNavigate={onNavigate}
                className="app-sidebar__items"
            />

            <div className="app-sidebar__footer">
                <div className="app-sidebar__quick-controls">
                    <ThemeToggle />
                    <LanguageSwitcher />
                </div>
                <SidebarUserSummary
                    displayName={displayName}
                    primaryRole={primaryRole}
                    avatarLabel={avatarLabel}
                    loading={loading}
                    onLogout={onLogout}
                    t={t}
                />
            </div>
        </aside>
    );
}

export function AppSidebarMobileShell({
    items,
    activeItem,
    onNavigate,
    isOpen,
    onOpen,
    onClose,
    displayName,
    primaryRole,
    avatarLabel,
    loading,
    onLogout,
    t,
}) {
    return (
        <>
            <div className="app-sidebar-mobile-bar">
                <button
                    type="button"
                    className="app-sidebar-mobile-bar__menu"
                    onClick={onOpen}
                    aria-label="Open navigation"
                >
                    <Menu size={21} />
                </button>
                <div className="app-sidebar-mobile-bar__brand">KKU Competency</div>
                <div className="app-sidebar-mobile-bar__controls">
                    <ThemeToggle />
                    <LanguageSwitcher />
                    <button
                        type="button"
                        className="app-sidebar-mobile-bar__avatar"
                        onClick={onOpen}
                        aria-label="Open account navigation"
                    >
                        {avatarLabel}
                    </button>
                </div>
            </div>

            {isOpen && (
                <div className="app-sidebar-shell-mobile-overlay" onClick={onClose}>
                    <aside className="app-sidebar-shell-mobile-drawer" onClick={(event) => event.stopPropagation()} aria-label="Mobile navigation">
                        <div className="app-sidebar-shell-mobile-drawer__header">
                            <div className="app-sidebar__brand">
                                <Image
                                    src="/images/Logo.png"
                                    alt="KKU Competency"
                                    width={30}
                                    height={30}
                                    className="app-sidebar__logo"
                                />
                                <span>KKU Competency</span>
                            </div>
                            <button
                                type="button"
                                className="app-sidebar-shell-mobile-drawer__close"
                                onClick={onClose}
                                aria-label="Close navigation"
                            >
                                <X size={20} />
                            </button>
                        </div>
                        <p className="app-sidebar__section-label">{t('menu_management') || 'Management'}</p>
                        <SidebarItems
                            items={items}
                            activeItem={activeItem}
                            onNavigate={(page) => {
                                onNavigate(page);
                                onClose();
                            }}
                            className="app-sidebar-shell-mobile-drawer__items"
                        />
                        <div className="app-sidebar-shell-mobile-drawer__footer">
                            <div className="app-sidebar-shell-mobile-drawer__quick-controls">
                                <ThemeToggle />
                                <LanguageSwitcher />
                            </div>
                            <SidebarUserSummary
                                displayName={displayName}
                                primaryRole={primaryRole}
                                avatarLabel={avatarLabel}
                                loading={loading}
                                onLogout={() => {
                                    onClose();
                                    onLogout?.();
                                }}
                                t={t}
                            />
                        </div>
                    </aside>
                </div>
            )}
        </>
    );
}

export function AppSidebarMobile({ items, activeItem, onNavigate, isOpen, onClose, user, loading, displayName, primaryRole, avatarLabel, onLogout, t }) {
    if (!isOpen) return null;

    return (
        <div className="app-sidebar-mobile-overlay" onClick={onClose}>
            <div className="app-sidebar-mobile-drawer" onClick={(event) => event.stopPropagation()}>
                <div className="app-sidebar-mobile-header">
                    <Image
                        src="/images/Logo.png"
                        alt="KKU Competency"
                        width={28}
                        height={28}
                        className="logo-img"
                    />
                    <span>KKU Competency</span>
                    <button type="button" className="app-sidebar-mobile-close" onClick={onClose}>
                        <X size={20} />
                    </button>
                </div>
                <div className="app-sidebar-mobile-items">
                    {items.map((item) => (
                        <button
                            key={item.id}
                            type="button"
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
                            type="button"
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
