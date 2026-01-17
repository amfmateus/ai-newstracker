'use client';

import { useEffect, useState } from 'react';
import styles from './AddSourceDrawer.module.css';
import AddSourceForm from './AddSourceForm';

interface AddSourceDrawerProps {
    isOpen: boolean;
    onClose: () => void;
    onSourceAdded: () => void;
}

export default function AddSourceDrawer({ isOpen, onClose, onSourceAdded }: AddSourceDrawerProps) {
    // We use a small delay for mounting/unmounting animations if needed, 
    // but here we'll rely on CSS visibility/opacity.

    // Lock scroll when open
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'auto';
        }
        return () => {
            document.body.style.overflow = 'auto';
        };
    }, [isOpen]);

    return (
        <div className={`${styles.overlay} ${isOpen ? styles.visible : ''}`} onClick={onClose}>
            <div className={styles.drawer} onClick={e => e.stopPropagation()}>
                <button className={styles.btnClose} onClick={onClose} aria-label="Close">
                    &times;
                </button>

                <div className={styles.scrollArea}>
                    <AddSourceForm
                        onSourceAdded={() => {
                            onSourceAdded();
                            onClose();
                        }}
                        onCancel={onClose}
                    />
                </div>
            </div>
        </div>
    );
}
