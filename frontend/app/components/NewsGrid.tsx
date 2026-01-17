import { useState, useMemo } from 'react';
import { Article } from '../lib/api';
import ArticleCard from './ArticleCard';
import styles from './NewsGrid.module.css';
import { getDateLabel } from '../lib/dateUtils';
import ArticleDrawer from './ArticleDrawer';

interface NewsGridProps {
    articles: Article[];
    groupBy?: 'source' | 'published_at' | 'scraped_at' | null;
    viewMode: 'grid' | 'list';
    onViewModeChange: (mode: 'grid' | 'list') => void;
    onDelete: (id: string) => void;
    onStoryClick?: (id: string) => void;
    showEnglish?: boolean;
}

const NewsGroup = ({ title, articles, viewMode, onExpand, onDelete, onStoryClick, showEnglish }: {
    title: string,
    articles: Article[],
    viewMode: 'grid' | 'list',
    onExpand: (a: Article) => void,
    onDelete: (id: string) => void,
    onStoryClick?: (id: string) => void,
    showEnglish?: boolean,
}) => {
    const [isExpanded, setIsExpanded] = useState(true);

    return (
        <div style={{ marginBottom: '2rem' }}>
            <h2
                onClick={() => setIsExpanded(!isExpanded)}
                style={{
                    borderBottom: '2px solid #FFCC00',
                    paddingBottom: '0.5rem',
                    marginBottom: '1rem',
                    color: '#0E47CB',
                    fontSize: '1.5rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                }}
            >
                {title}
                <span style={{ fontSize: '1rem', color: '#666', transform: `rotate(${isExpanded ? 0 : -90}deg)`, transition: 'transform 0.2s' }}>
                    ▼
                </span>
            </h2>
            {isExpanded && (
                <div className={viewMode === 'grid' ? styles.grid : styles.list}>
                    {articles.map((article) => (
                        <ArticleCard
                            key={article.id}
                            article={article}
                            viewMode={viewMode}
                            onExpand={() => onExpand(article)}
                            onDelete={onDelete}
                            onStoryClick={onStoryClick}
                            showEnglish={showEnglish}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};

export default function NewsGrid({
    articles,
    groupBy = null,
    viewMode,
    onViewModeChange,
    onDelete,
    onStoryClick,
    showEnglish,
}: NewsGridProps) {
    const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);

    const groupedArticles = useMemo(() => {
        if (!groupBy) return null;

        const groups: Record<string, Article[]> = {};

        articles.forEach(a => {
            let key = 'Other';
            if (groupBy === 'source') {
                key = a.source?.name || a.source_name_backup || 'Unknown Source';
            } else if (groupBy === 'published_at') {
                key = getDateLabel(a.published_at);
            } else if (groupBy === 'scraped_at') {
                key = getDateLabel(a.scraped_at);
            }

            if (!groups[key]) groups[key] = [];
            groups[key].push(a);
        });

        return groups;
    }, [articles, groupBy]);

    return (
        <div style={{ width: '100%', maxWidth: '1200px', margin: '0 auto' }}>

            <ArticleDrawer
                article={selectedArticle!}
                onClose={() => setSelectedArticle(null)}
                showEnglish={showEnglish}
            />

            {groupBy && groupedArticles ? (
                Object.entries(groupedArticles).map(([groupTitle, groupArticles]) => (
                    <NewsGroup
                        key={groupTitle}
                        title={groupTitle}
                        articles={groupArticles}
                        viewMode={viewMode}
                        onExpand={setSelectedArticle}
                        onDelete={onDelete}
                        onStoryClick={onStoryClick}
                        showEnglish={showEnglish}
                    />
                ))
            ) : (
                <div className={viewMode === 'grid' ? styles.grid : styles.list}>
                    {articles.map((article) => (
                        <ArticleCard
                            key={article.id}
                            article={article}
                            viewMode={viewMode}
                            onExpand={() => setSelectedArticle(article)}
                            onDelete={onDelete}
                            onStoryClick={onStoryClick}
                            showEnglish={showEnglish}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

