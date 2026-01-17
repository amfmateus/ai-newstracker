'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { fetchSettings, updateSettings, SystemSettings } from '../lib/api';
import styles from './Settings.module.css';

export default function SettingsPage() {
    const { data: session, status } = useSession();
    const [settings, setSettings] = useState<SystemSettings | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [activeTab, setActiveTab] = useState<'general' | 'html' | 'rss' | 'visual' | 'clustering'>('general');

    // Success/Error feedback
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
    const [availableModels, setAvailableModels] = useState<string[]>([]);
    const [aiDefaults, setAiDefaults] = useState<any>(null);

    useEffect(() => {
        if (status === 'loading') return;
        if (status === 'unauthenticated') {
            setLoading(false);
            return;
        }

        const loadData = async () => {
            try {
                const s = await fetchSettings();
                setSettings(s);

                const { fetchAIModels, fetchAIDefaults } = await import('../lib/api');
                const [models, defaults] = await Promise.all([
                    fetchAIModels(),
                    fetchAIDefaults()
                ]);
                // Robust parsing for both object {id, name} and string formats
                setAvailableModels(models.map((m: any) => {
                    if (typeof m === 'string') return m;
                    return m.id || m.name || 'unknown-model';
                }));
                setAiDefaults(defaults);
            } catch (err) {
                console.error(err);
                setMessage({ type: 'error', text: 'Failed to load settings. Ensure you are logged in.' });
            } finally {
                setLoading(false);
            }
        };

        loadData();

        const handleSysUpdate = () => loadData();
        window.addEventListener('sys-settings-updated', handleSysUpdate);
        return () => window.removeEventListener('sys-settings-updated', handleSysUpdate);
    }, [status]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!settings) return;

        setSaving(true);
        setMessage(null);

        try {
            // Filter out fields that shouldn't be sent or might cause issues
            const { id, user_id, last_clustering_at, ...updatePayload } = settings as any;

            const updated = await updateSettings(updatePayload);
            setSettings(updated);
            setMessage({ type: 'success', text: 'Settings saved successfully' });

            // Auto hide success
            setTimeout(() => setMessage(null), 3000);
        } catch (err) {
            console.error(err);
            setMessage({ type: 'error', text: 'Failed to save settings' });
        } finally {
            setSaving(false);
        }
    };

    const handleChange = (key: keyof SystemSettings, value: any) => {
        if (!settings) return;
        setSettings({
            ...settings,
            [key]: value
        });
    };

    if (loading) return <div className="p-8">Loading settings...</div>;
    if (!settings) return <div className="p-8">Error loading settings.</div>;

    const navItems = [
        {
            id: 'general',
            label: 'General news harvesting',
            icon: (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="2" y1="12" x2="22" y2="12"></line>
                    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
                </svg>
            )
        },
        {
            id: 'html',
            label: 'Smart HTML',
            icon: (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="16 18 22 12 16 6"></polyline>
                    <polyline points="8 6 2 12 8 18"></polyline>
                </svg>
            )
        },
        {
            id: 'rss',
            label: 'RSS Feed',
            icon: (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 11a9 9 0 0 1 9 9"></path>
                    <path d="M4 4a16 16 0 0 1 16 16"></path>
                    <circle cx="5" cy="19" r="1"></circle>
                </svg>
            )
        },
        {
            id: 'visual',
            label: 'Visual / PDF',
            icon: (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                    <circle cx="12" cy="12" r="3"></circle>
                </svg>
            )
        },
        ...(settings && settings.enable_stories !== false ? [{
            id: 'clustering',
            label: 'Clustering',
            icon: (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
                </svg>
            )
        }] : []),
    ];

    // Helpers to render inputs cleanly
    const renderInput = (label: string, field: keyof SystemSettings, type: string = 'text', helper?: string, placeholder?: string) => (
        <div className={styles.formGroup}>
            <label className={styles.label}>{label}</label>
            <input
                type={type}
                value={(settings as any)[field] || ''}
                onChange={e => handleChange(field, type === 'number' ? (parseInt(e.target.value) || 0) : e.target.value)}
                placeholder={placeholder}
                className={styles.input}
            />
            {helper && <p className={styles.helperText}>{helper}</p>}
        </div>
    );

    return (
        <div className={styles.container}>
            {/* Sidebar - Integrated Vertical Nav */}
            <aside className={styles.sidebar}>
                <div className={styles.sidebarHeader}>
                    <h1 className={styles.sidebarTitle}>System Settings</h1>
                </div>
                <nav className={styles.nav}>
                    {navItems.map((item) => (
                        <button
                            key={item.id}
                            onClick={() => setActiveTab(item.id as any)}
                            className={`${styles.navButton} ${activeTab === item.id ? styles.navButtonActive : ''}`}
                        >
                            <span className={styles.navIcon}>{item.icon}</span>
                            {item.label}
                        </button>
                    ))}
                </nav>
            </aside>

            {/* Main Content */}
            <main className={styles.main}>
                <div className={styles.contentContainer}>
                    <form onSubmit={handleSubmit}>
                        {/* Header - Sticky */}
                        <div className={styles.header}>
                            <h2 className={styles.pageTitle}>
                                {navItems.find(i => i.id === activeTab)?.label}
                            </h2>
                            <button type="submit" disabled={saving} className={styles.saveButton}>
                                {saving ? 'Saving...' : 'Save Changes'}
                            </button>
                        </div>

                        {message && (
                            <div style={{
                                marginBottom: '2rem', padding: '1rem', borderRadius: '0.75rem',
                                backgroundColor: message.type === 'success' ? '#ecfdf5' : '#fef2f2',
                                color: message.type === 'success' ? '#065f46' : '#991b1b',
                                border: message.type === 'success' ? '1px solid #d1fae5' : '1px solid #fee2e2',
                                boxShadow: '0 2px 4px rgba(0,0,0,0.02)',
                                display: 'flex', alignItems: 'center', gap: '0.75rem', fontWeight: 500
                            }}>
                                <span>{message.type === 'success' ? '✅' : '🚨'}</span>
                                {message.text}
                            </div>
                        )}

                        {/* 1. General News Harvesting */}
                        {activeTab === 'general' && (
                            <>
                                <div className={styles.section}>
                                    <h3 className={styles.sectionTitle}>Crawling Behavior</h3>
                                    <div className={styles.grid}>
                                        {renderInput('Default Crawl Interval (Minutes)', 'default_crawl_interval_mins', 'number', 'Frequency of checks for sources without specific intervals.')}
                                        {renderInput('First Crawl Lookback (Hours)', 'first_crawl_lookback_hours', 'number', 'How far back to ingest when adding a new source.')}
                                        {renderInput('Minimum Text Length', 'min_text_length', 'number', 'Discard articles shorter than this (removes noise).')}
                                    </div>
                                </div>

                                <div className={styles.section}>
                                    <h3 className={styles.sectionTitle}>Intelligence & Relevance</h3>
                                    <div className={styles.grid}>
                                        <div className={styles.formGroup}>
                                            <label className={styles.label}>Minimum Relevance Score ({settings.min_relevance_score}/100)</label>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                                <input
                                                    type="range" min="0" max="100"
                                                    value={settings.min_relevance_score || 0}
                                                    onChange={e => handleChange('min_relevance_score', parseInt(e.target.value) || 0)}
                                                    style={{ width: '100%', accentColor: '#3b82f6', height: '6px' }}
                                                />
                                            </div>
                                            <p className={styles.helperText}>Content score threshold for ingestion.</p>
                                        </div>
                                    </div>
                                    <div className={styles.formGroup} style={{ marginTop: '1.5rem' }}>
                                        <label className={styles.label}>Relevance Focus Prompt</label>
                                        <textarea
                                            value={settings.content_topic_focus || ''}
                                            onChange={e => handleChange('content_topic_focus', e.target.value)}
                                            rows={2}
                                            className={styles.textarea}
                                            placeholder="e.g. Economics, Trade, Politics, Finance"
                                        />
                                        <p className={styles.helperText}>Define the core topics for the AI to score against.</p>
                                    </div>
                                </div>

                                <div className={styles.section}>
                                    <h3 className={styles.sectionTitle}>Enrichment Model</h3>
                                    <div className={styles.grid}>
                                        <div className={styles.formGroup}>
                                            <label className={styles.label}>Analysis Model</label>
                                            <select
                                                value={settings.analysis_model || 'gemini-1.5-flash'}
                                                onChange={e => handleChange('analysis_model', e.target.value)}
                                                className={styles.select}
                                            >
                                                {availableModels.map(m => <option key={m} value={m}>{m}</option>)}
                                            </select>
                                        </div>
                                    </div>
                                    <details style={{ marginTop: '1.5rem' }}>
                                        <summary style={{ cursor: 'pointer', color: '#64748b', fontSize: '0.9rem', marginBottom: '0.75rem', fontWeight: 500, listStyle: 'none' }}>► Advanced: Analysis System Prompt</summary>
                                        <textarea
                                            value={settings.analysis_prompt || ''}
                                            onChange={e => handleChange('analysis_prompt', e.target.value)}
                                            rows={6}
                                            className={styles.textarea}
                                        />
                                    </details>
                                </div>
                            </>
                        )}

                        {/* 2. Smart HTML */}
                        {activeTab === 'html' && (
                            <div className={styles.section}>
                                <h3 className={styles.sectionTitle}>Web Scraper Performance</h3>
                                <div className={styles.grid}>
                                    {renderInput('Max Articles to Scrape', 'max_articles_to_scrape', 'number', 'Limit full page loads per crawl cycle to manage resources.')}
                                    {renderInput('Page Load Timeout (Seconds)', 'page_load_timeout_seconds', 'number', 'Abort slow loading pages after this duration.')}
                                </div>
                            </div>
                        )}

                        {/* 3. RSS Feed */}
                        {activeTab === 'rss' && (
                            <div className={styles.section}>
                                <h3 className={styles.sectionTitle}>RSS Limits</h3>
                                <div className={styles.grid}>
                                    {renderInput('Max RSS Entries', 'max_rss_entries', 'number', 'Maximum items to inspect per feed refresh.')}
                                </div>
                            </div>
                        )}

                        {/* 4. Visual / PDF */}
                        {activeTab === 'visual' && (
                            <div className={styles.section}>
                                <h3 className={styles.sectionTitle}>Dynamic PDF Crawler</h3>
                                <div className={styles.grid}>
                                    <div className={styles.formGroup}>
                                        <label className={styles.label}>Extraction Model</label>
                                        <select
                                            value={settings.pdf_crawl_model || 'gemini-1.5-flash'}
                                            onChange={e => handleChange('pdf_crawl_model', e.target.value)}
                                            className={styles.select}
                                        >
                                            {availableModels.map(m => <option key={m} value={m}>{m}</option>)}
                                        </select>
                                    </div>
                                </div>
                                <div className={styles.formGroup} style={{ marginTop: '1.5rem' }}>
                                    <label className={styles.label}>Extraction Prompt</label>
                                    <textarea
                                        value={settings.pdf_crawl_prompt || ''}
                                        onChange={e => handleChange('pdf_crawl_prompt', e.target.value)}
                                        rows={6}
                                        className={styles.textarea}
                                        placeholder="Instructions for extracting content from PDF layouts..."
                                    />
                                </div>
                            </div>
                        )}

                        {/* 5. Clustering (Conditional) */}
                        {activeTab === 'clustering' && (
                            <>
                                <div className={styles.section}>
                                    <h3 className={styles.sectionTitle}>Clustering Logic</h3>
                                    <div className={styles.grid}>
                                        {renderInput('Article Window (Hours)', 'clustering_article_window_hours', 'number', 'Lookback period for grouping new articles.')}
                                        {renderInput('Context Window (Days)', 'clustering_story_context_days', 'number', 'Maintain story context for this duration.')}
                                        {renderInput('Minimum Story Strength', 'min_story_strength', 'number', 'Minimum articles required to form a cluster.')}
                                    </div>
                                </div>
                                <div className={styles.section}>
                                    <h3 className={styles.sectionTitle}>AI Configuration</h3>
                                    <div className={styles.grid}>
                                        <div className={styles.formGroup}>
                                            <label className={styles.label}>Clustering Model</label>
                                            <select
                                                value={settings.clustering_model || 'gemini-1.5-flash'}
                                                onChange={e => handleChange('clustering_model', e.target.value)}
                                                className={styles.select}
                                            >
                                                {availableModels.map(m => <option key={m} value={m}>{m}</option>)}
                                            </select>
                                        </div>
                                    </div>
                                    <div className={styles.formGroup} style={{ marginTop: '1.5rem' }}>
                                        <label className={styles.label}>Clustering System Prompt</label>
                                        <textarea
                                            value={settings.clustering_prompt || ''}
                                            onChange={e => handleChange('clustering_prompt', e.target.value)}
                                            rows={6}
                                            className={styles.textarea}
                                        />
                                    </div>
                                </div>
                            </>
                        )}
                    </form>
                </div>
            </main>
        </div>
    );
}

