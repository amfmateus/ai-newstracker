'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { FormattingLibrary, fetchFormattings, createFormatting, updateFormatting } from '../../../../lib/api';
import styles from '../../../PipelineBuilder.module.css'; // Reuse form styles
import AlertModal, { AlertType } from '../../../../components/AlertModal';

interface PageProps {
    params: Promise<{ id: string }>;
}

export default function FormattingEditor({ params }: PageProps) {
    const { id } = use(params);
    const isNew = id === 'new';
    const [formatting, setFormatting] = useState<Partial<FormattingLibrary>>({
        name: 'New Report Style',
        description: '',
        structure_definition:
            `{% macro render_section(section, level) %}
    <div class="report-section level-{{ level }}">
        <h{{ level }} class="section-title">{{ section.title }}</h{{ level }}>
        <div class="section-body">
            {{ section.body | safe }}
        </div>
        
        {% if section.subsections %}
            <div class="subsections">
                {% for sub in section.subsections %}
                    {{ render_section(sub, level + 1 if level < 4 else 4) }}
                {% endfor %}
            </div>
        {% endif %}
    </div>
{% endmacro %}

<div class="report-container">
    <header class="report-header">
        <h1 class="main-title">{{ title }}</h1>
        {% if subtitle %}
            <p class="subtitle">{{ subtitle }}</p>
        {% endif %}
        <div class="summary-box">
            <span class="summary-label">EXECUTIVE SUMMARY</span>
            <p>{{ summary }}</p>
        </div>
    </header>
    
    <div class="report-content">
        {% for section in sections %}
            {{ render_section(section, 1) }}
        {% endfor %}
    </div>

    <footer class="references-section">
        <h3 class="refs-title">References</h3>
        <ul class="ref-list">
        {% for ref in references %}
            <li id="ref-{{ ref.id }}" class="ref-item">
                <span class="ref-number">[{{ ref.number }}]</span>
                <div class="ref-content">
                    <span class="ref-article-title">{{ ref.title }}</span>
                    <a href="{{ ref.url }}" target="_blank" class="ref-link">{{ ref.url }}</a>
                </div>
            </li>
        {% endfor %}
        </ul>
    </footer>
</div>`,
        css:
            `@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap');

.report-container {
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    max-width: 850px;
    margin: 0 auto;
    color: #1a1a1a;
    line-height: 1.7;
    padding: 2rem;
}

.report-header {
    margin-bottom: 3rem;
    padding-bottom: 2rem;
    border-bottom: 1px solid #e5e7eb;
}

.main-title {
    font-size: 2.75rem;
    font-weight: 800;
    color: #111827;
    letter-spacing: -0.025em;
    margin-bottom: 0.5rem;
    line-height: 1.2;
}

.summary-box {
    background: #f9fafb;
    border-left: 4px solid #2563eb;
    padding: 1.5rem;
    border-radius: 0 8px 8px 0;
    margin-top: 1.5rem;
}

.summary-label {
    display: block;
    font-size: 0.75rem;
    font-weight: 700;
    color: #2563eb;
    margin-bottom: 0.5rem;
    letter-spacing: 0.05em;
}

.section-title {
    color: #111827;
    font-weight: 700;
    margin-top: 2.5rem;
    margin-bottom: 1rem;
}

h1.section-title { font-size: 1.875rem; color: #1e40af; border-bottom: 1px solid #f3f4f6; padding-bottom: 0.5rem; }
h2.section-title { font-size: 1.5rem; color: #1e3a8a; }

.subsections {
    margin-left: 1.5rem;
    border-left: 1px solid #f3f4f6;
    padding-left: 1.5rem;
}

.references-section {
    margin-top: 5rem;
    padding-top: 2rem;
    border-top: 2px solid #111827;
}

.ref-item {
    display: flex;
    gap: 1rem;
    margin-bottom: 1.25rem;
}

.ref-number {
    font-weight: 700;
    color: #2563eb;
}

.ref-link {
    color: #6366f1;
    text-decoration: none;
    font-size: 0.85rem;
}

sup a {
    color: #2563eb;
    font-weight: 600;
    text-decoration: none;
}`
    });
    const [alertState, setAlertState] = useState<{ isOpen: boolean; message: string; type: AlertType }>({
        isOpen: false,
        message: '',
        type: 'info'
    });

    const [saving, setSaving] = useState(false);
    const router = useRouter();

    useEffect(() => {
        if (!isNew) loadData();
    }, [id]);

    const loadData = async () => {
        const list = await fetchFormattings();
        const found = list.find(f => f.id === id);
        if (found) setFormatting(found);
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            if (isNew) {
                await createFormatting(formatting);
            } else {
                await updateFormatting(id, formatting);
            }
            router.push('/pipelines/libraries/formatting');
        } catch (e) {
            setAlertState({ isOpen: true, message: "Failed to save style", type: 'error' });
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className={styles.container} style={{ maxWidth: '1000px', margin: '0 auto' }}>
            <div style={{ marginBottom: '1rem' }}>
                <Link href="/pipelines/libraries/formatting" style={{ textDecoration: 'none', color: '#666' }}>&larr; Back to Library</Link>
            </div>

            <header className={styles.header}>
                <h1 className={styles.title}>{isNew ? 'New Style' : 'Edit Style'}</h1>
                <button onClick={handleSave} disabled={saving} className={styles.saveButton}>
                    {saving ? 'Saving...' : 'Save Style'}
                </button>
            </header>

            <div className={styles.configPanel} style={{ border: 'none', padding: 0 }}>
                <div className={styles.formGroup}>
                    <label className={styles.label}>Name</label>
                    <input
                        className={styles.input}
                        value={formatting.name}
                        onChange={e => setFormatting({ ...formatting, name: e.target.value })}
                        placeholder="e.g. Modern Blue Theme"
                    />
                </div>

                <div className={styles.formGroup}>
                    <label className={styles.label}>Description</label>
                    <input
                        className={styles.input}
                        value={formatting.description}
                        onChange={e => setFormatting({ ...formatting, description: e.target.value })}
                        placeholder="Brief description..."
                    />
                </div>

                <div style={{ display: 'flex', gap: '1rem', height: '500px' }}>
                    <div className={styles.formGroup} style={{ flex: 1 }}>
                        <label className={styles.label}>HTML Structure (Jinja2)</label>
                        <textarea
                            className={styles.textarea}
                            style={{ height: '100%', fontFamily: 'monospace' }}
                            value={formatting.structure_definition}
                            onChange={e => setFormatting({ ...formatting, structure_definition: e.target.value })}
                        />
                    </div>
                    <div className={styles.formGroup} style={{ flex: 1 }}>
                        <label className={styles.label}>CSS Styles</label>
                        <textarea
                            className={styles.textarea}
                            style={{ height: '100%', fontFamily: 'monospace' }}
                            value={formatting.css}
                            onChange={e => setFormatting({ ...formatting, css: e.target.value })}
                        />
                    </div>
                </div>
            </div>

            <AlertModal
                isOpen={alertState.isOpen}
                message={alertState.message}
                type={alertState.type}
                onClose={() => setAlertState(prev => ({ ...prev, isOpen: false }))}
            />
        </div>
    );
}
