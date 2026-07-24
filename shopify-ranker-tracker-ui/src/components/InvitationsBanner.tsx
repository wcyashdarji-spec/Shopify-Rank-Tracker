import { Alert, Box, Button, Typography } from "@mui/material";
import { Mail as MailIcon } from "@mui/icons-material";

interface Invitation {
  id: number;
  app: {
    id: number;
    name: string;
    url: string;
  };
  inviter: string;
}

interface InvitationsBannerProps {
  invitations: Invitation[];
  onAccept: (inviteId: number) => Promise<void>;
  onDecline: (inviteId: number) => Promise<void>;
}

export default function InvitationsBanner({
  invitations,
  onAccept,
  onDecline,
}: InvitationsBannerProps) {
  if (invitations.length === 0) return null;

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5, mb: 3 }}>
      {invitations.map((invite) => (
        <Alert
          key={invite.id}
          icon={<MailIcon sx={{ color: "#3b82f6" }} />}
          severity="info"
          sx={{
            borderRadius: "10px",
            border: "1px solid #bfdbfe",
            bgcolor: "#eff6ff",
            color: "#1e3a8a",
            "& .MuiAlert-message": {
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              width: "100%",
              flexWrap: "wrap",
              gap: 1.5,
            },
          }}
        >
          <Box>
            <Typography variant="body2" sx={{ fontWeight: 500 }}>
              You've been invited to collaborate on <strong>{invite.app.name}</strong> by <em>{invite.inviter}</em>.
            </Typography>
          </Box>
          <Box sx={{ display: "flex", gap: 1 }}>
            <Button
              variant="contained"
              size="small"
              onClick={() => onAccept(invite.id)}
              sx={{
                bgcolor: "#1e40af",
                color: "#fff",
                textTransform: "none",
                fontSize: 12,
                py: 0.25,
                px: 2,
                borderRadius: "6px",
                "&:hover": { bgcolor: "#1e3a8a" },
              }}
            >
              Accept
            </Button>
            <Button
              variant="outlined"
              size="small"
              onClick={() => onDecline(invite.id)}
              sx={{
                borderColor: "#d1d5db",
                color: "#4b5563",
                textTransform: "none",
                fontSize: 12,
                py: 0.25,
                px: 1.5,
                borderRadius: "6px",
                "&:hover": { borderColor: "#9ca3af", bgcolor: "#f9fafb" },
              }}
            >
              Decline
            </Button>
          </Box>
        </Alert>
      ))}
    </Box>
  );
}
