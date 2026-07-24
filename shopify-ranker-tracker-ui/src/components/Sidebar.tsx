// React
import { useEffect, useState } from "react";

// Material UI
import {
  Avatar,
  Box,
  Button,
  Chip,
  CircularProgress,
  Collapse,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  InputAdornment,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  TextField,
  Typography,
} from "@mui/material";
import {
  Add as AddIcon,
  BarChart as BarChartIcon,
  Close as CloseIcon,
  DeleteOutlineOutlined as DeleteOutlineIcon,
  ExpandLess as ExpandLessIcon,
  ExpandMore as ExpandMoreIcon,
  History as HistoryIcon,
  Home as HomeIcon,
  Refresh as RefreshIcon,
  Search as SearchIcon,
  Settings as SettingsIcon,
  Logout as LogoutIcon,
} from "@mui/icons-material";

// API
import { api, type App, type AppLastSync } from "../api";


interface SidebarProps {
  apps: App[];
  selectedApp: App | null;
  onSelectApp: (app: App) => void;
  onRunAllSaved: () => void;
  onTrackApp: (name: string, url: string, keywords: string[]) => void;
  isScraping: boolean;
  isLoadingApps: boolean;
  onDeleteApp: (appId: number) => void;
  currentPage: "dashboard" | "history" | "settings";
  onNavigate: (page: "dashboard" | "history" | "settings") => void;
  onLogout?: () => void;
}

// Color palette for app avatars
const AVATAR_COLORS = [
  "#f97316","#14b8a6","#3b82f6","#8b5cf6","#ec4899","#10b981","#f59e0b","#ef4444",
];

function getAvatarColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

