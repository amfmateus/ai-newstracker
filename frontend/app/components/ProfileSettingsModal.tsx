'use client';

import React, { useState, useEffect } from 'react';
import { fetchUserProfile, updateUserProfile, UserProfile, fetchSettings, updateSettings, validateAIKey } from '../lib/api';

interface ProfileSettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function ProfileSettingsModal({ isOpen, onClose }: ProfileSettingsModalProps) {
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [apiKey, setApiKey] = useState('');

    // Key Validation State
    const [checkingKey, setCheckingKey] = useState(false);
    const [keyStatus, setKeyStatus] = useState<'valid' | 'invalid' | 'unchecked'>('unchecked');
    const [keyMessage, setKeyMessage] = useState('');

    const [fullName, setFullName] = useState('');

    // SMTP Settings State
    const [smtpHost, setSmtpHost] = useState('');
    const [smtpPort, setSmtpPort] = useState('587');
    const [smtpUser, setSmtpUser] = useState('');
    const [smtpPassword, setSmtpPassword] = useState('');
    const [smtpFromEmail, setSmtpFromEmail] = useState('');
    const [smtpSenderName, setSmtpSenderName] = useState('');
    const [smtpReplyTo, setSmtpReplyTo] = useState('');

    const [enableStories, setEnableStories] = useState(false);

    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const validateKey = async (key: string) => {
        setCheckingKey(true);
        setKeyStatus('unchecked');
        try {
            const res = await validateAIKey(key);
            setKeyStatus(res.status);
            if (res.status === 'invalid') setKeyMessage(res.message || 'Unknown error');
        } catch (e) {
            setKeyStatus('invalid');
            setKeyMessage('Validation check failed');
        } finally {
            setCheckingKey(false);
        }
    };

    useEffect(() => {
        if (isOpen) {
            loadProfile();
            setSuccess('');
            setError('');
            setApiKey(''); // Always start blank for security (we don't show the existing key)
        }
    }, [isOpen]);

