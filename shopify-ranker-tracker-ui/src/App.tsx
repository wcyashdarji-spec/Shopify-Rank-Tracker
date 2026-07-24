// React
import { useEffect, useRef, useState } from "react";

// Material UI
import { Alert, Button, Snackbar, Typography, Box } from "@mui/material";
import CssBaseline from "@mui/material/CssBaseline";
import { Refresh as RefreshIcon } from "@mui/icons-material";
import { ThemeProvider, createTheme } from "@mui/material/styles";

// API
import { api, getApiBaseUrl, setApiBaseUrl, getToken, logout, type App as AppType } from "./api";

// Components
import Dashboard from "./components/DashBoard";
import HistoryPage from "./components/HistoryPage";
import Layout from "./components/Layout";
import PageHeader from "./components/PageHeader";
import LoginRegister from "./components/LoginRegister";

const theme = createTheme({
  palette: {
    mode: "light",
    primary: { main: "#111827" },
    secondary: { main: "#f97316" },
  },
});

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(!!getToken());
  const [page, setPage] = useState<"dashboard" | "history">("dashboard");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // ─── Shared state (needed by Sidebar on every page) ───────────────────────
  const [apps, setApps] = useState<AppType[]>([]);
  const [selectedApp, setSelectedApp] = useState<AppType | null>(null);
  const [apiUrl, setApiUrl] = useState(getApiBaseUrl());
  const [isLoadingApps, setIsLoadingApps] = useState(false);
  const [isScraping, setIsScraping] = useState(false);
  const [scrapingLogs, setScrapingLogs] = useState<string[]>([]);
  const [toast, setToast] = useState<{ message: string; severity: "success" | "error" | "info" } | null>(null);
  const logsConsoleRef = useRef<HTMLDivElement>(null);

  const showToast = (message: string, severity: "success" | "error" | "info" = "info") => {
    setToast((prev) => {
      if (prev && prev.message === message && prev.severity === severity) {
        return prev;
      }
      return { message, severity };
    });
  };

  const fetchApps = async (selectFirst = false) => {
    setIsLoadingApps(true);
    try {
      const response = await api.getApps();
      setApps(response.apps || []);
      if (selectFirst && response.apps?.length > 0) setSelectedApp(response.apps[0]);
    } catch (err: any) {
      if (
        err?.message?.includes("expired") ||
        err?.message?.includes("token") ||
        err?.message?.includes("credentials")
      ) {
        return;
      }
      showToast(err?.message || "Failed to load apps", "error");
    } finally {
      setIsLoadingApps(false);
    }
  };

  const handleLogout = () => {
    logout();
    setIsAuthenticated(false);
    setApps([]);
    setSelectedApp(null);
    showToast("Logged out successfully", "info");
  };

  const handleSessionExpired = (message: string) => {
    logout();
    setIsAuthenticated(false);
    setApps([]);
    setSelectedApp(null);
    showToast(message, "error");
  };

  useEffect(() => {
    const handleUnauthorized = (e: Event) => {
      const customEvent = e as CustomEvent;
      const message = customEvent.detail || "Session expired. Please log in again.";
      handleSessionExpired(message);
    };

    window.addEventListener("unauthorized-token-expiration", handleUnauthorized);
    return () => {
      window.removeEventListener("unauthorized-token-expiration", handleUnauthorized);
    };
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      fetchApps(true);
    }
  }, [isAuthenticated]);

  const handleAppSelect = (app: AppType) => {
    setSelectedApp(app);
    setPage("dashboard");
  };

  const handleSaveSettings = (url: string) => {
    setApiBaseUrl(url);
    setApiUrl(url);
    showToast(`API set to ${url}`, "success");
    fetchApps(true);
  };

  const startFakeScraperLogs = (appName: string, keywords: string[]) => {
    let index = 0;
    const logs = [
      "[Playwright] Spawning isolated browser session (headless=true)...",
      "[Browser] Navigating to https://apps.shopify.com...",
      "[Browser] Home page loaded. Locating search inputs...",
      ...keywords.flatMap((kw) => [
        `[Scraper] Searching for keyword: '${kw}'`,
        `[Scraper] Parsing search result list on page 1...`,
        `[Scraper] App '${appName}' found? Scanning page list nodes...`,
        `[Capture] Snapping view screenshot for '${kw}'...`,
      ]),
      "[DB] Writing transaction log entries into table...",
      "[DB] Ranking results saved successfully.",
    ];
    const interval = setInterval(() => {
      if (index < logs.length) {
        setScrapingLogs((prev) => [...prev, logs[index]]);
        index++;
      }
    }, 2000);
    return interval;
  };

  const handleTrackApp = async (name: string, url: string, keywordsList: string[]) => {
    setIsScraping(true);
    setScrapingLogs([`[System] Submitting track request for '${name}'...`]);
    const interval = startFakeScraperLogs(name, keywordsList);
    try {
      const response = await api.runTracker(name, url, keywordsList);
      clearInterval(interval);
      setScrapingLogs((prev) => [
        ...prev,
        "[Done] Scraper finished tracking successfully!",
        `[Done] Saved ${response.results.length} keyword metrics.`,
      ]);
      showToast(`Tracked app: ${name}`, "success");
      await fetchApps();
      const updated = await api.getApps();
      const newApp = updated.apps.find((a) => a.name.toLowerCase() === name.toLowerCase().trim());
      if (newApp) setSelectedApp(newApp);
    } catch (err: any) {
      clearInterval(interval);
      setScrapingLogs((prev) => [...prev, `[ERROR] ${err?.message || String(err)}`]);
      showToast(err?.message || "Scraper failed", "error");
    } finally {
      setTimeout(() => {
        setIsScraping(false);
        setScrapingLogs([]);
      }, 5000);
    }
  };

  const handleDeleteApp = async (appId: number) => {
    try {
      await api.deleteApp(appId);
      showToast("Application deleted successfully", "success");
      const updated = await api.getApps();
      setApps(updated.apps || []);
      if (selectedApp?.id === appId) {
        setSelectedApp(updated.apps.length > 0 ? updated.apps[0] : null);
      }
    } catch (err: any) {
      showToast(err?.message || "Failed to delete application", "error");
    }
  };

  const handleRunAllSaved = async () => {
    setIsScraping(true);
    setScrapingLogs(["[System] Initializing manual run for all saved apps..."]);
    const interval = setInterval(() => {
      const phases = [
        "[Browser] Launching Headless Chromium...",
        "[Database] Fetching all tracking jobs...",
        "[Job Queue] Spawning scrapers...",
        "[Status] Running scrape cycles...",
        "[Info] Saving rank outputs...",
      ];
      setScrapingLogs((prev) => [...prev, phases[Math.floor(Math.random() * phases.length)]]);
    }, 4000);
    try {
      const res = await api.runSavedApps();
      clearInterval(interval);
      setScrapingLogs((prev) => [
        ...prev,
        "[Done] Run finished!",
        `[Done] ${res?.message || "Saved apps tracking completed."}`
      ]);
      showToast("All apps re-scraped!", "success");
      await fetchApps();
    } catch (err: any) {
      clearInterval(interval);
      setScrapingLogs((prev) => [...prev, `[ERROR] ${err?.message || String(err)}`]);
      showToast(err?.message || "Run failed", "error");
    } finally {
      setTimeout(() => {
        setIsScraping(false);
        setScrapingLogs([]);
      }, 5000);
    }
  };

  const headerContent =
    page === "dashboard" ? (
      <PageHeader
        title="Shopify App Store Index"
        actions={
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 1,
                ml: "auto",
              }}
            >
              {selectedApp && (
                <Button
                  size="small"
                  startIcon={<RefreshIcon sx={{ fontSize: 15 }} />}
                  onClick={() =>
                    handleTrackApp(
                      selectedApp.name,
                      selectedApp.url,
                      selectedApp.keywords.map((k) => k.name)
                    )
                  }
                  sx={{
                    fontSize: 13,
                    color: "#6b7280",
                    border: "1px solid #e5e7eb",
                    borderRadius: "8px",
                    px: 1.5,
                    py: 0.5,
                  }}
                >
                  Rescrape
                </Button>
              )}

              <Typography
                sx={{
                  fontSize: 13,
                  color: "#f97316",
                  fontWeight: 500,
                  cursor: "pointer",
                }}
              >
                Need help?
              </Typography>
            </Box>
          }
      />
    ) : (
      <PageHeader
        title="History Log"
        subtitle="See when each tracked app was last checked for keyword rankings."
      />
    );  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {!isAuthenticated ? (
        <LoginRegister onLoginSuccess={() => setIsAuthenticated(true)} />
      ) : (
        <Layout
          apps={apps}
          selectedApp={selectedApp}
          onSelectApp={handleAppSelect}
          onRunAllSaved={handleRunAllSaved}
          onTrackApp={handleTrackApp}
          onDeleteApp={handleDeleteApp}
          isScraping={isScraping}
          scrapingLogs={scrapingLogs}
          logsConsoleRef={logsConsoleRef}
          isLoadingApps={isLoadingApps}
          apiUrl={apiUrl}
          onSaveSettings={handleSaveSettings}
          currentPage={page}
          onNavigate={setPage}
          headerContent={headerContent}
          sidebarCollapsed={sidebarCollapsed}
          onToggleSidebar={() => setSidebarCollapsed((prev) => !prev)}
          onLogout={handleLogout}
        >
          {page === "dashboard" ? (
            <Dashboard
              selectedApp={selectedApp}
              apiUrl={apiUrl}
              onRefreshApps={fetchApps}
              onUpdateSelectedApp={setSelectedApp}
              showToast={showToast}
            />
          ) : (
            <HistoryPage />
          )}
        </Layout>
      )}

      <Snackbar
        open={!!toast}
        autoHideDuration={4000}
        onClose={() => setToast(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
      >
        {toast ? (
          <Alert
            onClose={() => setToast(null)}
            severity={toast.severity}
            variant="filled"
            sx={{ borderRadius: "10px", boxShadow: "0 8px 32px rgba(0,0,0,0.12)" }}
          >
            {toast.message}
          </Alert>
        ) : undefined}
      </Snackbar>
    </ThemeProvider>
  );
}