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
        <CircularProgress size={32} sx={{ color: "#6366f1" }} />
      </Box>
    );
  }

  const initialLetter = email ? email[0]?.toUpperCase() : "U";

  return (
    <Box sx={{ position: "relative", minHeight: "100%" }}>
      {/* Background Ambient Animations */}
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
            top: "10%",
            right: "15%",
            width: 420,
            height: 420,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(99, 102, 241, 0.12) 0%, rgba(139, 92, 246, 0.02) 70%)",
            filter: "blur(60px)",
            animation: "floatProfileOrb1 14s ease-in-out infinite",
          }}
        />
        <Box
          sx={{
            position: "absolute",
            bottom: "15%",
            left: "10%",
            width: 380,
            height: 380,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(16, 185, 129, 0.12) 0%, rgba(52, 211, 153, 0.02) 70%)",
            filter: "blur(55px)",
            animation: "floatProfileOrb2 16s ease-in-out infinite",
          }}
        />
      </Box>

      <style>{`
        @keyframes floatProfileOrb1 {
          0%, 100% { transform: translate(0px, 0px) scale(1); }
          50% { transform: translate(-30px, 40px) scale(1.1); }
        }
        @keyframes floatProfileOrb2 {
          0%, 100% { transform: translate(0px, 0px) scale(1); }
          50% { transform: translate(40px, -30px) scale(1.15); }
        }
      `}</style>

      <Container maxWidth="sm" sx={{ py: { xs: 3, sm: 4 }, px: { xs: 2, sm: 3 }, position: "relative", zIndex: 1 }}>
        {/* Profile Overview Hero Card */}
        <Paper
          elevation={0}
          sx={{
            p: { xs: 3, sm: 3.5 },
            borderRadius: "16px",
            border: "1px solid #e2e8f0",
            bgcolor: "#ffffff",
            mb: 3.5,
            boxShadow: "0 10px 30px rgba(0, 0, 0, 0.03)",
            display: "flex",
            alignItems: "center",
            gap: 2.5,
            flexWrap: "wrap",
          }}
        >
          <Avatar
            sx={{
              width: 64,
              height: 64,
              fontSize: 26,
              fontWeight: 800,
              bgcolor: "#6366f1",
              color: "#ffffff",
              boxShadow: "0 6px 20px rgba(99, 102, 241, 0.3)",
            }}
          >
            {initialLetter}
          </Avatar>

          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.25, mb: 0.5, flexWrap: "wrap" }}>
              <Typography sx={{ fontWeight: 800, fontSize: 20, color: "#0f172a" }}>
                {email}
              </Typography>
              <Chip
                label="Account Owner"
                size="small"
                sx={{
                  fontSize: 11,
                  fontWeight: 700,
                  bgcolor: "#e0e7ff",
                  color: "#4f46e5",
                  height: 22,
                }}
              />
            </Box>

            <Box sx={{ display: "flex", alignItems: "center", gap: 2, flexWrap: "wrap" }}>
              {createdAt && (
                <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
                  <CalendarTodayIcon sx={{ fontSize: 13, color: "#94a3b8" }} />
                  <Typography sx={{ fontSize: 12.5, color: "#64748b" }}>
                    Member since {new Date(createdAt).toLocaleDateString(undefined, { dateStyle: "long" })}
                  </Typography>
                </Box>
              )}
              <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
                <SecurityIcon sx={{ fontSize: 13, color: "#10b981" }} />
                <Typography sx={{ fontSize: 12.5, color: "#047857", fontWeight: 600 }}>
                  Account Active
                </Typography>
              </Box>
            </Box>
          </Box>
        </Paper>

        {/* Account Details & Security Card */}
        <Card
          elevation={0}
          sx={{
            borderRadius: "16px",
            boxShadow: "0 10px 30px rgba(0,0,0,0.03)",
            border: "1px solid #e2e8f0",
            bgcolor: "#ffffff",
            mb: 3.5,
          }}
        >
          <CardContent sx={{ p: { xs: 3, sm: 4 } }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.25, mb: 3 }}>
              <Box sx={{ width: 36, height: 36, borderRadius: "10px", bgcolor: "#f1f5f9", color: "#0f172a", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <PersonIcon sx={{ fontSize: 20 }} />
              </Box>
              <Typography sx={{ fontWeight: 800, fontSize: 17, color: "#0f172a" }}>
                Account Information & Password
              </Typography>
            </Box>

            <form onSubmit={handleAccountUpdate}>
              <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5 }}>
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
                      sx: { borderRadius: "10px", fontSize: 13.5 },
                    },
                  }}
                />

                <Divider sx={{ my: 0.5, borderColor: "#f1f5f9" }} />

                <Typography sx={{ fontSize: 13.5, fontWeight: 700, color: "#0f172a" }}>
                  Change Password (Leave blank to keep current password)
                </Typography>

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
                        <CheckCircleIcon sx={{ fontSize: 15, color: "#10b981" }} />
                        <Typography sx={{ fontSize: 12, fontWeight: 700, color: "#047857" }}>
                          Passwords match
                        </Typography>
                      </>
                    ) : (
                      <Typography sx={{ fontSize: 12, fontWeight: 700, color: "#ef4444" }}>
                        ✕ Passwords do not match
                      </Typography>
                    )}
                  </Box>
                )}

                <Box sx={{ mt: 1, display: "flex", justifyContent: "flex-end" }}>
                  <Button
                    type="submit"
                    variant="contained"
                    disabled={savingAccount || (!!password && password !== confirmPassword)}
                    sx={{
                      bgcolor: "#0f172a",
                      color: "#ffffff",
                      textTransform: "none",
                      fontWeight: 700,
                      fontSize: 13.5,
                      borderRadius: "9px",
                      px: 3.5,
                      py: 0.85,
                      boxShadow: "0 4px 12px rgba(15, 23, 42, 0.15)",
                      "&:hover": { bgcolor: "#1e293b", boxShadow: "0 6px 16px rgba(15, 23, 42, 0.25)" },
                    }}
                  >
                    {savingAccount ? "Saving Account..." : "Save Account"}
                  </Button>
                </Box>
              </Box>
            </form>
          </CardContent>
        </Card>

        {/* Invite Collaborators Card */}
        <Card
          elevation={0}
          sx={{
            borderRadius: "16px",
            boxShadow: "0 10px 30px rgba(0,0,0,0.03)",
            border: "1px solid #e2e8f0",
            bgcolor: "#ffffff",
            mb: 3.5,
          }}
        >
          <CardContent sx={{ p: { xs: 3, sm: 4 } }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.25, mb: 3 }}>
              <Box sx={{ width: 36, height: 36, borderRadius: "10px", bgcolor: "#f1f5f9", color: "#0f172a", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <GroupAddIcon sx={{ fontSize: 20 }} />
              </Box>
              <Typography sx={{ fontWeight: 800, fontSize: 17, color: "#0f172a" }}>
                Invite Collaborators to Your Apps
              </Typography>
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
                sx={{ borderRadius: "10px", fontSize: 13.5 }}
              >
                {ownedApps.map((app) => (
                  <MenuItem key={app.id} value={app.id}>
                    {app.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {selectedAppId ? (
              <Box sx={{ mt: 2, display: "flex", flexDirection: "column", gap: 2.5 }}>
                <form onSubmit={handleSendInvite}>
                  <Box sx={{ display: "flex", gap: 1.5 }}>
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
                      sx={{
                        bgcolor: "#0f172a",
                        color: "#ffffff",
                        borderRadius: "9px",
                        px: 3,
                        fontWeight: 700,
                        textTransform: "none",
                        "&:hover": { bgcolor: "#1e293b" },
                      }}
                    >
                      {invitingCollab ? <CircularProgress size={16} sx={{ color: "#ffffff" }} /> : "Invite"}
                    </Button>
                  </Box>
                </form>

                <Divider sx={{ borderColor: "#f1f5f9" }} />

                <Typography sx={{ fontSize: 13.5, fontWeight: 700, color: "#0f172a" }}>
                  Current Team Collaborators
                </Typography>

                {loadingCollabs ? (
                  <Box sx={{ display: "flex", justifyContent: "center", py: 2 }}>
                    <CircularProgress size={24} sx={{ color: "#6366f1" }} />
                  </Box>
                ) : (
                  <List dense disablePadding>
                    {/* Owner */}
                    {appOwner && (
                      <ListItem sx={{ px: 1.25, py: 1, borderRadius: "8px", mb: 0.5, bgcolor: "#f8fafc", border: "1px solid #f1f5f9" }}>
                        <PersonIcon sx={{ fontSize: 18, mr: 1.25, color: "#ea580c" }} />
                        <ListItemText
                          primary={appOwner}
                          slotProps={{ primary: { sx: { fontSize: 13, fontWeight: 700, color: "#0f172a" } } }}
                        />
                        <Chip label="App Owner" size="small" sx={{ height: 20, fontSize: 10.5, fontWeight: 700, bgcolor: "#ffedd5", color: "#ea580c" }} />
                      </ListItem>
                    )}

                    {/* Collaborators */}
                    {appCollaborators.map((collab) => (
                      <ListItem key={collab} sx={{ px: 1.25, py: 1, borderRadius: "8px", mb: 0.5, bgcolor: "#f8fafc", border: "1px solid #f1f5f9" }}>
                        <PersonIcon sx={{ fontSize: 18, mr: 1.25, color: "#6366f1" }} />
                        <ListItemText
                          primary={collab}
                          slotProps={{ primary: { sx: { fontSize: 13, fontWeight: 600, color: "#334155" } } }}
                        />
                        <Chip label="Collaborator" size="small" sx={{ height: 20, fontSize: 10.5, fontWeight: 700, bgcolor: "#e0e7ff", color: "#4f46e5" }} />
                      </ListItem>
                    ))}

                    {/* Pending Invites */}
                    {appPendingInvites.map((pending) => (
                      <ListItem key={pending} sx={{ px: 1.25, py: 1, borderRadius: "8px", mb: 0.5, bgcolor: "#f8fafc", border: "1px solid #f1f5f9" }}>
                        <PersonIcon sx={{ fontSize: 18, mr: 1.25, color: "#94a3b8" }} />
                        <ListItemText
                          primary={pending}
                          slotProps={{ primary: { sx: { fontSize: 13, color: "#64748b" } } }}
                        />
                        <Chip label="Pending Acceptance" size="small" sx={{ height: 20, fontSize: 10.5, fontWeight: 700, bgcolor: "#fffbeb", color: "#b45309" }} />
                      </ListItem>
                    ))}

                    {appCollaborators.length === 0 && appPendingInvites.length === 0 && (
                      <Typography sx={{ fontSize: 12.5, color: "#94a3b8", textAlign: "center", py: 1.5, fontStyle: "italic" }}>
                        No extra team members invited yet.
                      </Typography>
                    )}
                  </List>
                )}
              </Box>
            ) : (
              <Typography sx={{ fontSize: 13, color: "#94a3b8", textAlign: "center", py: 2, fontStyle: "italic" }}>
                Select one of your tracked applications above to invite collaborators.
              </Typography>
            )}
          </CardContent>
        </Card>

        {/* Pending Invitations Card */}
        <Card
          elevation={0}
          sx={{
            borderRadius: "16px",
            boxShadow: "0 10px 30px rgba(0,0,0,0.03)",
            border: "1px solid #e2e8f0",
            bgcolor: "#ffffff",
          }}
        >
          <CardContent sx={{ p: { xs: 3, sm: 4 } }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.25, mb: 3 }}>
              <Box sx={{ width: 36, height: 36, borderRadius: "10px", bgcolor: "#f1f5f9", color: "#0f172a", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <MailIcon sx={{ fontSize: 20 }} />
              </Box>
              <Typography sx={{ fontWeight: 800, fontSize: 17, color: "#0f172a" }}>
                Pending Collaborator Invitations ({invitations.length})
              </Typography>
            </Box>

            {invitations.length === 0 ? (
              <Typography sx={{ fontSize: 13, color: "#94a3b8", textAlign: "center", py: 2, fontStyle: "italic" }}>
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
                      borderRadius: "12px",
                      bgcolor: "#f8fafc",
                      border: "1px solid #e2e8f0",
                      flexWrap: "wrap",
                      gap: 1.5,
                    }}
                  >
                    <Box>
                      <Typography sx={{ fontSize: 14, fontWeight: 700, color: "#0f172a" }}>
                        {invite.app.name}
                      </Typography>
                      <Typography sx={{ fontSize: 12, color: "#64748b" }}>
                        Invited by: {invite.inviter}
                      </Typography>
                    </Box>
                    <Box sx={{ display: "flex", gap: 1 }}>
                      <Button
                        variant="contained"
                        size="small"
                        onClick={() => onAcceptInvitation(invite.id)}
                        sx={{
                          bgcolor: "#0f172a",
                          color: "#ffffff",
                          textTransform: "none",
                          fontSize: 12.5,
                          fontWeight: 700,
                          borderRadius: "8px",
                          py: 0.6,
                          px: 2.25,
                          "&:hover": { bgcolor: "#1e293b" },
                        }}
                      >
                        Accept
                      </Button>
                      <Button
                        variant="outlined"
                        size="small"
                        onClick={() => onDeclineInvitation(invite.id)}
                        sx={{
                          borderColor: "#e2e8f0",
                          color: "#64748b",
                          textTransform: "none",
                          fontSize: 12.5,
                          fontWeight: 700,
                          borderRadius: "8px",
                          py: 0.6,
                          px: 1.75,
                          "&:hover": { borderColor: "#cbd5e1", bgcolor: "#ffffff" },
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
