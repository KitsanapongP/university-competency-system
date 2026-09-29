'use client';

import ExecutiveAnalyticsWorkspace from '../../../../components/executive/ExecutiveAnalyticsWorkspace';
import { Suspense } from 'react';

export default function ExecutiveStudentsPage() {
    return <Suspense fallback={null}><ExecutiveAnalyticsWorkspace view="students" /></Suspense>;
}
