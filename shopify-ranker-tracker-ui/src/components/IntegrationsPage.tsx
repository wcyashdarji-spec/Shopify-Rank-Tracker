import { useState, useEffect } from "react";
import {
  Box,
  Button,
  Card,
  Container,
  Dialog,
  DialogContent,
  FormControl,
  IconButton,
  MenuItem,
  Select,
  TextField,
  Typography,
  CircularProgress,
  Paper,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import AddIcon from "@mui/icons-material/Add";
import LinkIcon from "@mui/icons-material/Link";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import CloseIcon from "@mui/icons-material/Close";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import { api, type SlackIntegrationItem } from "../api";

interface IntegrationsPageProps {
  showToast: (message: string, severity?: "success" | "error" | "info") => void;
}

// Official Slack 4-Color SVG Icon Component
export function SlackLogo({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 122.8 122.8" fill="none">
      <path
        d="M25.8 77.6c0 7.1-5.8 12.9-12.9 12.9S0 84.7 0 77.6s5.8-12.9 12.9-12.9h12.9v12.9z"
        fill="#E01E5A"
      />
      <path
        d="M32.3 77.6c0-7.1 5.8-12.9 12.9-12.9s12.9 5.8 12.9 12.9v32.3c0 7.1-5.8 12.9-12.9 12.9s-12.9-5.8-12.9-12.9V77.6z"
        fill="#E01E5A"
      />
      <path
        d="M45.2 25.8c-7.1 0-12.9-5.8-12.9-12.9S38.1 0 45.2 0s12.9 5.8 12.9 12.9v12.9H45.2z"
        fill="#36C5F0"
      />
      <path
        d="M45.2 32.3c7.1 0 12.9 5.8 12.9 12.9v32.3c0 7.1-5.8 12.9-12.9 12.9s-12.9-5.8-12.9-12.9V45.2c0-7.1 5.8-12.9 12.9-12.9z"
        fill="#36C5F0"
      />
      <path
        d="M97 45.2c0-7.1 5.8-12.9 12.9-12.9s12.9 5.8 12.9 12.9-5.8 12.9-12.9 12.9H97V45.2z"
        fill="#2EB67D"
      />
      <path
        d="M90.5 45.2c0 7.1-5.8 12.9-12.9 12.9s-12.9-5.8-12.9-12.9V12.9C64.7 5.8 70.5 0 77.6 0s12.9 5.8 12.9 12.9v32.3z"
        fill="#2EB67D"
      />
      <path
        d="M77.6 97c7.1 0 12.9 5.8 12.9 12.9s-5.8 12.9-12.9 12.9-12.9-5.8-12.9-12.9V97h12.9z"
        fill="#ECB22E"
      />
      <path
        d="M77.6 90.5c-7.1 0-12.9-5.8-12.9-12.9V45.2c0-7.1 5.8-12.9 12.9-12.9s12.9 5.8 12.9 12.9v32.3c0 7.2-5.8 12.9-12.9 12.9z"
        fill="#ECB22E"
      />
    </svg>
  );
}

export default function IntegrationsPage({ showToast }: IntegrationsPageProps) {
  const [view, setView] = useState<"overview" | "slack-detail">("slack-detail");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [testingSlack, setTestingSlack] = useState(false);

  // Slack state
  const [integrations, setIntegrations] = useState<SlackIntegrationItem[]>([]);
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<number | "">("");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  
  // New Slack Dialog inputs
  const [newWorkspaceName, setNewWorkspaceName] = useState("");
  const [newChannelName, setNewChannelName] = useState("");
  const [addingWorkspace, setAddingWorkspace] = useState(false);

  const fetchSlackIntegrations = async () => {
    try {
      setLoading(true);
      const res = await api.getSlackIntegrations();
      setIntegrations(res.integrations || []);
      if (res.selected_integration_id) {
        setSelectedWorkspaceId(res.selected_integration_id);
      } else if (res.integrations && res.integrations.length > 0) {
        setSelectedWorkspaceId(res.integrations[0].id);
      } else {
        setSelectedWorkspaceId("");
      }
    } catch (err: any) {
      showToast(err?.message || "Failed to load Slack integrations", "error");
    } finally {
      setLoading(false);
    }
  };

  const deriveWorkspaceName = (userEmail?: string) => {
    if (!userEmail || !userEmail.includes("@")) return "";
    const domain = userEmail.split("@")[1]?.toLowerCase();
    if (!domain || domain.includes("gmail") || domain.includes("yahoo") || domain.includes("hotmail") || domain.includes("outlook")) {
      const handle = userEmail.split("@")[0];
      return handle ? handle.charAt(0).toUpperCase() + handle.slice(1) : "";
    }
    const namePart = domain.split(".")[0];
    return namePart ? namePart.charAt(0).toUpperCase() + namePart.slice(1) : "";
  };

  useEffect(() => {
    fetchSlackIntegrations();

    // Automatically detect workspace name based on current user profile & apps
    api.autoDetectSlackWorkspace()
      .then((res) => {
        if (res.workspace_name) {
          setNewWorkspaceName(res.workspace_name);
        }
      })
      .catch(() => {
        api.getMe().then((me) => {
          if (me && me.email) {
            setNewWorkspaceName(deriveWorkspaceName(me.email));
          }
        }).catch(() => {});
      });

    // Check for backend OAuth redirect return status
    const params = new URLSearchParams(window.location.search);
    if (params.get("slack_connected") === "true") {
      const ws = params.get("workspace") || "Slack Workspace";
      showToast(`🎉 Backend OAuth2 Authorization complete! Connected to '${ws}'.`, "success");
      window.history.replaceState({}, document.title, window.location.pathname);
      fetchSlackIntegrations();
    } else if (params.get("slack_error")) {
      showToast(`OAuth Error: ${params.get("slack_error")}`, "error");
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  const handleSaveIntegration = async () => {
    try {
      setSaving(true);
      await api.saveSlackIntegration(selectedWorkspaceId ? Number(selectedWorkspaceId) : null);
      showToast("Slack integration preferences saved successfully!", "success");
      await fetchSlackIntegrations();
    } catch (err: any) {
      showToast(err?.message || "Failed to save Slack integration", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveIntegration = async () => {
    try {
      setRemoving(true);
      await api.removeAllSlackIntegrations();
      showToast("Slack integration removed successfully", "info");
      setSelectedWorkspaceId("");
      await fetchSlackIntegrations();
    } catch (err: any) {
      showToast(err?.message || "Failed to remove integration", "error");
    } finally {
      setRemoving(false);
    }
  };

  const handlePlusClick = async () => {
    try {
      // Auto-detect current user's workspace from backend
      try {
        const autoRes = await api.autoDetectSlackWorkspace();
        if (autoRes.workspace_name) {
          setNewWorkspaceName(autoRes.workspace_name);
        }
      } catch {
        // Ignore fallback
      }

      // Check if backend OAuth2 URL is configured
      const res = await api.getSlackAuthorizeUrl();
      if (res.configured && res.url) {
        window.location.href = res.url;
      } else {
        setIsAddDialogOpen(true);
      }
    } catch (err) {
      setIsAddDialogOpen(true);
    }
  };

  const handleSlackOAuthRedirect = async () => {
    const targetName = newWorkspaceName.trim();
    if (!targetName) {
      showToast("Please enter your Slack workspace name", "error");
      return;
    }

    try {
      setAddingWorkspace(true);
      const res = await api.getSlackAuthorizeUrl();
      if (res.configured && res.url) {
        window.location.href = res.url;
      } else {
        const oauthRes = await api.simulateSlackOAuth(targetName, newChannelName.trim() || undefined);
        showToast(oauthRes.message || `Slack workspace '${targetName}' authorized via Backend OAuth2!`, "success");
        setIsAddDialogOpen(false);
        await fetchSlackIntegrations();
        if (oauthRes.integration?.id) {
          setSelectedWorkspaceId(oauthRes.integration.id);
        }
      }
    } catch (err: any) {
      showToast(err?.message || "Backend OAuth authorization failed", "error");
    } finally {
      setAddingWorkspace(false);
    }
  };

  const handleAddWorkspaceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await handleSlackOAuthRedirect();
  };

  const handleTestSlackNotification = async () => {
    try {
      setTestingSlack(true);
      const res = await api.sendTestSlackNotification();
      showToast(res.message || "Test alert sent to Slack workspace!", "success");
    } catch (err: any) {
      showToast(err?.message || "Failed to send test Slack notification", "error");
    } finally {
      setTestingSlack(false);
    }
  };

  const isSlackConnected = integrations.length > 0;

  // View 1: Overview Screen ("Powerful Integrations")
  if (view === "overview") {
    return (
      <Container maxWidth="lg" sx={{ py: 4, px: { xs: 2, sm: 4 } }}>
        <Box sx={{ mb: 4 }}>
          <Typography
            variant="h5"
            sx={{
              fontWeight: 700,
              color: "#111827",
              letterSpacing: "-0.02em",
              fontSize: 24,
              mb: 0.5,
            }}
          >
            Integrations
          </Typography>
          <Typography variant="body2" sx={{ color: "#6b7280", fontSize: 14 }}>
            Power up your product workflow by integrating with tools that notify your workspace.
          </Typography>
        </Box>

        <Box sx={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
          {/* Slack Integration Card (Matching Image 1) */}
          <Card
            sx={{
              width: 340,
              borderRadius: "16px",
              boxShadow: "0 4px 20px rgba(0,0,0,0.04)",
              border: "1px solid #e5e7eb",
              bgcolor: "#ffffff",
              overflow: "hidden",
              transition: "transform 0.2s ease, box-shadow 0.2s ease",
              "&:hover": {
                transform: "translateY(-4px)",
                boxShadow: "0 12px 30px rgba(0,0,0,0.08)",
              },
            }}
          >
            {/* Soft Blue Top Banner Container */}
            <Box
              sx={{
                height: 180,
                bgcolor: "#eef8fc",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Box
                sx={{
                  width: 72,
                  height: 72,
                  borderRadius: "18px",
                  bgcolor: "#ffffff",
                  boxShadow: "0 8px 24px rgba(0,0,0,0.08)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <SlackLogo size={38} />
              </Box>
            </Box>

            {/* Body Section */}
            <Box sx={{ p: 3 }}>
              <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1 }}>
                <Typography sx={{ fontWeight: 700, fontSize: 18, color: "#111827" }}>
                  Slack
                </Typography>
                {isSlackConnected && (
                  <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                    <CheckCircleIcon sx={{ fontSize: 16, color: "#10b981" }} />
                    <Typography sx={{ fontSize: 11, fontWeight: 600, color: "#10b981" }}>
                      Connected
                    </Typography>
                  </Box>
                )}
              </Box>
              <Typography
                sx={{
                  fontSize: 13.5,
                  color: "#4b5563",
                  lineHeight: 1.5,
                  mb: 3,
                  minHeight: 40,
                }}
              >
                Get real-time alerts for new feedback, and updates- right in your Slack channels.
              </Typography>

              <Button
                variant="outlined"
                onClick={() => setView("slack-detail")}
                sx={{
                  borderRadius: "8px",
                  textTransform: "none",
                  fontWeight: 600,
                  fontSize: 13,
                  color: "#111827",
                  borderColor: "#e5e7eb",
                  px: 2.5,
                  py: 0.75,
                  bgcolor: "#ffffff",
                  "&:hover": {
                    borderColor: "#d1d5db",
                    bgcolor: "#f9fafb",
                  },
                }}
              >
                {isSlackConnected ? "Configure →" : "Connect →"}
              </Button>
            </Box>
          </Card>
          
        </Box>
      </Container>
    );
  }

  // View 2: Slack Integration Detail Screen (Matching Image 2)
  return (
    <Container maxWidth="md" sx={{ py: 4, px: { xs: 2, sm: 4 } }}>
      {/* Top Header with Back Arrow */}
      <Box sx={{ mb: 3 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5 }}>
          <IconButton
            size="small"
            onClick={() => setView("overview")}
            sx={{
              color: "#374151",
              p: 0.5,
              "&:hover": { bgcolor: "#f3f4f6" },
            }}
          >
            <ArrowBackIcon sx={{ fontSize: 20 }} />
          </IconButton>
          <Typography
            variant="h5"
            sx={{
              fontWeight: 700,
              color: "#111827",
              letterSpacing: "-0.02em",
              fontSize: 22,
            }}
          >
            Slack Integration
          </Typography>
        </Box>
        <Typography
          variant="body2"
          sx={{ color: "#6b7280", fontSize: 13.5, pl: 4.5, maxWidth: "700px" }}
        >
          Connect your workspace to receive real-time Slack notifications and Never miss a comment, vote, or reaction - stay informed as your users engage.
        </Typography>
      </Box>

      {/* Main Integration Card (Exact match to Image 2) */}
      <Card
        sx={{
          borderRadius: "12px",
          border: "1px solid #e5e7eb",
          boxShadow: "0 2px 12px rgba(0,0,0,0.03)",
          bgcolor: "#ffffff",
          p: { xs: 2.5, sm: 3.5 },
        }}
      >
        {/* Top Header Row inside Card */}
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            pb: 3,
            borderBottom: "1px solid #f3f4f6",
            mb: 3,
          }}
        >
          {/* Logo chain view */}
          <Box sx={{ display: "flex", alignItems: "center" }}>
            {/* App Rank Tracker logo in dark slate box with orange chart icon */}
            <Box
              sx={{
                width: 44,
                height: 44,
                borderRadius: "12px",
                background: "linear-gradient(135deg, #111827 0%, #1f2937 100%)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#ffffff",
                boxShadow: "0 4px 12px rgba(17, 24, 39, 0.15)",
              }}
            >
              <TrendingUpIcon sx={{ fontSize: 22, color: "#f97316" }} />
            </Box>

            {/* Link chain emblem */}
            <Box
              sx={{
                width: 22,
                height: 22,
                borderRadius: "50%",
                bgcolor: "#ffffff",
                border: "1px solid #e5e7eb",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                mx: -0.75,
                zIndex: 1,
              }}
            >
              <LinkIcon sx={{ fontSize: 12, color: "#9ca3af" }} />
            </Box>

            {/* Slack logo square */}
            <Box
              sx={{
                width: 44,
                height: 44,
                borderRadius: "10px",
                bgcolor: "#ffffff",
                border: "1px solid #e5e7eb",
                boxShadow: "0 2px 8px rgba(0, 0, 0, 0.04)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <SlackLogo size={24} />
            </Box>
          </Box>

          {/* Remove Integration Button */}
          <Button
            variant="contained"
            disableElevation
            onClick={handleRemoveIntegration}
            disabled={removing || !isSlackConnected}
            sx={{
              bgcolor: "#ff8080",
              color: "#ffffff",
              borderRadius: "8px",
              px: 2.5,
              py: 0.9,
              fontSize: 13,
              fontWeight: 600,
              textTransform: "none",
              "&:hover": {
                bgcolor: "#ef4444",
              },
              "&.Mui-disabled": {
                bgcolor: "#fca5a5",
                color: "#ffffff",
                opacity: 0.7,
              },
            }}
          >
            {removing ? "Removing..." : "Remove Integration"}
          </Button>
        </Box>

        {/* Middle Section: Connect to Slack Workspace */}
        <Box sx={{ my: 2 }}>
          <Typography
            sx={{
              fontSize: 13.5,
              fontWeight: 600,
              color: "#111827",
              mb: 1.5,
            }}
          >
            Connect to Slack Workspace
          </Typography>

          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
            <FormControl fullWidth size="small">
              <Select
                displayEmpty
                value={selectedWorkspaceId}
                onChange={(e) => setSelectedWorkspaceId(e.target.value as number | "")}
                disabled={loading}
                sx={{
                  borderRadius: "8px",
                  fontSize: 13.5,
                  bgcolor: "#ffffff",
                  "& .MuiOutlinedInput-notchedOutline": {
                    borderColor: "#e5e7eb",
                  },
                  "&:hover .MuiOutlinedInput-notchedOutline": {
                    borderColor: "#d1d5db",
                  },
                }}
              >
                <MenuItem value="" disabled>
                  <em style={{ fontStyle: "normal", color: "#9ca3af" }}>
                    Select a Slack Workspace
                  </em>
                </MenuItem>
                {integrations.map((item) => (
                  <MenuItem key={item.id} value={item.id}>
                    {item.workspace_name} {item.channel_name ? `(#${item.channel_name})` : ""}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {/* Plus Button (+) */}
            <Button
              variant="outlined"
              onClick={handlePlusClick}
              sx={{
                minWidth: 40,
                width: 40,
                height: 40,
                p: 0,
                borderRadius: "8px",
                borderColor: "#e5e7eb",
                color: "#374151",
                "&:hover": {
                  borderColor: "#9ca3af",
                  bgcolor: "#f9fafb",
                },
              }}
              title="Connect new Slack workspace"
            >
              <AddIcon sx={{ fontSize: 18 }} />
            </Button>
          </Box>
        </Box>

        {/* Bottom Section inside Card */}
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            mt: 4,
            pt: 2.5,
            borderTop: "1px solid #f3f4f6",
          }}
        >
          {/* Need help? Contact Us */}
          <Typography
            sx={{
              fontSize: 13.5,
              fontWeight: 500,
              color: "#374151",
            }}
          >
            Need help?{" "}
            <Box
              component="span"
              sx={{
                color: "#f97316",
                fontWeight: 600,
                cursor: "pointer",
                "&:hover": { textDecoration: "underline" },
              }}
              onClick={() => showToast("Contact support at support@shopifyranktracker.com", "info")}
            >
              Contact Us
            </Box>
          </Typography>

          {/* Action Buttons: Test & Save */}
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
            {isSlackConnected && (
              <Button
                variant="outlined"
                onClick={handleTestSlackNotification}
                disabled={testingSlack}
                sx={{
                  borderRadius: "8px",
                  borderColor: "#007a5a",
                  color: "#007a5a",
                  fontWeight: 600,
                  fontSize: 13,
                  textTransform: "none",
                  px: 2.5,
                  py: 0.9,
                  "&:hover": {
                    borderColor: "#00664b",
                    bgcolor: "#e8f5e9",
                  },
                }}
              >
                {testingSlack ? "Sending..." : "⚡ Test Slack Alert"}
              </Button>
            )}

            <Button
              variant="contained"
              disableElevation
              onClick={handleSaveIntegration}
              disabled={saving}
              sx={{
                bgcolor: "#111827",
                color: "#ffffff",
                borderRadius: "8px",
                px: 3.5,
                py: 0.9,
                fontSize: 13.5,
                fontWeight: 600,
                textTransform: "none",
                "&:hover": {
                  bgcolor: "#1f2937",
                },
              }}
            >
              {saving ? "Saving..." : "Save Preferences"}
            </Button>
          </Box>
        </Box>
      </Card>

      {/* Feature Highlights & Capability Grid (User-Friendly Info Cards) */}
      <Box sx={{ mt: 4, display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr 1fr" }, gap: 2.5 }}>
        <Paper
          elevation={0}
          sx={{
            p: 2.5,
            borderRadius: "12px",
            border: "1px solid #e5e7eb",
            bgcolor: "#ffffff",
          }}
        >
          <Typography sx={{ fontSize: 20, mb: 1 }}>⚡</Typography>
          <Typography sx={{ fontWeight: 700, fontSize: 15, color: "#111827", mb: 0.5 }}>
            Real-Time Rank Alerts
          </Typography>
          <Typography sx={{ fontSize: 13, color: "#6b7280", lineHeight: 1.5 }}>
            Get instant notifications directly in your Slack channel whenever your app's rank moves up or down.
          </Typography>
        </Paper>

        <Paper
          elevation={0}
          sx={{
            p: 2.5,
            borderRadius: "12px",
            border: "1px solid #e5e7eb",
            bgcolor: "#ffffff",
          }}
        >
          <Typography sx={{ fontSize: 20, mb: 1 }}>📊</Typography>
          <Typography sx={{ fontWeight: 700, fontSize: 15, color: "#111827", mb: 0.5 }}>
            Daily Summary Reports
          </Typography>
          <Typography sx={{ fontSize: 13, color: "#6b7280", lineHeight: 1.5 }}>
            Receive structured daily digest summaries grouping all tracked keywords and average ranks.
          </Typography>
        </Paper>

        <Paper
          elevation={0}
          sx={{
            p: 2.5,
            borderRadius: "12px",
            border: "1px solid #e5e7eb",
            bgcolor: "#ffffff",
          }}
        >
          <Typography sx={{ fontSize: 20, mb: 1 }}>🔒</Typography>
          <Typography sx={{ fontWeight: 700, fontSize: 15, color: "#111827", mb: 0.5 }}>
            Dynamic Slack OAuth
          </Typography>
          <Typography sx={{ fontSize: 13, color: "#6b7280", lineHeight: 1.5 }}>
            Securely authorize and switch between your team Slack workspaces with one click.
          </Typography>
        </Paper>
      </Box>

      {/* Slack OAuth Authorization Modal (Matching User's Screenshot Flow) */}
      <Dialog
        open={isAddDialogOpen}
        onClose={() => setIsAddDialogOpen(false)}
        maxWidth="md"
        fullWidth
        slotProps={{
          paper: {
            sx: {
              borderRadius: "16px",
              boxShadow: "0 24px 72px rgba(0,0,0,0.18)",
              border: "1px solid #e5e7eb",
              bgcolor: "#ffffff",
              p: 0,
              overflow: "hidden",
            },
          },
        }}
      >
        {/* Top Header Bar with Slack Brand Logo */}
        <Box
          sx={{
            px: 3.5,
            py: 2,
            borderBottom: "1px solid #ebebeb",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <SlackLogo size={22} />
            <Typography
              sx={{
                fontWeight: 900,
                fontSize: 20,
                color: "#1d1c1d",
                letterSpacing: "-0.04em",
                fontFamily: "system-ui, -apple-system, sans-serif",
              }}
            >
              slack
            </Typography>
          </Box>
          <IconButton size="small" onClick={() => setIsAddDialogOpen(false)}>
            <CloseIcon sx={{ fontSize: 20, color: "#616061" }} />
          </IconButton>
        </Box>

        <form onSubmit={handleAddWorkspaceSubmit}>
          <DialogContent sx={{ p: { xs: 3, sm: 4.5 }, pt: 4 }}>
            {/* Grid Container: Left App Info vs Right Permission Review */}
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
                gap: 4,
                alignItems: "start",
              }}
            >
              {/* Left Column: App Branding & Workspace Selector */}
              <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
                {/* App Brand Icon Badge */}
                <Box
                  sx={{
                    width: 56,
                    height: 56,
                    borderRadius: "16px",
                    background: "linear-gradient(135deg, #111827 0%, #1f2937 100%)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#ffffff",
                    boxShadow: "0 6px 16px rgba(17, 24, 39, 0.18)",
                    mb: 0.5,
                  }}
                >
                  <TrendingUpIcon sx={{ fontSize: 28, color: "#f97316" }} />
                </Box>

                {/* Main Headline */}
                <Typography
                  sx={{
                    fontWeight: 700,
                    fontSize: 22,
                    color: "#1d1c1d",
                    lineHeight: 1.3,
                  }}
                >
                  Allow the "Rank Tracker" app to access Slack
                </Typography>

                {/* Slack Approved Badge */}
                <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1, mt: 0.5 }}>
                  <CheckCircleIcon sx={{ fontSize: 18, color: "#007a5a", mt: 0.2 }} />
                  <Box>
                    <Typography sx={{ fontWeight: 600, fontSize: 13, color: "#007a5a" }}>
                      App is approved by Slack
                    </Typography>
                    <Typography sx={{ fontSize: 12, color: "#616061", mt: 0.2, lineHeight: 1.4 }}>
                      Apps are reviewed for quality before they are listed in the Slack Marketplace.
                    </Typography>
                  </Box>
                </Box>

                {/* Dynamic Workspace Selector & Input */}
                <Box sx={{ mt: 1, display: "flex", flexDirection: "column", gap: 1.5 }}>
                  <Box>
                    <Typography sx={{ fontWeight: 600, fontSize: 13, color: "#1d1c1d", mb: 0.75 }}>
                      Workspace
                    </Typography>
                    {integrations.length > 0 ? (
                      <Select
                        size="small"
                        fullWidth
                        value={newWorkspaceName}
                        onChange={(e) => setNewWorkspaceName(e.target.value)}
                        displayEmpty
                        sx={{
                          borderRadius: "8px",
                          fontSize: 13.5,
                          fontWeight: 600,
                          bgcolor: "#ffffff",
                          "& .MuiOutlinedInput-notchedOutline": { borderColor: "#dddddd" },
                        }}
                      >
                        {newWorkspaceName && !integrations.some((item) => item.workspace_name === newWorkspaceName) && (
                          <MenuItem value={newWorkspaceName}>
                            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                              <Box
                                sx={{
                                  width: 20,
                                  height: 20,
                                  borderRadius: "5px",
                                  background: "linear-gradient(135deg, #e11d48 0%, #f43f5e 100%)",
                                  color: "#fff",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  fontSize: 11,
                                  fontWeight: 800,
                                }}
                              >
                                {newWorkspaceName[0]?.toUpperCase() || "W"}
                              </Box>
                              <Typography sx={{ fontWeight: 600, fontSize: 13.5 }}>{newWorkspaceName}</Typography>
                            </Box>
                          </MenuItem>
                        )}
                        {integrations.map((item) => (
                          <MenuItem key={item.id} value={item.workspace_name}>
                            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                              <Box
                                sx={{
                                  width: 20,
                                  height: 20,
                                  borderRadius: "5px",
                                  background: "linear-gradient(135deg, #007a5a 0%, #00664b 100%)",
                                  color: "#fff",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  fontSize: 11,
                                  fontWeight: 800,
                                }}
                              >
                                {item.workspace_name[0]?.toUpperCase() || "W"}
                              </Box>
                              <Typography sx={{ fontWeight: 600, fontSize: 13.5 }}>{item.workspace_name}</Typography>
                            </Box>
                          </MenuItem>
                        ))}
                      </Select>
                    ) : (
                      <TextField
                        size="small"
                        fullWidth
                        required
                        value={newWorkspaceName}
                        onChange={(e) => setNewWorkspaceName(e.target.value)}
                        placeholder="Enter Slack Workspace Name..."
                        slotProps={{
                          input: {
                            sx: {
                              borderRadius: "8px",
                              fontSize: 13.5,
                              fontWeight: 600,
                              bgcolor: "#ffffff",
                              "& fieldset": { borderColor: "#dddddd" },
                              "&:hover fieldset": { borderColor: "#bbbbbb" },
                            },
                            startAdornment: newWorkspaceName.trim() ? (
                              <Box
                                sx={{
                                  width: 20,
                                  height: 20,
                                  borderRadius: "5px",
                                  background: "linear-gradient(135deg, #111827 0%, #374151 100%)",
                                  color: "#fff",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  fontSize: 11,
                                  fontWeight: 800,
                                  mr: 1,
                                  flexShrink: 0,
                                }}
                              >
                                {newWorkspaceName.trim()[0].toUpperCase()}
                              </Box>
                            ) : null,
                          },
                        }}
                      />
                    )}
                  </Box>

                  <Box>
                    <Typography sx={{ fontWeight: 600, fontSize: 12.5, color: "#1d1c1d", mb: 0.5 }}>
                      Notification Channel (Optional)
                    </Typography>
                    <TextField
                      size="small"
                      fullWidth
                      value={newChannelName}
                      onChange={(e) => setNewChannelName(e.target.value)}
                      placeholder="e.g. rank-alerts, general"
                      slotProps={{
                        input: {
                          sx: {
                            borderRadius: "8px",
                            fontSize: 13,
                            bgcolor: "#ffffff",
                            "& fieldset": { borderColor: "#dddddd" },
                          },
                          startAdornment: (
                            <Typography sx={{ color: "#9ca3af", fontSize: 13, mr: 0.5 }}>#</Typography>
                          ),
                        },
                      }}
                    />
                  </Box>
                </Box>
              </Box>

              {/* Right Column: Review App Permissions Box */}
              <Box
                sx={{
                  bgcolor: "#f8f8f8",
                  borderRadius: "12px",
                  p: 3,
                  border: "1px solid #ebebeb",
                }}
              >
                <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 2.5 }}>
                  <Typography sx={{ fontWeight: 700, fontSize: 13.5, color: "#1d1c1d" }}>
                    Review app permissions
                  </Typography>
                  <Typography
                    sx={{
                      fontSize: 12,
                      color: "#1264a3",
                      fontWeight: 500,
                      cursor: "pointer",
                      "&:hover": { textDecoration: "underline" },
                    }}
                  >
                    Manage permissions
                  </Typography>
                </Box>

                {/* Section 1 */}
                <Typography sx={{ fontSize: 12, fontWeight: 600, color: "#616061", mb: 1 }}>
                  Information "Rank Tracker" can view
                </Typography>

                <Box sx={{ display: "flex", flexDirection: "column", gap: 1, mb: 3 }}>
                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      p: 1.25,
                      borderRadius: "8px",
                      bgcolor: "#ffffff",
                      border: "1px solid #ebebeb",
                    }}
                  >
                    <Typography sx={{ fontSize: 12.5, color: "#1d1c1d", fontWeight: 500 }}>
                      Content and info about channels & conversations
                    </Typography>
                    <Typography sx={{ color: "#9ca3af", fontSize: 14 }}>▸</Typography>
                  </Box>

                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      p: 1.25,
                      borderRadius: "8px",
                      bgcolor: "#ffffff",
                      border: "1px solid #ebebeb",
                    }}
                  >
                    <Typography sx={{ fontSize: 12.5, color: "#1d1c1d", fontWeight: 500 }}>
                      Content and info about your workspace
                    </Typography>
                    <Typography sx={{ color: "#9ca3af", fontSize: 14 }}>▸</Typography>
                  </Box>
                </Box>

                {/* Section 2 */}
                <Typography sx={{ fontSize: 12, fontWeight: 600, color: "#616061", mb: 1 }}>
                  Actions "Rank Tracker" can take
                </Typography>

                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    p: 1.25,
                    borderRadius: "8px",
                    bgcolor: "#ffffff",
                    border: "1px solid #ebebeb",
                  }}
                >
                  <Typography sx={{ fontSize: 12.5, color: "#1d1c1d", fontWeight: 500 }}>
                    Perform actions in channels & conversations
                  </Typography>
                  <Typography sx={{ color: "#9ca3af", fontSize: 14 }}>▸</Typography>
                </Box>
              </Box>
            </Box>

            {/* Bottom Footer Section */}
            <Box sx={{ mt: 4, pt: 3, borderTop: "1px solid #ebebeb" }}>
              <Typography sx={{ fontSize: 11.5, color: "#616061", lineHeight: 1.5, mb: 3 }}>
                Slack will share your granted permissions with Rank Tracker. View Slack's privacy policy.
                By agreeing to allow Rank Tracker to share your granted permissions, you are also agreeing
                to Rank Tracker's privacy agreement and terms of service.
              </Typography>

              <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 1.5 }}>
                <Button
                  onClick={() => setIsAddDialogOpen(false)}
                  sx={{
                    color: "#1d1c1d",
                    border: "1px solid #dddddd",
                    borderRadius: "6px",
                    px: 2.5,
                    py: 0.75,
                    fontSize: 13,
                    fontWeight: 600,
                    textTransform: "none",
                    bgcolor: "#ffffff",
                    "&:hover": { bgcolor: "#f8f8f8", borderColor: "#cccccc" },
                  }}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="contained"
                  disableElevation
                  disabled={addingWorkspace}
                  sx={{
                    bgcolor: "#007a5a",
                    color: "#ffffff",
                    borderRadius: "6px",
                    px: 3.5,
                    py: 0.75,
                    fontSize: 13,
                    fontWeight: 700,
                    textTransform: "none",
                    "&:hover": { bgcolor: "#00664b" },
                  }}
                >
                  {addingWorkspace ? <CircularProgress size={16} sx={{ color: "#fff" }} /> : "Allow"}
                </Button>
              </Box>
            </Box>
          </DialogContent>
        </form>
      </Dialog>
    </Container>
  );
}
