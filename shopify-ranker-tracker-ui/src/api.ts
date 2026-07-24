// API configurations and client functions

export interface Keyword {
  id: number;
  name: string;
}

export interface App {
  id: number;
  name: string;
  url: string;
  created_at: string;
  history_count: number;
  keywords: Keyword[];
}

export interface HistoryRecord {
  id: number;
  rank: number | null;
  page: number | null;
  found: boolean;
  screenshot_path: string | null;
  tracked_date: string;
}

export interface Competitor {
  id: number;
  name: string;
  url: string;
  created_at: string;
  history_count: number;
}

export interface CompetitorHistory {
  id: number;
  name: string;
  url: string;
  history: HistoryRecord[];
  averages: {
    "7_days": number | null;
    "30_days": number | null;
    "3_months": number | null;
    "6_months": number | null;
    "12_months": number | null;
  };
}

export interface KeywordHistory {
  keyword: Keyword;
  history: HistoryRecord[];
  averages: {
    "7_days": number | null;
    "30_days": number | null;
    "3_months": number | null;
    "6_months": number | null;
    "12_months": number | null;
  };
  competitors?: CompetitorHistory[];
}

export interface AppHistoryResponse {
  app: { id: number; name: string; url: string };
  keywords: KeywordHistory[];
}

export interface TrackerResult {
  app_name: string;
  app_url: string;
  keyword: string;
  rank: number | null;
  page: number | null;
  found: boolean;
  screenshot: string | null;
}

export interface RunTrackerResponse {
  message: string;
  results: TrackerResult[];
}

export interface AppLastSync {
  id: number;
  name: string;
  url: string;
  last_synced_at: string | null;
}

// Manage API base URL in localStorage
const STORAGE_KEY = "shopify_tracker_api_url";
const DEFAULT_API_URL = "http://127.0.0.1:8004";
const TOKEN_KEY = "shopify_tracker_token";

export function getApiBaseUrl(): string {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) return stored;
  return DEFAULT_API_URL;
}

export function setApiBaseUrl(url: string): void {
  localStorage.setItem(STORAGE_KEY, url.trim().replace(/\/$/, ""));
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null): void {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
}

export function logout(): void {
  setToken(null);
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const baseUrl = getApiBaseUrl();
  const url = `${baseUrl}${path}`;
  
  const headers = new Headers(options?.headers);
  const token = getToken();
  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let errorText = "";
    try {
      const errJson = await response.json();
      errorText = errJson.detail || JSON.stringify(errJson);
    } catch {
      errorText = await response.text();
    }
    
    if (response.status === 401 && !path.includes("/auth/login")) {
      logout();
      window.dispatchEvent(
        new CustomEvent("unauthorized-token-expiration", { detail: errorText })
      );
    }

    throw new Error(errorText || `API error: ${response.status} ${response.statusText}`);
  }

  return response.json() as Promise<T>;
}

export const api = {
  // Register a new account
  async register(email: string, password: string): Promise<{ message: string; user: { id: number; email: string } }> {
    return request<{ message: string; user: { id: number; email: string } }>("/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
  },

  // Log into existing account
  async login(email: string, password: string): Promise<{ access_token: string; token_type: string; user: { id: number; email: string } }> {
    const res = await request<{ access_token: string; token_type: string; user: { id: number; email: string } }>("/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    setToken(res.access_token);
    return res;
  },

  // Get all apps
  async getApps(): Promise<{ apps: App[] }> {
    return request<{ apps: App[] }>("/apps/apps");
  },

  // Submit and run tracker for new app
  async runTracker(name: string, url: string, keywords: string[]): Promise<RunTrackerResponse> {
    return request<RunTrackerResponse>("/tracker/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        apps: [
          {
            name,
            url,
            keywords,
          },
        ],
      }),
    });
  },

  // Add keywords to an existing app
  async addKeywords(
    appId: number,
    keywords: string[]
  ): Promise<{ app: any; keywords: Keyword[]; added: Keyword[] }> {
    return request<{ app: any; keywords: Keyword[]; added: Keyword[] }>(
      `/keywords/apps/${appId}/keywords`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keywords }),
      }
    );
  },

  // Remove keyword association
  async removeKeyword(appId: number, keywordId: number): Promise<any> {
    return request<any>(`/keywords/apps/${appId}/keywords/${keywordId}`, {
      method: "DELETE",
    });
  },

  // Get ranking history for selected keywords (multi-query format)
  async getHistory(appId: number, keywordIds: number[], days: number = 365): Promise<AppHistoryResponse> {
    const params = new URLSearchParams();
    params.append("days", days.toString());
    keywordIds.forEach((id) => params.append("keyword_ids", id.toString()));

    return request<AppHistoryResponse>(`/tracker/history/${appId}?${params.toString()}`);
  },

  // Trigger runs for all saved apps (runs in background)
  async runSavedApps(): Promise<{ message: string; results: any[] }> {
    return request<{ message: string; results: any[] }>("/tracker/run/saved", {
      method: "POST",
    });
  },
  
  async deleteApp(appId: number): Promise<{ message: string }> {
    return request<{ message: string }>(`/apps/apps/${appId}`, {
      method: "DELETE",
    });
  },
  
  async getAppsLastSync(): Promise<{ apps: AppLastSync[] }> {
    return request<{ apps: AppLastSync[] }>("/tracker/apps/last-sync");
  },

  // Get competitors for an app
  async getCompetitors(appId: number): Promise<{ competitors: Competitor[] }> {
    return request<{ competitors: Competitor[] }>(`/apps/${appId}/competitors`);
  },

  // Add competitor to an app
  async addCompetitor(appId: number, name: string, url: string): Promise<{ competitor: Competitor }> {
    return request<{ competitor: Competitor }>(`/apps/${appId}/competitors`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, url }),
    });
  },

  // Remove competitor from an app
  async removeCompetitor(appId: number, competitorId: number): Promise<any> {
    return request<any>(`/apps/${appId}/competitors/${competitorId}`, {
      method: "DELETE",
    });
  },  
};
