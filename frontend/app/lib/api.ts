import { getSession } from "next-auth/react";

export async function getAuthHeaders(): Promise<HeadersInit> {
    try {
        const session: any = await getSession();
        if (session && session.id_token) {
            return {
                'Authorization': `Bearer ${session.id_token}`,
                'Content-Type': 'application/json'
            };
        }
    } catch (e) {
        // console.error("Error getting session", e);
    }
    return { 'Content-Type': 'application/json' };
}

// Interceptor helper to handle 401s
const originalFetch = global.fetch;
// We don't want to monkey-patch global fetch continuously or in a way that breaks Next.js server-side.
// Instead, we'll implement the check in the API wrapper functions if possible, or use a wrapper.
// Since we have many functions, let's create a wrapper for fetch that checks for 401.

async function fetchWithAuth(url: string, options: RequestInit = {}) {
    const res = await fetch(url, options);
    if (res.status === 401) {
        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('auth-error'));
        }
    }
    return res;
}

export interface Article {
    id: string;
    raw_title: string;
    url: string;
    generated_summary?: string;
    content_snippet?: string;
    published_at?: string;
    scraped_at?: string;
    source_id: string;
    image_url?: string;
    source?: Source;
    // AI Fields
    language?: string;
    translated_title?: string;
    translated_content_snippet?: string;
    translated_generated_summary?: string;
    relevance_score?: number;
    tags?: string[];
    tags_original?: string[];
    entities?: string[];
    entities_original?: string[];
    sentiment?: 'positive' | 'neutral' | 'negative';
    ai_summary?: string;
    ai_summary_original?: string;
    source_name_backup?: string; // For orphans
    story_id?: string;
}

export const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export interface ArticleFilter {
    sourceIds?: string[];
    sortBy?: 'published_at' | 'scraped_at' | 'source';
    order?: 'asc' | 'desc';
    startDate?: string; // ISO string
    endDate?: string;   // ISO string
    dateType?: 'published' | 'scraped';
}

interface PaginatedArticleResponse {
    items: Article[];
    total: number;
}

export async function fetchArticles(
    skip: number = 0,
    limit: number = 20,
    sourceIds: string[] = [],
    startDate?: string | null,
    endDate?: string | null,
    dateType: 'published' | 'scraped' = 'published',
    storyStatus: 'all' | 'orphaned' | 'connected' = 'all',
    sortBy: 'published_at' | 'scraped_at' | 'source' = 'published_at',
    order: 'asc' | 'desc' = 'desc',
    search?: string,
    sentiment?: string,
    tags?: string[],
    entities?: string[],
    minRelevance?: number
): Promise<PaginatedArticleResponse> {
    const headers = await getAuthHeaders();

    const params = new URLSearchParams({
        skip: skip.toString(),
        limit: limit.toString(),
        date_type: dateType,
        sort_by: sortBy,
        order: order
    });

    if (sourceIds.length > 0) {
        sourceIds.forEach(id => params.append('source_ids', id));
    }
    if (startDate) params.append('start_date', startDate);
    if (endDate) params.append('end_date', endDate);
    if (storyStatus && storyStatus !== 'all') params.append('story_status', storyStatus);
    if (search) params.append('search', search);
    if (sentiment) params.append('sentiment', sentiment);
    if (minRelevance) params.append('min_relevance', minRelevance.toString());
    if (tags && tags.length > 0) tags.forEach(t => params.append('tags', t));
    if (entities && entities.length > 0) entities.forEach(e => params.append('entities', e));

    const res = await fetchWithAuth(`${API_URL}/articles?${params.toString()}`, { headers });
    if (!res.ok) throw new Error('Failed to fetchWithAuth articles');

    const data = await res.json();

    const items = data.items.map((article: any) => ({
        ...article,
        published_at: article.published_at ? new Date(article.published_at) : null,
        scraped_at: article.scraped_at ? new Date(article.scraped_at) : null,
    }));

    return { items, total: data.total };
}

