import { useEffect, useState, useMemo } from "react";
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
  Tooltip,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import BarChartIcon from "@mui/icons-material/BarChart";
import CloseIcon from "@mui/icons-material/Close";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutlineOutlined";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import HistoryIcon from "@mui/icons-material/History";
import HomeIcon from "@mui/icons-material/Home";
import RefreshIcon from "@mui/icons-material/Refresh";
import SearchIcon from "@mui/icons-material/Search";
import SettingsIcon from "@mui/icons-material/Settings";
import LogoutIcon from "@mui/icons-material/Logout";
import PeopleIcon from "@mui/icons-material/People";
import ExtensionIcon from "@mui/icons-material/Extension";
import ClearIcon from "@mui/icons-material/Clear";

import AppLogo from "./AppLogo";
import { api, type App, type AppLastSync } from "../api";

interface SidebarProps {
  apps: App[];
  selectedApp: App | null;
  onSelectApp: (app: App | null) => void;
  onRunAllSaved: () => void;
  onTrackApp: (name: string, url: string, keywords: string[]) => void;
  isLoadingApps: boolean;
  onDeleteApp: (appId: number) => void;
  currentPage: "dashboard" | "history" | "settings" | "optimizer" | "competitors" | "integrations";
  onNavigate: (page: "dashboard" | "history" | "settings" | "optimizer" | "competitors" | "integrations") => void;
  onLogout?: () => void;
}

