'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { OutputConfigLibrary, fetchOutputConfigs, createOutputConfig, updateOutputConfig } from '../../../../lib/api';
import styles from '../../../PipelineBuilder.module.css';
import AlertModal, { AlertType } from '../../../../components/AlertModal';

interface PageProps {
    params: Promise<{ id: string }>;
}

export default function OutputEditor({ params }: PageProps) {
    const { id } = use(params);
    const isNew = id === 'new';
    const [config, setConfig] = useState<Partial<OutputConfigLibrary>>({
        name: 'New Output Config',
        converter_type: 'PDF',
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
        const list = await fetchOutputConfigs();
        const found = list.find(o => o.id === id);
        if (found) setConfig(found);
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            if (isNew) {
                await createOutputConfig(config);
            } else {
                await updateOutputConfig(id, config);
            }
            router.push('/pipelines/libraries/output');
        } catch (e) {
            setAlertState({ isOpen: true, message: "Failed to save config", type: 'error' });
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className={styles.container} style={{ maxWidth: '800px', margin: '0 auto' }}>
            <div style={{ marginBottom: '1rem' }}>
                <Link href="/pipelines/libraries/output" style={{ textDecoration: 'none', color: '#666' }}>&larr; Back to Library</Link>
            </div>

            <header className={styles.header}>
                <h1 className={styles.title}>{isNew ? 'New Output Config' : 'Edit Output Config'}</h1>
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
                    <label className={styles.label}>Converter Type</label>
                    <select
                        className={styles.select}
                        value={config.converter_type}
                        onChange={e => setConfig({ ...config, converter_type: e.target.value })}
                    >
                        <option value="PDF">PDF</option>
                        <option value="HTML">HTML</option>
                        <option value="MARKDOWN">Markdown</option>
                        <option value="DOCX">Word / Google Doc</option>
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
                    />
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
