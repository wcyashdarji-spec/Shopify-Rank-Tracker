import { useState, useMemo } from "react";
import {
  Avatar,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  InputAdornment,
  MenuItem,
  Paper,
  Select,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import CloseIcon from "@mui/icons-material/Close";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutlineOutlined";
import DescriptionOutlinedIcon from "@mui/icons-material/DescriptionOutlined";
import SearchIcon from "@mui/icons-material/Search";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import StorefrontIcon from "@mui/icons-material/Storefront";
import KeyboardArrowLeftIcon from "@mui/icons-material/KeyboardArrowLeft";
import KeyboardArrowRightIcon from "@mui/icons-material/KeyboardArrowRight";
import type { App, Competitor, KeywordHistory } from "../api";

interface TableRowData {
  id: number;
  appName: string;
  isCompetitor: boolean;
  keyword: string;
  rank: number | null;
  page: number | null;
  found: boolean;
  screenshot_path: string | null;
  tracked_date: string;
}

interface HistoryLogProps {
  selectedApp?: App | null;
  historyData?: KeywordHistory[];
  competitors?: Competitor[];
  onAddCompetitor?: (name: string, url: string) => Promise<void>;
  onDeleteCompetitor?: (comp: Competitor) => Promise<void>;
  onViewScreenshot?: (path: string) => void;
  tableRows?: TableRowData[];
  onRefresh?: () => void;
}

const AVATAR_COLORS = [
  "#8b5cf6", // Purple
  "#10b981", // Green
  "#f97316", // Orange
  "#3b82f6", // Blue
  "#ec4899", // Pink
  "#f59e0b", // Amber
];

function getAvatarColor(name: string, index: number) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash + index) % AVATAR_COLORS.length];
}

