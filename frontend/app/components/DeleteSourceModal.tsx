
'use client';

import { Source } from '../lib/api';
import { useState } from 'react';
import styles from './DeleteSourceModal.module.css';

interface DeleteSourceModalProps {
    source: Source | null;
    onClose: () => void;
    onConfirm: (deleteArticles: boolean) => void;
}

export default function DeleteSourceModal({ source, onClose, onConfirm }: DeleteSourceModalProps) {
    const [deleteArticles, setDeleteArticles] = useState(true);

    if (!source) return null;

    return (
        <div className={styles.overlay} onClick={onClose}>
            <div className={styles.modal} onClick={e => e.stopPropagation()}>
                <h3 className={styles.title}>Delete Source</h3>

                <p className={styles.message}>
                    Are you sure you want to delete <strong>{source.name || source.url}</strong>?
                </p>

                <div className={styles.options}>
                    <label className={styles.checkboxLabel}>
                        <input
                            type="checkbox"
                            checked={deleteArticles}
                            onChange={e => setDeleteArticles(e.target.checked)}
                        />
                        <span>Also delete all articles from this source?</span>
                    </label>
                    <p className={styles.helperText}>
                        If unchecked, articles will be kept as "orphaned".
                    </p>
                </div>

                <div className={styles.actions}>
                    <button className={styles.cancelBtn} onClick={onClose}>
                        Cancel
                    </button>
                    <button
                        className={styles.deleteBtn}
                        onClick={() => onConfirm(deleteArticles)}
                    >
                        Delete Source
                    </button>
                </div>
            </div>
        </div>
    );
}
