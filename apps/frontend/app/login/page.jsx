'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../providers/auth-provider';

export default function LoginPage() {
  const router = useRouter();
  const { user, loading, login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!loading && user) {
      router.replace('/');
    }
  }, [loading, user, router]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      await login(email, password);
      router.replace('/');
    } catch (err) {
      setError(err?.message || 'Unable to login.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ padding: '2rem', maxWidth: '420px', margin: '0 auto' }}>
      <h1 style={{ marginBottom: '1rem' }}>Login</h1>
      <p style={{ marginBottom: '1.5rem', color: '#4b5563' }}>
        Sign in to access the competency dashboard.
      </p>
      <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '1rem' }}>
        <label style={{ display: 'grid', gap: '0.5rem' }}>
          <span>Email</span>
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            style={{ padding: '0.5rem', borderRadius: '6px', border: '1px solid #d1d5db' }}
          />
        </label>
        <label style={{ display: 'grid', gap: '0.5rem' }}>
          <span>Password</span>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            style={{ padding: '0.5rem', borderRadius: '6px', border: '1px solid #d1d5db' }}
          />
        </label>
        {error && (
          <div style={{ color: '#b91c1c', fontSize: '0.9rem' }}>{error}</div>
        )}
        <button
          type="submit"
          disabled={submitting}
          style={{
            padding: '0.75rem',
            borderRadius: '6px',
            border: 'none',
            backgroundColor: '#111827',
            color: '#fff',
            cursor: 'pointer',
          }}
        >
          {submitting ? 'Signing in...' : 'Sign in'}
        </button>
      </form>
      <div style={{ marginTop: '1rem' }}>
        <Link href="/">Back to home</Link>
      </div>
    </div>
  );
}
