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
const DEFAULT_API_URL = "https://aitools.webcontrive.com/app";

export function getApiBaseUrl(): string {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) return stored;
  return DEFAULT_API_URL;
}

export function setApiBaseUrl(url: string): void {
  localStorage.setItem(STORAGE_KEY, url.trim().replace(/\/$/, ""));
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const baseUrl = getApiBaseUrl();
  const url = `${baseUrl}${path}`;
  const response = await fetch(url, options);

  if (!response.ok) {
    let errorText = "";
    try {
      const errJson = await response.json();
      errorText = errJson.detail || JSON.stringify(errJson);
    } catch {
      errorText = await response.text();
    }
    throw new Error(errorText || `API error: ${response.status} ${response.statusText}`);
  }

  return response.json() as Promise<T>;
}

export const api = {
  // Get all apps
  async getApps(): Promise<{ apps: App[] }> {
    return request<{ apps: App[] }>("/tracker/apps");
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
      `/tracker/apps/${appId}/keywords`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keywords }),
      }
    );
  },

  // Remove keyword association
  async removeKeyword(appId: number, keywordId: number): Promise<any> {
    return request<any>(`/tracker/apps/${appId}/keywords/${keywordId}`, {
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
    return request<{ message: string }>(`/tracker/apps/${appId}`, {
      method: "DELETE",
    });
  },
  
  async getAppsLastSync(): Promise<{ apps: AppLastSync[] }> {
    return request<{ apps: AppLastSync[] }>("/tracker/apps/last-sync");
  },
  
};