export interface Source {
    id: string;
    url: string;
    name?: string;
    reference_name?: string;
    type: 'rss' | 'html';
    crawl_interval: number;
    crawl_method: 'auto' | 'pdf' | 'rss' | 'html';
    config?: {
        max_articles?: number;
        min_relevance?: number;
        min_length?: number;
        timeout?: number;
        max_rss_entries?: number;
        lookback?: number;
        topic_focus?: string;
        analysis_model?: string;
        pdf_model?: string;
        analysis_prompt?: string;
        pdf_prompt?: string;
    };
    last_crawled_at?: string;
    status: string;
    crawls_24h?: number;
    articles_24h?: number;
    last_crawl_status?: string;
    last_crawl_count?: number;
}

export async function fetchSources(): Promise<Source[]> {
    const headers = await getAuthHeaders();
    const res = await fetchWithAuth(`${API_URL}/sources`, { headers });

    if (!res.ok) {
        const errText = await res.text();
        console.error(`Fetch sources failed: ${res.status} ${res.statusText}`, errText);
        throw new Error(`Failed to fetchWithAuth sources: ${res.status} ${res.statusText} - ${errText}`);
    }

    return res.json();
}

export async function createSource(
    url: string,
    crawlInterval: number = 60,
    crawlMethod: 'auto' | 'pdf' | 'rss' | 'html' = 'auto',
    name?: string,
    referenceName?: string,
    config: any = {}
): Promise<Source> {
    const headers = await getAuthHeaders();
    const res = await fetchWithAuth(`${API_URL}/sources`, {
        method: 'POST',
        headers: headers as any,
        body: JSON.stringify({
            url,
            crawl_interval: crawlInterval,
            crawl_method: crawlMethod,
            name,
            reference_name: referenceName,
            type: crawlMethod === 'rss' ? 'rss' : 'html_generic', // Helper hint
            crawl_config: config
        })
    });
    return res.json();
}

export async function triggerCrawl(sourceId: string): Promise<void> {
    const headers = await getAuthHeaders();
    const res = await fetchWithAuth(`${API_URL}/crawl/${sourceId}`, {
        method: 'POST',
        headers
    });
    if (!res.ok) throw new Error('Failed to trigger crawl');
}

export async function fetchArticle(id: string): Promise<Article> {
    const headers = await getAuthHeaders();
    const res = await fetchWithAuth(`${API_URL}/articles/${id}`, { headers });
    if (!res.ok) throw new Error("Article not found");
    return res.json();
}

export async function checkHealth(): Promise<boolean> {
    const headers = await getAuthHeaders();
    try {
        const res = await fetchWithAuth(`${API_URL}/`, { headers });
        return res.ok;
    } catch (e) {
        return false;
    }
}

export async function deleteSource(id: string, deleteArticles: boolean = true): Promise<void> {
    const headers = await getAuthHeaders();
    await fetchWithAuth(`${API_URL}/sources/${id}?delete_articles=${deleteArticles}`, { method: 'DELETE', headers });
}

export async function updateSource(
    id: string,
    data: {
        name?: string;
        status?: string;
        crawl_interval?: number;
        crawl_method?: 'auto' | 'pdf' | 'rss' | 'html';
        crawl_config?: any;
        reference_name?: string;
    }
): Promise<void> {
    const headers = await getAuthHeaders();
    await fetchWithAuth(`${API_URL}/sources/${id}`, {
        method: 'PATCH',
        headers: headers,
        body: JSON.stringify({
            name: data.name,
            status: data.status,
            crawl_interval: data.crawl_interval,
            crawl_method: data.crawl_method,
            crawl_config: data.crawl_config,
            reference_name: data.reference_name
        }),
    });
}

export async function deleteArticle(id: string): Promise<void> {
    const headers = await getAuthHeaders();
    await fetchWithAuth(`${API_URL}/articles/${id}`, { method: 'DELETE', headers });
}

export interface SystemSettings {
    id: string;
    first_crawl_lookback_hours: number;
    min_text_length: number;
    default_crawl_interval_mins: number;
    max_rss_entries: number;
    max_articles_to_scrape: number;
    page_load_timeout_seconds: number;
    min_relevance_score: number;
    content_topic_focus?: string;
    story_generation_interval_mins: number;
    clustering_article_window_hours?: number;
    clustering_story_context_days?: number;
    min_story_strength?: number;
    last_clustering_at?: string;
    enable_stories?: boolean;

    // SMTP Settings
    smtp_host?: string;
    smtp_port?: number;
    smtp_user?: string;
    smtp_password?: string;
    smtp_from_email?: string;
    smtp_sender_name?: string;
    smtp_reply_to?: string;

