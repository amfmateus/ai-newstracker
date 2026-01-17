import React from 'react';

// Define types locally or import if available. Using `any` for config objects to avoid strict coupling for now, 
// but ideally we import shared types.
interface ReviewSummaryProps {
    pipeline: any;
    sourceConfigs: any[];
    prompts: any[];
    formattings: any[];
    outputs: any[];
    deliveries: any[];
}

export default function ReviewSummary({
    pipeline,
    sourceConfigs,
    prompts,
    formattings,
    outputs,
    deliveries
}: ReviewSummaryProps) {

    // Use source_config.template_id if source_config_id is missing (legacy vs new)
    const sourceId = pipeline.source_config_id || pipeline.source_config?.template_id;
    const source = sourceConfigs.find(s => s.id === sourceId);

    const prompt = prompts.find(p => p.id === pipeline.prompt_id);
    const format = formattings.find(f => f.id === pipeline.formatting_id);
    const output = outputs.find(o => o.id === pipeline.output_config_id);
    const delivery = deliveries.find(d => d.id === pipeline.delivery_config_id);

    const Card = ({ title, icon, color, children }: { title: string, icon: React.ReactNode, color: string, children: React.ReactNode }) => (
        <div style={{
            background: 'white',
            borderRadius: '12px',
            border: '1px solid #e2e8f0',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column'
        }}>
            <div style={{
                padding: '12px 16px',
                background: `${color}10`, // 10% opacity
                borderBottom: '1px solid #e2e8f0',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                color: color,
                fontWeight: 600,
                fontSize: '0.9rem'
            }}>
                {icon}
                {title}
            </div>
            <div style={{ padding: '16px', flex: 1 }}>
                {children}
            </div>
        </div>
    );

    return (
        <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: '16px',
            marginBottom: '24px'
        }}>
            {/* Source Card */}
            <Card title="Source Data" color="#2563eb" icon={
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>
            }>
                {source ? (
                    <>
                        <div style={{ fontWeight: 600, color: '#1e293b', marginBottom: '4px' }}>{source.name}</div>
                        <div style={{ fontSize: '0.85rem', color: '#64748b' }}>
                            {source.parameters?.limit ? `Last ${source.parameters.limit} articles` : 'Recent articles'}
                        </div>
                        {source.parameters?.story_status && (
                            <div style={{ marginTop: '8px', display: 'inline-block', background: '#eff6ff', color: '#1d4ed8', fontSize: '0.75rem', padding: '2px 8px', borderRadius: '100px', fontWeight: 500 }}>
                                {source.parameters.story_status}
                            </div>
                        )}
                    </>
                ) : <span style={{ color: '#94a3b8' }}>Not configured</span>}
            </Card>

            {/* AI Intelligence */}
            <Card title="Intelligence" color="#7c3aed" icon={
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2a10 10 0 1 0 10 10 4 4 0 0 1-5-5 4 4 0 0 1-5-5"></path></svg>
            }>
                {prompt ? (
                    <>
                        <div style={{ fontWeight: 600, color: '#1e293b', marginBottom: '4px' }}>{prompt.name}</div>
                        <div style={{ fontSize: '0.85rem', color: '#64748b' }}>
                            {prompt.model || 'Default Model'}
                        </div>
                    </>
                ) : <span style={{ color: '#94a3b8' }}>Not configured</span>}
            </Card>

            {/* Formatting */}
            <Card title="Formatting" color="#db2777" icon={
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>
            }>
                {format ? (
                    <>
                        <div style={{ fontWeight: 600, color: '#1e293b', marginBottom: '4px' }}>{format.name}</div>
                        <div style={{ fontSize: '0.85rem', color: '#64748b' }}>
                            {format.citation_type || 'Standard'} Citations
                        </div>
                    </>
                ) : <span style={{ color: '#94a3b8' }}>Not configured</span>}
            </Card>

            {/* Output */}
            <Card title="Output Format" color="#ea580c" icon={
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
            }>
                {output ? (
                    <>
                        <div style={{ fontWeight: 600, color: '#1e293b', marginBottom: '4px' }}>{output.name}</div>
                        <div style={{ fontSize: '0.85rem', color: '#64748b' }}>
                            {output.output_type}
                        </div>
                    </>
                ) : <span style={{ color: '#94a3b8' }}>Not configured</span>}
            </Card>

            {/* Delivery */}
            <Card title="Delivery" color="#16a34a" icon={
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
            }>
                {delivery ? (
                    <>
                        <div style={{ fontWeight: 600, color: '#1e293b', marginBottom: '4px' }}>{delivery.name}</div>
                        <div style={{ fontSize: '0.85rem', color: '#64748b' }}>
                            {delivery.parameters?.recipients?.length || 0} Recipient(s)
                        </div>
                        <div style={{ display: 'flex', gap: '4px', marginTop: '6px' }}>
                            {delivery.parameters?.recipients?.slice(0, 2).map((r: string) => (
                                <div key={r} style={{ maxWidth: '100px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '0.75rem', background: '#f0fdf4', color: '#15803d', padding: '2px 6px', borderRadius: '4px' }}>
                                    {r}
                                </div>
                            ))}
                            {(delivery.parameters?.recipients?.length || 0) > 2 && (
                                <div style={{ fontSize: '0.75rem', color: '#15803d', padding: '2px 6px' }}>+{delivery.parameters?.recipients?.length - 2}</div>
                            )}
                        </div>
                    </>
                ) : <span style={{ color: '#94a3b8' }}>Not configured</span>}
            </Card>
        </div>
    );
}
