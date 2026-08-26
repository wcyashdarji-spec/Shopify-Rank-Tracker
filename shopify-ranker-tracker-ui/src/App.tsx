// React
import { useEffect, useState, lazy, Suspense } from "react";

// Material UI
import { Alert, Button, Snackbar, Box, CircularProgress } from "@mui/material";
import CssBaseline from "@mui/material/CssBaseline";
import RefreshIcon from "@mui/icons-material/Refresh";
import HelpOutlineIcon from "@mui/icons-material/HelpOutlineOutlined";
import { ThemeProvider, createTheme } from "@mui/material/styles";

// API
import { api, getApiBaseUrl, getToken, logout, type App as AppType } from "./api";

// Core Components
import Layout from "./components/Layout";
import PageHeader from "./components/PageHeader";
import LoginRegister from "./components/LoginRegister";

// Lazy loaded page components
// Lazy loaded page components
const Dashboard = lazy(() => import("./components/DashBoard"));
const HistoryPage = lazy(() => import("./components/HistoryPage"));
const ProfilePage = lazy(() => import("./components/ProfilePage"));
const ListingOptimizer = lazy(() => import("./components/ListingOptimizer"));
const CompetitorsPage = lazy(() => import("./components/CompetitorsPage"));
const IntegrationsPage = lazy(() => import("./components/IntegrationsPage"));

