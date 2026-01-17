'use client';

import React, { useState, useEffect } from 'react';
import {
    ReportTemplate,
    fetchReportTemplates,
    createReportTemplate,
    updateReportTemplate,
    deleteReportTemplate
} from '../../lib/api';
import styles from './TemplatesPage.module.css';
import AlertModal, { AlertType } from '../../components/AlertModal';

const DEFAULT_PROMPT_SKELETON = `# Expert Persona & Strategic Guidance
You are a senior analyst specializing in [Topic]. Your goal is to synthesize complex news into actionable intelligence.

## Context Variables Available:
- {title}: The dynamic title for this specific report.
- {subtitle}: The subtitle or description of the report.
- {author}: The name of the report author.
- {scope}: The detailed instructions provided in the 'Scope' field.
- {headings}: The list of sections you want the AI to write.
- {articles}: The full raw article data (Title, Source, Snippet).

## Mandatory Output Format:
Your response MUST use the following Markdown structure:
# {title}
## {subtitle}
Author: {author}

## Executive Summary
[Synthesize the main themes here]

[For each {headings}]:
## [Heading Name]
[Detailed analysis citing specific articles using [[CITATION:ARTICLE_ID]] format]
`;

export default function TemplatesPage() {
    const [templates, setTemplates] = useState<ReportTemplate[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isAdvancedModalOpen, setIsAdvancedModalOpen] = useState(false);
    const [editingTemplate, setEditingTemplate] = useState<Partial<ReportTemplate> | null>(null);

    // Alert State
    const [alertState, setAlertState] = useState<{ isOpen: boolean; message: string; type: AlertType }>({
        isOpen: false,
        message: '',
        type: 'info'
    });

    // Form State
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [scope, setScope] = useState('');
    const [headings, setHeadings] = useState<string[]>(['Executive Summary']);
    const [promptOverride, setPromptOverride] = useState('');

    // Temporary state for the advanced modal
    const [tempPromptOverride, setTempPromptOverride] = useState('');

    useEffect(() => {
        loadTemplates();
    }, []);

    const loadTemplates = async () => {
        setLoading(true);
        try {
            const data = await fetchReportTemplates();
            setTemplates(data);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleOpenModal = (template?: ReportTemplate) => {
        if (template) {
            setEditingTemplate(template);
            setName(template.name);
            setDescription(template.description || '');
            setScope(template.scope);
            setHeadings(template.headings);
            setPromptOverride(template.prompt_override || '');
        } else {
            setEditingTemplate(null);
            setName('');
            setDescription('');
            setScope('Focus on trade implications and macroeconomic shifts.');
            setHeadings(['Executive Summary', 'Key Developments', 'Strategic Impact']);
            setPromptOverride(''); // Empty for new templates by default, unless they go to Advanced
        }
        setIsModalOpen(true);
    };

    const handleOpenAdvanced = () => {
        setTempPromptOverride(promptOverride || DEFAULT_PROMPT_SKELETON);
        setIsAdvancedModalOpen(true);
    };

    const handleSaveAdvanced = () => {
        setPromptOverride(tempPromptOverride);
        setIsAdvancedModalOpen(false);
    };

    const handleSave = async () => {
        if (!name.trim()) return;

        try {
            const payload = {
                name,
                description,
                scope,
                headings: headings.filter(h => h.trim() !== ''),
                prompt_override: promptOverride
            };

            if (editingTemplate?.id) {
                await updateReportTemplate(editingTemplate.id, payload);
            } else {
                await createReportTemplate(payload);
            }
            setIsModalOpen(false);
            loadTemplates();
        } catch (err: any) {
            setAlertState({ isOpen: true, message: "Failed to save template: " + err.message, type: 'error' });
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Are you sure you want to delete this template?")) return;
        try {
            await deleteReportTemplate(id);
            loadTemplates();
        } catch (err: any) {
            setAlertState({ isOpen: true, message: "Failed to delete: " + err.message, type: 'error' });
        }
    };

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <div>
                    <h1 className={styles.title}>Report Templates</h1>
                    <p className={styles.subtitle}>Define reusable structures and instructions for your AI reports</p>
                </div>
                <button className={styles.btnCreate} onClick={() => handleOpenModal()}>
                    + Create Template
                </button>
            </header>

            {loading ? (
                <div className={styles.loading}>Loading templates...</div>
            ) : (
                <div className={styles.grid}>
                    {templates.map(t => (
                        <div key={t.id} className={styles.card}>
                            <div className={styles.cardInfo}>
                                <div className={styles.cardHeaderRow}>
                                    <h3 className={styles.cardName}>{t.name}</h3>
                                    {t.prompt_override && <span className={styles.activePromptBadge}>Custom Prompt</span>}
                                </div>
                                <p className={styles.cardDesc}>{t.description || 'No description provided.'}</p>
                                <div className={styles.cardStats}>
                                    <span>{t.headings.length} Sections</span>
                                    <span>•</span>
                                    <span>Scope defined</span>
                                </div>
                            </div>
                            <div className={styles.cardActions}>
                                <button onClick={() => handleOpenModal(t)}>Edit</button>
                                <button className={styles.btnDelete} onClick={() => handleDelete(t.id)}>Delete</button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {isModalOpen && (
                <div className={styles.modalOverlay}>
                    <div className={styles.modal}>
                        <div className={styles.modalHeader}>
                            <h2>{editingTemplate ? 'Edit Template' : 'New Report Template'}</h2>
                            <button onClick={() => setIsModalOpen(false)}>&times;</button>
                        </div>
                        <div className={styles.modalBody}>
                            <div className={styles.formGroup}>
                                <label>Template Name</label>
                                <input
                                    type="text"
                                    value={name}
                                    onChange={e => setName(e.target.value)}
                                    placeholder="e.g. Weekly Trade Briefing"
                                />
                            </div>
                            <div className={styles.formGroup}>
                                <label>Description (Optional)</label>
                                <input
                                    type="text"
                                    value={description}
                                    onChange={e => setDescription(e.target.value)}
                                    placeholder="Summary of what this template is for"
                                />
                                <p className={styles.inputHint}>This is passed as the <code>{"{subtitle}"}</code> variable to the AI.</p>
                            </div>
                            <div className={styles.formGroup}>
                                <label>Scope & Context Instructions</label>
                                <textarea
                                    value={scope}
                                    onChange={e => setScope(e.target.value)}
                                    placeholder="Guide the AI on what to prioritize..."
                                />
                                <p className={styles.inputHint}>This is passed as the <code>{"{scope}"}</code> variable to the AI.</p>
                            </div>
                            <div className={styles.formGroup}>
                                <label>Report Sections</label>
                                <div className={styles.headingsList}>
                                    {headings.map((h, i) => (
                                        <div key={i} className={styles.headingItem}>
                                            <input
                                                value={h}
                                                onChange={e => {
                                                    const copy = [...headings];
                                                    copy[i] = e.target.value;
                                                    setHeadings(copy);
                                                }}
                                            />
                                            <button onClick={() => setHeadings(headings.filter((_, idx) => idx !== i))}>&times;</button>
                                        </div>
                                    ))}
                                    <button
                                        className={styles.btnAddHeading}
                                        onClick={() => setHeadings([...headings, ''])}
                                    >
                                        + Add Section
                                    </button>
                                </div>
                                <p className={styles.inputHint}>These are passed as the <code>{"{headings}"}</code> variable to the AI.</p>
                            </div>

                            <hr className={styles.divider} />

                            <div className={styles.formGroup}>
                                <label>AI Persona & Prompting</label>
                                <div className={styles.advancedPromptControl}>
                                    <div className={styles.advancedPromptInfo}>
                                        <h3>Custom Prompting Logic</h3>
                                        <p>By default, the AI uses your global report prompt. You can fully customize the behavior for this template.</p>
                                    </div>
                                    <button
                                        type="button"
                                        className={`${styles.btnAdvanced} ${promptOverride ? styles.btnAdvancedActive : ''}`}
                                        onClick={handleOpenAdvanced}
                                    >
                                        {promptOverride ? 'Edit Custom Prompt' : 'Configure Custom Prompt'}
                                    </button>
                                </div>
                                {promptOverride && (
                                    <div className={styles.promptStatus}>
                                        <span className={styles.statusDot}></span>
                                        Custom Prompt Active: This template uses specialized AI logic.
                                        <button className={styles.btnClearPrompt} onClick={() => setPromptOverride('')}>Reset to Default</button>
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className={styles.modalFooter}>
                            <button className={styles.btnCancel} onClick={() => setIsModalOpen(false)}>Cancel</button>
                            <button className={styles.btnSave} onClick={handleSave}>Save Template</button>
                        </div>
                    </div>
                </div>
            )}

            {isAdvancedModalOpen && (
                <div className={styles.modalOverlay} style={{ zIndex: 1100 }}>
                    <div className={`${styles.modal} ${styles.modalLarge}`}>
                        <div className={styles.modalHeader}>
                            <div>
                                <h2>Advanced: System Prompt Customization</h2>
                                <p className={styles.modalSubtitle}>Full control over the AI's core behavior for this template</p>
                            </div>
                            <button onClick={() => setIsAdvancedModalOpen(false)}>&times;</button>
                        </div>
                        <div className={styles.modalBody}>
                            <div className={styles.promptGuide}>
                                <div className={styles.guideHeader}>
                                    <h3>Available Context Variables</h3>
                                    <p>Insert these placeholders in your prompt to dynamically inject report data.</p>
                                </div>
                                <div className={styles.variableGrid}>
                                    <div className={styles.variableItem}><code>{"{title}"}</code> Report Title</div>
                                    <div className={styles.variableItem}><code>{"{subtitle}"}</code> Description</div>
                                    <div className={styles.variableItem}><code>{"{author}"}</code> Report Author</div>
                                    <div className={styles.variableItem}><code>{"{scope}"}</code> Scope Instructions</div>
                                    <div className={styles.variableItem}><code>{"{headings}"}</code> Target Sections</div>
                                    <div className={styles.variableItem}><code>{"{articles}"}</code> Raw Article Data</div>
                                </div>
                                <div className={styles.citationAlert}>
                                    <strong>Citation Requirement:</strong> Always instruct the AI to cite sources using <code>[[CITATION:ARTICLE_ID]]</code> for grounding.
                                </div>
                            </div>

                            <div className={styles.formGroup}>
                                <label>Custom System Prompt</label>
                                <textarea
                                    className={styles.codeArea}
                                    value={tempPromptOverride}
                                    onChange={e => setTempPromptOverride(e.target.value)}
                                    placeholder="Write your custom AI instructions here..."
                                />
                            </div>
                        </div>
                        <div className={styles.modalFooter}>
                            <button className={styles.btnCancel} onClick={() => setIsAdvancedModalOpen(false)}>Discard Changes</button>
                            <button className={styles.btnSave} onClick={handleSaveAdvanced}>Apply Custom Prompt</button>
                        </div>
                    </div>
                </div>
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
