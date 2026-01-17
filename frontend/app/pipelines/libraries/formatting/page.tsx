'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { fetchFormattings, deleteFormatting, FormattingLibrary } from '../../../lib/api';
import styles from '../../../pipelines/PipelinesPage.module.css'; // Reuse Pipeline Styles
import AlertModal, { AlertType } from '../../../components/AlertModal';

export default function FormattingLibraryPage() {
    const [formattings, setFormattings] = useState<FormattingLibrary[]>([]);
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
            const data = await fetchFormattings();
            setFormattings(data);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Delete this formatting style?")) return;
        try {
            await deleteFormatting(id);
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
                <h1 className={styles.title}>Formatting Library</h1>
                <Link href="/pipelines/libraries/formatting/new" className={styles.createButton}>
                    + New Style
                </Link>
            </header>

            {loading ? <div className={styles.loading}>Loading styles...</div> : (
                <div className={styles.grid}>
                    {formattings.map(f => (
                        <div key={f.id} className={styles.card}>
                            <div>
                                <h3 className={styles.cardTitle}>{f.name}</h3>
                                <p className={styles.cardDescription}>{f.description}</p>
                            </div>
                            <div className={styles.cardActions}>
                                <Link href={`/pipelines/libraries/formatting/${f.id}`} className={styles.editButton}>Edit</Link>
                                <button onClick={() => handleDelete(f.id)} className={styles.deleteButton}>Delete</button>
                            </div>
                        </div>
                    ))}
                    {formattings.length === 0 && (
                        <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '3rem', background: '#f9fafb', borderRadius: '12px', color: '#6b7280' }}>
                            No styles found. Create one for your reports.
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
