// Material UI
import { Box, Button, Dialog, DialogContent, DialogTitle, IconButton, Typography } from "@mui/material";
import { Close as CloseIcon, OpenInNew as OpenIcon } from "@mui/icons-material";

interface ScreenshotDialogProps {
  open: boolean;
  onClose: () => void;
  screenshotUrl: string | null;
  onShowMessage: (msg: string, severity: "success" | "error" | "info") => void;
}

export default function ScreenshotDialog({
  open,
  onClose,
  screenshotUrl,
}: ScreenshotDialogProps) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="lg"
      fullWidth
      slotProps={{
        paper: {
          sx: {
            borderRadius: "12px",
            border: "1px solid #e5e7eb",
            boxShadow: "0 25px 80px rgba(0,0,0,0.15)",
            maxHeight: "90vh",
          },
        },
      }}
    >
      <DialogTitle
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderBottom: "1px solid #f3f4f6",
          py: 1.5,
          px: 2.5,
        }}
      >
        <Typography sx={{ fontWeight: 600, fontSize: 14, color: "#111827" }}>
          Search Results Screenshot
        </Typography>
        <Box sx={{ display: "flex", gap: 1 }}>
          {screenshotUrl && (
            <Button
              size="small"
              href={screenshotUrl}
              target="_blank"
              rel="noopener noreferrer"
              startIcon={<OpenIcon sx={{ fontSize: 14 }} />}
              sx={{
                textTransform: "none",
                fontSize: 12,
                color: "#6366f1",
                border: "1px solid #e5e7eb",
                borderRadius: "8px",
                px: 1.5,
                py: 0.5,
                "&:hover": { bgcolor: "#ede9fe", borderColor: "#a5b4fc" },
              }}
            >
              Open
            </Button>
          )}
          <IconButton size="small" onClick={onClose} sx={{ color: "#9ca3af", "&:hover": { color: "#374151" } }}>
            <CloseIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </Box>
      </DialogTitle>
      <DialogContent sx={{ p: 2, bgcolor: "#f9fafb" }}>
        {screenshotUrl ? (
          <Box
            component="img"
            src={screenshotUrl}
            alt="Search results screenshot"
            sx={{
              width: "100%",
              height: "auto",
              display: "block",
              borderRadius: "8px",
              border: "1px solid #e5e7eb",
              boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
            }}
          />
        ) : (
          <Box
            sx={{
              height: 300,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#9ca3af",
            }}
          >
            <Typography sx={{ fontSize: 13 }}>Screenshot not available.</Typography>
          </Box>
        )}
      </DialogContent>
    </Dialog>
  );
}
