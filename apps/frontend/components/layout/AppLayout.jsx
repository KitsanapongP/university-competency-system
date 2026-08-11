'use client';

import React, { useState, useSyncExternalStore } from 'react';
import Image from 'next/image';
import { Menu, LayoutDashboard, User, ClipboardCheck, BookOpen, GraduationCap, Users, Settings, ShieldCheck, CalendarClock } from 'lucide-react';
import { useLanguage } from '../../providers/LanguageContext';
import { useTheme } from '../../providers/theme-provider';
import ClickSpark from '../ClickSpark';
import ColorBends from '../ColorBends';
import ThemeToggle from '../ThemeToggle';
import LanguageSwitcher from '../LanguageSwitcher';
import { DARK_BACKGROUND_COLORS, LIGHT_BACKGROUND_COLORS } from '../../config/theme';
import { AppSidebarMobile } from './AppSidebar';
import './AppLayout.css';

function subscribeToClient(callback) {
    const frame = requestAnimationFrame(callback);
    return () => cancelAnimationFrame(frame);
}

function getClientSnapshot() {
    return true;
}

function getServerSnapshot() {
    return false;
}

const MENU_CONFIG = {
    user: [
        { id: 'dashboard', icon: LayoutDashboard, labelKey: 'dashboard' },
        { id: 'profile', icon: User, labelKey: 'profile' },
        { id: 'verify', icon: ClipboardCheck, labelKey: 'verify' },
    ],
    officer: [
        { id: 'curriculum-management', icon: BookOpen, labelKey: 'curriculum_management' },
        { id: 'major-management', icon: GraduationCap, labelKey: 'major_management' },
        { id: 'student-management', icon: Users, labelKey: 'student_management' },
        { id: 'competency-management', icon: ShieldCheck, labelKey: 'competency_management' },
        { id: 'activity-management', icon: CalendarClock, labelKey: 'activity_management' },
        { id: 'template-management', icon: BookOpen, labelKey: 'templates' },
    ],
    admin: [
        { id: 'dashboard', icon: LayoutDashboard, labelKey: 'dashboard' },
        { id: 'major-management', icon: GraduationCap, labelKey: 'major_management' },
        { id: 'student-management', icon: Users, labelKey: 'student_management' },
        { id: 'competency-management', icon: ShieldCheck, labelKey: 'competency_management' },
        { id: 'activity-management', icon: CalendarClock, labelKey: 'activity_management' },
        { id: 'users', icon: Users, labelKey: 'users' },
        { id: 'settings', icon: Settings, labelKey: 'settings' },
    ],
    lecturer: [
        { id: 'my-activity-sessions', icon: CalendarClock, label: 'รอบกิจกรรมของฉัน' },
    ],
};

function resolveMenuItems(config, t) {
    return config.map(item => ({
        ...item,
        label: item.label || t(item.labelKey),
    }));
}

export function AppLayout({ 
    children, 
    user, 
    loading, 
    onLogout, 
    activePage, 
    onNavigate,
    role = 'user',
    showBackground = true,
}) {
    const { t } = useLanguage();
    const { resolvedTheme } = useTheme();
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [userMenuOpen, setUserMenuOpen] = useState(false);
    const mounted = useSyncExternalStore(subscribeToClient, getClientSnapshot, getServerSnapshot);

    const isDark = mounted && resolvedTheme === 'dark';
    const blendColors = isDark ? DARK_BACKGROUND_COLORS : LIGHT_BACKGROUND_COLORS;

    const menuConfig = MENU_CONFIG[role] || MENU_CONFIG.user;
    const menuItems = resolveMenuItems(menuConfig, t);

    const displayName = user?.display_name || user?.username || 'Guest';
    const primaryRole = user?.roles?.[0] || '';
    const avatarLabel = displayName.split(' ').filter(Boolean).slice(0, 2).map(p => p[0]?.toUpperCase()).join('') || 'U';

    const handleNavigate = (page) => {
        onNavigate?.(page);
        setMobileMenuOpen(false);
    };

    return (
        <ClickSpark sparkColor="#2563eb" sparkSize={10} sparkRadius={15} sparkCount={8} duration={400}>
            <>
                {showBackground && mounted && (
                    <ColorBends
                        className="color-bends-bg"
                        transparent={true}
                        colors={blendColors}
                        rotation={0}
                        autoRotate={0}
                        speed={0.2}
                        scale={0.7}
                        frequency={1}
                        warpStrength={1}
                        mouseInfluence={1}
                        parallax={0.5}
                        noise={0.1}
                        style={{
                            position: 'fixed',
                            inset: 0,
                            zIndex: -1,
                            pointerEvents: 'none',
                            background: isDark ? '#000000' : '#ffffff',
                            opacity: isDark ? 0.42 : 0.5,
                            transition: 'background-color 350ms ease, opacity 350ms ease',
                        }}
                    />
                )}
                <div className="competency-app">
                    <nav className={role === 'officer' ? 'navbar-officer' : 'navbar'}>
                        <div className={role === 'officer' ? 'nav-inner-officer' : 'container nav-inner'}>
                            <div className="logo">
                                <Image
                                    src="/images/Logo.png"
                                    alt="KKU Competency"
                                    width={36}
                                    height={36}
                                    className="logo-img"
                                    priority
                                />
                                <span className="logo-text">KKU Competency</span>
                            </div>
                            <div className="nav-menu">
                                {menuItems.map((item) => (
                                    <button
                                        key={item.id}
                                        className={`nav-item ${activePage === item.id ? 'active' : ''}`}
                                        onClick={() => handleNavigate(item.id)}
                                    >
                                        {item.icon && <item.icon size={18} />}
                                        <span>{item.label}</span>
                                    </button>
                                ))}
                            </div>
                            <div className="nav-right-section">
                                <div className="desktop-quick-controls">
                                    <ThemeToggle />
                                    <LanguageSwitcher />
                                </div>
                                <div className="user-area-wrapper">
                                    <button
                                        className="user-area"
                                        onClick={() => setUserMenuOpen(v => !v)}
                                    >
                                        <div className="user-info">
                                            <span className="user-name">
                                                {loading ? t('loading') : displayName}
                                            </span>
                                            <span className="user-role">{primaryRole}</span>
                                        </div>
                                        <div className="avatar">{avatarLabel}</div>
                                    </button>
                                    {userMenuOpen && (
                                        <div className="user-dropdown">
                                            <button
                                                className="logout-btn"
                                                onClick={() => { setUserMenuOpen(false); onLogout?.(); }}
                                            >
                                                <span>{t('logout')}</span>
                                            </button>
                                        </div>
                                    )}
                                </div>
                                <button 
                                    className="mobile-menu-btn" 
                                    onClick={() => setMobileMenuOpen(true)}
                                >
                                    <Menu size={24} />
                                </button>
                            </div>
                        </div>
                    </nav>

                    <AppSidebarMobile
                        items={menuItems}
                        activeItem={activePage}
                        onNavigate={handleNavigate}
                        isOpen={mobileMenuOpen}
                        onClose={() => setMobileMenuOpen(false)}
                        user={user}
                        loading={loading}
                        displayName={displayName}
                        primaryRole={primaryRole}
                        avatarLabel={avatarLabel}
                        onLogout={onLogout}
                        t={t}
                    />
                    
                    {/* Main content area */}
                    {children && (
                        <main className={role === 'officer' ? 'main-content-officer' : 'main-content'}>
                            <div className={role === 'officer' ? 'container-officer' : 'container'}>
                                {children}
                            </div>
                        </main>
                    )}
                </div>
            </>
        </ClickSpark>
    );
}

export default AppLayout;