    const loadProfile = async () => {
        setLoading(true);
        try {
            // Load Profile
            const profileData = await fetchUserProfile();
            setProfile(profileData);
            setFullName(profileData.full_name || '');

            // Load System Settings (SMTP)
            const settingsData = await fetchSettings();
            if (settingsData) {
                setSmtpHost(settingsData.smtp_host || '');
                setSmtpPort(settingsData.smtp_port?.toString() || '587');
                setSmtpUser(settingsData.smtp_user || '');
                setSmtpPassword(settingsData.smtp_password || '');
                setSmtpFromEmail(settingsData.smtp_from_email || '');
                setSmtpSenderName(settingsData.smtp_sender_name || '');
                setSmtpReplyTo(settingsData.smtp_reply_to || '');

                // Story Toggle
                setEnableStories(settingsData.enable_stories === true);
            }
        } catch (e) {
            setError('Failed to load profile or settings');
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        setError('');
        setSuccess('');

        try {
            const updateData: any = {};
            if (apiKey) updateData.google_api_key = apiKey;
            if (fullName !== profile?.full_name) updateData.full_name = fullName;

            // Save User Profile
            let updatedProfile = profile;
            if (Object.keys(updateData).length > 0) {
                updatedProfile = await updateUserProfile(updateData);
                setProfile(updatedProfile);
            }

            // Save Settings
            const settingsUpdate: any = {
                smtp_host: smtpHost,
                smtp_port: parseInt(smtpPort) || 587,
                smtp_user: smtpUser,
                smtp_password: smtpPassword,
                smtp_from_email: smtpFromEmail,
                smtp_sender_name: smtpSenderName,
                smtp_reply_to: smtpReplyTo,
                enable_stories: enableStories
            };

            await updateSettings(settingsUpdate);

            setSuccess('Settings saved successfully');
            setApiKey(''); // Clear input after save

            // Dispatch event so other components (SettingsPage) know to reload
            if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('sys-settings-updated'));
            }


            // Close after short delay if success
            setTimeout(() => {
                onClose();
            }, 1000);

        } catch (e) {
            setError('Failed to save settings');
        } finally {
            setSaving(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.5)', zIndex: 100,
            display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
            <div style={{
                background: '#fff', padding: '2rem', borderRadius: '12px', width: '550px', maxWidth: '95%',
                boxShadow: '0 10px 30px rgba(0,0,0,0.2)',
                maxHeight: '90vh', overflowY: 'auto'
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
                    <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: '#111827' }}>Profile Settings</h2>
                    <button onClick={onClose} style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontSize: '1.5rem' }}>&times;</button>
                </div>

                {loading ? (
                    <div>Loading...</div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

                        {/* Status Banner */}
                        <div style={{
                            padding: '1rem',
                            borderRadius: '8px',
                            background: profile?.has_api_key ? '#f0fdf4' : '#fef2f2',
                            border: `1px solid ${profile?.has_api_key ? '#bbf7d0' : '#fecaca'}`,
                            display: 'flex', gap: '0.75rem'
                        }}>
                            <div style={{ fontSize: '1.25rem' }}>
                                {profile?.has_api_key ? '✅' : '⚠️'}
                            </div>
                            <div>
                                <div style={{ fontWeight: 600, color: profile?.has_api_key ? '#166534' : '#991b1b' }}>
                                    {profile?.has_api_key ? 'AI Features Active' : 'AI Features Disabled'}
                                </div>
                                <div style={{ fontSize: '0.875rem', color: profile?.has_api_key ? '#15803d' : '#b91c1c' }}>
                                    {profile?.has_api_key
                                        ? 'Your Gemini API Key is configured.'
                                        : 'You must add a Google Gemini API Key to enable summarization and sentiment analysis.'}
                                </div>
                            </div>
                        </div>

                        {/* SMTP Warning Banner */}
                        {(!smtpHost || !smtpUser) && (
                            <div style={{
                                padding: '1rem',
                                borderRadius: '8px',
                                background: '#fffbeb', // Yellow-50
                                border: '1px solid #fcd34d', // Yellow-300
                                display: 'flex', gap: '0.75rem'
                            }}>
                                <div style={{ fontSize: '1.25rem' }}>📧</div>
                                <div>
                                    <div style={{ fontWeight: 600, color: '#92400e' }}>
                                        Email Features Disabled
                                    </div>
                                    <div style={{ fontSize: '0.875rem', color: '#b45309' }}>
                                        Configure SMTP settings below to enable report emailing.
                                    </div>
                                </div>
                            </div>
                        )}

                        <div>
                            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: '#374151', marginBottom: '0.5rem' }}>
                                Full Name
                            </label>
                            <input
                                type="text"
                                value={fullName}
                                onChange={(e) => setFullName(e.target.value)}
                                style={{
                                    width: '100%', padding: '0.625rem', borderRadius: '6px',
                                    border: '1px solid #d1d5db', fontSize: '0.9rem'
                                }}
                            />
                        </div>

                        <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: '#374151', marginBottom: '0.5rem' }}>
                            Google Gemini API Key
                        </label>
                        <div style={{ position: 'relative' }}>
                            <input
                                type="password"
                                placeholder={profile?.has_api_key ? "••••••••••••••••••••••••" : "Paste your API Key here"}
                                value={apiKey}
                                onChange={(e) => {
                                    setApiKey(e.target.value);
                                    // Reset validation when user types
                                    if (keyStatus !== 'unchecked') setKeyStatus('unchecked');
                                }}
                                onBlur={() => {
                                    if (apiKey.length > 10) validateKey(apiKey);
                                }}
                                style={{
                                    width: '100%', padding: '0.625rem', borderRadius: '6px',
                                    border: `1px solid ${keyStatus === 'valid' ? '#22c55e' : keyStatus === 'invalid' ? '#ef4444' : '#d1d5db'}`,
                                    fontSize: '0.9rem',
                                    fontFamily: 'monospace',
                                    paddingRight: '2.5rem'
                                }}
                            />
                            <div style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)' }}>
                                {checkingKey && <div className="animate-spin h-4 w-4 border-2 border-blue-500 rounded-full border-t-transparent"></div>}
                                {!checkingKey && keyStatus === 'valid' && <span title="Valid API Key">✅</span>}
                                {!checkingKey && keyStatus === 'invalid' && <span title={keyMessage}>❌</span>}
                            </div>
                        </div>
                        {keyStatus === 'invalid' && (
                            <p style={{ marginTop: '0.25rem', fontSize: '0.75rem', color: '#dc2626' }}>
                                Error: {keyMessage}
                            </p>
                        )}
                        <p style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: '#6b7280' }}>
                            Your key is stored securely and used only for your account. You can generate one at <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" style={{ color: '#2563eb', textDecoration: 'underline' }}>Google AI Studio</a>.
                        </p>
                    </div>

                        {/* Feature Management */}
                <div style={{ borderTop: '1px solid #eee', paddingTop: '1.25rem', marginTop: '0.5rem' }}>
                    <h3 style={{ fontSize: '1rem', fontWeight: 600, color: '#111827', marginBottom: '1rem' }}>
                        Feature Management
                    </h3>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem', background: '#f9fafb', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
                        <div>
                            <div style={{ fontSize: '0.9rem', fontWeight: 500, color: '#1f2937' }}>Enable Story Clustering</div>
                            <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>Automatically group related articles into evolving stories.</div>
                        </div>
                        <div className="relative inline-block w-12 align-middle select-none transition duration-200 ease-in">
                            <input
                                type="checkbox"
                                name="toggle"
                                id="toggle-stories"
                                checked={enableStories}
                                onChange={e => setEnableStories(e.target.checked)}
                                className="toggle-checkbox absolute block w-6 h-6 rounded-full bg-white border-4 appearance-none cursor-pointer"
                                style={{
                                    right: enableStories ? '0' : 'auto',
                                    left: enableStories ? 'auto' : '0',
                                    borderColor: enableStories ? '#3b82f6' : '#d1d5db'
                                }}
                            />
                            <label
                                htmlFor="toggle-stories"
                                onClick={() => setEnableStories(!enableStories)}
                                className={`toggle-label block overflow-hidden h-6 rounded-full cursor-pointer ${enableStories ? 'bg-blue-500' : 'bg-gray-300'}`}
                            ></label>
                        </div>
                    </div>
                </div>

                {/* Email Configuration Section */}
                <div style={{ borderTop: '1px solid #eee', paddingTop: '1.25rem', marginTop: '0.5rem' }}>
                    <h3 style={{ fontSize: '1rem', fontWeight: 600, color: '#111827', marginBottom: '1rem' }}>
                        Email Server (SMTP) Configuration
                    </h3>

                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                        <div>
                            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: '#374151', marginBottom: '0.5rem' }}>
                                SMTP Host
                            </label>
                            <input
                                type="text"
                                placeholder="smtp.gmail.com"
                                value={smtpHost}
                                onChange={(e) => setSmtpHost(e.target.value)}
                                style={{
                                    width: '100%', padding: '0.625rem', borderRadius: '6px',
                                    border: '1px solid #d1d5db', fontSize: '0.9rem'
                                }}
                            />
                        </div>
                        <div>
                            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: '#374151', marginBottom: '0.5rem' }}>
                                Port
                            </label>
                            <input
                                type="number"
                                placeholder="587"
                                value={smtpPort}
                                onChange={(e) => setSmtpPort(e.target.value)}
                                style={{
                                    width: '100%', padding: '0.625rem', borderRadius: '6px',
                                    border: '1px solid #d1d5db', fontSize: '0.9rem'
                                }}
                            />
                        </div>
                    </div>

                    <div style={{ marginBottom: '1rem' }}>
                        <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: '#374151', marginBottom: '0.5rem' }}>
                            SMTP User (Email)
                        </label>
                        <input
                            type="email"
                            placeholder="you@gmail.com"
                            value={smtpUser}
                            onChange={(e) => setSmtpUser(e.target.value)}
                            style={{
                                width: '100%', padding: '0.625rem', borderRadius: '6px',
                                border: '1px solid #d1d5db', fontSize: '0.9rem'
                            }}
                        />
                    </div>

                    <div style={{ marginBottom: '1rem' }}>
                        <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: '#374151', marginBottom: '0.5rem' }}>
                            SMTP Password / App Password
                        </label>
                        <input
                            type="password"
                            placeholder="••••••••••••"
                            value={smtpPassword}
                            onChange={(e) => setSmtpPassword(e.target.value)}
                            style={{
                                width: '100%', padding: '0.625rem', borderRadius: '6px',
                                border: '1px solid #d1d5db', fontSize: '0.9rem'
                            }}
                        />
                    </div>

                    <div>
                        <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: '#374151', marginBottom: '0.5rem' }}>
                            From Email (Optional)
                        </label>
                        <input
                            type="email"
                            placeholder="Leave blank to use SMTP User"
                            value={smtpFromEmail}
                            onChange={(e) => setSmtpFromEmail(e.target.value)}
                            style={{
                                width: '100%', padding: '0.625rem', borderRadius: '6px',
                                border: '1px solid #d1d5db', fontSize: '0.9rem'
                            }}
                        />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '0.25rem' }}>
                        <div>
                            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: '#374151', marginBottom: '0.5rem' }}>
                                Sender Name
                            </label>
                            <input
                                type="text"
                                placeholder="e.g. AI Analyst"
                                value={smtpSenderName}
                                onChange={(e) => setSmtpSenderName(e.target.value)}
                                style={{
                                    width: '100%', padding: '0.625rem', borderRadius: '6px',
                                    border: '1px solid #d1d5db', fontSize: '0.9rem'
                                }}
                            />
                        </div>
                        <div>
                            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: '#374151', marginBottom: '0.5rem' }}>
                                Reply-To Email
                            </label>
                            <input
                                type="email"
                                placeholder="replies@example.com"
                                value={smtpReplyTo}
                                onChange={(e) => setSmtpReplyTo(e.target.value)}
                                style={{
                                    width: '100%', padding: '0.625rem', borderRadius: '6px',
                                    border: '1px solid #d1d5db', fontSize: '0.9rem'
                                }}
                            />
                        </div>
                    </div>
                </div>

                {error && (
                    <div style={{ color: '#dc2626', fontSize: '0.875rem', background: '#fef2f2', padding: '0.5rem', borderRadius: '4px' }}>
                        {error}
                    </div>
                )}

                {success && (
                    <div style={{ color: '#059669', fontSize: '0.875rem', background: '#ecfdf5', padding: '0.5rem', borderRadius: '4px' }}>
                        {success}
                    </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
                    <button
                        onClick={onClose}
                        style={{
                            padding: '0.625rem 1rem', borderRadius: '6px', border: '1px solid #d1d5db',
                            background: 'white', color: '#374151', fontWeight: 500, cursor: 'pointer'
                        }}
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        style={{
                            padding: '0.625rem 1rem', borderRadius: '6px', border: 'none',
                            background: '#2563eb', color: 'white', fontWeight: 500, cursor: 'pointer',
                            opacity: saving ? 0.7 : 1
                        }}
                    >
                        {saving ? 'Saving...' : 'Save Settings'}
                    </button>
                </div>
            </div>
                )}
        </div>
        </div >
    );
}
