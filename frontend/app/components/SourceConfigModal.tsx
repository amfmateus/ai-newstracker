'use client';

import { useState } from 'react';
import { Source, updateSource } from '../lib/api';
import AlertModal, { AlertType } from './AlertModal';

interface SourceConfigModalProps {
    source: Source;
    onClose: () => void;
    onUpdate: () => void;
}

export default function SourceConfigModal({ source, onClose, onUpdate }: SourceConfigModalProps) {
    const [name, setName] = useState(source.name || '');
    const [referenceName, setReferenceName] = useState(source.reference_name || '');
    const [interval, setInterval] = useState(source.crawl_interval || 60);
    const [status, setStatus] = useState(source.status);
    const [crawlMethod, setCrawlMethod] = useState(source.crawl_method);

    // Advanced Config
    const [maxArticles, setMaxArticles] = useState(source.config?.max_articles || 100);
    const [minRelevance, setMinRelevance] = useState(source.config?.min_relevance || 50);
    const [minLength, setMinLength] = useState(source.config?.min_length || 200);
    const [timeout, setTimeoutVal] = useState(source.config?.timeout || 30);
    const [lookback, setLookback] = useState(source.config?.lookback || 24);

    const [processing, setProcessing] = useState(false);
    const [alertState, setAlertState] = useState<{ isOpen: boolean; message: string; type: AlertType }>({
        isOpen: false,
        message: '',
        type: 'info'
    });

    const handleSave = async () => {
        setProcessing(true);
        try {
            await updateSource(source.id, {
                name,
                reference_name: referenceName,
                crawl_interval: interval,
                status,
                crawl_method: crawlMethod,
                crawl_config: {
                    max_articles: maxArticles,
                    min_relevance: minRelevance,
                    min_length: minLength,
                    timeout: timeout,
                    lookback: lookback
                }
            });
            onUpdate();
            onClose();
            onClose();
        } catch (error) {
            setAlertState({ isOpen: true, message: 'Failed to update source', type: 'error' });
        } finally {
            setProcessing(false);
        }
    };

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
            <div style={{
                background: '#fff', padding: '2rem', borderRadius: '12px', width: '500px', maxWidth: '95%',
                boxShadow: '0 10px 30px rgba(0,0,0,0.2)',
                maxHeight: '90vh', overflowY: 'auto'
            }}>
                <h3 style={{ marginTop: 0, marginBottom: '1.5rem', color: '#333' }}>Configure Source</h3>

                <div style={{ marginBottom: '1rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.4rem', fontWeight: 500, color: '#555' }}>Source URL</label>
                    <div style={{
                        padding: '0.6rem',
                        background: '#f9f9f9',
                        borderRadius: '6px',
                        border: '1px solid #e5e5e5',
                        fontSize: '0.85rem',
                        color: '#666',
                        wordBreak: 'break-all'
                    }}>
                        <a href={source.url} target="_blank" rel="noopener noreferrer" style={{ color: '#2563eb', textDecoration: 'none' }}>
                            {source.url}
                        </a>
                    </div>
                </div>

                <div style={{ marginBottom: '1rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.4rem', fontWeight: 500, color: '#555' }}>Source Name</label>
                    <input
                        value={name} onChange={e => setName(e.target.value)}
                        style={{ width: '100%', padding: '0.6rem', borderRadius: '6px', border: '1px solid #ddd', fontSize: '1rem' }}
                    />
                </div>

                <div style={{ marginBottom: '1rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.4rem', fontWeight: 500, color: '#555' }}>Reference Name (Citations)</label>
                    <input
                        value={referenceName} onChange={e => setReferenceName(e.target.value)}
                        placeholder="e.g. Infobae, NYT"
                        style={{ width: '100%', padding: '0.6rem', borderRadius: '6px', border: '1px solid #ddd', fontSize: '1rem' }}
                    />
                    <small style={{ color: '#888', display: 'block', marginTop: '0.3rem' }}>Used when citing articles from this source in reports.</small>
                </div>

                <div style={{ marginBottom: '1rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.4rem', fontWeight: 500, color: '#555' }}>Crawl Interval</label>
                    <select
                        value={interval} onChange={e => setInterval(Number(e.target.value))}
                        style={{ width: '100%', padding: '0.6rem', borderRadius: '6px', border: '1px solid #ddd', fontSize: '1rem' }}
                    >
                        <option value={60}>Every 1 Hour</option>
                        <option value={120}>Every 2 Hours</option>
                        <option value={360}>Every 6 Hours</option>
                        <option value={720}>Every 12 Hours</option>
                        <option value={1440}>Every 24 Hours</option>
                    </select>
                </div>

                <div style={{ marginBottom: '1rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.4rem', fontWeight: 500, color: '#555' }}>Crawl Method</label>
                    <select
                        value={crawlMethod} onChange={e => setCrawlMethod(e.target.value as any)}
                        style={{ width: '100%', padding: '0.6rem', borderRadius: '6px', border: '1px solid #ddd', fontSize: '1rem' }}
                    >
                        <option value="html">Smart HTML (AI-Powered)</option>
                        <option value="rss">RSS Feed</option>
                        <option value="pdf">Visual / PDF</option>
                    </select>
                </div>

                <div style={{ marginBottom: '1.5rem', padding: '1rem', background: '#f9f9f9', borderRadius: '8px' }}>
                    <h4 style={{ margin: '0 0 1rem 0', fontSize: '0.9rem', color: '#666', textTransform: 'uppercase' }}>Advanced Settings</h4>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1rem' }}>
                        <div>
                            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.3rem' }}>Max Items per Crawl</label>
                            <input type="number" value={maxArticles} onChange={e => setMaxArticles(Number(e.target.value))} style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #ddd' }} />
                            <small style={{ color: '#888', display: 'block', marginTop: '0.2rem' }}>Total limit of items to process.</small>
                        </div>
                        <div>
                            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.3rem' }}>Min Relevance (0-100)</label>
                            <input type="number" value={minRelevance} onChange={e => setMinRelevance(Number(e.target.value))} style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #ddd' }} />
                            <small style={{ color: '#888', display: 'block', marginTop: '0.2rem' }}>AI quality threshold.</small>
                        </div>
                        <div>
                            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.3rem' }}>Min Text Length</label>
                            <input type="number" value={minLength} onChange={e => setMinLength(Number(e.target.value))} style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #ddd' }} />
                            <small style={{ color: '#888', display: 'block', marginTop: '0.2rem' }}>Filter out short noise.</small>
                        </div>
                        <div>
                            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.3rem' }}>Page Timeout (sec)</label>
                            <input type="number" value={timeout} onChange={e => setTimeoutVal(Number(e.target.value))} style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #ddd' }} />
                            <small style={{ color: '#888', display: 'block', marginTop: '0.2rem' }}>Max wait for page load.</small>
                        </div>
                        <div>
                            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.3rem' }}>First Crawl Lookback (hours)</label>
                            <input type="number" value={lookback} onChange={e => setLookback(Number(e.target.value))} style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #ddd' }} />
                            <small style={{ color: '#888', display: 'block', marginTop: '0.2rem' }}>How far back on first crawl.</small>
                        </div>
                    </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                    <button onClick={onClose} style={{ padding: '0.7rem 1.2rem', background: 'none', border: 'none', cursor: 'pointer', color: '#666' }}>Cancel</button>
                    <button
                        onClick={handleSave}
                        disabled={processing}
                        style={{
                            padding: '0.7rem 1.2rem', background: '#222', color: '#fff',
                            border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600
                        }}
                    >
                        {processing ? 'Saving...' : 'Save Changes'}
                    </button>
                </div>
            </div>

            <AlertModal
                isOpen={alertState.isOpen}
                message={alertState.message}
                type={alertState.type}
                onClose={() => setAlertState(prev => ({ ...prev, isOpen: false }))}
            />
        </div >
    );
}
