// React
import { useEffect, useState } from "react";

// Material UI
import { Alert, Button, Snackbar, Typography, Box } from "@mui/material";
import CssBaseline from "@mui/material/CssBaseline";
import { Refresh as RefreshIcon } from "@mui/icons-material";
import { ThemeProvider, createTheme } from "@mui/material/styles";

// API
import { api, getApiBaseUrl, getToken, logout, type App as AppType } from "./api";

// Components
import Dashboard from "./components/DashBoard";
import HistoryPage from "./components/HistoryPage";
import Layout from "./components/Layout";
import PageHeader from "./components/PageHeader";
import LoginRegister from "./components/LoginRegister";
import ProfilePage from "./components/ProfilePage";
import ListingOptimizer from "./components/ListingOptimizer";
import CompetitorsPage from "./components/CompetitorsPage";

const theme = createTheme({
  palette: {
    mode: "light",
    primary: { main: "#111827" },
    secondary: { main: "#f97316" },
  },
});

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(!!getToken());
  const [page, setPage] = useState<"dashboard" | "history" | "settings" | "optimizer" | "competitors">("dashboard");
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
    if (isAuthenticated) {
      fetchApps(true);
      fetchInvitations();
    }
  }, [isAuthenticated]);

  const handleAppSelect = (app: AppType) => {
    setSelectedApp(app);
    setPage("dashboard");
  };

  // const handleSaveSettings = (url: string) => {
  const handleTrackApp = (name: string, url: string, keywordsList: string[]) => {
    // Immediately notify the user and run in background
    showToast(
      `⏳ Scraping started for '${name}' — running in the background. Results will reflect shortly.`,
      "info"
    );

    // Fire-and-forget: do not await
    (async () => {
      try {
        await api.runTracker(name, url, keywordsList);
        showToast(`✅ Scraping complete for '${name}'! Results have been updated.`, "success");
        await fetchApps();
        const updated = await api.getApps();
        const newApp = updated.apps.find((a) => a.name.toLowerCase() === name.toLowerCase().trim());
        if (newApp) setSelectedApp(newApp);
      } catch (err: any) {
        showToast(err?.message || "Scraper failed", "error");
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
        showToast(err?.message || "Background scan failed. Please try again.", "error");
      });
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
    ) : page === "history" ? (
      <PageHeader
        title="History Log"
        subtitle="See when each tracked app was last checked for keyword rankings."
      />
    ) : page === "optimizer" ? (
      null
    ) : page === "competitors" ? (
      null
    ) : (
      <PageHeader
        title="Profile Settings"
        subtitle="Manage your user profile details."
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
          isLoadingApps={isLoadingApps}
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
          ) : (
            <ProfilePage
              apps={apps}
              invitations={invitations}
              onAcceptInvitation={handleAcceptInvitation}
              onDeclineInvitation={handleDeclineInvitation}
              showToast={showToast}
            />
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