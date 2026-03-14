'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../providers/auth-provider';
import AdminLayout from '../../components/admin/AdminLayout';

export default function TemplateManagementLayout({ children }) {
    const router = useRouter();
    const { user, loading, logout } = useAuth();

    useEffect(() => {
        if (!loading && !user) {
            router.replace('/login');
        }
    }, [loading, user, router]);

    const handleLogout = async () => {
        await logout();
        router.push('/login');
    };

    return (
        <AdminLayout user={user} loading={loading} onLogout={handleLogout}>
            {children}
        </AdminLayout>
    );
}