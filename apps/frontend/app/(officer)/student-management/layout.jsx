'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../../providers/auth-provider';
import { AppLayout } from '../../../components/layout/AppLayout';
import '../../../app/Competency.css';

export default function StudentManagementLayout({ children }) {
    const router = useRouter();
    const { user, loading, logout } = useAuth();
    const isAdmin = user?.roles?.includes('admin');

    useEffect(() => {
        if (!loading && !user) router.replace('/login');
    }, [loading, router, user]);

    const handleLogout = async () => {
        await logout();
        router.push('/login');
    };

    return (
        <AppLayout
            role={isAdmin ? 'admin' : 'officer'}
            activePage="student-management"
            onNavigate={page => router.push(`/${page}`)}
            user={user}
            loading={loading}
            onLogout={handleLogout}
        >
            {children}
        </AppLayout>
    );
}
