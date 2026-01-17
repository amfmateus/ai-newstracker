'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import ArticleDrawer from '../components/ArticleDrawer';
import { fetchReports, deleteReport, Report, fetchArticle, Article, fetchArticlesBulk, exportReportPdf, emailReport, fetchPipelines, ReportPipeline } from '../lib/api';
import { formatDateTime } from '../lib/dateUtils';
import AlertModal, { AlertType } from '../components/AlertModal';
import styles from './ReportsPage.module.css';

import EmailReportModal from '../components/EmailReportModal';

export default function ReportsPage() {
    const { status } = useSession();

    // --- View State ---
    const [reports, setReports] = useState<Report[]>([]);
    const [loadingReports, setLoadingReports] = useState(false);
    const [selectedReport, setSelectedReport] = useState<Report | null>(null);
    const [drawerArticle, setDrawerArticle] = useState<Article | null>(null);
    const [exporting, setExporting] = useState(false);
    const [pipelineMap, setPipelineMap] = useState<Record<string, string>>({});

    // Email Modal State
    const [emailModal, setEmailModal] = useState<{ isOpen: boolean; defaultEmail: string }>({
        isOpen: false,
        defaultEmail: ''
    });

    // Alert State
    const [alertState, setAlertState] = useState<{ isOpen: boolean; message: string; type: AlertType }>({
        isOpen: false,
        message: '',
        type: 'info'
    });

    // ... (useEffect and load functions remain the same) ...

    const handleEmailClick = () => {
        if (!selectedReport) return;

        // Logic to find last recipient
        let lastRecipient = '';
        if (selectedReport.delivery_log && selectedReport.delivery_log.length > 0) {
            // Sort by timestamp desc to be safe, though usually append-only
            // Find first success email
            const sortedLogs = [...selectedReport.delivery_log].sort((a, b) =>
                new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
            );

            for (const log of sortedLogs) {
                if (log.channel === 'email' && log.config?.recipients) {
                    const recipients = log.config.recipients;
                    if (Array.isArray(recipients)) {
                        lastRecipient = recipients[0]; // Take first
                    } else {
                        lastRecipient = recipients;
                    }
                    break;
                }
            }
        }

        setEmailModal({ isOpen: true, defaultEmail: lastRecipient });
    };

    const handleEmailSubmit = async (email: string) => {
        if (!selectedReport) return;
        try {
            await emailReport(selectedReport.id, email);
            setAlertState({ isOpen: true, message: `Email sent to ${email} successfully!`, type: 'success' });
            // Optionally update local state's delivery log to show immediate feedback if API returned updated report?
            // For now, loadReports() refresh might be overkill, simpler to just alert.
        } catch (e: any) {
            setAlertState({ isOpen: true, message: "Failed to send email: " + e.message, type: 'error' });
            throw e; // Modal catches this to stop closing if needed, but our modal closes on generic error currently. 
            // Actually, modal catches it.
        }
    };

    // --- References State ---
    const [referenceMap, setReferenceMap] = useState<Map<number, Article>>(new Map());

    useEffect(() => {
        if (status === 'authenticated') {
            loadReports();
            loadPipelines();
        }
    }, [status]);

    const loadReports = async () => {
        setLoadingReports(true);
        try {
            const data = await fetchReports();
            setReports(data);
        } catch (e) {
            console.error(e);
        } finally {
            setLoadingReports(false);
        }
    };

    const loadPipelines = async () => {
        try {
            const pipes = await fetchPipelines();
            const map: Record<string, string> = {};
            pipes.forEach(p => {
                map[p.id] = p.name;
            });
            setPipelineMap(map);
        } catch (e) {
            console.error("Failed to load pipelines for names", e);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Are you sure?")) return;
        try {
            await deleteReport(id);
            setReports(reports.filter(r => r.id !== id));
            if (selectedReport?.id === id) setSelectedReport(null);
        } catch (e) {
            setAlertState({ isOpen: true, message: "Failed to delete report", type: 'error' });
        }
    };

    const handleExportPdf = async () => {
        if (!selectedReport) return;
        setExporting(true);
        try {
            const blob = await exportReportPdf(selectedReport.id);
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `report_${selectedReport.id}_ec.pdf`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        } catch (e: any) {
            setAlertState({ isOpen: true, message: "Failed to export PDF: " + e.message, type: 'error' });
        } finally {
            setExporting(false);
        }
    };

    const handleEmail = async () => {
        if (!selectedReport) return;
        const email = prompt("Enter recipient email:");
        if (!email) return;

        setExporting(true);
        try {
            await emailReport(selectedReport.id, email);
            setAlertState({ isOpen: true, message: "Email sent successfully!", type: 'success' });
        } catch (e: any) {
            setAlertState({ isOpen: true, message: "Failed to send email: " + e.message, type: 'error' });
        } finally {
            setExporting(false);
        }
    };

    const handleSaveHtml = () => {
        if (!selectedReport) return;
        const content = selectedReport.content || '';
        // Wrap in a basic HTML structure if not already full HTML
        const htmlContent = content.trim().startsWith('<!DOCTYPE') || content.trim().startsWith('<html')
            ? content
            : `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>${selectedReport.title}</title>
    <style>
        body { font-family: sans-serif; line-height: 1.6; max-width: 900px; margin: 0 auto; padding: 2rem; color: #333; }
        h1 { color: #0E47CB; }
        a { color: #0E47CB; }
        img { max-width: 100%; }
    </style>
</head>
<body>
    <h1>${selectedReport.title}</h1>
    <p><em>Generated: ${formatDateTime(selectedReport.created_at)}</em></p>
    <hr>
    ${processContent(content)}
</body>
</html>`;

        const blob = new Blob([htmlContent], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `report_${selectedReport.id}.html`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    // --- Loading References Logic ---
    useEffect(() => {
        if (!selectedReport) {
            setReferenceMap(new Map());
            return;
        }

        const loadReferences = async () => {
            const ids = new Set<string>();
            const content = selectedReport.content || '';

            // 1. Raw Tags (Markdown)
            const rawRegex = /\[{1,2}(?:REF|CITATION|CITE|CIT):?\s*([a-zA-Z0-9\-\._\s]+)\s*\]{1,2}/g;
            let match;
            while ((match = rawRegex.exec(content)) !== null) {
                ids.add(match[1].trim());
            }

            // 2. Rendered Links (HTML)
            const htmlRegex = /href="#ref-([a-zA-Z0-9\-\._\s]+)"/g;
            while ((match = htmlRegex.exec(content)) !== null) {
                ids.add(match[1].trim());
            }

            // 3. Fallback: Cite Groups in HTML
            const groupRegex = /CITE_GROUP:([a-zA-Z0-9\-\._\s]+(?:,[a-zA-Z0-9\-\._\s]+)*)/g;
            while ((match = groupRegex.exec(content)) !== null) {
                match[1].split(',').forEach(id => ids.add(id.trim()));
            }

            if (ids.size === 0) return;

            try {
                const articles = await fetchArticlesBulk(Array.from(ids));
                const map = new Map<number, Article>();
                const citationMap = new Map<string, number>();
                let nextIndex = 1;

                // Re-scan to build citation map for stable numbering
                const rawRegex = /\[{1,2}(?:REF|CITATION|CITE|CIT):?\s*([a-zA-Z0-9\-\._\s]+)\s*\]{1,2}/g;
                const htmlRegex = /href="#ref-([a-zA-Z0-9\-\._\s]+)"/g;
                const groupRegex = /CITE_GROUP:([a-zA-Z0-9\-\._\s]+(?:,[a-zA-Z0-9\-\._\s]+)*)/g;

                let m;
                // Markdown
                while ((m = rawRegex.exec(content)) !== null) {
                    const id = m[1].trim();
                    if (!citationMap.has(id)) citationMap.set(id, nextIndex++);
                }
                // HTML links
                while ((m = htmlRegex.exec(content)) !== null) {
                    const id = m[1].trim();
                    if (!citationMap.has(id)) citationMap.set(id, nextIndex++);
                }
                // HTML groups
                while ((m = groupRegex.exec(content)) !== null) {
                    m[1].split(',').forEach(idPart => {
                        const id = idPart.trim();
                        if (!citationMap.has(id)) citationMap.set(id, nextIndex++);
                    });
                }

                articles.forEach(a => {
                    const num = citationMap.get(a.id);
                    if (num) map.set(num, a);
                });
                const sortedMap = new Map([...map.entries()].sort((a, b) => a[0] - b[0]));
                setReferenceMap(sortedMap);
            } catch (e) {
                console.error("Failed to load references", e);
            }
        };

        loadReferences();
    }, [selectedReport]);

    const processContent = (text: string | null) => {
        if (!text) return '';
        const citationMap = new Map<string, number>();
        let nextIndex = 1;

        // Permissive regex
        const pattern = /\[{1,2}(?:REF|CITATION|CITE|CIT):?\s*([a-zA-Z0-9\-\._\s]+)\s*\]{1,2}/g;

        // Pass 1: Build the citation map for stable numbering
        let match;
        pattern.lastIndex = 0;
        while ((match = pattern.exec(text)) !== null) {
            const id = match[1].trim();
            if (!citationMap.has(id)) citationMap.set(id, nextIndex++);
        }

        // Pass 2: Replace grouped citations
        // Match contiguous citation tags with potential separators
        const contiguousPattern = /((?:\[{1,2}(?:REF|CITATION|CITE|CIT):?\s*[a-zA-Z0-9\-\._\s]+\s*\]{1,2}[,; \t]*)*(?:\[{1,2}(?:REF|CITATION|CITE|CIT):?\s*[a-zA-Z0-9\-\._\s]+\s*\]{1,2}))/g;

        return text.replace(contiguousPattern, (matchFull) => {
            const ids = [...matchFull.matchAll(pattern)].map(m => m[1].trim());
            const validNums: number[] = [];
            const seen = new Set<string>();

            for (const id of ids) {
                if (citationMap.has(id) && !seen.has(id)) {
                    validNums.push(citationMap.get(id)!);
                    seen.add(id);
                }
            }

            if (validNums.length === 0) return '';

            // Sort numbers for clean output [1, 2, 3]
            validNums.sort((a, b) => a - b);

            const renderedLinks = validNums.map(n =>
                `<a href="#ref-${n}" style="color: inherit; text-decoration: none;">${n}</a>`
            );

            return `<sup style="font-weight: bold; color: #0E47CB; vertical-align: super; font-size: 0.75rem;">[${renderedLinks.join(', ')}]</sup>`;
        });
    };

    const handleCitationClick = async (href: string) => {
        if (href.startsWith('#')) {
            // ... existing logic fallback ...
        } else {
            window.open(href, '_blank');
        }
    };


    if (status === 'loading') return <div style={{ padding: '2rem' }}>Loading...</div>;
    if (status === 'unauthenticated') return <div style={{ padding: '2rem' }}>Please log in.</div>;

    // --- Report Viewer ---
    if (selectedReport) {
        const processedContent = processContent(selectedReport.content);

        return (
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 300px', height: '100vh', overflow: 'hidden' }}>

                {/* Main Content Area */}
                <div style={{ overflowY: 'auto', padding: '2rem', background: '#f9fafb' }}>
                    <div style={{ maxWidth: '1600px', margin: '0 auto', background: 'white', padding: '3rem 4rem', borderRadius: '4px', boxShadow: '0 2px 15px rgba(0,0,0,0.08)', minHeight: '100%' }}>

                        {/* Header */}
                        <div style={{ borderBottom: '2px solid #0E47CB', paddingBottom: '1rem', marginBottom: '2rem', textAlign: 'left' }}>
                            <h1 style={{ fontSize: '1.8rem', fontWeight: 700, margin: '0 0 0.5rem 0', color: '#0E47CB', lineHeight: 1.2 }}>
                                {selectedReport.title}
                            </h1>
                            {selectedReport.run_type && (
                                <span style={{
                                    fontSize: '0.75rem',
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.05em',
                                    color: 'white',
                                    background: selectedReport.run_type === 'scheduled' ? '#059669' : '#6b7280',
                                    padding: '0.2rem 0.5rem',
                                    borderRadius: '4px',
                                    fontWeight: 600
                                }}>
                                    {selectedReport.run_type}
                                </span>
                            )}
                            <div style={{ color: '#666', fontSize: '0.9rem', marginTop: '0.5rem' }}>
                                Generated: {formatDateTime(selectedReport.created_at)}
                            </div>
                        </div>

                        {/* Content */}
                        <style>{`
                            .report-content { width: 100% !important; max-width: none !important; }
                            .report-content > * { max-width: 100% !important; }
                            .report-content p, .report-content ul, .report-content ol, .report-content blockquote { max-width: none !important; }
                            .report-content img { max-width: 100%; height: auto; }
                        `}</style>
                        <div
                            style={{ lineHeight: '1.6', color: '#333', fontSize: '1rem', textAlign: 'left' }}
                            className="report-content"
                            dangerouslySetInnerHTML={{ __html: processedContent }}
                            onClick={(e) => {
                                const target = e.target as HTMLElement;
                                const link = target.closest('a');
                                if (link && link.getAttribute('href')?.startsWith('#ref-')) {
                                    e.preventDefault();
                                    const id = link.getAttribute('href')?.replace('#ref-', '');
                                    if (id) {
                                        const numIndex = parseInt(id);
                                        if (!isNaN(numIndex)) {
                                            const article = referenceMap.get(numIndex);
                                            if (article) {
                                                setDrawerArticle(article);
                                                return;
                                            }
                                        }
                                    }
                                }
                            }}
                        />

                        {/* References */}
                        {referenceMap.size > 0 && (
                            <div style={{ borderTop: '2px solid #EEE', marginTop: '4rem', paddingTop: '2rem' }}>
                                <h2 style={{ color: '#0E47CB', fontSize: '1.5rem', marginBottom: '1.5rem', borderBottom: '2px solid #FFCC00', display: 'inline-block', paddingBottom: '0.5rem' }}>References</h2>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                    {Array.from(referenceMap.entries()).map(([num, article]) => (
                                        <div key={num} id={`ref-${num}`} style={{ display: 'flex', gap: '1rem', fontSize: '0.95rem', color: '#444' }}>
                                            <div style={{ fontWeight: 600, minWidth: '24px', color: '#0E47CB', textAlign: 'right' }}>[{num}]</div>
                                            <div>
                                                <span style={{ fontWeight: 600, color: '#222' }}>{article.translated_title || article.raw_title}</span>
                                                {'. '}
                                                <span style={{ fontStyle: 'italic', color: '#666' }}>
                                                    {article.source ? article.source.name : (article.source_name_backup || 'Unknown Source')}
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Footer */}
                        <div style={{ borderTop: '1px solid #e5e5e5', marginTop: '4rem', paddingTop: '1.5rem', textAlign: 'center', color: '#666', fontSize: '0.9rem' }}>
                            Report ID: <span style={{ fontFamily: 'monospace' }}>{selectedReport.id}</span>
                        </div>
                    </div>
                </div>

                {/* Sidebar: Metadata & Actions */}
                <div style={{ borderLeft: '1px solid #e5e5e5', background: 'white', padding: '1.5rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                    <button
                        onClick={() => setSelectedReport(null)}
                        style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer', fontWeight: 600, fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.5rem', alignSelf: 'flex-start' }}
                    >
                        ← Back to Archive
                    </button>

                    <div>
                        <h3 style={{ fontSize: '0.85rem', textTransform: 'uppercase', color: '#666', letterSpacing: '0.05em', marginBottom: '1rem' }}>Actions</h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            <button onClick={handleSaveHtml} style={{ width: '100%', padding: '0.6rem', background: '#0E47CB', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 500 }}>
                                💾 Save as HTML
                            </button>
                            <button onClick={handleEmailClick} disabled={exporting} style={{ width: '100%', padding: '0.6rem', background: '#F59E0B', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 500 }}>
                                ✉️ Email Report
                            </button>
                            <button onClick={() => handleDelete(selectedReport.id)} style={{ width: '100%', padding: '0.6rem', border: '1px solid #ef4444', color: '#ef4444', background: 'white', borderRadius: '4px', cursor: 'pointer', fontWeight: 500 }}>
                                🗑️ Delete Permanently
                            </button>
                        </div>
                    </div>

                    <div>
                        <h3 style={{ fontSize: '0.85rem', textTransform: 'uppercase', color: '#666', letterSpacing: '0.05em', marginBottom: '1rem' }}>Delivery Log</h3>
                        {selectedReport.delivery_log && Array.isArray(selectedReport.delivery_log) && selectedReport.delivery_log.length > 0 ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                {selectedReport.delivery_log.map((log: any, idx: number) => (
                                    <div key={idx} style={{ fontSize: '0.85rem', padding: '0.75rem', background: '#f9fafb', borderRadius: '6px', border: '1px solid #e5e5e5' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                                            <span style={{ fontWeight: 600, color: '#333' }}>{log.channel}</span>
                                            <span style={{
                                                color: log.status === 'success' ? '#059669' : '#ef4444',
                                                fontWeight: 600, fontSize: '0.75rem', textTransform: 'capitalize'
                                            }}>
                                                {log.status}
                                            </span>
                                        </div>
                                        <div style={{ fontSize: '0.75rem', color: '#666', marginBottom: '0.25rem' }}>
                                            {formatDateTime(log.timestamp)}
                                        </div>
                                        {log.config?.recipients && (
                                            <div style={{ fontSize: '0.8rem', color: '#444' }}>
                                                To: {Array.isArray(log.config.recipients) ? log.config.recipients.join(', ') : log.config.recipients}
                                            </div>
                                        )}
                                        {log.error && <div style={{ color: '#ef4444', fontSize: '0.75rem', marginTop: '0.25rem' }}>Error: {log.error}</div>}
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div style={{ fontSize: '0.85rem', color: '#999', fontStyle: 'italic' }}>No delivery history recorded.</div>
                        )}
                    </div>

                    <div>
                        <h3 style={{ fontSize: '0.85rem', textTransform: 'uppercase', color: '#666', letterSpacing: '0.05em', marginBottom: '1rem' }}>Pipeline Info</h3>
                        <div style={{ fontSize: '0.9rem', color: '#333' }}>
                            <div style={{ marginBottom: '0.5rem' }}>
                                <span style={{ color: '#666' }}>Pipeline:</span><br />
                                <span style={{ fontWeight: 600 }}>
                                    {selectedReport.pipeline_id ? (pipelineMap[selectedReport.pipeline_id] || 'Unknown') : 'Manual Generation'}
                                </span>
                            </div>
                            <div style={{ marginBottom: '0.5rem' }}>
                                <span style={{ color: '#666' }}>Run Type:</span><br />
                                {selectedReport.run_type || 'manual'}
                            </div>
                            <div>
                                <span style={{ color: '#666' }}>Article Count:</span><br />
                                {selectedReport.article_ids ? selectedReport.article_ids.length : 0} articles
                            </div>
                        </div>
                    </div>
                </div>

                <AlertModal
                    isOpen={alertState.isOpen}
                    message={alertState.message}
                    type={alertState.type}
                    onClose={() => setAlertState(prev => ({ ...prev, isOpen: false }))}
                />

                <EmailReportModal
                    isOpen={emailModal.isOpen}
                    onClose={() => setEmailModal(prev => ({ ...prev, isOpen: false }))}
                    onSubmit={handleEmailSubmit}
                    defaultEmail={emailModal.defaultEmail}
                />

                {drawerArticle && (
                    <ArticleDrawer
                        article={drawerArticle}
                        onClose={() => setDrawerArticle(null)}
                    />
                )}
            </div>
        );
    }

    // --- Archive List View ---
    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <h1 className={styles.title}>Report Archive</h1>
                <div className={styles.count}>{reports.length} reports stored</div>
            </div>

            {loadingReports ? (
                <div className={styles.emptyState}>Loading archive...</div>
            ) : reports.length === 0 ? (
                <div className={styles.emptyState}>
                    No reports found in the archive. Execute a pipeline to generate reports.
                </div>
            ) : (
                <div className={styles.tableCard}>
                    <table className={styles.table}>
                        <thead className={styles.thead}>
                            <tr>
                                <th className={styles.th}>Report Title</th>
                                <th className={styles.th}>Generated At</th>
                                <th className={styles.th}>Pipeline / Type</th>
                                <th className={styles.th}>Delivery</th>
                                <th className={`${styles.th} ${styles.actions}`}>Actions</th>
                            </tr>
                        </thead>
                        <tbody className={styles.tbody}>
                            {reports.map(r => (
                                <tr
                                    key={r.id}
                                    onClick={() => setSelectedReport(r)}
                                >
                                    <td className={styles.td}>
                                        <div className={styles.reportTitle}>{r.title}</div>
                                    </td>
                                    <td className={`${styles.td} ${styles.timestamp}`}>
                                        {formatDateTime(r.created_at)}
                                    </td>
                                    <td className={styles.td}>
                                        <div className={styles.pipelineInfo}>
                                            {r.pipeline_id ? (
                                                <span className={styles.pipelineName}>
                                                    {pipelineMap[r.pipeline_id] || 'Unknown Pipeline'}
                                                </span>
                                            ) : <span className={styles.legacyLabel}>Manual (Legacy)</span>}

                                            <span className={`${styles.badge} ${r.run_type === 'scheduled' ? styles.badgeScheduled : styles.badgeManual}`}>
                                                {r.run_type || 'manual'}
                                            </span>
                                        </div>
                                    </td>
                                    <td className={styles.td}>
                                        {r.delivery_log && Array.isArray(r.delivery_log) && r.delivery_log.length > 0 ? (
                                            <div className={styles.deliveryContainer}>
                                                {r.delivery_log.map((log: any, idx: number) => (
                                                    <span key={idx} title={`${log.channel}: ${log.status}`} className={`${styles.deliveryBadge} ${log.status === 'success' ? styles.deliverySuccess : styles.deliveryError}`}>
                                                        {log.channel === 'EMAIL' ? '✉️' : '🚀'}
                                                    </span>
                                                ))}
                                            </div>
                                        ) : <span className={styles.deliveryEmpty}>-</span>}
                                    </td>
                                    <td className={`${styles.td} ${styles.actions}`}>
                                        <button
                                            className={styles.deleteBtn}
                                            onClick={(e) => { e.stopPropagation(); handleDelete(r.id); }}
                                            title="Delete Report"
                                        >
                                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <path d="M18 6L6 18M6 6l12 12" />
                                            </svg>
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
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
