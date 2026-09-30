'use client';

import React, { useRef } from 'react';
import Image from 'next/image';
import { ChevronLeft, ChevronRight, LogOut, Menu, X } from 'lucide-react';
import { Dialog, Tooltip } from 'radix-ui';
import ThemeToggle from '../ThemeToggle';
import LanguageSwitcher from '../LanguageSwitcher';
import { resolveActiveSidebarItem } from '../../lib/sidebar-navigation.mjs';
import './AppLayout.css';

// AppLayout mounts one mobile drawer; keep its control ID stable across hydration.
const MOBILE_SIDEBAR_DIALOG_ID = 'app-sidebar-mobile-dialog';

function SidebarItems({
    items,
    activeItem,
    onNavigate,
    className,
    collapsed = false,
    showTooltips = false,
}) {
    return (
        <div className={className}>
            {items.map((item) => {
                const Icon = item.icon;
                const isActive = activeItem === item.id;
                const menuItem = (
                    <button
                        key={item.id}
                        type="button"
                        className={`app-sidebar__item ${isActive ? 'active' : ''}`}
                        onClick={() => onNavigate(item.id)}
                        title={showTooltips ? undefined : item.label}
                        aria-label={collapsed ? item.label : undefined}
                        aria-current={isActive ? 'page' : undefined}
                    >
                        {Icon && <Icon size={20} strokeWidth={1.9} />}
                        <span>{item.label}</span>
                    </button>
                );

                if (!showTooltips) return menuItem;

                return (
                    <Tooltip.Root key={item.id}>
                        <Tooltip.Trigger asChild>{menuItem}</Tooltip.Trigger>
                        <Tooltip.Portal>
                            <Tooltip.Content
                                className="app-sidebar__tooltip"
                                side="right"
                                sideOffset={8}
                                collisionPadding={8}
                            >
                                {item.label}
                                <Tooltip.Arrow className="app-sidebar__tooltip-arrow" />
                            </Tooltip.Content>
                        </Tooltip.Portal>
                    </Tooltip.Root>
                );
            })}
        </div>
    );
}

