import { useEffect, useState } from "react";
import {
  Box,
  Button,
  CircularProgress,
  IconButton,
  List,
  ListItem,
  ListItemText,
  Paper,
  TextField,
  Typography,
} from "@mui/material";
import {
  DeleteOutlineOutlined as DeleteIcon,
  Add as AddIcon,
} from "@mui/icons-material";
import { api, type Competitor } from "../api";

interface CompetitorManagerProps {
  appId: number;
  onRefresh: () => void;
  showToast: (message: string, severity?: "success" | "error" | "info") => void;
}

export default function CompetitorManager({
  appId,
  onRefresh,
  showToast,
}: CompetitorManagerProps) {
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");

  const loadCompetitors = async () => {
    setIsLoading(true);
    try {
      const data = await api.getCompetitors(appId);
      setCompetitors(data.competitors || []);
    } catch (err: any) {
      showToast(err?.message || "Failed to load competitors", "error");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadCompetitors();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appId]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !url.trim()) return;

    setIsAdding(true);
    try {
      await api.addCompetitor(appId, name.trim(), url.trim());
      showToast(`Added competitor: ${name}`, "success");
      setName("");
      setUrl("");
      await loadCompetitors();
      onRefresh(); // Trigger parent dashboard refresh to load updated chart data
    } catch (err: any) {
      showToast(err?.message || "Failed to add competitor", "error");
    } finally {
      setIsAdding(false);
    }
  };

  const handleDelete = async (comp: Competitor) => {
    try {
      await api.removeCompetitor(appId, comp.id);
      showToast(`Removed competitor: ${comp.name}`, "success");
      await loadCompetitors();
      onRefresh(); // Refresh chart data
    } catch (err: any) {
      showToast(err?.message || "Failed to remove competitor", "error");
    }
  };

  return (
    <Paper
      elevation={0}
      sx={{
        p: 2.5,
        borderRadius: "12px",
        border: "1px solid #e5e7eb",
        bgcolor: "#fff",
        mb: 3,
      }}
    >
      <Typography variant="h6" sx={{ fontSize: 15, fontWeight: 700, color: "#111827", mb: 2 }}>
        Manage Competitors
      </Typography>

      {/* Add Competitor Form */}
      <Box component="form" onSubmit={handleAdd} sx={{ display: "flex", gap: 1.5, mb: 3, flexWrap: { xs: "wrap", sm: "nowrap" } }}>
        <TextField
          size="small"
          label="Competitor Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={isAdding}
          sx={{ flexGrow: 1 }}
          slotProps={{
            input: {
              sx: { fontSize: 13, borderRadius: "8px" },
            },
          }}
        />
        <TextField
          size="small"
          label="Shopify URL"
          placeholder="https://apps.shopify.com/..."
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          disabled={isAdding}
          sx={{ flexGrow: 2 }}
          slotProps={{
            input: {
              sx: { fontSize: 13, borderRadius: "8px" },
            },
          }}
        />
        <Button
          type="submit"
          variant="contained"
          disabled={isAdding || !name.trim() || !url.trim()}
          startIcon={isAdding ? <CircularProgress size={16} color="inherit" /> : <AddIcon />}
          sx={{
            bgcolor: "#111827",
            color: "#fff",
            borderRadius: "8px",
            textTransform: "none",
            fontWeight: 600,
            fontSize: 13,
            px: 2.5,
            flexShrink: 0,
            "&:hover": { bgcolor: "#1f2937" },
          }}
        >
          Add
        </Button>
      </Box>

      {/* Competitors List */}
      {isLoading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 2 }}>
          <CircularProgress size={24} sx={{ color: "#6b7280" }} />
        </Box>
      ) : competitors.length === 0 ? (
        <Typography sx={{ fontSize: 12.5, color: "#9ca3af", textAlign: "center", py: 2 }}>
          No competitors linked yet. Track them side-by-side by adding above.
        </Typography>
      ) : (
        <List dense disablePadding>
          {competitors.map((comp) => (
            <ListItem
              key={comp.id}
              secondaryAction={
                <IconButton
                  edge="end"
                  size="small"
                  onClick={() => handleDelete(comp)}
                  sx={{
                    color: "#ef4444",
                    "&:hover": { bgcolor: "#fee2e2" },
                  }}
                  title={`Remove ${comp.name}`}
                >
                  <DeleteIcon fontSize="small" />
                </IconButton>
              }
              sx={{
                py: 1,
                px: 1.5,
                borderRadius: "8px",
                border: "1px solid #f3f4f6",
                mb: 1,
                bgcolor: "#f9fafb",
              }}
            >
              <ListItemText
                primary={comp.name}
                secondary={comp.url}
                slotProps={{
                  primary: { sx: { fontSize: 13, fontWeight: 500, color: "#111827" } },
                  secondary: { sx: { fontSize: 11.5, color: "#6b7280"} },
                }}
              />
            </ListItem>
          ))}
        </List>
      )}
    </Paper>
  );
}
