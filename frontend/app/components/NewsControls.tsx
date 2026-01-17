'use client';

import { useState } from 'react';
import { Source } from '../lib/api';
import styles from './NewsControls.module.css';

interface NewsControlsProps {
    sources: Source[];
    selectedSourceIds: string[];
    onSourceChange: (ids: string[]) => void;
    sortBy: 'published_at' | 'scraped_at' | 'source';
    onSortChange: (sort: 'published_at' | 'scraped_at' | 'source') => void;
    sortOrder: 'asc' | 'desc';
    onOrderChange: (order: 'asc' | 'desc') => void;
}

export default function NewsControls({
    sources,
    selectedSourceIds,
    onSourceChange,
    sortBy,
    onSortChange,
    sortOrder,
    onOrderChange
}: NewsControlsProps) {

    const handleSourceSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const value = e.target.value;
        if (value === 'all') {
            onSourceChange([]);
        } else {
            onSourceChange([value]);
        }
    };

    return (
        <div className={styles.container}>
            <div className={styles.group}>
                <label className={styles.label}>Filter Source:</label>
                <select
                    className={styles.select}
                    onChange={(e) => {
                        const val = e.target.value;
                        onSourceChange(val === 'all' ? [] : [val]);
                    }}
                    value={selectedSourceIds.length === 1 ? selectedSourceIds[0] : 'all'}
                >
                    <option value="all">All Sources</option>
                    {sources.map(s => (
                        <option key={s.id} value={s.id}>{s.name || s.url}</option>
                    ))}
                    <option value="_archived" style={{ fontStyle: 'italic', color: '#666' }}>Archived / Deleted Sources</option>
                </select>
            </div>

            <div className={styles.group}>
                <label className={styles.label}>Sort By:</label>
                <select
                    className={styles.select}
                    value={sortBy}
                    onChange={(e) => onSortChange(e.target.value as any)}
                >
                    <option value="published_at">Date Published</option>
                    <option value="scraped_at">Date Retrieved</option>
                    <option value="source">Source Name</option>
                </select>
                <select
                    className={styles.select}
                    value={sortOrder}
                    onChange={(e) => onOrderChange(e.target.value as 'asc' | 'desc')}
                >
                    <option value="asc">Ascending (A-Z / Oldest)</option>
                    <option value="desc">Descending (Z-A / Newest)</option>
                </select>
            </div>
        </div>
    );
}
