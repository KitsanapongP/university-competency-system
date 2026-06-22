'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Mail, Lock, AlertCircle, KeyRound } from 'lucide-react';
import ClickSpark from '../../components/ClickSpark';
import LanguageSwitcher from '../../components/LanguageSwitcher';
import ThemeToggle from '../../components/ThemeToggle';
import { useAuth } from '../../providers/auth-provider';
import { useLanguage } from '../../providers/LanguageContext';
import '../Competency.css';
import './login.css';

function getPostLoginPath(user) {
  const roles = user?.roles || [];
  if (roles.includes('officer')) return '/curriculum-management';
  return '/';
}

export default function LoginPage() {
  const router = useRouter();
  const { user, loading, login } = useAuth();
  const { t } = useLanguage();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!loading && user) {
      router.replace(getPostLoginPath(user));
    }
  }, [loading, user, router]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      const nextUser = await login(email, password);
      router.replace(getPostLoginPath(nextUser));
    } catch (err) {
      setError(err?.message || t('login_error'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-quick-controls">
        <ThemeToggle />
        <LanguageSwitcher />
      </div>
      <ClickSpark sparkColor="#2563eb" sparkSize={10} sparkRadius={15} sparkCount={8} duration={400}>
        <div className="login-card">
          {/* ───── Brand ───── */}
          <div className="login-brand">
            <Image
              src="/images/Logo.png"
              alt="KKU Competency Logo"
              width={120}
              height={120}
              className="login-logo-img"
              priority
            />
            <h1>{t('login_title')}</h1>
            <p>{t('login_subtitle')}</p>
          </div>

          {/* ───── Form ───── */}
          <form className="login-form" onSubmit={handleSubmit}>
            <div className="login-field">
              <label htmlFor="email">
                <Mail size={16} /> {t('login_email')}
              </label>
              <input
                id="email"
                type="email"
                placeholder="you@kku.ac.th"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>

            <div className="login-field">
              <label htmlFor="password">
                <Lock size={16} /> {t('login_password')}
              </label>
              <input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
            </div>

            {error && (
              <div className="login-error">
                <AlertCircle size={18} className="login-error-icon" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              className="login-btn-primary"
              disabled={submitting}
            >
              {submitting ? (
                <>
                  <span className="btn-spinner" />
                  {t('login_signing_in')}
                </>
              ) : (
                t('login_signin')
              )}
            </button>

            {/* ── divider ── */}
            <div className="login-divider">
              <span>{t('login_or')}</span>
            </div>

            {/* ── SSO (disabled) ── */}
            <button
              type="button"
              className="login-btn-sso"
              disabled
              title="SSO is coming soon"
            >
              <KeyRound size={18} />
              {t('login_sso')}
            </button>
          </form>
        </div>
      </ClickSpark>
    </div>
  );
}
