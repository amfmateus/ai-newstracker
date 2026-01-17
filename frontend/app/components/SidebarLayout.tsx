'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';

import TopBar from './TopBar';
import ProfileSettingsModal from './ProfileSettingsModal';
import { fetchUserProfile, fetchSettings } from '../lib/api';
import BreadcrumbBar from './BreadcrumbBar';

interface SidebarLayoutProps {
    children: React.ReactNode;
}

export default function SidebarLayout({ children }: SidebarLayoutProps) {
    const { data: session } = useSession(); // Access session to know if we should check profile

    // Default open on desktop
    const [isPinned, setIsPinned] = useState(true);
    const [isMobile, setIsMobile] = useState(false);
    const pathname = usePathname();

    // Profile & Warning State
    const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
    const [showMissingKeyWarning, setShowMissingKeyWarning] = useState(false);
    const [enableStories, setEnableStories] = useState(true);

    // Check screen size on mount
    useEffect(() => {
        const checkMobile = () => {
            const mobile = window.innerWidth < 768;
            setIsMobile(mobile);
            if (mobile) setIsPinned(false); // Default closed on mobile
            else setIsPinned(true); // Default open on desktop
        };

        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    // Check User Profile for API Key when session exists
    useEffect(() => {
        if (session) {
            checkProfile();
            checkSettings();
        }
    }, [session]);

    const checkProfile = async () => {
        try {
            const profile = await fetchUserProfile();
            if (!profile.has_api_key) {
                setShowMissingKeyWarning(true);
            } else {
                setShowMissingKeyWarning(false);
            }
        } catch (e) {
            console.error("Failed to check profile status", e);
        }
    };

    const checkSettings = async () => {
        try {
            const settings = await fetchSettings();
            if (settings.enable_stories !== undefined) {
                setEnableStories(settings.enable_stories);
            }
        } catch (e) {
            // Siltent fail or default to true
        }
    }

    const toggle = () => setIsPinned(!isPinned);

    const menuItems = [
        {
            name: 'News Feed', path: '/feed', icon: (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2"></path>
                    <path d="M18 14h-8"></path>
                    <path d="M15 18h-5"></path>
                    <path d="M10 6h8v4h-8V6Z"></path>
                </svg>
            )
        },
        ...(enableStories ? [{
            name: 'News Clusters', path: '/stories', icon: (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
                    <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
                    <line x1="12" y1="22.08" x2="12" y2="12"></line>
                </svg>
            )
        }] : []),
        {
            name: 'News Sources', path: '/sources', icon: (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="2" y1="12" x2="22" y2="12"></line>
                    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
                </svg>
            )
        },
        {
            name: 'Reporting Pipelines', path: '/pipelines', icon: (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect>
                    <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path>
                </svg>
            )
        },
        {
            name: 'Archive', path: '/reports', icon: (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="21 8 21 21 3 21 3 8"></polyline>
                    <rect x="1" y="3" width="22" height="5"></rect>
                    <line x1="10" y1="12" x2="14" y2="12"></line>
                </svg>
            )
        },
        { type: 'separator' },
        {
            name: 'System Settings', path: '/settings', icon: (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.09a2 2 0 0 1-1-1.74v-.47a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.39a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"></path>
                    <circle cx="12" cy="12" r="3"></circle>
                </svg>
            )
        },
    ];

    // Sidebar width
    const sidebarWidth = '240px';

    return (
        <div style={{ height: '100vh', width: '100vw', display: 'flex', flexDirection: 'column', overflow: 'hidden', backgroundColor: '#f9fafb' }}>

            {/* Top Bar - Fixed at Top */}
            <div style={{ zIndex: 110, position: 'relative', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', backgroundColor: 'white' }}>
                <TopBar
                    onToggleSidebar={toggle}
                    isSidebarOpen={isPinned}
                    onOpenProfile={() => setIsProfileModalOpen(true)}
                />
            </div>

            {/* Content Area (Sidebar + Main Content) */}
            <div style={{ flex: 1, display: 'flex', position: 'relative', overflow: 'hidden' }}>

                {/* Sidebar component */}
                <aside
                    style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        bottom: 0,
                        width: sidebarWidth,
                        background: '#ffffff',
                        borderRight: '1px solid #f1f5f9',
                        zIndex: 100,
                        transform: isPinned ? 'translateX(0)' : 'translateX(-100%)',
                        transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                        display: 'flex',
                        flexDirection: 'column',
                    }}
                >
                    {/* Sidebar Links */}
                    <nav style={{ padding: '1.5rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.25rem', flex: 1, overflowY: 'auto' }}>
                        {menuItems.map((item, index) => {
                            if (item.type === 'separator') {
                                return <div key={`sep-${index}`} style={{ margin: '0.75rem 0', height: '1px', backgroundColor: '#f1f5f9' }} />;
                            }

                            const isActive = pathname === item.path || (item.path !== '/' && pathname?.startsWith(item.path || ''));

                            return (
                                <Link
                                    key={item.path}
                                    href={item.path || '#'}
                                    onClick={() => isMobile && setIsPinned(false)} // Close on click only on mobile
                                    style={{
                                        textDecoration: 'none',
                                        color: isActive ? '#0f172a' : '#64748b',
                                        fontWeight: isActive ? 600 : 500,
                                        fontSize: '1rem',
                                        padding: '0.6rem 0.75rem',
                                        borderRadius: '8px',
                                        background: isActive ? '#f1f5f9' : 'transparent',
                                        transition: 'all 0.15s ease-in-out',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '12px',
                                        letterSpacing: '0.01em'
                                    }}
                                    onMouseEnter={(e) => {
                                        if (!isActive) e.currentTarget.style.backgroundColor = '#f8fafc';
                                        if (!isActive) e.currentTarget.style.color = '#334155';
                                    }}
                                    onMouseLeave={(e) => {
                                        if (!isActive) e.currentTarget.style.backgroundColor = 'transparent';
                                        if (!isActive) e.currentTarget.style.color = '#64748b';
                                    }}
                                >
                                    <span style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        color: isActive ? '#2563eb' : 'currentColor',
                                        opacity: isActive ? 1 : 0.7
                                    }}>
                                        {item.icon}
                                    </span>
                                    {item.name}
                                </Link>
                            );
                        })}
                    </nav>
                </aside>

                {/* Main Content Wrapper */}
                <div
                    style={{
                        flex: 1,
                        marginLeft: (isPinned && !isMobile) ? sidebarWidth : 0,
                        transition: 'margin-left 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                        width: '100%',
                        position: 'relative',
                        display: 'flex',
                        flexDirection: 'column',
                        height: '100%',
                        overflow: 'hidden'
                    }}
                >
                    {/* Breadcrumb Bar */}
                    <BreadcrumbBar />

                    {/* GLOBAL WARNING BANNER */}
                    {showMissingKeyWarning && (
                        <div style={{
                            background: '#fee2e2',
                            borderBottom: '1px solid #fecaca',
                            color: '#b91c1c',
                            padding: '0.75rem 1.5rem',
                            fontSize: '0.9rem',
                            fontWeight: 500,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '1rem',
                            flexShrink: 0
                        }}>
                            <span>⚠️ <strong>AI Features Disabled:</strong> You need to configure your Google API Key.</span>
                            <button
                                onClick={() => setIsProfileModalOpen(true)}
                                style={{
                                    background: '#dc2626',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '4px',
                                    padding: '0.25rem 0.75rem',
                                    fontSize: '0.85rem',
                                    fontWeight: 600,
                                    cursor: 'pointer'
                                }}
                            >
                                Configure Now
                            </button>
                        </div>
                    )}

                    {/* Actual Page Content - PRIMARY SCROLL CONTAINER */}
                    <div id="main-scroll-container" style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', position: 'relative' }}>
                        {children}
                    </div>

                    {/* Mobile Backdrop - Overlay only the content area */}
                    {isMobile && isPinned && (
                        <div
                            onClick={() => setIsPinned(false)}
                            style={{
                                position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 95
                            }}
                        />
                    )}

                    {/* GLOBAL PROFILE MODAL */}
                    <ProfileSettingsModal
                        isOpen={isProfileModalOpen}
                        onClose={() => {
                            setIsProfileModalOpen(false);
                            checkProfile(); // Re-check after closing to update banner
                            checkSettings(); // Refresh settings to update menu items (e.g. Stories)
                        }}
                    />

                </div>
            </div>
        </div>
    );
}
