"use client";

import React, { useState, useEffect } from 'react';

interface Variable {
    name: string;
    description: string;
}

interface FormattingData {
    id?: string;
    name: string;
    description?: string;
    structure_definition: string;
    css?: string;
    citation_type?: string;
    parameters?: Record<string, any>;
}

interface FormattingEditorModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (data: FormattingData) => Promise<void>;
    initialData?: FormattingData | null;
    availableVariables?: Variable[];
}

export default function FormattingEditorModal({
    isOpen,
    onClose,
    onSave,
    initialData,
    availableVariables
}: FormattingEditorModalProps) {
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [structure, setStructure] = useState('');
    const [css, setCss] = useState('');
    const [citationType, setCitationType] = useState('numeric_superscript');

    // Citation Advanced Parameters
    const [leaveSpace, setLeaveSpace] = useState(false);
    const [displayStyle, setDisplayStyle] = useState<'superscript' | 'regular'>('superscript');
    const [enclosure, setEnclosure] = useState<'none' | 'parenthesis' | 'square_brackets' | 'curly_braces'>('square_brackets');
    const [groupCitations, setGroupCitations] = useState(true);
    const [linkTarget, setLinkTarget] = useState<'internal' | 'external'>('external');
    const [citationTemplate, setCitationTemplate] = useState('<span class="cite"><a href="{{ url }}" {{ target }}>{{ label }}</a></span>');

    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'template' | 'css' | 'citations'>('template');

    useEffect(() => {
        if (initialData) {
            setName(initialData.name || '');
            setDescription(initialData.description || '');
            setStructure(initialData.structure_definition || '');
            setCss(initialData.css || '');
            setCitationType(initialData.citation_type || 'numeric_superscript');

            const params = initialData.parameters || {};
            setLeaveSpace(params.leave_space ?? false);
            setDisplayStyle(params.display_style || 'superscript');
            setEnclosure(params.enclosure || 'square_brackets');
            setGroupCitations(params.group_citations ?? true);
            setLinkTarget(params.link_target || 'external');
            setCitationTemplate(params.citation_template || '<span class="cite"><a href="{{ url }}" {{ target }}>{{ label }}</a></span>');
        } else {
            setName('');
            setDescription('');
            setLeaveSpace(false);
            setDisplayStyle('superscript');
            setEnclosure('square_brackets');
            setGroupCitations(true);
            setLinkTarget('external');
            setCitationTemplate('<span class="cite"><a href="{{ url }}" {{ target }}>{{ label }}</a></span>');
            setStructure(`<!-- Simplified Report Template -->
<div class="report-container">
    <header>
        <h1 class="report-title">{{ title }}</h1>
        {% if subtitle %}
            <p class="report-subtitle">{{ subtitle }}</p>
        {% endif %}
        
        <div class="summary-box">
            <h2>Executive Summary</h2>
            <div class="summary-content">

{{ summary | safe }}

            </div>
        </div>
    </header>

    {% if key_findings %}
    <section class="findings-section">
        <h2>Key Findings</h2>
        <ul>
            {% for finding in key_findings %}
                <li>{{ finding | safe }}</li>
            {% endfor %}
        </ul>
    </section>
    {% endif %}

    <div class="report-body">
        {% for section in sections %}
            <section class="content-section">
                <h3>{{ section.title }}</h3>
                <div class="section-content">

{{ (section.body or section.content) | safe }}

                </div>
            </section>
        {% endfor %}
    </div>

    {% if references %}
    <footer class="references-footer">
        <hr>
        <h4>References</h4>
        <ul class="references-list">
            {% for ref in references %}
                <li id="ref-{{ ref.id }}">
                    <strong>[{{ ref.number }}]</strong> {{ ref.title }} 
                    <a href="{{ ref.url }}" target="_blank">View Source</a>
                </li>
            {% endfor %}
        </ul>
    </footer>
    {% endif %}
</div>`);
            setCss(`/* Modern Report Styles */
.report-container {
    padding: 40px;
    color: #334155;
    line-height: 1.6;
}
.section-content, .summary-content {
    white-space: pre-wrap;
}
.report-title {
    font-size: 2.5rem;
    color: #1e293b;
    margin-bottom: 8px;
}
.report-subtitle {
    font-size: 1.1rem;
    color: #64748b;
    margin-bottom: 32px;
}
.summary-box {
    background-color: #f8fafc;
    padding: 24px;
    border-radius: 12px;
    border-left: 4px solid #3b82f6;
    margin-bottom: 40px;
}
.summary-box h2 {
    margin-top: 0;
    font-size: 1.25rem;
    color: #1e293b;
}
.content-section {
    margin-bottom: 32px;
}
.content-section h3 {
    font-size: 1.5rem;
    color: #1e293b;
    border-bottom: 1px solid #e2e8f0;
    padding-bottom: 8px;
}
.references-footer {
    margin-top: 60px;
    font-size: 0.9rem;
    color: #64748b;
}
.references-list {
    list-style: none;
    padding: 0;
}
.references-list li {
    margin-bottom: 8px;
}`);
        }
        setError(null);
    }, [initialData, isOpen]);

    if (!isOpen) return null;

    const handleSave = async () => {
        if (!name.trim()) {
            setError('Please enter a name for this style.');
            return;
        }
        if (!structure.trim()) {
            setError('Please provide a structure definition (HTML/Jinja2).');
            return;
        }

        setSaving(true);
        setError(null);
        try {
            await onSave({
                id: initialData?.id,
                name,
                description,
                structure_definition: structure,
                css,
                citation_type: citationType,
                parameters: {
                    leave_space: leaveSpace,
                    display_style: displayStyle,
                    enclosure,
                    group_citations: citationType === 'user_defined' ? false : groupCitations,
                    link_target: linkTarget,
                    citation_template: citationTemplate
                }
            });
            onClose();
        } catch (err: any) {
            setError(err.message || 'Failed to save formatting style.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.4)',
            backdropFilter: 'blur(4px)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
        }}>
            <div style={{
                backgroundColor: 'white',
                borderRadius: '16px',
                width: '95%',
                maxWidth: '1100px',
                height: '90vh',
                display: 'flex',
                flexDirection: 'column',
                boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
                overflow: 'hidden'
            }}>
                <div style={{
                    padding: '20px 24px',
                    borderBottom: '1px solid #f1f5f9',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    backgroundColor: 'white'
                }}>
                    <div>
                        <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 600, color: '#0f172a' }}>
                            {initialData ? 'Edit Formatting Style' : 'Create New Style'}
                        </h2>
                        <p style={{ margin: '4px 0 0', fontSize: '0.85rem', color: '#64748b' }}>
                            Define how the AI-generated report content will be rendered.
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        style={{
                            background: 'transparent',
                            border: 'none',
                            cursor: 'pointer',
                            padding: '8px',
                            borderRadius: '8px',
                            color: '#64748b',
                            transition: 'background 0.2s'
                        }}
                        onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#f1f5f9'}
                        onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                    </button>
                </div>

                <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
                    {/* Main Form Area */}
                    <div style={{ flex: 1, padding: '24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                            <div>
                                <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', fontWeight: 600, color: '#334155' }}>Name</label>
                                <input
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    placeholder="e.g., Executive PDF Template"
                                    style={{
                                        width: '100%',
                                        padding: '10px 12px',
                                        borderRadius: '8px',
                                        border: '1px solid #e2e8f0',
                                        fontSize: '0.95rem',
                                        outline: 'none',
                                        transition: 'border-color 0.2s'
                                    }}
                                    onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                                    onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
                                />
                            </div>
                            <div>
                                <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', fontWeight: 600, color: '#334155' }}>Description</label>
                                <input
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    placeholder="What is this template typically used for?"
                                    style={{
                                        width: '100%',
                                        padding: '10px 12px',
                                        borderRadius: '8px',
                                        border: '1px solid #e2e8f0',
                                        fontSize: '0.95rem',
                                        outline: 'none'
                                    }}
                                />
                            </div>
                        </div>

                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: '300px' }}>
                            <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                                <button
                                    onClick={() => setActiveTab('template')}
                                    style={{
                                        padding: '8px 16px',
                                        borderRadius: '8px',
                                        border: 'none',
                                        backgroundColor: activeTab === 'template' ? '#eff6ff' : 'transparent',
                                        color: activeTab === 'template' ? '#2563eb' : '#64748b',
                                        fontWeight: 600,
                                        fontSize: '0.85rem',
                                        cursor: 'pointer'
                                    }}
                                >
                                    HTML Template (Jinja2)
                                </button>
                                <button
                                    onClick={() => setActiveTab('css')}
                                    style={{
                                        padding: '8px 16px',
                                        borderRadius: '8px',
                                        border: 'none',
                                        backgroundColor: activeTab === 'css' ? '#eff6ff' : 'transparent',
                                        color: activeTab === 'css' ? '#2563eb' : '#64748b',
                                        fontWeight: 600,
                                        fontSize: '0.85rem',
                                        cursor: 'pointer'
                                    }}
                                >
                                    Custom CSS
                                </button>
                                <button
                                    onClick={() => setActiveTab('citations')}
                                    style={{
                                        padding: '8px 16px',
                                        borderRadius: '8px',
                                        border: 'none',
                                        backgroundColor: activeTab === 'citations' ? '#eff6ff' : 'transparent',
                                        color: activeTab === 'citations' ? '#2563eb' : '#64748b',
                                        fontWeight: 600,
                                        fontSize: '0.85rem',
                                        cursor: 'pointer'
                                    }}
                                >
                                    Citations
                                </button>
                            </div>

                            <div style={{ flex: 1, position: 'relative', display: 'flex', flexDirection: 'column' }}>
                                {(activeTab === 'template' || activeTab === 'css') && (
                                    <textarea
                                        value={activeTab === 'template' ? structure : css}
                                        onChange={(e) => activeTab === 'template' ? setStructure(e.target.value) : setCss(e.target.value)}
                                        placeholder={activeTab === 'template' ? "Enter HTML with {{ variables }}..." : "/* Custom report styles */\n.report-title { color: #1e293b; }"}
                                        style={{
                                            width: '100%',
                                            flex: 1,
                                            padding: '16px',
                                            borderRadius: '8px',
                                            border: '1px solid #e2e8f0',
                                            fontSize: '13px',
                                            fontFamily: 'Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
                                            lineHeight: '1.6',
                                            resize: 'none',
                                            outline: 'none',
                                            backgroundColor: '#fafafa'
                                        }}
                                        onFocus={(e) => { e.target.style.borderColor = '#3b82f6'; e.target.style.backgroundColor = 'white'; }}
                                        onBlur={(e) => { e.target.style.borderColor = '#e2e8f0'; e.target.style.backgroundColor = '#fafafa'; }}
                                    />
                                )}

                                {activeTab === 'citations' && (
                                    <div style={{ padding: '24px', flex: 1, backgroundColor: '#fafafa', overflowY: 'auto', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                                        <div style={{ marginBottom: '16px' }}>
                                            <h3 style={{ fontSize: '0.9rem', fontWeight: 600, color: '#1e293b', margin: '0 0 4px' }}>Citation Style</h3>
                                            <p style={{ fontSize: '0.8rem', color: '#64748b', margin: 0 }}>Select the base format for your in-text references.</p>
                                        </div>

                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginBottom: '24px' }}>
                                            {[
                                                { id: 'numeric_superscript', name: 'Superscript', desc: 'Numbered links (¹)', icon: '¹' },
                                                { id: 'source_bracket', name: 'Source Names', desc: 'Brief source tags [NYT]', icon: '🔗' },
                                                { id: 'inline_source_link', name: 'Inline Links', desc: 'Name inside parenthesis', icon: ' (S) ' },
                                                { id: 'user_defined', name: 'Custom HTML', desc: 'Full template control', icon: '🎨' },
                                                { id: 'none', name: 'Disabled', desc: 'No citations in text', icon: 'Ø' }
                                            ].map(style => (
                                                <div
                                                    key={style.id}
                                                    onClick={() => setCitationType(style.id)}
                                                    style={{
                                                        padding: '16px',
                                                        backgroundColor: citationType === style.id ? '#f0f7ff' : '#fff',
                                                        border: '1.5px solid',
                                                        borderColor: citationType === style.id ? '#2563eb' : '#e2e8f0',
                                                        borderRadius: '12px',
                                                        cursor: 'pointer',
                                                        transition: 'all 0.2s ease',
                                                        display: 'flex',
                                                        flexDirection: 'column',
                                                        alignItems: 'center',
                                                        textAlign: 'center',
                                                        boxShadow: citationType === style.id ? '0 4px 6px -1px rgba(37, 99, 235, 0.1)' : 'none'
                                                    }}
                                                >
                                                    <div style={{
                                                        fontSize: '1.2rem', fontWeight: 700, marginBottom: '8px',
                                                        color: citationType === style.id ? '#2563eb' : '#94a3b8',
                                                        height: '32px', display: 'flex', alignItems: 'center'
                                                    }}>
                                                        {style.icon}
                                                    </div>
                                                    <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#1e293b' }}>{style.name}</div>
                                                    <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '4px' }}>{style.desc}</div>
                                                </div>
                                            ))}
                                        </div>

                                        {citationType !== 'none' && (
                                            <div style={{ display: 'grid', gridTemplateColumns: citationType === 'user_defined' ? '1fr' : '1fr 1fr', gap: '20px' }}>

                                                {/* CONTEXTUAL CONFIGURATION */}
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

                                                    {/* VISUAL POLISH (Only for non-custom) */}
                                                    {citationType !== 'user_defined' && (
                                                        <div style={{ padding: '20px', backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px' }}>
                                                            <h4 style={{ margin: '0 0 16px', fontSize: '0.8rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Visual Appearance</h4>
                                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                                                <div>
                                                                    <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.8rem', fontWeight: 500, color: '#64748b' }}>Display Mode</label>
                                                                    <select
                                                                        value={displayStyle}
                                                                        onChange={(e) => setDisplayStyle(e.target.value as any)}
                                                                        style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '0.9rem', outline: 'none' }}
                                                                    >
                                                                        <option value="superscript">Superscript Style</option>
                                                                        <option value="regular">Standard Text Size</option>
                                                                    </select>
                                                                </div>
                                                                <div>
                                                                    <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.8rem', fontWeight: 500, color: '#64748b' }}>Surround With</label>
                                                                    <select
                                                                        value={enclosure}
                                                                        onChange={(e) => setEnclosure(e.target.value as any)}
                                                                        style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '0.9rem', outline: 'none' }}
                                                                    >
                                                                        <option value="none">No Brackets</option>
                                                                        <option value="parenthesis">Parentheses (1)</option>
                                                                        <option value="square_brackets">Square Brackets [1]</option>
                                                                        <option value="curly_braces">Curly Braces {"{1}"}</option>
                                                                    </select>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    )}

                                                    {/* LINK & BEHAVIOR */}
                                                    <div style={{ padding: '20px', backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px' }}>
                                                        <h4 style={{ margin: '0 0 16px', fontSize: '0.8rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Link & Behavior</h4>
                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                                            <div>
                                                                <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.8rem', fontWeight: 500, color: '#64748b' }}>Link Destination</label>
                                                                <select
                                                                    value={linkTarget}
                                                                    onChange={(e) => setLinkTarget(e.target.value as any)}
                                                                    style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '0.9rem', outline: 'none' }}
                                                                >
                                                                    <option value="external">Direct to Original Source URL</option>
                                                                    <option value="internal">Navigate to Reference List (Bottom)</option>
                                                                </select>
                                                            </div>
                                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', marginTop: '4px' }}>
                                                                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.85rem', color: '#334155' }}>
                                                                    <input type="checkbox" checked={leaveSpace} onChange={(e) => setLeaveSpace(e.target.checked)} style={{ width: '15px', height: '15px' }} />
                                                                    Space before citation
                                                                </label>
                                                                {citationType !== 'user_defined' && (
                                                                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.85rem', color: '#334155' }}>
                                                                        <input type="checkbox" checked={groupCitations} onChange={(e) => setGroupCitations(e.target.checked)} style={{ width: '15px', height: '15px' }} />
                                                                        Clean group [1, 2]
                                                                    </label>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* CUSTOM TEMPLATE EDITOR (Full width if user_defined) */}
                                                {citationType === 'user_defined' && (
                                                    <div style={{ padding: '20px', backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px' }}>
                                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                                                            <h4 style={{ margin: 0, fontSize: '0.8rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Citation HTML Template</h4>
                                                            <div style={{ display: 'flex', gap: '8px' }}>
                                                                <button
                                                                    onClick={() => setCitationTemplate('<sup class="cite"><a href="{{ url }}" {{ target }}>[{{ label }}]</a></sup>')}
                                                                    style={{ fontSize: '0.7rem', padding: '4px 8px', borderRadius: '4px', border: '1px solid #e2e8f0', background: '#f8fafc', cursor: 'pointer' }}
                                                                >Brackets Supra</button>
                                                                <button
                                                                    onClick={() => setCitationTemplate('<a href="{{ url }}" {{ target }} style="color: blue; text-decoration: none;">[{{ label }}]</a>')}
                                                                    style={{ fontSize: '0.7rem', padding: '4px 8px', borderRadius: '4px', border: '1px solid #e2e8f0', background: '#f8fafc', cursor: 'pointer' }}
                                                                >Simple Blue</button>
                                                            </div>
                                                        </div>
                                                        <textarea
                                                            value={citationTemplate}
                                                            onChange={(e) => setCitationTemplate(e.target.value)}
                                                            style={{
                                                                width: '100%',
                                                                padding: '12px',
                                                                borderRadius: '8px',
                                                                border: '1px solid #e2e8f0',
                                                                fontSize: '13px',
                                                                fontFamily: 'SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                                                                minHeight: '100px',
                                                                outline: 'none',
                                                                backgroundColor: '#fdfdfd'
                                                            }}
                                                        />
                                                        <div style={{ marginTop: '12px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                                            {['label', 'url', 'target'].map(p => (
                                                                <code key={p} style={{ fontSize: '0.75rem', padding: '2px 6px', background: '#f1f5f9', borderRadius: '4px', color: '#475569' }}>{"{{ " + p + " }}"}</code>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}

                                                {/* PREVIEW BOX */}
                                                <div style={{ padding: '20px', backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px' }}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                                                        <h4 style={{ margin: 0, fontSize: '0.8rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Visual Preview</h4>
                                                        <span style={{ fontSize: '0.7rem', padding: '2px 8px', background: '#eef2ff', color: '#4f46e5', borderRadius: '99px', fontWeight: 600 }}>Mock Report Context</span>
                                                    </div>
                                                    <div style={{
                                                        border: '1px solid #e2e8f0',
                                                        borderRadius: '8px',
                                                        padding: '24px',
                                                        backgroundColor: '#fff',
                                                        boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.02)',
                                                        lineHeight: '1.8',
                                                        fontSize: '0.9rem',
                                                        color: '#334155'
                                                    }}>
                                                        {(() => {
                                                            const encMap = { none: ['', ''], parenthesis: ['(', ')'], square_brackets: ['[', ']'], curly_braces: ['{', '}'] };
                                                            const [start, end] = encMap[enclosure];
                                                            const isSuperscript = displayStyle === 'superscript';
                                                            const spanStyle: React.CSSProperties = isSuperscript
                                                                ? { verticalAlign: 'super', fontSize: '0.65rem', fontWeight: 600, color: '#2563eb' }
                                                                : { fontSize: '0.85rem', fontWeight: 600, color: '#2563eb', marginLeft: '2px' };

                                                            const cite1 = citationType === 'inline_source_link' || citationType === 'source_bracket' ? 'Bloomberg' : '1';
                                                            const cite2 = citationType === 'inline_source_link' || citationType === 'source_bracket' ? 'Reuters' : '2';
                                                            const cite3 = citationType === 'inline_source_link' || citationType === 'source_bracket' ? 'WSJ' : '3';

                                                            const prefix = leaveSpace ? ' ' : '';

                                                            const renderGroup = (cites: string[]) => {
                                                                const isUserDefined = citationType === 'user_defined';
                                                                if (groupCitations && !isUserDefined) {
                                                                    return <span style={spanStyle}>{start}{cites.join(', ')}{end}</span>;
                                                                } else {
                                                                    return cites.map((c, i) => (
                                                                        <React.Fragment key={i}>
                                                                            {i > 0 && <span style={{ color: '#94a3b8', margin: '0 2px' }}>,</span>}
                                                                            <span style={spanStyle}>
                                                                                {isUserDefined ? (
                                                                                    <span style={{ textDecoration: 'underline' }}>{c}</span>
                                                                                ) : (
                                                                                    <>{start}{c}{end}</>
                                                                                )}
                                                                            </span>
                                                                        </React.Fragment>
                                                                    ));
                                                                }
                                                            };

                                                            return (
                                                                <div>
                                                                    The market experienced a significant rally following the latest inflation data
                                                                    {citationType !== 'none' && (
                                                                        <>{prefix}{renderGroup([cite1])}</>
                                                                    )}
                                                                    . Analysts suggest that the central bank might pause rate hikes in the upcoming quarter
                                                                    {citationType !== 'none' && (
                                                                        <>{prefix}{renderGroup([cite2, cite3])}</>
                                                                    )}
                                                                    , although some volatility is still expected.
                                                                </div>
                                                            );
                                                        })()}
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Sidebar for Variables */}
                    {availableVariables && availableVariables.length > 0 && (
                        <div style={{
                            width: '280px',
                            borderLeft: '1px solid #f1f5f9',
                            backgroundColor: '#f8fafc',
                            display: 'flex',
                            flexDirection: 'column'
                        }}>
                            <div style={{ padding: '20px', borderBottom: '1px solid #eee' }}>
                                <h3 style={{ fontSize: '0.9rem', fontWeight: 600, margin: 0, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                    Available Fields
                                </h3>
                                <p style={{ fontSize: '0.8rem', color: '#64748b', margin: '8px 0 0', lineHeight: 1.4 }}>
                                    Inject data into your template using Jinja2.
                                </p>
                            </div>
                            <div style={{ padding: '20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px', flex: 1 }}>
                                {availableVariables.map((v) => (
                                    <div
                                        key={v.name}
                                        style={{
                                            padding: '12px',
                                            backgroundColor: 'white',
                                            border: '1px solid #e2e8f0',
                                            borderRadius: '8px',
                                            cursor: 'pointer',
                                            transition: 'all 0.2s ease',
                                            boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                                        }}
                                        onClick={() => {
                                            navigator.clipboard.writeText(`{{ ${v.name} }}`);
                                        }}
                                        onMouseOver={(e) => {
                                            e.currentTarget.style.borderColor = '#3b82f6';
                                            e.currentTarget.style.transform = 'translateY(-1px)';
                                        }}
                                        onMouseOut={(e) => {
                                            e.currentTarget.style.borderColor = '#e2e8f0';
                                            e.currentTarget.style.transform = 'none';
                                        }}
                                    >
                                        <div style={{
                                            fontFamily: 'monospace',
                                            fontWeight: 600,
                                            color: '#2563eb',
                                            fontSize: '0.85rem',
                                            marginBottom: '6px',
                                            background: '#eff6ff',
                                            padding: '4px 8px',
                                            borderRadius: '4px',
                                            display: 'inline-block'
                                        }}>
                                            {`{{ ${v.name} }}`}
                                        </div>
                                        <div style={{ color: '#475569', fontSize: '0.8rem', lineHeight: '1.4' }}>
                                            {v.description}
                                        </div>
                                    </div>
                                ))}

                                <div style={{ marginTop: '12px', padding: '16px', backgroundColor: '#fff7ed', borderRadius: '12px', border: '1px solid #ffedd5' }}>
                                    <h4 style={{ margin: '0 0 8px', fontSize: '0.85rem', fontWeight: 600, color: '#9a3412', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
                                        Formatting Tips
                                    </h4>
                                    <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '0.75rem', color: '#c2410c', display: 'flex', flexDirection: 'column', gap: '8px', lineHeight: 1.4 }}>
                                        <li>Use <code>| safe</code> to render HTML correctly (e.g. for section content).</li>
                                        <li>Use <code>&#123;% for item in list %&#125;</code> to loop through arrays.</li>
                                        <li>Use <code>&#123;% if variable %&#125;</code> to show content conditionally.</li>
                                    </ul>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {error && (
                    <div style={{ padding: '12px 24px', backgroundColor: '#fef2f2', borderTop: '1px solid #fee2e2', color: '#dc2626', fontSize: '0.9rem', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                        {error}
                    </div>
                )}

                <div style={{ padding: '20px 24px', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'flex-end', gap: '12px', backgroundColor: '#fafafa' }}>
                    <button onClick={onClose} style={{ padding: '10px 18px', borderRadius: '8px', border: '1px solid #cbd5e1', background: 'white', color: '#475569', fontSize: '0.9rem', fontWeight: 500, cursor: 'pointer' }}>
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        style={{
                            padding: '10px 24px',
                            borderRadius: '8px',
                            border: 'none',
                            background: '#2563eb',
                            color: 'white',
                            fontSize: '0.9rem',
                            fontWeight: 600,
                            cursor: saving ? 'not-allowed' : 'pointer',
                            opacity: saving ? 0.7 : 1,
                            boxShadow: '0 4px 6px -1px rgba(37, 99, 235, 0.2)'
                        }}
                    >
                        {saving ? 'Saving...' : 'Save Formatting Style'}
                    </button>
                </div>
            </div>
        </div>
    );
}
