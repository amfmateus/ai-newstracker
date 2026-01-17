import { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Article, Story, fetchStory } from '../lib/api';
import styles from './StoryDrawer.module.css';
import ArticleCard from './ArticleCard';
import ArticleDrawer from './ArticleDrawer';
import { formatDate } from '../lib/dateUtils';

interface StoryDrawerProps {
    storyId: string | null;
    onClose: () => void;
    onDeleteArticle: (id: string) => void;
    showEnglish?: boolean;
}

export default function StoryDrawer({ storyId, onClose, onDeleteArticle, showEnglish = false }: StoryDrawerProps) {
    const [story, setStory] = useState<Story | null>(null);
    const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!storyId) {
            setStory(null);
            return;
        }

        const loadStory = async () => {
            setLoading(true);
            setError(null);
            try {
                const data = await fetchStory(storyId);
                setStory(data);
            } catch (err: any) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        loadStory();
    }, [storyId]);

    if (!storyId) return null;


    // Helper to get date range string
    const getDateRange = (articles: Article[]) => {
        if (!articles || articles.length === 0) return '';
        const dates = articles
            .map(a => a.published_at || a.scraped_at)
            .filter(d => d)
            .map(d => new Date(d as string).getTime());

        if (dates.length === 0) return '';

        const minDate = new Date(Math.min(...dates));
        const maxDate = new Date(Math.max(...dates));

        if (formatDate(minDate.toISOString()) === formatDate(maxDate.toISOString())) {
            return formatDate(minDate.toISOString());
        }
        return `${formatDate(minDate.toISOString())} - ${formatDate(maxDate.toISOString())}`;
    };

    const sentimentClass = story?.sentiment === 'positive' ? styles.headerSentimentPositive :
        story?.sentiment === 'negative' ? styles.headerSentimentNegative :
            story?.sentiment === 'neutral' ? styles.headerSentimentNeutral : '';

    return (
        <div className={`${styles.overlay} ${story ? styles.visible : ''}`} onClick={onClose}>
            <div className={styles.drawer} onClick={e => e.stopPropagation()}>
                <button className={styles.btnClose} onClick={onClose}>&times;</button>

                <div className={`${styles.header} ${sentimentClass}`}>
                    <div className={styles.headerTop}>
                        <span className={styles.context}>DETAILED STORY ANALYSIS</span>
                        <div className={styles.headerBadges}>
                            {story?.sentiment && (
                                <span className={`${styles.sentimentBadge} ${styles['sent' + story.sentiment.charAt(0).toUpperCase() + story.sentiment.slice(1)]}`}>
                                    {story.sentiment}
                                </span>
                            )}
                            <span className={styles.countBadge}>
                                {story?.article_count || story?.articles?.length || 0} Articles
                            </span>
                        </div>
                    </div>

                    <h2 className={styles.headline}>{story?.headline || 'Loading Story...'}</h2>

                    <div className={styles.metaRow}>
                        <div className={styles.dateRange}>
                            {story?.articles && getDateRange(story.articles)}
                        </div>
                        <div className={styles.updateStatus}>
                            Updated {story ? formatDate(story.updated_at) : '...'}
                        </div>
                    </div>
                </div>


                <div className={styles.scrollArea}>
                    {loading && <div className={styles.loading}>Analyzing cluster data...</div>}
                    {error && <div className={styles.error}>{error}</div>}

                    {story && (
                        <div className={styles.contentLayout}>
                            <div className={styles.card}>
                                <div className={styles.cardHeader}>
                                    <h3 className={styles.cardTitle}>EXECUTIVE SUMMARY</h3>
                                    <span className={styles.cardSubtitle}>AI generated global context</span>
                                </div>
                                <div className={styles.cardBody}>
                                    <p className={styles.mainSummary}>{story.main_summary}</p>

                                    {((story.tags && story.tags.length > 0) || (story.entities && story.entities.length > 0)) && (
                                        <div className={styles.tagSection}>
                                            <div className={styles.tagCloud}>
                                                {story.tags?.map((t, i) => (
                                                    <span key={`t-${i}`} className={styles.tag}>{t}</span>
                                                ))}
                                            </div>
                                            <div className={styles.tagCloud} style={{ marginTop: '0.75rem' }}>
                                                {story.entities?.map((e, i) => (
                                                    <span key={`e-${i}`} className={styles.entity}>{e}</span>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {story.extended_account && (
                                <div className={styles.card}>
                                    <div className={styles.cardHeader}>
                                        <h3 className={styles.cardTitle}>DEEP DIVE CONTEXT</h3>
                                    </div>
                                    <div className={styles.cardBody}>
                                        <div className={styles.extendedText}>
                                            <ReactMarkdown>{story.extended_account}</ReactMarkdown>
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div className={styles.articlesGrid}>
                                <div className={styles.sectionHeader}>
                                    <h3 className={styles.cardTitle}>SUPPORTING ARTICLES</h3>
                                    <span className={styles.cardSubtitle}>{story.articles.length} sources analyzed</span>
                                </div>
                                <div className={styles.articleList}>
                                    {story.articles.map(a => (
                                        <div key={a.id} className={styles.articleItem}>
                                            <ArticleCard
                                                article={a}
                                                viewMode="list"
                                                onExpand={() => setSelectedArticle(a)}
                                                onDelete={onDeleteArticle}
                                                showEnglish={showEnglish}
                                            />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {
                selectedArticle && (
                    <ArticleDrawer
                        article={selectedArticle}
                        onClose={() => setSelectedArticle(null)}
                        showEnglish={showEnglish}
                    />
                )
            }
        </div >
    );
}
