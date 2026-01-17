'use client';

import { useState, useEffect } from 'react';
import { SourceConfigLibrary } from '../lib/api';
import AlertModal, { AlertType } from './AlertModal';

interface SourceConfigEditorModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (data: Partial<SourceConfigLibrary>) => Promise<void>;
    initialData: SourceConfigLibrary | null;
}

export default function SourceConfigEditorModal({ isOpen, onClose, onSave, initialData }: SourceConfigEditorModalProps) {
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [saving, setSaving] = useState(false);
    const [alertState, setAlertState] = useState<{ isOpen: boolean; message: string; type: AlertType }>({
        isOpen: false,
        message: '',
        type: 'info'
    });

    useEffect(() => {
        if (initialData) {
            setName(initialData.name || '');
            setDescription(initialData.description || '');
        } else {
            setName('');
            setDescription('');
        }
    }, [initialData, isOpen]);

    if (!isOpen) return null;

    const handleSave = async () => {
        if (!name.trim()) {
            setAlertState({ isOpen: true, message: 'Name is required', type: 'error' });
            return;
        }

        setSaving(true);
        try {
            await onSave({
                ...initialData,
                name,
                description
            });
            onClose();
        } catch (e: any) {
            setAlertState({ isOpen: true, message: e.message || 'Failed to save template', type: 'error' });
        } finally {
            setSaving(false);
        }
    };

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)', display: 'flex',
            alignItems: 'center', justifyContent: 'center', zIndex: 2000,
            backdropFilter: 'blur(4px)'
        }}>
            <div style={{
                backgroundColor: 'white', padding: '32px', borderRadius: '16px',
                width: '100%', maxWidth: '500px', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
            }}>
                <div style={{ marginBottom: '24px' }}>
                    <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700, color: '#0f172a' }}>
                        {initialData ? 'Edit Filter Template' : 'Create Filter Template'}
                    </h2>
                    <p style={{ margin: '4px 0 0 0', color: '#64748b', fontSize: '0.95rem' }}>
                        Update the name and description for this template.
                    </p>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <div>
                        <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: 600, color: '#475569', marginBottom: '8px' }}>
                            Template Name
                        </label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="e.g., Tech News Filter"
                            style={{
                                width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0',
                                fontSize: '1rem', outline: 'none', transition: 'border-color 0.2s'
                            }}
                        />
                    </div>

                    <div>
                        <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: 600, color: '#475569', marginBottom: '8px' }}>
                            Description
                        </label>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Describe what this filter does..."
                            rows={4}
                            style={{
                                width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0',
                                fontSize: '1rem', outline: 'none', transition: 'border-color 0.2s', resize: 'vertical'
                            }}
                        />
                    </div>
                </div>

                <div style={{ marginTop: '32px', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                    <button
                        onClick={onClose}
                        style={{
                            padding: '10px 20px', borderRadius: '8px', border: '1px solid #e2e8f0',
                            backgroundColor: 'white', color: '#64748b', fontWeight: 600, cursor: 'pointer'
                        }}
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        style={{
                            padding: '10px 24px', borderRadius: '8px', border: 'none',
                            backgroundColor: '#2563eb', color: 'white', fontWeight: 600, cursor: 'pointer',
                            opacity: saving ? 0.7 : 1, transition: 'background-color 0.2s'
                        }}
                    >
                        {saving ? 'Saving...' : 'Save Changes'}
                    </button>
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
