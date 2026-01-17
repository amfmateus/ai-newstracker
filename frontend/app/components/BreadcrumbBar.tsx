'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function BreadcrumbBar() {
    const pathname = usePathname();

    // Generate breadcrumbs always

    const generateBreadcrumbs = () => {
        const asPathWithoutQuery = pathname.split('?')[0];
        const asPathNestedRoutes = asPathWithoutQuery.split('/').filter(v => v.length > 0);

        const crumblist = asPathNestedRoutes.map((subpath, idx) => {
            const href = '/' + asPathNestedRoutes.slice(0, idx + 1).join('/');

            // Format name: capitalize and remove dashes
            let name = subpath.replace(/-/g, ' ');

            // Heuristics for specific IDs or paths
            if (name.length > 20 && /\d/.test(name)) { // Likely an UUID
                name = "Details";
            }
            // Capitalize first letter of each word
            name = name.replace(/\w\S*/g, (w) => (w.replace(/^\w/, (c) => c.toUpperCase())));

            // Special overrides
            if (name === 'Pipelines') name = 'Pipelines';
            if (name === 'Reports') name = 'Reports';
            if (name === 'Settings') name = 'System Settings';
            if (name === 'Sources') name = 'Manage Sources';

            return { href, name };
        });

        // Add Home
        return [{ href: '/', name: 'Home' }, ...crumblist];
    };

    const breadcrumbs = generateBreadcrumbs();

    return (
        <div style={{
            height: '40px',
            background: '#f8fafc',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            padding: '0 1.5rem',
            fontSize: '0.85rem',
            color: '#64748b'
        }}>
            {breadcrumbs.map((crumb, idx) => {
                const isLast = idx === breadcrumbs.length - 1;

                return (
                    <div key={crumb.href} style={{ display: 'flex', alignItems: 'center' }}>
                        <Link
                            href={crumb.href}
                            style={{
                                textDecoration: 'none',
                                color: isLast ? '#0f172a' : '#64748b',
                                fontWeight: isLast ? 600 : 400,
                                transition: 'color 0.2s'
                            }}
                            onMouseOver={(e) => !isLast && (e.currentTarget.style.color = '#3b82f6')}
                            onMouseOut={(e) => !isLast && (e.currentTarget.style.color = '#64748b')}
                        >
                            {crumb.name}
                        </Link>
                        {!isLast && (
                            <span style={{ margin: '0 0.5rem', color: '#cbd5e1' }}>/</span>
                        )}
                    </div>
                );
            })}
        </div>
    );
}
