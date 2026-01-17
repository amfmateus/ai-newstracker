import styles from './ArticleCard.module.css';
import { Article } from '../lib/api';
import { getRelativeTime } from '../lib/dateUtils';
import { useState } from 'react';

export default function ArticleCard({
    article,
    viewMode,
    onExpand,
    onDelete,
    onStoryClick,
    showEnglish = false,
}: {
    article: Article,
    viewMode: 'grid' | 'list',
    onExpand?: () => void,
    onDelete?: (id: string) => void,
    onStoryClick?: (id: string) => void,
    showEnglish?: boolean,
}) {
    const [isDeleting, setIsDeleting] = useState(false);

    // Dynamic Content
    const displayTitle = (showEnglish && article.translated_title)
        ? article.translated_title
        : article.raw_title;

    const displaySummary = showEnglish
        ? (article.ai_summary || article.translated_generated_summary || article.translated_content_snippet || '')
        : (article.ai_summary_original || article.generated_summary || article.content_snippet || '');

    const pubDate = getRelativeTime(article.published_at);
    const sourceName = article.source?.name || article.source_name_backup || 'Unknown Source';
    const displayTags = ((showEnglish ? article.tags : article.tags_original) || article.tags)?.slice(0, 5) || [];
    const displayEntities = ((showEnglish ? article.entities : article.entities_original) || article.entities)?.slice(0, 5) || [];

    const handleDelete = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!onDelete) return;
        if (confirm('Are you sure you want to delete this article?')) {
            setIsDeleting(true);
            try {
                await onDelete(article.id);
            } catch (error) {
                console.error("Failed to delete", error);
                setIsDeleting(false);
            }
        }
    };

    const isClickable = !!onExpand;

    return (
        <article
            className={`${styles.card} ${isDeleting ? styles.deleting : ''}`}
            onClick={onExpand}
            style={{ cursor: isClickable ? 'pointer' : 'default' }}
        >
            {onDelete && (
                <button
                    className={styles.btnDelete}
                    onClick={handleDelete}
                    title="Delete Article"
                >
                    <span>×</span>
                </button>
            )}


            <div className={styles.header}>
                <div className={styles.context}>{sourceName}</div>
                <h2 className={styles.headline} title={displayTitle}>{displayTitle}</h2>
                <div className={styles.meta}>
                    <span className={styles.badge}>
                        {pubDate}
                        {article.story_id && (
                            <span
                                className={styles.storyBadgePart}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onStoryClick?.(article.story_id!);
                                }}
                            >
                                • Story
                            </span>
                        )}
                    </span>
                    <span className={styles.dot}>•</span>
                    <span className={styles.updateTime}>{article.language?.toUpperCase() || 'OR'}</span>
                </div>
            </div>

            <div className={styles.body}>
                <p className={styles.summary}>
                    {displaySummary}
                </p>
            </div>

            <div className={`${styles.footer} ${article.sentiment ? styles[`footer${article.sentiment.charAt(0).toUpperCase() + article.sentiment.slice(1)}`] : ''}`}>
                {displayTags.length > 0 && (
                    <div className={styles.metaRow}>
                        <span className={styles.rowLabel}>Themes:</span>
                        {displayTags.map((tag, i) => (
                            <span key={`tag-${i}`} className={styles.tagChip}>{tag}</span>
                        ))}
                    </div>
                )}
                {displayEntities.length > 0 && (
                    <div className={styles.metaRow}>
                        <span className={styles.rowLabel}>Entities:</span>
                        {displayEntities.map((ent, i) => (
                            <span key={`ent-${i}`} className={styles.entityChip}>{ent}</span>
                        ))}
                    </div>
                )}
            </div>
        </article>
    );
}

