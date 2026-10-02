'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AppLayout } from '../../../components/layout/AppLayout';
import { useAuth } from '../../../providers/auth-provider';
import '../../../app/Competency.css';

export default function CareerManagementLayout({ children }) {
    const router = useRouter();
    const { user, loading, logout } = useAuth();
    const roles = user?.roles || [];
    const isAdmin = roles.includes('admin');
    const authorized = isAdmin || roles.includes('officer');

    useEffect(() => {
        if (!loading && (!user || !authorized)) router.replace('/login');
    }, [authorized, loading, router, user]);

    const handleLogout = async () => {
        await logout();
        router.push('/login');
    };

    return (
        <AppLayout
            role={isAdmin ? 'admin' : 'officer'}
            activePage="career-management"
            onNavigate={(page) => router.push(`/${page}`)}
            user={user}
            loading={loading}
            onLogout={handleLogout}
            sidebarLoading={loading || !authorized}
        >
            {!loading && authorized ? children : null}
        </AppLayout>
    );
}
