'use client';

import ExecutiveAnalyticsWorkspace from '../../../../components/executive/ExecutiveAnalyticsWorkspace';
import { Suspense } from 'react';

export default function ExecutiveComparisonPage() {
    return <Suspense fallback={null}><ExecutiveAnalyticsWorkspace view="comparison" /></Suspense>;
}
