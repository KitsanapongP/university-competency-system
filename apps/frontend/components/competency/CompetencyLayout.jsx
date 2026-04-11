'use client';

import React, { useState } from 'react';
import {
    LayoutDashboard, User, ClipboardCheck,
    Menu, X, ChevronDown, LogOut
} from 'lucide-react';
import Image from 'next/image';
import ClickSpark from '../ClickSpark';
import ColorBends from '../ColorBends';
import { DARK_BACKGROUND_COLORS, LIGHT_BACKGROUND_COLORS } from '../../config/theme';
import { useLanguage } from '../../providers/LanguageContext';
import LanguageSwitcher from '../LanguageSwitcher';
import ThemeToggle from '../ThemeToggle';
import { useTheme } from '../../providers/theme-provider';

const CompetencyLayout = ({ children, activePage, onNavigate, user, loading, onLogout }) => {
    const { t } = useLanguage();
    const { resolvedTheme } = useTheme();
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [userMenuOpen, setUserMenuOpen] = useState(false);

    const isDark = resolvedTheme === 'dark';
    const blendColors = isDark ? DARK_BACKGROUND_COLORS : LIGHT_BACKGROUND_COLORS;

    const handleNavigate = (page) => {
        onNavigate(page);
        setMobileMenuOpen(false);
    };

    const userDisplayName = user?.display_name || user?.username || 'Guest';
    const primaryRole = user?.roles?.[0] || 'No Role';
    const avatarLabel = userDisplayName
        .split(' ')
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase())
        .join('') || 'U';

    return (
        <ClickSpark sparkColor="#2563eb" sparkSize={10} sparkRadius={15} sparkCount={8} duration={400}>
            <>
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
                <div className="competency-app">
                    {/* NAVBAR */}
                    <nav className="navbar">
                        <div className="container nav-inner">
                            <div className="logo">
                                <Image
                                    src="/images/Logo.png"
                                    alt="KKU Competency Logo"
                                    width={36}
                                    height={36}
                                    className="logo-img"
                                    priority
                                />
                                <span className="logo-text">KKU Competency</span>
                            </div>

                            {/* Desktop Menu */}
                            <div className="nav-menu">
                                <button
                                    className={`nav-item ${activePage === 'dashboard' ? 'active' : ''}`}
                                    onClick={() => handleNavigate('dashboard')}
                                >
                                    <LayoutDashboard size={18} />
                                    <span>{t('dashboard')}</span>
                                </button>
                                <button
                                    className={`nav-item ${activePage === 'profile' ? 'active' : ''}`}
                                    onClick={() => handleNavigate('profile')}
                                >
                                    <User size={18} />
                                    <span>{t('profile')}</span>
                                </button>
                                <button
                                    className={`nav-item ${activePage === 'verify' ? 'active' : ''}`}
                                    onClick={() => handleNavigate('verify')}
                                >
                                    <ClipboardCheck size={18} />
                                    <span>{t('verify')}</span>
                                </button>
                            </div>

                            <div className="nav-right-section">
                                <div className="desktop-quick-controls">
                                    <ThemeToggle />
                                    <LanguageSwitcher />
                                </div>

                                <div className="user-area-wrapper">
                                    <button
                                        type="button"
                                        className="user-area"
                                        onClick={() => setUserMenuOpen((prev) => !prev)}
                                    >
                                        <div className="user-info">
                                            <span className="user-name">{loading ? t('loading') : userDisplayName}</span>
                                            <span className="user-role">{primaryRole}</span>
                                        </div>
                                        <div className="avatar">{avatarLabel}</div>
                                        <ChevronDown size={16} className={`user-chevron ${userMenuOpen ? 'open' : ''}`} />
                                    </button>
                                    {user && userMenuOpen && (
                                        <div className="user-dropdown">
                                            <button type="button" className="logout-btn" onClick={onLogout}>
                                                <LogOut size={16} />
                                                <span>{t('logout')}</span>
                                            </button>
                                        </div>
                                    )}
                                </div>

                                {/* Mobile: quick controls visible outside burger */}
                                <div className="mobile-inline-controls">
                                    <ThemeToggle />
                                    <LanguageSwitcher />
                                </div>

                                <button className="mobile-menu-btn" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
                                    {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
                                </button>
                            </div>
                        </div>
                    </nav>

                    {/* MOBILE MENU DRAWER */}
                    {mobileMenuOpen && (
                        <div className="mobile-menu-overlay" onClick={() => setMobileMenuOpen(false)}>
                            <div className="mobile-menu-drawer left" onClick={e => e.stopPropagation()}>
                                <div className="mobile-menu-header">
                                    <Image
                                        src="/images/Logo.png"
                                        alt="KKU Competency Logo"
                                        width={28}
                                        height={28}
                                        className="logo-img"
                                    />
                                    <span>KKU Competency</span>
                                    <button className="close-drawer-btn" onClick={() => setMobileMenuOpen(false)}>
                                        <X size={20} />
                                    </button>
                                </div>
                                <div className="mobile-nav-items">
                                    <button
                                        className={`mobile-nav-item ${activePage === 'dashboard' ? 'active' : ''}`}
                                        onClick={() => handleNavigate('dashboard')}
                                    >
                                        <LayoutDashboard size={20} />
                                        <span>{t('dashboard')}</span>
                                    </button>
                                    <button
                                        className={`mobile-nav-item ${activePage === 'profile' ? 'active' : ''}`}
                                        onClick={() => handleNavigate('profile')}
                                    >
                                        <User size={20} />
                                        <span>{t('profile')}</span>
                                    </button>
                                    <button
                                        className={`mobile-nav-item ${activePage === 'verify' ? 'active' : ''}`}
                                        onClick={() => handleNavigate('verify')}
                                    >
                                        <ClipboardCheck size={20} />
                                        <span>{t('verify')}</span>
                                    </button>
                                </div>
                                <div className="mobile-user-section">
                                    <div className="avatar">{avatarLabel}</div>
                                    <div>
                                        <span className="user-name">{loading ? t('loading') : userDisplayName}</span>
                                        <span className="user-role">Role: {primaryRole}</span>
                                    </div>
                                </div>
                                {user && (
                                    <div className="mobile-logout-wrap">
                                        <button
                                            type="button"
                                            className="logout-btn mobile"
                                            onClick={onLogout}
                                        >
                                            <LogOut size={16} />
                                            <span>{t('logout')}</span>
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* MAIN CONTENT */}
                    <main className="main-content">
                        <div className="container">
                            {children}
                        </div>
                    </main>
                </div>
            </>
        </ClickSpark>
    );
};

export default CompetencyLayout;
