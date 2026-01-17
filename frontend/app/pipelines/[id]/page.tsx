'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { formatDateTime } from '../../lib/dateUtils';
import ScheduleEditor from '../../components/ScheduleEditor';
import ReviewSummary from '../../components/ReviewSummary';
import { useSession } from 'next-auth/react';
import FormattingEditorModal from '@/app/components/FormattingEditorModal';
import OutputConfigEditorModal from '@/app/components/OutputConfigEditorModal';
import DeliveryConfigEditorModal from '@/app/components/DeliveryConfigEditorModal';
import {
    fetchArticles,
    fetchSources,
    fetchPipelines,
    createPipeline,
    updatePipeline,
    fetchPrompts,
    createPrompt,
    updatePrompt,
    deletePrompt,
    fetchFormattings,
    createFormatting,
    updateFormatting,
    deleteFormatting,
    fetchOutputConfigs,
    createOutputConfig,
    updateOutputConfig,
    deleteOutputConfig,
    fetchDeliveryConfigs,
    createDeliveryConfig,
    updateDeliveryConfig,
    deleteDeliveryConfig,
    testPipelineStep,
    ReportPipeline,
    PromptLibrary,
    FormattingLibrary,
    OutputConfigLibrary,
    DeliveryConfigLibrary,
    SourceConfigLibrary, fetchSourceConfigs, updateSourceConfig, deleteSourceConfig,
    Article, Source, getAuthHeaders, API_URL, runPipeline
} from '@/app/lib/api';
import ArticleCard from '../../components/ArticleCard'; // Import component
import AlertModal, { AlertType } from '../../components/AlertModal';
import ConfirmModal from '../../components/ConfirmModal';
import PromptEditorModal from '../../components/PromptEditorModal';
import SourceConfigEditorModal from '../../components/SourceConfigEditorModal';
import BreadcrumbBar from '@/app/components/BreadcrumbBar';
import styles from '../PipelineBuilder.module.css';

interface PageProps {
    params: Promise<{ id: string }>;
}

