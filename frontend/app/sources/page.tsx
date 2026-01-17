'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Source, fetchSources } from '../lib/api';
import SourceCard from '../components/SourceCard';
import SourceConfigModal from '../components/SourceConfigModal';
import AddSourceDrawer from '../components/AddSourceDrawer';
import CrawlProgressModal from '../components/CrawlProgressModal';
import styles from './page.module.css';

export default function SourcesPage() {
    const { status } = useSession();
    const [sources, setSources] = useState<Source[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [editingSource, setEditingSource] = useState<Source | null>(null);
    const [crawlingSource, setCrawlingSource] = useState<Source | null>(null);
    const [isAddDrawerOpen, setIsAddDrawerOpen] = useState(false);

    const router = useRouter();

    const loadSources = useCallback(() => {
        setLoading(true);
        fetchSources()
            .then(data => {
                if (Array.isArray(data)) {
                    setSources(data);
                } else {
                    console.error("fetchSources returned non-array:", data);
                    setSources([]);
                }
            })
            .catch(err => {
                console.error(err);
                setError('Failed to load sources');
            })
            .finally(() => setLoading(false));
    }, []);

    useEffect(() => {
        if (status === 'loading') return;
        if (status === 'unauthenticated') {
            setLoading(false);
            return;
        }
        loadSources();
    }, [status]);

    const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
        crawling: true,
        active: true,
        paused: true,
        error: true
    });

    const toggleSection = (section: string) => {
        setExpandedSections(prev => ({
            ...prev,
            [section]: !prev[section]
        }));
    };

    const safeSources = Array.isArray(sources) ? sources : [];

    const groupedSources = {
        crawling: safeSources.filter(s => s.status === 'crawling').sort((a, b) => (a.name || a.url).localeCompare(b.name || b.url)),
        active: safeSources.filter(s => s.status === 'active').sort((a, b) => (a.name || a.url).localeCompare(b.name || b.url)),
        paused: safeSources.filter(s => s.status === 'paused').sort((a, b) => (a.name || a.url).localeCompare(b.name || b.url)),
        error: safeSources.filter(s => s.status === 'error').sort((a, b) => (a.name || a.url).localeCompare(b.name || b.url))
    };

    const renderSection = (title: string, statusKey: 'crawling' | 'active' | 'paused' | 'error', list: Source[]) => {
        const isExpanded = expandedSections[statusKey];

        return (
            <div style={{ marginBottom: '2.5rem' }}>
                <div
                    onClick={() => toggleSection(statusKey)}
                    style={{
                        display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer',
                        marginBottom: '1.25rem', paddingBottom: '0.75rem', borderBottom: '1px solid #f0f0f0'
                    }}
                >
                    <span style={{ fontSize: '0.8rem', transform: isExpanded ? 'rotate(90deg)' : 'rotate(0)', transition: 'transform 0.2s', color: '#999' }}>▶</span>
                    <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, color: '#111' }}>
                        {title}
                        <span style={{ fontSize: '0.9rem', color: '#999', fontWeight: 500, marginLeft: '0.5rem' }}>
                            {list.length}
                        </span>
                    </h2>
                </div>

                {isExpanded && (
                    <>
                        {list.length === 0 ? (
                            <div style={{ fontStyle: 'italic', color: '#ccc', fontSize: '0.9rem', paddingLeft: '1.75rem' }}>
                                No sources in this group.
                            </div>
                        ) : (
                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
                                gap: '1.5rem'
                            }}>
                                {list.map(source => (
                                    <SourceCard
                                        key={source.id}
                                        source={source}
                                        onUpdate={loadSources}
                                        onEdit={() => setEditingSource(source)}
                                        onCrawl={(src) => setCrawlingSource(src)}
                                    />
                                ))}
                            </div>
                        )}
                    </>
                )}
            </div>
        );
    };

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <div className={styles.headerRow}>
                    <h1 className={styles.title}>Sources</h1>
                    <button
                        className={styles.btnAddSource}
                        onClick={() => setIsAddDrawerOpen(true)}
                    >
                        <span>+</span> Add Source
                    </button>
                </div>
            </header>

            <main className={styles.main}>
                {loading && sources.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '4rem', color: '#999' }}>Loading sources...</div>
                ) : (
                    <>
                        {renderSection('Crawling Now', 'crawling', groupedSources.crawling)}
                        {renderSection('Active Sources', 'active', groupedSources.active)}
                        {renderSection('Paused Sources', 'paused', groupedSources.paused)}
                        {renderSection('Error Sources', 'error', groupedSources.error)}

                        {sources.length === 0 && !loading && (
                            <div style={{ textAlign: 'center', padding: '6rem 2rem', background: '#f9f9f9', borderRadius: '16px', border: '2px dashed #eee' }}>
                                <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📡</div>
                                <h3 style={{ margin: '0 0 0.5rem' }}>No sources found</h3>
                                <p style={{ color: '#888', margin: '0 0 1.5rem' }}>Get started by adding your first news source.</p>
                                <button
                                    className={styles.btnAddSource}
                                    style={{ margin: '0 auto' }}
                                    onClick={() => setIsAddDrawerOpen(true)}
                                >
                                    Add Your First Source
                                </button>
                            </div>
                        )}
                    </>
                )}
            </main>

            <AddSourceDrawer
                isOpen={isAddDrawerOpen}
                onClose={() => setIsAddDrawerOpen(false)}
                onSourceAdded={loadSources}
            />

            {editingSource && (
                <SourceConfigModal
                    source={editingSource}
                    onClose={() => setEditingSource(null)}
                    onUpdate={loadSources}
                />
            )}

            {crawlingSource && (
                <CrawlProgressModal
                    source={crawlingSource}
                    onClose={() => setCrawlingSource(null)}
                    onRefresh={loadSources}
                />
            )}
        </div>
    );
}
