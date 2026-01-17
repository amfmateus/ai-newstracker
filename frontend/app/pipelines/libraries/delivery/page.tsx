'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { fetchDeliveryConfigs, deleteDeliveryConfig, DeliveryConfigLibrary } from '../../../lib/api';
import styles from '../../../pipelines/PipelinesPage.module.css';
import AlertModal, { AlertType } from '../../../components/AlertModal';

export default function DeliveryLibraryPage() {
    const [deliveries, setDeliveries] = useState<DeliveryConfigLibrary[]>([]);
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
            const data = await fetchDeliveryConfigs();
            setDeliveries(data);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Delete this delivery config?")) return;
        try {
            await deleteDeliveryConfig(id);
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
                <h1 className={styles.title}>Delivery Configurations</h1>
                <Link href="/pipelines/libraries/delivery/new" className={styles.createButton}>
                    + New Delivery
                </Link>
            </header>

            {loading ? <div className={styles.loading}>Loading configs...</div> : (
                <div className={styles.grid}>
                    {deliveries.map(d => (
                        <div key={d.id} className={styles.card}>
                            <div>
                                <h3 className={styles.cardTitle}>{d.name}</h3>
                                <p className={styles.cardDescription}>Type: {d.delivery_type}</p>
                            </div>
                            <div className={styles.cardActions}>
                                <Link href={`/pipelines/libraries/delivery/${d.id}`} className={styles.editButton}>Edit</Link>
                                <button onClick={() => handleDelete(d.id)} className={styles.deleteButton}>Delete</button>
                            </div>
                        </div>
                    ))}
                    {deliveries.length === 0 && (
                        <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '3rem', background: '#f9fafb', borderRadius: '12px', color: '#6b7280' }}>
                            No delivery configurations found.
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
