const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000/api/v1";

export class ApiError extends Error {
  constructor(
    public status: number,
    public statusText: string,
    public body?: unknown
  ) {
    super(`API Error: ${status} ${statusText}`);
    this.name = "ApiError";
  }
}

async function getAuthHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  // In a browser context, retrieve the session token
  if (typeof window !== "undefined") {
    try {
      const { getSession } = await import("next-auth/react");
      const session = await getSession();
      if ((session?.user as any)?.accessToken) {
        headers["Authorization"] = `Bearer ${(session.user as any).accessToken}`;
      }
    } catch {
      // next-auth not configured yet, continue without auth
    }
  }

  return headers;
}

const MAX_RETRIES = 3;
const RETRY_STATUS_CODES = [408, 429, 500, 502, 503, 504];

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const authHeaders = await getAuthHeaders();

  let lastError: ApiError | Error | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(`${BASE_URL}${endpoint}`, {
        ...options,
        headers: {
          ...authHeaders,
          ...options.headers,
        },
      });

      if (!response.ok) {
        let body: unknown;
        try {
          body = await response.json();
        } catch {
          body = await response.text();
        }
        const error = new ApiError(response.status, response.statusText, body);

        // Retry on transient errors (not on 4xx client errors except 408/429)
        if (RETRY_STATUS_CODES.includes(response.status) && attempt < MAX_RETRIES) {
          lastError = error;
          const delay = Math.min(1000 * Math.pow(2, attempt), 10000);
          const jitter = Math.random() * 500;
          await sleep(delay + jitter);
          continue;
        }

        throw error;
      }

      // Handle 204 No Content
      if (response.status === 204) {
        return undefined as T;
      }

      return response.json() as Promise<T>;
    } catch (error) {
      if (error instanceof ApiError) throw error;

      // Network error — retry
      lastError = error as Error;
      if (attempt < MAX_RETRIES) {
        const delay = Math.min(1000 * Math.pow(2, attempt), 10000);
        await sleep(delay);
        continue;
      }
    }
  }

  throw lastError ?? new Error("Request failed after retries");
}

export const apiClient = {
  get<T>(endpoint: string, options?: RequestInit): Promise<T> {
    return request<T>(endpoint, { ...options, method: "GET" });
  },

  post<T>(endpoint: string, data?: unknown, options?: RequestInit): Promise<T> {
    return request<T>(endpoint, {
      ...options,
      method: "POST",
      body: data ? JSON.stringify(data) : undefined,
    });
  },

  put<T>(endpoint: string, data?: unknown, options?: RequestInit): Promise<T> {
    return request<T>(endpoint, {
      ...options,
      method: "PUT",
      body: data ? JSON.stringify(data) : undefined,
    });
  },

  patch<T>(endpoint: string, data?: unknown, options?: RequestInit): Promise<T> {
    return request<T>(endpoint, {
      ...options,
      method: "PATCH",
      body: data ? JSON.stringify(data) : undefined,
    });
  },

  delete<T>(endpoint: string, options?: RequestInit): Promise<T> {
    return request<T>(endpoint, { ...options, method: "DELETE" });
  },
};

// Augment next-auth session type
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: string;
      accessToken: string;
      email: string;
      name: string;
    };
  }
}
