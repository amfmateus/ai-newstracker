'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useSession } from 'next-auth/react';
import { fetchStories, generateStories, fetchClusteringStatus, Story, Article, Source, fetchSources, fetchSettings, SystemSettings } from '../lib/api';
import StoryCard from '../components/StoryCard';
import StoryDrawer from '../components/StoryDrawer';
import NewsFilterSidebar from '../components/NewsFilterSidebar';
import AlertModal, { AlertType } from '../components/AlertModal';
import CalendarFilter from '../components/CalendarFilter';
import styles from './page.module.css';
import pageStyles from '../feed/page.module.css'; // Borrowing layout styles

export default function StoriesPage() {
    const { status } = useSession();
    const [stories, setStories] = useState<Story[]>([]);
    const [totalCount, setTotalCount] = useState(0);
    const [sources, setSources] = useState<Source[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [generating, setGenerating] = useState(false);
    const [clusteringEventId, setClusteringEventId] = useState<string | null>(null);
    const [clusteringStatus, setClusteringStatus] = useState<any>(null);
    const [settings, setSettings] = useState<SystemSettings | null>(null);
    const [error, setError] = useState('');
    const [alertState, setAlertState] = useState<{ isOpen: boolean; message: string; type: AlertType }>({
        isOpen: false,
        message: '',
        type: 'info'
    });

    // Pagination/Filters
    const skipRef = React.useRef(0);
    const LIMIT = 20;
    const [hasMore, setHasMore] = useState(true);

    const [sortBy, setSortBy] = useState('updated_at');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
    const [startDate, setStartDate] = useState<string | undefined>(undefined);
    const [endDate, setEndDate] = useState<string | undefined>(undefined);
    const [minStrength, setMinStrength] = useState<number | undefined>(undefined);
    const [sentiment, setSentiment] = useState<string | undefined>(undefined);
    const [search, setSearch] = useState('');
    const [selectedTags, setSelectedTags] = useState<string[]>([]);
    const [selectedEntities, setSelectedEntities] = useState<string[]>([]);
    const [selectedSourceIds, setSelectedSourceIds] = useState<string[]>([]);

    // View State
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
    const [selectedStoryId, setSelectedStoryId] = useState<string | null>(null);

    // Language State
    const [showEnglish, setShowEnglish] = useState(true);

    const loadData = useCallback(async (isLoadMore = false) => {
        const currentSkip = isLoadMore ? skipRef.current : 0;

        if (isLoadMore) setLoadingMore(true);
        else {
            setLoading(true);
            skipRef.current = 0;
        }

        try {
            const results = await Promise.all([
                fetchStories(
                    currentSkip,
                    LIMIT,
                    minStrength,
                    startDate,
                    endDate,
                    sortBy,
                    sortOrder,
                    sentiment,
                    search,
                    selectedTags,
                    selectedEntities,
                    selectedSourceIds
                ),
                !isLoadMore ? fetchSources() : Promise.resolve(null),
                !isLoadMore ? fetchSettings() : Promise.resolve(null)
            ]);

            const storiesData = results[0];
            const sourcesData = results[1];
            const settingsData = results[2];

            if (storiesData) {
                if (isLoadMore) {
                    setStories(prev => [...prev, ...storiesData.items]);
                } else {
                    setStories(storiesData.items);
                }
                setTotalCount(storiesData.total);
                setHasMore(currentSkip + storiesData.items.length < storiesData.total);
                skipRef.current = currentSkip + LIMIT;
            }
            if (sourcesData) setSources(sourcesData);
            if (settingsData) {
                setSettings(settingsData);
                // Initialize minStrength if not set
                if (minStrength === undefined) {
                    setMinStrength(settingsData.min_story_strength);
                }
            }
            setError('');
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
            setLoadingMore(false);
        }
    }, [minStrength, startDate, endDate, sortBy, sortOrder, sentiment, search, selectedTags, selectedEntities, selectedSourceIds]);

    // Initial Load & Filter Changes
    useEffect(() => {
        loadData();
    }, [loadData]);

    // Polling Effect
    useEffect(() => {
        let pollTimer: NodeJS.Timeout;
        if (clusteringEventId) {
            const poll = async () => {
                try {
                    const status = await fetchClusteringStatus(clusteringEventId);
                    setClusteringStatus(status);

                    if (status.status === 'completed' || status.status === 'error') {
                        setClusteringEventId(null);
                        setGenerating(false);
                        // Refresh grid if done
                        if (status.status === 'completed') {
                            loadData(false);
                        }
                    } else {
                        // Continue polling
                        pollTimer = setTimeout(poll, 2000);
                    }
                } catch (e) {
                    console.error("Poll failed", e);
                    setGenerating(false);
                    setClusteringEventId(null); // Stop polling on net error
                }
            };
            poll();
        }
        return () => clearTimeout(pollTimer);
    }, [clusteringEventId, loadData]);

    // Re-writing handleGenerate to use new flow
    const handleGenerate = async () => {
        setGenerating(true);
        setClusteringStatus(null);
        try {
            const res = await generateStories();
            if (res.event_id) {
                setClusteringEventId(res.event_id);
                // Start polling
            } else {
                // Fallback for sync return if backend wasn't fully async-ready (though we made it so)
                await loadData(false);
                setGenerating(false);
            }
        } catch (err: any) {
            setAlertState({ isOpen: true, message: `Analysis Failed: ${err.message}`, type: 'error' });
            setGenerating(false);
        }
    };

    const formatRelativeTime = (isoString?: string) => {
        if (!isoString) return 'Never';
        const date = new Date(isoString);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        const diffHours = Math.floor(diffMins / 60);
        if (diffHours < 24) return `${diffHours}h ago`;
        return date.toLocaleDateString();
    };

    return (
        <div className={pageStyles.container}>
            <div className={pageStyles.layout}>
                <NewsFilterSidebar
                    mode="stories"
                    sources={sources}
                    selectedSourceIds={selectedSourceIds}
                    onSourceChange={setSelectedSourceIds}
                    dateType="published"
                    onDateTypeChange={() => { }} // No-op for stories
                    startDate={startDate}
                    endDate={endDate}
                    onDateRangeChange={(start, end) => {
                        setStartDate(start);
                        setEndDate(end);
                    }}
                    search={search}
                    onSearchChange={setSearch}
                    sentiment={sentiment}
                    onSentimentChange={setSentiment}
                    selectedTags={selectedTags}
                    onTagsChange={setSelectedTags}
                    selectedEntities={selectedEntities}
                    onEntitiesChange={setSelectedEntities}
                    minStrength={minStrength}
                    onMinStrengthChange={setMinStrength}
                >
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                        <button
                            className={styles.btnGenerate}
                            onClick={handleGenerate}
                            disabled={generating}
                        >
                            {generating ? '⌛ Analyzing...' : '⚡ Generate Stories Now'}
                        </button>
                        {settings?.last_clustering_at && (
                            <span style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 500 }}>
                                Last generated {formatRelativeTime(settings.last_clustering_at)}
                            </span>
                        )}
                    </div>
                </NewsFilterSidebar>

                {/* MAIN CONTENT */}
                <main className={pageStyles.mainContent}>
                    {/* STICKY HEADER WRAPPER */}
                    <div className={styles.resultsHeaderWrapper}>
                        <div className={pageStyles.resultsHeader}>
                            <div className={pageStyles.resultCount}>
                                {loading && !loadingMore ? 'Analyzing...' : (
                                    <span>
                                        Showing <strong>{stories.length}</strong> of <strong>{totalCount}</strong> story clusters
                                    </span>
                                )}
                            </div>

                            <div className={pageStyles.sortControls}>
                                {/* Global Language Toggle */}
                                <div className={pageStyles.globalLangToggle}>
                                    <button
                                        className={`${pageStyles.langBtn} ${!showEnglish ? pageStyles.active : ''}`}
                                        onClick={() => setShowEnglish(false)}
                                        title="Original Language"
                                    >
                                        ORIGINAL
                                    </button>
                                    <button
                                        className={`${pageStyles.langBtn} ${showEnglish ? pageStyles.active : ''}`}
                                        onClick={() => setShowEnglish(true)}
                                        title="Force English (AI Translation)"
                                    >
                                        ENGLISH
                                    </button>
                                </div>

                                <div className={pageStyles.divider} />

                                <label className={pageStyles.sortLabel}>Sort by:</label>
                                <select
                                    className={pageStyles.sortSelect}
                                    value={`${sortBy}-${sortOrder}`}
                                    onChange={(e) => {
                                        const [field, order] = e.target.value.split('-');
                                        setSortBy(field);
                                        setSortOrder(order as any);
                                    }}
                                >
                                    <option value="updated_at-desc">Newest First</option>
                                    <option value="updated_at-asc">Oldest First</option>
                                    <option value="strength-desc">Highest Strength</option>
                                </select>

                                <div className={pageStyles.viewToggles}>
                                    <button
                                        className={`${pageStyles.toggleBtn} ${viewMode === 'grid' ? pageStyles.active : ''}`}
                                        onClick={() => setViewMode('grid')}
                                    >
                                        ⊞ Grid
                                    </button>
                                    <button
                                        className={`${pageStyles.toggleBtn} ${viewMode === 'list' ? pageStyles.active : ''}`}
                                        onClick={() => setViewMode('list')}
                                    >
                                        ≣ List
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    {error && <div className={pageStyles.error}>{error}</div>}

                    <div className={viewMode === 'grid' ? styles.grid : styles.list}>
                        {stories.map(story => (
                            <StoryCard
                                key={story.id}
                                story={story}
                                onClick={setSelectedStoryId}
                            />
                        ))}
                    </div>

                    {hasMore && (
                        <div style={{ display: 'flex', justifyContent: 'center', margin: '2rem 0' }}>
                            <button
                                onClick={() => loadData(true)}
                                disabled={loadingMore}
                                className={pageStyles.loadMoreButton}
                            >
                                {loadingMore ? 'Loading...' : 'Load More Stories'}
                            </button>
                        </div>
                    )}

                    {!loading && stories.length === 0 && (
                        <div style={{ textAlign: 'center', padding: '4rem', color: '#6b7280' }}>
                            <h3>No clusters found</h3>
                            <p>Try adjusting your search filters or run "Analyze New Articles".</p>
                        </div>
                    )}
                </main>
            </div>

            <StoryDrawer
                storyId={selectedStoryId}
                onClose={() => setSelectedStoryId(null)}
                onDeleteArticle={() => loadData(false)}
                showEnglish={showEnglish}
            />

            {/* Clustering Status Pane */}
            {(clusteringStatus || generating) && (
                <div className={styles.clusteringPane}>
                    {(!clusteringStatus || clusteringStatus.status === 'queued' || clusteringStatus.status === 'running') && (
                        <div className={styles.clusteringProgress}>
                            <div className={styles.spinner}>∞</div>
                            <div className={styles.statusText}>
                                <strong>AI Editor at Work</strong>
                                <span>Analyzing {clusteringStatus?.input_articles || 'incoming'} articles against {clusteringStatus?.input_stories || 'recent'} stories...</span>
                            </div>
                        </div>
                    )}

                    {clusteringStatus?.status === 'completed' && (
                        <div className={styles.clusteringReport}>
                            <div className={styles.reportHeader}>
                                <h3>Clustering Completed</h3>
                                <button onClick={() => { setClusteringStatus(null); setClusteringEventId(null); loadData(false); }}>Dismiss</button>
                            </div>
                            <div className={styles.statsGrid}>
                                <div className={styles.statItem}>
                                    <label>New Stories</label>
                                    <span>{clusteringStatus.new_stories}</span>
                                </div>
                                <div className={styles.statItem}>
                                    <label>Assignments</label>
                                    <span>{clusteringStatus.assignments}</span>
                                </div>
                                <div className={styles.statItem}>
                                    <label>Unclustered</label>
                                    <span>{clusteringStatus.unclustered}</span>
                                </div>
                            </div>
                        </div>
                    )}
                    {clusteringStatus?.status === 'error' && (
                        <div className={styles.clusteringReport} style={{ borderColor: 'red' }}>
                            <h3>Error</h3>
                            <p>{clusteringStatus.error}</p>
                            <button onClick={() => { setClusteringStatus(null); setClusteringEventId(null); }}>Dismiss</button>
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
