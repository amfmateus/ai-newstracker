"use client";

import React, { useState, useEffect } from 'react';

interface DeliveryConfigData {
    id?: string;
    name: string;
    delivery_type: string;
    parameters: any;
}

interface DeliveryConfigEditorModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (data: DeliveryConfigData) => Promise<void>;
    initialData?: DeliveryConfigData | null;
}

// Internal reusable component for Email Lists
const EmailListField = ({
    label,
    emails = [],
    onChange,
    placeholder = "Enter email address..."
}: {
    label: string,
    emails: string[],
    onChange: (emails: string[]) => void,
    placeholder?: string
}) => {
    const [input, setInput] = useState('');

    const handleAdd = () => {
        if (!input.trim()) return;
        // Basic duplicate check
        if (!emails.includes(input.trim())) {
            onChange([...emails, input.trim()]);
        }
        setInput('');
    };

    const handleRemove = (email: string) => {
        onChange(emails.filter(e => e !== email));
    };

    return (
        <div>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#334155', marginBottom: '8px' }}>
                {label}
            </label>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                <input
                    type="email"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAdd())}
                    placeholder={placeholder}
                    style={{
                        flex: 1,
                        padding: '10px 14px',
                        borderRadius: '8px',
                        border: '1px solid #e2e8f0',
                        fontSize: '0.95rem',
                        outline: 'none'
                    }}
                />
                <button
                    onClick={handleAdd}
                    style={{
                        padding: '0 16px',
                        borderRadius: '8px',
                        backgroundColor: '#f1f5f9',
                        border: 'none',
                        color: '#334155',
                        fontWeight: 600,
                        cursor: 'pointer'
                    }}
                >
                    Add
                </button>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {emails.map((email: string) => (
                    <div
                        key={email}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '4px 10px',
                            backgroundColor: '#eff6ff',
                            color: '#1e40af',
                            borderRadius: '6px',
                            fontSize: '0.85rem',
                            fontWeight: 500,
                            border: '1px solid #dbeafe'
                        }}
                    >
                        {email}
                        <button
                            onClick={() => handleRemove(email)}
                            style={{
                                background: 'none',
                                border: 'none',
                                padding: 2,
                                color: '#1e40af',
                                cursor: 'pointer',
                                display: 'flex'
                            }}
                        >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                        </button>
                    </div>
                ))}
                {emails.length === 0 && (
                    <span style={{ fontSize: '0.85rem', color: '#94a3b8', fontStyle: 'italic' }}>
                        No emails added.
                    </span>
                )}
            </div>
        </div>
    );
};

