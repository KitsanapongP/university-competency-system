'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../../providers/auth-provider';
import { AppLayout } from '../../../components/layout/AppLayout';
import '../../../app/Competency.css';

export default function CompetencyManagementLayout({ children }) {
    const router = useRouter();
    const { user, loading, logout } = useAuth();
    const isAdmin = user?.roles?.includes('admin');

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
            activePage="competency-management"
            onNavigate={handleNavigate}
            user={user}
            loading={loading}
            onLogout={handleLogout}
        >
            {children}
        </AppLayout>
    );
}
