'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '../../providers/auth-provider';
import { AppLayout } from '../../components/layout/AppLayout';
import '../../app/Competency.css';

function activeExecutivePage(pathname) {
    if (pathname.includes('/competencies')) return 'executive-management/competencies';
    if (pathname.includes('/comparison')) return 'executive-management/comparison';
    if (pathname.includes('/students')) return 'executive-management/students';
    return 'executive-management';
}

export default function ExecutiveLayout({ children }) {
    const router = useRouter();
    const pathname = usePathname();
    const { user, loading, logout } = useAuth();
    const isDean = user?.roles?.includes('dean');
    const isAdmin = user?.roles?.includes('admin');

    useEffect(() => {
        if (loading) return;
        if (!user) {
            router.replace('/login');
            return;
        }
        if (!isDean && !isAdmin) router.replace('/');
    }, [isAdmin, isDean, loading, router, user]);

    const handleLogout = async () => {
        await logout();
        router.push('/login');
    };

    return (
        <AppLayout
            role={isDean ? 'dean' : 'admin'}
            activePage={activeExecutivePage(pathname)}
            onNavigate={(page) => router.push('/' + page)}
            user={user}
            loading={loading}
            onLogout={handleLogout}
        >
            {children}
        </AppLayout>
    );
}