export default function DeliveryConfigEditorModal({
    isOpen,
    onClose,
    onSave,
    initialData
}: DeliveryConfigEditorModalProps) {
    const [name, setName] = useState('');
    const [deliveryType, setDeliveryType] = useState('EMAIL');

    // Flattened state for easier form handling, will recombine on save
    const [recipients, setRecipients] = useState<string[]>([]);
    const [subject, setSubject] = useState('');
    const [cc, setCc] = useState<string[]>([]);
    const [bcc, setBcc] = useState<string[]>([]);

    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (initialData) {
            setName(initialData.name || '');
            setDeliveryType(initialData.delivery_type || 'EMAIL');

            const p = initialData.parameters || {};
            setRecipients(p.recipients || []);
            setSubject(p.subject || '');
            setCc(p.cc || []);
            setBcc(p.bcc || []);
            setBcc(p.bcc || []);
        } else {
            setName('');
            setDeliveryType('EMAIL');
            setRecipients([]);
            setSubject('');
            setCc([]);
            setBcc([]);
        }
    }, [initialData, isOpen]);

    if (!isOpen) return null;

    const handleSave = async () => {
        if (!name.trim()) {
            setError('Please enter a name for this delivery target.');
            return;
        }
        if (deliveryType === 'EMAIL' && recipients.length === 0) {
            setError('Please add at least one recipient email.');
            return;
        }

        setSaving(true);
        setError(null);
        try {
            const parameters: any = {
                recipients,
                subject
            };

            // Only add optional fields if they have values to keep JSON clean
            if (cc.length > 0) parameters.cc = cc;
            if (bcc.length > 0) parameters.bcc = bcc;

            await onSave({
                id: initialData?.id,
                name,
                delivery_type: deliveryType,
                parameters
            });
            onClose();
        } catch (e: any) {
            setError(e.message || 'Failed to save delivery configuration.');
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
                            {initialData ? 'Edit Delivery Target' : 'Create Delivery Target'}
                        </h2>
                        <p style={{ margin: '4px 0 0 0', fontSize: '0.875rem', color: '#64748b' }}>
                            Configure where and how your reports are delivered.
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

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        <div>
                            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#334155', marginBottom: '8px' }}>
                                Target Name
                            </label>
                            <input
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="e.g., Executive Team Weekly Email"
                                style={{
                                    width: '100%',
                                    padding: '10px 14px',
                                    borderRadius: '8px',
                                    border: '1px solid #e2e8f0',
                                    fontSize: '0.95rem',
                                    outline: 'none'
                                }}
                            />
                        </div>

                        <div>
                            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#334155', marginBottom: '8px' }}>
                                Delivery Method
                            </label>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
                                {[
                                    { id: 'EMAIL', label: 'Email', icon: '✉️' },
                                    { id: 'TELEGRAM', label: 'Telegram', icon: '📱' },
                                    { id: 'WEBHOOK', label: 'Webhook', icon: '🔗' }
                                ].map(type => (
                                    <button
                                        key={type.id}
                                        onClick={() => setDeliveryType(type.id)}
                                        style={{
                                            padding: '12px',
                                            borderRadius: '10px',
                                            border: `2px solid ${deliveryType === type.id ? '#2563eb' : '#f1f5f9'}`,
                                            backgroundColor: deliveryType === type.id ? '#f8faff' : 'white',
                                            color: deliveryType === type.id ? '#2563eb' : '#64748b',
                                            fontWeight: 600,
                                            cursor: 'pointer',
                                            transition: 'all 0.2s',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            alignItems: 'center',
                                            gap: '4px'
                                        }}
                                    >
                                        <span style={{ fontSize: '1.2rem' }}>{type.icon}</span>
                                        <span style={{ fontSize: '0.8rem' }}>{type.label}</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {deliveryType === 'EMAIL' && (
                            <>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#334155', marginBottom: '8px' }}>
                                        Email Subject (Optional)
                                    </label>
                                    <input
                                        type="text"
                                        value={subject}
                                        onChange={(e) => setSubject(e.target.value)}
                                        placeholder="Use {{ date }} or {{ title }} for dynamic content"
                                        style={{
                                            width: '100%',
                                            padding: '10px 14px',
                                            borderRadius: '8px',
                                            border: '1px solid #e2e8f0',
                                            fontSize: '0.95rem',
                                            outline: 'none'
                                        }}
                                    />
                                </div>

                                <EmailListField
                                    label="Recipients"
                                    emails={recipients}
                                    onChange={setRecipients}
                                    placeholder="Enter recipient email..."
                                />

                                <EmailListField
                                    label="CC (Carbon Copy)"
                                    emails={cc}
                                    onChange={setCc}
                                    placeholder="Enter CC email..."
                                />

                                <EmailListField
                                    label="BCC (Blind Carbon Copy)"
                                    emails={bcc}
                                    onChange={setBcc}
                                    placeholder="Enter BCC email..."
                                />
                            </>
                        )}

                        {deliveryType !== 'EMAIL' && (
                            <div style={{
                                padding: '24px',
                                textAlign: 'center',
                                backgroundColor: '#f8fafc',
                                borderRadius: '12px',
                                border: '2px dashed #e2e8f0'
                            }}>
                                <span style={{ fontSize: '1.5rem', display: 'block', marginBottom: '8px' }}>⌛</span>
                                <p style={{ margin: 0, fontSize: '0.9rem', color: '#64748b' }}>
                                    {deliveryType} integration is coming soon.
                                </p>
                            </div>
                        )}
                    </div>
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
