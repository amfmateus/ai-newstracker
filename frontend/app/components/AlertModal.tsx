'use client';

import { createPortal } from 'react-dom';
import styles from './AlertModal.module.css';
import { useEffect, useState } from 'react';

export type AlertType = 'info' | 'success' | 'error' | 'warning';

interface AlertModalProps {
    isOpen: boolean;
    message: string;
    type?: AlertType;
    onClose: () => void;
}

export default function AlertModal({ isOpen, message, type = 'info', onClose }: AlertModalProps) {
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    if (!isOpen || !mounted) return null;

    let icon = "ℹ️";
    let iconClass = styles.infoIcon;

    if (type === 'success') {
        icon = "✓";
        iconClass = styles.successIcon;
    } else if (type === 'error') {
        icon = "✕";
        iconClass = styles.errorIcon;
    } else if (type === 'warning') {
        icon = "⚠️";
        iconClass = styles.warningIcon;
    }

    const modalContent = (
        <div className={styles.overlay} onClick={onClose}>
            <div className={styles.modal} onClick={e => e.stopPropagation()}>
                <div className={`${styles.iconContainer} ${iconClass}`}>
                    {icon}
                </div>
                <div className={styles.message}>
                    {message}
                </div>
                <button className={styles.button} onClick={onClose} autoFocus>
                    Dismiss
                </button>
            </div>
        </div>
    );

    return createPortal(modalContent, document.body);
}