    analysis_model: string;
    analysis_prompt: string | null;
    clustering_model: string;
    clustering_prompt: string | null;
    report_model: string;
    report_prompt: string | null;

    // Dynamic PDF Crawler
    pdf_crawl_model?: string;
    pdf_crawl_prompt?: string | null;
}

export async function fetchSettings(): Promise<SystemSettings> {
    const headers = await getAuthHeaders();
    const res = await fetchWithAuth(`${API_URL}/settings`, { headers });
    if (!res.ok) throw new Error('Failed to fetchWithAuth settings');
    return res.json();
}

export async function updateSettings(settings: Partial<SystemSettings>): Promise<SystemSettings> {
    const headers = await getAuthHeaders();
    const res = await fetchWithAuth(`${API_URL}/settings`, {
        method: 'PATCH',
        headers: headers,
        body: JSON.stringify(settings),
    });
    if (!res.ok) throw new Error('Failed to update settings');
    return res.json();
}

export interface UserProfile {
    id: string;
    email: string;
    full_name: string;
    has_api_key: boolean;
}

export async function fetchUserProfile(): Promise<UserProfile> {
    const headers = await getAuthHeaders();
    const res = await fetchWithAuth(`${API_URL}/users/me`, { headers });
    if (!res.ok) throw new Error('Failed to fetchWithAuth user profile');
    return res.json();
}

