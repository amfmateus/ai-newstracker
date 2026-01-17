'use client';

import { useState } from 'react';
import { Source } from '../lib/api';
import CalendarFilter from './CalendarFilter';
import { fetchAutocompleteSearch, fetchAutocompleteTags, fetchAutocompleteEntities } from '../lib/api';
import styles from './NewsFilterSidebar.module.css';

interface NewsFilterSidebarProps {
    mode: 'articles' | 'stories';
    sources: Source[];
    selectedSourceIds: string[];
    onSourceChange: (ids: string[]) => void;

    dateType: 'published' | 'scraped';
    onDateTypeChange: (type: 'published' | 'scraped') => void;

    startDate: string | undefined;
    endDate: string | undefined;
    onDateRangeChange: (start: string | undefined, end: string | undefined) => void;

    // Optional Article-specific filter
    storyStatus?: 'all' | 'orphaned' | 'connected';
    onStoryStatusChange?: (status: 'all' | 'orphaned' | 'connected') => void;

    // Unified filters
    search: string;
    onSearchChange: (val: string) => void;

    sentiment: string | undefined;
    onSentimentChange: (val: string | undefined) => void;

    selectedTags: string[];
    onTagsChange: (tags: string[]) => void;

    selectedEntities: string[];
    onEntitiesChange: (ents: string[]) => void;

    // Quality controls
    minStrength?: number; // for stories
    onMinStrengthChange?: (val: number | undefined) => void;

    minRelevance?: number; // for articles
    onMinRelevanceChange?: (val: number | undefined) => void;

    children?: React.ReactNode;
}

