import { useEffect, useState } from "react";
import {
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  List,
  ListItem,
  ListItemText,
  TextField,
  Typography,
  Chip,
  Divider,
} from "@mui/material";
import { Close as CloseIcon, Person as PersonIcon, Send as SendIcon } from "@mui/icons-material";
import { api } from "../api";

interface CollaboratorsDialogProps {
  open: boolean;
  onClose: () => void;
  appId: number;
  appName: string;
  showToast: (message: string, severity?: "success" | "error" | "info") => void;
}

export default function CollaboratorsDialog({
  open,
  onClose,
  appId,
  appName,
  showToast,
}: CollaboratorsDialogProps) {
  const [loading, setLoading] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [email, setEmail] = useState("");
  const [owner, setOwner] = useState<string | null>(null);
  const [collaborators, setCollaborators] = useState<string[]>([]);
  const [pendingInvites, setPendingInvites] = useState<string[]>([]);

  const fetchCollaborators = async () => {
    try {
      setLoading(true);
      const res = await api.getAppCollaborators(appId);
      setOwner(res.owner);
      setCollaborators(res.collaborators);
      setPendingInvites(res.pending_invitations);
    } catch (err: any) {
      showToast(err?.message || "Failed to load collaborators", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      fetchCollaborators();
    }
  }, [open, appId]);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setInviting(true);
    try {
      await api.inviteCollaborator(appId, email.trim());
      showToast(`Invitation sent to ${email.trim()}`, "success");
      setEmail("");
      fetchCollaborators();
    } catch (err: any) {
      showToast(err?.message || "Failed to send invitation", "error");
    } finally {
      setInviting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="xs"
      fullWidth
      slotProps={{
        paper: {
          sx: {
            borderRadius: "12px",
            boxShadow: "0 20px 60px rgba(0,0,0,0.12)",
            border: "1px solid #e5e7eb",
          },
        },
      }}
    >
      <DialogTitle sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", pb: 1 }}>
        <Typography sx={{ fontWeight: 600, fontSize: 15 }}>
          Collaborators - {appName}
        </Typography>
        <IconButton size="small" onClick={onClose}>
          <CloseIcon sx={{ fontSize: 18 }} />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ pt: 1, display: "flex", flexDirection: "column", gap: 2.5 }}>
        {/* Form to Invite */}
        <form onSubmit={handleInvite}>
          <Box sx={{ display: "flex", gap: 1, mt: 1 }}>
            <TextField
              size="small"
              label="Invite by email"
              type="email"
              required
              fullWidth
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="user@example.com"
              disabled={inviting}
              slotProps={{
                input: {
                  sx: { borderRadius: "8px", fontSize: 12.5 },
                },
              }}
            />
            <Button
              type="submit"
              variant="contained"
              disabled={inviting || !email}
              sx={{
                bgcolor: "#111827",
                borderRadius: "8px",
                minWidth: "40px",
                px: 1.5,
                "&:hover": { bgcolor: "#1f2937" },
              }}
            >
              {inviting ? <CircularProgress size={16} sx={{ color: "#fff" }} /> : <SendIcon sx={{ fontSize: 16 }} />}
            </Button>
          </Box>
        </form>

        <Divider />

        {/* List of collaborators */}
        {loading ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 2 }}>
            <CircularProgress size={24} />
          </Box>
        ) : (
          <List dense disablePadding>
            {/* Owner */}
            {owner && (
              <ListItem sx={{ px: 0.5, py: 0.75 }}>
                <PersonIcon sx={{ fontSize: 18, mr: 1, color: "#f97316" }} />
                <ListItemText
                  primary={owner}
                  slotProps={{ primary: { sx: { fontSize: 13, fontWeight: 500 } } }}
                />
                <Chip label="Owner" size="small" sx={{ height: 18, fontSize: 10, bgcolor: "#ffedd5", color: "#ea580c" }} />
              </ListItem>
            )}

            {/* Collaborators */}
            {collaborators.map((collab) => (
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
            {pendingInvites.map((pending) => (
              <ListItem key={pending} sx={{ px: 0.5, py: 0.75 }}>
                <PersonIcon sx={{ fontSize: 18, mr: 1, color: "#9ca3af" }} />
                <ListItemText
                  primary={pending}
                  slotProps={{ primary: { sx: { fontSize: 13, color: "#9ca3af" } } }}
                />
                <Chip label="Pending" size="small" sx={{ height: 18, fontSize: 10, bgcolor: "#eff6ff", color: "#2563eb" }} />
              </ListItem>
            ))}

            {collaborators.length === 0 && pendingInvites.length === 0 && (
              <Typography sx={{ fontSize: 12, color: "#9ca3af", textAlign: "center", py: 2 }}>
                No collaborators yet. Invite someone!
              </Typography>
            )}
          </List>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} size="small" sx={{ textTransform: "none", color: "#6b7280" }}>
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
}