const theme = createTheme({
  palette: {
    mode: "light",
    primary: { main: "#111827" },
    secondary: { main: "#f97316" },
  },
});

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(!!getToken());
  const [page, setPage] = useState<"dashboard" | "history" | "settings" | "optimizer" | "competitors" | "integrations">("dashboard");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [invitations, setInvitations] = useState<any[]>([]);

  // ─── Shared state (needed by Sidebar on every page) ───────────────────────
  const [apps, setApps] = useState<AppType[]>([]);
  const [selectedApp, setSelectedApp] = useState<AppType | null>(null);
  const [apiUrl] = useState(getApiBaseUrl());
  const [isLoadingApps, setIsLoadingApps] = useState(false);
  const [toast, setToast] = useState<{ message: string; severity: "success" | "error" | "info" } | null>(null);

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
      const newApps = response.apps || [];
      setApps(newApps);
      if (selectFirst && newApps.length > 0) {
        setSelectedApp(newApps[0]);
      } else {
        setSelectedApp((prev) => {
          if (!prev) return null;
          const fresh = newApps.find((a) => a.id === prev.id);
          return fresh || prev;
        });
      }
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

  const fetchInvitations = async () => {
    try {
      const res = await api.getPendingInvitations();
      setInvitations(res.invitations || []);
    } catch (err) {
      console.error("Failed to fetch pending invitations", err);
    }
  };

  const handleAcceptInvitation = async (inviteId: number) => {
    try {
      const res = await api.acceptInvitation(inviteId);
      showToast(res.message, "success");
      await fetchApps();
      await fetchInvitations();
    } catch (err: any) {
      showToast(err?.message || "Failed to accept invitation", "error");
    }
  };

  const handleDeclineInvitation = async (inviteId: number) => {
    try {
      const res = await api.declineInvitation(inviteId);
      showToast(res.message, "info");
      await fetchInvitations();
    } catch (err: any) {
      showToast(err?.message || "Failed to decline invitation", "error");
    }
  };

  const handleLogout = async () => {
    try {
      await api.logout();
    } catch (err) {
      console.error("Failed to logout on backend", err);
    }
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
    // Check for Slack OAuth redirect query params and clean URL bar
    const params = new URLSearchParams(window.location.search);
    if (params.get("slack_connected") === "true") {
      const ws = params.get("workspace") || "Slack Workspace";
      showToast(`🎉 Backend OAuth2 Authorization complete! Connected to '${ws}'.`, "success");
      window.history.replaceState({}, document.title, window.location.pathname);
      setPage("integrations");
    } else if (params.get("slack_error")) {
      showToast(`Slack OAuth Error: ${params.get("slack_error")}`, "error");
      window.history.replaceState({}, document.title, window.location.pathname);
      setPage("integrations");
    }

    if (isAuthenticated) {
      fetchApps(true);
      fetchInvitations();
    }
  }, [isAuthenticated]);

  const isAnyAppSyncing = apps.some((app) => app.sync_status === "syncing");

  useEffect(() => {
    if (!isAnyAppSyncing) return;

    const interval = setInterval(async () => {
      try {
        await fetchApps();
      } catch (err) {
        console.error("Failed to poll apps sync status", err);
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [isAnyAppSyncing]);

  const handleAppSelect = (app: AppType | null) => {
    setSelectedApp(app);
    setPage("dashboard");
  };

  // const handleSaveSettings = (url: string) => {
  const handleTrackApp = (name: string, url: string, keywordsList: string[]) => {
    // Immediately notify the user and run in background
    showToast(
      `⏳ Sync started for '${name}' — running in the background. Results will reflect shortly.`,
      "info"
    );

    // Fire-and-forget: do not await
    (async () => {
      try {
        await api.runTracker(name, url, keywordsList);
        showToast(`✅ Sync complete for '${name}'! Results have been updated.`, "success");
        await fetchApps();
        const updated = await api.getApps();
        const newApp = updated.apps.find((a) => a.name.toLowerCase() === name.toLowerCase().trim());
        if (newApp) setSelectedApp(newApp);
      } catch (err: any) {
        const errMsg = err?.message || "Sync failed";
        const isTimeoutInfo = errMsg.includes("continuing to run in the background");
        showToast(errMsg, isTimeoutInfo ? "info" : "error");
      }
    })();
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

  const handleRunAllSaved = () => {
    // Fire-and-forget: kick off the backend scan and immediately notify the user
    showToast(
      "🔄 Backend scanning started — this may take a few minutes. Check the History page after some time.",
      "info"
    );

    api.runSavedApps()
      .then(() => {
        fetchApps();
      })
      .catch((err: any) => {
        const errMsg = err?.message || "Background scan failed. Please try again.";
        const isTimeoutInfo = errMsg.includes("continuing to run in the background");
        showToast(errMsg, isTimeoutInfo ? "info" : "error");
      });
  };

  const showSelectedAppResync = (() => {
    if (!selectedApp || !selectedApp.last_synced_at) return true;
    const today = new Date();
    const dateStr = selectedApp.last_synced_at.endsWith("Z") ? selectedApp.last_synced_at : `${selectedApp.last_synced_at}Z`;
    const syncDate = new Date(dateStr);
    return (
      syncDate.getFullYear() !== today.getFullYear() ||
      syncDate.getMonth() !== today.getMonth() ||
      syncDate.getDate() !== today.getDate()
    );
  })();

  const headerContent = (() => {
    if (page === "dashboard") {
      const title = selectedApp ? selectedApp.name : "Home Overview";
      const subtitle = selectedApp
        ? selectedApp.url
        : "Overview of tracked Shopify apps & keyword rankings";

      return (
        <PageHeader
          title={title}
          subtitle={subtitle}
          actions={
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 1,
                ml: "auto",
              }}
            >
              {selectedApp && showSelectedAppResync && (
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<RefreshIcon sx={{ fontSize: 14 }} />}
                  onClick={() =>
                    handleTrackApp(
                      selectedApp.name,
                      selectedApp.url,
                      selectedApp.keywords.map((k) => k.name)
                    )
                  }
                  sx={{
                    fontSize: 12.5,
                    fontWeight: 700,
                    textTransform: "none",
                    color: "#475569",
                    borderColor: "#e2e8f0",
                    borderRadius: "8px",
                    px: 1.75,
                    py: 0.5,
                    bgcolor: "#ffffff",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.02)",
                    "&:hover": {
                      borderColor: "#6366f1",
                      color: "#6366f1",
                      bgcolor: "#f8fafc",
                    },
                  }}
                >
                  Re-sync App
                </Button>
              )}

              <Button
                size="small"
                startIcon={<HelpOutlineIcon sx={{ fontSize: 15, color: "#6366f1" }} />}
                onClick={() => showToast("Contact support at support@shopifyranktracker.com", "info")}
                sx={{
                  fontSize: 12.5,
                  fontWeight: 600,
                  textTransform: "none",
                  color: "#475569",
                  bgcolor: "#f1f5f9",
                  borderRadius: "8px",
                  px: 1.5,
                  py: 0.5,
                  "&:hover": {
                    bgcolor: "#e2e8f0",
                    color: "#0f172a",
                  },
                }}
              >
                Need help?
              </Button>
            </Box>
          }
        />
      );
    }

    if (page === "history") {
      return (
        <PageHeader
          title="History Log"
          subtitle="See when each tracked app was last checked for keyword rankings."
        />
      );
    }

    if (page === "optimizer") {
      return (
        <PageHeader
          title="Listing Optimizer"
          subtitle={
            selectedApp
              ? `Audit and optimize App Store listing for ${selectedApp.name}`
              : "Audit and optimize Shopify App Store listing for SEO & search visibility"
          }
        />
      );
    }

    if (page === "competitors") {
      return (
        <PageHeader
          title="Competitor Intelligence"
          subtitle={
            selectedApp
              ? `Head-to-head competitor analysis for ${selectedApp.name}`
              : "Track and compare keyword rankings side-by-side against competitor apps"
          }
        />
      );
    }

    if (page === "integrations") {
      return (
        <PageHeader
          title="Integrations & Alerts"
          subtitle="Connect Slack workspaces and manage automated rank notifications."
        />
      );
    }

    return (
      <PageHeader
        title="Profile Settings"
        subtitle="Manage your user profile details."
      />
    );
  })();  return (
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
          isLoadingApps={isLoadingApps}
          currentPage={page}
          onNavigate={setPage}
          headerContent={headerContent}
          sidebarCollapsed={sidebarCollapsed}
          onToggleSidebar={() => setSidebarCollapsed((prev) => !prev)}
          onLogout={handleLogout}
        >
          <Suspense
            fallback={
              <Box
                sx={{
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                  minHeight: "300px",
                  width: "100%",
                }}
              >
                <CircularProgress size={32} sx={{ color: "#f97316" }} />
              </Box>
            }
          >
            {page === "dashboard" ? (
              <Dashboard
                selectedApp={selectedApp}
                apiUrl={apiUrl}
                onRefreshApps={fetchApps}
                onUpdateSelectedApp={setSelectedApp}
                showToast={showToast}
                apps={apps}
                onSelectApp={handleAppSelect}
                onNavigate={setPage}
              />
            ) : page === "history" ? (
              <HistoryPage />
            ) : page === "optimizer" && selectedApp ? (
              <ListingOptimizer
                apps={apps}
                selectedApp={selectedApp}
                onSelectApp={setSelectedApp}
                showToast={showToast}
              />
            ) : page === "competitors" && selectedApp ? (
              <CompetitorsPage
                apps={apps}
                selectedApp={selectedApp}
                onSelectApp={setSelectedApp}
                showToast={showToast}
              />
            ) : page === "integrations" ? (
              <IntegrationsPage showToast={showToast} />
            ) : (
              <ProfilePage
                apps={apps}
                invitations={invitations}
                onAcceptInvitation={handleAcceptInvitation}
                onDeclineInvitation={handleDeclineInvitation}
                showToast={showToast}
              />
            )}
          </Suspense>
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