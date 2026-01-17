"use client";

import { useEffect, useState } from "react";
import { signIn, signOut } from "next-auth/react";
import styles from "./SessionTimeoutModal.module.css";

interface SessionTimeoutModalProps {
    isOpen: boolean;
    onClose?: () => void;
}

export default function SessionTimeoutModal({ isOpen, onClose }: SessionTimeoutModalProps) {
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setIsVisible(true);
        } else {
            const timer = setTimeout(() => setIsVisible(false), 300);
            return () => clearTimeout(timer);
        }
    }, [isOpen]);

    if (!isVisible && !isOpen) return null;

    return (
        <div className={`${styles.overlay} ${isOpen ? styles.open : ""}`}>
            <div className={styles.modal}>
                <div className={styles.iconWrapper}>
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="24"
                        height="24"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    >
                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" />
                        <path d="M12 8v4" />
                        <path d="M12 16h.01" />
                    </svg>
                </div>
                <h2 className={styles.title}>Session Expired</h2>
                <p className={styles.description}>
                    Your session has timed out due to inactivity or invalid credentials.
                    Please log in again to continue using Newstracker.
                </p>
                <div className={styles.actions}>
                    <button
                        className={styles.loginButton}
                        onClick={async () => {
                            // Force sign out to clear invalid session state first
                            await signOut({ redirect: false });
                            // Then trigger sign in flow, redirecting back here after success
                            signIn(undefined, { callbackUrl: window.location.href });
                        }}
                    >
                        Log In Again
                    </button>
                </div>
            </div>
        </div>
    );
}
