'use client';

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { getCrawlStream, Source } from '../lib/api';

interface CrawlProgressModalProps {
    source: Source;
    onClose: () => void;
    onRefresh: () => void;
}

interface LogEntry {
    message: string;
    timestamp: string;
    type?: 'info' | 'error' | 'success' | 'warning';
}

export default function CrawlProgressModal({ source, onClose, onRefresh }: CrawlProgressModalProps) {
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [done, setDone] = useState(false);
    const [summary, setSummary] = useState<{ articles: number; status: string } | null>(null);
    const scrollRef = useRef<HTMLDivElement>(null);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
        let isCancelled = false;

        const startStream = async () => {
            try {
                const reader = await getCrawlStream(source.id);
                if (!reader) {
                    throw new Error('Could not establish connection to the crawler stream.');
                }

                const decoder = new TextDecoder();
                let buffer = '';

                while (!isCancelled) {
                    const { value, done: readerDone } = await reader.read();
                    if (readerDone) break;

                    buffer += decoder.decode(value, { stream: true });
                    const lines = buffer.split('\n');
                    buffer = lines.pop() || '';

                    for (const line of lines) {
                        const trimmed = line.trim();
                        if (!trimmed) continue;

                        if (trimmed.startsWith('data: ')) {
                            try {
                                const data = JSON.parse(trimmed.slice(6));
                                if (data.done) {
                                    setDone(true);
                                    onRefresh();
                                } else if (data.type === 'summary') {
                                    setSummary({ articles: data.articles, status: data.status });
                                } else {
                                    setLogs(prev => [...prev.slice(-199), {
                                        message: data.message || 'Processing...',
                                        timestamp: new Date().toLocaleTimeString(),
                                        type: data.status || 'info'
                                    }]);
                                }
                            } catch (e) {
                                console.error("Error parsing SSE data", e, trimmed);
                            }
                        }
                    }
                }
            } catch (e) {
                if (!isCancelled) {
                    const errorMsg = e instanceof Error ? e.message : String(e);
                    setLogs(prev => [...prev, {
                        message: `CRITICAL ERROR: ${errorMsg}`,
                        timestamp: new Date().toLocaleTimeString(),
                        type: 'error'
                    }]);
                    setSummary({ articles: 0, status: 'error' });
                    setDone(true);
                }
            }
        };

        startStream();
        return () => { isCancelled = true; };
    }, [source.id, onRefresh]);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [logs]);

    if (!mounted) return null;

    const modalContent = (
        <div style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.85)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 99999,
            backdropFilter: 'blur(12px)',
        }}>
            <div style={{
                background: '#0f172a',
                borderRadius: '24px',
                width: '95%',
                maxWidth: '1100px',
                height: '85vh',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                boxShadow: '0 30px 100px rgba(0,0,0,0.5)',
                border: '1px solid rgba(255,255,255,0.1)',
                color: '#f8fafc'
            }}>
                {/* Header */}
                <div style={{ padding: '2rem', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.02)' }}>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700, letterSpacing: '-0.02em' }}>Crawl Engine Output</h2>
                            <span style={{ padding: '2px 8px', background: 'rgba(59, 130, 246, 0.1)', color: '#60a5fa', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase' }}>{source.crawl_method || 'AUTO'}</span>
                        </div>
                        <div style={{ fontSize: '0.9rem', color: '#94a3b8', marginTop: '6px', fontWeight: 500 }}>
                            {source.name} <span style={{ margin: '0 8px', opacity: 0.3 }}>|</span> <span style={{ opacity: 0.7 }}>{source.url}</span>
                        </div>
                    </div>
                    {!done && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', background: 'rgba(255,255,255,0.05)', padding: '8px 16px', borderRadius: '12px' }}>
                            <div className="spinner" style={{ width: '16px', height: '16px' }}></div>
                            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#94a3b8' }}>LIVE STREAMING</span>
                        </div>
                    )}
                </div>

                {/* Log Terminal */}
                <div
                    ref={scrollRef}
                    style={{
                        flex: 1,
                        padding: '2rem',
                        background: 'rgba(0,0,0,0.2)',
                        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                        fontSize: '0.9rem',
                        overflowY: 'auto',
                        lineHeight: '1.7'
                    }}
                >
                    {logs.map((log, i) => (
                        <div key={i} style={{
                            marginBottom: '10px',
                            display: 'flex',
                            gap: '16px',
                            opacity: log.type === 'error' ? 1 : 0.9,
                        }}>
                            <span style={{ color: '#475569', whiteSpace: 'nowrap', userSelect: 'none' }}>[{log.timestamp}]</span>
                            <span style={{
                                color: log.type === 'error' ? '#f87171' :
                                    log.type === 'success' ? '#4ade80' :
                                        log.type === 'warning' ? '#fbbf24' : '#e2e8f0',
                                wordBreak: 'break-word',
                                fontWeight: log.type === 'error' ? 600 : 400
                            }}>
                                {log.type === 'error' && '✖ '}
                                {log.message}
                            </span>
                        </div>
                    ))}
                    {!done && logs.length === 0 && <div style={{ color: '#475569', fontStyle: 'italic' }}>Waiting for upstream data...</div>}
                </div>

                {/* Summary Section */}
                <div style={{
                    padding: '1.5rem 2rem',
                    background: 'rgba(255,255,255,0.02)',
                    borderTop: '1px solid rgba(255,255,255,0.05)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                }}>
                    <div style={{ display: 'flex', gap: '4rem' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <span style={{ color: '#64748b', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Process Status</span>
                            <div style={{
                                fontWeight: 700,
                                color: !summary ? '#94a3b8' : (summary.status === 'success' ? '#22c55e' : '#ef4444'),
                                textTransform: 'uppercase',
                                fontSize: '1.1rem',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px'
                            }}>
                                {!summary ? 'RUNNING' : (summary.status === 'success' ? '✔ COMPLETED' : '✖ FAILED')}
                            </div>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <span style={{ color: '#64748b', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Items Downloaded</span>
                            <div style={{ fontWeight: 700, fontSize: '1.25rem' }}>{summary?.articles ?? 0}</div>
                        </div>
                    </div>

                    <button
                        onClick={onClose}
                        disabled={!done}
                        style={{
                            padding: '0.9rem 2.5rem',
                            borderRadius: '16px',
                            border: 'none',
                            background: !done ? 'rgba(255,255,255,0.05)' : (summary?.status === 'error' ? '#ef4444' : '#3b82f6'),
                            color: !done ? '#475569' : '#fff',
                            cursor: done ? 'pointer' : 'not-allowed',
                            fontWeight: 700,
                            fontSize: '1rem',
                            transition: 'all 0.2s ease',
                            boxShadow: done ? '0 10px 30px rgba(0,0,0,0.3)' : 'none',
                        }}
                    >
                        {done ? 'Dismiss Log' : 'Processing...'}
                    </button>
                </div>
            </div>
        </div>
    );

    return createPortal(modalContent, document.body);
}
