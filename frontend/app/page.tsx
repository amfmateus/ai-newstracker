'use client';

import React from 'react';
import Image from 'next/image';

export default function LandingPage() {
    return (
        <div style={{
            height: '100%',
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            position: 'relative',
            overflow: 'hidden',
            background: '#f8fafc' // Subtle background
        }}>

            {/* Large Semi-Transparent Logo - Moved OUTSIDE the content container to be true background */}
            <div style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                width: '80vmin',
                height: '80vmin',
                zIndex: 0,
                pointerEvents: 'none',
                opacity: 0.1, // Subtle watermark
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
            }}>
                <img
                    src="/logo_medium.png"
                    alt=""
                    style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'contain'
                    }}
                />
            </div>

            {/* Centered Content Container */}
            <div style={{
                position: 'relative',
                zIndex: 10,
                textAlign: 'center',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center'
            }}>

                {/* Foreground Logo (Optional, if user wants just the name, but usually branding includes standard logo too. 
            User said: "large rendition ... in semi-transparent occupying most of page space". 
            So maybe just that background logo + text on top. Let's do exactly that.) 
        */}

                <h1 style={{
                    fontSize: '4rem',
                    fontWeight: 800,
                    color: '#0f172a',
                    letterSpacing: '-0.03em',
                    marginBottom: '1rem',
                    textShadow: '0 2px 10px rgba(0,0,0,0.05)'
                }}>
                    Alex's Newscrawler
                </h1>

                <p style={{
                    fontSize: '1.25rem',
                    color: '#64748b',
                    maxWidth: '600px',
                    lineHeight: 1.6
                }}>
                    Your personalized intelligence layer
                </p>

            </div>
        </div>
    );
}
