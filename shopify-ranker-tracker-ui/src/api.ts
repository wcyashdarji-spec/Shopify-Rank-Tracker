// API configurations and client functions

export interface Keyword {
  id: number;
  name: string;
}

export interface App {
  id: number;
  user_id?: number;
  name: string;
  url: string;
  icon_url?: string | null;
  created_at: string;
  history_count: number;
  keywords: Keyword[];
  audit_last_synced_at?: string | null;
  last_synced_at?: string | null;
  sync_status?: string;
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
  icon_url?: string | null;
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
  icon_url?: string | null;
  last_synced_at: string | null;
  audit_last_synced_at?: string | null;
  sync_status?: string;
}

// Manage API base URL in localStorage
const STORAGE_KEY = "shopify_tracker_api_url";
const DEFAULT_API_URL = import.meta.env.VITE_API_URL;
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
  return sessionStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null): void {
  if (token) {
    sessionStorage.setItem(TOKEN_KEY, token);
  } else {
    sessionStorage.removeItem(TOKEN_KEY);
  }
}

export function logout(): void {
  setToken(null);
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const baseUrl = getApiBaseUrl();
  const cleanBaseUrl = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  const url = `${cleanBaseUrl}${cleanPath}`;
  
  const headers = new Headers(options?.headers);
  const token = getToken();
  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  let response;
  try {
    response = await fetch(url, {
      ...options,
      headers,
    });
  } catch (netErr: any) {
    throw new Error("Connection lost or server is unreachable. Please check your internet connection.");
  }

  if (!response.ok) {
    let rawText = "";
    let parsedDetail = "";
    try {
      rawText = await response.text();
      try {
        const errJson = JSON.parse(rawText);
        parsedDetail = errJson.detail || (typeof errJson === 'string' ? errJson : JSON.stringify(errJson));
      } catch {
        parsedDetail = rawText;
      }
    } catch {
      // ignore
    }

    let errorText = "";
    if (response.status === 504 || response.status === 502) {
      if (path.includes("/tracker/run")) {
        errorText = "The sync is taking longer than expected but is continuing to run in the background. Please wait a moment and refresh.";
      } else {
        errorText = "The server is busy or unreachable. Please try again in a few seconds.";
      }
    } else if (response.status === 401 && !path.includes("/auth/login")) {
      logout();
      window.dispatchEvent(
        new CustomEvent("unauthorized-token-expiration", { detail: parsedDetail || "Session expired." })
      );
      errorText = "Your session has expired. Please log in again.";
    } else if (response.status === 403) {
      errorText = parsedDetail || "Access denied. You do not have permission to perform this action.";
    } else if (response.status === 404) {
      errorText = parsedDetail || "The requested resource could not be found.";
    } else if (response.status === 500) {
      errorText = parsedDetail || "Internal server error. Please try again later.";
    } else {
      errorText = parsedDetail || `API error: ${response.status} ${response.statusText}`;
    }

    throw new Error(errorText);
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

  // Get Google OAuth 2.0 redirect URL
  async getGoogleAuthUrl(redirect_uri?: string): Promise<{ url: string; client_id: string; redirect_uri: string }> {
    const params = new URLSearchParams();
    if (redirect_uri) params.append("redirect_uri", redirect_uri);
    return request<{ url: string; client_id: string; redirect_uri: string }>(`/auth/google/url?${params.toString()}`);
  },

  // Handle Google OAuth 2.0 authorization code exchange
  async googleOAuthCallback(code: string, redirect_uri?: string): Promise<{ access_token: string; token_type: string; user: { id: number; email: string } }> {
    const res = await request<{ access_token: string; token_type: string; user: { id: number; email: string } }>("/auth/google/callback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, redirect_uri }),
    });
    setToken(res.access_token);
    return res;
  },

  // Log out of existing session
  async logout(): Promise<{ message: string }> {
    try {
      return await request<{ message: string }>("/auth/logout", {
        method: "POST",
      });
    } finally {
      setToken(null);
    }
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
  async getCompetitors(appId: number): Promise<any> {
    return request<any>(`/apps/${appId}/competitors`);
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

  // Get logged in user details
  async getMe(): Promise<{ id: number; email: string; created_at: string | null }> {
    return request<{ id: number; email: string; created_at: string | null }>("/auth/me");
  },

  // Update user profile details
  async updateMe(email?: string, password?: string): Promise<{ message: string; user: { id: number; email: string } }> {
    const body: any = {};
    if (email) body.email = email;
    if (password) body.password = password;

    return request<{ message: string; user: { id: number; email: string } }>("/auth/me", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  },

  // Invite a collaborator to access an app by email
  async inviteCollaborator(appId: number, email: string): Promise<{ message: string; invitation: any }> {
    return request<{ message: string; invitation: any }>(`/collaborators/apps/${appId}/invite`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
  },

  // Get pending invitations for logged-in user
  async getPendingInvitations(): Promise<{ invitations: any[] }> {
    return request<{ invitations: any[] }>("/collaborators/invitations/pending");
  },

  // Accept a collaborator invitation
  async acceptInvitation(inviteId: number): Promise<{ message: string }> {
    return request<{ message: string }>(`/collaborators/invitations/${inviteId}/accept`, {
      method: "POST",
    });
  },

  // Decline a collaborator invitation
  async declineInvitation(inviteId: number): Promise<{ message: string }> {
    return request<{ message: string }>(`/collaborators/invitations/${inviteId}/decline`, {
      method: "POST",
    });
  },

  // Get collaborators and pending invitations for an app
  async getAppCollaborators(appId: number): Promise<{ owner: string | null; collaborators: string[]; pending_invitations: string[] }> {
    return request<{ owner: string | null; collaborators: string[]; pending_invitations: string[] }>(`/collaborators/apps/${appId}/collaborators`);
  },

  // Get listing audit data for an app
  async getListingAudit(appId: number): Promise<any> {
    return request<any>(`/apps/${appId}/listing-audit`);
  },

  // Force re-run listing audit for an app
  async runListingAudit(appId: number): Promise<any> {
    return request<any>(`/apps/${appId}/listing-audit`, {
      method: "POST",
    });
  },

  // Get competitors day-over-day activity changes
  async getCompetitorsActivity(appId: number): Promise<any> {
    return request<any>(`/apps/${appId}/competitors-activity`);
  },

  // Get head-to-head comparison stats
  async getHeadToHead(appId: number, competitorId: number): Promise<any> {
    return request<any>(`/apps/${appId}/head-to-head/${competitorId}`);
  },

  // Get user's Slack integrations
  async getSlackIntegrations(): Promise<SlackIntegrationsResponse> {
    return request<SlackIntegrationsResponse>("/integrations/slack");
  },

  // Add new Slack workspace integration
  async addSlackIntegration(
    workspace_name: string,
    webhook_url?: string,
    bot_token?: string,
    channel_name?: string
  ): Promise<{ message: string; integration: SlackIntegrationItem }> {
    return request<{ message: string; integration: SlackIntegrationItem }>("/integrations/slack", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspace_name, webhook_url, bot_token, channel_name }),
    });
  },

  // Save selected active Slack workspace
  async saveSlackIntegration(selected_integration_id: number | null): Promise<{ message: string }> {
    return request<{ message: string }>("/integrations/slack/save", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ selected_integration_id }),
    });
  },

  // Remove single Slack integration
  async deleteSlackIntegration(integrationId: number): Promise<{ message: string }> {
    return request<{ message: string }>(`/integrations/slack/${integrationId}`, {
      method: "DELETE",
    });
  },

  // Remove all Slack integrations
  async removeAllSlackIntegrations(): Promise<{ message: string }> {
    return request<{ message: string }>("/integrations/slack", {
      method: "DELETE",
    });
  },

  // Automatically detect workspace name based on current user profile & apps
  async autoDetectSlackWorkspace(): Promise<{ workspace_name: string; suggested_workspaces: string[]; user_email: string }> {
    return request<{ workspace_name: string; suggested_workspaces: string[]; user_email: string }>("/integrations/slack/auto-detect-workspace");
  },

  // Get backend-generated Slack OAuth2 URL
  async getSlackAuthorizeUrl(): Promise<{ configured: boolean; url: string | null; message?: string }> {
    return request<{ configured: boolean; url: string | null; message?: string }>("/integrations/slack/authorize-url");
  },

  // Trigger backend-managed OAuth2 token exchange & registration
  async simulateSlackOAuth(
    workspace_name: string,
    channel_name?: string
  ): Promise<{ message: string; integration: SlackIntegrationItem }> {
    return request<{ message: string; integration: SlackIntegrationItem }>("/integrations/slack/oauth/simulate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspace_name, channel_name }),
    });
  },

  // Send a test Slack notification
  async sendTestSlackNotification(): Promise<{ message: string }> {
    return request<{ message: string }>("/integrations/slack/test-notification", {
      method: "POST",
    });
  },
};

export interface SlackIntegrationItem {
  id: number;
  workspace_name: string;
  webhook_url?: string | null;
  bot_token?: string | null;
  channel_name?: string | null;
  is_active: boolean;
  created_at?: string | null;
}

export interface SlackIntegrationsResponse {
  integrations: SlackIntegrationItem[];
  selected_integration_id: number | null;
  is_connected: boolean;
}

