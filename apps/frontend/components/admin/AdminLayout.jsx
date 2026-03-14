'use client';

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { ChevronDown, LogOut, Sun, Moon, Globe } from 'lucide-react';
import { useTheme } from '../../providers/theme-provider';
import { useLanguage } from '../../providers/LanguageContext';
import './AdminLayout.css';

// ============================================================
// AdminNavbar
// ============================================================
function AdminNavbar({ user, loading, onLogout }) {
    const { resolvedTheme, setTheme } = useTheme();
    const { language, setLanguage } = useLanguage();
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const [mounted, setMounted] = useState(false);  // ← กัน hydration mismatch
    const dropdownRef = useRef(null);

    // รอให้ hydrate เสร็จก่อนค่อย render theme-dependent UI
    useEffect(() => { setMounted(true); }, []);

    const isDark = mounted && resolvedTheme === 'dark';

    // ปิด dropdown เมื่อคลิกนอก
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
                setDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const displayName = user?.display_name || user?.username || 'Guest';
    const primaryRole = user?.roles?.[0] || '';
    const avatarLabel = displayName
        .split(' ')
        .filter(Boolean)
        .slice(0, 2)
        .map(p => p[0]?.toUpperCase())
        .join('') || 'U';

    return (
        <nav className="admin-navbar">
            {/* ── Left: Logo ── */}
            <div className="admin-navbar__logo">
                <Image
                    src="/images/Logo.png"
                    alt="KKU Competency"
                    width={30}
                    height={30}
                    priority
                />
                <span className="admin-navbar__logo-text">KKU Competency</span>
            </div>

            {/* ── Right: Controls ── */}
            <div className="admin-navbar__right">

                {/* Theme toggle — render หลัง mount เท่านั้น */}
                {mounted && (
                    <button
                        className="admin-nav-icon-btn"
                        onClick={() => setTheme(isDark ? 'light' : 'dark')}
                        title={isDark ? 'Switch to Light' : 'Switch to Dark'}
                    >
                        {isDark ? <Sun size={16} /> : <Moon size={16} />}
                    </button>
                )}

                {/* Language toggle */}
                <button
                    className="admin-nav-icon-btn admin-nav-lang-btn"
                    onClick={() => setLanguage(language === 'th' ? 'en' : 'th')}
                    title="เปลี่ยนภาษา / Change Language"
                >
                    <Globe size={15} />
                    <span>{language === 'th' ? 'TH' : 'EN'}</span>
                </button>

                {/* Profile dropdown */}
                <div className="admin-nav-profile" ref={dropdownRef}>
                    <button
                        className="admin-nav-profile__btn"
                        onClick={() => setDropdownOpen(v => !v)}
                    >
                        <div className="admin-nav-profile__text">
                            <span className="admin-nav-profile__name">
                                {loading ? '...' : displayName}
                            </span>
                            {primaryRole && (
                                <span className="admin-nav-profile__role">{primaryRole}</span>
                            )}
                        </div>
                        <div className="admin-nav-profile__avatar">{avatarLabel}</div>
                        <ChevronDown
                            size={14}
                            className={`admin-nav-profile__chevron ${dropdownOpen ? 'open' : ''}`}
                        />
                    </button>

                    {dropdownOpen && (
                        <div className="admin-nav-dropdown">
                            <div className="admin-nav-dropdown__info">
                                <span className="admin-nav-dropdown__name">{displayName}</span>
                                {primaryRole && (
                                    <span className="admin-nav-dropdown__role">{primaryRole}</span>
                                )}
                            </div>
                            <div className="admin-nav-dropdown__divider" />
                            <button
                                className="admin-nav-dropdown__item admin-nav-dropdown__item--danger"
                                onClick={() => { setDropdownOpen(false); onLogout?.(); }}
                            >
                                <LogOut size={14} />
                                <span>ออกจากระบบ</span>
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </nav>
    );
}

// ============================================================
// AdminLayout
// ============================================================
export default function AdminLayout({ children, user, loading, onLogout }) {
    return (
        <div className="admin-layout">
            <AdminNavbar user={user} loading={loading} onLogout={onLogout} />
            <main className="admin-main">
                {children}
            </main>
        </div>
    );
}