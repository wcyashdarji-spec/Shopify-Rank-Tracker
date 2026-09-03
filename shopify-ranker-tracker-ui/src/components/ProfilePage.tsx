import React, { useEffect, useState } from "react";
import {
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Container,
  Divider,
  FormControl,
  IconButton,
  InputAdornment,
  InputLabel,
  List,
  ListItem,
  ListItemText,
  MenuItem,
  Paper,
  Select,
  TextField,
  Typography,
} from "@mui/material";
import PersonIcon from "@mui/icons-material/Person";
import LockIcon from "@mui/icons-material/Lock";
import VisibilityIcon from "@mui/icons-material/Visibility";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import MailIcon from "@mui/icons-material/Mail";
import GroupAddIcon from "@mui/icons-material/GroupAdd";
import SecurityIcon from "@mui/icons-material/Security";
import CalendarTodayIcon from "@mui/icons-material/CalendarToday";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import AppsIcon from "@mui/icons-material/Apps";
import PeopleIcon from "@mui/icons-material/People";
import VerifiedUserIcon from "@mui/icons-material/VerifiedUser";
import SendIcon from "@mui/icons-material/Send";
import { api, type App as AppType } from "../api";

interface ProfilePageProps {
  apps: AppType[];
  invitations: any[];
  onAcceptInvitation: (inviteId: number) => Promise<void>;
  onDeclineInvitation: (inviteId: number) => Promise<void>;
  showToast: (message: string, severity?: "success" | "error" | "info") => void;
}

