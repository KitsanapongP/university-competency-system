import React from 'react';
import { createRoot } from 'react-dom/client';
import { LanguageProvider, useLanguage } from '../../providers/LanguageContext';
import { LearnerAssessmentRejectedDraft } from '../../components/learner/LearnerAssessmentRejectedDraft';
import '../../app/globals.css';
import '../../app/Competency.css';
import '../../styles/UiTokens.css';
import './harness.css';

const params = new URLSearchParams(location.search);
document.documentElement.classList.toggle('dark', params.get('theme') === 'dark');
localStorage.setItem('language', params.get('language') || 'th');

function Harness() {
    const { language, t } = useLanguage();
    const scenario = params.get('scenario');
    const draft = {
        job_id: 1, semester: 1, preview: scenario === 'malformed'
            ? '<script>window.draftExecuted = true</script><img src=x onerror="window.draftExecuted=true">'
            : 'ข้อความร่างจำลองสำหรับตรวจส่วนแสดงผล\n\nSynthetic draft text for interface verification.',
        previous_attempt: scenario === 'previous', is_stale: scenario === 'stale',
        violation: { reason: scenario === 'malformed' ? 'malformed_json' : 'unsupported_claim', rule: scenario === 'malformed' ? '' : 'numeric_literal', section: 'strengths', paragraph_index: 1, sentence_index: 2, language: 'th', field: 'sentence.text' },
    };
    return <main className="competency-app"><LearnerAssessmentRejectedDraft draft={draft} language={language} t={t} /></main>;
}

createRoot(document.getElementById('root')).render(<LanguageProvider><Harness /></LanguageProvider>);
