import styles from './StoryCard.module.css';
import { getRelativeTime, formatDate } from '../lib/dateUtils';
import { Story } from '../lib/api';

interface StoryCardProps {
    story: Story;
    onClick: (id: string) => void;
}

export default function StoryCard({ story, onClick }: StoryCardProps) {
    const sentiment = story.sentiment || 'neutral';

    // Get unique sources
    const allUniqueSources = Array.from(new Set(
        story.articles
            .filter(a => a.source)
            .map(a => JSON.stringify({ name: a.source?.name, icon: a.source?.id }))
    )).map(s => JSON.parse(s));

    const uniqueSourcesToDisplay = allUniqueSources.slice(0, 4);

    // Calculate article date range
    const dates = story.articles
        .map(a => a.published_at ? new Date(a.published_at) : null)
        .filter((d): d is Date => d !== null)
        .sort((a, b) => a.getTime() - b.getTime());

    let dateRangeText = "";
    if (dates.length > 0) {
        const start = dates[0];
        const end = dates[dates.length - 1];
        if (start.toDateString() === end.toDateString()) {
            dateRangeText = formatDate(start.toISOString());
        } else {
            // Simplified range: "MM/DD - MM/DD/YYYY"
            const startStr = start.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit' });
            const endStr = formatDate(end.toISOString());
            dateRangeText = `${startStr} - ${endStr}`;
        }
    }

    return (
        <div className={styles.card} onClick={() => onClick(story.id)}>
            <div className={styles.header}>
                <div className={styles.context}>STORY CLUSTER</div>
                <h2 className={styles.headline}>{story.headline}</h2>
                <div className={styles.meta}>
                    <span className={styles.badge}>
                        {story.article_count} Articles
                        {dateRangeText && <span className={styles.dateRange}> • {dateRangeText}</span>}
                    </span>
                    <span className={styles.dot}>•</span>
                    <span className={styles.updateTime}>Updated {formatDate(story.updated_at)}</span>
                </div>
            </div>

            <div className={styles.body}>
                <p className={styles.summary}>{story.main_summary}</p>
            </div>

            <div className={`${styles.footer} ${styles[`footer${sentiment.charAt(0).toUpperCase() + sentiment.slice(1)}`]}`}>
                <div className={styles.sources}>
                    {uniqueSourcesToDisplay.map((s, i) => (
                        <div key={i} className={styles.sourceTag} title={s.name}>
                            {s.name}
                        </div>
                    ))}
                    {allUniqueSources.length > 4 && (
                        <span className={styles.sourceMore}>+{allUniqueSources.length - 4} more</span>
                    )}
                </div>
            </div>
        </div>
    );
}
