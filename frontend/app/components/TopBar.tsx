import { useSession, signOut } from 'next-auth/react';
import styles from './TopBar.module.css';

import { useState, useEffect } from 'react';
import { checkHealth } from '../lib/api';

interface TopBarProps {
    onToggleSidebar: () => void;
    isSidebarOpen: boolean;
    onOpenProfile: () => void;
}

export default function TopBar({ onToggleSidebar, isSidebarOpen, onOpenProfile }: TopBarProps) {
    const { data: session } = useSession();
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [isOnline, setIsOnline] = useState(false);

    useEffect(() => {
        checkHealth().then(setIsOnline);
        const interval = setInterval(() => checkHealth().then(setIsOnline), 30000);
        return () => clearInterval(interval);
    }, []);

    return (
        <header style={{
            height: '64px',
            background: 'white',
            borderBottom: '1px solid #e5e5e5',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 1.5rem',
            position: 'sticky',
            top: 0,
            zIndex: 90,
            width: '100%'
        }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <button
                    onClick={onToggleSidebar}
                    title={isSidebarOpen ? "Close Sidebar" : "Open Sidebar"}
                    style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        padding: '0.4rem',
                        display: 'flex',
                        alignItems: 'center',
                        color: '#4b5563',
                        borderRadius: '6px',
                        transition: 'background 0.2s'
                    }}
                    onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#f3f4f6'}
                    onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        {isSidebarOpen ? (
                            <path d="M18 6L6 18M6 6l12 12" /> // X icon
                        ) : (
                            <>
                                <line x1="3" y1="12" x2="21" y2="12"></line>
                                <line x1="3" y1="6" x2="21" y2="6"></line>
                                <line x1="3" y1="18" x2="21" y2="18"></line>
                            </>
                        )}
                    </svg>
                </button>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <img
                        src="/logo_small.png"
                        alt="Newscrawler Logo"
                        style={{
                            width: '32px',
                            height: '32px',
                            objectFit: 'contain'
                        }}
                    />
                    <span style={{ fontSize: '1.25rem', fontWeight: 700, color: '#111827', letterSpacing: '-0.02em' }}>
                        Alex's Newscrawler
                    </span>
                </div>
            </div>

            {session && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>

                    {/* System Status */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem', color: '#666' }}>
                        <div style={{
                            width: '8px',
                            height: '8px',
                            borderRadius: '50%',
                            backgroundColor: isOnline ? '#10b981' : '#ef4444',
                            boxShadow: isOnline ? '0 0 4px #10b981' : 'none'
                        }} />
                        <span>{isOnline ? 'System Online' : 'Backend Disconnected'}</span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <div style={{ textAlign: 'right', marginRight: '0.5rem' }}>
                            <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#1f2937' }}>
                                {session.user?.name || 'User'}
                            </div>
                            <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                                {session.user?.email}
                            </div>
                        </div>

                        {session.user?.image ? (
                            <img
                                src={session.user.image}
                                alt={session.user.name || 'User'}
                                style={{
                                    width: '36px',
                                    height: '36px',
                                    borderRadius: '50%',
                                    border: '1px solid #e5e5e5',
                                    objectFit: 'cover'
                                }}
                            />
                        ) : (
                            <div style={{
                                width: '36px',
                                height: '36px',
                                borderRadius: '50%',
                                background: '#e5e7eb',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: '#6b7280'
                            }}>
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                                    <circle cx="12" cy="7" r="4"></circle>
                                </svg>
                            </div>
                        )}

                        <button
                            onClick={onOpenProfile}
                            style={{
                                padding: '0.5rem 0.75rem',
                                fontSize: '0.875rem',
                                fontWeight: 500,
                                color: '#374151',
                                background: 'white',
                                border: '1px solid #d1d5db',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                marginRight: '0.5rem'
                            }}
                        >
                            <span>Settings</span>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="12" cy="12" r="3"></circle>
                                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
                            </svg>
                        </button>

                        <button
                            onClick={() => signOut({ callbackUrl: '/login' })}
                            style={{
                                padding: '0.5rem 1rem',
                                fontSize: '0.875rem',
                                fontWeight: 500,
                                color: '#dc2626',
                                background: '#fee2e2',
                                border: '1px solid #fecaca',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                transition: 'all 0.2s'
                            }}
                            onMouseOver={(e) => {
                                e.currentTarget.style.backgroundColor = '#fecaca';
                            }}
                            onMouseOut={(e) => {
                                e.currentTarget.style.backgroundColor = '#fee2e2';
                            }}
                        >
                            <span>Sign out</span>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                                <polyline points="16 17 21 12 16 7"></polyline>
                                <line x1="21" y1="12" x2="9" y2="12"></line>
                            </svg>
                        </button>
                    </div>
                </div>
            )}
        </header>
    );
}

