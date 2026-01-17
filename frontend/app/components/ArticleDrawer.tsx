import { useEffect, useState } from 'react';
import { Article } from '../lib/api';
import styles from './ArticleDrawer.module.css';
import { formatDate } from '../lib/dateUtils';

interface ArticleDrawerProps {
    article: Article | null;
    onClose: () => void;
    showEnglish?: boolean;
}

export default function ArticleDrawer({ article, onClose, showEnglish = false }: ArticleDrawerProps) {
    const [internalShowEnglish, setInternalShowEnglish] = useState(showEnglish);

    useEffect(() => {
        setInternalShowEnglish(showEnglish);
    }, [showEnglish]);

    if (!article) return null;

    const title = internalShowEnglish && article.translated_title ? article.translated_title : article.raw_title;
    const displayAiSummary = (internalShowEnglish ? article.ai_summary : article.ai_summary_original) || article.ai_summary;
    const content = internalShowEnglish && article.translated_content_snippet ? article.translated_content_snippet : article.content_snippet;
    const displayTags = (internalShowEnglish ? article.tags : article.tags_original) || article.tags;
    const displayEntities = (internalShowEnglish ? article.entities : article.entities_original) || article.entities;

    const sentimentClass = article.sentiment === 'positive' ? styles.headerSentimentPositive :
        article.sentiment === 'negative' ? styles.headerSentimentNegative :
            article.sentiment === 'neutral' ? styles.headerSentimentNeutral : '';

    return (
        <div className={`${styles.overlay} ${article ? styles.visible : ''}`} onClick={onClose}>
            <div className={styles.drawer} onClick={e => e.stopPropagation()}>
                <button className={styles.btnClose} onClick={onClose}>&times;</button>

                <div className={`${styles.header} ${sentimentClass}`}>
                    <div className={styles.headerTop}>
                        <span className={styles.context}>DETAILED ARTICLE VIEW</span>
                        <div className={styles.headerBadges}>
                            <div className={styles.internalToggle}>
                                <button
                                    className={`${styles.toggleBtn} ${!internalShowEnglish ? styles.toggleActive : ''}`}
                                    onClick={() => setInternalShowEnglish(false)}
                                >
                                    {article.language?.toUpperCase() || 'ORIG'}
                                </button>
                                <button
                                    className={`${styles.toggleBtn} ${internalShowEnglish ? styles.toggleActive : ''}`}
                                    onClick={() => setInternalShowEnglish(true)}
                                >
                                    EN
                                </button>
                            </div>
                            {article.sentiment && (
                                <div className={`${styles.sentimentBadge} ${styles['sent' + article.sentiment.charAt(0).toUpperCase() + article.sentiment.slice(1)]}`}>
                                    {article.sentiment}
                                </div>
                            )}
                        </div>
                    </div>

                    <h2 className={styles.headline}>{title}</h2>

                    <div className={styles.metaRow}>
                        <div className={styles.sourceBadge}>
                            {article.image_url && <img src={article.image_url} className={styles.sourceIcon} alt="" />}
                            <span className={styles.sourceName}>
                                {article.source?.name || article.source_name_backup || 'Unknown Source'}
                            </span>
                        </div>
                        <div className={styles.pubDate}>
                            {formatDate(article.published_at)}
                        </div>
                    </div>
                </div>

                <div className={styles.scrollArea}>
                    <div className={styles.contentLayout}>
                        {/* Summary Section */}
                        <div className={styles.card}>
                            <div className={styles.cardHeader}>
                                <h3 className={styles.cardTitle}>AI SUMMARY</h3>
                                <span className={styles.cardSubtitle}>Key takeaways and condensed insights</span>
                            </div>
                            <div className={styles.cardBody}>
                                {displayAiSummary ? (
                                    <p className={styles.summaryText}>{displayAiSummary}</p>
                                ) : (
                                    <p className={styles.noData}>No summary available for this article.</p>
                                )}
                            </div>
                        </div>

                        {/* Metadata Section */}
                        <div className={styles.metadataGrid}>
                            <div className={styles.card}>
                                <div className={styles.cardHeader}>
                                    <h3 className={styles.cardTitle}>THEMES & ENTITIES</h3>
                                </div>
                                <div className={styles.cardBody}>
                                    <div className={styles.tagCloud}>
                                        {displayTags && displayTags.length > 0 ? (
                                            displayTags.map((tag, i) => (
                                                <span key={i} className={styles.tag}>{tag}</span>
                                            ))
                                        ) : <span className={styles.noData}>No themes</span>}
                                    </div>
                                    <div className={styles.tagCloud} style={{ marginTop: '0.75rem' }}>
                                        {displayEntities && displayEntities.length > 0 ? (
                                            displayEntities.map((ent, i) => (
                                                <span key={i} className={styles.entity}>{ent}</span>
                                            ))
                                        ) : <span className={styles.noData}>No entities</span>}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Content Snippet */}
                        <div className={styles.card}>
                            <div className={styles.cardHeader}>
                                <h3 className={styles.cardTitle}>SNIPPET & CONTEXT</h3>
                            </div>
                            <div className={styles.cardBody}>
                                {content ? (
                                    <p className={styles.contentText}>{content}</p>
                                ) : (
                                    <p className={styles.noData}>No content snippet available.</p>
                                )}

                                <a
                                    href={article.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className={styles.originalLink}
                                >
                                    Read Original Article ↗
                                </a>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