export default function Sidebar({
  apps,
  selectedApp,
  onSelectApp,
  onRunAllSaved,
  onTrackApp,
  isScraping,
  isLoadingApps,
  onDeleteApp,
  currentPage,
  onNavigate,
  onLogout,
}: SidebarProps) {
  const [search, setSearch] = useState("");
  const [appsExpanded, setAppsExpanded] = useState(true);
  const [trackDialogOpen, setTrackDialogOpen] = useState(false);
  const [newAppName, setNewAppName] = useState("");
  const [newAppUrl, setNewAppUrl] = useState("");
  const [newKeywordsText, setNewKeywordsText] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [appToDelete, setAppToDelete] = useState<App | null>(null);
  const [historyExpanded,] = useState(false);
  const [, setLastSyncs] = useState<AppLastSync[]>([]);
  const [, setLoadingHistory] = useState(false);
  const [reportsOpen, setReportsOpen] = useState(false);

  useEffect(() => {
  if (!historyExpanded) return;

  const fetchHistory = async () => {
    try {
      setLoadingHistory(true);

      const data = await api.getAppsLastSync();
      setLastSyncs(data.apps);

    } catch (err) {
      console.error("Failed to fetch history logs", err);
    } finally {
      setLoadingHistory(false);
    }
  };

  fetchHistory();
}, [historyExpanded]);
  const filteredApps = apps.filter((a) =>
    a.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleTrackSubmit = () => {
    const kws = newKeywordsText
      .split(/[\n,]+/)
      .map((k) => k.trim())
      .filter(Boolean);
    if (!newAppName.trim() || !newAppUrl.trim() || kws.length === 0) return;
    onTrackApp(newAppName.trim(), newAppUrl.trim(), kws);
    setTrackDialogOpen(false);
    setNewAppName(""); setNewAppUrl(""); setNewKeywordsText("");
  };

  const handleDeleteClick = (app: App) => {
    setAppToDelete(app);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = () => {
    if (!appToDelete) return;

    onDeleteApp(appToDelete.id);

    setDeleteDialogOpen(false);
    setAppToDelete(null);
  };

  const handleCancelDelete = () => {
    setDeleteDialogOpen(false);
    setAppToDelete(null);
  }
  const navItemSx = (active?: boolean) => ({
    borderRadius: "6px",
    mb: 0.25,
    px: 1.5,
    py: 0.75,
    gap: 0.5,
    bgcolor: active ? "#f0f9ff" : "transparent",
    borderLeft: active ? "3px solid #f97316" : "3px solid transparent",
    color: active ? "#f97316" : "#374151",
    "&:hover": { bgcolor: "#f9fafb" },
    transition: "all 0.15s",
  });

  return (
    <Box
      sx={{
        width: 240,
        flexShrink: 0,
        height: "100vh",
        bgcolor: "#ffffff",
        borderRight: "1px solid #e5e7eb",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      {/* Logo */}
      <Box sx={{ px: 2, py: 1.5, display: "flex", alignItems: "center", gap: 1.5, borderBottom: "1px solid #f3f4f6" }}>
        <Box
          sx={{
            width: 28, height: 28, borderRadius: "8px",
            background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "#fff", fontWeight: 700, fontSize: 13, flexShrink: 0,
          }}
        >
          R
        </Box>
        <Typography sx={{ fontWeight: 600, fontSize: 14, color: "#111827" }}>
          Rank Tracker
        </Typography>
        <Box sx={{ flexGrow: 1 }} />
        {onLogout && (
          <IconButton size="small" onClick={onLogout} sx={{ color: "#9ca3af", "&:hover": { color: "#ef4444" } }} title="Logout">
            <LogoutIcon sx={{ fontSize: 16 }} />
          </IconButton>
        )}
      </Box>

      {/* Search */}
      <Box sx={{ px: 1.5, pt: 1.5, pb: 1 }}>
        <TextField
          placeholder="Search or ask…"
          size="small"
          fullWidth
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon sx={{ fontSize: 15, color: "#9ca3af" }} />
                </InputAdornment>
              ),
              sx: {
                fontSize: 13,
                bgcolor: "#f9fafb",
                borderRadius: "8px",
                "& fieldset": { borderColor: "#e5e7eb" },
                "&:hover fieldset": { borderColor: "#d1d5db" },
                py: 0,
              },
            },
          }}
          sx={{ "& .MuiOutlinedInput-root": { borderRadius: "8px" } }}
        />
      </Box>

      {/* Nav */}
      <Box sx={{ px: 1, py: 0.5 }}>
        <List dense disablePadding>
          <ListItem disablePadding>
            <ListItemButton
                  sx={navItemSx(currentPage === "dashboard")}
                  onClick={() => onNavigate("dashboard")}
            >
              <ListItemIcon sx={{ minWidth: 28 }}>
                <HomeIcon sx={{ fontSize: 16, color: "inherit" }} />
              </ListItemIcon>
              <ListItemText slotProps={{ primary: { sx: { fontSize: 13 } } }} primary="Home" />
            </ListItemButton>
          </ListItem>
          <ListItem disablePadding>
            <ListItemButton
              sx={navItemSx(reportsOpen || currentPage === "dashboard")}
              onClick={() => setReportsOpen((prev) => !prev)}
            >
              <ListItemIcon sx={{ minWidth: 28 }}>
                <BarChartIcon sx={{ fontSize: 16, color: "inherit" }} />
              </ListItemIcon>
              <ListItemText slotProps={{ primary: { sx: { fontSize: 13 } } }} primary="Reports" />
              {reportsOpen ? <ExpandLessIcon  sx={{ fontSize: 18 }} /> : <ExpandMoreIcon  sx={{ fontSize: 18 }} />}
            </ListItemButton>
          </ListItem>

          <Collapse in={reportsOpen} timeout="auto" unmountOnExit>
            <List component="div" disablePadding>
              {apps.map((app) => (
                <ListItem key={app.id} disablePadding>
                  <ListItemButton
                    sx={{ ...navItemSx(selectedApp?.id === app.id && currentPage === "dashboard"), pl: 5 }}
                    onClick={() => {
                      onSelectApp(app);
                      onNavigate("dashboard");
                    }}
                  >
                    <ListItemText
                      slotProps={{ primary: { sx: { fontSize: 12.5 } } }}
                      primary={app.name}
                    />
                  </ListItemButton>
                </ListItem>
              ))}
              {apps.length === 0 && (
                <Typography sx={{ fontSize: 12, color: "#9ca3af", pl: 5, py: 1 }}>
                  No apps tracked yet
                </Typography>
              )}
            </List>
          </Collapse>
          <ListItem disablePadding>
            <ListItemButton
                  sx={navItemSx(currentPage === "history")}
                  onClick={() => onNavigate("history")}
              >
                <ListItemIcon sx={{ minWidth: 28 }}>
                  <HistoryIcon sx={{ fontSize: 16 }} />
                </ListItemIcon>

                <ListItemText
                  slotProps={{
                    primary: {
                      sx: { fontSize: 13 },
                    },
                  }}
                  primary="History Log"
                />
            </ListItemButton>
          </ListItem>
          <ListItem disablePadding>
            <ListItemButton
                  sx={navItemSx(currentPage === "settings")}
                  onClick={() => onNavigate("settings")}
              >
                <ListItemIcon sx={{ minWidth: 28 }}>
                  <SettingsIcon sx={{ fontSize: 16 }} />
                </ListItemIcon>

                <ListItemText
                  slotProps={{
                    primary: {
                      sx: { fontSize: 13 },
                    },
                  }}
                  primary="Profile Settings"
                />
            </ListItemButton>
          </ListItem>
        </List>
      </Box>

      <Divider sx={{ mx: 1.5, my: 0.5 }} />

      {/* Tracked Apps Section */}
      <Box sx={{ px: 1, py: 0.5, flexGrow: 1, overflowY: "auto" }}>
        <Box
          sx={{ display: "flex", alignItems: "center", px: 1, py: 0.5, cursor: "pointer", userSelect: "none" }}
          onClick={() => setAppsExpanded((v) => !v)}
        >
          <Typography sx={{ fontSize: 11, fontWeight: 600, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.06em", flexGrow: 1 }}>
            Apps
          </Typography>
          {isLoadingApps ? (
            <CircularProgress size={10} sx={{ color: "#9ca3af" }} />
          ) : appsExpanded ? (
            <ExpandLessIcon sx={{ fontSize: 14, color: "#9ca3af" }} />
          ) : (
            <ExpandMoreIcon sx={{ fontSize: 14, color: "#9ca3af" }} />
          )}
        </Box>

        <Collapse in={appsExpanded}>
          <List dense disablePadding>
            {filteredApps.map((app) => {
              const isSelected = selectedApp?.id === app.id;
              const color = getAvatarColor(app.name);
              return (
                <ListItem disablePadding key={app.id}>
                  <ListItemButton
                    sx={{
                      ...navItemSx(isSelected),
                      borderLeft: isSelected ? `3px solid ${color}` : "3px solid transparent",
                      bgcolor: isSelected ? `${color}12` : "transparent",
                      color: isSelected ? color : "#374151",
                    }}
                    onClick={() => onSelectApp(app)}
                  >
                    <Avatar
                      sx={{
                        width: 20,
                        height: 20,
                        fontSize: 10,
                        fontWeight: 700,
                        bgcolor: color,
                        mr: 1,
                        flexShrink: 0,
                      }}
                    >
                      {app.name[0]?.toUpperCase()}
                    </Avatar>

                    <ListItemText
                      slotProps={{
                        primary: {
                          noWrap: true,
                          title: app.name,
                          sx: { fontSize: 12.5 },
                        },
                      }}
                      primary={app.name}
                    />

                    {app.keywords.length > 0 && (
                      <Chip
                        label={app.keywords.length}
                        size="small"
                        sx={{
                          height: 16,
                          fontSize: 10,
                          px: 0,
                          ml: 0.5,
                          bgcolor: "#f3f4f6",
                          color: "#6b7280",
                        }}
                      />
                    )}

                    <IconButton
                      size="small"
                      onClick={(e) => {
                        e.stopPropagation(); // Don't select the app
                        handleDeleteClick(app); // Open confirmation dialog
                      }}
                      sx={{
                        ml: 0.5,
                        color: "#ef4444",
                        "&:hover": {
                          bgcolor: "#fee2e2",
                        },
                      }}
                    >
                      <DeleteOutlineIcon fontSize="small" />
                    </IconButton>
                  </ListItemButton>
                </ListItem>
              );
            })}
          </List>
        </Collapse>
      </Box>

      {/* Bottom action buttons */}
      <Box sx={{ px: 1.5, py: 1.5, borderTop: "1px solid #f3f4f6", display: "flex", gap: 1 }}>
        <Button
          fullWidth
          variant="contained"
          size="small"
          startIcon={<AddIcon sx={{ fontSize: 15 }} />}
          onClick={() => setTrackDialogOpen(true)}
          disabled={isScraping}
          sx={{
            bgcolor: "#111827", color: "#fff", borderRadius: "8px",
            fontSize: 12, fontWeight: 600, textTransform: "none", py: 0.75,
            "&:hover": { bgcolor: "#1f2937" },
          }}
        >
          Track App
        </Button>
        <Button
          variant="outlined"
          size="small"
          onClick={onRunAllSaved}
          disabled={isScraping}
          sx={{ borderRadius: "8px", borderColor: "#e5e7eb", color: "#374151", px: 1, py: 0.75, minWidth: 0, "&:hover": { borderColor: "#9ca3af" } }}
          title="Re-scrape all saved apps"
        >
          <RefreshIcon sx={{ fontSize: 16 }} />
        </Button>
      </Box>

      {/* Track New App Dialog */}
      <Dialog open={trackDialogOpen} onClose={() => setTrackDialogOpen(false)} maxWidth="sm" fullWidth
        slotProps={{ paper: { sx: { borderRadius: "12px", border: "1px solid #e5e7eb", boxShadow: "0 20px 60px rgba(0,0,0,0.12)" } } }}>
        <DialogTitle sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", pb: 1 }}>
          <Typography sx={{ fontWeight: 600, fontSize: 15 }}>Track New App</Typography>
          <IconButton size="small" onClick={() => setTrackDialogOpen(false)}>
            <CloseIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 1 }}>
          <TextField size="small" label="App Name" fullWidth value={newAppName} onChange={(e) => setNewAppName(e.target.value)}
            slotProps={{ inputLabel: { shrink: true } }}  sx={{marginTop: 2 }}/>
          <TextField size="small" label="App URL" fullWidth value={newAppUrl} onChange={(e) => setNewAppUrl(e.target.value)}
            placeholder="https://apps.shopify.com/..." slotProps={{ inputLabel: { shrink: true } }} />
          <TextField size="small" label="Keywords (one per line)" fullWidth multiline rows={4} value={newKeywordsText}
            onChange={(e) => setNewKeywordsText(e.target.value)} placeholder={"inventory sync\norder management\nback in stock"}
            slotProps={{ inputLabel: { shrink: true } }} />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
          <Button onClick={() => setTrackDialogOpen(false)} size="small" sx={{ color: "#6b7280", textTransform: "none" }}>Cancel</Button>
          <Button variant="contained" size="small" onClick={handleTrackSubmit} disabled={!newAppName || !newAppUrl || !newKeywordsText}
            sx={{ bgcolor: "#111827", borderRadius: "8px", textTransform: "none", fontWeight: 600, "&:hover": { bgcolor: "#1f2937" } }}>
            Start Tracking
          </Button>
        </DialogActions>
      </Dialog>


      <Dialog
          open={deleteDialogOpen}
          onClose={handleCancelDelete}
          maxWidth="xs"
          fullWidth
        >
          <DialogTitle>Delete Application</DialogTitle>

          <DialogContent>
            <Typography>
              Are you sure you want to delete <strong>{appToDelete?.name}</strong>?
            </Typography>

            <Typography sx={{ mt: 2, color: "#6b7280" }}>
              This action cannot be undone.
            </Typography>
          </DialogContent>

          <DialogActions>
            <Button onClick={handleCancelDelete}>
              Cancel
            </Button>

            <Button
              color="error"
              variant="contained"
              onClick={handleConfirmDelete}
            >
              Delete
            </Button>
          </DialogActions>
        </Dialog>
    </Box>
  );
}
