import { useEffect, useState } from "react";
import {
  Box,
  Button,
  Card,
  CardContent,
  Container,
  Divider,
  TextField,
  Typography,
  CircularProgress,
  InputAdornment,
  IconButton,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  List,
  ListItem,
  ListItemText,
  Chip,
} from "@mui/material";
import {
  Person as PersonIcon,
  Lock as LockIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
  Mail as MailIcon,
} from "@mui/icons-material";
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
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);

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
        setCurrentUserId(user.id);
      } catch (err: any) {
        showToast(err?.message || "Failed to load user profile", "error");
      } finally {
        setLoading(false);
      }
    };
    fetchUserProfile();
  }, [showToast]);

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

  const fetchAppCollabs = async (appId: number) => {
    try {
      setLoadingCollabs(true);
      const res = await api.getAppCollaborators(appId);
      setAppOwner(res.owner);
      setAppCollaborators(res.collaborators);
      setAppPendingInvites(res.pending_invitations);
    } catch (err: any) {
      showToast(err?.message || "Failed to load collaborators", "error");
    } finally {
      setLoadingCollabs(false);
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

  const ownedApps = apps.filter((app) => app.user_id === currentUserId);

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", height: "70vh" }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Container maxWidth="sm" sx={{ py: 4 }}>
      <Box sx={{ mb: 4, textAlign: "center" }}>
        <Typography variant="h5" sx={{ fontWeight: 600, color: "#111827", mb: 0.5 }}>
          Profile Settings
        </Typography>
        <Typography variant="body2" sx={{ color: "#6b7280" }}>
          Manage your account details, invite collaborators, and view pending invitations.
        </Typography>
      </Box>

      {/* Account Details Card */}
      <Card
        sx={{
          borderRadius: "12px",
          boxShadow: "0 1px 3px rgba(0,0,0,0.05), 0 1px 2px rgba(0,0,0,0.03)",
          border: "1px solid #e5e7eb",
          bgcolor: "#fff",
        }}
      >
        <CardContent sx={{ p: 4 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 3 }}>
            <PersonIcon sx={{ color: "#6b7280" }} />
            <Typography sx={{ fontWeight: 600, fontSize: 16, color: "#111827" }}>
              Account Information
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
                    sx: { borderRadius: "8px", fontSize: 13.5 },
                  },
                }}
              />

              <Divider sx={{ my: 1 }} />

              <Typography sx={{ fontSize: 13, fontWeight: 600, color: "#4b5563" }}>
                Change Password (Leave blank to keep current)
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
                    sx: { borderRadius: "8px", fontSize: 13.5 },
                    startAdornment: (
                      <InputAdornment position="start">
                        <LockIcon sx={{ fontSize: 16, color: "#9ca3af" }} />
                      </InputAdornment>
                    ),
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton
                          size="small"
                          onClick={() => setShowPassword(!showPassword)}
                          edge="end"
                        >
                          {showPassword ? <VisibilityOffIcon sx={{ fontSize: 16 }} /> : <VisibilityIcon sx={{ fontSize: 16 }} />}
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
                    sx: { borderRadius: "8px", fontSize: 13.5 },
                    startAdornment: (
                      <InputAdornment position="start">
                        <LockIcon sx={{ fontSize: 16, color: "#9ca3af" }} />
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
                          {showConfirmPassword ? <VisibilityOffIcon sx={{ fontSize: 16 }} /> : <VisibilityIcon sx={{ fontSize: 16 }} />}
                        </IconButton>
                      </InputAdornment>
                    ),
                  },
                }}
              />

              {createdAt && (
                <Typography sx={{ fontSize: 11, color: "#9ca3af", mt: 1 }}>
                  Account created: {new Date(createdAt).toLocaleDateString(undefined, { dateStyle: "long" })}
                </Typography>
              )}

              <Box sx={{ mt: 1.5, display: "flex", justifyContent: "flex-end" }}>
                <Button
                  type="submit"
                  variant="contained"
                  disabled={savingAccount}
                  sx={{
                    bgcolor: "#111827",
                    color: "#fff",
                    textTransform: "none",
                    fontWeight: 600,
                    fontSize: 13,
                    borderRadius: "8px",
                    px: 3,
                    py: 0.75,
                    "&:hover": { bgcolor: "#1f2937" },
                  }}
                >
                  {savingAccount ? "Saving..." : "Save Account"}
                </Button>
              </Box>
            </Box>
          </form>
        </CardContent>
      </Card>

      {/* Invite Collaborators Card */}
      <Card
        sx={{
          borderRadius: "12px",
          boxShadow: "0 1px 3px rgba(0,0,0,0.05), 0 1px 2px rgba(0,0,0,0.03)",
          border: "1px solid #e5e7eb",
          bgcolor: "#fff",
          mt: 3,
        }}
      >
        <CardContent sx={{ p: 4 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 3 }}>
            <PersonIcon sx={{ color: "#6b7280" }} />
            <Typography sx={{ fontWeight: 600, fontSize: 16, color: "#111827" }}>
              Invite Collaborators to Your Apps
            </Typography>
          </Box>

          <FormControl fullWidth size="small" sx={{ mb: 2 }}>
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
              sx={{ borderRadius: "8px" }}
            >
              <MenuItem value="">
                <em>-- Select an App --</em>
              </MenuItem>
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
                <Box sx={{ display: "flex", gap: 1 }}>
                  <TextField
                    size="small"
                    label="Collaborator Email"
                    type="email"
                    required
                    fullWidth
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="user@example.com"
                    disabled={invitingCollab}
                    slotProps={{
                      input: {
                        sx: { borderRadius: "8px", fontSize: 13.5 },
                      },
                    }}
                  />
                  <Button
                    type="submit"
                    variant="contained"
                    disabled={invitingCollab || !inviteEmail}
                    sx={{
                      bgcolor: "#111827",
                      borderRadius: "8px",
                      px: 3,
                      textTransform: "none",
                      "&:hover": { bgcolor: "#1f2937" },
                    }}
                  >
                    {invitingCollab ? <CircularProgress size={16} sx={{ color: "#fff" }} /> : "Invite"}
                  </Button>
                </Box>
              </form>

              <Divider />

              <Typography sx={{ fontSize: 13, fontWeight: 600, color: "#4b5563" }}>
                Current Collaborators
              </Typography>

              {loadingCollabs ? (
                <Box sx={{ display: "flex", justifyContent: "center", py: 2 }}>
                  <CircularProgress size={24} />
                </Box>
              ) : (
                <List dense disablePadding>
                  {/* Owner */}
                  {appOwner && (
                    <ListItem sx={{ px: 0.5, py: 0.75 }}>
                      <PersonIcon sx={{ fontSize: 18, mr: 1, color: "#f97316" }} />
                      <ListItemText
                        primary={appOwner}
                        slotProps={{ primary: { sx: { fontSize: 13, fontWeight: 500 } } }}
                      />
                      <Chip label="Owner" size="small" sx={{ height: 18, fontSize: 10, bgcolor: "#ffedd5", color: "#ea580c" }} />
                    </ListItem>
                  )}

                  {/* Collaborators */}
                  {appCollaborators.map((collab) => (
                    <ListItem key={collab} sx={{ px: 0.5, py: 0.75 }}>
                      <PersonIcon sx={{ fontSize: 18, mr: 1, color: "#6b7280" }} />
                      <ListItemText
                        primary={collab}
                        slotProps={{ primary: { sx: { fontSize: 13 } } }}
                      />
                      <Chip label="Collaborator" size="small" sx={{ height: 18, fontSize: 10, bgcolor: "#f3f4f6", color: "#4b5563" }} />
                    </ListItem>
                  ))}

                  {/* Pending Invites */}
                  {appPendingInvites.map((pending) => (
                    <ListItem key={pending} sx={{ px: 0.5, py: 0.75 }}>
                      <PersonIcon sx={{ fontSize: 18, mr: 1, color: "#9ca3af" }} />
                      <ListItemText
                        primary={pending}
                        slotProps={{ primary: { sx: { fontSize: 13, color: "#9ca3af" } } }}
                      />
                      <Chip label="Pending" size="small" sx={{ height: 18, fontSize: 10, bgcolor: "#eff6ff", color: "#2563eb" }} />
                    </ListItem>
                  ))}

                  {appCollaborators.length === 0 && appPendingInvites.length === 0 && (
                    <Typography sx={{ fontSize: 12, color: "#9ca3af", textAlign: "center", py: 1 }}>
                      No collaborators yet. Invite someone!
                    </Typography>
                  )}
                </List>
              )}
            </Box>
          ) : (
            <Typography sx={{ fontSize: 12, color: "#9ca3af", textAlign: "center", py: 2 }}>
              Please select one of your tracked applications above to invite collaborators.
            </Typography>
          )}
        </CardContent>
      </Card>

      {/* Pending Invitations Card */}
      <Card
        sx={{
          borderRadius: "12px",
          boxShadow: "0 1px 3px rgba(0,0,0,0.05), 0 1px 2px rgba(0,0,0,0.03)",
          border: "1px solid #e5e7eb",
          bgcolor: "#fff",
          mt: 3,
        }}
      >
        <CardContent sx={{ p: 4 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 3 }}>
            <MailIcon sx={{ color: "#6b7280" }} />
            <Typography sx={{ fontWeight: 600, fontSize: 16, color: "#111827" }}>
              Pending Collaborator Invitations
            </Typography>
          </Box>

          {invitations.length === 0 ? (
            <Typography sx={{ fontSize: 13, color: "#9ca3af", textAlign: "center", py: 2 }}>
              No pending invitations.
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
                    p: 2,
                    borderRadius: "8px",
                    bgcolor: "#f9fafb",
                    border: "1px solid #e5e7eb",
                    flexWrap: "wrap",
                    gap: 1.5,
                  }}
                >
                  <Box>
                    <Typography sx={{ fontSize: 13, fontWeight: 500, color: "#374151" }}>
                      <strong>{invite.app.name}</strong>
                    </Typography>
                    <Typography sx={{ fontSize: 11, color: "#6b7280" }}>
                      Invited by: {invite.inviter}
                    </Typography>
                  </Box>
                  <Box sx={{ display: "flex", gap: 1 }}>
                    <Button
                      variant="contained"
                      size="small"
                      onClick={() => onAcceptInvitation(invite.id)}
                      sx={{
                        bgcolor: "#111827",
                        color: "#fff",
                        textTransform: "none",
                        fontSize: 12,
                        borderRadius: "6px",
                        py: 0.5,
                        px: 2,
                        "&:hover": { bgcolor: "#1f2937" },
                      }}
                    >
                      Accept
                    </Button>
                    <Button
                      variant="outlined"
                      size="small"
                      onClick={() => onDeclineInvitation(invite.id)}
                      sx={{
                        borderColor: "#d1d5db",
                        color: "#4b5563",
                        textTransform: "none",
                        fontSize: 12,
                        borderRadius: "6px",
                        py: 0.5,
                        px: 1.5,
                        "&:hover": { borderColor: "#9ca3af", bgcolor: "#f9fafb" },
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
  );
}
