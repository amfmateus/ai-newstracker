'use client';

import React, { useEffect, useState, useCallback } from 'react';
import {
  Article, Source, fetchArticles, fetchSources, deleteArticle, fetchSettings, SystemSettings,
  createSourceConfig
} from '../lib/api';
import NewsGrid from '../components/NewsGrid';
import NewsFilterSidebar from '../components/NewsFilterSidebar';
import StoryDrawer from '../components/StoryDrawer';
import styles from './page.module.css';
import AlertModal, { AlertType } from '../components/AlertModal';
import { useRouter } from 'next/navigation';

export default function Home() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [sources, setSources] = useState<Source[]>([]);
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Alert Modal State
  const [alertState, setAlertState] = useState<{ isOpen: boolean; message: string; type: AlertType }>({
    isOpen: false,
    message: '',
    type: 'info'
  });

  // Refs for tracking state without triggering re-renders/dependency cycles
  const articlesRef = React.useRef<Article[]>([]);

  // Pagination State
  const [hasMore, setHasMore] = useState(true);
  const LIMIT = 50;

  // Filter State
  const [selectedSourceIds, setSelectedSourceIds] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<'published_at' | 'scraped_at' | 'source'>('published_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  // Date Filters
  const [dateType, setDateType] = useState<'published' | 'scraped'>('published');
  const [startDate, setStartDate] = useState<string | undefined>(undefined);
  const [endDate, setEndDate] = useState<string | undefined>(undefined);
  // Story Filter
  const [storyStatus, setStoryStatus] = useState<'all' | 'orphaned' | 'connected'>('all');
  const [search, setSearch] = useState('');
  const [sentiment, setSentiment] = useState<string | undefined>(undefined);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedEntities, setSelectedEntities] = useState<string[]>([]);
  const [minRelevance, setMinRelevance] = useState<number | undefined>(undefined);

  // View State
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [selectedStoryId, setSelectedStoryId] = useState<string | null>(null);
  const router = useRouter();

  // Language State
  const [showEnglish, setShowEnglish] = useState(true);

  // Template Modal State
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [templateDescription, setTemplateDescription] = useState('');
  const [savingTemplate, setSavingTemplate] = useState(false);

  // Sync ref
  useEffect(() => {
    articlesRef.current = articles;
  }, [articles]);

  // Helper to map current date state to pipeline config format
  const filterDate = (start?: string, end?: string) => {
    if (!start) return {};
    // Simple heuristic for "quick filters" vs absolute dates
    // If end date is today/now, check difference
    const s = new Date(start);
    const e = end ? new Date(end) : new Date();
    const diffHours = (e.getTime() - s.getTime()) / (1000 * 3600);

    if (diffHours >= 23 && diffHours <= 25) return { filter_date: "24h" };
    if (diffHours >= 47 && diffHours <= 49) return { filter_date: "48h" };
    if (diffHours >= 167 && diffHours <= 169) return { filter_date: "7d" };
    if (diffHours >= 719 && diffHours <= 721) return { filter_date: "30d" };

    return { start_date: start, end_date: end };
  };

  // Reset pagination when filters change
  useEffect(() => {
    setHasMore(true);
    setArticles([]);
  }, [selectedSourceIds, sortBy, sortOrder, startDate, endDate, dateType, storyStatus, search, sentiment, selectedTags, selectedEntities, minRelevance]);

  const loadData = useCallback(async (isLoadMore = false) => {
    // Read length from ref to avoid dependency on 'articles'
    const currentSkip = isLoadMore ? articlesRef.current.length : 0;

    if (isLoadMore) setLoadingMore(true);
    else setLoading(true);

    try {
      const sourcesPromise = !isLoadMore ? fetchSources() : Promise.resolve(null);
      const settingsPromise = !isLoadMore ? fetchSettings() : Promise.resolve(null);

      const [response, sourcesData, settingsData] = await Promise.all([
        fetchArticles(
          currentSkip,
          LIMIT,
          selectedSourceIds,
          startDate || null,
          endDate || null,
          dateType,
          storyStatus,
          sortBy,
          sortOrder,
          search,
          sentiment,
          selectedTags,
          selectedEntities,
          minRelevance
        ),
        sourcesPromise,
        settingsPromise
      ]);

      if (sourcesData) setSources(sourcesData);
      if (settingsData) {
        setSettings(settingsData);
        if (minRelevance === undefined) {
          setMinRelevance(settingsData.min_relevance_score);
        }
      }

      // response is { items, total }
      const newArticles = response.items;
      setTotalCount(response.total);

      if (isLoadMore) {
        setArticles(prev => [...prev, ...newArticles]);
      } else {
        setArticles(newArticles);
      }

      setHasMore(articlesRef.current.length + newArticles.length < response.total);

    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [selectedSourceIds, sortBy, sortOrder, startDate, endDate, dateType, storyStatus, search, sentiment, selectedTags, selectedEntities, minRelevance]);

  const handleDeleteArticle = async (id: string) => {
    // Optimistic update
    const previousArticles = articles;
    setArticles(articles.filter(a => a.id !== id));
    setTotalCount(prev => prev - 1); // Optimistically reduce count

    try {
      await deleteArticle(id);
    } catch (e) {
      // Revert on failure
      console.error("Delete failed, reverting UI");
      setArticles(previousArticles);
      setTotalCount(prev => prev + 1);
      setAlertState({ isOpen: true, message: "Failed to delete article", type: 'error' });
    }
  };


  useEffect(() => {
    // Initial load
    setArticles([]);
    setHasMore(true);
    loadData(false);
  }, [loadData]);

  return (
    <div className={styles.container}>

      <div className={styles.layout}>
        {/* LEFT SIDEBAR */}
        <NewsFilterSidebar
          sources={sources}
          selectedSourceIds={selectedSourceIds}
          onSourceChange={setSelectedSourceIds}
          dateType={dateType}
          onDateTypeChange={setDateType}
          startDate={startDate}
          endDate={endDate}
          onDateRangeChange={(start, end) => {
            setStartDate(start);
            setEndDate(end);
          }}
          storyStatus={storyStatus}
          onStoryStatusChange={setStoryStatus}
          search={search}
          onSearchChange={setSearch}
          sentiment={sentiment}
          onSentimentChange={setSentiment}
          selectedTags={selectedTags}
          onTagsChange={setSelectedTags}
          selectedEntities={selectedEntities}
          onEntitiesChange={setSelectedEntities}
          minRelevance={minRelevance}
          onMinRelevanceChange={setMinRelevance}
          mode="articles"
        />

        {/* MAIN CONTENT */}
        <main className={styles.mainContent}>

          {/* STICKY HEADER WRAPPER */}
          <div className={styles.resultsHeaderWrapper}>
            <div className={styles.resultsHeader}>
              <div className={styles.resultCount}>
                {loading && !loadingMore ? 'Searching...' : (
                  <span>
                    Showing <strong>{articles.length}</strong> of <strong>{totalCount}</strong> news articles
                  </span>
                )}
              </div>

              <div className={styles.headerActions}>
                <button
                  className={styles.secondaryButton}
                  style={{
                    marginLeft: '0.5rem',
                    padding: '0.5rem 0.75rem',
                    background: '#fff',
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    color: '#475569',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                  }}
                  onClick={() => setIsTemplateModalOpen(true)}
                  title="Save current filters as a named template for Pipelines"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
                    <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
                  </svg>
                  Save Template
                </button>
              </div>

              <div className={styles.sortControls}>
                {/* Global Language Toggle */}
                <div className={styles.globalLangToggle}>
                  <button
                    className={`${styles.langBtn} ${!showEnglish ? styles.active : ''}`}
                    onClick={() => setShowEnglish(false)}
                    title="Original Language"
                  >
                    ORIGINAL
                  </button>
                  <button
                    className={`${styles.langBtn} ${showEnglish ? styles.active : ''}`}
                    onClick={() => setShowEnglish(true)}
                    title="Force English (AI Translation)"
                  >
                    ENGLISH
                  </button>
                </div>

                <div className={styles.divider} />

                <label className={styles.sortLabel}>Sort by:</label>
                <select
                  className={styles.sortSelect}
                  value={`${sortBy}-${sortOrder}`}
                  onChange={(e) => {
                    const [field, order] = e.target.value.split('-');
                    setSortBy(field as any);
                    setSortOrder(order as any);
                  }}
                >
                  <option value="published_at-desc">Newest Published</option>
                  <option value="published_at-asc">Oldest Published</option>
                  <option value="scraped_at-desc">Newest Retrieved</option>
                  <option value="source-asc">Source (A-Z)</option>
                </select>

                <div className={styles.viewToggles}>
                  <button
                    className={`${styles.toggleBtn} ${viewMode === 'grid' ? styles.active : ''}`}
                    onClick={() => setViewMode('grid')}
                    title="Grid View"
                  >
                    ⊞ Grid
                  </button>
                  <button
                    className={`${styles.toggleBtn} ${viewMode === 'list' ? styles.active : ''}`}
                    onClick={() => setViewMode('list')}
                    title="List View"
                  >
                    ≣ List
                  </button>
                </div>
              </div>
            </div>
          </div>

          {loading && articles.length === 0 && <p style={{ padding: '2rem' }}>Loading news...</p>}
          {error && <p className={styles.error}>Error: {error}</p>}

          {articles.length > 0 && (
            <>
              <NewsGrid
                articles={articles}
                groupBy={sortBy}
                viewMode={viewMode}
                onViewModeChange={setViewMode}
                onDelete={handleDeleteArticle}
                onStoryClick={setSelectedStoryId}
                showEnglish={showEnglish}
              />

              <StoryDrawer
                storyId={selectedStoryId}
                onClose={() => setSelectedStoryId(null)}
                onDeleteArticle={handleDeleteArticle}
                showEnglish={showEnglish}
              />


              {hasMore && (
                <div style={{ display: 'flex', justifyContent: 'center', margin: '2rem 0' }}>
                  <button
                    onClick={() => loadData(true)}
                    disabled={loadingMore}
                    className={styles.loadMoreButton}
                  >
                    {loadingMore ? 'Loading...' : 'Load More Articles'}
                  </button>
                </div>
              )}
            </>
          )}

          {!loading && articles.length === 0 && !error && (
            <div style={{ textAlign: 'center', padding: '4rem', color: '#6b7280' }}>
              <h3>No results found</h3>
              <p>Try adjusting your filters or search keywords.</p>
            </div>
          )}
        </main>
      </div>

      <AlertModal
        isOpen={alertState.isOpen}
        message={alertState.message}
        type={alertState.type}
        onClose={() => setAlertState(prev => ({ ...prev, isOpen: false }))}
      />

      {/* Save Template Modal */}
      {isTemplateModalOpen && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal} style={{ maxWidth: '450px' }}>
            <div className={styles.modalHeader}>
              <h2>Save Filter Template</h2>
              <button onClick={() => setIsTemplateModalOpen(false)}>&times;</button>
            </div>
            <div className={styles.modalBody}>
              <p style={{ color: '#64748b', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
                Give this filter configuration a name so you can easily reuse it in your Pipelines.
              </p>
              <div className={styles.formGroup}>
                <label>Template Name</label>
                <input
                  type="text"
                  value={templateName}
                  onChange={e => setTemplateName(e.target.value)}
                  placeholder="e.g., Tech Trade Weekly"
                />
              </div>
              <div className={styles.formGroup}>
                <label>Description (Optional)</label>
                <input
                  type="text"
                  value={templateDescription}
                  onChange={e => setTemplateDescription(e.target.value)}
                  placeholder="Briefly describe what this filter captures"
                />
              </div>
            </div>
            <div className={styles.modalFooter}>
              <button className={styles.btnCancel} onClick={() => setIsTemplateModalOpen(false)}>Cancel</button>
              <button
                className={styles.btnSave}
                disabled={!templateName.trim() || savingTemplate}
                onClick={async () => {
                  setSavingTemplate(true);
                  try {
                    const config = {
                      ...(search ? { search } : {}),
                      ...(filterDate(startDate, endDate)),
                      ...(selectedSourceIds.length > 0 ? { source_ids: selectedSourceIds } : {}),
                      ...(storyStatus !== 'all' ? { story_status: storyStatus } : {}),
                      ...(minRelevance ? { min_relevance: minRelevance } : {}),
                      ...(sentiment ? { sentiment } : {}),
                      ...(selectedTags.length > 0 ? { tags: selectedTags } : {}),
                      ...(selectedEntities.length > 0 ? { entities: selectedEntities } : {}),
                      sort: sortBy === 'published_at' ? 'published_at' : 'relevance'
                    };
                    await createSourceConfig({
                      name: templateName,
                      description: templateDescription,
                      config: config
                    });
                    setIsTemplateModalOpen(false);
                    setTemplateName('');
                    setTemplateDescription('');
                    setAlertState({ isOpen: true, message: `Template "${templateName}" saved successfully!`, type: 'success' });
                  } catch (err: any) {
                    setAlertState({ isOpen: true, message: `Failed to save template: ${err.message}`, type: 'error' });
                  } finally {
                    setSavingTemplate(false);
                  }
                }}
              >
                {savingTemplate ? 'Saving...' : 'Save Template'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div >
  );
}
