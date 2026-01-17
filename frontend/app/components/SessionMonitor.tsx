"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import SessionTimeoutModal from "./SessionTimeoutModal";
import { usePathname } from "next/navigation";

export default function SessionMonitor() {
    const { data: session, status } = useSession();
    const [showTimeoutModal, setShowTimeoutModal] = useState(false);
    const pathname = usePathname();

    useEffect(() => {
        // Handler for custom auth-error event dispatched by API client
        const handleAuthError = () => {
            // Only show if we thought we had a session but the API says otherwise
            if (status === "authenticated") {
                setShowTimeoutModal(true);
            }
        };

        window.addEventListener("auth-error", handleAuthError);
        return () => window.removeEventListener("auth-error", handleAuthError);
    }, [status]);

    useEffect(() => {
        // If NextAuth detects unauthenticated state on a protected route (naive check),
        // we could also trigger it, but usually NextAuth middleware handles redirects.
        // This is primarily for when the session expires *while* the user is on the page
        // and makes an API call.

        // We can also periodically check session expiry if needed, but the API interceptor
        // is more robust for "action-based" expiry detection.
    }, [status, session]);

    // Don't show modal on login page
    if (pathname === '/login') return null;

    return (
        <SessionTimeoutModal
            isOpen={showTimeoutModal}
            onClose={() => setShowTimeoutModal(false)}
        />
    );
}
