'use client';

import { useState, useEffect } from 'react';
import { generateReport, ReportGenerateRequest, Report, ReportTemplate, fetchReportTemplates } from '../lib/api';
import styles from './ReportConfigPanel.module.css';

interface ReportConfigPanelProps {
    isOpen: boolean;
    onClose: () => void;
    filters: {
        startDate?: string | null;
        endDate?: string | null;
        sourceIds?: string[];
        search?: string;
        sentiment?: string;
        tags?: string[];
        entities?: string[];
        minRelevance?: number;
        storyStatus?: 'all' | 'orphaned' | 'connected';
    };
    onSuccess: () => void;
    selectedArticleIds?: string[];
}

export default function ReportConfigPanel({ isOpen, onClose, filters, onSuccess, selectedArticleIds }: ReportConfigPanelProps) {
    const [title, setTitle] = useState('');
    const [subtitle, setSubtitle] = useState('');
    const [author, setAuthor] = useState('');
    const [scope, setScope] = useState('Comprehensive analysis of filtered news developments.');
    const [headings, setHeadings] = useState(['Executive Summary', 'Key Developments', 'Strategic Impact', 'Outlook']);
    const [generating, setGenerating] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [generatedReport, setGeneratedReport] = useState<Report | null>(null);

    // Template State
    const [templates, setTemplates] = useState<ReportTemplate[]>([]);
    const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');

    useEffect(() => {
        if (isOpen) {
            loadTemplates();
        }
    }, [isOpen]);

    const loadTemplates = async () => {
        try {
            const data = await fetchReportTemplates();
            setTemplates(data);
        } catch (e) {
            console.error("Failed to load templates", e);
        }
    };

    const handleSelectTemplate = (id: string) => {
        setSelectedTemplateId(id);
        const template = templates.find(t => t.id === id);
        if (template) {
            setScope(template.scope);
            setHeadings(template.headings);
            // Optional: set title if not already set or prefix it
            if (!title) setTitle(template.name);
        }
    };

    const handleAddHeading = () => setHeadings([...headings, '']);
    const handleUpdateHeading = (idx: number, val: string) => {
        const copy = [...headings];
        copy[idx] = val;
        setHeadings(copy);
    };
    const handleRemoveHeading = (idx: number) => {
        setHeadings(headings.filter((_, i) => i !== idx));
    };

    const handleGenerate = async () => {
        if (!title.trim()) {
            setError('Please provide a report title.');
            return;
        }

        setGenerating(true);
        setError(null);

        try {
            const config: ReportGenerateRequest = {
                title,
                subtitle: subtitle || undefined,
                author: author || undefined,
                start_date: filters.startDate || new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
                end_date: filters.endDate || new Date().toISOString(),
                source_ids: filters.sourceIds,
                search: filters.search,
                sentiment: filters.sentiment,
                tags: filters.tags,
                entities: filters.entities,
                min_relevance: filters.minRelevance,
                story_status: filters.storyStatus,
                headings: headings.filter(h => h.trim() !== ''),
                scope: scope || 'No specific scope provided.',
                article_ids: selectedArticleIds && selectedArticleIds.length > 0 ? selectedArticleIds : undefined,
                template_id: selectedTemplateId || undefined
            };

            const report = await generateReport(config);
            setGeneratedReport(report);
        } catch (err: any) {
            setError(err.message || 'Failed to generate report.');
        } finally {
            setGenerating(false);
        }
    };

    return (
        <div className={`${styles.overlay} ${isOpen ? styles.visible : ''}`} onClick={onClose}>
            <div className={styles.drawer} onClick={e => e.stopPropagation()}>
                <button className={styles.btnClose} onClick={onClose}>&times;</button>

                {generatedReport ? (
                    <div className={styles.diagOverlay}>
                        <div className={styles.diagContent}>
                            <div className={styles.diagHeader}>
                                <div className={styles.diagTitle}>
                                    <span>✨ Report Synthesized Successfully</span>
                                </div>
                                <p className={styles.subtitle}>Analysis generation diagnostics and metrics</p>
                            </div>

                            <div className={styles.diagGrid}>
                                <div className={styles.diagItem}>
                                    <span className={styles.diagLabel}>Execution Time</span>
                                    <div className={styles.diagValue}>
                                        {(generatedReport.meta_duration_ms || 0) / 1000}s
                                    </div>
                                </div>
                                <div className={styles.diagItem}>
                                    <span className={styles.diagLabel}>AI Model</span>
                                    <div className={styles.diagValue}>
                                        {generatedReport.meta_model || 'Unknown'}
                                    </div>
                                </div>
                                <div className={styles.diagItem}>
                                    <span className={styles.diagLabel}>Input Tokens</span>
                                    <div className={styles.diagValue}>
                                        {generatedReport.meta_tokens_in?.toLocaleString() || 'N/A'}
                                    </div>
                                </div>
                                <div className={styles.diagItem}>
                                    <span className={styles.diagLabel}>Output Tokens</span>
                                    <div className={styles.diagValue}>
                                        {generatedReport.meta_tokens_out?.toLocaleString() || 'N/A'}
                                    </div>
                                </div>
                            </div>

                            <div className={styles.formGroup}>
                                <label className={styles.label}>Generation Prompt</label>
                                <div className={styles.diagPrompt}>
                                    {generatedReport.meta_prompt}
                                </div>
                            </div>
                        </div>

                        <div className={styles.footer}>
                            <button
                                className={styles.btnGenerate}
                                onClick={() => {
                                    onSuccess();
                                    onClose();
                                    setGeneratedReport(null);
                                }}
                            >
                                Proceed to Analysis Report →
                            </button>
                        </div>
                    </div>
                ) : (
                    <>
                        <div className={styles.header}>
                            <h2 className={styles.title}>Generate Intelligence Report</h2>
                            <p className={styles.subtitle}>Configure AI parameters for your custom digest</p>
                        </div>

                        <div className={styles.scrollArea}>
                            {error && <div style={{ color: '#ef4444', marginBottom: '1.5rem', fontSize: '0.85rem', fontWeight: 600 }}>{error}</div>}

                            {selectedArticleIds && selectedArticleIds.length > 0 && (
                                <div className={styles.selectionInfo}>
                                    🎯 <strong>{selectedArticleIds.length} articles manually selected</strong>. These will be used exclusively for the report.
                                </div>
                            )}

                            <div className={styles.formGroup}>
                                <label className={styles.label}>Load Template</label>
                                <select
                                    className={styles.select}
                                    value={selectedTemplateId}
                                    onChange={e => handleSelectTemplate(e.target.value)}
                                >
                                    <option value="">Custom (No Template)</option>
                                    {templates.map(t => (
                                        <option key={t.id} value={t.id}>{t.name}</option>
                                    ))}
                                </select>
                            </div>

                            <div className={styles.formGroup}>
                                <label className={styles.label}>Report Title</label>
                                <input
                                    className={styles.input}
                                    placeholder="e.g. Energy Sector Weekly Briefing"
                                    value={title}
                                    onChange={e => setTitle(e.target.value)}
                                />
                            </div>

                            <div className={styles.formGroup}>
                                <label className={styles.label}>Subtitle (Optional)</label>
                                <input
                                    className={styles.input}
                                    placeholder="e.g. Impact analysis for Q1"
                                    value={subtitle}
                                    onChange={e => setSubtitle(e.target.value)}
                                />
                            </div>

                            <div className={styles.formGroup}>
                                <label className={styles.label}>Author (Optional)</label>
                                <input
                                    className={styles.input}
                                    placeholder="e.g. Geopolitical Analysis Team"
                                    value={author}
                                    onChange={e => setAuthor(e.target.value)}
                                />
                            </div>

                            <div className={styles.formGroup}>
                                <label className={styles.label}>Detailed Scope & Instructions</label>
                                <textarea
                                    className={styles.textarea}
                                    placeholder="Focus on trade implications, macroeconomic shifts, and infrastructure developments..."
                                    value={scope}
                                    onChange={e => setScope(e.target.value)}
                                />
                            </div>

                            <div className={styles.formGroup}>
                                <label className={styles.label}>Report Sections</label>
                                <div className={styles.headingsList}>
                                    {headings.map((h, i) => (
                                        <div key={i} className={styles.headingItem}>
                                            <input
                                                className={styles.input}
                                                value={h}
                                                onChange={e => handleUpdateHeading(i, e.target.value)}
                                            />
                                            <button className={styles.btnRemove} onClick={() => handleRemoveHeading(i)}>&times;</button>
                                        </div>
                                    ))}
                                    <button className={styles.btnAddHeading} onClick={handleAddHeading}>
                                        + Add Section
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className={styles.footer}>
                            <button
                                className={styles.btnGenerate}
                                onClick={handleGenerate}
                                disabled={generating}
                            >
                                {generating ? (
                                    <>
                                        <div className={styles.loadingSpinner} />
                                        Synthesizing Report...
                                    </>
                                ) : '✨ Generate AI Report'}
                            </button>
                            <p style={{ fontSize: '0.7rem', color: '#94a3b8', textAlign: 'center', marginTop: '1rem' }}>
                                {selectedArticleIds && selectedArticleIds.length > 0
                                    ? `The report will use the ${selectedArticleIds.length} selected articles.`
                                    : 'The report will use up to 200 filtered articles as context.'}
                            </p>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}

