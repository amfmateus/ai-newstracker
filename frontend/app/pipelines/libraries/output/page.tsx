'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { fetchOutputConfigs, deleteOutputConfig, OutputConfigLibrary } from '../../../lib/api';
import styles from '../../../pipelines/PipelinesPage.module.css';
import AlertModal, { AlertType } from '../../../components/AlertModal';

export default function OutputLibraryPage() {
    const [outputs, setOutputs] = useState<OutputConfigLibrary[]>([]);
    const [alertState, setAlertState] = useState<{ isOpen: boolean; message: string; type: AlertType }>({
        isOpen: false,
        message: '',
        type: 'info'
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            const data = await fetchOutputConfigs();
            setOutputs(data);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Delete this config?")) return;
        try {
            await deleteOutputConfig(id);
            loadData();
            loadData();
        } catch (e) {
            setAlertState({ isOpen: true, message: "Failed to delete", type: 'error' });
        }
    };

    return (
        <div className={styles.container}>
            <div style={{ marginBottom: '1rem' }}>
                <Link href="/pipelines/new" style={{ textDecoration: 'none', color: '#666' }}>&larr; Back to Pipeline Builder</Link>
            </div>
            <header className={styles.header}>
                <h1 className={styles.title}>Output Configurations</h1>
                <Link href="/pipelines/libraries/output/new" className={styles.createButton}>
                    + New Config
                </Link>
            </header>

            {loading ? <div className={styles.loading}>Loading configs...</div> : (
                <div className={styles.grid}>
                    {outputs.map(o => (
                        <div key={o.id} className={styles.card}>
                            <div>
                                <h3 className={styles.cardTitle}>{o.name}</h3>
                                <p className={styles.cardDescription}>Type: {o.converter_type}</p>
                            </div>
                            <div className={styles.cardActions}>
                                <Link href={`/pipelines/libraries/output/${o.id}`} className={styles.editButton}>Edit</Link>
                                <button onClick={() => handleDelete(o.id)} className={styles.deleteButton}>Delete</button>
                            </div>
                        </div>
                    ))}
                    {outputs.length === 0 && (
                        <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '3rem', background: '#f9fafb', borderRadius: '12px', color: '#6b7280' }}>
                            No output configurations found.
                        </div>
                    )}
                </div>
            )}

            <AlertModal
                isOpen={alertState.isOpen}
                message={alertState.message}
                type={alertState.type}
                onClose={() => setAlertState(prev => ({ ...prev, isOpen: false }))}
            />
        </div>
    );
}