export async function updateUserProfile(data: { google_api_key?: string; full_name?: string }): Promise<UserProfile> {
    const headers = await getAuthHeaders();
    const res = await fetchWithAuth(`${API_URL}/users/me`, {
        method: 'PATCH',
        headers: headers,
        body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to update profile');
    return res.json();
}


export async function validateAIKey(key: string): Promise<{ status: 'valid' | 'invalid', message?: string }> {
    const headers = await getAuthHeaders();
    try {
        const res = await fetchWithAuth(`${API_URL}/users/validate-key`, {
            method: 'POST',
            headers: {
                ...headers,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ key })
        });

        if (!res.ok) {
            // Check for 422 or other errors
            const errorData = await res.json().catch(() => ({}));
            return { status: 'invalid', message: errorData.message || 'Validation failed' };
        }

        return res.json();
    } catch (e: any) {
        return { status: 'invalid', message: e.message || 'Network error' };
    }
}

// Stories / Clustering
export interface Story {
    id: string;
    headline: string;
    main_summary?: string;
    extended_account?: string;
    updated_at: string;
    created_at: string;
    article_count?: number;
    sentiment?: 'positive' | 'neutral' | 'negative';
    tags?: string[];
    entities?: string[];
    articles: Article[];
}

export async function fetchStories(
    skip: number = 0,
    limit: number = 20,
    minStrength?: number,
    startDate?: string | null,
    endDate?: string | null,
    sortBy: string = 'updated_at',
    order: string = 'desc',
    sentiment?: string,
    search?: string,
    tags?: string[],
    entities?: string[],
    sourceIds?: string[]
): Promise<{ items: Story[], total: number }> {
    const headers = await getAuthHeaders();
    let url = `${API_URL}/stories?skip=${skip}&limit=${limit}&sort_by=${sortBy}&order=${order}`;

    if (minStrength) url += `&min_strength=${minStrength}`;
    if (startDate) url += `&start_date=${encodeURIComponent(startDate)}`;
    if (endDate) url += `&end_date=${encodeURIComponent(endDate)}`;
    if (sentiment) url += `&sentiment=${sentiment}`;
    if (search) url += `&search=${encodeURIComponent(search)}`;
    if (tags && tags.length > 0) tags.forEach(t => url += `&tags=${encodeURIComponent(t)}`);
    if (entities && entities.length > 0) entities.forEach(e => url += `&entities=${encodeURIComponent(e)}`);
    if (sourceIds && sourceIds.length > 0) sourceIds.forEach(id => url += `&source_ids=${encodeURIComponent(id)}`);

    const res = await fetchWithAuth(url, { headers });
    if (!res.ok) throw new Error("Failed to load stories");
    return res.json();
}

export async function generateStories(): Promise<any> {
    const headers = await getAuthHeaders();
    const res = await fetchWithAuth(`${API_URL}/stories/generate`, {
        method: 'POST',
        headers
    });
    if (!res.ok) {
        const text = await res.text();
        throw new Error(`Failed to generate stories: ${text}`);
    }
    return res.json();
}

export async function fetchClusteringStatus(eventId: string): Promise<any> {
    const headers = await getAuthHeaders();
    const res = await fetchWithAuth(`${API_URL}/clustering/status/${eventId}`, { headers });
    if (!res.ok) throw new Error("Failed to fetchWithAuth clustering status");
    return res.json();
}

export async function fetchStory(id: string): Promise<Story> {
    const headers = await getAuthHeaders();
    const res = await fetchWithAuth(`${API_URL}/stories/${id}`, { headers });
    if (!res.ok) throw new Error("Story not found");
    return res.json();
}

export interface Report {
    id: string;
    title: string;
    configuration: ReportGenerateRequest;
    content: string | null;
    created_at: string;
    status: 'creating' | 'completed' | 'failed';
    meta_duration_ms?: number;
    meta_model?: string;
    meta_tokens_in?: number;
    meta_tokens_out?: number;
    meta_prompt?: string;

    // Archive Metadata
    pipeline_id?: string;
    run_type?: string;
    delivery_log?: Array<{
        channel: string;
        status: string;
        timestamp: string;
        config?: any;
        error?: string;
    }>;
    article_ids?: string[];
}

export interface ReportGenerateRequest {
    title: string;
    subtitle?: string;
    author?: string;
    start_date: string;
    end_date: string;
    source_ids?: string[];
    headings: string[];
    scope: string;
    // Filtering
    search?: string;
    sentiment?: string;
    tags?: string[];
    entities?: string[];
    min_relevance?: number;
    story_status?: 'orphaned' | 'connected' | 'all';
    date_type?: 'published' | 'scraped';
    article_ids?: string[];
    template_id?: string;
    formatting_id?: string;
}

export async function fetchReports(): Promise<Report[]> {
    const headers = await getAuthHeaders();
    const res = await fetchWithAuth(`${API_URL}/reports`, { headers });
    if (!res.ok) throw new Error("Failed to load reports");
    return res.json();
}

export async function generateReport(config: ReportGenerateRequest): Promise<Report> {
    const headers = await getAuthHeaders();
    try {
        const res = await fetchWithAuth(`${API_URL}/reports/generate`, {
            method: 'POST',
            headers: { ...headers, 'Content-Type': 'application/json' },
            body: JSON.stringify(config)
        });
        if (!res.ok) {
            const text = await res.text();
            throw new Error(`Server Error (${res.status}): ${text}`);
        }
        return res.json();
    } catch (e: any) {
        console.error("Report Generation Error:", e);
        throw new Error(e.message || "Network Error: Failed to reach server");
    }
}


export async function getCrawlStream(sourceId: string): Promise<ReadableStreamDefaultReader<Uint8Array> | undefined> {
    const headers = await getAuthHeaders();
    const res = await fetch(`${API_URL}/sources/${sourceId}/crawl-stream`, {
        headers
    });
    if (!res.ok) throw new Error('Failed to connect to crawl stream');
    return res.body?.getReader();
}

export async function deleteReport(id: string): Promise<void> {
    const headers = await getAuthHeaders();
    const res = await fetchWithAuth(`${API_URL}/reports/${id}`, {
        method: 'DELETE',
        headers
    });
    if (!res.ok) throw new Error("Failed to delete report");
}

export async function exportReportPdf(id: string): Promise<Blob> {
    const headers = await getAuthHeaders();
    const res = await fetchWithAuth(`${API_URL}/reports/${id}/export/pdf`, {
        method: 'POST',
        headers
    });
    if (!res.ok) {
        let errorMsg = "Failed to generate PDF";
        try {
            const errorData = await res.json();
            errorMsg = errorData.detail || errorMsg;
        } catch (e) {
            console.warn("Failed to parse error response", e);
        }
        throw new Error(errorMsg);
    }
    return res.blob();
}

export async function emailReport(id: string, email: string): Promise<void> {
    const headers = await getAuthHeaders();
    const res = await fetchWithAuth(`${API_URL}/reports/${id}/email`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
    });
    if (!res.ok) {
        let errorMsg = "Failed to send email";
        try {
            const errorData = await res.json();
            errorMsg = errorData.detail || errorMsg;
        } catch (e) {
            console.warn("Failed to parse error response", e);
        }
        throw new Error(errorMsg);
    }
}

