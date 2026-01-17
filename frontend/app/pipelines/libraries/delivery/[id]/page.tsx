'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { DeliveryConfigLibrary, fetchDeliveryConfigs, createDeliveryConfig, updateDeliveryConfig } from '../../../../lib/api';
import styles from '../../../PipelineBuilder.module.css';
import AlertModal, { AlertType } from '../../../../components/AlertModal';

interface PageProps {
    params: Promise<{ id: string }>;
}

export default function DeliveryEditor({ params }: PageProps) {
    const { id } = use(params);
    const isNew = id === 'new';
    const [config, setConfig] = useState<Partial<DeliveryConfigLibrary>>({
        name: 'New Delivery Config',
        delivery_type: 'EMAIL',
        parameters: {}
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
        const list = await fetchDeliveryConfigs();
        const found = list.find(d => d.id === id);
        if (found) setConfig(found);
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            if (isNew) {
                await createDeliveryConfig(config);
            } else {
                await updateDeliveryConfig(id, config);
            }
            router.push('/pipelines/libraries/delivery');
        } catch (e) {
            setAlertState({ isOpen: true, message: "Failed to save config", type: 'error' });
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className={styles.container} style={{ maxWidth: '800px', margin: '0 auto' }}>
            <div style={{ marginBottom: '1rem' }}>
                <Link href="/pipelines/libraries/delivery" style={{ textDecoration: 'none', color: '#666' }}>&larr; Back to Library</Link>
            </div>

            <header className={styles.header}>
                <h1 className={styles.title}>{isNew ? 'New Delivery Config' : 'Edit Delivery Config'}</h1>
                <button onClick={handleSave} disabled={saving} className={styles.saveButton}>
                    {saving ? 'Saving...' : 'Save Config'}
                </button>
            </header>

            <div className={styles.configPanel} style={{ border: 'none', padding: 0 }}>
                <div className={styles.formGroup}>
                    <label className={styles.label}>Name</label>
                    <input
                        className={styles.input}
                        value={config.name}
                        onChange={e => setConfig({ ...config, name: e.target.value })}
                    />
                </div>

                <div className={styles.formGroup}>
                    <label className={styles.label}>Delivery Type</label>
                    <select
                        className={styles.select}
                        value={config.delivery_type}
                        onChange={e => setConfig({ ...config, delivery_type: e.target.value })}
                    >
                        <option value="EMAIL">Email</option>
                        <option value="TELEGRAM">Telegram</option>
                        <option value="GOOGLE_DRIVE">Google Drive</option>
                        <option value="WEBHOOK">Webhook (POST)</option>
                        <option value="SLACK">Slack</option>
                    </select>
                </div>

                <div className={styles.formGroup}>
                    <label className={styles.label}>Parameters (JSON)</label>
                    <textarea
                        className={styles.textarea}
                        value={JSON.stringify(config.parameters, null, 2)}
                        onChange={e => {
                            try {
                                const json = JSON.parse(e.target.value);
                                setConfig({ ...config, parameters: json });
                            } catch (err) { }
                        }}
                        placeholder='{ "recipients": ["user@example.com"], "subject_prefix": "[Report]" }'
                    />
                </div>
            </div>

            <AlertModal
                isOpen={alertState.isOpen}
                message={alertState.message}
                type={alertState.type}
                onClose={() => setAlertState(prev => ({ ...prev, isOpen: false }))}
            />
        </div >
    );
}
