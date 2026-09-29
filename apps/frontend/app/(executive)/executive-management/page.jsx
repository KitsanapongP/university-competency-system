'use client';

import ExecutiveAnalyticsWorkspace from '../../../components/executive/ExecutiveAnalyticsWorkspace';
import { Suspense } from 'react';

export default function ExecutiveManagementPage() {
    return <Suspense fallback={null}><ExecutiveAnalyticsWorkspace view="overview" /></Suspense>;
}
