'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { PromptLibrary, fetchPrompts, createPrompt, updatePrompt } from '../../../../lib/api';
import styles from '../../../PipelineBuilder.module.css'; // Reuse form styles
import AlertModal, { AlertType } from '../../../../components/AlertModal';

interface PageProps {
    params: Promise<{ id: string }>;
}

export default function PromptEditor({ params }: PageProps) {
    const { id } = use(params);
    const isNew = id === 'new';
    const [prompt, setPrompt] = useState<Partial<PromptLibrary>>({
        name: 'New Custom Prompt',
        description: '',
        prompt_text:
            `You are an expert intelligence analyst. Analyze the provided articles and generate a structured, comprehensive report based on the evidence provided.

### OUTPUT REQUIREMENTS:
Return your response as strictly valid JSON. Do not include markdown code blocks. 
Use the following recursive schema:

{
  "title": "Main Report Title",
  "subtitle": "Concise report subtitle",
  "summary": "Executive summary of key findings.",
  "sections": [
    {
      "title": "Section Title",
      "body": "Detailed analytical text. Use [[REF:ArticleID]] to cite specific articles.",
      "references": ["ArticleID_1", "ArticleID_2"],
      "subsections": [
         {
           "title": "Subsection Title",
           "body": "Deep dive analysis...",
           "references": ["ArticleID_3"],
           "subsections": [] 
         }
      ]
    }
  ],
  "references": [
    {
      "id": "ArticleID_1",
      "title": "Article Headline",
      "url": "https://..."
    }
  ]
}

### CRITICAL RULES:
1. Nesting Limit: Do not exceed 4 levels of section nesting.
2. Citations: Every factual claim must be cited using the exact format [[REF:ArticleID]]. 
3. Reference Mapping: The references list at the bottom must contain every article cited in any section.`
    });
    const [alertState, setAlertState] = useState<{ isOpen: boolean; message: string; type: AlertType }>({
        isOpen: false,
        message: '',
        type: 'info'
    });

    const [saving, setSaving] = useState(false);
    const router = useRouter();

    useEffect(() => {
        if (!isNew) loadData();
    }, [id]);

    const loadData = async () => {
        const prompts = await fetchPrompts();
        const found = prompts.find(p => p.id === id);
        if (found) setPrompt(found);
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            if (isNew) {
                await createPrompt(prompt);
            } else {
                await updatePrompt(id, prompt);
            }
            router.push('/pipelines/libraries/prompts');
        } catch (e) {
            setAlertState({ isOpen: true, message: "Failed to save prompt", type: 'error' });
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className={styles.container} style={{ maxWidth: '800px', margin: '0 auto' }}>
            <div style={{ marginBottom: '1rem' }}>
                <Link href="/pipelines/libraries/prompts" style={{ textDecoration: 'none', color: '#666' }}>&larr; Back to Library</Link>
            </div>

            <header className={styles.header}>
                <h1 className={styles.title}>{isNew ? 'New Prompt' : 'Edit Prompt'}</h1>
                <button onClick={handleSave} disabled={saving} className={styles.saveButton}>
                    {saving ? 'Saving...' : 'Save Prompt'}
                </button>
            </header>

            <div className={styles.configPanel} style={{ border: 'none', padding: 0 }}>
                <div className={styles.formGroup}>
                    <label className={styles.label}>Name</label>
                    <input
                        className={styles.input}
                        value={prompt.name}
                        onChange={e => setPrompt({ ...prompt, name: e.target.value })}
                        placeholder="e.g. Daily Executive Summary"
                    />
                </div>

                <div className={styles.formGroup}>
                    <label className={styles.label}>Description</label>
                    <input
                        className={styles.input}
                        value={prompt.description}
                        onChange={e => setPrompt({ ...prompt, description: e.target.value })}
                        placeholder="Describe what this prompt does..."
                    />
                </div>

                <div className={styles.formGroup}>
                    <label className={styles.label}>System Instructions / Prompt</label>
                    <textarea
                        className={styles.textarea}
                        style={{ height: '400px', fontFamily: 'monospace', fontSize: '14px', lineHeight: '1.5' }}
                        value={prompt.prompt_text}
                        onChange={e => setPrompt({ ...prompt, prompt_text: e.target.value })}
                    />
                    <p style={{ fontSize: '0.8rem', color: '#666' }}>
                        Tip: You must instruct the AI to output strictly structured JSON matching the pipeline schema.
                    </p>
                </div>
            </div>

            <AlertModal
                isOpen={alertState.isOpen}
                message={alertState.message}
                type={alertState.type}
                onClose={() => setAlertState(prev => ({ ...prev, isOpen: false }))}
            />
        </div>
    );
}