function SidebarGroups({ groups, activeItem, onNavigate, collapsed, t }) {
    return (
        <Tooltip.Provider delayDuration={300}>
            <nav className="app-sidebar__groups" aria-label={t('sidebar_navigation')}>
                {groups.map((group) => (
                    <section className="app-sidebar__group" key={group.id}>
                        <h2 className="app-sidebar__group-title">{group.label}</h2>
                        <SidebarItems
                            items={group.items}
                            activeItem={activeItem}
                            onNavigate={onNavigate}
                            className="app-sidebar__items"
                            collapsed={collapsed}
                            showTooltips={collapsed}
                        />
                    </section>
                ))}
            </nav>
        </Tooltip.Provider>
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
    groups,
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
    const selectedActiveItem = resolveActiveSidebarItem(items, activeItem);

    return (
        <aside className={`app-sidebar ${groups?.length ? 'app-sidebar--grouped' : ''} ${collapsed ? 'app-sidebar--collapsed' : ''}`} aria-label={t('sidebar_navigation')}>
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
                    aria-label={collapsed ? t('sidebar_expand') : t('sidebar_collapse')}
                    title={collapsed ? t('sidebar_expand') : t('sidebar_collapse')}
                >
                    {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
                </button>
            </div>

            {groups?.length ? (
                <SidebarGroups
                    groups={groups}
                    activeItem={selectedActiveItem}
                    onNavigate={onNavigate}
                    collapsed={collapsed}
                    t={t}
                />
            ) : (
                <>
                    <p className="app-sidebar__section-label">{t('menu_management') || 'Management'}</p>
                    <nav aria-label={t('sidebar_navigation')}>
                        <SidebarItems
                            items={items}
                            activeItem={selectedActiveItem}
                            onNavigate={onNavigate}
                            className="app-sidebar__items"
                        />
                    </nav>
                </>
            )}

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

export function AppSidebarSkeleton({ collapsed, t }) {
    const placeholderRows = [0, 1, 2, 3];

    return (
        <aside
            className={`app-sidebar app-sidebar--grouped app-sidebar--skeleton ${collapsed ? 'app-sidebar--collapsed' : ''}`}
            aria-label={t('sidebar_navigation')}
            aria-busy="true"
        >
            <div className="app-sidebar__header" aria-hidden="true">
                <div className="app-sidebar__brand">
                    <div className="app-sidebar-skeleton__logo" />
                    <span className="app-sidebar-skeleton__brand-line" />
                </div>
                <span className="app-sidebar-skeleton__control" />
            </div>

            <div className="app-sidebar-skeleton__nav" aria-hidden="true">
                <span className="app-sidebar-skeleton__section-line" />
                {placeholderRows.map((row) => (
                    <div className="app-sidebar-skeleton__row" key={row}>
                        <span className="app-sidebar-skeleton__icon" />
                        <span className={`app-sidebar-skeleton__item-line app-sidebar-skeleton__item-line--${row % 3}`} />
                    </div>
                ))}
            </div>

            <div className="app-sidebar__footer" aria-hidden="true">
                <div className="app-sidebar-skeleton__controls">
                    <span className="app-sidebar-skeleton__control app-sidebar-skeleton__control--wide" />
                    <span className="app-sidebar-skeleton__control app-sidebar-skeleton__control--language" />
                </div>
                <div className="app-sidebar-skeleton__user">
                    <span className="app-sidebar-skeleton__avatar" />
                    <span className="app-sidebar-skeleton__user-lines">
                        <span />
                        <span />
                    </span>
                    <span className="app-sidebar-skeleton__logout" />
                </div>
            </div>
        </aside>
    );
}

export function AppSidebarMobileSkeleton({ t }) {
    return (
        <div
            className="app-sidebar-mobile-bar app-sidebar-mobile-bar--skeleton"
            role="status"
            aria-label={t('loading')}
            aria-busy="true"
        >
            <span className="app-sidebar-skeleton__mobile-menu" aria-hidden="true" />
            <span className="app-sidebar-mobile-bar__brand" aria-hidden="true">
                <span className="app-sidebar-skeleton__mobile-brand" />
            </span>
            <span className="app-sidebar-mobile-bar__controls" aria-hidden="true">
                <span className="app-sidebar-skeleton__control app-sidebar-skeleton__control--wide" />
                <span className="app-sidebar-skeleton__control app-sidebar-skeleton__control--language" />
                <span className="app-sidebar-skeleton__avatar" />
            </span>
        </div>
    );
}

export function AppSidebarMobileShell({
    items,
    groups,
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
    const lastTriggerRef = useRef(null);
    const selectedActiveItem = resolveActiveSidebarItem(items, activeItem);

    const handleNavigate = (page) => {
        onNavigate(page);
        onClose();
    };

    const handleLogout = () => {
        onLogout?.();
        onClose();
    };

    return (
        <Dialog.Root
            open={isOpen}
            onOpenChange={(open) => (open ? onOpen() : onClose())}
        >
            <>
                <div className="app-sidebar-mobile-bar">
                    <Dialog.Trigger asChild aria-controls={MOBILE_SIDEBAR_DIALOG_ID}>
                        <button
                            type="button"
                            className="app-sidebar-mobile-bar__menu"
                            aria-label={t('sidebar_open')}
                            onClick={(event) => {
                                lastTriggerRef.current = event.currentTarget;
                            }}
                        >
                            <Menu size={21} />
                        </button>
                    </Dialog.Trigger>
                    <div className="app-sidebar-mobile-bar__brand">KKU Competency</div>
                    <div className="app-sidebar-mobile-bar__controls">
                        <ThemeToggle />
                        <LanguageSwitcher />
                        <Dialog.Trigger asChild aria-controls={MOBILE_SIDEBAR_DIALOG_ID}>
                            <button
                                type="button"
                                className="app-sidebar-mobile-bar__avatar"
                                aria-label={t('sidebar_open_account')}
                                onClick={(event) => {
                                    lastTriggerRef.current = event.currentTarget;
                                }}
                            >
                                {avatarLabel}
                            </button>
                        </Dialog.Trigger>
                    </div>
                </div>

                {isOpen && (
                    <Dialog.Portal>
                        <Dialog.Overlay className="app-sidebar-shell-mobile-overlay" />
                        <Dialog.Content
                            id={MOBILE_SIDEBAR_DIALOG_ID}
                            className={`app-sidebar-shell-mobile-drawer ${groups?.length ? 'app-sidebar--grouped' : ''}`}
                            onCloseAutoFocus={(event) => {
                                event.preventDefault();
                                lastTriggerRef.current?.focus();
                            }}
                        >
                            <Dialog.Title className="app-sidebar__sr-only">
                                {t('sidebar_navigation')}
                            </Dialog.Title>
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
                                <Dialog.Close asChild>
                                    <button
                                        type="button"
                                        className="app-sidebar-shell-mobile-drawer__close"
                                        aria-label={t('sidebar_close')}
                                    >
                                        <X size={20} />
                                    </button>
                                </Dialog.Close>
                            </div>
                            {groups?.length ? (
                                <SidebarGroups
                                    groups={groups}
                                    activeItem={selectedActiveItem}
                                    onNavigate={handleNavigate}
                                    t={t}
                                />
                            ) : (
                                <>
                                    <p className="app-sidebar__section-label">
                                        {t('menu_management') || 'Management'}
                                    </p>
                                    <nav aria-label={t('sidebar_navigation')}>
                                        <SidebarItems
                                            items={items}
                                            activeItem={selectedActiveItem}
                                            onNavigate={handleNavigate}
                                            className="app-sidebar-shell-mobile-drawer__items"
                                        />
                                    </nav>
                                </>
                            )}
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
                                    onLogout={handleLogout}
                                    t={t}
                                />
                            </div>
                        </Dialog.Content>
                    </Dialog.Portal>
                )}
            </>
        </Dialog.Root>
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
