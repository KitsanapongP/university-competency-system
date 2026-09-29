"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../../providers/auth-provider";
import { AppLayout } from "../../../components/layout/AppLayout";
import "../../../app/Competency.css";

export default function MyActivitySessionsLayout({ children }) {
  const router = useRouter();
  const { user, loading, logout } = useAuth();

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, router, user]);

  return (
    <AppLayout
      role="lecturer"
      activePage="my-activity-sessions"
      onNavigate={(page) => router.push(`/${page}`)}
      user={user}
      loading={loading}
      onLogout={async () => {
        await logout();
        router.push("/login");
      }}
    >
      {children}
    </AppLayout>
  );
}
