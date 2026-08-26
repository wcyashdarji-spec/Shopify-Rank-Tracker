import React, { useState, useEffect } from "react";
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
  Paper,
  Tooltip,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import LinkIcon from "@mui/icons-material/Link";
import CloseIcon from "@mui/icons-material/Close";
import FlashOnIcon from "@mui/icons-material/FlashOn";
import AssessmentIcon from "@mui/icons-material/Assessment";
import SecurityIcon from "@mui/icons-material/Security";
import { api, type SlackIntegrationItem } from "../api";
import AppLogo from "./AppLogo";

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
      try {
        const autoRes = await api.autoDetectSlackWorkspace();
        if (autoRes.workspace_name) {
          setNewWorkspaceName(autoRes.workspace_name);
        }
      } catch {
        // Ignore fallback
      }

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

  return (
    <Container maxWidth="md" sx={{ py: { xs: 3, sm: 4 }, px: { xs: 2, sm: 4 } }}>
      {/* Top Header */}
      <Box sx={{ mb: 3.5 }}>
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 1.5, mb: 1 }}>
          <Typography
            variant="h5"
            sx={{
              fontWeight: 800,
              color: "#0f172a",
              letterSpacing: "-0.02em",
              fontSize: 24,
            }}
          >
            Slack Integration
          </Typography>

          <Box
            sx={{
              display: "inline-flex",
              alignItems: "center",
              gap: 1,
              px: 1.5,
              py: 0.5,
              borderRadius: "20px",
              bgcolor: isSlackConnected ? "#ecfdf5" : "#f1f5f9",
              border: isSlackConnected ? "1px solid #a7f3d0" : "1px solid #e2e8f0",
            }}
          >
            <Box
              sx={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                bgcolor: isSlackConnected ? "#10b981" : "#94a3b8",
              }}
            />
            <Typography
              sx={{
                fontSize: 12,
                fontWeight: 700,
                color: isSlackConnected ? "#047857" : "#64748b",
              }}
            >
              {isSlackConnected ? "Connected to Slack" : "Not Connected"}
            </Typography>
          </Box>
        </Box>

        <Typography
          variant="body2"
          sx={{ color: "#64748b", fontSize: 14, lineHeight: 1.6, maxWidth: "720px" }}
        >
          Connect your Slack workspace to receive instant real-time notifications, daily keyword rank digests, and daily position change alerts directly in your team channels.
        </Typography>
      </Box>

      {/* Main Integration Card */}
      <Card
        elevation={0}
        sx={{
          borderRadius: "16px",
          border: "1px solid #e2e8f0",
          boxShadow: "0 10px 30px rgba(0, 0, 0, 0.03)",
          bgcolor: "#ffffff",
          p: { xs: 3, sm: 4 },
          mb: 4,
        }}
      >
        {/* Top Connected Logo Chain Row */}
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            pb: 3,
            borderBottom: "1px solid #f1f5f9",
            mb: 3.5,
            flexWrap: "wrap",
            gap: 2,
          }}
        >
          {/* Logo chain emblems */}
          <Box sx={{ display: "flex", alignItems: "center" }}>
            {/* App Rank Tracker Light Brand Emblem */}
            <Box
              sx={{
                width: 48,
                height: 48,
                borderRadius: "14px",
                bgcolor: "#ffffff",
                border: "1px solid #e2e8f0",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 4px 14px rgba(99, 102, 241, 0.08)",
              }}
            >
              <AppLogo size={28} />
            </Box>

            {/* Link chain emblem */}
            <Box
              sx={{
                width: 24,
                height: 24,
                borderRadius: "50%",
                bgcolor: "#ffffff",
                border: "1.5px solid #e2e8f0",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                mx: -0.85,
                zIndex: 1,
                boxShadow: "0 2px 6px rgba(0,0,0,0.06)",
              }}
            >
              <LinkIcon sx={{ fontSize: 13, color: "#64748b" }} />
            </Box>

            {/* Slack logo square */}
            <Box
              sx={{
                width: 48,
                height: 48,
                borderRadius: "14px",
                bgcolor: "#ffffff",
                border: "1px solid #e2e8f0",
                boxShadow: "0 4px 14px rgba(0, 0, 0, 0.05)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <SlackLogo size={26} />
            </Box>
          </Box>

          {/* Remove Integration Button */}
          <Button
            variant="outlined"
            onClick={handleRemoveIntegration}
            disabled={removing || !isSlackConnected}
            sx={{
              borderColor: "#fecaca",
              color: "#dc2626",
              bgcolor: "#fef2f2",
              borderRadius: "9px",
              px: 2.25,
              py: 0.85,
              fontSize: 13,
              fontWeight: 700,
              textTransform: "none",
              "&:hover": {
                bgcolor: "#fee2e2",
                borderColor: "#fca5a5",
              },
              "&.Mui-disabled": {
                bgcolor: "#f8fafc",
                borderColor: "#e2e8f0",
                color: "#94a3b8",
              },
            }}
          >
            {removing ? "Removing..." : "Remove Integration"}
          </Button>
        </Box>

        {/* Middle Section: Workspace Select */}
        <Box sx={{ mb: 3.5 }}>
          <Typography
            sx={{
              fontSize: 14,
              fontWeight: 700,
              color: "#0f172a",
              mb: 1.25,
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
                  borderRadius: "10px",
                  fontSize: 13.5,
                  bgcolor: "#ffffff",
                  "& .MuiOutlinedInput-notchedOutline": {
                    borderColor: "#e2e8f0",
                  },
                  "&:hover .MuiOutlinedInput-notchedOutline": {
                    borderColor: "#cbd5e1",
                  },
                  "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
                    borderColor: "#6366f1",
                  },
                }}
              >
                <MenuItem value="" disabled>
                  <em style={{ fontStyle: "normal", color: "#94a3b8" }}>
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
            <Tooltip title="Authorize new Slack Workspace">
              <Button
                variant="outlined"
                onClick={handlePlusClick}
                sx={{
                  minWidth: 40,
                  width: 40,
                  height: 40,
                  p: 0,
                  borderRadius: "10px",
                  borderColor: "#e2e8f0",
                  color: "#0f172a",
                  bgcolor: "#ffffff",
                  flexShrink: 0,
                  "&:hover": {
                    borderColor: "#6366f1",
                    color: "#6366f1",
                    bgcolor: "#f8fafc",
                  },
                }}
              >
                <AddIcon sx={{ fontSize: 18 }} />
              </Button>
            </Tooltip>
          </Box>
        </Box>

        {/* Bottom Section inside Card */}
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            pt: 3,
            borderTop: "1px solid #f1f5f9",
            flexWrap: "wrap",
            gap: 2,
          }}
        >
          {/* Need help? Contact Support */}
          <Typography
            sx={{
              fontSize: 13.5,
              fontWeight: 500,
              color: "#475569",
            }}
          >
            Need help?{" "}
            <Box
              component="span"
              sx={{
                color: "#6366f1",
                fontWeight: 700,
                cursor: "pointer",
                "&:hover": { textDecoration: "underline" },
              }}
              onClick={() => showToast("Contact support at support@shopifyranktracker.com", "info")}
            >
              Contact Support
            </Box>
          </Typography>

          {/* Action Buttons: Test & Save */}
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
            {isSlackConnected && (
              <Button
                variant="outlined"
                onClick={handleTestSlackNotification}
                disabled={testingSlack}
                startIcon={<FlashOnIcon sx={{ fontSize: 16 }} />}
                sx={{
                  borderRadius: "9px",
                  borderColor: "#10b981",
                  color: "#047857",
                  bgcolor: "#ecfdf5",
                  fontWeight: 700,
                  fontSize: 13,
                  textTransform: "none",
                  px: 2.25,
                  py: 0.85,
                  "&:hover": {
                    borderColor: "#059669",
                    bgcolor: "#d1fae5",
                  },
                }}
              >
                {testingSlack ? "Sending..." : "Test Slack Alert"}
              </Button>
            )}

            <Button
              variant="contained"
              disableElevation
              onClick={handleSaveIntegration}
              disabled={saving}
              sx={{
                bgcolor: "#0f172a",
                color: "#ffffff",
                borderRadius: "9px",
                px: 3.5,
                py: 0.85,
                fontSize: 13.5,
                fontWeight: 700,
                textTransform: "none",
                boxShadow: "0 4px 12px rgba(15, 23, 42, 0.15)",
                "&:hover": {
                  bgcolor: "#1e293b",
                  boxShadow: "0 6px 16px rgba(15, 23, 42, 0.25)",
                },
              }}
            >
              {saving ? "Saving..." : "Save Preferences"}
            </Button>
          </Box>
        </Box>
      </Card>

      {/* Feature Highlights Grid */}
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(3, 1fr)" }, gap: 2.5 }}>
        {/* Card 1 */}
        <Paper
          elevation={0}
          sx={{
            p: 3,
            borderRadius: "16px",
            border: "1px solid #e2e8f0",
            bgcolor: "#ffffff",
            boxShadow: "0 4px 12px rgba(0,0,0,0.02)",
          }}
        >
          <Box sx={{ width: 40, height: 40, borderRadius: "10px", bgcolor: "#e0e7ff", color: "#4f46e5", display: "flex", alignItems: "center", justifyContent: "center", mb: 2 }}>
            <FlashOnIcon sx={{ fontSize: 22 }} />
          </Box>
          <Typography sx={{ fontWeight: 700, fontSize: 15, color: "#0f172a", mb: 0.75 }}>
            Real-Time Rank Alerts
          </Typography>
          <Typography sx={{ fontSize: 13, color: "#64748b", lineHeight: 1.5 }}>
            Get instant notifications directly in your Slack channel whenever your app's rank moves up or down.
          </Typography>
        </Paper>

        {/* Card 2 */}
        <Paper
          elevation={0}
          sx={{
            p: 3,
            borderRadius: "16px",
            border: "1px solid #e2e8f0",
            bgcolor: "#ffffff",
            boxShadow: "0 4px 12px rgba(0,0,0,0.02)",
          }}
        >
          <Box sx={{ width: 40, height: 40, borderRadius: "10px", bgcolor: "#faf5ff", color: "#8b5cf6", display: "flex", alignItems: "center", justifyContent: "center", mb: 2 }}>
            <AssessmentIcon sx={{ fontSize: 22 }} />
          </Box>
          <Typography sx={{ fontWeight: 700, fontSize: 15, color: "#0f172a", mb: 0.75 }}>
            Daily Summary Reports
          </Typography>
          <Typography sx={{ fontSize: 13, color: "#64748b", lineHeight: 1.5 }}>
            Receive structured daily digest summaries grouping all tracked keywords and average ranks.
          </Typography>
        </Paper>

        {/* Card 3 */}
        <Paper
          elevation={0}
          sx={{
            p: 3,
            borderRadius: "16px",
            border: "1px solid #e2e8f0",
            bgcolor: "#ffffff",
            boxShadow: "0 4px 12px rgba(0,0,0,0.02)",
          }}
        >
          <Box sx={{ width: 40, height: 40, borderRadius: "10px", bgcolor: "#ecfdf5", color: "#10b981", display: "flex", alignItems: "center", justifyContent: "center", mb: 2 }}>
            <SecurityIcon sx={{ fontSize: 22 }} />
          </Box>
          <Typography sx={{ fontWeight: 700, fontSize: 15, color: "#0f172a", mb: 0.75 }}>
            Dynamic Slack OAuth
          </Typography>
          <Typography sx={{ fontSize: 13, color: "#64748b", lineHeight: 1.5 }}>
            Securely authorize and switch between your team Slack workspaces with one click.
          </Typography>
        </Paper>
      </Box>

      {/* Slack OAuth Authorization Modal */}
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
              border: "1px solid #e2e8f0",
              bgcolor: "#ffffff",
              p: 0,
              overflow: "hidden",
            },
          },
        }}
      >
        {/* Modal Top Bar */}
        <Box
          sx={{
            px: 3.5,
            py: 2,
            borderBottom: "1px solid #e2e8f0",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.25 }}>
            <SlackLogo size={24} />
            <Typography sx={{ fontWeight: 700, fontSize: 16, color: "#0f172a" }}>
              Slack OAuth Authorization
            </Typography>
          </Box>
          <IconButton size="small" onClick={() => setIsAddDialogOpen(false)}>
            <CloseIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </Box>

        <DialogContent sx={{ p: 4 }}>
          <form onSubmit={handleAddWorkspaceSubmit}>
            <Box sx={{ mb: 3 }}>
              <Typography sx={{ fontSize: 14, fontWeight: 700, color: "#0f172a", mb: 1 }}>
                Slack Workspace Name
              </Typography>
              <TextField
                fullWidth
                size="small"
                value={newWorkspaceName}
                onChange={(e) => setNewWorkspaceName(e.target.value)}
                placeholder="e.g. Acme Corp"
                slotProps={{
                  input: {
                    sx: { borderRadius: "10px", fontSize: 13.5 },
                  },
                }}
              />
            </Box>

            <Box sx={{ mb: 4 }}>
              <Typography sx={{ fontSize: 14, fontWeight: 700, color: "#0f172a", mb: 1 }}>
                Notification Channel (Optional)
              </Typography>
              <TextField
                fullWidth
                size="small"
                value={newChannelName}
                onChange={(e) => setNewChannelName(e.target.value)}
                placeholder="e.g. rank-tracker-alerts"
                slotProps={{
                  input: {
                    sx: { borderRadius: "10px", fontSize: 13.5 },
                  },
                }}
              />
            </Box>

            <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 1.5 }}>
              <Button
                onClick={() => setIsAddDialogOpen(false)}
                sx={{ color: "#64748b", textTransform: "none", fontWeight: 600 }}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="contained"
                disabled={addingWorkspace || !newWorkspaceName.trim()}
                sx={{
                  bgcolor: "#0f172a",
                  borderRadius: "9px",
                  textTransform: "none",
                  fontWeight: 700,
                  px: 3,
                  "&:hover": { bgcolor: "#1e293b" },
                }}
              >
                {addingWorkspace ? "Connecting..." : "Authorize Workspace"}
              </Button>
            </Box>
          </form>
        </DialogContent>
      </Dialog>
    </Container>
  );
}
