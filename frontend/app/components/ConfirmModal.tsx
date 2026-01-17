'use client';

import { createPortal } from 'react-dom';
import styles from './ConfirmModal.module.css';
import { useEffect, useState } from 'react';

interface ConfirmModalProps {
    isOpen: boolean;
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    isDestructive?: boolean;
    onConfirm: () => void;
    onCancel: () => void;
}

export default function ConfirmModal({
    isOpen,
    title,
    message,
    confirmLabel = "Confirm",
    cancelLabel = "Cancel",
    isDestructive = true,
    onConfirm,
    onCancel
}: ConfirmModalProps) {
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    if (!isOpen || !mounted) return null;

    const modalContent = (
        <div className={styles.overlay} onClick={onCancel}>
            <div className={styles.modal} onClick={e => e.stopPropagation()}>
                <div className={styles.iconContainer}>
                    ⚠️
                </div>
                <h3 className={styles.title}>{title}</h3>
                <div className={styles.message}>
                    {message}
                </div>
                <div className={styles.actions}>
                    <button className={styles.cancelButton} onClick={onCancel}>
                        {cancelLabel}
                    </button>
                    <button
                        className={styles.confirmButton}
                        onClick={onConfirm}
                        style={!isDestructive ? { /* Override for non-destructive if needed in future */ } : {}}
                    >
                        {confirmLabel}
                    </button>
                </div>
            </div>
        </div>
    );

    return createPortal(modalContent, document.body);
}
