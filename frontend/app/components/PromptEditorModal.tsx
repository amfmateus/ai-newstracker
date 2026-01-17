import React, { useState, useEffect } from 'react';
import styles from '../pipelines/PipelineBuilder.module.css'; // Reusing existing styles for consistency
import { PromptLibrary, createPrompt, updatePrompt, fetchAIModels } from '../lib/api';

interface PromptEditorModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (prompt: PromptLibrary) => void;
    initialData?: PromptLibrary | null;
    availableVariables?: Array<{ name: string; description: string }>;
}

export default function PromptEditorModal(props: PromptEditorModalProps) {
    const { isOpen, onClose, onSave, initialData, availableVariables } = props;
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [promptText, setPromptText] = useState('');
    const [model, setModel] = useState('gemini-2.0-flash-lite');
    const [availableModels, setAvailableModels] = useState<Array<{ id: string, name: string }>>([]);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Load available models
    useEffect(() => {
        if (isOpen) {
            fetchAIModels().then(setAvailableModels).catch(console.error);
        }
    }, [isOpen]);

    // Reset or populate form when opening
    useEffect(() => {
        if (isOpen) {
            if (initialData) {
                setName(initialData.name);
                setDescription(initialData.description || '');
                setPromptText(initialData.prompt_text);
                setModel(initialData.model || 'gemini-2.0-flash-lite');
            } else {
                setName('');
                setDescription('');
                setPromptText('');
                setModel('gemini-2.0-flash-lite');
            }
            setError(null);
        }
    }, [isOpen, initialData]);

    if (!isOpen) return null;

    const handleSave = async () => {
        if (!name.trim()) {
            setError('Name is required');
            return;
        }
        if (!promptText.trim()) {
            setError('Prompt text is required');
            return;
        }

        setSaving(true);
        setError(null);

        try {
            let savedPrompt;
            if (initialData) {
                // Update
                savedPrompt = await updatePrompt(initialData.id, {
                    name,
                    description,
                    prompt_text: promptText,
                    model,
                    // Keep other fields if necessary
                    template: initialData.template || '',
                    input_variables: initialData.input_variables || []
                });
            } else {
                // Create
                savedPrompt = await createPrompt({
                    name,
                    description,
                    prompt_text: promptText,
                    model,
                    template: 'jinja2', // Default
                    input_variables: [] // Auto-detect or default
                });
            }
            onSave(savedPrompt);
            onClose();
        } catch (e: any) {
            setError(e.message || 'Failed to save prompt');
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
                maxWidth: '1000px',
                height: '85vh',
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
                            {initialData ? 'Edit Prompt' : 'Create New Prompt'}
                        </h2>
                        <p style={{ margin: '4px 0 0', fontSize: '0.85rem', color: '#64748b' }}>
                            Configure the AI instructions and variables.
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
                        <div>
                            <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', fontWeight: 600, color: '#334155' }}>Name</label>
                            <input
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="e.g., General News Analysis"
                                style={{
                                    width: '100%',
                                    padding: '10px 12px',
                                    borderRadius: '8px',
                                    border: '1px solid #e2e8f0',
                                    fontSize: '0.95rem',
                                    outline: 'none',
                                    transition: 'border-color 0.2s, box-shadow 0.2s'
                                }}
                                onFocus={(e) => {
                                    e.target.style.borderColor = '#3b82f6';
                                    e.target.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)';
                                }}
                                onBlur={(e) => {
                                    e.target.style.borderColor = '#e2e8f0';
                                    e.target.style.boxShadow = 'none';
                                }}
                            />
                        </div>
                        <div>
                            <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', fontWeight: 600, color: '#334155' }}>Description</label>
                            <textarea
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder="Describe what this prompt does..."
                                style={{
                                    width: '100%',
                                    minHeight: '80px',
                                    padding: '10px 12px',
                                    borderRadius: '8px',
                                    border: '1px solid #e2e8f0',
                                    fontSize: '0.95rem',
                                    resize: 'vertical',
                                    outline: 'none'
                                }}
                                onFocus={(e) => { e.target.style.borderColor = '#3b82f6'; e.target.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)'; }}
                                onBlur={(e) => { e.target.style.borderColor = '#e2e8f0'; e.target.style.boxShadow = 'none'; }}
                            />
                        </div>

                        {/* Model Selector */}
                        <div>
                            <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', fontWeight: 600, color: '#334155' }}>AI Model</label>
                            <select
                                value={model}
                                onChange={(e) => setModel(e.target.value)}
                                style={{
                                    width: '100%',
                                    padding: '10px 12px',
                                    borderRadius: '8px',
                                    border: '1px solid #e2e8f0',
                                    fontSize: '0.95rem',
                                    outline: 'none',
                                    backgroundColor: 'white',
                                    cursor: 'pointer'
                                }}
                            >
                                <option value="" disabled>Select a model...</option>
                                {availableModels.map(m => (
                                    <option key={m.id} value={m.id}>
                                        {m.name}
                                    </option>
                                ))}
                            </select>
                            <p style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '4px' }}>
                                The specific AI model used to generate the report.
                            </p>
                        </div>

                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                            <label style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '0.9rem', fontWeight: 600, color: '#334155' }}>
                                Prompt Template
                                <span style={{ fontSize: '0.75rem', fontWeight: 400, color: '#64748b', background: '#f1f5f9', padding: '2px 8px', borderRadius: '12px' }}>Jinja2 Supported</span>
                            </label>
                            <textarea
                                value={promptText}
                                onChange={(e) => setPromptText(e.target.value)}
                                placeholder="Enter your system prompt here. Use {{ variables }}..."
                                style={{
                                    flex: 1,
                                    width: '100%',
                                    padding: '16px',
                                    borderRadius: '8px',
                                    border: '1px solid #e2e8f0',
                                    fontSize: '14px',
                                    fontFamily: 'Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
                                    lineHeight: '1.6',
                                    resize: 'none',
                                    outline: 'none',
                                    backgroundColor: '#fafafa'
                                }}
                                onFocus={(e) => { e.target.style.borderColor = '#3b82f6'; e.target.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)'; e.target.style.backgroundColor = 'white'; }}
                                onBlur={(e) => { e.target.style.borderColor = '#e2e8f0'; e.target.style.boxShadow = 'none'; e.target.style.backgroundColor = '#fafafa'; }}
                            />
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
                                    Context Variables
                                </h3>
                                <p style={{ fontSize: '0.8rem', color: '#64748b', margin: '8px 0 0', lineHeight: 1.4 }}>
                                    Click to copy variables to your clipboard.
                                </p>
                            </div>
                            <div style={{ padding: '20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px' }}>
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
                                            // You could trigger a toast here
                                        }}
                                        onMouseOver={(e) => {
                                            e.currentTarget.style.borderColor = '#3b82f6';
                                            e.currentTarget.style.transform = 'translateY(-1px)';
                                            e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)';
                                        }}
                                        onMouseOut={(e) => {
                                            e.currentTarget.style.borderColor = '#e2e8f0';
                                            e.currentTarget.style.transform = 'none';
                                            e.currentTarget.style.boxShadow = '0 1px 2px rgba(0,0,0,0.05)';
                                        }}
                                        title="Click to copy syntax"
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
                            </div>
                        </div>
                    )}
                </div>

                {error && (
                    <div style={{
                        padding: '12px 24px',
                        backgroundColor: '#fef2f2',
                        borderTop: '1px solid #fee2e2',
                        color: '#dc2626',
                        fontSize: '0.9rem',
                        fontWeight: 500,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                    }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                        {error}
                    </div>
                )}

                <div style={{
                    padding: '20px 24px',
                    borderTop: '1px solid #f1f5f9',
                    display: 'flex',
                    justifyContent: 'flex-end',
                    gap: '12px',
                    backgroundColor: '#fafafa'
                }}>
                    <button
                        onClick={onClose}
                        style={{
                            padding: '10px 18px',
                            borderRadius: '8px',
                            border: '1px solid #cbd5e1',
                            background: 'white',
                            color: '#475569',
                            fontSize: '0.9rem',
                            fontWeight: 500,
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                        }}
                        onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#f8fafc'}
                        onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'white'}
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        style={{
                            padding: '10px 24px',
                            borderRadius: '8px',
                            border: 'none',
                            background: '#2563eb', // Blue-600
                            color: 'white',
                            fontSize: '0.9rem',
                            fontWeight: 600,
                            cursor: saving ? 'not-allowed' : 'pointer',
                            opacity: saving ? 0.7 : 1,
                            transition: 'all 0.2s',
                            boxShadow: '0 4px 6px -1px rgba(37, 99, 235, 0.2), 0 2px 4px -1px rgba(37, 99, 235, 0.1)'
                        }}
                        onMouseOver={(e) => {
                            if (!saving) e.currentTarget.style.backgroundColor = '#1d4ed8'; // Blue-700
                        }}
                        onMouseOut={(e) => {
                            if (!saving) e.currentTarget.style.backgroundColor = '#2563eb';
                        }}
                    >
                        {saving ? 'Saving...' : 'Save Prompt'}
                    </button>
                </div>
            </div>
        </div >
    );
}
