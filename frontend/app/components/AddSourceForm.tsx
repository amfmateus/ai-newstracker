'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { createSource, Source, fetchSettings, SystemSettings } from '../lib/api';
import styles from './AddSourceForm.module.css';
import SourceSuccessModal from './SourceSuccessModal';
import { useEffect } from 'react';
import AlertModal, { AlertType } from './AlertModal';

interface AddSourceFormProps {
    onSourceAdded: () => void;
    onCancel: () => void;
}

export default function AddSourceForm({ onSourceAdded, onCancel }: AddSourceFormProps) {
    const { status } = useSession();
    const [url, setUrl] = useState('');
    const [name, setName] = useState('');
    const [referenceName, setReferenceName] = useState('');
    const [crawlInterval, setCrawlInterval] = useState(60); // Default 1h
    const [crawlMethod, setCrawlMethod] = useState<'auto' | 'pdf' | 'rss' | 'html'>('html');

    // Success Modal State
    const [addedSource, setAddedSource] = useState<Source | null>(null);

    // Config state
    const [maxArticles, setMaxArticles] = useState<number | undefined>(undefined);
    const [minRelevance, setMinRelevance] = useState<number | undefined>(undefined);
    const [minLength, setMinLength] = useState<number | undefined>(undefined);
    const [timeout, setTimeoutVal] = useState<number | undefined>(undefined);
    const [lookback, setLookback] = useState<number | undefined>(undefined);

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [sysSettings, setSysSettings] = useState<SystemSettings | null>(null);
    const [alertState, setAlertState] = useState<{ isOpen: boolean; message: string; type: AlertType }>({
        isOpen: false,
        message: '',
        type: 'info'
    });

    useEffect(() => {
        const loadSettings = async () => {
            try {
                const s = await fetchSettings();
                setSysSettings(s);
            } catch (e) {
                console.error("Failed to load settings for placeholders", e);
            }
        };
        loadSettings();
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        console.log("Submitting form:", { url, name, crawlMethod }); // DEBUG

        // Normalize URL (prepend https:// if missing)
        let finalUrl = url.trim();
        if (!finalUrl.match(/^https?:\/\//)) {
            finalUrl = `https://${finalUrl}`;
        }

        setLoading(true);
        setError(null);

        try {
            console.log("Calling createSource with:", finalUrl); // DEBUG
            const config: any = {};
            if (maxArticles !== undefined) config.max_articles = maxArticles;
            if (minRelevance !== undefined) config.min_relevance = minRelevance;
            if (minLength !== undefined) config.min_length = minLength;
            if (timeout !== undefined) config.timeout = timeout;
            if (lookback !== undefined) config.lookback = lookback;


            const newSource = await createSource(finalUrl, crawlInterval, crawlMethod, name || undefined, referenceName || undefined, config);
            console.log("Source added successfully"); // DEBUG

            // Show success modal (do not reset yet)
            setAddedSource(newSource);

        } catch (err: any) {
            console.error("Add Source Error:", err); // DEBUG
            const msg = err.message || 'Failed to add source';
            setError(msg);
            setAlertState({ isOpen: true, message: `Error: ${msg}`, type: 'error' });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className={styles.container}>
            <h3 className={styles.title}>Add New Source</h3>

            <div className={styles.formGroup}>
                <label className={styles.label}>Source URL</label>
                <input
                    type="text"
                    required
                    placeholder="example.com/news"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    className={styles.input}
                />
            </div>

            <div className={styles.formGroup}>
                <label className={styles.label}>Source Name (Optional)</label>
                <input
                    type="text"
                    placeholder="e.g. 'The Daily Tech'"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className={styles.input}
                />
            </div>

            <div className={styles.formGroup}>
                <label className={styles.label}>Reference Name (Citations)</label>
                <input
                    type="text"
                    placeholder="e.g. 'TechDaily'"
                    value={referenceName}
                    onChange={(e) => setReferenceName(e.target.value)}
                    className={styles.input}
                />
                <span className={styles.helpText}>Used for citations in your reports (e.g. "(TechDaily)").</span>
            </div>

            <div className={styles.formGroup}>
                <label className={styles.label}>Crawl Method</label>
                <div className={styles.cardGrid}>
                    <div
                        onClick={() => setCrawlMethod('html')}
                        className={`${styles.card} ${crawlMethod === 'html' ? styles.cardSelected : ''}`}
                    >
                        <div className={styles.cardIcon}>🧠</div>
                        <div className={styles.cardTitle}>Smart HTML</div>
                        <div className={styles.cardDesc}>AI-Powered Single Pass</div>
                    </div>

                    <div
                        onClick={() => setCrawlMethod('rss')}
                        className={`${styles.card} ${crawlMethod === 'rss' ? styles.cardSelected : ''}`}
                    >
                        <div className={styles.cardIcon}>📡</div>
                        <div className={styles.cardTitle}>RSS Feed</div>
                        <div className={styles.cardDesc}>Fast & Structured</div>
                    </div>

                    <div
                        onClick={() => setCrawlMethod('pdf')}
                        className={`${styles.card} ${crawlMethod === 'pdf' ? styles.cardSelected : ''}`}
                    >
                        <div className={styles.cardIcon}>👁️</div>
                        <div className={styles.cardTitle}>Visual / PDF</div>
                        <div className={styles.cardDesc}>AI Vision Analysis</div>
                    </div>
                </div>
            </div>

            <div className={styles.formGroup}>
                <label className={styles.label}>Crawl Interval</label>
                <select
                    value={crawlInterval}
                    onChange={(e) => setCrawlInterval(Number(e.target.value))}
                    className={styles.select}
                >
                    <option value={60}>Every 1 Hour</option>
                    <option value={120}>Every 2 Hours</option>
                    <option value={360}>Every 6 Hours</option>
                    <option value={720}>Every 12 Hours</option>
                    <option value={1440}>Every 24 Hours</option>
                </select>
            </div>

            <div className={styles.divider}>
                <span>Advanced Settings</span>
            </div>

            <div className={styles.advancedContainer}>
                <div className={styles.advancedGrid}>
                    <div className={styles.formGroup}>
                        <label className={styles.label}>Max Items per Crawl</label>
                        <input
                            type="number"
                            value={maxArticles ?? ''}
                            onChange={(e) => setMaxArticles(e.target.value ? Number(e.target.value) : undefined)}
                            placeholder={sysSettings ? `Default: ${sysSettings.max_articles_to_scrape}` : "e.g. 100"}
                            className={styles.input}
                        />
                        <span className={styles.helpText}>Maximum articles or feed entries to process.</span>
                    </div>

                    <div className={styles.formGroup}>
                        <label className={styles.label}>Min Relevance (0-100)</label>
                        <input
                            type="number"
                            value={minRelevance ?? ''}
                            onChange={(e) => setMinRelevance(e.target.value ? Number(e.target.value) : undefined)}
                            placeholder={sysSettings ? `Default: ${sysSettings.min_relevance_score}` : "e.g. 50"}
                            className={styles.input}
                        />
                        <span className={styles.helpText}>AI score threshold. 0 = keep everything.</span>
                    </div>

                    <div className={styles.formGroup}>
                        <label className={styles.label}>Min Content Length</label>
                        <input
                            type="number"
                            value={minLength ?? ''}
                            onChange={(e) => setMinLength(e.target.value ? Number(e.target.value) : undefined)}
                            placeholder={sysSettings ? `Default: ${sysSettings.min_text_length}` : "e.g. 200"}
                            className={styles.input}
                        />
                        <span className={styles.helpText}>Short snippets or navigation fragments are discarded.</span>
                    </div>


                    <div className={styles.formGroup}>
                        <label className={styles.label}>Page Timeout (sec)</label>
                        <input
                            type="number"
                            value={timeout ?? ''}
                            onChange={(e) => setTimeoutVal(e.target.value ? Number(e.target.value) : undefined)}
                            placeholder={sysSettings ? `Default: ${sysSettings.page_load_timeout_seconds}` : "e.g. 30"}
                            className={styles.input}
                        />
                        <span className={styles.helpText}>Time to wait for slow-loading pages or JavaScript.</span>
                    </div>

                    <div className={styles.formGroup}>
                        <label className={styles.label}>First Crawl Lookback (hours)</label>
                        <input
                            type="number"
                            value={lookback ?? ''}
                            onChange={(e) => setLookback(e.target.value ? Number(e.target.value) : undefined)}
                            placeholder={sysSettings ? `Default: ${sysSettings.first_crawl_lookback_hours}` : "e.g. 24"}
                            className={styles.input}
                        />
                        <span className={styles.helpText}>Max article age allowed during the very first crawl.</span>
                    </div>
                </div>
            </div>

            {error && <div className={styles.error}>{error}</div>}

            <div className={styles.actions}>
                <button type="button" onClick={onCancel} className={`${styles.button} ${styles.buttonSecondary}`}>
                    Cancel
                </button>
                <button type="button" disabled={loading} onClick={handleSubmit} className={`${styles.button} ${styles.buttonPrimary}`}>
                    {loading ? 'Adding...' : 'Add Source'}
                </button>
            </div>

            {addedSource && (
                <SourceSuccessModal
                    source={addedSource}
                    onClose={() => {
                        setAddedSource(null);
                        setUrl('');
                        setName('');
                        setReferenceName('');
                        setCrawlInterval(60);
                        setCrawlMethod('html');
                        setMaxArticles(undefined);
                        setMinRelevance(undefined);
                        setMinLength(undefined);
                        onSourceAdded(); // Refresh list
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
