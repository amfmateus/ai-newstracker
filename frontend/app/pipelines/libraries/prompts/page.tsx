'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { fetchPrompts, deletePrompt, PromptLibrary } from '../../../lib/api';
import styles from '../../../pipelines/PipelinesPage.module.css'; // Reuse Pipeline Styles
import AlertModal, { AlertType } from '../../../components/AlertModal';

export default function PromptsLibraryPage() {
    const [prompts, setPrompts] = useState<PromptLibrary[]>([]);
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
            const data = await fetchPrompts();
            setPrompts(data);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Delete this prompt?")) return;
        try {
            await deletePrompt(id);
            loadData();
        } catch (e) {
            setAlertState({ isOpen: true, message: "Failed to delete prompt", type: 'error' });
        }
    };

    return (
        <div className={styles.container}>
            <div style={{ marginBottom: '1rem' }}>
                <Link href="/pipelines/new" style={{ textDecoration: 'none', color: '#666' }}>&larr; Back to Pipeline Builder</Link>
            </div>
            <header className={styles.header}>
                <h1 className={styles.title}>Prompt Library</h1>
                <Link href="/pipelines/libraries/prompts/new" className={styles.createButton}>
                    + New Prompt
                </Link>
            </header>

            {loading ? <div className={styles.loading}>Loading prompts...</div> : (
                <div className={styles.grid}>
                    {prompts.map(p => (
                        <div key={p.id} className={styles.card}>
                            <div>
                                <h3 className={styles.cardTitle}>{p.name}</h3>
                                <p className={styles.cardDescription}>{p.description}</p>
                            </div>
                            <div className={styles.cardActions}>
                                <Link href={`/pipelines/libraries/prompts/${p.id}`} className={styles.editButton}>Edit</Link>
                                <button onClick={() => handleDelete(p.id)} className={styles.deleteButton}>Delete</button>
                            </div>
                        </div>
                    ))}
                    {prompts.length === 0 && (
                        <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '3rem', background: '#f9fafb', borderRadius: '12px', color: '#6b7280' }}>
                            No prompts found. Create one to use in your pipelines.
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
