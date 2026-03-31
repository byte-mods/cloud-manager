import NextAuth, { type NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import GitHubProvider from "next-auth/providers/github";
import AzureADProvider from "next-auth/providers/azure-ad";
import { apiClient } from "./api-client";

// Build the list of OAuth providers conditionally based on env vars
const oauthProviders = [];

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  oauthProviders.push(
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    })
  );
}

if (process.env.GITHUB_ID && process.env.GITHUB_SECRET) {
  oauthProviders.push(
    GitHubProvider({
      clientId: process.env.GITHUB_ID,
      clientSecret: process.env.GITHUB_SECRET,
    })
  );
}

if (
  process.env.AZURE_AD_CLIENT_ID &&
  process.env.AZURE_AD_CLIENT_SECRET &&
  process.env.AZURE_AD_TENANT_ID
) {
  oauthProviders.push(
    AzureADProvider({
      clientId: process.env.AZURE_AD_CLIENT_ID,
      clientSecret: process.env.AZURE_AD_CLIENT_SECRET,
      tenantId: process.env.AZURE_AD_TENANT_ID,
    })
  );
}

export const authOptions: NextAuthOptions = {
  providers: [
    ...oauthProviders,
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        mfaCode: { label: "MFA Code", type: "text" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        // Demo accounts for local development (no backend required)
        const demoAccounts: Record<string, { password: string; name: string; role: string }> = {
          "admin@cloudmanager.dev": { password: "admin123", name: "Admin User", role: "cloud_architect" },
          "devops@cloudmanager.dev": { password: "devops123", name: "DevOps Engineer", role: "devops_engineer" },
          "data@cloudmanager.dev": { password: "data123", name: "Data Engineer", role: "data_engineer" },
          "sysadmin@cloudmanager.dev": { password: "sysadmin123", name: "System Admin", role: "system_admin" },
          "network@cloudmanager.dev": { password: "network123", name: "Network Admin", role: "network_admin" },
        };

        const demo = demoAccounts[credentials.email];
        if (demo && credentials.password === demo.password) {
          return {
            id: credentials.email.split("@")[0],
            email: credentials.email,
            name: demo.name,
            role: demo.role,
            accessToken: "demo-token",
          };
        }

        // Try real backend auth if not a demo account
        try {
          const loginData: Record<string, string> = {
            email: credentials.email,
            password: credentials.password,
          };

          if (credentials.mfaCode) {
            loginData.mfa_code = credentials.mfaCode;
          }

          const response = await apiClient.post<{
            user: {
              id: string;
              email: string;
              name: string;
              role: string;
              avatar?: string;
              mfaEnabled: boolean;
              organization?: string;
            };
            access_token: string;
          }>("/api/v1/auth/login", loginData);

          if (response.user) {
            return {
              id: response.user.id,
              email: response.user.email,
              name: response.user.name,
              role: response.user.role,
              image: response.user.avatar,
              accessToken: response.access_token,
            };
          }

          return null;
        } catch {
          return null;
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, account }) {
      if (user) {
        token.id = user.id;
        // For OAuth providers, default to cloud_architect role
        token.role = (user as any).role ?? "cloud_architect";
        // For OAuth providers, use the provider's access token
        token.accessToken =
          (user as any).accessToken ?? account?.access_token ?? "";
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.id;
        (session.user as any).role = token.role;
        (session.user as any).accessToken = token.accessToken;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  session: {
    strategy: "jwt",
    maxAge: 15 * 60, // 15 minutes - access token expiry
  },
  jwt: {
    maxAge: 15 * 60, // 15 minutes
  },
};

export default NextAuth(authOptions);
