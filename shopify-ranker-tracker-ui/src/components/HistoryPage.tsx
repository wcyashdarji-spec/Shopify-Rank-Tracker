// React
import { useEffect, useMemo, useState, type ReactElement } from "react";

// Material UI
import {
  Avatar,
  Box,
  Button,
  Chip,
  CircularProgress,
  IconButton,
  InputAdornment,
  Paper,
  Skeleton,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import RefreshIcon from "@mui/icons-material/Refresh";
import SyncedIcon from "@mui/icons-material/CheckCircle";
import StaleIcon from "@mui/icons-material/Schedule";
import NeverIcon from "@mui/icons-material/HelpOutlineOutlined";
import LaunchIcon from "@mui/icons-material/Launch";
import StorefrontIcon from "@mui/icons-material/Storefront";
import ClearIcon from "@mui/icons-material/Clear";
import { DataGrid, type GridColDef } from "@mui/x-data-grid";

// API
import { api, type AppLastSync } from "../api";

// ─── Helpers ──────────────────────────────────────────────────────────────
function formatRelativeTime(dateStr: string | null): string {
  if (!dateStr) return "Never synced";
  const date = new Date(dateStr);
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "Just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} day${days === 1 ? "" : "s"} ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} month${months === 1 ? "" : "s"} ago`;
  const years = Math.floor(months / 12);
  return `${years} year${years === 1 ? "" : "s"} ago`;
}

type SyncStatus = "synced" | "stale" | "never" | "syncing";

function getSyncStatus(row: AppLastSync): SyncStatus {
  if (row.sync_status === "syncing") return "syncing";
  const dateStr = row.last_synced_at;
  if (!dateStr) return "never";
  const hoursSince = (Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60);
  return hoursSince <= 48 ? "synced" : "stale";
}

const AVATAR_COLORS = [
  "#f97316", "#14b8a6", "#3b82f6", "#8b5cf6", "#ec4899", "#10b981", "#f59e0b", "#ef4444",
];

function getAvatarColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

const STATUS_CONFIG: Record<
  SyncStatus,
  {
    label: string;
    color: string;
    bg: string;
    icon: ReactElement;
  }
> = {
  synced: {
    label: "Up to date",
    color: "#059669",
    bg: "#ecfdf5",
    icon: <SyncedIcon sx={{ fontSize: 14 }} />,
  },
  stale: {
    label: "Needs Sync",
    color: "#d97706",
    bg: "#fffbeb",
    icon: <StaleIcon sx={{ fontSize: 14 }} />,
  },
  never: {
    label: "Never synced",
    color: "#64748b",
    bg: "#f1f5f9",
    icon: <NeverIcon sx={{ fontSize: 14 }} />,
  },
  syncing: {
    label: "Syncing...",
    color: "#4f46e5",
    bg: "#e0e7ff",
    icon: <CircularProgress size={12} sx={{ color: "#4f46e5" }} />,
  },
};

export default function HistoryPage() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [syncingAppId, setSyncingAppId] = useState<number | null>(null);
  const [rows, setRows] = useState<AppLastSync[]>([]);
  const [search, setSearch] = useState("");

  const load = async (isRefresh = false) => {
    isRefresh ? setRefreshing(true) : setLoading(true);
    try {
      const data = await api.getAppsLastSync();
      setRows(data.apps || []);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const isAnySyncing = useMemo(() => rows.some((r) => r.sync_status === "syncing"), [rows]);

  useEffect(() => {
    if (!isAnySyncing) return;

    const interval = setInterval(async () => {
      try {
        const data = await api.getAppsLastSync();
        setRows(data.apps || []);
      } catch (err) {
        console.error("Failed to poll sync status", err);
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [isAnySyncing]);

  const filteredRows = useMemo(() => {
    if (!search.trim()) return rows;
    const q = search.toLowerCase();
    return rows.filter((r) => r.name.toLowerCase().includes(q) || r.url.toLowerCase().includes(q));
  }, [rows, search]);

  const summary = useMemo(() => {
    const synced = rows.filter((r) => getSyncStatus(r) === "synced").length;
    const stale = rows.filter((r) => getSyncStatus(r) === "stale").length;
    const never = rows.filter((r) => getSyncStatus(r) === "never").length;
    const syncing = rows.filter((r) => getSyncStatus(r) === "syncing").length;
    return { total: rows.length, synced, stale, never, syncing, needsRefresh: stale + never };
  }, [rows]);

  const handleSyncSingleApp = async (appRow: AppLastSync) => {
    setSyncingAppId(appRow.id);
    try {
      await api.runTracker(appRow.name, appRow.url, (appRow as any).keywords || []);
      await load(true);
    } catch (err) {
      console.error("Single app sync error", err);
    } finally {
      setSyncingAppId(null);
    }
  };

  const handleRunAllSync = async () => {
    setRefreshing(true);
    try {
      await api.runSavedApps();
      await load(true);
    } catch (err) {
      console.error("Run all sync error", err);
    } finally {
      setRefreshing(false);
    }
  };

  const columns: GridColDef<AppLastSync>[] = [
    {
      field: "name",
      headerName: "Application",
      flex: 1.2,
      minWidth: 200,
      renderCell: (params) => {
        const color = getAvatarColor(params.value);
        return (
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, height: "100%" }}>
            <Avatar
              sx={{
                width: 32,
                height: 32,
                fontSize: 13,
                fontWeight: 700,
                bgcolor: color,
                color: "#ffffff",
                boxShadow: `0 2px 6px ${color}33`,
              }}
            >
              {params.value[0]?.toUpperCase()}
            </Avatar>
            <Box sx={{ minWidth: 0 }}>
              <Typography sx={{ fontSize: 13.5, fontWeight: 700, color: "#0f172a", lineHeight: 1.3 }} noWrap title={params.value}>
                {params.value}
              </Typography>
              <Typography sx={{ fontSize: 11, color: "#64748b" }} noWrap>
                {(params.row as any).keywords ? `${(params.row as any).keywords.length} keywords` : "Shopify App"}
              </Typography>
            </Box>
          </Box>
        );
      },
    },
    {
      field: "url",
      headerName: "App Store URL",
      flex: 1.5,
      minWidth: 220,
      renderCell: (params) => (
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, height: "100%" }}>
          <Typography
            component="a"
            href={params.value}
            target="_blank"
            rel="noopener noreferrer"
            sx={{
              fontSize: 12.5,
              color: "#6366f1",
              fontWeight: 600,
              textDecoration: "none",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              "&:hover": { textDecoration: "underline" },
            }}
          >
            {params.value}
          </Typography>
          <LaunchIcon sx={{ fontSize: 13, color: "#94a3b8", flexShrink: 0 }} />
        </Box>
      ),
    },
    {
      field: "last_synced_at",
      headerName: "Last Synced",
      flex: 1,
      minWidth: 160,
      renderCell: (params) => (
        <Box sx={{ display: "flex", flexDirection: "column", justifyContent: "center", height: "100%" }}>
          <Tooltip title={params.value ? `Exact UTC: ${params.value}` : "This app hasn't been synced yet"}>
            <Typography sx={{ fontSize: 13, fontWeight: 600, color: "#1e293b", lineHeight: 1.3 }}>
              {formatRelativeTime(params.value)}
            </Typography>
          </Tooltip>
          {params.value && (
            <Typography sx={{ fontSize: 11, color: "#94a3b8", lineHeight: 1.3 }}>
              UTC Timestamp
            </Typography>
          )}
        </Box>
      ),
    },
    {
      field: "status",
      headerName: "Sync Status",
      flex: 0.9,
      minWidth: 150,
      sortable: false,
      renderCell: (params) => {
        const status = getSyncStatus(params.row);
        const cfg = STATUS_CONFIG[status];
        return (
          <Box sx={{ display: "flex", alignItems: "center", height: "100%" }}>
            <Chip
              icon={cfg.icon}
              label={cfg.label}
              size="small"
              sx={{
                fontSize: 11.5,
                fontWeight: 700,
                color: cfg.color,
                bgcolor: cfg.bg,
                border: "none",
                height: 24,
                px: 0.5,
                "& .MuiChip-icon": { color: cfg.color, ml: "4px" },
              }}
            />
          </Box>
        );
      },
    },
    {
      field: "actions",
      headerName: "Actions",
      flex: 0.7,
      minWidth: 110,
      sortable: false,
      align: "right",
      headerAlign: "right",
      renderCell: (params) => {
        const isCurrentSyncing = syncingAppId === params.row.id || params.row.sync_status === "syncing";
        return (
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "flex-end", height: "100%", width: "100%" }}>
            <Button
              size="small"
              variant="outlined"
              onClick={() => handleSyncSingleApp(params.row)}
              disabled={isCurrentSyncing}
              startIcon={
                isCurrentSyncing ? (
                  <CircularProgress size={12} sx={{ color: "#6366f1" }} />
                ) : (
                  <RefreshIcon sx={{ fontSize: 13 }} />
                )
              }
              sx={{
                fontSize: 11.5,
                fontWeight: 700,
                textTransform: "none",
                borderRadius: "6px",
                borderColor: "#e2e8f0",
                color: "#475569",
                py: 0.3,
                px: 1.2,
                "&:hover": { borderColor: "#6366f1", color: "#6366f1", bgcolor: "#f8fafc" },
              }}
            >
              {isCurrentSyncing ? "Syncing" : "Sync"}
            </Button>
          </Box>
        );
      },
    },
  ];

  return (
    <Box sx={{ p: { xs: 2, sm: 3, md: 4 }, maxWidth: 1200, mx: "auto" }}>
      {/* Metric Summary Cards Bar */}
      {!loading && rows.length > 0 && (
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(3, 1fr)" }, gap: 2.5, mb: 3.5 }}>
          {/* Card 1: Total Monitored Apps */}
          <Paper
            elevation={0}
            sx={{
              p: 2.5,
              borderRadius: "14px",
              border: "1px solid #e2e8f0",
              bgcolor: "#ffffff",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              boxShadow: "0 4px 12px rgba(0,0,0,0.02)",
            }}
          >
            <Box>
              <Typography sx={{ fontSize: 12, fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", mb: 0.5 }}>
                Tracked Apps
              </Typography>
              <Typography sx={{ fontSize: 26, fontWeight: 800, color: "#0f172a" }}>
                {summary.total}
              </Typography>
            </Box>
            <Box sx={{ width: 44, height: 44, borderRadius: "12px", bgcolor: "#f1f5f9", color: "#475569", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <StorefrontIcon sx={{ fontSize: 24 }} />
            </Box>
          </Paper>

          {/* Card 2: Up to Date Apps */}
          <Paper
            elevation={0}
            sx={{
              p: 2.5,
              borderRadius: "14px",
              border: "1px solid #a7f3d0",
              bgcolor: "#ecfdf5",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              boxShadow: "0 4px 12px rgba(16, 185, 129, 0.05)",
            }}
          >
            <Box>
              <Typography sx={{ fontSize: 12, fontWeight: 600, color: "#047857", textTransform: "uppercase", letterSpacing: "0.05em", mb: 0.5 }}>
                Up to Date
              </Typography>
              <Typography sx={{ fontSize: 26, fontWeight: 800, color: "#065f46" }}>
                {summary.synced}
              </Typography>
            </Box>
            <Box sx={{ width: 44, height: 44, borderRadius: "12px", bgcolor: "#d1fae5", color: "#059669", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <SyncedIcon sx={{ fontSize: 24 }} />
            </Box>
          </Paper>

          {/* Card 3: Needs Refresh / Sync Action */}
          <Paper
            elevation={0}
            sx={{
              p: 2.5,
              borderRadius: "14px",
              border: summary.needsRefresh > 0 ? "1px solid #fde68a" : "1px solid #e2e8f0",
              bgcolor: summary.needsRefresh > 0 ? "#fffbeb" : "#ffffff",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              boxShadow: "0 4px 12px rgba(245, 158, 11, 0.05)",
            }}
          >
            <Box>
              <Typography sx={{ fontSize: 12, fontWeight: 600, color: summary.needsRefresh > 0 ? "#b45309" : "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", mb: 0.5 }}>
                Needs Refresh
              </Typography>
              <Typography sx={{ fontSize: 26, fontWeight: 800, color: summary.needsRefresh > 0 ? "#92400e" : "#0f172a" }}>
                {summary.needsRefresh}
              </Typography>
            </Box>
            <Button
              variant="contained"
              size="small"
              startIcon={<RefreshIcon sx={{ fontSize: 16, animation: refreshing ? "spin 1s linear infinite" : "none" }} />}
              onClick={handleRunAllSync}
              disabled={refreshing}
              sx={{
                bgcolor: summary.needsRefresh > 0 ? "#d97706" : "#0f172a",
                color: "#ffffff",
                borderRadius: "8px",
                fontSize: 12,
                fontWeight: 700,
                textTransform: "none",
                px: 1.75,
                py: 0.75,
                boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
                "&:hover": { bgcolor: summary.needsRefresh > 0 ? "#b45309" : "#1e293b" },
              }}
            >
              Re-sync All
            </Button>
          </Paper>
        </Box>
      )}

      {/* Control Bar: Search & Refresh */}
      {!loading && rows.length > 0 && (
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 2.5 }}>
          <TextField
            placeholder="Search apps by name or Shopify URL..."
            size="small"
            fullWidth
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon sx={{ fontSize: 17, color: "#94a3b8" }} />
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
                  bgcolor: "#ffffff",
                  borderRadius: "10px",
                  fontSize: 13,
                  "& fieldset": { borderColor: "#e2e8f0" },
                  "&:hover fieldset": { borderColor: "#cbd5e1" },
                  "&.Mui-focused fieldset": { borderColor: "#6366f1" },
                },
              },
            }}
          />

          <Tooltip title="Reload Sync Status">
            <IconButton
              onClick={() => load(true)}
              disabled={loading || refreshing}
              sx={{
                border: "1px solid #e2e8f0",
                borderRadius: "10px",
                width: 40,
                height: 40,
                bgcolor: "#ffffff",
                color: "#475569",
                flexShrink: 0,
                "&:hover": { bgcolor: "#f8fafc", borderColor: "#6366f1", color: "#6366f1" },
              }}
            >
              <RefreshIcon sx={{ fontSize: 18, animation: refreshing ? "spin 1s linear infinite" : "none" }} />
            </IconButton>
          </Tooltip>
        </Box>
      )}

      {/* History Data Table Container */}
      <Paper
        elevation={0}
        sx={{
          borderRadius: "16px",
          border: "1px solid #e2e8f0",
          overflow: "hidden",
          bgcolor: "#ffffff",
          boxShadow: "0 4px 20px rgba(0,0,0,0.03)",
        }}
      >
        {loading ? (
          <Box sx={{ p: 3 }}>
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} variant="rounded" height={48} sx={{ mb: 1.5, borderRadius: "10px" }} />
            ))}
          </Box>
        ) : rows.length === 0 ? (
          <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", py: 8, px: 3, gap: 1.5 }}>
            <Box sx={{ width: 56, height: 56, borderRadius: "14px", bgcolor: "#f1f5f9", color: "#6366f1", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <StorefrontIcon sx={{ fontSize: 28 }} />
            </Box>
            <Typography sx={{ fontWeight: 700, fontSize: 16, color: "#0f172a" }}>
              No Sync History Available
            </Typography>
            <Typography sx={{ fontSize: 13, color: "#64748b", maxWidth: 360, textAlign: "center" }}>
              Track a Shopify app from the sidebar to build historical rank tracking logs.
            </Typography>
          </Box>
        ) : filteredRows.length === 0 ? (
          <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", py: 8, gap: 1 }}>
            <Typography sx={{ fontWeight: 700, fontSize: 15, color: "#0f172a" }}>
              No apps match "{search}"
            </Typography>
            <Typography sx={{ fontSize: 13, color: "#64748b" }}>Try searching with a different app name or URL.</Typography>
          </Box>
        ) : (
          <DataGrid
            rows={filteredRows}
            columns={columns}
            getRowId={(row) => row.id || row.name + row.url}
            disableColumnMenu
            hideFooter={filteredRows.length <= 10}
            autoHeight
            rowHeight={60}
            sx={{
              border: "none",
              fontSize: 13.5,
              "& .MuiDataGrid-columnHeaders": { bgcolor: "#f8fafc", borderBottom: "1px solid #e2e8f0" },
              "& .MuiDataGrid-columnHeaderTitle": { fontWeight: 700, fontSize: 12, color: "#0f172a", textTransform: "uppercase", letterSpacing: "0.05em" },
              "& .MuiDataGrid-cell": { borderBottom: "1px solid #f1f5f9", display: "flex", alignItems: "center" },
              "& .MuiDataGrid-row:hover": { bgcolor: "#f8fafc" },
              "& .MuiDataGrid-cell:focus, & .MuiDataGrid-cell:focus-within": { outline: "none" },
            }}
          />
        )}
      </Paper>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </Box>
  );
}