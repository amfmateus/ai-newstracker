"use client";

import React, { useState, useEffect } from 'react';

interface OutputConfigData {
    id?: string;
    name: string;
    converter_type: string;
    parameters: any;
}

interface OutputConfigEditorModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (data: OutputConfigData) => Promise<void>;
    initialData?: OutputConfigData | null;
}

export default function OutputConfigEditorModal({
    isOpen,
    onClose,
    onSave,
    initialData
}: OutputConfigEditorModalProps) {
    const [name, setName] = useState('');
    const [converterType, setConverterType] = useState('PDF');
    const [parameters, setParameters] = useState<any>({});
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'general' | 'parameters'>('general');

    useEffect(() => {
        if (initialData) {
            setName(initialData.name || '');
            setConverterType(initialData.converter_type || 'PDF');
            setParameters(initialData.parameters || {});
        } else {
            setName('');
            setConverterType('PDF');
            setParameters({});
        }
    }, [initialData, isOpen]);

    if (!isOpen) return null;

    const handleSave = async () => {
        if (!name.trim()) {
            setError('Please enter a name for this configuration.');
            return;
        }
        setSaving(true);
        setError(null);
        try {
            await onSave({
                id: initialData?.id,
                name,
                converter_type: converterType,
                parameters
            });
            onClose();
        } catch (e: any) {
            setError(e.message || 'Failed to save output configuration.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.4)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px'
        }}>
            <div style={{
                backgroundColor: 'white',
                borderRadius: '16px',
                width: '100%',
                maxHeight: '90vh',
                maxWidth: '600px',
                display: 'flex',
                flexDirection: 'column',
                boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
                overflow: 'hidden'
            }}>
                {/* Header */}
                <div style={{
                    padding: '20px 24px',
                    borderBottom: '1px solid #f1f5f9',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    background: 'linear-gradient(to right, #ffffff, #f8faff)'
                }}>
                    <div>
                        <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: '#0f172a' }}>
                            {initialData ? 'Edit Output Config' : 'Create Output Config'}
                        </h2>
                        <p style={{ margin: '4px 0 0 0', fontSize: '0.875rem', color: '#64748b' }}>
                            Configure how your report is generated and formatted.
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        style={{
                            background: '#f1f5f9',
                            border: 'none',
                            borderRadius: '50%',
                            width: '32px',
                            height: '32px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            color: '#64748b',
                            transition: 'all 0.2s'
                        }}
                    >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    </button>
                </div>

                {/* Tabs */}
                <div style={{ display: 'flex', padding: '0 24px', borderBottom: '1px solid #f1f5f9', gap: '24px' }}>
                    {[
                        { id: 'general', label: 'General Settings' },
                        { id: 'parameters', label: 'Parameters' }
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as any)}
                            style={{
                                padding: '16px 4px',
                                fontSize: '0.9rem',
                                fontWeight: 600,
                                color: activeTab === tab.id ? '#2563eb' : '#64748b',
                                border: 'none',
                                background: 'none',
                                borderBottom: `2px solid ${activeTab === tab.id ? '#2563eb' : 'transparent'}`,
                                cursor: 'pointer',
                                transition: 'all 0.2s'
                            }}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* Content */}
                <div style={{ padding: '24px', overflowY: 'auto', flex: 1 }}>
                    {error && (
                        <div style={{
                            padding: '12px 16px',
                            backgroundColor: '#fef2f2',
                            border: '1px solid #fee2e2',
                            borderRadius: '8px',
                            color: '#b91c1c',
                            fontSize: '0.9rem',
                            marginBottom: '20px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px'
                        }}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                            {error}
                        </div>
                    )}

                    {activeTab === 'general' ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#334155', marginBottom: '8px' }}>
                                    Configuration Name
                                </label>
                                <input
                                    type="text"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    placeholder="e.g., Standard PDF Export"
                                    style={{
                                        width: '100%',
                                        padding: '10px 14px',
                                        borderRadius: '8px',
                                        border: '1px solid #e2e8f0',
                                        fontSize: '0.95rem',
                                        outline: 'none',
                                        transition: 'border-color 0.2s'
                                    }}
                                />
                            </div>

                            <div>
                                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#334155', marginBottom: '8px' }}>
                                    Converter Type
                                </label>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                    {['PDF', 'HTML'].map(type => (
                                        <button
                                            key={type}
                                            onClick={() => setConverterType(type)}
                                            style={{
                                                padding: '12px',
                                                borderRadius: '10px',
                                                border: `2px solid ${converterType === type ? '#2563eb' : '#f1f5f9'}`,
                                                backgroundColor: converterType === type ? '#f8faff' : 'white',
                                                color: converterType === type ? '#2563eb' : '#64748b',
                                                fontWeight: 600,
                                                cursor: 'pointer',
                                                transition: 'all 0.2s',
                                                display: 'flex',
                                                flexDirection: 'column',
                                                alignItems: 'center',
                                                gap: '4px'
                                            }}
                                        >
                                            <span style={{ fontSize: '1.1rem' }}>{type === 'PDF' ? '📄' : '🌐'}</span>
                                            {type}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                            <div style={{
                                padding: '16px',
                                backgroundColor: '#f8fafc',
                                borderRadius: '12px',
                                border: '1px solid #f1f5f9'
                            }}>
                                <h4 style={{ margin: '0 0 8px 0', fontSize: '0.9rem', color: '#334155', fontWeight: 600 }}>Advanced Parameters</h4>
                                <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b', lineHeight: 1.5 }}>
                                    Customize how your report files are named and formatted.
                                </p>
                            </div>

                            <div>
                                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#334155', marginBottom: '8px' }}>
                                    Filename Template
                                </label>
                                <input
                                    type="text"
                                    value={parameters.filename_template || ''}
                                    onChange={(e) => setParameters({ ...parameters, filename_template: e.target.value })}
                                    placeholder="e.g., Report_{{date}}_{{title}}"
                                    style={{
                                        width: '100%',
                                        padding: '10px 14px',
                                        borderRadius: '8px',
                                        border: '1px solid #e2e8f0',
                                        fontSize: '0.95rem',
                                        outline: 'none',
                                        transition: 'border-color 0.2s',
                                        marginBottom: '8px'
                                    }}
                                />
                                <p style={{ margin: 0, fontSize: '0.75rem', color: '#64748b' }}>
                                    Available variables: <code>{`{{date}}`}</code>, <code>{`{{time}}`}</code>, <code>{`{{title}}`}</code>, <code>{`{{pipeline}}`}</code>
                                </p>
                            </div>

                            <div style={{ opacity: 0.5, pointerEvents: 'none' }}>
                                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#334155', marginBottom: '8px' }}>
                                    Paper Size (PDF only)
                                </label>
                                <select
                                    disabled
                                    style={{
                                        width: '100%',
                                        padding: '10px 14px',
                                        borderRadius: '8px',
                                        border: '1px solid #e2e8f0',
                                        backgroundColor: '#f8fafc',
                                        fontSize: '0.95rem'
                                    }}
                                >
                                    <option>A4 (Default)</option>
                                    <option>Letter</option>
                                </select>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div style={{
                    padding: '20px 24px',
                    borderTop: '1px solid #f1f5f9',
                    display: 'flex',
                    justifyContent: 'flex-end',
                    gap: '12px',
                    backgroundColor: '#f8fafc'
                }}>
                    <button
                        onClick={onClose}
                        style={{
                            padding: '10px 20px',
                            borderRadius: '8px',
                            border: '1px solid #e2e8f0',
                            backgroundColor: 'white',
                            color: '#64748b',
                            fontWeight: 600,
                            fontSize: '0.95rem',
                            cursor: 'pointer'
                        }}
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
                            backgroundColor: '#2563eb',
                            color: 'white',
                            fontWeight: 600,
                            fontSize: '0.95rem',
                            cursor: saving ? 'not-allowed' : 'pointer',
                            opacity: saving ? 0.7 : 1,
                            boxShadow: '0 4px 6px -1px rgba(37, 99, 235, 0.2)'
                        }}
                    >
                        {saving ? 'Saving...' : 'Save Configuration'}
                    </button>
                </div>
            </div>
        </div>
    );
}
