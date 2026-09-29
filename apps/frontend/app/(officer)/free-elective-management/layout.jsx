'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '../../../providers/auth-provider';
import { AppLayout } from '../../../components/layout/AppLayout';
import '../../../app/Competency.css';

export default function FreeElectiveManagementLayout({ children }) {
    const router = useRouter();
    const pathname = usePathname();
    const { user, loading, logout } = useAuth();
    const isAdmin = user?.roles?.includes('admin');
    const isLearnerManagementRoute =
        pathname?.startsWith('/free-elective-management/groups')
        || pathname?.startsWith('/free-elective-management/students');

    useEffect(() => {
        if (!loading && !user) {
            router.replace('/login');
        }
    }, [loading, user, router]);

    const handleLogout = async () => {
        await logout();
        router.push('/login');
    };

    const handleNavigate = (page) => {
        router.push(`/${page}`);
    };

    return (
        <AppLayout
            role={isAdmin ? 'admin' : 'officer'}
            activePage={isLearnerManagementRoute
                ? 'free-elective-management/groups'
                : 'free-elective-management'}
            onNavigate={handleNavigate}
            user={user}
            loading={loading}
            onLogout={handleLogout}
        >
            {children}
        </AppLayout>
    );
}