export default function ProfilePage({
  apps,
  invitations,
  onAcceptInvitation,
  onDeclineInvitation,
  showToast,
}: ProfilePageProps) {
  const [loading, setLoading] = useState(true);
  const [savingAccount, setSavingAccount] = useState(false);

  // Profile state
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [createdAt, setCreatedAt] = useState<string | null>(null);

  // Invite collaborators states
  const [selectedAppId, setSelectedAppId] = useState<number | "">("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [appOwner, setAppOwner] = useState<string | null>(null);
  const [appCollaborators, setAppCollaborators] = useState<string[]>([]);
  const [appPendingInvites, setAppPendingInvites] = useState<string[]>([]);
  const [loadingCollabs, setLoadingCollabs] = useState(false);
  const [invitingCollab, setInvitingCollab] = useState(false);

  // Password visibility state
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  useEffect(() => {
    const fetchUserProfile = async () => {
      try {
        setLoading(true);
        const user = await api.getMe();
        setEmail(user.email);
        setCreatedAt(user.created_at);
      } catch (err: any) {
        showToast(err?.message || "Failed to load user profile", "error");
      } finally {
        setLoading(false);
      }
    };
    fetchUserProfile();
  }, [showToast]);

  const fetchAppCollabs = async (appId: number) => {
    try {
      setLoadingCollabs(true);
      const res = await api.getAppCollaborators(appId);
      setAppOwner(res.owner);
      setAppCollaborators(res.collaborators || []);
      setAppPendingInvites(res.pending_invitations || []);
    } catch (err: any) {
      showToast(err?.message || "Failed to load collaborators", "error");
    } finally {
      setLoadingCollabs(false);
    }
  };

  // Automatically select first app and fetch collaborators on page load
  useEffect(() => {
    if (apps.length > 0 && !selectedAppId) {
      const firstAppId = apps[0].id;
      setSelectedAppId(firstAppId);
      fetchAppCollabs(firstAppId);
    }
  }, [apps, selectedAppId]);

  const handleAccountUpdate = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password && password !== confirmPassword) {
      showToast("Passwords do not match", "error");
      return;
    }

    setSavingAccount(true);
    try {
      const res = await api.updateMe(email.trim() || undefined, password || undefined);
      showToast(res.message || "Profile updated successfully!", "success");
      setPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      showToast(err?.message || "Failed to update profile", "error");
    } finally {
      setSavingAccount(false);
    }
  };

  const handleSendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAppId || !inviteEmail.trim()) return;

    setInvitingCollab(true);
    try {
      await api.inviteCollaborator(Number(selectedAppId), inviteEmail.trim());
      showToast(`Invitation sent to ${inviteEmail.trim()}`, "success");
      setInviteEmail("");
      fetchAppCollabs(Number(selectedAppId));
    } catch (err: any) {
      showToast(err?.message || "Failed to send invitation", "error");
    } finally {
      setInvitingCollab(false);
    }
  };

  const ownedApps = apps;

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", height: "60vh" }}>
        <CircularProgress size={36} sx={{ color: "#3b82f6" }} />
      </Box>
    );
  }

  const initialLetter = email ? email[0]?.toUpperCase() : "U";
  const selectedAppObj = apps.find((a) => a.id === selectedAppId);

  return (
    <Box sx={{ position: "relative", minHeight: "100%", py: { xs: 2, sm: 3, md: 4 } }}>
      {/* Background Ambient Spheres */}
      <Box
        sx={{
          position: "fixed",
          inset: 0,
          pointerEvents: "none",
          zIndex: 0,
          overflow: "hidden",
        }}
      >
        <Box
          sx={{
            position: "absolute",
            top: "8%",
            right: "10%",
            width: 460,
            height: 460,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(59, 130, 246, 0.1) 0%, rgba(99, 102, 241, 0.02) 70%)",
            filter: "blur(70px)",
            animation: "floatProfileOrb1 14s ease-in-out infinite",
          }}
        />
        <Box
          sx={{
            position: "absolute",
            bottom: "10%",
            left: "5%",
            width: 420,
            height: 420,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(16, 185, 129, 0.1) 0%, rgba(52, 211, 153, 0.02) 70%)",
            filter: "blur(65px)",
            animation: "floatProfileOrb2 16s ease-in-out infinite",
          }}
        />
      </Box>

      <style>{`
        @keyframes floatProfileOrb1 {
          0%, 100% { transform: translate(0px, 0px) scale(1); }
          50% { transform: translate(-30px, 40px) scale(1.08); }
        }
        @keyframes floatProfileOrb2 {
          0%, 100% { transform: translate(0px, 0px) scale(1); }
          50% { transform: translate(40px, -30px) scale(1.12); }
        }
      `}</style>

      <Container maxWidth="lg" sx={{ position: "relative", zIndex: 1, px: { xs: 2, sm: 3 } }}>
        {/* 1. Profile Overview Hero Banner */}
        <Paper
          elevation={0}
          sx={{
            p: { xs: 3, sm: 3.5, md: 4 },
            borderRadius: "20px",
            border: "1px solid #e2e8f0",
            background: "linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)",
            mb: 4,
            boxShadow: "0 10px 30px rgba(0, 0, 0, 0.03)",
            position: "relative",
            overflow: "hidden",
          }}
        >
          {/* Subtle Top Accent Gradient Line */}
          <Box
            sx={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              height: 4,
              background: "linear-gradient(90deg, #3b82f6 0%, #8b5cf6 50%, #10b981 100%)",
            }}
          />

          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 3,
              flexWrap: "wrap",
            }}
          >
            {/* Left User Identity Info */}
            <Box sx={{ display: "flex", alignItems: "center", gap: 2.5, minWidth: 0, flex: 1 }}>
              <Box sx={{ position: "relative", flexShrink: 0 }}>
                <Avatar
                  sx={{
                    width: { xs: 64, sm: 76 },
                    height: { xs: 64, sm: 76 },
                    fontSize: { xs: 26, sm: 32 },
                    fontWeight: 800,
                    background: "linear-gradient(135deg, #3b82f6 0%, #6366f1 100%)",
                    color: "#ffffff",
                    boxShadow: "0 8px 24px rgba(59, 130, 246, 0.35)",
                    border: "3px solid #ffffff",
                  }}
                >
                  {initialLetter}
                </Avatar>
                <Box
                  sx={{
                    position: "absolute",
                    bottom: 2,
                    right: 2,
                    width: 14,
                    height: 14,
                    borderRadius: "50%",
                    bgcolor: "#10b981",
                    border: "2px solid #ffffff",
                    boxShadow: "0 0 8px rgba(16, 185, 129, 0.6)",
                  }}
                />
              </Box>

              <Box sx={{ minWidth: 0, flex: 1 }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1.25, mb: 0.75, flexWrap: "wrap" }}>
                  <Typography sx={{ fontWeight: 800, fontSize: { xs: 18, sm: 22 }, color: "#0f172a", letterSpacing: "-0.02em" }}>
                    {email}
                  </Typography>
                  <Chip
                    icon={<VerifiedUserIcon sx={{ fontSize: "14px !important", color: "#3b82f6 !important" }} />}
                    label="Account Owner"
                    size="small"
                    sx={{
                      fontSize: 11,
                      fontWeight: 800,
                      bgcolor: "#eff6ff",
                      color: "#2563eb",
                      border: "1px solid #bfdbfe",
                      height: 24,
                      px: 0.5,
                    }}
                  />
                </Box>

                <Box sx={{ display: "flex", alignItems: "center", gap: 2, flexWrap: "wrap" }}>
                  {createdAt && (
                    <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
                      <CalendarTodayIcon sx={{ fontSize: 14, color: "#64748b" }} />
                      <Typography sx={{ fontSize: 13, color: "#64748b", fontWeight: 500 }}>
                        Member since {new Date(createdAt).toLocaleDateString(undefined, { dateStyle: "medium" })}
                      </Typography>
                    </Box>
                  )}
                  <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
                    <SecurityIcon sx={{ fontSize: 14, color: "#10b981" }} />
                    <Typography sx={{ fontSize: 13, color: "#059669", fontWeight: 700 }}>
                      Verified & Active
                    </Typography>
                  </Box>
                </Box>
              </Box>
            </Box>

            {/* Right Summary Quick Badges */}
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 1.5,
                width: { xs: "100%", md: "auto" },
                justifyContent: { xs: "space-between", md: "flex-end" },
                pt: { xs: 2, md: 0 },
                borderTop: { xs: "1px solid #e2e8f0", md: "none" },
              }}
            >
              <Paper
                elevation={0}
                sx={{
                  p: 1.5,
                  px: 2,
                  borderRadius: "14px",
                  bgcolor: "#ffffff",
                  border: "1px solid #e2e8f0",
                  display: "flex",
                  alignItems: "center",
                  gap: 1.25,
                  flex: { xs: 1, md: "initial" },
                }}
              >
                <Box sx={{ width: 34, height: 34, borderRadius: "10px", bgcolor: "#eff6ff", color: "#3b82f6", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <AppsIcon sx={{ fontSize: 18 }} />
                </Box>
                <Box>
                  <Typography sx={{ fontSize: 16, fontWeight: 800, color: "#0f172a", lineHeight: 1 }}>
                    {apps.length}
                  </Typography>
                  <Typography sx={{ fontSize: 11, fontWeight: 600, color: "#64748b", mt: 0.2 }}>
                    Tracked Apps
                  </Typography>
                </Box>
              </Paper>

              <Paper
                elevation={0}
                sx={{
                  p: 1.5,
                  px: 2,
                  borderRadius: "14px",
                  bgcolor: "#ffffff",
                  border: "1px solid #e2e8f0",
                  display: "flex",
                  alignItems: "center",
                  gap: 1.25,
                  flex: { xs: 1, md: "initial" },
                }}
              >
                <Box sx={{ width: 34, height: 34, borderRadius: "10px", bgcolor: "#f5f3ff", color: "#8b5cf6", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <PeopleIcon sx={{ fontSize: 18 }} />
                </Box>
                <Box>
                  <Typography sx={{ fontSize: 16, fontWeight: 800, color: "#0f172a", lineHeight: 1 }}>
                    {appCollaborators.length + appPendingInvites.length}
                  </Typography>
                  <Typography sx={{ fontSize: 11, fontWeight: 600, color: "#64748b", mt: 0.2 }}>
                    Collaborators
                  </Typography>
                </Box>
              </Paper>
            </Box>
          </Box>
        </Paper>

        {/* 2. Main Responsive Grid (2 Columns on Desktop) */}
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 3.5, alignItems: "start" }}>
          {/* Left Column: Account & Security Settings */}
          <Box>
            <Card
              elevation={0}
              sx={{
                borderRadius: "20px",
                boxShadow: "0 10px 30px rgba(0,0,0,0.03)",
                border: "1px solid #e2e8f0",
                bgcolor: "#ffffff",
                height: "100%",
                display: "flex",
                flexDirection: "column",
              }}
            >
              <CardContent sx={{ p: { xs: 3, sm: 3.5 }, flex: 1, display: "flex", flexDirection: "column" }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 3 }}>
                  <Box
                    sx={{
                      width: 42,
                      height: 42,
                      borderRadius: "12px",
                      bgcolor: "#eff6ff",
                      color: "#3b82f6",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      boxShadow: "0 4px 12px rgba(59, 130, 246, 0.12)",
                    }}
                  >
                    <PersonIcon sx={{ fontSize: 22 }} />
                  </Box>
                  <Box>
                    <Typography sx={{ fontWeight: 800, fontSize: 17, color: "#0f172a" }}>
                      Account & Security
                    </Typography>
                    <Typography sx={{ fontSize: 12.5, color: "#64748b", fontWeight: 500 }}>
                      Manage your profile email and password credentials
                    </Typography>
                  </Box>
                </Box>

                <form onSubmit={handleAccountUpdate} style={{ display: "flex", flexDirection: "column", flex: 1 }}>
                  <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5, flex: 1 }}>
                    <TextField
                      label="Email Address"
                      size="small"
                      type="email"
                      fullWidth
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      slotProps={{
                        input: {
                          sx: { borderRadius: "10px", fontSize: 13.5, bgcolor: "#f8fafc" },
                        },
                      }}
                    />

                    <Divider sx={{ my: 0.5, borderColor: "#f1f5f9" }} />

                    <Box>
                      <Typography sx={{ fontSize: 13.5, fontWeight: 700, color: "#0f172a", mb: 0.5 }}>
                        Change Password
                      </Typography>
                      <Typography sx={{ fontSize: 12, color: "#64748b" }}>
                        Leave blank if you do not wish to update your password
                      </Typography>
                    </Box>

                    <TextField
                      label="New Password"
                      size="small"
                      type={showPassword ? "text" : "password"}
                      fullWidth
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      slotProps={{
                        input: {
                          sx: { borderRadius: "10px", fontSize: 13.5 },
                          startAdornment: (
                            <InputAdornment position="start">
                              <LockIcon sx={{ fontSize: 17, color: "#94a3b8" }} />
                            </InputAdornment>
                          ),
                          endAdornment: (
                            <InputAdornment position="end">
                              <IconButton
                                size="small"
                                onClick={() => setShowPassword(!showPassword)}
                                edge="end"
                              >
                                {showPassword ? <VisibilityOffIcon sx={{ fontSize: 17 }} /> : <VisibilityIcon sx={{ fontSize: 17 }} />}
                              </IconButton>
                            </InputAdornment>
                          ),
                        },
                      }}
                    />

                    <TextField
                      label="Confirm New Password"
                      size="small"
                      type={showConfirmPassword ? "text" : "password"}
                      fullWidth
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      disabled={!password}
                      slotProps={{
                        input: {
                          sx: { borderRadius: "10px", fontSize: 13.5 },
                          startAdornment: (
                            <InputAdornment position="start">
                              <LockIcon sx={{ fontSize: 17, color: "#94a3b8" }} />
                            </InputAdornment>
                          ),
                          endAdornment: (
                            <InputAdornment position="end">
                              <IconButton
                                size="small"
                                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                edge="end"
                                disabled={!password}
                              >
                                {showConfirmPassword ? <VisibilityOffIcon sx={{ fontSize: 17 }} /> : <VisibilityIcon sx={{ fontSize: 17 }} />}
                              </IconButton>
                            </InputAdornment>
                          ),
                        },
                      }}
                    />

                    {password && confirmPassword && (
                      <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
                        {password === confirmPassword ? (
                          <>
                            <CheckCircleIcon sx={{ fontSize: 16, color: "#10b981" }} />
                            <Typography sx={{ fontSize: 12.5, fontWeight: 700, color: "#047857" }}>
                              Passwords match
                            </Typography>
                          </>
                        ) : (
                          <Typography sx={{ fontSize: 12.5, fontWeight: 700, color: "#ef4444" }}>
                            ✕ Passwords do not match
                          </Typography>
                        )}
                      </Box>
                    )}
                  </Box>

                  <Box sx={{ mt: 3, pt: 2, borderTop: "1px solid #f1f5f9", display: "flex", justifyContent: "flex-end" }}>
                    <Button
                      type="submit"
                      variant="contained"
                      disabled={savingAccount || (!!password && password !== confirmPassword)}
                      startIcon={savingAccount ? <CircularProgress size={16} sx={{ color: "#ffffff" }} /> : null}
                      sx={{
                        background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
                        color: "#ffffff",
                        textTransform: "none",
                        fontWeight: 700,
                        fontSize: 13.5,
                        borderRadius: "10px",
                        px: 3.5,
                        py: 1,
                        boxShadow: "0 4px 14px rgba(15, 23, 42, 0.2)",
                        "&:hover": { background: "linear-gradient(135deg, #1e293b 0%, #334155 100%)", boxShadow: "0 6px 18px rgba(15, 23, 42, 0.3)" },
                      }}
                    >
                      {savingAccount ? "Saving Account..." : "Save Account"}
                    </Button>
                  </Box>
                </form>
              </CardContent>
            </Card>
          </Box>

          {/* Right Column: Collaborators & App Invites */}
          <Box>
            <Box sx={{ display: "flex", flexDirection: "column", gap: 3.5 }}>
              {/* Card 2: Invite & Manage Team Collaborators */}
              <Card
                elevation={0}
                sx={{
                  borderRadius: "20px",
                  boxShadow: "0 10px 30px rgba(0,0,0,0.03)",
                  border: "1px solid #e2e8f0",
                  bgcolor: "#ffffff",
                }}
              >
                <CardContent sx={{ p: { xs: 3, sm: 3.5 } }}>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 3 }}>
                    <Box
                      sx={{
                        width: 42,
                        height: 42,
                        borderRadius: "12px",
                        bgcolor: "#f5f3ff",
                        color: "#8b5cf6",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        boxShadow: "0 4px 12px rgba(139, 92, 246, 0.12)",
                      }}
                    >
                      <GroupAddIcon sx={{ fontSize: 22 }} />
                    </Box>
                    <Box>
                      <Typography sx={{ fontWeight: 800, fontSize: 17, color: "#0f172a" }}>
                        Team Collaborators
                      </Typography>
                      <Typography sx={{ fontSize: 12.5, color: "#64748b", fontWeight: 500 }}>
                        Invite teammates to view and manage your tracked apps
                      </Typography>
                    </Box>
                  </Box>

                  <FormControl fullWidth size="small" sx={{ mb: 2.5 }}>
                    <InputLabel id="select-app-label">Select Application</InputLabel>
                    <Select
                      labelId="select-app-label"
                      value={selectedAppId}
                      label="Select Application"
                      onChange={(e) => {
                        const val = e.target.value;
                        setSelectedAppId(val as number | "");
                        if (val) {
                          fetchAppCollabs(Number(val));
                        } else {
                          setAppCollaborators([]);
                          setAppPendingInvites([]);
                          setAppOwner(null);
                        }
                      }}
                      sx={{ borderRadius: "10px", fontSize: 13.5, bgcolor: "#f8fafc" }}
                    >
                      {ownedApps.map((app) => (
                        <MenuItem key={app.id} value={app.id} sx={{ fontSize: 13.5, fontWeight: 600 }}>
                          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                            <Avatar
                              src={app.icon_url || undefined}
                              sx={{ width: 22, height: 22, fontSize: 11, fontWeight: 700, bgcolor: "#0f172a" }}
                            >
                              {app.name[0]?.toUpperCase()}
                            </Avatar>
                            {app.name}
                          </Box>
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>

                  {selectedAppId ? (
                    <Box sx={{ mt: 2, display: "flex", flexDirection: "column", gap: 2.5 }}>
                      <form onSubmit={handleSendInvite}>
                        <Box sx={{ display: "flex", gap: 1.25 }}>
                          <TextField
                            size="small"
                            label="Collaborator Email"
                            type="email"
                            required
                            fullWidth
                            value={inviteEmail}
                            onChange={(e) => setInviteEmail(e.target.value)}
                            placeholder="teammate@company.com"
                            disabled={invitingCollab}
                            slotProps={{
                              input: {
                                sx: { borderRadius: "10px", fontSize: 13.5 },
                              },
                            }}
                          />
                          <Button
                            type="submit"
                            variant="contained"
                            disabled={invitingCollab || !inviteEmail.trim()}
                            endIcon={invitingCollab ? <CircularProgress size={16} sx={{ color: "#ffffff" }} /> : <SendIcon sx={{ fontSize: 16 }} />}
                            sx={{
                              background: "linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)",
                              color: "#ffffff",
                              borderRadius: "10px",
                              px: 3,
                              fontWeight: 700,
                              textTransform: "none",
                              boxShadow: "0 4px 12px rgba(59, 130, 246, 0.2)",
                              "&:hover": { background: "linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)" },
                            }}
                          >
                            {invitingCollab ? "Sending" : "Invite"}
                          </Button>
                        </Box>
                      </form>

                      <Divider sx={{ borderColor: "#f1f5f9" }} />

                      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <Typography sx={{ fontSize: 13.5, fontWeight: 800, color: "#0f172a" }}>
                          Current Team Members
                        </Typography>
                        {selectedAppObj && (
                          <Chip
                            label={selectedAppObj.name}
                            size="small"
                            sx={{ fontSize: 11, fontWeight: 700, bgcolor: "#f1f5f9", color: "#475569", height: 22 }}
                          />
                        )}
                      </Box>

                      {loadingCollabs ? (
                        <Box sx={{ display: "flex", justifyContent: "center", py: 3 }}>
                          <CircularProgress size={24} sx={{ color: "#3b82f6" }} />
                        </Box>
                      ) : (
                        <List dense disablePadding>
                          {/* Owner */}
                          {appOwner && (
                            <ListItem sx={{ px: 1.5, py: 1.25, borderRadius: "10px", mb: 0.75, bgcolor: "#fff7ed", border: "1px solid #ffedd5" }}>
                              <PersonIcon sx={{ fontSize: 18, mr: 1.25, color: "#ea580c" }} />
                              <ListItemText
                                primary={appOwner}
                                slotProps={{ primary: { sx: { fontSize: 13, fontWeight: 700, color: "#0f172a" } } }}
                              />
                              <Chip label="App Owner" size="small" sx={{ height: 22, fontSize: 10.5, fontWeight: 800, bgcolor: "#ffedd5", color: "#c2410c", border: "1px solid #fed7aa" }} />
                            </ListItem>
                          )}

                          {/* Collaborators */}
                          {appCollaborators.map((collab) => (
                            <ListItem key={collab} sx={{ px: 1.5, py: 1.25, borderRadius: "10px", mb: 0.75, bgcolor: "#f8fafc", border: "1px solid #e2e8f0" }}>
                              <PersonIcon sx={{ fontSize: 18, mr: 1.25, color: "#3b82f6" }} />
                              <ListItemText
                                primary={collab}
                                slotProps={{ primary: { sx: { fontSize: 13, fontWeight: 600, color: "#334155" } } }}
                              />
                              <Chip label="Collaborator" size="small" sx={{ height: 22, fontSize: 10.5, fontWeight: 800, bgcolor: "#eff6ff", color: "#2563eb", border: "1px solid #bfdbfe" }} />
                            </ListItem>
                          ))}

                          {/* Pending Invites */}
                          {appPendingInvites.map((pending) => (
                            <ListItem key={pending} sx={{ px: 1.5, py: 1.25, borderRadius: "10px", mb: 0.75, bgcolor: "#fffbeb", border: "1px solid #fef3c7" }}>
                              <PersonIcon sx={{ fontSize: 18, mr: 1.25, color: "#d97706" }} />
                              <ListItemText
                                primary={pending}
                                slotProps={{ primary: { sx: { fontSize: 13, color: "#78350f" } } }}
                              />
                              <Chip label="Pending Acceptance" size="small" sx={{ height: 22, fontSize: 10.5, fontWeight: 800, bgcolor: "#fef3c7", color: "#b45309", border: "1px solid #fde68a" }} />
                            </ListItem>
                          ))}

                          {appCollaborators.length === 0 && appPendingInvites.length === 0 && (
                            <Typography sx={{ fontSize: 12.5, color: "#94a3b8", textAlign: "center", py: 2, fontStyle: "italic" }}>
                              No extra team members invited yet.
                            </Typography>
                          )}
                        </List>
                      )}
                    </Box>
                  ) : (
                    <Typography sx={{ fontSize: 13, color: "#94a3b8", textAlign: "center", py: 3, fontStyle: "italic" }}>
                      Select one of your tracked applications above to manage team members.
                    </Typography>
                  )}
                </CardContent>
              </Card>
            </Box>
          </Box>
        </Box>

        {/* 3. Full-Width Pending Invitations Section */}
        <Card
          elevation={0}
          sx={{
            borderRadius: "20px",
            boxShadow: "0 10px 30px rgba(0,0,0,0.03)",
            border: "1px solid #e2e8f0",
            bgcolor: "#ffffff",
            mt: 3.5,
          }}
        >
          <CardContent sx={{ p: { xs: 3, sm: 3.5 } }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 2.5 }}>
              <Box
                sx={{
                  width: 42,
                  height: 42,
                  borderRadius: "12px",
                  bgcolor: "#ecfdf5",
                  color: "#10b981",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow: "0 4px 12px rgba(16, 185, 129, 0.12)",
                }}
              >
                <MailIcon sx={{ fontSize: 22 }} />
              </Box>
              <Box>
                <Typography sx={{ fontWeight: 800, fontSize: 17, color: "#0f172a" }}>
                  Pending Invitations ({invitations.length})
                </Typography>
                <Typography sx={{ fontSize: 12.5, color: "#64748b", fontWeight: 500 }}>
                  Invitations from other app owners requesting your collaboration
                </Typography>
              </Box>
            </Box>

            {invitations.length === 0 ? (
              <Typography sx={{ fontSize: 13, color: "#94a3b8", textAlign: "center", py: 2.5, fontStyle: "italic" }}>
                No pending invitations received.
              </Typography>
            ) : (
              <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
                {invitations.map((invite) => (
                  <Box
                    key={invite.id}
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      p: 2.25,
                      borderRadius: "14px",
                      bgcolor: "#f8fafc",
                      border: "1px solid #e2e8f0",
                      flexWrap: "wrap",
                      gap: 1.5,
                    }}
                  >
                    <Box>
                      <Typography sx={{ fontSize: 14, fontWeight: 800, color: "#0f172a" }}>
                        {invite.app.name}
                      </Typography>
                      <Typography sx={{ fontSize: 12.5, color: "#64748b", mt: 0.2 }}>
                        Invited by: <strong>{invite.inviter}</strong>
                      </Typography>
                    </Box>
                    <Box sx={{ display: "flex", gap: 1 }}>
                      <Button
                        variant="contained"
                        size="small"
                        onClick={() => onAcceptInvitation(invite.id)}
                        sx={{
                          background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                          color: "#ffffff",
                          textTransform: "none",
                          fontSize: 12.5,
                          fontWeight: 700,
                          borderRadius: "8px",
                          py: 0.6,
                          px: 2.25,
                          boxShadow: "0 4px 12px rgba(16, 185, 129, 0.2)",
                          "&:hover": { background: "linear-gradient(135deg, #059669 0%, #047857 100%)" },
                        }}
                      >
                        Accept
                      </Button>
                      <Button
                        variant="outlined"
                        size="small"
                        onClick={() => onDeclineInvitation(invite.id)}
                        sx={{
                          borderColor: "#cbd5e1",
                          color: "#64748b",
                          textTransform: "none",
                          fontSize: 12.5,
                          fontWeight: 700,
                          borderRadius: "8px",
                          py: 0.6,
                          px: 1.75,
                          bgcolor: "#ffffff",
                          "&:hover": { borderColor: "#94a3b8", bgcolor: "#f8fafc" },
                        }}
                      >
                        Decline
                      </Button>
                    </Box>
                  </Box>
                ))}
              </Box>
            )}
          </CardContent>
        </Card>
      </Container>
    </Box>
  );
}
