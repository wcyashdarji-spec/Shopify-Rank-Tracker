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
import { motion } from "motion/react";

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
  onCloseSidebar?: () => void;
}

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
  onCloseSidebar,
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
  const [userEmail, setUserEmail] = useState<string>("");

  useEffect(() => {
    let isMounted = true;
    api
      .getMe()
      .then((user) => {
        if (isMounted && user && user.email) {
          setUserEmail(user.email);
        }
      })
      .catch(() => {});
    return () => {
      isMounted = false;
    };
  }, []);

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

  const navItems = [
    { page: "dashboard", label: "Home", icon: <HomeIcon sx={{ fontSize: 18 }} />, activeIf: currentPage === "dashboard" && !selectedApp },
    { page: "optimizer", label: "Listing Optimizer", icon: <BarChartIcon sx={{ fontSize: 18 }} />, activeIf: currentPage === "optimizer" },
    { page: "competitors", label: "Competitors", icon: <PeopleIcon sx={{ fontSize: 18 }} />, activeIf: currentPage === "competitors" },
    { page: "history", label: "History Log", icon: <HistoryIcon sx={{ fontSize: 18 }} />, activeIf: currentPage === "history" },
    { page: "integrations", label: "Integrations", icon: <ExtensionIcon sx={{ fontSize: 18 }} />, activeIf: currentPage === "integrations" },
    { page: "settings", label: "Profile Settings", icon: <SettingsIcon sx={{ fontSize: 18 }} />, activeIf: currentPage === "settings" },
  ] as const;

  return (
    <Box
      sx={{
        width: 250,
        flexShrink: 0,
        height: "100%",
        bgcolor: "#ffffff",
        borderRight: "1px solid #e2e8f0",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        boxShadow: "4px 0 20px rgba(15, 23, 42, 0.03)",
        zIndex: 10,
      }}
    >
      {/* Brand Header */}
      <Box
        sx={{
          px: 2,
          py: 1.75,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 1.5,
          borderBottom: "1px solid #f1f5f9",
          bgcolor: "#ffffff",
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, minWidth: 0, flex: 1 }}>
          <AppLogo size={32} />
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography sx={{ fontWeight: 800, fontSize: 15, color: "#0f172a", letterSpacing: "-0.3px", lineHeight: 1.2 }}>
              Rank Tracker
            </Typography>
            <Typography sx={{ fontSize: 11, color: "#64748b", fontWeight: 600 }}>
              Shopify ASO Suite
            </Typography>
          </Box>
        </Box>

        {onCloseSidebar && (
          <Tooltip title="Close sidebar">
            <IconButton
              size="small"
              onClick={onCloseSidebar}
              sx={{
                border: "1px solid #e2e8f0",
                borderRadius: "9px",
                width: 32,
                height: 32,
                color: "#475569",
                bgcolor: "#f8fafc",
                flexShrink: 0,
                boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
                "&:hover": {
                  bgcolor: "#f1f5f9",
                  borderColor: "#cbd5e1",
                  color: "#0f172a",
                },
              }}
            >
              <CloseIcon sx={{ fontSize: 18 }} />
            </IconButton>
          </Tooltip>
        )}
      </Box>

      {/* Search Input */}
      <Box sx={{ px: 2, pt: 2, pb: 1 }}>
        <TextField
          placeholder="Search apps or features…"
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
                borderRadius: "10px",
                "& fieldset": { borderColor: "#e2e8f0" },
                "&:hover fieldset": { borderColor: "#cbd5e1" },
                "&.Mui-focused fieldset": { borderColor: "#3b82f6" },
                py: 0.25,
              },
            },
          }}
        />
      </Box>

      {/* Scrollable Navigation */}
      <Box
        sx={{
          flexGrow: 1,
          overflowY: "auto",
          px: 1.5,
          py: 0.5,
        }}
      >
        <List dense disablePadding>
          {navItems.map((item) => {
            const isActive = item.activeIf;
            return (
              <ListItem disablePadding key={item.page} sx={{ mb: 0.5 }}>
                <ListItemButton
                  component={motion.div}
                  whileHover={{ x: 3 }}
                  whileTap={{ scale: 0.98 }}
                  transition={{ type: "spring", stiffness: 400, damping: 25 }}
                  onClick={() => {
                    if ((item.page === "optimizer" || item.page === "competitors") && !selectedApp && apps.length > 0) {
                      onSelectApp(apps[0]);
                    }
                    if (item.page === "dashboard") {
                      onSelectApp(null);
                    }
                    onNavigate(item.page as any);
                    if (onCloseSidebar) onCloseSidebar();
                  }}
                  sx={{
                    borderRadius: "10px",
                    px: 1.75,
                    py: 1,
                    gap: 1.5,
                    bgcolor: isActive ? "#0f172a" : "transparent",
                    color: isActive ? "#ffffff" : "#475569",
                    boxShadow: isActive ? "0 4px 12px rgba(15, 23, 42, 0.15)" : "none",
                    position: "relative",
                    overflow: "hidden",
                    "&:hover": {
                      bgcolor: isActive ? "#1e293b" : "#f1f5f9",
                      color: isActive ? "#ffffff" : "#0f172a",
                    },
                    transition: "all 0.2s ease",
                  }}
                >
                  <ListItemIcon sx={{ minWidth: 22, color: "inherit" }}>
                    {item.icon}
                  </ListItemIcon>
                  <ListItemText
                    slotProps={{
                      primary: {
                        sx: { fontSize: 13, fontWeight: isActive ? 700 : 500 },
                      },
                    }}
                    primary={item.label}
                  />
                </ListItemButton>
              </ListItem>
            );
          })}
        </List>

        <Divider sx={{ mx: 0.5, my: 1.5, borderColor: "#f1f5f9" }} />

        {/* Tracked Apps Section Header */}
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            px: 1.25,
            py: 0.75,
            cursor: "pointer",
            userSelect: "none",
            borderRadius: "8px",
            "&:hover": { bgcolor: "#f8fafc" },
          }}
          onClick={() => setAppsExpanded((v) => !v)}
        >
          <Typography
            sx={{
              fontSize: 11,
              fontWeight: 800,
              color: "#94a3b8",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              flexGrow: 1,
            }}
          >
            TRACKED APPS ({apps.length})
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
          <List dense disablePadding sx={{ mt: 0.5 }}>
            {filteredApps.length === 0 ? (
              <Typography sx={{ px: 1.25, py: 1, fontSize: 12, color: "#94a3b8", fontStyle: "italic" }}>
                No apps tracked yet
              </Typography>
            ) : (
              filteredApps.map((app) => {
                const isSelected = currentPage === "dashboard" && selectedApp?.id === app.id;
                const color = getAvatarColor(app.name);
                return (
                  <ListItem disablePadding key={app.id} sx={{ mb: 0.5 }}>
                    <ListItemButton
                      component={motion.div}
                      whileHover={{ x: 3 }}
                      whileTap={{ scale: 0.98 }}
                      sx={{
                        borderRadius: "10px",
                        px: 1.5,
                        py: 0.75,
                        bgcolor: isSelected ? `${color}15` : "transparent",
                        borderLeft: isSelected ? `4px solid ${color}` : "4px solid transparent",
                        color: isSelected ? color : "#334155",
                        "&:hover": {
                          bgcolor: isSelected ? `${color}20` : "#f8fafc",
                          color: color,
                        },
                      }}
                      onClick={() => {
                        onSelectApp(app);
                        onNavigate("dashboard");
                        if (onCloseSidebar) onCloseSidebar();
                      }}
                    >
                      <Avatar
                        src={app.icon_url || undefined}
                        sx={{
                          width: 24,
                          height: 24,
                          fontSize: 11,
                          fontWeight: 800,
                          bgcolor: color,
                          mr: 1,
                          flexShrink: 0,
                          boxShadow: `0 2px 6px ${color}35`,
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
                            bgcolor: isSelected ? `${color}25` : "#f1f5f9",
                            color: isSelected ? color : "#64748b",
                            borderRadius: "5px",
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
          px: 2,
          py: 1.75,
          borderTop: "1px solid #f1f5f9",
          display: "flex",
          alignItems: "center",
          gap: 1,
          bgcolor: "#ffffff",
        }}
      >
        <Button
          fullWidth
          component={motion.button}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.97 }}
          transition={{ type: "spring", stiffness: 400, damping: 20 }}
          variant="contained"
          startIcon={<AddIcon sx={{ fontSize: 17 }} />}
          onClick={() => {
            setTrackDialogOpen(true);
            if (onCloseSidebar) onCloseSidebar();
          }}
          sx={{
            height: 40,
            background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
            color: "#ffffff",
            borderRadius: "10px",
            fontSize: 13,
            fontWeight: 700,
            textTransform: "none",
            boxShadow: "0 4px 14px rgba(15, 23, 42, 0.2)",
            "&:hover": {
              background: "linear-gradient(135deg, #1e293b 0%, #334155 100%)",
              boxShadow: "0 6px 18px rgba(15, 23, 42, 0.3)",
            },
          }}
        >
          Track New App
        </Button>

        {showSyncButton && (
          <Tooltip title="Re-sync all saved apps" placement="top">
            <IconButton
              onClick={onRunAllSaved}
              sx={{
                width: 40,
                height: 40,
                borderRadius: "10px",
                border: "1px solid #e2e8f0",
                color: "#475569",
                bgcolor: "#ffffff",
                flexShrink: 0,
                boxShadow: "0 2px 6px rgba(0,0,0,0.04)",
                transition: "all 0.2s ease",
                "&:hover": {
                  borderColor: "#3b82f6",
                  color: "#3b82f6",
                  bgcolor: "#f0f6ff",
                  transform: "translateY(-1px)",
                },
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
            px: 2,
            py: 1.5,
            borderTop: "1px solid #f1f5f9",
            display: "flex",
            alignItems: "center",
            gap: 1.25,
            bgcolor: "#f8fafc",
          }}
        >
          <Avatar
            sx={{
              width: 32,
              height: 32,
              fontSize: 13,
              fontWeight: 800,
              bgcolor: "#3b82f6",
              color: "#ffffff",
              boxShadow: "0 2px 8px rgba(59, 130, 246, 0.3)",
            }}
          >
            {userEmail ? userEmail[0]?.toUpperCase() : "U"}
          </Avatar>
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography
              sx={{ fontSize: 12, fontWeight: 700, color: "#0f172a", lineHeight: 1.2 }}
              noWrap
              title={userEmail || "Current User"}
            >
              {userEmail || "Current User"}
            </Typography>
            <Typography sx={{ fontSize: 11, color: "#64748b", fontWeight: 500 }} noWrap>
              Active Account
            </Typography>
          </Box>
          <Tooltip title="Log Out" placement="top">
            <IconButton
              size="small"
              onClick={onLogout}
              sx={{
                p: 0.75,
                color: "#64748b",
                borderRadius: "8px",
                "&:hover": { color: "#ef4444", bgcolor: "#fef2f2" },
                transition: "all 0.15s",
              }}
            >
              <LogoutIcon sx={{ fontSize: 18 }} />
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
              borderRadius: "18px",
              border: "1px solid #e2e8f0",
              boxShadow: "0 25px 60px rgba(15, 23, 42, 0.18)",
              p: 0.5,
            },
          },
        }}
      >
        <DialogTitle sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", pb: 1 }}>
          <Typography sx={{ fontWeight: 800, fontSize: 17, color: "#0f172a" }}>Track New App</Typography>
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
        <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
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
              borderRadius: "10px",
              textTransform: "none",
              fontWeight: 700,
              px: 3,
              py: 0.85,
              boxShadow: "0 4px 14px rgba(15, 23, 42, 0.15)",
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
              borderRadius: "18px",
              border: "1px solid #e2e8f0",
              p: 0.5,
            },
          },
        }}
      >
        <DialogTitle sx={{ fontWeight: 800, fontSize: 17, color: "#0f172a" }}>
          Delete Application
        </DialogTitle>

        <DialogContent>
          <Typography sx={{ fontSize: 14, color: "#334155" }}>
            Are you sure you want to delete <strong>{appToDelete?.name}</strong>?
          </Typography>
          <Typography sx={{ mt: 1, fontSize: 12.5, color: "#64748b" }}>
            This will stop tracking keywords for this application. This action cannot be undone.
          </Typography>
        </DialogContent>

        <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
          <Button onClick={handleCancelDelete} sx={{ color: "#64748b", textTransform: "none", fontWeight: 600 }}>
            Cancel
          </Button>
          <Button
            color="error"
            variant="contained"
            onClick={handleConfirmDelete}
            sx={{ borderRadius: "10px", textTransform: "none", fontWeight: 700, px: 2.5 }}
          >
            Delete App
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
