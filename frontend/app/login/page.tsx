'use client';

import { signIn, useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function LoginPage() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (status === 'authenticated') {
            router.push('/');
        }
    }, [status, router]);

    const handleGoogleLogin = async () => {
        try {
            await signIn('google', { callbackUrl: '/' });
        } catch (err) {
            setError('Login failed. Please try again.');
        }
    };

    if (status === 'loading') {
        return <div style={{ display: 'flex', height: '100vh', justifyContent: 'center', alignItems: 'center' }}>Loading...</div>;
    }

    return (
        <div style={{
            display: 'flex',
            minHeight: '100vh',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#f9fafb',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
        }}>
            <div style={{
                background: 'white',
                padding: '3rem',
                borderRadius: '12px',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
                width: '100%',
                maxWidth: '400px',
                textAlign: 'center'
            }}>
                <div style={{ marginBottom: '2rem' }}>
                    <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🌍</div>
                    <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#111827' }}>Welcome Back</h1>
                    <p style={{ color: '#6b7280', marginTop: '0.5rem' }}>Sign in to your News Aggregator</p>
                </div>

                {error && (
                    <div style={{
                        background: '#fee2e2',
                        color: '#991b1b',
                        padding: '0.75rem',
                        borderRadius: '6px',
                        fontSize: '0.875rem',
                        marginBottom: '1.5rem'
                    }}>
                        {error}
                    </div>
                )}

                <button
                    onClick={handleGoogleLogin}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '100%',
                        padding: '0.75rem 1rem',
                        fontSize: '0.875rem',
                        fontWeight: 500,
                        color: '#374151',
                        background: 'white',
                        border: '1px solid #d1d5db',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        transition: 'background-color 0.2s'
                    }}
                    onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#f3f4f6'}
                    onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'white'}
                >
                    <img
                        src="https://www.svgrepo.com/show/475656/google-color.svg"
                        alt="Google"
                        style={{ width: '18px', height: '18px', marginRight: '10px' }}
                    />
                    Continue with Google
                </button>

                {process.env.NODE_ENV === 'development' && (
                    <div style={{ marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid #e5e5e5' }}>
                        <p style={{ fontSize: '0.75rem', color: '#9ca3af', marginBottom: '1rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            Development Mode
                        </p>
                        <button
                            onClick={() => signIn('credentials', { username: 'test_dev', callbackUrl: '/' })}
                            style={{
                                width: '100%',
                                padding: '0.6rem',
                                fontSize: '0.875rem',
                                color: 'white',
                                background: '#3b82f6',
                                border: 'none',
                                borderRadius: '6px',
                                cursor: 'pointer'
                            }}
                        >
                            Quick Login as Dev
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
