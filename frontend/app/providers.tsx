"use client";

import { SessionProvider } from "next-auth/react";
import SessionMonitor from "./components/SessionMonitor";

export function Providers({ children }: { children: React.ReactNode }) {
    return (
        <SessionProvider>
            <SessionMonitor />
            {children}
        </SessionProvider>
    );
}