export async function fetchArticlesBulk(ids: string[]): Promise<Article[]> {
    const headers = await getAuthHeaders();
    const res = await fetchWithAuth(`${API_URL}/articles/bulk`, {
        method: 'POST',
        headers: {
            ...headers,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(ids)
    });
    if (!res.ok) throw new Error("Failed to fetchWithAuth articles");
    return res.json();
}

export async function fetchAutocompleteSearch(q: string): Promise<string[]> {
    const headers = await getAuthHeaders();
    const res = await fetchWithAuth(`${API_URL}/articles/autocomplete?q=${encodeURIComponent(q)}`, { headers });
    if (!res.ok) return [];
    return res.json();
}

export async function fetchAutocompleteTags(q: string): Promise<string[]> {
    const headers = await getAuthHeaders();
    const res = await fetchWithAuth(`${API_URL}/tags/autocomplete?q=${encodeURIComponent(q)}`, { headers });
    if (!res.ok) return [];
    return res.json();
}

export async function fetchAutocompleteEntities(q: string): Promise<string[]> {
    const headers = await getAuthHeaders();
    const res = await fetchWithAuth(`${API_URL}/entities/autocomplete?q=${encodeURIComponent(q)}`, { headers });
    if (!res.ok) return [];
    return res.json();
}

// --- Prompt Library ---

export async function fetchAIModels(): Promise<Array<{ id: string, name: string }>> {
    const headers = await getAuthHeaders();
    // Use the new endpoint
    const res = await fetchWithAuth(`${API_URL}/api/ai/models`, { headers });
    if (!res.ok) return [];
    return res.json();
}

export interface ReportTemplate {
    id: string;
    user_id: string;
    name: string;
    description?: string;
    headings: string[];
    scope: string;
    prompt_override?: string;
    created_at: string;
    updated_at: string;
}

export async function fetchReportTemplates(): Promise<ReportTemplate[]> {
    const headers = await getAuthHeaders();
    const res = await fetchWithAuth(`${API_URL}/api/report-templates`, { headers });
    if (!res.ok) throw new Error("Failed to load report templates");
    return res.json();
}

export async function createReportTemplate(template: any): Promise<ReportTemplate> {
    const headers = await getAuthHeaders();
    const res = await fetchWithAuth(`${API_URL}/api/report-templates`, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(template)
    });
    if (!res.ok) throw new Error("Failed to create report template");
    return res.json();
}

export async function updateReportTemplate(id: string, template: any): Promise<ReportTemplate> {
    const headers = await getAuthHeaders();
    const res = await fetchWithAuth(`${API_URL}/api/report-templates/${id}`, {
        method: 'PATCH',
        headers: headers,
        body: JSON.stringify(template)
    });
    if (!res.ok) throw new Error("Failed to update report template");
    return res.json();
}

export async function deleteReportTemplate(id: string): Promise<void> {
    const headers = await getAuthHeaders();
    const res = await fetchWithAuth(`${API_URL}/api/report-templates/${id}`, {
        method: 'DELETE',
        headers
    });
    if (!res.ok) throw new Error("Failed to delete report template");
}

// --- Pipeline Interfaces & API ---

export interface ReportPipeline {
    id: string;
    name: string;
    description?: string;
    source_config: any;
    prompt_id?: string;
    formatting_id?: string;
    output_config_id?: string;
    delivery_config_id?: string;

    schedule_enabled?: boolean;
    schedule_cron?: string;
    next_run_at?: string;

    prompt?: PromptLibrary;
    formatting?: FormattingLibrary;
}

export interface PromptLibrary {
    id: string;
    name: string;
    description?: string;
    prompt_text: string;
    model?: string; // Added
    created_at: string;
    updated_at: string;
    template?: string;
    input_variables?: any[];
}

export interface FormattingLibrary {
    id: string;
    name: string;
    description?: string;
    structure_definition: string;
    css?: string;
    citation_type?: string;
    parameters?: Record<string, any>;
}