// Color palette for app avatars
const AVATAR_COLORS = [
  "#f97316", "#14b8a6", "#3b82f6", "#8b5cf6", "#ec4899", "#10b981", "#f59e0b", "#ef4444",
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
  const [historyExpanded] = useState(false);
  const [, setLastSyncs] = useState<AppLastSync[]>([]);
  const [, setLoadingHistory] = useState(false);

  const showSyncButton = useMemo(() => {
    if (!apps || apps.length === 0) return false;
    const today = new Date();
    const todayYear = today.getFullYear();
    const todayMonth = today.getMonth();
    const todayDate = today.getDate();

    return apps.some((app) => {
      if (!app.last_synced_at) return true;
      const dateStr = app.last_synced_at.endsWith("Z") ? app.last_synced_at : `${app.last_synced_at}Z`;
      const syncDate = new Date(dateStr);
      return (
        syncDate.getFullYear() !== todayYear ||
        syncDate.getMonth() !== todayMonth ||
        syncDate.getDate() !== todayDate
      );
    });
  }, [apps]);

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

  const filteredApps = useMemo(() => {
    return apps.filter((a) =>
      a.name.toLowerCase().includes(search.toLowerCase())
    );
  }, [apps, search]);

  const handleTrackSubmit = () => {
    const kws = newKeywordsText
      .split(/[\n,]+/)
      .map((k) => k.trim())
      .filter(Boolean);
    if (!newAppName.trim() || !newAppUrl.trim() || kws.length === 0) return;
    onTrackApp(newAppName.trim(), newAppUrl.trim(), kws);
    setTrackDialogOpen(false);
    setNewAppName("");
    setNewAppUrl("");
    setNewKeywordsText("");
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
  };

  const navItemSx = (active?: boolean) => ({
    borderRadius: "8px",
    mb: 0.5,
    px: 1.5,
    py: 0.85,
    gap: 1.25,
    bgcolor: active ? "#f1f5f9" : "transparent",
    borderLeft: active ? "3.5px solid #0f172a" : "3.5px solid transparent",
    color: active ? "#0f172a" : "#475569",
    fontWeight: active ? 700 : 500,
    "&:hover": {
      bgcolor: active ? "#e2e8f0" : "#f8fafc",
      color: "#0f172a",
      transform: "translateX(2px)",
    },
    transition: "all 0.18s ease-in-out",
  });

  return (
    <Box
      sx={{
        width: 240,
        flexShrink: 0,
        height: "100%",
        bgcolor: "#ffffff",
        borderRight: "1px solid #e2e8f0",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        boxShadow: "2px 0 12px rgba(0,0,0,0.02)",
      }}
    >
      {/* Brand Header */}
      <Box
        sx={{
          px: 2.25,
          py: 2,
          display: "flex",
          alignItems: "center",
          gap: 1.5,
          borderBottom: "1px solid #f1f5f9",
          bgcolor: "#ffffff",
        }}
      >
        <AppLogo size={30} />
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography sx={{ fontWeight: 800, fontSize: 15, color: "#0f172a", letterSpacing: "-0.3px", lineHeight: 1.2 }}>
            Rank Tracker
          </Typography>
          <Typography sx={{ fontSize: 11, color: "#64748b", fontWeight: 500 }}>
            Shopify ASO Suite
          </Typography>
        </Box>
      </Box>

      {/* Search Input */}
      <Box sx={{ px: 1.75, pt: 1.75, pb: 1 }}>
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
                  <SearchIcon sx={{ fontSize: 16, color: "#94a3b8" }} />
                </InputAdornment>
              ),
              endAdornment: search ? (
                <InputAdornment position="end">
                  <IconButton size="small" onClick={() => setSearch("")} edge="end">
                    <ClearIcon sx={{ fontSize: 14, color: "#94a3b8" }} />
                  </IconButton>
                </InputAdornment>
              ) : null,
              sx: {
                fontSize: 12.5,
                bgcolor: "#f8fafc",
                borderRadius: "8px",
                "& fieldset": { borderColor: "#e2e8f0" },
                "&:hover fieldset": { borderColor: "#cbd5e1" },
                "&.Mui-focused fieldset": { borderColor: "#6366f1" },
                py: 0.25,
              },
            },
          }}
        />
      </Box>

      {/* Scrollable Middle Navigation & Apps Container */}
      <Box
        sx={{
          flexGrow: 1,
          overflowY: "auto",
          px: 1.25,
          py: 0.5,
          "&::-webkit-scrollbar": {
            width: "5px",
          },
          "&::-webkit-scrollbar-track": {
            bgcolor: "transparent",
          },
          "&::-webkit-scrollbar-thumb": {
            bgcolor: "#cbd5e1",
            borderRadius: "10px",
          },
          "&::-webkit-scrollbar-thumb:hover": {
            bgcolor: "#94a3b8",
          },
        }}
      >
        <List dense disablePadding>
          <ListItem disablePadding>
            <ListItemButton
              sx={navItemSx(currentPage === "dashboard" && !selectedApp)}
              onClick={() => {
                onSelectApp(null);
                onNavigate("dashboard");
              }}
            >
              <ListItemIcon sx={{ minWidth: 24, color: "inherit" }}>
                <HomeIcon sx={{ fontSize: 17 }} />
              </ListItemIcon>
              <ListItemText slotProps={{ primary: { sx: { fontSize: 13, fontWeight: "inherit" } } }} primary="Home" />
            </ListItemButton>
          </ListItem>

          <ListItem disablePadding>
            <ListItemButton
              sx={navItemSx(currentPage === "optimizer")}
              onClick={() => {
                if (!selectedApp && apps.length > 0) {
                  onSelectApp(apps[0]);
                }
                onNavigate("optimizer");
              }}
            >
              <ListItemIcon sx={{ minWidth: 24, color: "inherit" }}>
                <BarChartIcon sx={{ fontSize: 17 }} />
              </ListItemIcon>
              <ListItemText slotProps={{ primary: { sx: { fontSize: 13, fontWeight: "inherit" } } }} primary="Listing Optimizer" />
            </ListItemButton>
          </ListItem>

          <ListItem disablePadding>
            <ListItemButton
              sx={navItemSx(currentPage === "competitors")}
              onClick={() => {
                if (!selectedApp && apps.length > 0) {
                  onSelectApp(apps[0]);
                }
                onNavigate("competitors");
              }}
            >
              <ListItemIcon sx={{ minWidth: 24, color: "inherit" }}>
                <PeopleIcon sx={{ fontSize: 17 }} />
              </ListItemIcon>
              <ListItemText slotProps={{ primary: { sx: { fontSize: 13, fontWeight: "inherit" } } }} primary="Competitors" />
            </ListItemButton>
          </ListItem>

          <ListItem disablePadding>
            <ListItemButton
              sx={navItemSx(currentPage === "history")}
              onClick={() => onNavigate("history")}
            >
              <ListItemIcon sx={{ minWidth: 24, color: "inherit" }}>
                <HistoryIcon sx={{ fontSize: 17 }} />
              </ListItemIcon>
              <ListItemText slotProps={{ primary: { sx: { fontSize: 13, fontWeight: "inherit" } } }} primary="History Log" />
            </ListItemButton>
          </ListItem>

          <ListItem disablePadding>
            <ListItemButton
              sx={navItemSx(currentPage === "integrations")}
              onClick={() => onNavigate("integrations")}
            >
              <ListItemIcon sx={{ minWidth: 24, color: "inherit" }}>
                <ExtensionIcon sx={{ fontSize: 17 }} />
              </ListItemIcon>
              <ListItemText slotProps={{ primary: { sx: { fontSize: 13, fontWeight: "inherit" } } }} primary="Integrations" />
            </ListItemButton>
          </ListItem>

          <ListItem disablePadding>
            <ListItemButton
              sx={navItemSx(currentPage === "settings")}
              onClick={() => onNavigate("settings")}
            >
              <ListItemIcon sx={{ minWidth: 24, color: "inherit" }}>
                <SettingsIcon sx={{ fontSize: 17 }} />
              </ListItemIcon>
              <ListItemText slotProps={{ primary: { sx: { fontSize: 13, fontWeight: "inherit" } } }} primary="Profile Settings" />
            </ListItemButton>
          </ListItem>
        </List>

        <Divider sx={{ mx: 0.5, my: 1, borderColor: "#f1f5f9" }} />

        {/* Tracked Apps Section Header */}
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            px: 1.25,
            py: 0.75,
            cursor: "pointer",
            userSelect: "none",
            borderRadius: "6px",
            "&:hover": { bgcolor: "#f8fafc" },
          }}
          onClick={() => setAppsExpanded((v) => !v)}
        >
          <Typography sx={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.08em", flexGrow: 1 }}>
            APPS ({apps.length})
          </Typography>
          {isLoadingApps ? (
            <CircularProgress size={12} sx={{ color: "#94a3b8" }} />
          ) : appsExpanded ? (
            <ExpandLessIcon sx={{ fontSize: 16, color: "#94a3b8" }} />
          ) : (
            <ExpandMoreIcon sx={{ fontSize: 16, color: "#94a3b8" }} />
          )}
        </Box>

        <Collapse in={appsExpanded}>
          <List dense disablePadding sx={{ mt: 0.25 }}>
            {filteredApps.length === 0 ? (
              <Typography sx={{ px: 1.25, py: 1, fontSize: 12, color: "#94a3b8", fontStyle: "italic" }}>
                No apps found
              </Typography>
            ) : (
              filteredApps.map((app) => {
                const isSelected = currentPage === "dashboard" && selectedApp?.id === app.id;
                const color = getAvatarColor(app.name);
                return (
                  <ListItem disablePadding key={app.id}>
                    <ListItemButton
                      sx={{
                        ...navItemSx(isSelected),
                        borderLeft: isSelected ? `3.5px solid ${color}` : "3.5px solid transparent",
                        bgcolor: isSelected ? `${color}12` : "transparent",
                        color: isSelected ? color : "#334155",
                        py: 0.65,
                      }}
                      onClick={() => {
                        onSelectApp(app);
                        onNavigate("dashboard");
                      }}
                    >
                      <Avatar
                        sx={{
                          width: 22,
                          height: 22,
                          fontSize: 10.5,
                          fontWeight: 700,
                          bgcolor: color,
                          mr: 0.5,
                          flexShrink: 0,
                          boxShadow: "0 2px 4px rgba(0,0,0,0.08)",
                        }}
                      >
                        {app.name[0]?.toUpperCase()}
                      </Avatar>

                      <ListItemText
                        slotProps={{
                          primary: {
                            noWrap: true,
                            title: app.name,
                            sx: { fontSize: 12.5, fontWeight: isSelected ? 700 : 500 },
                          },
                        }}
                        primary={app.name}
                      />

                      {app.keywords.length > 0 && (
                        <Chip
                          label={app.keywords.length}
                          size="small"
                          sx={{
                            height: 18,
                            fontSize: 10,
                            fontWeight: 700,
                            px: 0.25,
                            ml: 0.5,
                            bgcolor: isSelected ? `${color}20` : "#f1f5f9",
                            color: isSelected ? color : "#64748b",
                            borderRadius: "4px",
                          }}
                        />
                      )}

                      <IconButton
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteClick(app);
                        }}
                        sx={{
                          ml: 0.25,
                          p: 0.35,
                          color: "#94a3b8",
                          "&:hover": {
                            color: "#ef4444",
                            bgcolor: "#fef2f2",
                          },
                        }}
                        title="Delete App"
                      >
                        <DeleteOutlineIcon sx={{ fontSize: 15 }} />
                      </IconButton>
                    </ListItemButton>
                  </ListItem>
                );
              })
            )}
          </List>
        </Collapse>
      </Box>

      {/* Bottom Action Footer */}
      <Box
        sx={{
          px: 1.75,
          py: 1.5,
          borderTop: "1px solid #f1f5f9",
          display: "flex",
          alignItems: "center",
          gap: 1,
          bgcolor: "#ffffff",
        }}
      >
        <Button
          fullWidth
          variant="contained"
          startIcon={<AddIcon sx={{ fontSize: 17 }} />}
          onClick={() => setTrackDialogOpen(true)}
          sx={{
            height: 38,
            bgcolor: "#0f172a",
            color: "#ffffff",
            borderRadius: "9px",
            fontSize: 13,
            fontWeight: 700,
            textTransform: "none",
            boxShadow: "0 4px 12px rgba(15, 23, 42, 0.15)",
            transition: "all 0.2s ease-in-out",
            "&:hover": {
              bgcolor: "#1e293b",
              boxShadow: "0 6px 18px rgba(15, 23, 42, 0.25)",
              transform: "translateY(-1px)",
            },
          }}
        >
          Track App
        </Button>

        {showSyncButton && (
          <Tooltip title="Re-sync all saved apps" placement="top">
            <IconButton
              onClick={onRunAllSaved}
              sx={{
                width: 38,
                height: 38,
                borderRadius: "9px",
                border: "1px solid #e2e8f0",
                color: "#475569",
                bgcolor: "#ffffff",
                flexShrink: 0,
                boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
                transition: "all 0.2s ease-in-out",
                "&:hover": {
                  borderColor: "#6366f1",
                  color: "#6366f1",
                  bgcolor: "#f8fafc",
                  transform: "translateY(-1px)",
                  "& svg": { transform: "rotate(180deg)" },
                },
                "& svg": { transition: "transform 0.4s ease" },
              }}
            >
              <RefreshIcon sx={{ fontSize: 18 }} />
            </IconButton>
          </Tooltip>
        )}
      </Box>

      {/* User Profile & Logout Footer */}
      {onLogout && (
        <Box
          sx={{
            px: 1.75,
            py: 1.25,
            borderTop: "1px solid #f1f5f9",
            display: "flex",
            alignItems: "center",
            gap: 1.25,
            bgcolor: "#f8fafc",
          }}
        >
          <Avatar
            sx={{
              width: 28,
              height: 28,
              fontSize: 12,
              fontWeight: 700,
              bgcolor: "#6366f1",
              color: "#ffffff",
              boxShadow: "0 2px 5px rgba(99, 102, 241, 0.25)",
            }}
          >
            Y
          </Avatar>
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography sx={{ fontSize: 12, fontWeight: 700, color: "#0f172a", lineHeight: 1.2 }} noWrap>
              User Account
            </Typography>
            <Typography sx={{ fontSize: 11, color: "#64748b" }} noWrap>
              Connected Profile
            </Typography>
          </Box>
          <Tooltip title="Log Out" placement="top">
            <IconButton
              size="small"
              onClick={onLogout}
              sx={{
                p: 0.5,
                color: "#64748b",
                borderRadius: "6px",
                "&:hover": { color: "#ef4444", bgcolor: "#fef2f2" },
                transition: "all 0.15s",
              }}
            >
              <LogoutIcon sx={{ fontSize: 17 }} />
            </IconButton>
          </Tooltip>
        </Box>
      )}

      {/* Track New App Dialog */}
      <Dialog
        open={trackDialogOpen}
        onClose={() => setTrackDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        slotProps={{
          paper: {
            sx: {
              borderRadius: "14px",
              border: "1px solid #e2e8f0",
              boxShadow: "0 20px 60px rgba(0,0,0,0.12)",
              p: 0.5,
            },
          },
        }}
      >
        <DialogTitle sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", pb: 1 }}>
          <Typography sx={{ fontWeight: 700, fontSize: 16, color: "#0f172a" }}>Track New App</Typography>
          <IconButton size="small" onClick={() => setTrackDialogOpen(false)}>
            <CloseIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 1 }}>
          <TextField
            size="small"
            label="App Name"
            fullWidth
            value={newAppName}
            onChange={(e) => setNewAppName(e.target.value)}
            slotProps={{ inputLabel: { shrink: true } }}
            sx={{ mt: 1 }}
          />
          <TextField
            size="small"
            label="Shopify App Store URL"
            fullWidth
            value={newAppUrl}
            onChange={(e) => setNewAppUrl(e.target.value)}
            placeholder="https://apps.shopify.com/..."
            slotProps={{ inputLabel: { shrink: true } }}
          />
          <TextField
            size="small"
            label="Keywords (one per line)"
            fullWidth
            multiline
            rows={4}
            value={newKeywordsText}
            onChange={(e) => setNewKeywordsText(e.target.value)}
            placeholder={"inventory sync\norder management\nback in stock"}
            slotProps={{ inputLabel: { shrink: true } }}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
          <Button onClick={() => setTrackDialogOpen(false)} size="small" sx={{ color: "#64748b", textTransform: "none", fontWeight: 600 }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            size="small"
            onClick={handleTrackSubmit}
            disabled={!newAppName.trim() || !newAppUrl.trim() || !newKeywordsText.trim()}
            sx={{
              bgcolor: "#0f172a",
              borderRadius: "8px",
              textTransform: "none",
              fontWeight: 700,
              px: 2.5,
              py: 0.75,
              "&:hover": { bgcolor: "#1e293b" },
            }}
          >
            Start Tracking
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={handleCancelDelete}
        maxWidth="xs"
        fullWidth
        slotProps={{
          paper: {
            sx: {
              borderRadius: "14px",
              border: "1px solid #e2e8f0",
              p: 0.5,
            },
          },
        }}
      >
        <DialogTitle sx={{ fontWeight: 700, fontSize: 16, color: "#0f172a" }}>
          Delete Application
        </DialogTitle>

        <DialogContent>
          <Typography sx={{ fontSize: 13.5, color: "#334155" }}>
            Are you sure you want to delete <strong>{appToDelete?.name}</strong>?
          </Typography>
          <Typography sx={{ mt: 1, fontSize: 12.5, color: "#64748b" }}>
            This will stop tracking keywords for this application. This action cannot be undone.
          </Typography>
        </DialogContent>

        <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
          <Button onClick={handleCancelDelete} sx={{ color: "#64748b", textTransform: "none", fontWeight: 600 }}>
            Cancel
          </Button>
          <Button
            color="error"
            variant="contained"
            onClick={handleConfirmDelete}
            sx={{ borderRadius: "8px", textTransform: "none", fontWeight: 700, px: 2 }}
          >
            Delete App
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