export default function HistoryLog({
  selectedApp,
  historyData = [],
  competitors = [],
  onAddCompetitor,
  onDeleteCompetitor,
  onViewScreenshot: _onViewScreenshot,
  tableRows = [],
}: HistoryLogProps) {
  const [competitorFilter, setCompetitorFilter] = useState<string>("ALL");
  const [sortBy, setSortBy] = useState<"KEYWORD_GROUP" | "DATE_DESC" | "DATE_ASC">("KEYWORD_GROUP");
  const [search, setSearch] = useState<string>("");
  const [page, setPage] = useState<number>(0);
  const [rowsPerPage, setRowsPerPage] = useState<number>(10);

  // Add Competitor Dialog State
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [newCompName, setNewCompName] = useState("");
  const [newCompUrl, setNewCompUrl] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Delete Competitor Confirmation Dialog State
  const [pendingDelete, setPendingDelete] = useState<Competitor | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleConfirmDelete = async () => {
    if (!pendingDelete || !onDeleteCompetitor) return;
    setIsDeleting(true);
    try {
      await onDeleteCompetitor(pendingDelete);
      setPendingDelete(null);
    } catch (err) {
      console.error("Failed to delete competitor", err);
    } finally {
      setIsDeleting(false);
    }
  };



  // Handle Add Competitor Submit
  const handleAddSubmit = async () => {
    if (!newCompName.trim() || !newCompUrl.trim() || !onAddCompetitor) return;
    setIsSubmitting(true);
    try {
      await onAddCompetitor(newCompName.trim(), newCompUrl.trim());
      setAddDialogOpen(false);
      setNewCompName("");
      setNewCompUrl("");
    } catch (err) {
      console.error("Failed to add competitor", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // 1. Calculate Summary Stats (100% Dynamic)
  const stats = useMemo(() => {
    let totalKeywords = 0;
    let top10AnyCount = 0;
    let top10StoreCount = 0;
    let notRankingStoreCount = 0;

    if (historyData && historyData.length > 0) {
      totalKeywords = historyData.length;

      historyData.forEach((kh) => {
        const storeLatest = kh.history && kh.history.length > 0 ? kh.history[0] : null;
        const storeRank = storeLatest?.rank;
        const storeFound = storeLatest?.found && storeRank !== null && storeRank !== undefined;
        const storeInTop10 = storeFound && storeRank <= 10;

        if (storeInTop10) {
          top10StoreCount++;
        }

        if (!storeFound) {
          notRankingStoreCount++;
        }

        let compInTop10 = false;
        if (kh.competitors) {
          kh.competitors.forEach((c) => {
            const cLatest = c.history && c.history.length > 0 ? c.history[0] : null;
            if (cLatest?.found && cLatest.rank !== null && cLatest.rank <= 10) {
              compInTop10 = true;
            }
          });
        }

        if (storeInTop10 || compInTop10) {
          top10AnyCount++;
        }
      });
    } else if (tableRows && tableRows.length > 0) {
      const kwMap: Record<string, { storeRecord: any; compRecords: any[] }> = {};
      tableRows.forEach((r) => {
        if (!kwMap[r.keyword]) {
          kwMap[r.keyword] = { storeRecord: null, compRecords: [] };
        }
        if (!r.isCompetitor) {
          if (!kwMap[r.keyword].storeRecord) kwMap[r.keyword].storeRecord = r;
        } else {
          kwMap[r.keyword].compRecords.push(r);
        }
      });

      const uniqueKwNames = Object.keys(kwMap);
      totalKeywords = uniqueKwNames.length;

      uniqueKwNames.forEach((kw) => {
        const entry = kwMap[kw];
        const storeRank = entry.storeRecord?.rank;
        const storeFound = entry.storeRecord?.found && storeRank !== null && storeRank !== undefined;
        const storeInTop10 = storeFound && storeRank <= 10;

        if (storeInTop10) {
          top10StoreCount++;
        }
        if (!storeFound) {
          notRankingStoreCount++;
        }

        const compInTop10 = entry.compRecords.some((c) => c.found && c.rank !== null && c.rank <= 10);
        if (storeInTop10 || compInTop10) {
          top10AnyCount++;
        }
      });
    }

    return {
      totalKeywords,
      top10Any: top10AnyCount,
      top10AnyPct: totalKeywords > 0 ? `${((top10AnyCount / totalKeywords) * 100).toFixed(1)}%` : "0.0%",
      top10Store: top10StoreCount,
      top10StorePct: totalKeywords > 0 ? `${((top10StoreCount / totalKeywords) * 100).toFixed(1)}%` : "0.0%",
      notRankingStore: notRankingStoreCount,
      notRankingStorePct: totalKeywords > 0 ? `${((notRankingStoreCount / totalKeywords) * 100).toFixed(1)}%` : "0.0%",
    };
  }, [historyData, tableRows]);

  // 2. Build Matrix Table Rows for ALL Historical Records
  const matrixRows = useMemo(() => {
    let rawList: any[] = [];

    if (historyData && historyData.length > 0) {
      historyData.forEach((kh) => {
        const dateMap: Record<string, { dateObj: Date; storeRecord: any; compRecords: Record<string, any> }> = {};

        // Process store history
        if (kh.history) {
          kh.history.forEach((rec) => {
            const dateKey = rec.tracked_date ? rec.tracked_date.substring(0, 10) : "unknown";
            if (!dateMap[dateKey]) {
              dateMap[dateKey] = {
                dateObj: rec.tracked_date ? new Date(rec.tracked_date) : new Date(),
                storeRecord: rec,
                compRecords: {},
              };
            } else if (!dateMap[dateKey].storeRecord) {
              dateMap[dateKey].storeRecord = rec;
            }
          });
        }

        // Process competitor history
        if (kh.competitors) {
          kh.competitors.forEach((c) => {
            if (c.history) {
              c.history.forEach((rec) => {
                const dateKey = rec.tracked_date ? rec.tracked_date.substring(0, 10) : "unknown";
                if (!dateMap[dateKey]) {
                  dateMap[dateKey] = {
                    dateObj: rec.tracked_date ? new Date(rec.tracked_date) : new Date(),
                    storeRecord: null,
                    compRecords: {},
                  };
                }
                dateMap[dateKey].compRecords[c.name] = rec;
              });
            }
          });
        }

        // Create a matrix row for each unique date of this keyword
        Object.entries(dateMap).forEach(([dateKey, entry]) => {
          const compMap: Record<string, { rank: number | null; page: number | null; found: boolean }> = {};
          Object.entries(entry.compRecords).forEach(([cName, cRec]: [string, any]) => {
            compMap[cName] = {
              rank: cRec?.rank ?? null,
              page: cRec?.page ?? null,
              found: !!cRec?.found,
            };
          });

          const dateStr = entry.storeRecord?.tracked_date || (Object.values(entry.compRecords)[0] as any)?.tracked_date || dateKey;
          const formattedDate = dateStr && dateStr !== "unknown"
            ? new Date(dateStr).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })
            : dateKey;

          rawList.push({
            rowKey: `${kh.keyword.id}-${dateKey}`,
            keywordId: kh.keyword.id,
            keywordName: kh.keyword.name,
            rawDate: entry.dateObj.getTime(),
            store: {
              rank: entry.storeRecord?.rank ?? null,
              page: entry.storeRecord?.page ?? null,
              found: !!entry.storeRecord?.found,
              screenshot_path: entry.storeRecord?.screenshot_path ?? null,
            },
            competitors: compMap,
            lastChecked: formattedDate,
          });
        });
      });
    } else if (tableRows && tableRows.length > 0) {
      const grouped: Record<string, any> = {};
      tableRows.forEach((r) => {
        const dateKey = r.tracked_date ? r.tracked_date.substring(0, 10) : "unknown";
        const groupKey = `${r.keyword}___${dateKey}`;
        if (!grouped[groupKey]) {
          grouped[groupKey] = {
            rowKey: groupKey,
            keywordId: r.id,
            keywordName: r.keyword,
            rawDate: r.tracked_date ? new Date(r.tracked_date).getTime() : 0,
            store: { rank: null, page: null, found: false, screenshot_path: null },
            competitors: {},
            lastChecked: r.tracked_date
              ? new Date(r.tracked_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
              : dateKey,
          };
        }
        if (!r.isCompetitor) {
          grouped[groupKey].store = {
            rank: r.rank,
            page: r.page,
            found: r.found,
            screenshot_path: r.screenshot_path,
          };
        } else {
          grouped[groupKey].competitors[r.appName] = {
            rank: r.rank,
            page: r.page,
            found: r.found,
          };
        }
      });
      rawList = Object.values(grouped);
    }

    if (sortBy === "KEYWORD_GROUP") {
      return rawList.sort((a, b) => {
        const nameCmp = a.keywordName.localeCompare(b.keywordName);
        if (nameCmp !== 0) return nameCmp;
        return b.rawDate - a.rawDate;
      });
    } else if (sortBy === "DATE_ASC") {
      return rawList.sort((a, b) => {
        const dateCmp = a.rawDate - b.rawDate;
        if (dateCmp !== 0) return dateCmp;
        return a.keywordName.localeCompare(b.keywordName);
      });
    } else {
      // DATE_DESC
      return rawList.sort((a, b) => {
        const dateCmp = b.rawDate - a.rawDate;
        if (dateCmp !== 0) return dateCmp;
        return a.keywordName.localeCompare(b.keywordName);
      });
    }
  }, [historyData, tableRows, sortBy]);

  // Filter rows
  const filteredRows = useMemo(() => {
    return matrixRows.filter((r) =>
      r.keywordName.toLowerCase().includes(search.toLowerCase())
    );
  }, [matrixRows, search]);

  const activeCompetitors = useMemo(() => {
    if (competitorFilter === "ALL") {
      return competitors;
    }
    return competitors.filter((c) => c.name === competitorFilter);
  }, [competitors, competitorFilter]);

  const isHistoryFilterActive = search.trim() !== "" || competitorFilter !== "ALL" || sortBy !== "KEYWORD_GROUP";

  const handleResetHistoryFilters = () => {
    setSearch("");
    setCompetitorFilter("ALL");
    setSortBy("KEYWORD_GROUP");
    setPage(0);
  };

  const paginatedRows = useMemo(() => {
    return filteredRows.slice(page * rowsPerPage, (page + 1) * rowsPerPage);
  }, [filteredRows, page, rowsPerPage]);

  const totalPages = Math.ceil(filteredRows.length / rowsPerPage) || 1;

  return (
    <Box sx={{ width: "100%", mt: 1 }}>
      {/* Title Header Banner */}

      {/* Manage Competitors Cards Section */}
      <Paper elevation={0} sx={{ p: 2.5, borderRadius: "12px", border: "1px solid #e5e7eb", bgcolor: "#fff", mb: 3 }}>
        <Typography sx={{ fontWeight: 700, fontSize: 15, color: "#111827", mb: 2 }}>
          Manage Competitors
        </Typography>

        <Box sx={{ display: "flex", alignItems: "center", gap: 2, flexWrap: "wrap" }}>
          {competitors.map((comp, idx) => {
            const avatarColor = getAvatarColor(comp.name, idx);
            return (
              <Box
                key={comp.id}
                sx={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 1.5,
                  px: 2,
                  py: 1.25,
                  borderRadius: "10px",
                  border: "1px solid #e5e7eb",
                  bgcolor: "#fff",
                  minWidth: 220,
                  flexGrow: 1,
                  maxWidth: { sm: 300 },
                }}
              >
                <Box sx={{ display: "flex", alignItems: "center", gap: 1.25, minWidth: 0 }}>
                  <Avatar
                    src={comp.icon_url || undefined}
                    sx={{
                      width: 32,
                      height: 32,
                      bgcolor: avatarColor,
                      fontSize: 14,
                      fontWeight: 700,
                    }}
                  >
                    {comp.name[0]?.toUpperCase()}
                  </Avatar>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography sx={{ fontWeight: 700, fontSize: 13.5, color: "#111827" }} noWrap>
                      {comp.name}
                    </Typography>
                    <Typography sx={{ fontSize: 11, color: "#9ca3af" }} noWrap>
                      {comp.url}
                    </Typography>
                  </Box>
                </Box>

                {onDeleteCompetitor && (
                  <IconButton
                    size="small"
                    onClick={() => setPendingDelete(comp)}
                    sx={{ color: "#ef4444", p: 0.5, "&:hover": { bgcolor: "#fee2e2" } }}
                    title={`Delete ${comp.name}`}
                  >
                    <DeleteOutlineIcon sx={{ fontSize: 18 }} />
                  </IconButton>
                )}
              </Box>
            );
          })}

          <Button
            variant="outlined"
            onClick={() => setAddDialogOpen(true)}
            startIcon={<AddIcon sx={{ fontSize: 18 }} />}
            sx={{
              borderRadius: "10px",
              bgcolor: "#0f172a",
              color: "#ffffff",
              fontWeight: 700,
              fontSize: 13,
              textTransform: "none",
              px: 2.5,
              py: 1,
              boxShadow: "0 4px 12px rgba(15, 23, 42, 0.15)",
              "&:hover": { bgcolor: "#1e293b", boxShadow: "0 6px 16px rgba(15, 23, 42, 0.25)" },
            }}
          >
            Add Competitor
          </Button>
        </Box>
      </Paper>

      {/* Summary Metric Cards (4 Cards in a row) */}
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)", md: "repeat(4, 1fr)" },
          gap: 2.5,
          mb: 3.5,
        }}
      >
        {/* Card 1: Total Keywords */}
        <Paper
          elevation={0}
          sx={{
            p: 2.5,
            borderRadius: "18px",
            border: "1px solid #e2e8f0",
            background: "linear-gradient(135deg, #ffffff 0%, #faf5ff 100%)",
            boxShadow: "0 4px 20px -2px rgba(15, 23, 42, 0.03)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            transition: "all 0.2s ease",
            "&:hover": { borderColor: "#8b5cf6", boxShadow: "0 10px 25px -4px rgba(139, 92, 246, 0.2)" },
          }}
        >
          <Box>
            <Typography sx={{ fontSize: 12, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", mb: 0.5 }}>
              Total Keywords
            </Typography>
            <Typography sx={{ fontSize: 28, fontWeight: 800, color: "#0f172a", lineHeight: 1 }}>
              {stats.totalKeywords}
            </Typography>
          </Box>
          <Box
            sx={{
              width: 46,
              height: 46,
              borderRadius: "12px",
              bgcolor: "#f5f3ff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#8b5cf6",
              boxShadow: "0 4px 10px rgba(139, 92, 246, 0.15)",
            }}
          >
            <DescriptionOutlinedIcon sx={{ fontSize: 24 }} />
          </Box>
        </Paper>

        {/* Card 2: Keywords in Top 10 (Any Competitor) */}
        <Paper
          elevation={0}
          sx={{
            p: 2.5,
            borderRadius: "18px",
            border: "1px solid #e2e8f0",
            background: "linear-gradient(135deg, #ffffff 0%, #ecfdf5 100%)",
            boxShadow: "0 4px 20px -2px rgba(15, 23, 42, 0.03)",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            transition: "all 0.2s ease",
            "&:hover": { borderColor: "#10b981", boxShadow: "0 10px 25px -4px rgba(16, 185, 129, 0.2)" },
          }}
        >
          <Typography sx={{ fontSize: 12, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", mb: 0.5 }} noWrap>
            Keywords in Top 10 (Any)
          </Typography>
          <Box sx={{ display: "flex", alignItems: "baseline", gap: 1.5 }}>
            <Typography sx={{ fontSize: 28, fontWeight: 800, color: "#0f172a", lineHeight: 1 }}>
              {stats.top10Any}
            </Typography>
            <Chip
              label={stats.top10AnyPct}
              size="small"
              sx={{
                bgcolor: "#dcfce7",
                color: "#15803d",
                fontWeight: 800,
                fontSize: 11.5,
                height: 22,
                borderRadius: "6px",
                border: "1px solid #a7f3d0",
              }}
            />
          </Box>
        </Paper>

        {/* Card 3: Your App in Top 10 */}
        <Paper
          elevation={0}
          sx={{
            p: 2.5,
            borderRadius: "18px",
            border: "1px solid #e2e8f0",
            background: "linear-gradient(135deg, #ffffff 0%, #eff6ff 100%)",
            boxShadow: "0 4px 20px -2px rgba(15, 23, 42, 0.03)",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            transition: "all 0.2s ease",
            "&:hover": { borderColor: "#3b82f6", boxShadow: "0 10px 25px -4px rgba(59, 130, 246, 0.2)" },
          }}
        >
          <Typography sx={{ fontSize: 12, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", mb: 0.5 }} noWrap>
            Your App in Top 10
          </Typography>
          <Box sx={{ display: "flex", alignItems: "baseline", gap: 1.5 }}>
            <Typography sx={{ fontSize: 28, fontWeight: 800, color: "#3b82f6", lineHeight: 1 }}>
              {stats.top10Store}
            </Typography>
            <Chip
              label={stats.top10StorePct}
              size="small"
              sx={{
                bgcolor: "#dbeafe",
                color: "#1d4ed8",
                fontWeight: 800,
                fontSize: 11.5,
                height: 22,
                borderRadius: "6px",
                border: "1px solid #bfdbfe",
              }}
            />
          </Box>
        </Paper>

        {/* Card 4: Not Ranking (Your App) */}
        <Paper
          elevation={0}
          sx={{
            p: 2.5,
            borderRadius: "18px",
            border: "1px solid #fecdd3",
            background: "linear-gradient(135deg, #ffffff 0%, #fff1f2 100%)",
            boxShadow: "0 4px 20px -2px rgba(225, 29, 72, 0.04)",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            transition: "all 0.2s ease",
            "&:hover": { borderColor: "#e11d48", boxShadow: "0 10px 25px -4px rgba(225, 29, 72, 0.2)" },
          }}
        >
          <Typography sx={{ fontSize: 12, fontWeight: 700, color: "#9f1239", textTransform: "uppercase", letterSpacing: "0.05em", mb: 0.5 }} noWrap>
            Not Ranking (Your App)
          </Typography>
          <Box sx={{ display: "flex", alignItems: "baseline", gap: 1.5 }}>
            <Typography sx={{ fontSize: 28, fontWeight: 800, color: "#e11d48", lineHeight: 1 }}>
              {stats.notRankingStore}
            </Typography>
            <Chip
              label={stats.notRankingStorePct}
              size="small"
              sx={{
                borderRadius: "4px",
              }}
            />
          </Box>
        </Paper>
      </Box>

      {/* Ranking History Matrix Table Section */}
      <Paper elevation={0} sx={{ borderRadius: "12px", border: "1px solid #e5e7eb", bgcolor: "#fff", overflow: "hidden", mb: 4 }}>
        {/* Table Header Controls */}
        <Box
          sx={{
            px: 3,
            py: 2,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderBottom: "1px solid #f3f4f6",
            gap: 2,
            flexWrap: "wrap",
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
            <Typography sx={{ fontWeight: 700, fontSize: 18, color: "#111827" }}>
              Ranking History
            </Typography>

            <Select
              size="small"
              value={competitorFilter}
              onChange={(e) => {
                setCompetitorFilter(e.target.value);
                setPage(0);
              }}
              sx={{
                fontSize: 13,
                fontWeight: 600,
                bgcolor: "#fff",
                borderRadius: "8px",
                minWidth: 160,
                height: 36,
                "& fieldset": { borderColor: "#e5e7eb" },
              }}
            >
              <MenuItem value="ALL" sx={{ fontSize: 13 }}>All Competitors</MenuItem>
              {competitors.map((c) => (
                <MenuItem key={c.id} value={c.name} sx={{ fontSize: 13 }}>
                  {c.name}
                </MenuItem>
              ))}
            </Select>

            <Select
              size="small"
              value={sortBy}
              onChange={(e) => {
                setSortBy(e.target.value as any);
                setPage(0);
              }}
              sx={{
                fontSize: 13,
                fontWeight: 600,
                bgcolor: "#fff",
                borderRadius: "8px",
                minWidth: 185,
                height: 36,
                "& fieldset": { borderColor: "#e5e7eb" },
              }}
            >
              <MenuItem value="KEYWORD_GROUP" sx={{ fontSize: 13 }}>By Keyword & History</MenuItem>
              <MenuItem value="DATE_DESC" sx={{ fontSize: 13 }}>Newest Dates First</MenuItem>
              <MenuItem value="DATE_ASC" sx={{ fontSize: 13 }}>Oldest Dates First</MenuItem>
            </Select>
          </Box>

          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
            <TextField
              size="small"
              placeholder="Filter keywords…"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(0);
              }}
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon sx={{ fontSize: 16, color: "#9ca3af" }} />
                    </InputAdornment>
                  ),
                  sx: {
                    fontSize: 13,
                    borderRadius: "8px",
                    bgcolor: "#fff",
                    height: 36,
                    "& fieldset": { borderColor: "#e5e7eb" },
                  },
                },
              }}
              sx={{ width: 220 }}
            />

            {isHistoryFilterActive && (
              <Button
                size="small"
                variant="outlined"
                onClick={handleResetHistoryFilters}
                startIcon={<RestartAltIcon sx={{ fontSize: 16 }} />}
                sx={{
                  fontSize: 12,
                  fontWeight: 700,
                  height: 36,
                  borderRadius: "8px",
                  bgcolor: "#fff1f2",
                  color: "#e11d48",
                  borderColor: "#fecdd3",
                  textTransform: "none",
                  px: 1.5,
                  boxShadow: "0 2px 6px rgba(225, 29, 72, 0.1)",
                  "&:hover": {
                    bgcolor: "#ffe4e6",
                    borderColor: "#fda4af",
                  },
                }}
              >
                Reset Filters
              </Button>
            )}
          </Box>
        </Box>

        {/* Matrix Table */}
        <Box sx={{ overflowX: "auto" }}>
          <Table size="small" sx={{ borderCollapse: "separate", borderSpacing: 0, width: "100%" }}>
            <TableHead>
              <TableRow sx={{ "& th": { bgcolor: "#f8fafc", borderBottom: "1px solid #e2e8f0", borderRight: "1px solid #e2e8f0", py: 1.5, px: 2 } }}>
                <TableCell sx={{ fontSize: 12.5, fontWeight: 700, color: "#374151" }}>
                  Keyword
                </TableCell>

                {/* Your App Column */}
                <TableCell sx={{ fontSize: 12.5, fontWeight: 700, color: "#111827" }}>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <Avatar
                      src={selectedApp?.icon_url || undefined}
                      sx={{
                        width: 22,
                        height: 22,
                        bgcolor: "#2563eb",
                        fontSize: 11,
                        fontWeight: 700,
                      }}
                    >
                      {selectedApp?.name ? selectedApp.name[0]?.toUpperCase() : "A"}
                    </Avatar>
                    <Typography sx={{ fontSize: 12.5, fontWeight: 700, color: "#111827" }}>
                      {selectedApp?.name || "Your App"}
                    </Typography>
                    <Chip
                      label="Your App"
                      size="small"
                      sx={{
                        bgcolor: "#eff6ff",
                        color: "#3b82f6",
                        fontSize: 10,
                        fontWeight: 700,
                        height: 18,
                        borderRadius: "4px",
                      }}
                    />
                  </Box>
                </TableCell>

                {/* Competitor Columns */}
                {activeCompetitors.map((comp, idx) => {
                  const avatarColor = getAvatarColor(comp.name, idx);
                  return (
                    <TableCell key={comp.id} sx={{ fontSize: 12.5, fontWeight: 700, color: "#111827" }}>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                        <Avatar
                          src={comp.icon_url || undefined}
                          sx={{
                            width: 22,
                            height: 22,
                            bgcolor: avatarColor,
                            fontSize: 11,
                            fontWeight: 700,
                          }}
                        >
                          {comp.name[0]?.toUpperCase()}
                        </Avatar>
                        <Typography sx={{ fontSize: 12.5, fontWeight: 700, color: "#111827" }} noWrap>
                          {comp.name}
                        </Typography>
                      </Box>
                    </TableCell>
                  );
                })}

                <TableCell sx={{ fontSize: 12.5, fontWeight: 700, color: "#374151", borderRight: "none" }}>
                  Last Checked
                </TableCell>
              </TableRow>
            </TableHead>

            <TableBody>
              {paginatedRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3 + activeCompetitors.length} align="center" sx={{ py: 5, color: "#9ca3af", fontSize: 13 }}>
                    No keyword ranking records match your filter.
                  </TableCell>
                </TableRow>
              ) : (
                paginatedRows.map((row) => (
                  <TableRow
                    key={row.rowKey || `${row.keywordId}-${row.lastChecked}`}
                    hover
                    sx={{
                      "& td": { borderBottom: "1px solid #e2e8f0", borderRight: "1px solid #e2e8f0", py: 1.5, px: 2 },
                    }}
                  >
                    {/* Keyword Name */}
                    <TableCell sx={{ fontSize: 13, fontWeight: 700, color: "#111827" }}>
                      {row.keywordName}
                    </TableCell>

                    {/* Your App Cell */}
                    <TableCell>
                      {row.store.found && row.store.rank !== null ? (
                        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                          <Box
                            sx={{
                              bgcolor: "#dcfce7",
                              color: "#15803d",
                              fontWeight: 700,
                              fontSize: 11.5,
                              borderRadius: "4px",
                              px: 1,
                              py: 0.25,
                              display: "inline-block",
                            }}
                          >
                            #{row.store.rank}
                          </Box>
                          <Typography sx={{ fontSize: 12, color: "#6b7280" }}>
                            Page {row.store.page ?? 1}
                          </Typography>
                        </Box>
                      ) : (
                        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                          <Box
                            sx={{
                              bgcolor: "#fee2e2",
                              color: "#dc2626",
                              fontWeight: 700,
                              fontSize: 11.5,
                              borderRadius: "4px",
                              px: 1,
                              py: 0.25,
                              display: "inline-block",
                            }}
                          >
                            Not Capture
                          </Box>
                          <Typography sx={{ fontSize: 13, color: "#9ca3af", letterSpacing: "2px" }}>
                            — —
                          </Typography>
                        </Box>
                      )}
                    </TableCell>

                    {/* Competitor Cells */}
                    {activeCompetitors.map((comp) => {
                      const compData = row.competitors[comp.name];
                      const isFound = compData?.found && compData?.rank !== null;
                      return (
                        <TableCell key={comp.id}>
                          {isFound ? (
                            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                              <Box
                                sx={{
                                  bgcolor: "#dcfce7",
                                  color: "#15803d",
                                  fontWeight: 700,
                                  fontSize: 11.5,
                                  borderRadius: "4px",
                                  px: 1,
                                  py: 0.25,
                                  display: "inline-block",
                                }}
                              >
                                #{compData.rank}
                              </Box>
                              <Typography sx={{ fontSize: 12, color: "#6b7280" }}>
                                Page {compData.page ?? 1}
                              </Typography>
                            </Box>
                          ) : (
                            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                              <Box
                                sx={{
                                  bgcolor: "#fee2e2",
                                  color: "#dc2626",
                                  fontWeight: 700,
                                  fontSize: 11.5,
                                  borderRadius: "4px",
                                  px: 1,
                                  py: 0.25,
                                  display: "inline-block",
                                }}
                              >
                                Not Capture
                              </Box>
                              <Typography sx={{ fontSize: 13, color: "#9ca3af", letterSpacing: "2px" }}>
                                — —
                              </Typography>
                            </Box>
                          )}
                        </TableCell>
                      );
                    })}

                    {/* Last Checked */}
                    <TableCell sx={{ fontSize: 12.5, color: "#6b7280", borderRight: "none" }}>
                      {row.lastChecked}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Box>

        {/* Footer / Pagination Controls */}
        <Box
          sx={{
            px: 3,
            py: 1.5,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderTop: "1px solid #f3f4f6",
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Typography sx={{ fontSize: 12.5, color: "#6b7280" }}>Rows per page:</Typography>
            <Select
              size="small"
              value={rowsPerPage}
              onChange={(e) => {
                setRowsPerPage(+e.target.value);
                setPage(0);
              }}
              sx={{
                fontSize: 12.5,
                height: 30,
                bgcolor: "#fff",
                borderRadius: "6px",
                "& fieldset": { borderColor: "#e5e7eb" },
              }}
            >
              <MenuItem value={10} sx={{ fontSize: 12.5 }}>10</MenuItem>
              <MenuItem value={20} sx={{ fontSize: 12.5 }}>20</MenuItem>
              <MenuItem value={50} sx={{ fontSize: 12.5 }}>50</MenuItem>
            </Select>
          </Box>

          <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
            <Typography sx={{ fontSize: 12.5, color: "#6b7280" }}>
              {filteredRows.length === 0
                ? "0 of 0"
                : `${page * rowsPerPage + 1}-${Math.min((page + 1) * rowsPerPage, filteredRows.length)} of ${filteredRows.length}`}
            </Typography>

            <Box sx={{ display: "flex", gap: 0.5 }}>
              <IconButton
                size="small"
                disabled={page === 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                sx={{ color: "#374151" }}
              >
                <KeyboardArrowLeftIcon fontSize="small" />
              </IconButton>
              <IconButton
                size="small"
                disabled={page >= totalPages - 1}
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                sx={{ color: "#374151" }}
              >
                <KeyboardArrowRightIcon fontSize="small" />
              </IconButton>
            </Box>
          </Box>
        </Box>
      </Paper>

      {/* Add Competitor Dialog */}
      <Dialog
        open={addDialogOpen}
        onClose={() => !isSubmitting && setAddDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        slotProps={{ paper: { sx: { borderRadius: "18px", p: 1.5, boxShadow: "0 20px 40px rgba(0,0,0,0.12)" } } }}
      >
        <DialogTitle sx={{ pb: 1.5, pt: 2, px: 3 }}>
          <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 2 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
              <Box
                sx={{
                  width: 44,
                  height: 44,
                  borderRadius: "12px",
                  bgcolor: "#f1f5f9",
                  color: "#0f172a",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <StorefrontIcon sx={{ fontSize: 24 }} />
              </Box>
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 800, color: "#0f172a", fontSize: 18, lineHeight: 1.2 }}>
                  Add Competitor App
                </Typography>
                <Typography sx={{ fontSize: 12.5, color: "#64748b", mt: 0.5, fontWeight: 500 }}>
                  Track side-by-side keyword positions and day-over-day ASO updates.
                </Typography>
              </Box>
            </Box>
            <IconButton size="small" onClick={() => setAddDialogOpen(false)} disabled={isSubmitting} sx={{ color: "#64748b" }}>
              <CloseIcon sx={{ fontSize: 20 }} />
            </IconButton>
          </Box>
        </DialogTitle>

        <Divider sx={{ borderColor: "#f1f5f9" }} />

        <DialogContent sx={{ py: 3, px: 3, display: "flex", flexDirection: "column", gap: 2.5 }}>
          <Box>
            <Typography sx={{ fontSize: 13, fontWeight: 700, color: "#334155", mb: 0.75 }}>
              Competitor App Name <Typography component="span" sx={{ color: "#ef4444" }}>*</Typography>
            </Typography>
            <TextField
              placeholder="e.g. Wishlist King or Judge.me Reviews"
              value={newCompName}
              onChange={(e) => setNewCompName(e.target.value)}
              disabled={isSubmitting}
              fullWidth
              variant="outlined"
              sx={{
                "& .MuiOutlinedInput-root": {
                  borderRadius: "10px",
                  bgcolor: "#ffffff",
                  fontSize: 14,
                  "& fieldset": { borderColor: "#cbd5e1" },
                  "&:hover fieldset": { borderColor: "#94a3b8" },
                  "&.Mui-focused fieldset": { borderColor: "#0f172a" },
                },
              }}
            />
          </Box>

          <Box>
            <Typography sx={{ fontSize: 13, fontWeight: 700, color: "#334155", mb: 0.75 }}>
              Shopify App Store URL <Typography component="span" sx={{ color: "#ef4444" }}>*</Typography>
            </Typography>
            <TextField
              placeholder="https://apps.shopify.com/app-name"
              value={newCompUrl}
              onChange={(e) => setNewCompUrl(e.target.value)}
              disabled={isSubmitting}
              fullWidth
              variant="outlined"
              sx={{
                "& .MuiOutlinedInput-root": {
                  borderRadius: "10px",
                  bgcolor: "#ffffff",
                  fontSize: 14,
                  "& fieldset": { borderColor: "#cbd5e1" },
                  "&:hover fieldset": { borderColor: "#94a3b8" },
                  "&.Mui-focused fieldset": { borderColor: "#0f172a" },
                },
              }}
            />
            <Typography sx={{ fontSize: 11.5, color: "#64748b", mt: 0.75 }}>
              Paste the public Shopify App Store listing URL to crawl keywords and daily metadata.
            </Typography>
          </Box>
        </DialogContent>

        <Divider sx={{ borderColor: "#f1f5f9" }} />

        <DialogActions sx={{ px: 3, py: 2, gap: 1.5 }}>
          <Button
            onClick={() => setAddDialogOpen(false)}
            disabled={isSubmitting}
            variant="outlined"
            sx={{
              borderColor: "#cbd5e1",
              color: "#475569",
              bgcolor: "#ffffff",
              textTransform: "none",
              fontWeight: 700,
              fontSize: 13,
              borderRadius: "9px",
              px: 2.5,
              py: 0.7,
              "&:hover": { borderColor: "#94a3b8", bgcolor: "#f8fafc" },
            }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            disabled={isSubmitting || !newCompName.trim() || !newCompUrl.trim()}
            onClick={handleAddSubmit}
            sx={{
              bgcolor: "#0f172a",
              color: "#ffffff",
              textTransform: "none",
              fontWeight: 700,
              fontSize: 13,
              borderRadius: "9px",
              px: 3,
              py: 0.7,
              boxShadow: "none",
              "&:hover": { bgcolor: "#1e293b", boxShadow: "none" },
              "&.Mui-disabled": { bgcolor: "#e2e8f0", color: "#94a3b8" },
            }}
          >
            {isSubmitting ? (
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <CircularProgress size={16} sx={{ color: "#ffffff" }} />
                <span>Adding...</span>
              </Box>
            ) : (
              "Add Competitor"
            )}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Delete Competitor Confirmation Dialog ── */}
      <Dialog
        open={!!pendingDelete}
        onClose={() => { if (!isDeleting) setPendingDelete(null); }}
        slotProps={{
          paper: {
            sx: {
              borderRadius: "16px",
              p: 1,
              maxWidth: 420,
              width: "100%",
            },
          },
        }}
      >
        <DialogTitle sx={{ fontSize: 17, fontWeight: 700, color: "#111827", pb: 0.5 }}>
          Remove Competitor
        </DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          <Typography sx={{ fontSize: 14, color: "#374151", mb: 1 }}>
            Are you sure you want to remove{" "}
            <Box component="span" sx={{ fontWeight: 700 }}>
              {pendingDelete?.name}
            </Box>
            ?
          </Typography>
          <Typography sx={{ fontSize: 13, color: "#6b7280" }}>
            This will stop tracking this competitor and remove all associated
            activity history. This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
          <Button
            onClick={() => setPendingDelete(null)}
            disabled={isDeleting}
            sx={{
              textTransform: "none",
              fontWeight: 600,
              fontSize: 13,
              color: "#374151",
              borderRadius: "8px",
              px: 2.5,
              "&:hover": { bgcolor: "#f3f4f6" },
            }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirmDelete}
            disabled={isDeleting}
            variant="contained"
            startIcon={isDeleting ? <CircularProgress size={15} color="inherit" /> : null}
            sx={{
              textTransform: "none",
              fontWeight: 600,
              fontSize: 13,
              bgcolor: "#ef4444",
              color: "#fff",
              borderRadius: "8px",
              px: 2.5,
              "&:hover": { bgcolor: "#dc2626" },
              "&.Mui-disabled": { bgcolor: "#fca5a5", color: "#fff" },
            }}
          >
            {isDeleting ? "Removing…" : "Remove Competitor"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