export interface OutputConfigLibrary {
    id: string;
    name: string;
    converter_type: string;
    parameters: any;
}

export interface DeliveryConfigLibrary {
    id: string;
    name: string;
    delivery_type: string;
    parameters: any;
}

export interface SourceConfigLibrary {
    id: string;
    name: string;
    description?: string;
    config: any;
    created_at: string;
}

export interface Asset {
    id: string;
    name: string;
    asset_type: string;
    url?: string;
}

// --- Pipeline CRUD ---

export async function fetchPipelines(): Promise<ReportPipeline[]> {
    const headers = await getAuthHeaders();
    const res = await fetchWithAuth(`${API_URL}/pipeline/pipelines`, { headers });
    if (!res.ok) throw new Error("Failed to load pipelines");
    return res.json();
}

export async function createPipeline(data: any): Promise<ReportPipeline> {
    const headers = await getAuthHeaders();
    const res = await fetchWithAuth(`${API_URL}/pipeline/pipelines`, {
        method: 'POST', body: JSON.stringify(data), headers
    });
    if (!res.ok) throw new Error("Failed to create pipeline");
    return res.json();
}

export async function updatePipeline(id: string, data: any): Promise<ReportPipeline> {
    const headers = await getAuthHeaders();
    const res = await fetchWithAuth(`${API_URL}/pipeline/pipelines/${id}`, {
        method: 'PUT', body: JSON.stringify(data), headers
    });
    if (!res.ok) throw new Error("Failed to update pipeline");
    return res.json();
}

export async function deletePipeline(id: string): Promise<void> {
    const headers = await getAuthHeaders();
    const res = await fetchWithAuth(`${API_URL}/pipeline/pipelines/${id}`, { method: 'DELETE', headers });
    if (!res.ok) throw new Error("Failed to delete pipeline");
}

// --- Library CRUD (Generic Helper) ---

async function fetchLibrary<T>(endpoint: string): Promise<T[]> {
    const headers = await getAuthHeaders();
    const res = await fetchWithAuth(`${API_URL}/pipeline/libraries/${endpoint}`, { headers });
    if (!res.ok) throw new Error(`Failed to load ${endpoint}`);
    return res.json();
}

async function createLibraryItem<T>(endpoint: string, data: any): Promise<T> {
    const headers = await getAuthHeaders();
    const res = await fetchWithAuth(`${API_URL}/pipeline/libraries/${endpoint}`, {
        method: 'POST', body: JSON.stringify(data), headers
    });
    if (!res.ok) throw new Error(`Failed to create ${endpoint} item`);
    return res.json();
}

async function updateLibraryItem<T>(endpoint: string, id: string, data: any): Promise<T> {
    const headers = await getAuthHeaders();
    const res = await fetchWithAuth(`${API_URL}/pipeline/libraries/${endpoint}/${id}`, {
        method: 'PUT', body: JSON.stringify(data), headers
    });
    if (!res.ok) throw new Error(`Failed to update ${endpoint} item`);
    return res.json();
}

async function deleteLibraryItem(endpoint: string, id: string): Promise<void> {
    const headers = await getAuthHeaders();
    const res = await fetchWithAuth(`${API_URL}/pipeline/libraries/${endpoint}/${id}`, {
        method: 'DELETE', headers
    });
    if (!res.ok) throw new Error(`Failed to delete ${endpoint} item`);
}

// Prompts
export const fetchPrompts = () => fetchLibrary<PromptLibrary>('prompts');
export const createPrompt = (data: any) => createLibraryItem<PromptLibrary>('prompts', data);
export const updatePrompt = (id: string, data: any) => updateLibraryItem<PromptLibrary>('prompts', id, data);
export const deletePrompt = (id: string) => deleteLibraryItem('prompts', id);

// Formatting
export const fetchFormattings = () => fetchLibrary<FormattingLibrary>('formatting');
export const createFormatting = (data: any) => createLibraryItem<FormattingLibrary>('formatting', data);
export const updateFormatting = (id: string, data: any) => updateLibraryItem<FormattingLibrary>('formatting', id, data);
export const deleteFormatting = (id: string) => deleteLibraryItem('formatting', id);