export default function PipelineBuilder({ params }: PageProps) {
    const { id } = use(params);
    const isNew = id === 'new';
    const [pipeline, setPipeline] = useState<Partial<ReportPipeline>>({
        name: 'My New Pipeline',
        source_config: {}
    });
    const [activeStep, setActiveStep] = useState(1);
    const [loading, setLoading] = useState(!isNew);
    const [saving, setSaving] = useState(false);
    const [alertState, setAlertState] = useState<{ isOpen: boolean; message: string; type: AlertType }>({
        isOpen: false,
        message: '',
        type: 'info'
    });

    const [stepResults, setStepResults] = useState<Record<number, any>>({});
    const testResult = stepResults[activeStep];
    const [testStatus, setTestStatus] = useState<string | null>(null);
    const [testing, setTesting] = useState(false);
    const [runMode, setRunMode] = useState<'manual' | 'schedule'>('manual');
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [previewBlob, setPreviewBlob] = useState<Blob | null>(null);
    const [forceRefresh, setForceRefresh] = useState(false);

    // Libraries State
    const [prompts, setPrompts] = useState<PromptLibrary[]>([]);
    const [formattings, setFormattings] = useState<FormattingLibrary[]>([]);
    const [outputs, setOutputs] = useState<OutputConfigLibrary[]>([]);
    const [deliveries, setDeliveries] = useState<DeliveryConfigLibrary[]>([]);
    const [sourceConfigs, setSourceConfigs] = useState<SourceConfigLibrary[]>([]);
    const [sources, setSources] = useState<Source[]>([]); // To map IDs to names

    // Template Management State
    const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
    const [templateNameEdit, setTemplateNameEdit] = useState("");
    const [editingDescId, setEditingDescId] = useState<string | null>(null);
    const [templateDescEdit, setTemplateDescEdit] = useState("");
    const [deletingTemplateId, setDeletingTemplateId] = useState<string | null>(null);

    // Prompt Modal State
    const [isPromptModalOpen, setIsPromptModalOpen] = useState(false);
    const [editingPrompt, setEditingPrompt] = useState<PromptLibrary | null>(null);

    // Step 3 State
    const [isFormattingModalOpen, setIsFormattingModalOpen] = useState(false);
    const [editingFormatting, setEditingFormatting] = useState<FormattingLibrary | null>(null);

    // Step 4 State
    const [editingOutput, setEditingOutput] = useState<OutputConfigLibrary | null>(null);
    const [isOutputModalOpen, setIsOutputModalOpen] = useState(false);

    // Step 5 State
    const [editingDelivery, setEditingDelivery] = useState<DeliveryConfigLibrary | null>(null);
    const [isDeliveryModalOpen, setIsDeliveryModalOpen] = useState(false);

    // Step 1 State
    const [isSourceConfigModalOpen, setSourceConfigModalOpen] = useState(false);
    const [editingSourceConfig, setEditingSourceConfig] = useState<SourceConfigLibrary | null>(null);

    // UI State
    const [viewLimit, setViewLimit] = useState(6);
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);
    const [drawerTab, setDrawerTab] = useState<'prompt' | 'raw' | 'final' | 'preview'>('final');
    const [flashEditor, setFlashEditor] = useState(false);
    const [isEditingName, setIsEditingName] = useState(false);
    const [isHoveringName, setIsHoveringName] = useState(false);

    const router = useRouter();
    const { data: session } = useSession();

    useEffect(() => {
        loadData();
    }, [id]);

    useEffect(() => {
        // Reset drawer and view limit when changing steps
        setIsDrawerOpen(false);
        setViewLimit(6);
        if (activeStep === 3) {
            setDrawerTab('preview');
        } else if (activeStep === 2) {
            setDrawerTab('final');
        }
    }, [activeStep]);

    useEffect(() => {
        if (activeStep === 4 && testResult && typeof testResult === 'string' && !testResult.startsWith('{')) {
            const loadPreview = async () => {
                try {
                    const headers = await getAuthHeaders();
                    const resp = await fetch(`${API_URL}/pipeline/test-report/view?path=${encodeURIComponent(testResult)}`, { headers });
                    if (!resp.ok) throw new Error("Failed to fetch preview");
                    const blob = await resp.blob();
                    setPreviewBlob(blob);
                    const url = URL.createObjectURL(blob);
                    setPreviewUrl(url);
                } catch (e) {
                    console.error("Preview load failed", e);
                }
            };
            loadPreview();
        } else {
            // Cleanup previous URL if any
            if (previewUrl) {
                URL.revokeObjectURL(previewUrl);
                setPreviewUrl(null);
                setPreviewBlob(null);
            }
        }
        return () => {
            if (previewUrl) URL.revokeObjectURL(previewUrl);
        };
    }, [testResult, activeStep]);

    const loadData = async () => {
        try {
            const [pData, fData, oData, dData, sData, sourcesData] = await Promise.all([
                fetchPrompts(), fetchFormattings(), fetchOutputConfigs(), fetchDeliveryConfigs(), fetchSourceConfigs(), fetchSources()
            ]);
            setPrompts(pData);
            setFormattings(fData);
            setOutputs(oData);
            setDeliveries(dData);
            setSourceConfigs(sData);
            setSources(sourcesData);

            if (!isNew) {
                const allPipelines = await fetchPipelines();
                const found = allPipelines.find(p => p.id === id);
                if (found) setPipeline(found);
            }
        } catch (e) {
            console.error("Failed to load builder data", e);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            if (isNew) {
                await createPipeline(pipeline);
            } else {
                await updatePipeline(id, pipeline);
            }
            router.push('/pipelines');
        } catch (e) {
            setAlertState({ isOpen: true, message: "Failed to save pipeline", type: 'error' });
        } finally {
            setSaving(false);
        }
    };

    const runStep = async (step: number, currentStepResults: Record<number, any>) => {
        let context: any = {};
        let configId: string | undefined = undefined;

        if (step === 1) {
            context = pipeline.source_config || {};
        }
        else if (step === 2) {
            // Pass article_ids from Step 1 test result
            const prevResult = currentStepResults[1];
            context = {
                article_ids: Array.isArray(prevResult) ? prevResult.map((a: any) => a.id) : [],
                formatting_id: pipeline.formatting_id,
                // Also pass current library state if the user edited it but didn't save yet?
                // For now, the backend will fetch from DB based on formatting_id.
            };
            configId = pipeline.prompt_id;
        }
        else if (step === 3) {
            // Pass previous step AI output
            context = currentStepResults[2] || { title: "Mock Title", sections: [] };
            configId = pipeline.formatting_id;
        }
        else if (step === 4) {
            if (!currentStepResults[3]) return;

            // Extract title from Step 2 (Processing) result if available
            // Step 2 result is usually a JSON object with 'report_title' or similar
            let reportTitle = "Test Report";
            if (currentStepResults[2]) {
                try {
                    // Check if Step 2 result is an object with a title property
                    // or if it's in the text content
                    const s2 = currentStepResults[2];
                    if (s2.report_title) reportTitle = s2.report_title;
                    else if (s2.title) reportTitle = s2.title;
                    else if (s2.headline) reportTitle = s2.headline;
                } catch (e) {
                    console.warn("Could not extract title from Step 2", e);
                }
            }

            context = {
                html_result: currentStepResults[3],
                pipeline_name: pipeline.name,
                report_title: reportTitle
            };
            // Note: Step 4 (Output) test returns a file path string
            configId = pipeline.output_config_id;
        }
        else if (step === 5) {
            // Delivery depends on many things, but let's pass a mock context or IDs
            context = {
                report_title: currentStepResults[2]?.title || "Test Report",
                html: currentStepResults[3] || "",
                pipeline_id: pipeline.id,
                pipeline_name: pipeline.name
            };
            configId = pipeline.delivery_config_id;
        }

        const stepNames = ['Source', 'Processing', 'Formatting', 'Output', 'Delivery', 'Schedule'];
        setTestStatus(`Step ${step}: ${stepNames[step - 1]}...`);

        // Force refresh only if it is the active step we are testing
        const forceRefresh = step === activeStep;
        const res = await testPipelineStep(step, context, configId, forceRefresh);
        return res;
    };

    const formatTimeRange = (range: string | undefined) => {
        if (!range) return 'All Time';
        if (range === '24h') return 'Last 24 Hours';
        if (range === '7d') return 'Last 7 Days';
        if (range === '30d') return 'Last 30 Days';
        // Fallback for other formats
        return range;
    };

    const handleSaveAndNext = async () => {
        setSaving(true);
        try {
            if (isNew) {
                const newPipeline = await createPipeline(pipeline);
                // If creating new, we need to redirect or update URL, but for now let's just update local state if possible
                // Actually, creation redirects to list in handleSave.
                // For "Save & Next" on a new pipeline, we should probably create it then move to step 2 URL?
                // Simplification: Behave like Save, then change step if successful.
                // But wait, if we create, we get an ID. We should redirect to /pipelines/[id] with activeStep=2?
                // For now, let's keep it simple: Save updates DB. Then we increment step.
                // NOTE: Creating a pipeline navigates away in handleSave. We need different logic here.

                // Let's rely on the fact that if it's new, we MUST create it first.
                // We'll call create, then replace URL to edit mode, then set step 2.
                // This is complex for "new". Let's assume user saves name first or we handle it.
                // If isNew, we create, then redirect to the edit page for that ID.
                // We can't easily "next" statefully across a full redirect.
                // Strategy: If isNew, Save & Next just Create & Redirect.
                await createPipeline(pipeline);
                router.push('/pipelines'); // Fallback for now to avoid complexity of redirecting to same page with new ID
            } else {
                await updatePipeline(id, pipeline);
                if (activeStep < 6) {
                    setActiveStep(prev => prev + 1);
                    window.scrollTo(0, 0); // Scroll to top
                } else {
                    router.push('/pipelines');
                }
            }
        } catch (e) {
            setAlertState({ isOpen: true, message: "Failed to save pipeline", type: 'error' });
        } finally {
            setSaving(false);
        }
    };

    // --- Prompt Handlers ---
    const handleSavePrompt = async (savedPrompt: PromptLibrary) => {
        // Refresh list
        const updated = await fetchPrompts();
        setPrompts(updated);
        // Auto-select if new or currently selected
        if (!editingPrompt || pipeline.prompt_id === editingPrompt.id) {
            setPipeline({ ...pipeline, prompt_id: savedPrompt.id });
        }
    };

    const handleEditPrompt = (prompt: PromptLibrary) => {
        setEditingPrompt(prompt);
        setIsPromptModalOpen(true);
    };

    const handleCreatePrompt = () => {
        setEditingPrompt(null);
        setIsPromptModalOpen(true);
    };

    const handleRenamePrompt = async (id: string, newName: string) => {
        if (!newName.trim()) return;
        try {
            const current = prompts.find(p => p.id === id);
            if (!current) return;
            await updatePrompt(id, { ...current, name: newName });
            const updated = await fetchPrompts();
            setPrompts(updated);
            setEditingTemplateId(null); // Reuse state or add new if conflict
        } catch (e) {
            console.error("Failed to rename prompt", e);
            alert("Failed to rename prompt");
        }
    };

    const handleUpdatePromptDescription = async (id: string, newDesc: string) => {
        try {
            const current = prompts.find(p => p.id === id);
            if (!current) return;
            await updatePrompt(id, { ...current, description: newDesc });
            const updated = await fetchPrompts();
            setPrompts(updated);
            setEditingDescId(null);
        } catch (e) {
            console.error("Failed to update prompt description", e);
            alert("Failed to update description");
        }
    };

    const handleDeletePrompt = async (id: string) => {
        if (!confirm("Are you sure you want to delete this prompt?")) return;
        try {
            await deletePrompt(id);
            const updated = await fetchPrompts();
            setPrompts(updated);
            if (pipeline.prompt_id === id) {
                setPipeline({ ...pipeline, prompt_id: undefined });
            }
        } catch (e) {
            console.error("Failed to delete prompt", e);
            alert("Failed to delete prompt");
        }
    };

    const PROMPT_VARIABLES = [
        { name: 'articles_json', description: 'Full JSON list of article objects.' },
        { name: 'current_time', description: 'Current timestamp (YYYY-MM-DD HH:MM).' },
        { name: 'current_date', description: 'Current date (YYYY-MM-DD).' },
    ];

    // --- Formatting Handlers ---
    const handleSaveFormatting = async (data: any) => {
        try {
            if (data.id) {
                await updateFormatting(data.id, data);
            } else {
                const created = await createFormatting(data);
                setPipeline({ ...pipeline, formatting_id: created.id });
            }
            const updated = await fetchFormattings();
            setFormattings(updated);
        } catch (e: any) {
            console.error("Failed to save formatting", e);
            throw e;
        }
    };

    const handleEditFormatting = (fmt: FormattingLibrary) => {
        setEditingFormatting(fmt);
        setIsFormattingModalOpen(true);
    };

    const handleCreateFormatting = () => {
        setEditingFormatting(null);
        setIsFormattingModalOpen(true);
    };

    const handleDeleteFormatting = async (id: string) => {
        if (!confirm("Are you sure you want to delete this formatting style?")) return;
        try {
            await deleteFormatting(id);
            const updated = await fetchFormattings();
            setFormattings(updated);
            if (pipeline.formatting_id === id) {
                setPipeline({ ...pipeline, formatting_id: undefined });
            }
        } catch (e) {
            console.error("Failed to delete formatting", e);
            alert("Failed to delete formatting");
        }
    };

    const FORMATTING_VARIABLES = [
        { name: 'title', description: 'The main title of the report.' },
        { name: 'subtitle', description: 'A subtitle or date range summary.' },
        { name: 'summary', description: 'A high-level executive summary of the report.' },
        { name: 'key_findings', description: 'A list of key impact points (if provided by AI).' },
        { name: 'sections', description: 'List of report sections. Each has {title, content}.' },
        { name: 'references', description: 'List of cited articles. Each has {id, number, title, url}.' },
        { name: 'current_date', description: 'Current date (YYYY-MM-DD).' },
        { name: 'current_time', description: 'Current time (HH:MM).' }
    ];

    // --- Output Config Handlers ---
    const handleSaveOutput = async (data: Partial<OutputConfigLibrary>) => {
        try {
            if (data.id) {
                await updateOutputConfig(data.id, data);
            } else {
                const created = await createOutputConfig(data);
                setPipeline({ ...pipeline, output_config_id: created.id });
            }
            const updated = await fetchOutputConfigs();
            setOutputs(updated);
        } catch (e: any) {
            console.error("Failed to save output config", e);
            throw e;
        }
    };

    const handleEditOutput = (output: OutputConfigLibrary) => {
        setEditingOutput(output);
        setIsOutputModalOpen(true);
    };

    const handleDeleteOutput = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!confirm("Are you sure you want to delete this output configuration?")) return;
        try {
            await deleteOutputConfig(id);
            const updated = await fetchOutputConfigs();
            setOutputs(updated);
            if (pipeline.output_config_id === id) {
                setPipeline({ ...pipeline, output_config_id: undefined });
            }
        } catch (e) {
            console.error("Failed to delete output config", e);
            alert("Failed to delete output config");
        }
    };

    // --- Delivery Config Handlers ---
    const handleSaveDelivery = async (data: Partial<DeliveryConfigLibrary>) => {
        try {
            if (data.id) {
                await updateDeliveryConfig(data.id, data);
            } else {
                const created = await createDeliveryConfig(data);
                setPipeline({ ...pipeline, delivery_config_id: created.id });
            }
            const updated = await fetchDeliveryConfigs();
            setDeliveries(updated);
        } catch (e: any) {
            console.error("Failed to save delivery config", e);
            throw e;
        }
    };

    const handleEditDelivery = (delivery: DeliveryConfigLibrary) => {
        setEditingDelivery(delivery);
        setIsDeliveryModalOpen(true);
    };

    const handleDeleteDelivery = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!confirm("Are you sure you want to delete this delivery configuration?")) return;
        try {
            await deleteDeliveryConfig(id);
            const updated = await fetchDeliveryConfigs();
            setDeliveries(updated);
            if (pipeline.delivery_config_id === id) {
                setPipeline({ ...pipeline, delivery_config_id: undefined });
            }
        } catch (e) {
            console.error("Failed to delete delivery config", e);
            alert("Failed to delete delivery config");
        }
    };

    // --- Source Config Handlers ---
    const handleDeleteTemplate = async () => {
        if (!deletingTemplateId) return;
        try {
            await deleteSourceConfig(deletingTemplateId);
            setSourceConfigs(prev => prev.filter(sc => sc.id !== deletingTemplateId));
            setDeletingTemplateId(null);
            setAlertState({ isOpen: true, message: "Template deleted successfully", type: 'success' });
        } catch (e) {
            setAlertState({ isOpen: true, message: "Failed to delete template", type: 'error' });
        }
    };

    const handleSaveSourceConfig = async (data: Partial<SourceConfigLibrary>) => {
        try {
            if (data.id) {
                await updateSourceConfig(data.id, data);
                const updated = await fetchSourceConfigs();
                setSourceConfigs(updated);

                // If this is the currently selected config, refresh the pipeline state
                // but keep the configuration details. Template_id is what matters.
                if (pipeline.source_config?.template_id === data.id) {
                    setPipeline({
                        ...pipeline,
                        source_config: {
                            ...pipeline.source_config,
                            ...data.config, // Ensure config is consistent
                            template_id: data.id
                        }
                    });
                }
            }
        } catch (e: any) {
            console.error("Failed to save source config", e);
            throw e;
        }
    };

    const handleRenameTemplate = async (id: string, newName: string) => {
        // Legacy, keeping it for now if needed, but we'll use handleSaveSourceConfig
        if (!newName.trim()) return;
        try {
            const config = sourceConfigs.find(c => c.id === id);
            if (config) {
                await updateSourceConfig(id, { ...config, name: newName });
                loadData();
            }
        } catch (error) {
            console.error('Failed to rename template', error);
        }
    };

    const runTest = async (stepLimit?: number) => {
        setTesting(true);
        setTestStatus("Initializing...");
        setIsDrawerOpen(true); // Open drawer on test start
        const targetStep = stepLimit || activeStep;
        try {
            let currentResults = { ...stepResults };

            // Run all missing previous steps + current step
            for (let s = 1; s <= targetStep; s++) {
                // If we don't have results for a previous step, or if it's the active step (re-run), run it
                if (!currentResults[s] || s === activeStep) {
                    const res = await runStep(s, currentResults);
                    currentResults[s] = res;
                    setStepResults(prev => ({ ...prev, [s]: res }));
                }
            }

            setViewLimit(6); // Reset pagination on new test
        } catch (e: any) {
            console.error("Test failed", e);
            setStepResults(prev => ({ ...prev, [activeStep]: { error: e.message } }));
        } finally {
            setTesting(false);
            setTestStatus(null);
        }
    };

    if (loading) return <div className={styles.loading}>Loading Designer...</div>;

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <div className={styles.headerTitleWrapper} onMouseEnter={() => setIsHoveringName(true)} onMouseLeave={() => setIsHoveringName(false)}>
                    {isEditingName ? (
                        <input
                            type="text"
                            className={styles.input}
                            value={pipeline.name}
                            onChange={(e) => setPipeline({ ...pipeline, name: e.target.value })}
                            onBlur={() => setIsEditingName(false)}
                            autoFocus
                            style={{ fontSize: '1.5rem', fontWeight: 'bold', padding: '4px 8px' }}
                        />
                    ) : (
                        <div className={styles.title} onClick={() => setIsEditingName(true)}>
                            {pipeline.name || 'New Pipeline'} <span style={{ fontSize: '1rem', marginLeft: '8px', opacity: isHoveringName ? 0.5 : 0, transition: 'opacity 0.2s' }}>✎</span>
                        </div>
                    )}
                </div>

                <div className={styles.headerActions}>
                    <div style={{ display: 'flex', alignItems: 'center', marginRight: '1rem', gap: '0.5rem' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', color: '#64748b', cursor: 'pointer', userSelect: 'none' }}>
                            <input
                                type="checkbox"
                                checked={forceRefresh}
                                onChange={(e) => setForceRefresh(e.target.checked)}
                                style={{ accentColor: '#2563eb' }}
                            />
                            Force Refresh
                        </label>
                    </div>

                    {activeStep < 6 && (
                        <button onClick={() => runTest()} disabled={testing} className={styles.runTestButton}>
                            {testing ? (testStatus || 'Running...') : 'Run Test'} ⚡
                        </button>
                    )}

                    <Link href="/pipelines">
                        <button className={styles.cancelButton}>
                            Discard Changes
                        </button>
                    </Link>

                    <button
                        className={styles.saveButton}
                        onClick={handleSave}
                        disabled={saving}
                    >
                        {saving ? 'Saving...' : 'Save Pipeline'}
                    </button>

                    {activeStep < 6 && (
                        <button
                            className={styles.primaryButton}
                            onClick={handleSaveAndNext}
                            disabled={saving}
                        >
                            {saving ? 'Saving...' : 'Save & Next'} →
                        </button>
                    )}
                </div>
            </header>

            <div className={styles.wizardContainer}>
                {/* Sidebar Navigation */}
                <nav className={styles.sidebar}>
                    {[1, 2, 3, 4, 5, 6].map(step => (
                        <button
                            key={step}
                            onClick={() => setActiveStep(step)}
                            className={`${styles.stepButton} ${activeStep === step ? styles.stepButtonActive : ''}`}
                        >
                            <span className={styles.stepNumber}>{step}</span>
                            Step {step}: {
                                ['Source', 'Processing', 'Formatting', 'Output', 'Delivery', 'Schedule'][step - 1]
                            }
                        </button>
                    ))}
                </nav>

                {/* Content Area */}
                <div className={styles.content}>
                    <div className={styles.stepTitle}>
                        <span>Configure {['Source', 'Processing', 'Formatting', 'Output', 'Delivery', 'Schedule'][activeStep - 1]}</span>
                    </div>

                    <div className={styles.workspace}>
                        {/* Configuration Panel */}
                        <div className={styles.configPanel}>
                            {activeStep === 1 && (
                                <div className={styles.formGroup}>
                                    <div className={styles.infoBox} style={{ marginTop: 0, marginBottom: '1.5rem' }}>
                                        <div className={styles.infoIcon}>💡</div>
                                        <div>
                                            <strong>Create new templates in News Feed</strong><br />
                                            Go to the News Feed page, configure your filters (search, sources, dates), and click "Save as Template" to add items to this list.
                                        </div>
                                    </div>

                                    <div className={`${styles.configDisplay} ${flashEditor ? styles.flash : ''}`} onAnimationEnd={() => setFlashEditor(false)}>
                                        {Object.keys(pipeline.source_config || {}).length === 0 ? (
                                            <div className={styles.emptyConfig}>
                                                No filter configured. Load a "Recent News" preset or a custom template below.
                                            </div>
                                        ) : (
                                            <>
                                                {/* Sources Row */}
                                                <div className={styles.configRow}>
                                                    <div className={styles.configLabel}>Sources</div>
                                                    <div className={styles.configValue}>
                                                        {pipeline.source_config.source_ids?.length > 0 ? (
                                                            pipeline.source_config.source_ids.map((id: string) => {
                                                                const source = sources.find(s => s.id === id);
                                                                return (
                                                                    <span key={id} className={styles.sourceBadge}>
                                                                        {source ? source.name || source.url : id.substring(0, 8) + '...'}
                                                                    </span>
                                                                );
                                                            })
                                                        ) : (
                                                            <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>All Sources</span>
                                                        )}
                                                    </div>
                                                </div>

                                                <div className={styles.configRow}>
                                                    <div className={styles.configLabel}>Time Range</div>
                                                    <div className={styles.configValue}>
                                                        {pipeline.source_config.filter_date ? (
                                                            <strong>{formatTimeRange(pipeline.source_config.filter_date)}</strong>
                                                        ) : (
                                                            <span style={{ color: '#94a3b8' }}>All Time</span>
                                                        )}
                                                    </div>
                                                </div>

                                                <div className={styles.configRow}>
                                                    <div className={styles.configLabel}>Filters</div>
                                                    <div className={styles.configValue} style={{ flexDirection: 'column', gap: '0.25rem' }}>
                                                        {/* Handle both 'search' and 'search_term' for compatibility */}
                                                        {(pipeline.source_config.search || pipeline.source_config.search_term) && (
                                                            <div>Search: <strong>"{pipeline.source_config.search || pipeline.source_config.search_term}"</strong></div>
                                                        )}
                                                        {pipeline.source_config.min_relevance > 0 && (
                                                            <div>Relevance: <strong>&ge; {pipeline.source_config.min_relevance > 1 ? pipeline.source_config.min_relevance : Math.round(pipeline.source_config.min_relevance * 100)}%</strong></div>
                                                        )}
                                                        {pipeline.source_config.sentiment && (
                                                            <div>Sentiment: <strong style={{ textTransform: 'capitalize' }}>{pipeline.source_config.sentiment}</strong></div>
                                                        )}
                                                        {pipeline.source_config.tags?.length > 0 && (
                                                            <div>Tags: {pipeline.source_config.tags.map((t: string) => <span key={t} className={styles.sourceBadge} style={{ fontSize: '0.75rem', marginRight: '4px' }}>#{t}</span>)}</div>
                                                        )}
                                                        {pipeline.source_config.entities?.length > 0 && (
                                                            <div>Entities: {pipeline.source_config.entities.map((e: string) => <span key={e} className={styles.sourceBadge} style={{ fontSize: '0.75rem', marginRight: '4px' }}>@{e}</span>)}</div>
                                                        )}
                                                        {pipeline.source_config.story_status && pipeline.source_config.story_status !== 'all' && (
                                                            <div>Story Status: <strong style={{ textTransform: 'capitalize' }}>{pipeline.source_config.story_status}</strong></div>
                                                        )}
                                                        {![
                                                            (pipeline.source_config.search || pipeline.source_config.search_term),
                                                            pipeline.source_config.min_relevance > 0,
                                                            pipeline.source_config.sentiment,
                                                            pipeline.source_config.tags?.length,
                                                            pipeline.source_config.entities?.length,
                                                            (pipeline.source_config.story_status && pipeline.source_config.story_status !== 'all')
                                                        ].some(Boolean) && (
                                                                <span style={{ color: '#94a3b8' }}>No extra filters</span>
                                                            )}
                                                    </div>
                                                </div>

                                                {/* Settings Row */}
                                                <div className={styles.configRow}>
                                                    <div className={styles.configLabel}>Settings</div>
                                                    <div className={styles.configValue} style={{ flexDirection: 'column', gap: '0.25rem' }}>
                                                        <div>Sort: <strong>{pipeline.source_config.sort === 'published_at' ? 'Date Published' : (pipeline.source_config.sort || 'Default')}</strong></div>
                                                    </div>
                                                </div>
                                            </>
                                        )}
                                    </div>


                                    <div style={{ marginTop: '2rem', display: 'flex', flexDirection: 'column', gap: '24px' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600, color: '#1e293b' }}>
                                                Select Filter Template
                                            </h3>
                                        </div>

                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px' }}>
                                            {sourceConfigs.length === 0 && (
                                                <div style={{ gridColumn: '1 / -1', padding: '40px', textAlign: 'center', border: '2px dashed #e2e8f0', borderRadius: '12px' }}>
                                                    <p style={{ color: '#64748b', margin: 0 }}>No source templates found. Create a template in the News Feed first.</p>
                                                </div>
                                            )}

                                            {sourceConfigs.map(sc => {
                                                const isActive = pipeline.source_config?.template_id === sc.id;
                                                return (
                                                    <div
                                                        key={sc.id}
                                                        style={{
                                                            padding: '20px',
                                                            borderRadius: '12px',
                                                            border: `2px solid ${isActive ? '#2563eb' : '#e2e8f0'}`,
                                                            backgroundColor: isActive ? '#f8faff' : 'white',
                                                            cursor: 'pointer',
                                                            transition: 'all 0.2s ease',
                                                            position: 'relative',
                                                            display: 'flex',
                                                            flexDirection: 'column',
                                                            gap: '12px'
                                                        }}
                                                        onClick={() => {
                                                            const configWithId = {
                                                                ...JSON.parse(JSON.stringify(sc.config)),
                                                                template_id: sc.id
                                                            };
                                                            setPipeline({ ...pipeline, source_config: configWithId });
                                                            setFlashEditor(true);
                                                            window.scrollTo({ top: 0, behavior: 'smooth' });
                                                        }}
                                                    >
                                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                                            <div style={{ fontWeight: 600, color: '#0f172a', fontSize: '1rem' }}>{sc.name}</div>
                                                            <div style={{ display: 'flex', gap: '4px' }}>
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        setEditingSourceConfig(sc);
                                                                        setSourceConfigModalOpen(true);
                                                                    }}
                                                                    style={{ background: 'none', border: 'none', padding: '4px', cursor: 'pointer', color: '#64748b' }}
                                                                    title="Edit Template"
                                                                >
                                                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
                                                                </button>
                                                                <button
                                                                    onClick={(e) => { e.stopPropagation(); setDeletingTemplateId(sc.id); }}
                                                                    style={{ background: 'none', border: 'none', padding: '4px', cursor: 'pointer', color: '#64748b' }}
                                                                    title="Delete Template"
                                                                >
                                                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path></svg>
                                                                </button>
                                                            </div>
                                                        </div>

                                                        <div style={{ fontSize: '0.85rem', color: '#64748b', lineHeight: 1.4, flex: 1 }}>
                                                            {sc.description || 'No description provided.'}
                                                        </div>

                                                        {isActive && (
                                                            <div style={{
                                                                position: 'absolute',
                                                                top: '-10px',
                                                                right: '-10px',
                                                                backgroundColor: '#2563eb',
                                                                color: 'white',
                                                                borderRadius: '50%',
                                                                width: '24px',
                                                                height: '24px',
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                justifyContent: 'center',
                                                                boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                                                            }}>
                                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>

                                        <SourceConfigEditorModal
                                            isOpen={isSourceConfigModalOpen}
                                            onClose={() => setSourceConfigModalOpen(false)}
                                            onSave={handleSaveSourceConfig}
                                            initialData={editingSourceConfig}
                                        />
                                    </div>
                                </div>
                            )}

                            {activeStep === 2 && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600, color: '#1e293b' }}>
                                            Select or Create AI Analysis Prompt
                                        </h3>
                                        <button
                                            onClick={handleCreatePrompt}
                                            style={{
                                                padding: '8px 16px',
                                                borderRadius: '8px',
                                                backgroundColor: '#2563eb',
                                                color: 'white',
                                                border: 'none',
                                                fontWeight: 600,
                                                fontSize: '0.9rem',
                                                cursor: 'pointer',
                                                boxShadow: '0 2px 4px rgba(37, 99, 235, 0.2)'
                                            }}
                                        >
                                            + Create New Prompt
                                        </button>
                                    </div>

                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px' }}>
                                        {prompts.map(p => {
                                            const isSelected = pipeline.prompt_id === p.id;
                                            return (
                                                <div
                                                    key={p.id}
                                                    style={{
                                                        padding: '20px',
                                                        borderRadius: '12px',
                                                        border: `2px solid ${isSelected ? '#2563eb' : '#e2e8f0'}`,
                                                        backgroundColor: isSelected ? '#f8faff' : 'white',
                                                        cursor: 'pointer',
                                                        transition: 'all 0.2s ease',
                                                        position: 'relative',
                                                        display: 'flex',
                                                        flexDirection: 'column',
                                                        gap: '12px'
                                                    }}
                                                    onClick={() => setPipeline({ ...pipeline, prompt_id: p.id })}
                                                >
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                                        <div style={{ fontWeight: 600, color: '#0f172a', fontSize: '1rem' }}>{p.name}</div>
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); handleEditPrompt(p); }}
                                                            style={{
                                                                background: 'none',
                                                                border: 'none',
                                                                padding: '4px',
                                                                cursor: 'pointer',
                                                                color: '#64748b'
                                                            }}
                                                        >
                                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
                                                        </button>
                                                    </div>
                                                    <div style={{ fontSize: '0.85rem', color: '#64748b', lineHeight: 1.4, flex: 1 }}>
                                                        {p.description || 'No description provided.'}
                                                    </div>
                                                    {isSelected && (
                                                        <div style={{
                                                            position: 'absolute',
                                                            top: '-10px',
                                                            right: '-10px',
                                                            backgroundColor: '#2563eb',
                                                            color: 'white',
                                                            borderRadius: '50%',
                                                            width: '24px',
                                                            height: '24px',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                                                        }}>
                                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>

                                    {prompts.length === 0 && (
                                        <div style={{ padding: '40px', textAlign: 'center', border: '2px dashed #e2e8f0', borderRadius: '12px' }}>
                                            <p style={{ color: '#64748b', margin: 0 }}>No AI prompts available. Create one to get started.</p>
                                        </div>
                                    )}

                                    {/* Prompt Modal */}
                                    <PromptEditorModal
                                        isOpen={isPromptModalOpen}
                                        onClose={() => setIsPromptModalOpen(false)}
                                        onSave={handleSavePrompt}
                                        initialData={editingPrompt}
                                        availableVariables={PROMPT_VARIABLES}
                                    />
                                </div>
                            )}

                            {activeStep === 3 && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600, color: '#1e293b' }}>
                                            Select or Create Formatting Style
                                        </h3>
                                        <button
                                            onClick={handleCreateFormatting}
                                            style={{
                                                padding: '8px 16px',
                                                borderRadius: '8px',
                                                backgroundColor: '#2563eb',
                                                color: 'white',
                                                border: 'none',
                                                fontWeight: 600,
                                                fontSize: '0.9rem',
                                                cursor: 'pointer',
                                                boxShadow: '0 2px 4px rgba(37, 99, 235, 0.2)'
                                            }}
                                        >
                                            + Create New Style
                                        </button>
                                    </div>

                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px' }}>
                                        {formattings.map(fmt => {
                                            const isSelected = pipeline.formatting_id === fmt.id;
                                            return (
                                                <div
                                                    key={fmt.id}
                                                    style={{
                                                        padding: '20px',
                                                        borderRadius: '12px',
                                                        border: `2px solid ${isSelected ? '#2563eb' : '#e2e8f0'}`,
                                                        backgroundColor: isSelected ? '#f8faff' : 'white',
                                                        cursor: 'pointer',
                                                        transition: 'all 0.2s ease',
                                                        position: 'relative',
                                                        display: 'flex',
                                                        flexDirection: 'column',
                                                        gap: '12px'
                                                    }}
                                                    onClick={() => setPipeline({ ...pipeline, formatting_id: fmt.id })}
                                                >
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                                        <div style={{ fontWeight: 600, color: '#0f172a', fontSize: '1rem' }}>{fmt.name}</div>
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); handleEditFormatting(fmt); }}
                                                            style={{
                                                                background: 'none',
                                                                border: 'none',
                                                                padding: '4px',
                                                                cursor: 'pointer',
                                                                color: '#64748b'
                                                            }}
                                                        >
                                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
                                                        </button>
                                                    </div>
                                                    <div style={{ fontSize: '0.85rem', color: '#64748b', lineHeight: 1.4 }}>{fmt.description || 'No description provided.'}</div>
                                                    {isSelected && (
                                                        <div style={{
                                                            position: 'absolute',
                                                            top: '-10px',
                                                            right: '-10px',
                                                            backgroundColor: '#2563eb',
                                                            color: 'white',
                                                            borderRadius: '50%',
                                                            width: '24px',
                                                            height: '24px',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                                                        }}>
                                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>

                                    {formattings.length === 0 && (
                                        <div style={{ padding: '40px', textAlign: 'center', border: '2px dashed #e2e8f0', borderRadius: '12px' }}>
                                            <p style={{ color: '#64748b', margin: 0 }}>No formatting styles available. Create one to get started.</p>
                                        </div>
                                    )}

                                </div>
                            )}

                            {activeStep === 4 && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600, color: '#1e293b' }}>
                                            Select or Create Output Configuration
                                        </h3>
                                        <button
                                            onClick={() => { setEditingOutput(null); setIsOutputModalOpen(true); }}
                                            style={{
                                                padding: '8px 16px',
                                                borderRadius: '8px',
                                                backgroundColor: '#2563eb',
                                                color: 'white',
                                                border: 'none',
                                                fontWeight: 600,
                                                fontSize: '0.9rem',
                                                cursor: 'pointer',
                                                boxShadow: '0 2px 4px rgba(37, 99, 235, 0.2)'
                                            }}
                                        >
                                            + Create Output Config
                                        </button>
                                    </div>

                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px' }}>
                                        {outputs.map(o => {
                                            const isSelected = pipeline.output_config_id === o.id;
                                            return (
                                                <div
                                                    key={o.id}
                                                    style={{
                                                        padding: '20px',
                                                        borderRadius: '12px',
                                                        border: `2px solid ${isSelected ? '#2563eb' : '#e2e8f0'}`,
                                                        backgroundColor: isSelected ? '#f8faff' : 'white',
                                                        cursor: 'pointer',
                                                        transition: 'all 0.2s ease',
                                                        position: 'relative',
                                                        display: 'flex',
                                                        flexDirection: 'column',
                                                        gap: '12px'
                                                    }}
                                                    onClick={() => setPipeline({ ...pipeline, output_config_id: o.id })}
                                                >
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                                        <div style={{ fontWeight: 600, color: '#0f172a', fontSize: '1rem' }}>{o.name}</div>
                                                        <div style={{ display: 'flex', gap: '4px' }}>
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); handleEditOutput(o); }}
                                                                style={{ background: 'none', border: 'none', padding: '4px', cursor: 'pointer', color: '#64748b' }}
                                                                title="Edit Configuration"
                                                            >
                                                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
                                                            </button>
                                                            <button
                                                                onClick={(e) => handleDeleteOutput(o.id, e)}
                                                                style={{ background: 'none', border: 'none', padding: '4px', cursor: 'pointer', color: '#64748b' }}
                                                                title="Delete Configuration"
                                                            >
                                                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path></svg>
                                                            </button>
                                                        </div>
                                                    </div>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                        <span style={{
                                                            padding: '2px 6px',
                                                            borderRadius: '4px',
                                                            backgroundColor: '#f1f5f9',
                                                            color: '#475569',
                                                            fontSize: '0.75rem',
                                                            fontWeight: 600
                                                        }}>
                                                            {o.converter_type}
                                                        </span>
                                                        <span style={{ fontSize: '0.85rem', color: '#64748b' }}>File Output</span>
                                                    </div>
                                                    {isSelected && (
                                                        <div style={{
                                                            position: 'absolute',
                                                            top: '-10px',
                                                            right: '-10px',
                                                            backgroundColor: '#2563eb',
                                                            color: 'white',
                                                            borderRadius: '50%',
                                                            width: '24px',
                                                            height: '24px',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                                                        }}>
                                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>

                                    {outputs.length === 0 && (
                                        <div className={styles.emptyTemplates}>
                                            <p>No output configurations available. Create one to get started.</p>
                                        </div>
                                    )}
                                </div>
                            )}

                            {activeStep === 5 && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600, color: '#1e293b' }}>
                                            Select or Create Delivery Target
                                        </h3>
                                        <button
                                            onClick={() => { setEditingDelivery(null); setIsDeliveryModalOpen(true); }}
                                            style={{
                                                padding: '8px 16px',
                                                borderRadius: '8px',
                                                backgroundColor: '#2563eb',
                                                color: 'white',
                                                border: 'none',
                                                fontWeight: 600,
                                                fontSize: '0.9rem',
                                                cursor: 'pointer',
                                                boxShadow: '0 2px 4px rgba(37, 99, 235, 0.2)'
                                            }}
                                        >
                                            + Create Delivery Target
                                        </button>
                                    </div>

                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px' }}>
                                        {deliveries.map(d => {
                                            const isSelected = pipeline.delivery_config_id === d.id;
                                            return (
                                                <div
                                                    key={d.id}
                                                    style={{
                                                        padding: '20px',
                                                        borderRadius: '12px',
                                                        border: `2px solid ${isSelected ? '#2563eb' : '#e2e8f0'}`,
                                                        backgroundColor: isSelected ? '#f8faff' : 'white',
                                                        cursor: 'pointer',
                                                        transition: 'all 0.2s ease',
                                                        position: 'relative',
                                                        display: 'flex',
                                                        flexDirection: 'column',
                                                        gap: '12px'
                                                    }}
                                                    onClick={() => setPipeline({ ...pipeline, delivery_config_id: d.id })}
                                                >
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                                        <div style={{ fontWeight: 600, color: '#0f172a', fontSize: '1rem' }}>{d.name}</div>
                                                        <div style={{ display: 'flex', gap: '4px' }}>
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); handleEditDelivery(d); }}
                                                                style={{ background: 'none', border: 'none', padding: '4px', cursor: 'pointer', color: '#64748b' }}
                                                                title="Edit Integration"
                                                            >
                                                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
                                                            </button>
                                                            <button
                                                                onClick={(e) => handleDeleteDelivery(d.id, e)}
                                                                style={{ background: 'none', border: 'none', padding: '4px', cursor: 'pointer', color: '#64748b' }}
                                                                title="Delete Integration"
                                                            >
                                                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path></svg>
                                                            </button>
                                                        </div>
                                                    </div>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                        <span style={{
                                                            padding: '2px 6px',
                                                            borderRadius: '4px',
                                                            backgroundColor: '#eff6ff',
                                                            color: '#1e40af',
                                                            fontSize: '0.75rem',
                                                            fontWeight: 600
                                                        }}>
                                                            {d.delivery_type}
                                                        </span>
                                                        <span style={{ fontSize: '0.85rem', color: '#64748b' }}>
                                                            {d.parameters?.recipients?.length > 0 ? `${d.parameters.recipients.length} Recipient(s)` : 'No Recipients'}
                                                        </span>
                                                    </div>
                                                    {isSelected && (
                                                        <div style={{
                                                            position: 'absolute',
                                                            top: '-10px',
                                                            right: '-10px',
                                                            backgroundColor: '#2563eb',
                                                            color: 'white',
                                                            borderRadius: '50%',
                                                            width: '24px',
                                                            height: '24px',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                                                        }}>
                                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>

                                    {deliveries.length === 0 && (
                                        <div className={styles.emptyTemplates}>
                                            <p>No delivery targets available. Create one to get started.</p>
                                        </div>
                                    )}
                                </div>
                            )}

                            {activeStep === 6 && (
                                <div className={styles.formGroup}>
                                    <h3 className={styles.sectionTitle}>Review & Activation</h3>

                                    <ReviewSummary
                                        pipeline={pipeline}
                                        sourceConfigs={sourceConfigs}
                                        prompts={prompts}
                                        formattings={formattings}
                                        outputs={outputs}
                                        deliveries={deliveries}
                                    />

                                    {/* Run Mode Tabs */}
                                    <div style={{
                                        display: 'flex',
                                        background: '#f1f5f9',
                                        padding: '4px',
                                        borderRadius: '8px',
                                        marginBottom: '24px'
                                    }}>
                                        <button
                                            onClick={() => setRunMode('manual')}
                                            style={{
                                                flex: 1,
                                                padding: '10px',
                                                borderRadius: '6px',
                                                border: 'none',
                                                background: runMode === 'manual' ? 'white' : 'transparent',
                                                boxShadow: runMode === 'manual' ? '0 1px 2px rgba(0,0,0,0.1)' : 'none',
                                                fontWeight: 600,
                                                color: runMode === 'manual' ? '#0f172a' : '#64748b',
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                gap: '8px',
                                                transition: 'all 0.2s'
                                            }}
                                        >
                                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
                                            Run Immediately
                                        </button>
                                        <button
                                            onClick={() => setRunMode('schedule')}
                                            style={{
                                                flex: 1,
                                                padding: '10px',
                                                borderRadius: '6px',
                                                border: 'none',
                                                background: runMode === 'schedule' ? 'white' : 'transparent',
                                                boxShadow: runMode === 'schedule' ? '0 1px 2px rgba(0,0,0,0.1)' : 'none',
                                                fontWeight: 600,
                                                color: runMode === 'schedule' ? '#0f172a' : '#64748b',
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                gap: '8px',
                                                transition: 'all 0.2s'
                                            }}
                                        >
                                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                                            Schedule Recurring
                                        </button>
                                    </div>

                                    {/* Content Area */}
                                    <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '24px' }}>
                                        {runMode === 'manual' ? (
                                            <div style={{ textAlign: 'center', padding: '20px' }}>
                                                <div style={{
                                                    width: '64px', height: '64px', background: '#eff6ff', borderRadius: '50%',
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px',
                                                    color: '#2563eb'
                                                }}>
                                                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
                                                </div>
                                                <h3 style={{ fontSize: '1.25rem', marginBottom: '8px', color: '#1e293b' }}>Ready to Launch?</h3>
                                                <p style={{ color: '#64748b', maxWidth: '400px', margin: '0 auto 24px' }}>
                                                    This will execute the entire pipeline immediately. You will receive the report via your configured delivery method.
                                                </p>

                                                <button
                                                    onClick={async () => {
                                                        if (!pipeline.id) return;
                                                        setTesting(true);
                                                        try {
                                                            await runPipeline(pipeline.id);
                                                            setAlertState({
                                                                isOpen: true,
                                                                message: "Pipeline executed successfully! Report is being generated.",
                                                                type: 'success'
                                                            });
                                                        } catch (e: any) {
                                                            setAlertState({
                                                                isOpen: true,
                                                                message: `Run failed: ${e.message}`,
                                                                type: 'error'
                                                            });
                                                        } finally {
                                                            setTesting(false);
                                                        }
                                                    }}
                                                    disabled={testing || !pipeline.id}
                                                    className={styles.primaryButton}
                                                    style={{
                                                        fontSize: '1.1rem',
                                                        padding: '12px 32px',
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        gap: '8px'
                                                    }}
                                                >
                                                    {testing ? (
                                                        <>
                                                            <div className="spinner" style={{ width: '20px', height: '20px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white' }}></div>
                                                            Running Pipeline...
                                                        </>
                                                    ) : (
                                                        <>
                                                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
                                                            Run Pipeline Now
                                                        </>
                                                    )}
                                                </button>
                                            </div>
                                        ) : (
                                            <div>
                                                <div style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                    <div>
                                                        <h4 style={{ margin: '0 0 4px', fontSize: '1.1rem', color: '#1e293b' }}>Automated Schedule</h4>
                                                        <p style={{ margin: 0, color: '#64748b', fontSize: '0.9rem' }}>Configure when this pipeline should run automatically.</p>
                                                    </div>
                                                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: 600 }}>
                                                        <input
                                                            type="checkbox"
                                                            checked={!!pipeline.schedule_enabled}
                                                            onChange={e => setPipeline({ ...pipeline, schedule_enabled: e.target.checked })}
                                                            style={{ width: '18px', height: '18px', accentColor: '#2563eb' }}
                                                        />
                                                        Enable Schedule
                                                    </label>
                                                </div>

                                                <div style={{
                                                    opacity: pipeline.schedule_enabled ? 1 : 0.5,
                                                    pointerEvents: pipeline.schedule_enabled ? 'auto' : 'none',
                                                    transition: 'opacity 0.2s'
                                                }}>
                                                    <ScheduleEditor
                                                        value={pipeline.schedule_cron || ""}
                                                        onChange={(newCron) => setPipeline({ ...pipeline, schedule_cron: newCron })}
                                                    />

                                                    {pipeline.next_run_at && (
                                                        <div style={{ marginTop: '12px', padding: '12px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0', display: 'flex', gap: '8px', alignItems: 'center' }}>
                                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                                                            <span style={{ fontSize: '0.9rem', color: '#64748b' }}>
                                                                Next Run: <strong style={{ color: '#0f172a' }}>{formatDateTime(pipeline.next_run_at)}</strong>
                                                            </span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Test Result Drawer */}
            <div className={`${styles.drawerOverlay} ${isDrawerOpen ? styles.drawerOverlayOpen : ''}`} onClick={() => setIsDrawerOpen(false)} />
            <div className={`${styles.drawer} ${isDrawerOpen ? styles.drawerOpen : ''} ${(activeStep === 2 || activeStep === 3 || activeStep === 4) ? styles.drawerWide : ''}`}>
                <button className={styles.closeButton} onClick={() => setIsDrawerOpen(false)}>×</button>

                <div className={styles.drawerHeader}>
                    <span className={styles.drawerContext}>
                        {pipeline?.name} • {activeStep === 1 ? 'Source Filter' : activeStep === 2 ? 'Content Processor' : 'Report Output'} Results
                    </span>
                    <h2 className={styles.drawerHeadline}>
                        {activeStep === 1 ? (
                            `Template: ${sourceConfigs.find(t => t.id === pipeline.source_config?.template_id)?.name || 'Unknown Template'}`
                        ) : activeStep === 2 ? 'Content Processing Results' : 'Final Report Output'}
                    </h2>
                </div>
                <div className={styles.drawerContent}>
                    {testing ? (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', flexDirection: 'column', gap: '1rem', color: '#666' }}>
                            <div className="spinner"></div>
                            {testStatus || 'Running Test...'}
                        </div>
                    ) : testResult ? (
                        <>
                            {testResult.error && (
                                <div style={{ padding: '2rem', textAlign: 'center', color: '#dc2626' }}>
                                    <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>⚠️</div>
                                    <h3 style={{ fontWeight: 600, marginBottom: '0.5rem' }}>Test Failed</h3>
                                    <p>{testResult.error}</p>
                                </div>
                            )}

                            {!testResult.error && activeStep === 1 && Array.isArray(testResult) && (
                                <div className={styles.articlePreviewList}>
                                    <div style={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                        marginBottom: '1.5rem',
                                        paddingBottom: '0.5rem',
                                        borderBottom: '1px solid #f1f5f9'
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                            <span style={{
                                                background: '#2563eb',
                                                color: 'white',
                                                fontSize: '0.75rem',
                                                fontWeight: 700,
                                                padding: '2px 8px',
                                                borderRadius: '100px'
                                            }}>
                                                {testResult.length}
                                            </span>
                                            <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600, color: '#334155' }}>
                                                Articles Found
                                            </h4>
                                        </div>
                                    </div>
                                    {(testResult as Article[]).length > 0 ? (
                                        <>
                                            {(testResult as Article[]).slice(0, viewLimit).map(article => (
                                                <ArticleCard
                                                    key={article.id}
                                                    article={article}
                                                    viewMode="list"
                                                    showEnglish={true}
                                                />
                                            ))}
                                            {(testResult as Article[]).length > viewLimit && (
                                                <div style={{ textAlign: 'center', padding: '1rem', color: '#6b7280' }}>
                                                    <button
                                                        onClick={() => setViewLimit(prev => prev + 6)}
                                                        className={styles.secondaryButton}
                                                        style={{ padding: '8px 16px', background: 'white', border: '1px solid #ddd', borderRadius: '6px', cursor: 'pointer' }}
                                                    >
                                                        Show More ({testResult.length - viewLimit} remaining)
                                                    </button>
                                                </div>
                                            )}
                                        </>
                                    ) : (
                                        <div style={{ textAlign: 'center', padding: '3rem', color: '#6b7280' }}>
                                            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🔍</div>
                                            <h3 style={{ fontSize: '1.2rem', fontWeight: 600, color: '#374151', marginBottom: '0.5rem' }}>No Results Found</h3>
                                            <p style={{ maxWidth: '400px', margin: '0 auto 1.5rem' }}>Your current filters didn't match any articles. Try adjusting the date range or removing some restrictions.</p>
                                            <button
                                                onClick={() => setIsDrawerOpen(false)}
                                                className={styles.secondaryButton}
                                            >
                                                Close Results
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}

                            {activeStep === 2 && (
                                <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                                    {/* Tabs */}
                                    <div style={{ display: 'flex', gap: '1rem', borderBottom: '1px solid #eee', marginBottom: '1rem', paddingBottom: '0.5rem' }}>
                                        <button
                                            onClick={() => setDrawerTab('prompt')}
                                            style={{
                                                padding: '4px 12px',
                                                border: 'none',
                                                background: drawerTab === 'prompt' ? '#eff6ff' : 'transparent',
                                                color: drawerTab === 'prompt' ? '#2563eb' : '#64748b',
                                                fontWeight: drawerTab === 'prompt' ? 600 : 400,
                                                borderRadius: '4px',
                                                cursor: 'pointer'
                                            }}
                                        >
                                            Generated Prompt
                                        </button>
                                        <button
                                            onClick={() => setDrawerTab('raw')}
                                            style={{
                                                padding: '4px 12px',
                                                border: 'none',
                                                background: drawerTab === 'raw' ? '#eff6ff' : 'transparent',
                                                color: drawerTab === 'raw' ? '#2563eb' : '#64748b',
                                                fontWeight: drawerTab === 'raw' ? 600 : 400,
                                                borderRadius: '4px',
                                                cursor: 'pointer'
                                            }}
                                        >
                                            Raw AI Output
                                        </button>
                                        <button
                                            onClick={() => setDrawerTab('final')}
                                            style={{
                                                padding: '4px 12px',
                                                border: 'none',
                                                background: drawerTab === 'final' ? '#eff6ff' : 'transparent',
                                                color: drawerTab === 'final' ? '#2563eb' : '#64748b',
                                                fontWeight: drawerTab === 'final' ? 600 : 400,
                                                borderRadius: '4px',
                                                cursor: 'pointer'
                                            }}
                                        >
                                            Final Output (JSON)
                                        </button>
                                    </div>

                                    <div style={{ flex: 1, overflow: 'auto', background: '#f8fafc', borderRadius: '8px', padding: '1rem', border: '1px solid #e2e8f0' }}>
                                        {drawerTab === 'prompt' && (
                                            <pre style={{ margin: 0, whiteSpace: 'pre-wrap', fontFamily: 'monospace', fontSize: '0.85rem' }}>
                                                {testResult._debug_prompt || "No prompt debug info available."}
                                            </pre>
                                        )}
                                        {drawerTab === 'raw' && (
                                            <pre style={{ margin: 0, whiteSpace: 'pre-wrap', fontFamily: 'monospace', fontSize: '0.85rem' }}>
                                                {testResult._debug_raw_response || "No raw response debug info available."}
                                            </pre>
                                        )}
                                        {drawerTab === 'final' && (
                                            <pre style={{ margin: 0, whiteSpace: 'pre-wrap', fontFamily: 'monospace', fontSize: '0.85rem' }}>
                                                {(() => {
                                                    // Filter out debug keys for clean JSON view
                                                    const cleanResult = { ...testResult };
                                                    delete cleanResult._debug_prompt;
                                                    delete cleanResult._debug_raw_response;
                                                    return JSON.stringify(cleanResult, null, 2);
                                                })()}
                                            </pre>
                                        )}
                                    </div>
                                </div>
                            )}

                            {activeStep === 3 && (
                                <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                                    {typeof testResult === 'string' && (
                                        <>
                                            <div style={{ display: 'flex', gap: '1rem', borderBottom: '1px solid #eee', marginBottom: '1rem', paddingBottom: '0.5rem' }}>
                                                <button
                                                    onClick={() => setDrawerTab('preview')}
                                                    style={{
                                                        padding: '4px 12px',
                                                        border: 'none',
                                                        background: drawerTab === 'preview' ? '#eff6ff' : 'transparent',
                                                        color: drawerTab === 'preview' ? '#2563eb' : '#64748b',
                                                        fontWeight: drawerTab === 'preview' ? 600 : 400,
                                                        borderRadius: '4px',
                                                        cursor: 'pointer'
                                                    }}
                                                >
                                                    Visual Preview
                                                </button>
                                                <button
                                                    onClick={() => setDrawerTab('raw')}
                                                    style={{
                                                        padding: '4px 12px',
                                                        border: 'none',
                                                        background: drawerTab === 'raw' ? '#eff6ff' : 'transparent',
                                                        color: drawerTab === 'raw' ? '#2563eb' : '#64748b',
                                                        fontWeight: drawerTab === 'raw' ? 600 : 400,
                                                        borderRadius: '4px',
                                                        cursor: 'pointer'
                                                    }}
                                                >
                                                    Raw HTML Code
                                                </button>
                                            </div>
                                            <div style={{ flex: 1, overflow: 'auto', background: 'white', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                                                {drawerTab === 'preview' ? (
                                                    <iframe
                                                        srcDoc={testResult}
                                                        style={{ width: '100%', height: '100%', border: 'none' }}
                                                    />
                                                ) : (
                                                    <pre style={{ margin: 0, padding: '1rem', whiteSpace: 'pre-wrap', fontFamily: 'monospace', fontSize: '0.85rem' }}>
                                                        {testResult}
                                                    </pre>
                                                )}
                                            </div>
                                        </>
                                    )}
                                    {typeof testResult !== 'string' && (
                                        <div style={{ flex: 1, overflow: 'auto', background: '#f8fafc', borderRadius: '8px', padding: '1rem', border: '1px solid #e2e8f0' }}>
                                            <pre style={{ margin: 0, whiteSpace: 'pre-wrap', fontFamily: 'monospace', fontSize: '0.85rem' }}>
                                                {JSON.stringify(testResult, null, 2)}
                                            </pre>
                                        </div>
                                    )}
                                </div>
                            )}

                            {activeStep === 4 && (
                                <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', paddingBottom: '0.5rem', borderBottom: '1px solid #eee' }}>
                                        <div style={{ fontSize: '0.9rem', color: '#64748b' }}>
                                            Output File: <code style={{ background: '#f1f5f9', padding: '2px 4px', borderRadius: '4px' }}>{testResult}</code>
                                        </div>
                                        <button
                                            onClick={() => {
                                                if (testResult && session) {
                                                    // Direct Download via Backend Enforcement
                                                    // We pass 'download=true' to force Content-Disposition header
                                                    // We pass 'token' query param because headers aren't sent with window.open
                                                    // @ts-ignore
                                                    const token = session.id_token;
                                                    const downloadUrl = `${API_URL}/pipeline/test-report/view?path=${encodeURIComponent(testResult)}&download=true&token=${token}`;

                                                    // Use window.location.href (or hidden iframe) to trigger download
                                                    // window.open(downloadUrl, '_blank') triggers popup blocker sometimes
                                                    // Creating <a> click is safer
                                                    const a = document.createElement('a');
                                                    a.href = downloadUrl;
                                                    document.body.appendChild(a);
                                                    a.click();
                                                    document.body.removeChild(a);
                                                }
                                            }}
                                            className={styles.primaryButton}
                                            disabled={!previewUrl || !session}
                                        >
                                            Download Report
                                        </button>
                                    </div>
                                    <div style={{ flex: 1, overflow: 'hidden', background: 'white', borderRadius: '8px', border: '1px solid #e2e8f0', minHeight: '500px' }}>
                                        {previewUrl ? (
                                            <iframe
                                                src={previewUrl}
                                                style={{ width: '100%', height: '100%', border: 'none' }}
                                                title="Report Preview"
                                            />
                                        ) : (
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#94a3b8' }}>
                                                {testResult?.error ? "Preview unavailable due to error" : "Preparing Preview..."}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {activeStep === 5 && (
                                <div style={{ padding: '24px', maxWidth: '800px', margin: '0 auto' }}>
                                    {testResult.status === 'success' ? (
                                        <div style={{
                                            backgroundColor: '#f0fdf4',
                                            border: '1px solid #bbf7d0',
                                            borderRadius: '12px',
                                            padding: '24px',
                                            textAlign: 'center'
                                        }}>
                                            <div style={{
                                                width: '64px', height: '64px',
                                                backgroundColor: '#dcfce7',
                                                color: '#16a34a',
                                                borderRadius: '50%',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                margin: '0 auto 16px'
                                            }}>
                                                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                                            </div>
                                            <h3 style={{ margin: '0 0 8px 0', color: '#166534', fontSize: '1.25rem' }}>Delivery Successful!</h3>
                                            <p style={{ margin: '0 0 24px 0', color: '#15803d' }}>Your report has been sent successfully.</p>

                                            <div style={{
                                                backgroundColor: 'white',
                                                borderRadius: '8px',
                                                padding: '16px',
                                                textAlign: 'left',
                                                border: '1px solid #bbf7d0',
                                                boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
                                            }}>
                                                <div style={{ marginBottom: '12px' }}>
                                                    <label style={{ display: 'block', textTransform: 'uppercase', fontSize: '0.7rem', color: '#64748b', fontWeight: 700, letterSpacing: '0.05em' }}>Subject</label>
                                                    <div style={{ fontSize: '1rem', color: '#0f172a', fontWeight: 600 }}>{testResult.log?.subject || testResult.log?.config?.subject || 'N/A'}</div>
                                                </div>
                                                <div style={{ marginBottom: '12px' }}>
                                                    <label style={{ display: 'block', textTransform: 'uppercase', fontSize: '0.7rem', color: '#64748b', fontWeight: 700, letterSpacing: '0.05em' }}>Recipients</label>
                                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '4px' }}>
                                                        {(testResult.log?.recipients || testResult.log?.config?.recipients || []).map((email: string) => (
                                                            <span key={email} style={{
                                                                backgroundColor: '#eff6ff', color: '#1e40af', borderRadius: '4px',
                                                                padding: '2px 8px', fontSize: '0.85rem', fontWeight: 500, border: '1px solid #dbeafe'
                                                            }}>
                                                                {email}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </div>
                                                {(testResult.log?.cc && testResult.log.cc.length > 0) && (
                                                    <div style={{ marginBottom: '12px' }}>
                                                        <label style={{ display: 'block', textTransform: 'uppercase', fontSize: '0.7rem', color: '#64748b', fontWeight: 700, letterSpacing: '0.05em' }}>CC</label>
                                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '4px' }}>
                                                            {testResult.log.cc.map((email: string) => (
                                                                <span key={email} style={{
                                                                    backgroundColor: '#f1f5f9', color: '#475569', borderRadius: '4px',
                                                                    padding: '2px 8px', fontSize: '0.85rem', fontWeight: 500, border: '1px solid #e2e8f0'
                                                                }}>
                                                                    {email}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                                {(testResult.log?.bcc && testResult.log.bcc.length > 0) && (
                                                    <div style={{ marginBottom: '12px' }}>
                                                        <label style={{ display: 'block', textTransform: 'uppercase', fontSize: '0.7rem', color: '#64748b', fontWeight: 700, letterSpacing: '0.05em' }}>BCC</label>
                                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '4px' }}>
                                                            {testResult.log.bcc.map((email: string) => (
                                                                <span key={email} style={{
                                                                    backgroundColor: '#f1f5f9', color: '#475569', borderRadius: '4px',
                                                                    padding: '2px 8px', fontSize: '0.85rem', fontWeight: 500, border: '1px solid #e2e8f0'
                                                                }}>
                                                                    {email}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                                <div>
                                                    <label style={{ display: 'block', textTransform: 'uppercase', fontSize: '0.7rem', color: '#64748b', fontWeight: 700, letterSpacing: '0.05em' }}>Timestamp</label>
                                                    <div style={{ fontSize: '0.9rem', color: '#64748b', fontFamily: 'monospace' }}>{testResult.log?.timestamp ? new Date(testResult.log.timestamp).toLocaleString() : 'N/A'}</div>
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <div style={{
                                            backgroundColor: '#fef2f2',
                                            border: '1px solid #fee2e2',
                                            borderRadius: '12px',
                                            padding: '24px',
                                            textAlign: 'center'
                                        }}>
                                            <div style={{
                                                width: '64px', height: '64px',
                                                backgroundColor: '#fee2e2',
                                                color: '#dc2626',
                                                borderRadius: '50%',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                margin: '0 auto 16px'
                                            }}>
                                                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                                            </div>
                                            <h3 style={{ margin: '0 0 8px 0', color: '#991b1b', fontSize: '1.25rem' }}>Delivery Failed</h3>
                                            <p style={{ margin: '0 0 16px 0', color: '#b91c1c' }}>Something went wrong while sending the report.</p>
                                            <pre style={{
                                                textAlign: 'left',
                                                backgroundColor: '#fff1f2',
                                                color: '#ef4444',
                                                padding: '12px',
                                                borderRadius: '8px',
                                                fontSize: '0.85rem',
                                                overflowX: 'auto'
                                            }}>
                                                {testResult.error || JSON.stringify(testResult, null, 2)}
                                            </pre>
                                        </div>
                                    )}
                                </div>
                            )}
                        </>
                    ) : (
                        <div style={{ color: '#9ca3af', textAlign: 'center', marginTop: '3rem' }}>
                            No results yet. Click "Run Test" to verify this step.
                        </div>
                    )
                    }
                </div>
            </div>

            <SourceConfigEditorModal
                isOpen={isSourceConfigModalOpen}
                onClose={() => setSourceConfigModalOpen(false)}
                onSave={handleSaveSourceConfig}
                initialData={editingSourceConfig}
            />

            <PromptEditorModal
                isOpen={isPromptModalOpen}
                onClose={() => setIsPromptModalOpen(false)}
                onSave={handleSavePrompt}
                initialData={editingPrompt}
                availableVariables={PROMPT_VARIABLES}
            />

            <FormattingEditorModal
                isOpen={isFormattingModalOpen}
                onClose={() => setIsFormattingModalOpen(false)}
                onSave={handleSaveFormatting}
                initialData={editingFormatting}
                availableVariables={FORMATTING_VARIABLES}
            />

            <OutputConfigEditorModal
                isOpen={isOutputModalOpen}
                onClose={() => setIsOutputModalOpen(false)}
                onSave={handleSaveOutput}
                initialData={editingOutput}
            />

            <DeliveryConfigEditorModal
                isOpen={isDeliveryModalOpen}
                onClose={() => setIsDeliveryModalOpen(false)}
                onSave={handleSaveDelivery}
                initialData={editingDelivery}
            />

            <AlertModal
                isOpen={alertState.isOpen}
                message={alertState.message}
                type={alertState.type}
                onClose={() => setAlertState(prev => ({ ...prev, isOpen: false }))}
            />

            <ConfirmModal
                isOpen={!!deletingTemplateId}
                title="Delete Template"
                message="Are you sure you want to delete this source template? Pass pipelines using it will not be affected, but you won't be able to load it again."
                confirmLabel="Delete"
                onConfirm={handleDeleteTemplate}
                onCancel={() => setDeletingTemplateId(null)}
                isDestructive={true}
            />
        </div>
    );
}
