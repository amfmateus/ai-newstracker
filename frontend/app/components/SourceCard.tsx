'use client';

import { Source, deleteSource, triggerCrawl, updateSource } from '../lib/api';
import { useState } from 'react';
import DeleteSourceModal from './DeleteSourceModal';
import AlertModal, { AlertType } from './AlertModal';

interface SourceCardProps {
    source: Source;
    onUpdate: () => void;
    onEdit: () => void;
    onCrawl: (source: Source) => void;
}

export default function SourceCard({ source, onUpdate, onEdit, onCrawl }: SourceCardProps) {
    const [crawling, setCrawling] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [alertState, setAlertState] = useState<{ isOpen: boolean; message: string; type: AlertType }>({
        isOpen: false,
        message: '',
        type: 'info'
    });

    // Pause/Resume Logic
    const togglePause = async () => {
        const newStatus = source.status === 'active' ? 'paused' : 'active';
        await updateSource(source.id, { status: newStatus });
        onUpdate();
    };

    const handleCrawl = async () => {
        onCrawl(source);
    };

    const handleDelete = async () => {
        setShowDeleteModal(true);
    };

    // Style helpers
    const isActive = source.status === 'active';
    const isCrawling = source.status === 'crawling';
    const isPaused = source.status === 'paused';
    const isError = source.status === 'error';

    const statusColor = isCrawling ? '#3B82F6' : isActive ? '#10B981' : isPaused ? '#F59E0B' : '#EF4444';
    const statusLabel = isCrawling ? 'Crawling' : isActive ? 'Active' : isPaused ? 'Paused' : 'Error';

    // Crawl Type Logic
    let typeLabel = 'HTML';
    let typeColor = '#2563eb'; // blue
    let typeBg = '#eff6ff';
    let typeBorder = '#dbeafe';

    if (source.crawl_method === 'pdf') {
        typeLabel = 'PDF';
        typeColor = '#db2777'; // pink/rose
        typeBg = '#fdf2f8';
        typeBorder = '#fce7f3';
    } else if (source.crawl_method === 'rss' || source.type === 'rss') {
        typeLabel = 'RSS';
        typeColor = '#d97706'; // amber/orange
        typeBg = '#fffbeb';
        typeBorder = '#fef3c7';
    }

    // Helper for relative time
    const timeAgo = (dateStr: string | undefined) => {
        if (!dateStr) return 'Never';
        const date = new Date(dateStr);
        const now = new Date();
        const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

        if (seconds < 60) return 'Just now';
        const minutes = Math.floor(seconds / 60);
        if (minutes < 60) return `${minutes}m ago`;
        const hours = Math.floor(minutes / 60);
        if (hours < 24) return `${hours}h ago`;
        return `${Math.floor(hours / 24)}d ago`;
    };

    // Helper for next crawl
    const getNextCrawl = () => {
        if (source.status === 'paused') return 'Paused';
        if (!source.last_crawled_at) return 'Pending';
        const last = new Date(source.last_crawled_at).getTime();
        const interval = (source.crawl_interval || 60) * 60 * 1000;
        const next = last + interval;
        const diff = next - Date.now();

        if (diff <= 0) return 'Due';

        const minutes = Math.ceil(diff / 60000);
        if (minutes < 60) return `in ${minutes}m`;
        const hours = Math.floor(minutes / 60);
        return `in ${hours}h`;
    };

    return (
        <div style={{
            background: '#ffffff',
            borderRadius: '12px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
            border: '1px solid #e5e5e5',
            padding: '1.25rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
            transition: 'transform 0.2s, box-shadow 0.2s',
            position: 'relative'
        }}
            onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
            onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
        >
            {/* Header: Name and Status */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600, color: '#111', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '70%' }}>
                    {source.name || 'Unknown Source'}
                </h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    {/* Crawl Type Badge */}
                    <div style={{
                        fontSize: '0.7rem',
                        fontWeight: 600,
                        color: typeColor,
                        background: typeBg,
                        padding: '0.2rem 0.5rem',
                        borderRadius: '4px',
                        border: `1px solid ${typeBorder}`,
                        textTransform: 'uppercase',
                        letterSpacing: '0.02em'
                    }}>
                        {typeLabel}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', fontWeight: 500, color: '#666', background: '#f5f5f5', padding: '0.2rem 0.6rem', borderRadius: '20px' }}>
                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: statusColor }}></div>
                        {statusLabel}
                    </div>
                </div>
            </div>

            {/* URL */}
            <div style={{ fontSize: '0.85rem', color: '#888', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {source.url}
            </div>

            {/* Metrics Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.2fr) minmax(0, 0.8fr)', gap: '0.8rem', marginTop: '0.5rem' }}>
                {/* Last Crawl Box */}
                <div style={{ background: '#fafafa', padding: '0.6rem 0.8rem', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                    <div style={{ fontSize: '0.7rem', color: '#999', textTransform: 'uppercase', fontWeight: 600, marginBottom: '0.2rem' }}>Last Crawl</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <span style={{ fontSize: '0.9rem', fontWeight: 500, color: '#333' }}>
                            {timeAgo(source.last_crawled_at)}
                        </span>

                        {/* Status Icon */}
                        {source.last_crawl_status && (
                            <div title={source.last_crawl_status} style={{ display: 'flex', alignItems: 'center' }}>
                                {source.last_crawl_status === 'success' ? (
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                        <polyline points="20 6 9 17 4 12"></polyline>
                                    </svg>
                                ) : (
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                        <line x1="18" y1="6" x2="6" y2="18"></line>
                                        <line x1="6" y1="6" x2="18" y2="18"></line>
                                    </svg>
                                )}
                            </div>
                        )}

                        {/* Yield Count */}
                        {source.last_crawl_count !== undefined && source.last_crawl_count !== null && (
                            <span style={{ fontSize: '0.75rem', color: '#666', background: '#e5e7eb', padding: '1px 5px', borderRadius: '4px', marginLeft: 'auto' }}>
                                +{source.last_crawl_count}
                            </span>
                        )}
                    </div>
                </div>

                {/* Interval Box */}
                <div style={{ background: '#fafafa', padding: '0.6rem 0.8rem', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                    <div style={{ fontSize: '0.7rem', color: '#999', textTransform: 'uppercase', fontWeight: 600, marginBottom: '0.2rem' }}>Interval</div>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
                        <div style={{ fontSize: '0.9rem', fontWeight: 500, color: '#333' }}>
                            {source.crawl_interval ? `${(source.crawl_interval / 60).toFixed(1).replace('.0', '')}h` : '1h'}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: '#666' }}>
                            ({getNextCrawl()})
                        </div>
                    </div>
                </div>
            </div>

            {/* Actions Footer */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto', paddingTop: '1rem', borderTop: '1px solid #f0f0f0' }}>

                {/* Left: Pause/Resume Toggle */}
                <button
                    onClick={togglePause}
                    title={isActive ? "Pause Crawling" : "Resume Crawling"}
                    style={{
                        background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem', padding: '0.2rem',
                        opacity: 0.8, color: isActive ? '#10B981' : '#ccc'
                    }}
                >
                    {isActive ? '⏸' : '▶'}
                </button>

                {/* Right: Actions */}
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                        onClick={handleCrawl}
                        disabled={crawling}
                        title="Crawl Now"
                        style={{ background: '#f0f9ff', color: '#0369a1', border: 'none', borderRadius: '6px', padding: '0.4rem 0.8rem', fontSize: '0.8rem', cursor: 'pointer', fontWeight: 600 }}
                    >
                        {crawling ? '...' : 'Crawl'}
                    </button>

                    <button
                        onClick={onEdit}
                        title="Configure"
                        style={{ background: '#f3f4f6', color: '#4b5563', border: 'none', borderRadius: '6px', padding: '0.4rem 0.6rem', fontSize: '0.9rem', cursor: 'pointer' }}
                    >
                        ⚙
                    </button>

                    <button
                        onClick={handleDelete}
                        disabled={deleting}
                        title="Delete Source"
                        style={{ background: '#fef2f2', color: '#ef4444', border: 'none', borderRadius: '6px', padding: '0.4rem 0.6rem', fontSize: '0.9rem', cursor: 'pointer' }}
                    >
                        🗑
                    </button>
                </div>
            </div>

            {showDeleteModal && (
                <DeleteSourceModal
                    source={source}
                    onClose={() => setShowDeleteModal(false)}
                    onConfirm={async (deleteArticles) => {
                        setDeleting(true);
                        try {
                            await deleteSource(source.id, deleteArticles);
                            onUpdate();
                        } catch (e) {
                            setAlertState({ isOpen: true, message: 'Failed to delete source', type: 'error' });
                            setDeleting(false);
                        } finally {
                            setShowDeleteModal(false);
                        }
                    }}
                />
            )}

            <AlertModal
                isOpen={alertState.isOpen}
                message={alertState.message}
                type={alertState.type}
                onClose={() => setAlertState(prev => ({ ...prev, isOpen: false }))}
            />
        </div>
    );
}
