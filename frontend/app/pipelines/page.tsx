'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { fetchPipelines, deletePipeline, ReportPipeline, exportPipeline, importPipeline } from '../lib/api';
import { formatDateTime } from '../lib/dateUtils';
import styles from './PipelinesPage.module.css';
import AlertModal, { AlertType } from '../components/AlertModal';
import ConfirmModal from '../components/ConfirmModal';

export default function PipelinesPage() {
    const [pipelines, setPipelines] = useState<ReportPipeline[]>([]);
    const [loading, setLoading] = useState(true);
    const router = useRouter();
    const [alertState, setAlertState] = useState<{ isOpen: boolean; message: string; type: AlertType }>({
        isOpen: false,
        message: '',
        type: 'info'
    });
    // New state for deletion confirmation
    const [deletePipelineId, setDeletePipelineId] = useState<string | null>(null);

    useEffect(() => {
        loadPipelines();
    }, []);

    const loadPipelines = async () => {
        try {
            const data = await fetchPipelines();
            setPipelines(data);
        } catch (e) {
            console.error("Failed to load pipelines", e);
        } finally {
            setLoading(false);
        }
    };

    // 1. Initial trigger: Open modal
    const handleDeleteClick = (id: string) => {
        setDeletePipelineId(id);
    };

    // 2. Confirm action: Perform delete
    const confirmDelete = async () => {
        if (!deletePipelineId) return;

        try {
            await deletePipeline(deletePipelineId);
            setDeletePipelineId(null); // Close modal
            loadPipelines();
        } catch (e) {
            setDeletePipelineId(null); // Close confirmation modal
            setAlertState({ isOpen: true, message: "Failed to delete pipeline. It may be in use.", type: 'error' });
        }
    };

    const handleExport = async (pipeline: ReportPipeline) => {
        try {
            const config = await exportPipeline(pipeline.id);
            const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `pipeline-${pipeline.name.replace(/\s+/g, '-').toLowerCase()}.json`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        } catch (e) {
            setAlertState({ isOpen: true, message: "Failed to export pipeline.", type: 'error' });
        }
    };

    const handleImport = () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = async (e: any) => {
            const file = e.target.files?.[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = async (event: any) => {
                try {
                    const config = JSON.parse(event.target.result);
                    await importPipeline(config);
                    setAlertState({ isOpen: true, message: "Pipeline imported successfully!", type: 'success' });
                    loadPipelines();
                } catch (err: any) {
                    setAlertState({ isOpen: true, message: `Import failed: ${err.message}`, type: 'error' });
                }
            };
            reader.readAsText(file);
        };
        input.click();
    };

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <h1 className={styles.title}>Report Pipelines</h1>
                <div className={styles.headerActions}>
                    <button onClick={handleImport} className={styles.secondaryButton} title="Import Pipeline Configuration">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                            <polyline points="7 10 12 15 17 10" />
                            <line x1="12" y1="15" x2="12" y2="3" />
                        </svg>
                        Import Config
                    </button>
                    <Link href="/pipelines/new" className={styles.createButton}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="12" y1="5" x2="12" y2="19" />
                            <line x1="5" y1="12" x2="19" y2="12" />
                        </svg>
                        New Pipeline
                    </Link>
                </div>
            </header>

            {loading ? (
                <div className={styles.loading}>Loading pipelines...</div>
            ) : (
                <div className={styles.grid}>
                    {pipelines.map(pipeline => (
                        <div key={pipeline.id} className={styles.card}>
                            <div className={styles.cardContent}>
                                <div className={styles.cardHeader}>
                                    <h3 className={styles.cardTitle}>{pipeline.name}</h3>
                                </div>
                                <p className={styles.cardDescription}>{pipeline.description || "No description provided."}</p>

                                {pipeline.schedule_enabled && (
                                    <div className={styles.cardSchedule}>
                                        <div className={styles.scheduleBadge}>
                                            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" stroke="none">
                                                <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
                                            </svg>
                                            Automated
                                        </div>
                                        <div className={styles.nextRun}>
                                            <span className={styles.nextRunLabel}>Next Run</span>
                                            <span className={styles.nextRunTime}>
                                                {pipeline.next_run_at
                                                    ? formatDateTime(pipeline.next_run_at)
                                                    : 'Calculating...'}
                                            </span>
                                        </div>
                                    </div>
                                )}
                            </div>
                            <div className={styles.cardActions}>
                                <Link href={`/pipelines/${pipeline.id}`} className={styles.editButton}>
                                    Open Designer
                                </Link>
                                <div className={styles.actionsRight}>
                                    <button onClick={() => handleExport(pipeline)} className={styles.iconButton} title="Export Configuration">
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                            <polyline points="17 8 12 3 7 8" />
                                            <line x1="12" y1="3" x2="12" y2="15" />
                                        </svg>
                                    </button>
                                    <button onClick={() => handleDeleteClick(pipeline.id)} className={styles.deleteButton} title="Delete Pipeline">
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <polyline points="3 6 5 6 21 6" />
                                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                        </svg>
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}

                    {pipelines.length === 0 && (
                        <div className={styles.emptyState}>
                            <h3 className={styles.emptyStateTitle}>No pipelines yet</h3>
                            <p className={styles.emptyStateDesc}>
                                Pipelines allow you to automate news monitoring, analysis, and reporting.
                                Create your first pipeline to get started.
                            </p>
                            <Link href="/pipelines/new" className={styles.createButton} style={{ display: 'inline-flex' }}>
                                Start Building
                            </Link>
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

            <ConfirmModal
                isOpen={!!deletePipelineId}
                title="Delete Pipeline"
                message="Are you sure you want to delete this pipeline? This action cannot be undone."
                confirmLabel="Delete"
                onConfirm={confirmDelete}
                onCancel={() => setDeletePipelineId(null)}
                isDestructive={true}
            />
        </div>
    );
}
