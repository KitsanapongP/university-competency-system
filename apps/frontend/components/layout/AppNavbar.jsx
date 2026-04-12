'use client';

import { useState, useEffect, useRef } from 'react';
import { ChevronDown, LogOut } from 'lucide-react';
import { useTheme } from '../../providers/theme-provider';
import { useLanguage } from '../../providers/LanguageContext';
import ThemeToggle from '../ThemeToggle';
import LanguageSwitcher from '../LanguageSwitcher';

export function AppNavbar({ user, loading, onLogout, children }) {
    const { resolvedTheme } = useTheme();
    const { t } = useLanguage();
    const [userMenuOpen, setUserMenuOpen] = useState(false);
    const [mounted, setMounted] = useState(false);
    const dropdownRef = useRef(null);

    useEffect(() => { setMounted(true); }, []);

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
                setUserMenuOpen(false);
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
        <nav className="app-navbar">
            {children}
            <div className="app-navbar__right">
                <div className="app-navbar__controls">
                    <ThemeToggle />
                    <LanguageSwitcher />
                </div>
                <div className="app-navbar__user" ref={dropdownRef}>
                    <button
                        className="app-navbar__user-btn"
                        onClick={() => setUserMenuOpen(v => !v)}
                    >
                        <div className="app-navbar__user-info">
                            <span className="app-navbar__user-name">
                                {loading ? t('loading') : displayName}
                            </span>
                            {primaryRole && (
                                <span className="app-navbar__user-role">{primaryRole}</span>
                            )}
                        </div>
                        <div className="app-navbar__avatar">{avatarLabel}</div>
                        <ChevronDown
                            size={14}
                            className={`app-navbar__chevron ${userMenuOpen ? 'open' : ''}`}
                        />
                    </button>
                    {userMenuOpen && (
                        <div className="app-navbar__dropdown">
                            <div className="app-navbar__dropdown-info">
                                <span className="app-navbar__dropdown-name">{displayName}</span>
                                {primaryRole && (
                                    <span className="app-navbar__dropdown-role">{primaryRole}</span>
                                )}
                            </div>
                            <div className="app-navbar__dropdown-divider" />
                            <button
                                className="app-navbar__dropdown-item app-navbar__dropdown-item--danger"
                                onClick={() => { setUserMenuOpen(false); onLogout?.(); }}
                            >
                                <LogOut size={14} />
                                <span>{t('logout')}</span>
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </nav>
    );
}