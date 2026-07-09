// React
import { useEffect, useMemo, useState, type ReactElement } from "react";

// Material UI
import { Box, Chip, IconButton, InputAdornment, Paper, Skeleton, TextField, Tooltip, Typography } from "@mui/material";
import { Search as SearchIcon, Refresh as RefreshIcon, CheckCircle as SyncedIcon, Schedule as StaleIcon, HelpOutlineOutlined as NeverIcon } from "@mui/icons-material";
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

type SyncStatus = "synced" | "stale" | "never";

function getSyncStatus(dateStr: string | null): SyncStatus {
  if (!dateStr) return "never";
  const hoursSince = (Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60);
  return hoursSince <= 48 ? "synced" : "stale";
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
    color: "#15803d",
    bg: "#f0fdf4",
    icon: <SyncedIcon sx={{ fontSize: 15 }} />,
  },
  stale: {
    label: "Needs refresh",
    color: "#b45309",
    bg: "#fffbeb",
    icon: <StaleIcon sx={{ fontSize: 15 }} />,
  },
  never: {
    label: "Never synced",
    color: "#6b7280",
    bg: "#f3f4f6",
    icon: <NeverIcon sx={{ fontSize: 15 }} />,
  },
};

export default function HistoryPage() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [rows, setRows] = useState<AppLastSync[]>([]);
  const [search, setSearch] = useState("");

  const load = async (isRefresh = false) => {
    isRefresh ? setRefreshing(true) : setLoading(true);
    try {
      const data = await api.getAppsLastSync();
      setRows(data.apps);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const filteredRows = useMemo(() => {
    if (!search.trim()) return rows;
    const q = search.toLowerCase();
    return rows.filter((r) => r.name.toLowerCase().includes(q) || r.url.toLowerCase().includes(q));
  }, [rows, search]);

  const summary = useMemo(() => {
    const synced = rows.filter((r) => getSyncStatus(r.last_synced_at) === "synced").length;
    const stale = rows.filter((r) => getSyncStatus(r.last_synced_at) === "stale").length;
    const never = rows.filter((r) => getSyncStatus(r.last_synced_at) === "never").length;
    return { total: rows.length, synced, stale, never };
  }, [rows]);

  const columns: GridColDef<AppLastSync>[] = [
    {
      field: "name",
      headerName: "Application",
      flex: 1,
      minWidth: 160,
      renderCell: (params) => (
        <Box sx={{ display: "flex", alignItems: "center", height: "100%" }}>
          <Typography sx={{ fontSize: 13.5, fontWeight: 600, color: "#111827" }}>
            {params.value}
          </Typography>
        </Box>
      ),
    },
    {
      field: "url",
      headerName: "URL",
      flex: 1.6,
      minWidth: 200,
      renderCell: (params) => (
        <Box sx={{ display: "flex", alignItems: "center", height: "100%" }}>
          <Typography
            component="a"
            href={params.value}
            target="_blank"
            rel="noopener noreferrer"
            sx={{
              fontSize: 13, color: "#2563eb", textDecoration: "none",
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              "&:hover": { textDecoration: "underline" },
            }}
          >
            {params.value}
          </Typography>
        </Box>
      ),
    },
    {
      field: "last_synced_at",
      headerName: "Last Synced",
      flex: 1,
      minWidth: 150,
      renderCell: (params) => (
        <Box sx={{ display: "flex", alignItems: "center", height: "100%" }}>
          <Tooltip title={params.value ? new Date(params.value).toLocaleString() : "This app hasn't been scraped yet"}>
            <Typography sx={{ fontSize: 13, color: "#374151" }}>
              {formatRelativeTime(params.value)}
            </Typography>
          </Tooltip>
        </Box>
      ),
    },
    {
      field: "status",
      headerName: "Status",
      flex: 0.9,
      minWidth: 150,
      sortable: false,
      renderCell: (params) => {
        const status = getSyncStatus(params.row.last_synced_at);
        const cfg = STATUS_CONFIG[status];
        return (
          <Box sx={{ display: "flex", alignItems: "center", height: "100%" }}>
            <Chip
              icon={cfg.icon}
              label={cfg.label}
              size="small"
              sx={{
                fontSize: 12, fontWeight: 500,
                color: cfg.color, bgcolor: cfg.bg,
                "& .MuiChip-icon": { color: cfg.color, ml: "6px" },
                border: "none", height: 24,
              }}
            />
          </Box>
        );
      },
    },
  ];

  return (
    <Box sx={{ p: 3, maxWidth: 1100, mx: "auto" }}>
      {/* Quick summary chips + refresh — title/subtitle now live in the shared PageHeader */}
      {!loading && rows.length > 0 && (
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 2.5, flexWrap: "wrap", gap: 1 }}>
          <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
            <Chip
              label={`${summary.total} app${summary.total === 1 ? "" : "s"} tracked`}
              size="small"
              sx={{ fontSize: 12.5, fontWeight: 500, bgcolor: "#f3f4f6", color: "#374151", height: 26 }}
            />
            {summary.synced > 0 && (
              <Chip
                icon={<SyncedIcon sx={{ fontSize: 14 }} />}
                label={`${summary.synced} up to date`}
                size="small"
                sx={{ fontSize: 12.5, fontWeight: 500, bgcolor: "#f0fdf4", color: "#15803d", height: 26, "& .MuiChip-icon": { color: "#15803d" } }}
              />
            )}
            {summary.stale > 0 && (
              <Chip
                icon={<StaleIcon sx={{ fontSize: 14 }} />}
                label={`${summary.stale} need${summary.stale === 1 ? "s" : ""} refresh`}
                size="small"
                sx={{ fontSize: 12.5, fontWeight: 500, bgcolor: "#fffbeb", color: "#b45309", height: 26, "& .MuiChip-icon": { color: "#b45309" } }}
              />
            )}
            {summary.never > 0 && (
              <Chip
                icon={<NeverIcon sx={{ fontSize: 14 }} />}
                label={`${summary.never} never synced`}
                size="small"
                sx={{ fontSize: 12.5, fontWeight: 500, bgcolor: "#f3f4f6", color: "#6b7280", height: 26, "& .MuiChip-icon": { color: "#6b7280" } }}
              />
            )}
          </Box>
          <Tooltip title="Refresh">
            <span>
              <IconButton
                onClick={() => load(true)}
                disabled={loading || refreshing}
                sx={{
                  border: "1px solid #e5e7eb", borderRadius: "8px", width: 34, height: 34,
                  color: "#6b7280", "&:hover": { bgcolor: "#f9fafb", borderColor: "#d1d5db" },
                }}
              >
                <RefreshIcon sx={{ fontSize: 18, animation: refreshing ? "spin 1s linear infinite" : "none" }} />
              </IconButton>
            </span>
          </Tooltip>
        </Box>
      )}

      {/* Search */}
      {!loading && rows.length > 0 && (
        <TextField
          placeholder="Search apps by name or URL..."
          size="small"
          fullWidth
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          sx={{
            mb: 2,
            "& .MuiOutlinedInput-root": { bgcolor: "#fff", borderRadius: "8px", fontSize: 13.5 },
          }}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon sx={{ fontSize: 18, color: "#9ca3af" }} />
                </InputAdornment>
              ),
            },
          }}
        />
      )}

      {/* Content */}
      <Paper
        elevation={0}
        sx={{ borderRadius: "12px", border: "1px solid #e5e7eb", overflow: "hidden" }}
      >
        {loading ? (
          <Box sx={{ p: 2 }}>
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} variant="rounded" height={44} sx={{ mb: 1, borderRadius: "8px" }} />
            ))}
          </Box>
        ) : rows.length === 0 ? (
          <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", py: 8, px: 3, gap: 1.5 }}>
            <Box sx={{ width: 56, height: 56, borderRadius: "14px", bgcolor: "#f3f4f6", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24 }}>
              🕓
            </Box>
            <Typography sx={{ fontWeight: 600, fontSize: 15, color: "#111827" }}>
              No sync history yet
            </Typography>
            <Typography sx={{ fontSize: 13, color: "#6b7280", maxWidth: 320, textAlign: "center" }}>
              Track an app from the sidebar to start building its history log.
            </Typography>
          </Box>
        ) : filteredRows.length === 0 ? (
          <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", py: 8, gap: 1 }}>
            <Typography sx={{ fontWeight: 600, fontSize: 14, color: "#111827" }}>
              No apps match "{search}"
            </Typography>
            <Typography sx={{ fontSize: 13, color: "#6b7280" }}>Try a different search term.</Typography>
          </Box>
        ) : (
          <DataGrid
            rows={filteredRows}
            columns={columns}
            getRowId={(row) => row.name + row.url}
            disableColumnMenu
            hideFooter={filteredRows.length <= 10}
            autoHeight
            rowHeight={52}
            sx={{
              border: "none",
              fontSize: 13.5,
              "& .MuiDataGrid-columnHeaders": { bgcolor: "#f9fafb", borderBottom: "1px solid #e5e7eb" },
              "& .MuiDataGrid-columnHeaderTitle": { fontWeight: 600, fontSize: 12.5, color: "#6b7280" },
              "& .MuiDataGrid-cell": { borderBottom: "1px solid #f3f4f6", display: "flex", alignItems: "center" },
              "& .MuiDataGrid-row:hover": { bgcolor: "#fafafa" },
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