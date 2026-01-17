import React, { useState, useEffect } from 'react';

interface EmailReportModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (email: string) => Promise<void>;
    defaultEmail: string;
}

export default function EmailReportModal({ isOpen, onClose, onSubmit, defaultEmail }: EmailReportModalProps) {
    const [email, setEmail] = useState('');
    const [sending, setSending] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setEmail(defaultEmail || '');
            setSending(false);
        }
    }, [isOpen, defaultEmail]);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email) return;

        setSending(true);
        try {
            await onSubmit(email);
            onClose();
        } catch (error) {
            console.error("Failed to send email", error);
            // Error handling should be done by parent or here if we want to show it in modal
        } finally {
            setSending(false);
        }
    };

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 1000
        }}>
            <div style={{
                background: 'white', padding: '2rem', borderRadius: '12px',
                width: '100%', maxWidth: '400px', boxShadow: '0 4px 20px rgba(0,0,0,0.15)'
            }}>
                <h3 style={{ marginTop: 0, marginBottom: '1.5rem', fontSize: '1.25rem', color: '#111827' }}>
                    Email Report
                </h3>

                <form onSubmit={handleSubmit}>
                    <div style={{ marginBottom: '1.5rem' }}>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, color: '#374151' }}>
                            To (Recipient)
                        </label>
                        <input
                            type="email"
                            required
                            placeholder="name@example.com"
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            style={{
                                width: '100%', padding: '0.75rem', borderRadius: '6px',
                                border: '1px solid #d1d5db', fontSize: '1rem'
                            }}
                        />
                        {defaultEmail && defaultEmail !== email && (
                            <div style={{ fontSize: '0.8rem', color: '#6b7280', marginTop: '0.25rem' }}>
                                Originally sent to: {defaultEmail}
                            </div>
                        )}
                    </div>

                    <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={sending}
                            style={{
                                padding: '0.6rem 1rem', background: 'none', border: '1px solid #d1d5db',
                                borderRadius: '6px', cursor: 'pointer', fontWeight: 500, color: '#374151'
                            }}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={sending || !email}
                            style={{
                                padding: '0.6rem 1.5rem', background: '#0E47CB', border: 'none',
                                borderRadius: '6px', cursor: 'pointer', fontWeight: 600, color: 'white',
                                opacity: sending ? 0.7 : 1
                            }}
                        >
                            {sending ? 'Sending...' : 'Send'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
