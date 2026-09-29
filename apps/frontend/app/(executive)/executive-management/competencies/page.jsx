'use client';

import ExecutiveAnalyticsWorkspace from '../../../../components/executive/ExecutiveAnalyticsWorkspace';
import { Suspense } from 'react';

export default function ExecutiveCompetenciesPage() {
    return <Suspense fallback={null}><ExecutiveAnalyticsWorkspace view="competencies" /></Suspense>;
}
