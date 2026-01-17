'use client';
import { Source } from '../lib/api';
import styles from './SourceSuccessModal.module.css';

interface SourceSuccessModalProps {
    source: Source;
    onClose: () => void;
}

export default function SourceSuccessModal({ source, onClose }: SourceSuccessModalProps) {
    // Helper to format crawl method display
    const getMethodLabel = (s: Source) => {
        if (s.crawl_method === 'pdf') return 'Visual / PDF';
        if (s.crawl_method === 'rss' || s.type === 'rss') return 'RSS Feed';
        return 'Standard HTML';
    };

    return (
        <div className={styles.overlay}>
            <div className={styles.modal}>
                <div className={styles.iconContainer}>
                    ✓
                </div>
                <h2 className={styles.title}>Source Added!</h2>
                <p className={styles.subtitle}>The source has been successfully configured and queued for crawling.</p>

                <div className={styles.details}>
                    <div className={styles.detailRow}>
                        <span className={styles.label}>Name</span>
                        <span className={styles.value}>{source.name || 'Unknown'}</span>
                    </div>
                    <div className={styles.detailRow}>
                        <span className={styles.label}>Type</span>
                        <span className={styles.value}>{getMethodLabel(source)}</span>
                    </div>
                    <div className={styles.detailRow}>
                        <span className={styles.label}>Frequency</span>
                        <span className={styles.value}>Every {source.crawl_interval ? source.crawl_interval / 60 : 1} Hours</span>
                    </div>
                    <div className={styles.detailRow}>
                        <span className={styles.label}>URL</span>
                        <span className={styles.value} title={source.url}>{source.url}</span>
                    </div>
                </div>

                <button onClick={onClose} className={styles.button}>
                    Done
                </button>
            </div>
        </div>
    );
}