// Output
export const fetchOutputConfigs = () => fetchLibrary<OutputConfigLibrary>('output');
export const createOutputConfig = (data: any) => createLibraryItem<OutputConfigLibrary>('output', data);
export const updateOutputConfig = (id: string, data: any) => updateLibraryItem<OutputConfigLibrary>('output', id, data);
export const deleteOutputConfig = (id: string) => deleteLibraryItem('output', id);

// Delivery
export const fetchDeliveryConfigs = () => fetchLibrary<DeliveryConfigLibrary>('delivery');
export const createDeliveryConfig = (data: any) => createLibraryItem<DeliveryConfigLibrary>('delivery', data);
export const updateDeliveryConfig = (id: string, data: any) => updateLibraryItem<DeliveryConfigLibrary>('delivery', id, data);
export const deleteDeliveryConfig = (id: string) => deleteLibraryItem('delivery', id);

// --- Export / Import ---

export async function exportPipeline(id: string): Promise<any> {
    const headers = await getAuthHeaders();
    const res = await fetchWithAuth(`${API_URL}/pipeline/${id}/export`, { headers });
    if (!res.ok) throw new Error("Failed to export pipeline");
    return res.json();
}

export async function importPipeline(config: any): Promise<ReportPipeline> {
    const headers = await getAuthHeaders();
    const res = await fetchWithAuth(`${API_URL}/pipeline/import`, {
        method: 'POST',
        headers: headers as any,
        body: JSON.stringify(config)
    });
    if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Import failed");
    }
    return res.json();
}

// Source Configs
export const fetchSourceConfigs = () => fetchLibrary<SourceConfigLibrary>('source-configs');
export const createSourceConfig = (data: any) => createLibraryItem<SourceConfigLibrary>('source-configs', data);
export const updateSourceConfig = (id: string, data: any) => updateLibraryItem<SourceConfigLibrary>('source-configs', id, data);
export const deleteSourceConfig = (id: string) => deleteLibraryItem('source-configs', id);

// --- Assets ---

export async function fetchAssets(): Promise<Asset[]> {
    const headers = await getAuthHeaders();
    const res = await fetchWithAuth(`${API_URL}/pipeline/assets`, { headers });
    if (!res.ok) throw new Error("Failed to load assets");
    return res.json();
}

export async function uploadAsset(file: File, name: string): Promise<Asset> {
    const headers = await getAuthHeaders();
    const formData = new FormData();
    formData.append('file', file);
    formData.append('name', name);

    // Note: Fetch handles multipart boundary automatically, don't set Content-Type
    const session: any = await getSession(); // Manual Auth for FormData
    const authHeader: HeadersInit = session?.id_token ? { 'Authorization': `Bearer ${session.id_token}` } : {};

    const res = await fetch(`${API_URL}/pipeline/assets`, {
        method: 'POST',
        headers: authHeader,
        body: formData
    });
    if (!res.ok) throw new Error("Failed to upload asset");
    return res.json();
}

// --- Test Step ---

export async function testPipelineStep(stepNumber: number, inputContext: any, stepConfigId?: string, forceRefresh: boolean = false): Promise<any> {
    const headers = await getAuthHeaders();
    let url = `${API_URL}/pipeline/test-step/${stepNumber}`;
    const params = new URLSearchParams();
    if (stepConfigId) params.append('step_config_id', stepConfigId);
    if (forceRefresh) params.append('force_refresh', 'true');

    if (params.toString()) {
        url += `?${params.toString()}`;
    }

    const res = await fetchWithAuth(url, {
        method: 'POST',
        body: JSON.stringify(inputContext),
        headers
    });
    if (!res.ok) {
        const txt = await res.text();
        throw new Error(`Test Failed: ${txt}`);
    }
    return res.json();
}

export async function runPipeline(id: string): Promise<any> {
    const headers = await getAuthHeaders();
    const res = await fetchWithAuth(`${API_URL}/pipeline/pipelines/${id}/run`, {
        method: 'POST',
        headers
    });
    if (!res.ok) {
        const txt = await res.text();
        throw new Error(`Run Failed: ${txt}`);
    }
    return res.json();
}

export async function fetchAIDefaults(): Promise<any> {
    const headers = await getAuthHeaders();
    const res = await fetchWithAuth(`${API_URL}/pipeline/defaults`, { headers });
    if (!res.ok) return {};
    return res.json();
}