export default function NewsFilterSidebar({
    mode,
    sources,
    selectedSourceIds,
    onSourceChange,
    dateType,
    onDateTypeChange,
    startDate,
    endDate,
    onDateRangeChange,
    storyStatus,
    onStoryStatusChange,
    search,
    onSearchChange,
    sentiment,
    onSentimentChange,
    selectedTags,
    onTagsChange,
    selectedEntities,
    onEntitiesChange,
    minStrength,
    onMinStrengthChange,
    minRelevance,
    onMinRelevanceChange,
    children
}: NewsFilterSidebarProps) {
    const [sourceSearch, setSourceSearch] = useState('');
    const [newSourceInterval, setNewSourceInterval] = useState(60);
    const [newSourceCrawlMethod, setNewSourceCrawlMethod] = useState<'auto' | 'pdf'>('auto');
    const [tagInput, setTagInput] = useState('');
    const [entityInput, setEntityInput] = useState('');

    // Date Preset state
    const [activePreset, setActivePreset] = useState<number | 'yesterday' | null>(null);

    // Autocomplete states
    const [suggestions, setSuggestions] = useState<string[]>([]);
    const [activeInput, setActiveInput] = useState<'search' | 'tag' | 'entity' | null>(null);

    const handleFetchAutocomplete = async (type: 'search' | 'tag' | 'entity', val: string) => {
        if (val.length < 2) {
            setSuggestions([]);
            return;
        }
        try {
            let results: string[] = [];
            if (type === 'search') results = await fetchAutocompleteSearch(val);
            else if (type === 'tag') results = await fetchAutocompleteTags(val);
            else if (type === 'entity') results = await fetchAutocompleteEntities(val);
            setSuggestions(results);
        } catch (e) {
            console.error(e);
        }
    };

    const handleSelectSuggestion = (val: string) => {
        if (activeInput === 'search') {
            onSearchChange(val);
        } else if (activeInput === 'tag') {
            if (!selectedTags.includes(val)) {
                onTagsChange([...selectedTags, val]);
            }
            setTagInput('');
        } else if (activeInput === 'entity') {
            if (!selectedEntities.includes(val)) {
                onEntitiesChange([...selectedEntities, val]);
            }
            setEntityInput('');
        }
        setSuggestions([]);
        setActiveInput(null);
    };

    // Sort Sources A-Z
    const sortedSources = [...sources].sort((a, b) => (a.name || a.url).localeCompare(b.name || b.url));
    const filteredSources = sortedSources.filter(s =>
        (s.name || s.url || '').toLowerCase().includes(sourceSearch.toLowerCase())
    );

    const handleSourceToggle = (id: string) => {
        if (selectedSourceIds.includes(id)) {
            onSourceChange(selectedSourceIds.filter(sid => sid !== id));
        } else {
            onSourceChange([...selectedSourceIds, id]);
        }
    };

    const applyDatePreset = (preset: number | 'yesterday' | null) => {
        const end = new Date();
        const start = new Date();

        if (preset === null) {
            onDateRangeChange(undefined, undefined);
            setActivePreset(null);
            return;
        }

        if (preset === 1) { // Last 24h (Rolling)
            start.setHours(start.getHours() - 24);
            onDateRangeChange(start.toISOString(), end.toISOString());
            setActivePreset(1);
        } else if (preset === 'yesterday') { // Full day yesterday
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            yesterday.setHours(0, 0, 0, 0);
            const endYesterday = new Date(yesterday);
            endYesterday.setHours(23, 59, 59, 999);
            onDateRangeChange(yesterday.toISOString(), endYesterday.toISOString());
            setActivePreset('yesterday');
        } else { // 7d, 30d
            start.setDate(start.getDate() - (preset as number));
            onDateRangeChange(start.toISOString(), end.toISOString());
            setActivePreset(preset as number);
        }
    };

    const handleAddTag = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && tagInput.trim()) {
            if (!selectedTags.includes(tagInput.trim())) {
                onTagsChange([...selectedTags, tagInput.trim()]);
            }
            setTagInput('');
        }
    };

    const handleAddEntity = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && entityInput.trim()) {
            if (!selectedEntities.includes(entityInput.trim())) {
                onEntitiesChange([...selectedEntities, entityInput.trim()]);
            }
            setEntityInput('');
        }
    };

    const formatDateDisplay = (isoString?: string) => {
        if (!isoString) return '';
        return isoString.split('T')[0];
    };

    const hasActiveFilters =
        selectedSourceIds.length > 0 ||
        !!startDate ||
        !!endDate ||
        (mode === 'articles' && storyStatus !== 'all') ||
        !!search ||
        !!sentiment ||
        selectedTags.length > 0 ||
        selectedEntities.length > 0 ||
        (mode === 'stories' && minStrength !== undefined) ||
        (mode === 'articles' && minRelevance !== undefined);

    const clearAll = () => {
        onSourceChange([]);
        onDateRangeChange(undefined, undefined);
        setActivePreset(null);
        onSearchChange('');
        onSentimentChange(undefined);
        onTagsChange([]);
        onEntitiesChange([]);
        if (onStoryStatusChange) onStoryStatusChange('all');
        if (onMinStrengthChange) onMinStrengthChange(undefined);
        if (onMinRelevanceChange) onMinRelevanceChange(undefined);
    };

    return (
        <aside className={styles.sidebar}>
            <div className={styles.filterCard}>
                {children && <div className={styles.topActions}>{children}</div>}

                <div className={styles.scrollArea}>
                    <div className={styles.sidebarHeader}>
                        <h2 className={styles.mainHeader}>Filters</h2>
                        {hasActiveFilters && (
                            <span className={styles.clearAllLink} onClick={clearAll}>Clear All</span>
                        )}
                    </div>

                    {/* 1. SOURCES SECTION (PUBLISHERS) */}
                    <div className={styles.section} style={{ borderBottom: '1px solid #f1f5f9', paddingBottom: '1rem' }}>
                        <div className={styles.sectionTitle}>Publishers</div>
                        <input
                            type="text"
                            placeholder="Filter sources..."
                            className={styles.searchInput}
                            value={sourceSearch}
                            onChange={e => setSourceSearch(e.target.value)}
                        />
                        <div className={styles.sourceScroll}>
                            {filteredSources.map(s => (
                                <label key={s.id} className={styles.sourceLabel}>
                                    <input
                                        type="checkbox"
                                        checked={selectedSourceIds.includes(s.id)}
                                        onChange={() => handleSourceToggle(s.id)}
                                    />
                                    <span>{s.name || s.url}</span>
                                </label>
                            ))}
                        </div>
                    </div>

                    {/* 2. DATE FILTER */}
                    <div className={styles.section}>
                        <div className={styles.sectionTitle}>Time Window</div>
                        <div className={styles.presetsGrid}>
                            <button
                                className={`${styles.presetBtn} ${activePreset === 1 ? styles.presetActive : ''}`}
                                onClick={() => applyDatePreset(1)}
                            >24h</button>
                            <button
                                className={`${styles.presetBtn} ${activePreset === 'yesterday' ? styles.presetActive : ''}`}
                                onClick={() => applyDatePreset('yesterday')}
                            >Yesterday</button>
                            <button
                                className={`${styles.presetBtn} ${activePreset === 7 ? styles.presetActive : ''}`}
                                onClick={() => applyDatePreset(7)}
                            >7d</button>
                            <button
                                className={`${styles.presetBtn} ${activePreset === 30 ? styles.presetActive : ''}`}
                                onClick={() => applyDatePreset(30)}
                            >30d</button>
                        </div>
                        <CalendarFilter
                            startDate={startDate}
                            endDate={endDate}
                            onChange={(start, end) => {
                                onDateRangeChange(start, end);
                                setActivePreset(null); // Clear preset on manual calendar selection
                            }}
                        />
                    </div>

                    {/* 3. THEMES (TAGS) */}
                    <div className={styles.section}>
                        <div className={styles.sectionTitle}>Themes</div>
                        <div className={styles.autocompleteWrapper}>
                            <input
                                type="text"
                                placeholder="Add theme..."
                                className={styles.miniInput}
                                value={tagInput}
                                onChange={e => {
                                    setTagInput(e.target.value);
                                    setActiveInput('tag');
                                    handleFetchAutocomplete('tag', e.target.value);
                                }}
                                onKeyDown={handleAddTag}
                                onBlur={() => setTimeout(() => setActiveInput(null), 200)}
                            />
                            {activeInput === 'tag' && suggestions.length > 0 && (
                                <div className={styles.suggestionsDropdown}>
                                    {suggestions.map(s => (
                                        <div key={s} className={styles.suggestionItem} onClick={() => handleSelectSuggestion(s)}>
                                            {s}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                        {selectedTags.length > 0 && (
                            <div className={styles.tagCloud}>
                                {selectedTags.map(t => (
                                    <span key={t} className={styles.tagChip}>
                                        {t} <button onClick={() => onTagsChange(selectedTags.filter(st => st !== t))}>×</button>
                                    </span>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* 4. ENTITIES */}
                    <div className={styles.section}>
                        <div className={styles.sectionTitle}>Entities</div>
                        <div className={styles.autocompleteWrapper}>
                            <input
                                type="text"
                                placeholder="Add entity..."
                                className={styles.miniInput}
                                value={entityInput}
                                onChange={e => {
                                    setEntityInput(e.target.value);
                                    setActiveInput('entity');
                                    handleFetchAutocomplete('entity', e.target.value);
                                }}
                                onKeyDown={handleAddEntity}
                                onBlur={() => setTimeout(() => setActiveInput(null), 200)}
                            />
                            {activeInput === 'entity' && suggestions.length > 0 && (
                                <div className={styles.suggestionsDropdown}>
                                    {suggestions.map(s => (
                                        <div key={s} className={styles.suggestionItem} onClick={() => handleSelectSuggestion(s)}>
                                            {s}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                        {selectedEntities.length > 0 && (
                            <div className={styles.tagCloud}>
                                {selectedEntities.map(ent => (
                                    <span key={ent} className={styles.entityChip}>
                                        {ent} <button onClick={() => onEntitiesChange(selectedEntities.filter(se => se !== ent))}>×</button>
                                    </span>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* 5. SENTIMENT SECTION */}
                    <div className={styles.section}>
                        <div className={styles.sectionTitle}>Sentiment</div>
                        <div className={styles.sentimentGrid}>
                            {['positive', 'neutral', 'negative'].map(s => (
                                <button
                                    key={s}
                                    className={`${styles.sentimentBtn} ${sentiment === s ? styles.sentActive : ''} ${styles['sent_' + s]}`}
                                    onClick={() => onSentimentChange(sentiment === s ? undefined : s)}
                                >
                                    {s.charAt(0).toUpperCase() + s.slice(1)}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* 6. GLOBAL SEARCH */}
                    <div className={styles.section}>
                        <div className={styles.sectionTitle}>Global Search</div>
                        <div className={styles.autocompleteWrapper}>
                            <input
                                type="text"
                                placeholder="Keywords, headlines..."
                                className={styles.searchInput}
                                value={search}
                                onChange={e => {
                                    onSearchChange(e.target.value);
                                    setActiveInput('search');
                                    handleFetchAutocomplete('search', e.target.value);
                                }}
                                onBlur={() => setTimeout(() => setActiveInput(null), 200)}
                            />
                            {activeInput === 'search' && suggestions.length > 0 && (
                                <div className={styles.suggestionsDropdown}>
                                    {suggestions.map(s => (
                                        <div key={s} className={styles.suggestionItem} onClick={() => handleSelectSuggestion(s)}>
                                            {s}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* 7. AI RELEVANCE / STRENGTH */}
                    <div className={styles.section} style={{ borderBottom: 'none' }}>
                        <div className={styles.sectionTitle}>
                            {mode === 'stories' ? 'Story Strength' : 'AI Relevance'}
                        </div>
                        {mode === 'stories' ? (
                            <div className={styles.rangeControl}>
                                <input
                                    type="range" min="1" max="50" step="1"
                                    value={minStrength || 1}
                                    onChange={e => onMinStrengthChange?.(parseInt(e.target.value))}
                                    className={styles.slider}
                                />
                                <span className={styles.rangeVal}>{minStrength || 1}+ Articles</span>
                            </div>
                        ) : (
                            <div className={styles.rangeControl}>
                                <input
                                    type="range" min="0" max="100" step="10"
                                    value={minRelevance || 0}
                                    onChange={e => onMinRelevanceChange?.(parseInt(e.target.value))}
                                    className={styles.slider}
                                />
                                <span className={styles.rangeVal}>{minRelevance || 0}%+ Score</span>
                            </div>
                        )}
                    </div>

                </div>
            </div>
        </aside>
    );
}
