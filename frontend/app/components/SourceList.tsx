'use client';

import { Source, triggerCrawl, deleteSource, updateSource } from '../lib/api';
import styles from './SourceList.module.css';
import { useState, useEffect } from 'react';

import DeleteSourceModal from './DeleteSourceModal';
import AlertModal, { AlertType } from './AlertModal';

export default function SourceList({ sources, onRefresh }: { sources: Source[], onRefresh: () => void }) {
    const [crawling, setCrawling] = useState<string | null>(null);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [sourceToDelete, setSourceToDelete] = useState<Source | null>(null);
    const [editName, setEditName] = useState('');
    const [alertState, setAlertState] = useState<{ isOpen: boolean; message: string; type: AlertType }>({
        isOpen: false,
        message: '',
        type: 'info'
    });

    // Poll for updates every 3 seconds if any source is crawling
    useEffect(() => {
        const interval = setInterval(() => {
            // We could optimize this to only poll if we know something is crawling,
            // but for now, simple polling ensures we catch backend state changes.
            onRefresh();
        }, 3000);
        return () => clearInterval(interval);
    }, [onRefresh]);

    const handleCrawl = async (id: string) => {
        setCrawling(id);
        try {
            await triggerCrawl(id);
            // Trigger an immediate refresh to try and catch the 'crawling' status early
            setTimeout(onRefresh, 500);
        } catch (e) {
            console.error('Failed to trigger crawl', e);
        } finally {
            setCrawling(null);
        }
    };

    const startEditing = (source: Source) => {
        setEditingId(source.id);
        setEditName(source.name || '');
    };

    const cancelEditing = () => {
        setEditingId(null);
        setEditName('');
    };

    const saveName = async (id: string) => {
        try {
            await updateSource(id, { name: editName });
            setEditingId(null);
            onRefresh();
        } catch (e) {
            setAlertState({ isOpen: true, message: 'Failed to update name', type: 'error' });
        }
    };

    return (
        <div className={styles.list}>
            {sources.length === 0 && <p>No sources found.</p>}
            {sources.map((source) => (
                <div key={source.id} className={styles.item}>
                    <div className={styles.info}>
                        <div className={styles.url} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            {editingId === source.id ? (
                                <div style={{ display: 'flex', gap: '5px' }}>
                                    <input
                                        value={editName}
                                        onChange={(e) => setEditName(e.target.value)}
                                        className={styles.input} // Reusing input style or add inline style
                                        style={{ padding: '4px', fontSize: '1rem' }}
                                    />
                                    <button onClick={() => saveName(source.id)} style={{ cursor: 'pointer', padding: '0 5px' }}>✅</button>
                                    <button onClick={cancelEditing} style={{ cursor: 'pointer', padding: '0 5px' }}>❌</button>
                                </div>
                            ) : (
                                <>
                                    <span>{source.name || source.url}</span>
                                    <button
                                        onClick={() => startEditing(source)}
                                        style={{
                                            background: 'none',
                                            border: 'none',
                                            cursor: 'pointer',
                                            fontSize: '1em',
                                            opacity: 0.6
                                        }}
                                        title="Rename Source"
                                    >
                                        ✏️
                                    </button>
                                </>
                            )}

                            <span style={{ fontSize: '0.8em', color: '#999', fontWeight: 'normal', marginLeft: '8px' }}>
                                ({source.url})
                            </span>
                        </div>
                        <div style={{ fontSize: '0.8em', color: '#666', marginTop: '4px' }}>
                            Last 24h: {source.crawls_24h ?? 0} crawls, {source.articles_24h ?? 0} articles
                            {source.last_crawled_at && ` • Last active: ${new Date(source.last_crawled_at).toLocaleString()}`}
                        </div>
                        <div className={styles.meta}>
                            <div className={styles.meta}>
                                Type: {source.type} •
                                <span style={{ marginLeft: '10px', display: 'inline-flex', alignItems: 'center' }}>
                                    <span className={`${styles.statusIndicator} ${styles['status_' + source.status] || ''}`} />
                                    {source.status}
                                </span>
                            </div>
                        </div>
                    </div>
                    <div className={styles.actions} style={{ display: 'flex', gap: '10px' }}>
                        <button
                            onClick={() => handleCrawl(source.id)}
                            disabled={crawling === source.id}
                            className={styles.button}
                        >
                            {crawling === source.id ? 'Crawling...' : 'Crawl Now'}
                        </button>
                        <button
                            onClick={() => setSourceToDelete(source)}
                            className={styles.button}
                            style={{ backgroundColor: '#fee2e2', color: '#dc2626', borderColor: '#fca5a5' }}
                        >
                            Delete
                        </button>
                    </div>
                </div>
            ))}

            <DeleteSourceModal
                source={sourceToDelete}
                onClose={() => setSourceToDelete(null)}
                onConfirm={async (deleteArticles) => {
                    if (!sourceToDelete) return;
                    try {
                        await deleteSource(sourceToDelete.id, deleteArticles);
                        onRefresh();
                        setSourceToDelete(null);
                    } catch (e) {
                        setAlertState({ isOpen: true, message: 'Failed to delete source', type: 'error' });
                    }
                }}
            />
            <AlertModal
                isOpen={alertState.isOpen}
                message={alertState.message}
                type={alertState.type}
                onClose={() => setAlertState(prev => ({ ...prev, isOpen: false }))}
            />
        </div>
    );
}
