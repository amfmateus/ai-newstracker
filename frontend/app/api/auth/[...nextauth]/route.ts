import NextAuth, { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";

// For development convenience
const devProviders = [];

// Add Credentials provider only in development for quick testing without internet/oauth
if (process.env.NODE_ENV === 'development') {
    devProviders.push(
        CredentialsProvider({
            name: "Dev Mode (No Auth)",
            credentials: {
                username: { label: "Username", type: "text", placeholder: "dev_user" }
            },
            async authorize(credentials, req) {
                // Return a mock user
                return {
                    id: "1",
                    name: "Dev User",
                    email: credentials?.username + "@example.com" || "dev@example.com"
                };
            }
        })
    );
}

export const authOptions: NextAuthOptions = {
    providers: [
        GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID || "",
            clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
            authorization: {
                params: {
                    prompt: "consent",
                    access_type: "offline",
                    response_type: "code"
                }
            }
        }),
        ...devProviders
    ],
    callbacks: {
        async jwt({ token, account, user }) {
            // --- Email Allowlist ---
            // Read comma-separated emails from env, e.g. "alice@gmail.com,bob@gmail.com"
            const allowedRaw = process.env.ALLOWED_EMAILS || '';
            const allowedEmails = allowedRaw
                .split(',')
                .map(e => e.trim().toLowerCase())
                .filter(Boolean);

            // If a list is configured and the email is not on it, block the login.
            if (allowedEmails.length > 0 && token.email) {
                if (!allowedEmails.includes(token.email.toLowerCase())) {
                    // Returning null rejects the token and blocks the session.
                    return null as any;
                }
            }
            // --- End Allowlist ---

            // Persist the OAuth access_token to the token right after signin
            if (account && account.id_token) {
                token.id_token = account.id_token;
            }
            if (token.email?.endsWith('@example.com')) {
                token.is_mock = true;
                token.id_token = "mock-token-dev";
            }
            return token;
        },
        async session({ session, token }) {
            // Send properties to the client, like an access_token from a provider.
            // @ts-ignore
            session.id_token = token.id_token;
            // @ts-ignore
            session.is_mock = token.is_mock;
            return session;
        }
    },
    pages: {
        signIn: '/login',
    },
    session: {
        strategy: "jwt",
    },
    secret: process.env.NEXTAUTH_SECRET,
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
