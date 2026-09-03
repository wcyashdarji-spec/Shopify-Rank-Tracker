// React
import { useMemo, useRef, useState, useEffect } from "react";

// Material UI
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  IconButton,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  InputAdornment,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
  Select,
  MenuItem,
  FormControl,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import TrendingDownIcon from "@mui/icons-material/TrendingDown";
import RemoveIcon from "@mui/icons-material/Remove";
import FilterListIcon from "@mui/icons-material/FilterList";
import PushPinIcon from "@mui/icons-material/PushPin";
import PushPinOutlinedIcon from "@mui/icons-material/PushPinOutlined";
import SearchIcon from "@mui/icons-material/Search";
import CloseIcon from "@mui/icons-material/Close";

// Types
import type { Keyword, KeywordHistory } from "../api";

interface RankChartProps {
  historyData: KeywordHistory[];
  selectedKeywords: number[];
  onToggleKeyword: (id: number) => void;
  daysRange: number;
  onRangeChange: (days: number) => void;
  keywords: Keyword[];
  isLoadingHistory: boolean;
  onManageKeywords: () => void;
}

// Smooth bezier curve path helper
function buildSmoothPath(pts: Array<{ x: number; y: number }>): string {
  const n = pts.length;
  if (n === 0) return "";
  if (n === 1) return `M ${pts[0].x} ${pts[0].y}`;
  if (n === 2) {
    return `M ${pts[0].x.toFixed(2)} ${pts[0].y.toFixed(2)} L ${pts[1].x.toFixed(2)} ${pts[1].y.toFixed(2)}`;
  }

  const dx: number[] = [];
  const slope: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    const ddx = pts[i + 1].x - pts[i].x;
    const ddy = pts[i + 1].y - pts[i].y;
    dx.push(ddx);
    slope.push(ddx !== 0 ? ddy / ddx : 0);
  }

  const m: number[] = new Array(n).fill(0);
  m[0] = slope[0];
  m[n - 1] = slope[n - 2];
  for (let i = 1; i < n - 1; i++) {
    if (slope[i - 1] === 0 || slope[i] === 0 || slope[i - 1] * slope[i] < 0) {
      m[i] = 0;
    } else {
      const w1 = 2 * dx[i] + dx[i - 1];
      const w2 = dx[i] + 2 * dx[i - 1];
      m[i] = (w1 + w2) / (w1 / slope[i - 1] + w2 / slope[i]);
    }
  }

  for (let i = 0; i < n - 1; i++) {
    if (slope[i] === 0) {
      m[i] = 0;
      m[i + 1] = 0;
      continue;
    }
    const a = m[i] / slope[i];
    const b = m[i + 1] / slope[i];
    const s = a * a + b * b;
    if (s > 9) {
      const tRescale = 3 / Math.sqrt(s);
      m[i] = tRescale * a * slope[i];
      m[i + 1] = tRescale * b * slope[i];
    }
  }

  let d = `M ${pts[0].x.toFixed(2)} ${pts[0].y.toFixed(2)}`;
  for (let i = 0; i < n - 1; i++) {
    const p0 = pts[i];
    const p1 = pts[i + 1];
    const h = dx[i];
    const cp1x = p0.x + h / 3;
    const cp1y = p0.y + (m[i] * h) / 3;
    const cp2x = p1.x - h / 3;
    const cp2y = p1.y - (m[i + 1] * h) / 3;
    d += ` C ${cp1x.toFixed(2)} ${cp1y.toFixed(2)}, ${cp2x.toFixed(2)} ${cp2y.toFixed(2)}, ${p1.x.toFixed(2)} ${p1.y.toFixed(2)}`;
  }
  return d;
}

const RANGE_OPTIONS = [
  { label: "Today", days: 1 },
  { label: "7D", days: 7 },
  { label: "30D", days: 30 },
  { label: "90D", days: 90 },
  { label: "1Y", days: 365 },
  { label: "All", days: 9999 },
];

// Rich curated vibrant color palette ensuring zero duplicate colors across series
const VIBRANT_COLOR_PALETTE = [
  "#10b981", // Emerald Green
  "#3b82f6", // Royal Blue
  "#f59e0b", // Amber Gold
  "#ec4899", // Deep Pink
  "#8b5cf6", // Bright Purple
  "#06b6d4", // Cyan
  "#f97316", // Bright Orange
  "#ef4444", // Crimson Red
  "#14b8a6", // Teal
  "#6366f1", // Indigo
  "#a855f7", // Violet
  "#d97706", // Dark Amber
  "#0284c7", // Sky Blue
  "#e11d48", // Rose Red
  "#059669", // Dark Emerald
  "#7c3aed", // Dark Violet
  "#ca8a04", // Mustard
  "#2563eb", // Intense Blue
  "#db2777", // Magenta
  "#0891b2", // Dark Cyan
  "#ea580c", // Deep Orange
  "#dc2626", // Red
  "#0d9488", // Dark Teal
  "#4f46e5", // Dark Indigo
];

function getUniqueSeriesColor(index: number): string {
  if (index < VIBRANT_COLOR_PALETTE.length) {
    return VIBRANT_COLOR_PALETTE[index];
  }
  // Fallback to Golden Ratio HSL for unlimited non-repeating colors
  const hue = (index * 137.508) % 360;
  const lightness = 42 + (index % 4) * 5;
  return `hsl(${hue.toFixed(1)}, 82%, ${lightness}%)`;
}

function getRankBadgeBg(rank: number): { bg: string; color: string } {
  if (rank <= 10) return { bg: "#ecfdf5", color: "#047857" };
  if (rank <= 30) return { bg: "#eff6ff", color: "#1d4ed8" };
  if (rank <= 67) return { bg: "#fffbeb", color: "#b45309" };
  return { bg: "#fef2f2", color: "#b91c1c" };
}

function getSummaryHeaders(daysRange: number) {
  switch (daysRange) {
    case 1:
      return {
        startHeader: "Yesterday Rank",
        endHeader: "Today Rank",
        changeHeader: "24H Change (Δ)",
      };
    case 7:
      return {
        startHeader: "7D Start Rank",
        endHeader: "Current Rank",
        changeHeader: "7D Change (Δ)",
      };
    case 30:
      return {
        startHeader: "30D Start Rank",
        endHeader: "Current Rank",
        changeHeader: "30D Change (Δ)",
      };
    case 90:
      return {
        startHeader: "90D Start Rank",
        endHeader: "Current Rank",
        changeHeader: "90D Change (Δ)",
      };
    case 365:
      return {
        startHeader: "1Y Start Rank",
        endHeader: "Current Rank",
        changeHeader: "1Y Change (Δ)",
      };
    case 9999:
    default:
      return {
        startHeader: "Initial Rank",
        endHeader: "Current Rank",
        changeHeader: "All-Time Change (Δ)",
      };
  }
}

export default function RankChart({
  historyData,
  selectedKeywords,
  daysRange,
  onRangeChange,
  keywords: _keywords,
  isLoadingHistory,
  onManageKeywords,
}: RankChartProps) {
  const [hoveredLabel, setHoveredLabel] = useState<string | null>(null);
  const [pinnedLabels, setPinnedLabels] = useState<string[]>([]);
  const [hoveredPoint, setHoveredPoint] = useState<{
    x: number;
    y: number;
    date: number;
    keyword: string;
    rank: number;
    color: string;
  } | null>(null);

  const [zoomDomain, setZoomDomain] = useState<{ min: number; max: number } | null>(null);
  const [isPanning, setIsPanning] = useState(false);
  const svgRef = useRef<SVGSVGElement>(null);
  const panStart = useRef<{ x: number; min: number; max: number } | null>(null);

  const W = 900;
  const H = 280;
  const PAD = { top: 24, right: 20, bottom: 40, left: 52 };
  const chartW = W - PAD.left - PAD.right;
  const chartH = H - PAD.top - PAD.bottom;

  // Build chart series with strictly non-repeating colors
  const series = useMemo(() => {
    if (!historyData || historyData.length === 0) return [];
    const sList: Array<{
      keywordId: number;
      label: string;
      records: any[];
      colorIdx: number;
      isCompetitor: boolean;
      compName?: string;
      latestRank: number;
      firstRank: number;
      bestRank: number;
      rankChange: number;
      color: string;
    }> = [];

    let seriesCounter = 0;

    historyData
      .filter((kh) => selectedKeywords.includes(kh.keyword.id))
      .forEach((kh) => {
        // Main App Line
        const primarySorted = [...kh.history]
          .filter((r) => r.rank !== null)
          .sort((a, b) => new Date(a.tracked_date).getTime() - new Date(b.tracked_date).getTime());

        if (primarySorted.length > 0) {
          const firstRank = primarySorted[0].rank!;
          const latestRank = primarySorted[primarySorted.length - 1].rank!;
          const bestRank = Math.min(...primarySorted.map((r) => r.rank!));

          const color = getUniqueSeriesColor(seriesCounter);
          const colorIdx = seriesCounter;
          seriesCounter++;

          sList.push({
            keywordId: kh.keyword.id,
            label: kh.keyword.name,
            records: primarySorted,
            colorIdx,
            isCompetitor: false,
            latestRank,
            firstRank,
            bestRank,
            rankChange: firstRank - latestRank,
            color,
          });
        }

        // Competitor Lines
        if (kh.competitors) {
          kh.competitors.forEach((comp) => {
            const compSorted = [...comp.history]
              .filter((r) => r.rank !== null)
              .sort((a, b) => new Date(a.tracked_date).getTime() - new Date(b.tracked_date).getTime());

            if (compSorted.length > 0) {
              const firstRank = compSorted[0].rank!;
              const latestRank = compSorted[compSorted.length - 1].rank!;
              const bestRank = Math.min(...compSorted.map((r) => r.rank!));

              const color = getUniqueSeriesColor(seriesCounter);
              const colorIdx = seriesCounter;
              seriesCounter++;

              sList.push({
                keywordId: kh.keyword.id,
                label: `${kh.keyword.name} (${comp.name})`,
                records: compSorted,
                colorIdx,
                isCompetitor: true,
                compName: comp.name,
                latestRank,
                firstRank,
                bestRank,
                rankChange: firstRank - latestRank,
                color,
              });
            }
          });
        }
      });

    return sList;
  }, [historyData, selectedKeywords]);

  const [searchQuery, setSearchQuery] = useState("");
  const [positionFilter, setPositionFilter] = useState<"ALL" | "IMPROVED" | "DROPPED" | "STABLE" | "MOVERS">("ALL");
  const [rankBracketFilter, setRankBracketFilter] = useState<"ALL" | "TOP10" | "TOP30" | "OUTSIDE30">("ALL");
  const [appTypeFilter, setAppTypeFilter] = useState<"ALL" | "YOUR_APP" | "COMPETITOR">("ALL");
  const [sortBy, setSortBy] = useState<"BIGGEST_GAINERS" | "BIGGEST_DROPS" | "BEST_RANK" | "WORST_RANK" | "NAME">("BIGGEST_GAINERS");

  const movementCounts = useMemo(() => {
    let improved = 0;
    let dropped = 0;
    let stable = 0;
    series.forEach((s) => {
      if (s.rankChange > 0) improved++;
      else if (s.rankChange < 0) dropped++;
      else stable++;
    });
    return {
      total: series.length,
      improved,
      dropped,
      stable,
      movers: improved + dropped,
    };
  }, [series]);

  const filteredSeries = useMemo(() => {
    let result = [...series];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter((s) => s.label.toLowerCase().includes(q));
    }

    if (appTypeFilter === "YOUR_APP") {
      result = result.filter((s) => !s.isCompetitor);
    } else if (appTypeFilter === "COMPETITOR") {
      result = result.filter((s) => s.isCompetitor);
    }

    if (positionFilter === "IMPROVED") {
      result = result.filter((s) => s.rankChange > 0);
    } else if (positionFilter === "DROPPED") {
      result = result.filter((s) => s.rankChange < 0);
    } else if (positionFilter === "STABLE") {
      result = result.filter((s) => s.rankChange === 0);
    } else if (positionFilter === "MOVERS") {
      result = result.filter((s) => s.rankChange !== 0);
    }

    if (rankBracketFilter === "TOP10") {
      result = result.filter((s) => s.latestRank <= 10);
    } else if (rankBracketFilter === "TOP30") {
      result = result.filter((s) => s.latestRank <= 30);
    } else if (rankBracketFilter === "OUTSIDE30") {
      result = result.filter((s) => s.latestRank > 30);
    }

    result.sort((a, b) => {
      if (sortBy === "BIGGEST_GAINERS") {
        return b.rankChange - a.rankChange;
      }
      if (sortBy === "BIGGEST_DROPS") {
        return a.rankChange - b.rankChange;
      }
      if (sortBy === "BEST_RANK") {
        return a.latestRank - b.latestRank;
      }
      if (sortBy === "WORST_RANK") {
        return b.latestRank - a.latestRank;
      }
      if (sortBy === "NAME") {
        return a.label.localeCompare(b.label);
      }
      return 0;
    });

    return result;
  }, [series, searchQuery, appTypeFilter, positionFilter, rankBracketFilter, sortBy]);

  const activeSeries = filteredSeries.length > 0 ? filteredSeries : series;

  const { minDate, maxDate, minRank, maxRank, yTicks } = useMemo(() => {
    let minDate = Infinity;
    let maxDate = -Infinity;
    let minRank = Infinity;
    let maxRank = -Infinity;
    activeSeries.forEach((s) =>
      s.records.forEach((r) => {
        const t = new Date(r.tracked_date).getTime();
        if (t < minDate) minDate = t;
        if (t > maxDate) maxDate = t;
        if (r.rank! < minRank) minRank = r.rank!;
        if (r.rank! > maxRank) maxRank = r.rank!;
      })
    );
    if (!isFinite(minDate)) {
      return { minDate: 0, maxDate: 1, minRank: 1, maxRank: 100, yTicks: [1, 10, 25, 50, 100] };
    }
    const rankPad = Math.max(2, Math.ceil((maxRank - minRank) * 0.15));
    const rMin = Math.max(1, minRank - rankPad);
    const rMax = maxRank + rankPad;
    
    // Pick clean yTicks
    const step = Math.max(1, Math.ceil((rMax - rMin) / 5));
    const yTicksArr: number[] = [];
    for (let v = rMin; v <= rMax; v += step) yTicksArr.push(v);
    if (!yTicksArr.includes(rMin)) yTicksArr.unshift(rMin);
    return { minDate, maxDate, minRank: rMin, maxRank: rMax, yTicks: yTicksArr };
  }, [activeSeries]);

  useEffect(() => {
    setZoomDomain(null);
  }, [daysRange, historyData]);

  const displayMinDate = zoomDomain ? zoomDomain.min : minDate;
  const displayMaxDate = zoomDomain ? zoomDomain.max : maxDate;

  const xTicks = useMemo(() => {
    if (!isFinite(displayMinDate) || !isFinite(displayMaxDate)) return [];
    const totalMs = displayMaxDate - displayMinDate;
    const xCount = Math.min(6, series[0]?.records.length ?? 1);
    const xStep = xCount > 1 ? totalMs / (xCount - 1) : 0;
    return Array.from({ length: xCount }, (_, i) => displayMinDate + i * xStep);
  }, [displayMinDate, displayMaxDate, series]);

  function toX(timestamp: number) {
    const range = displayMaxDate - displayMinDate || 1;
    return PAD.left + ((timestamp - displayMinDate) / range) * chartW;
  }

  // Power scale to spread top positions (#1–#15) and compress lower positions (#50+)
  function toY(rank: number) {
    const minVal = Math.sqrt(minRank - 0.5);
    const maxVal = Math.sqrt(maxRank);
    const curVal = Math.sqrt(rank);
    const ratio = (curVal - minVal) / (maxVal - minVal || 1);
    return PAD.top + ratio * chartH;
  }

  const bottomY = PAD.top + chartH;
  const formatDate = (ts: number) => {
    const d = new Date(ts);
    if (daysRange === 1) {
      return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
    }
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };
  const isEmpty = series.length === 0;

  // Zooming & Panning logic
  useEffect(() => {
    const svgEl = svgRef.current;
    if (!svgEl) return;

    function handleWheel(e: WheelEvent) {
      if (isEmpty) return;
      e.preventDefault();
      const rect = svgEl!.getBoundingClientRect();
      const cursorXRatio = (e.clientX - rect.left) / rect.width;
      const svgX = cursorXRatio * W;

      const curMin = zoomDomain ? zoomDomain.min : minDate;
      const curMax = zoomDomain ? zoomDomain.max : maxDate;
      const curRange = curMax - curMin || 1;

      const t = curMin + ((svgX - PAD.left) / chartW) * curRange;
      const zoomFactor = e.deltaY < 0 ? 0.85 : 1 / 0.85;
      let newRange = curRange * zoomFactor;

      const fullRange = maxDate - minDate || 1;
      const minAllowedRange = fullRange * 0.02;
      newRange = Math.min(fullRange, Math.max(minAllowedRange, newRange));

      const ratio = (t - curMin) / curRange;
      let newMin = t - ratio * newRange;
      let newMax = newMin + newRange;

      if (newMin < minDate) {
        newMin = minDate;
        newMax = newMin + newRange;
      }
      if (newMax > maxDate) {
        newMax = maxDate;
        newMin = newMax - newRange;
      }

      if (newRange >= fullRange - 1) {
        setZoomDomain(null);
      } else {
        setZoomDomain({ min: newMin, max: newMax });
      }
    }

    svgEl.addEventListener("wheel", handleWheel, { passive: false });
    return () => svgEl.removeEventListener("wheel", handleWheel);
  }, [zoomDomain, minDate, maxDate, chartW, isEmpty]);

  function handlePointerDown(e: React.PointerEvent<SVGSVGElement>) {
    if (!zoomDomain) return;
    setIsPanning(true);
    panStart.current = { x: e.clientX, min: zoomDomain.min, max: zoomDomain.max };
    (e.target as Element).setPointerCapture(e.pointerId);
  }

  function handlePointerMove(e: React.PointerEvent<SVGSVGElement>) {
    if (!isPanning || !panStart.current || !svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const dxPixels = e.clientX - panStart.current.x;
    const dxRatio = dxPixels / rect.width;
    const range = panStart.current.max - panStart.current.min;
    const dt = -dxRatio * (W / chartW) * range;

    let newMin = panStart.current.min + dt;
    let newMax = panStart.current.max + dt;
    if (newMin < minDate) {
      newMin = minDate;
      newMax = newMin + range;
    }
    if (newMax > maxDate) {
      newMax = maxDate;
      newMin = newMax - range;
    }

    setZoomDomain({ min: newMin, max: newMax });
  }

  function handlePointerUp() {
    setIsPanning(false);
    panStart.current = null;
  }

  const togglePinLabel = (label: string) => {
    setPinnedLabels((prev) =>
      prev.includes(label) ? prev.filter((l) => l !== label) : [...prev, label]
    );
  };

  const handleClearSelection = () => {
    setPinnedLabels([]);
    setHoveredLabel(null);
  };

  const hasActiveSelection = pinnedLabels.length > 0 || hoveredLabel !== null;
  const headers = getSummaryHeaders(daysRange);

  return (
    <Paper
      elevation={0}
      sx={{
        borderRadius: "14px",
        border: "1px solid #e2e8f0",
        overflow: "hidden",
        mb: 3,
        bgcolor: "#ffffff",
        boxShadow: "0 4px 20px rgba(0,0,0,0.03)",
      }}
    >
      {/* ── Section Header ── */}
      <Box
        sx={{
          px: 3,
          py: 2,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 2,
          borderBottom: "1px solid #f1f5f9",
          bgcolor: "#f8fafc",
        }}
      >
        <Box>
          <Typography sx={{ fontWeight: 800, fontSize: 16, color: "#0f172a", lineHeight: 1.2 }}>
            Keyword Position Trends
          </Typography>
          <Typography sx={{ fontSize: 12, color: "#64748b", mt: 0.5 }}>
            Hover or click lines to highlight. Scroll to zoom timeline.
          </Typography>
        </Box>

        {/* Controls */}
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, flexWrap: "wrap" }}>
          {zoomDomain && (
            <Button
              size="small"
              onClick={() => setZoomDomain(null)}
              sx={{
                textTransform: "none",
                fontSize: 12,
                fontWeight: 600,
                color: "#64748b",
                p: 0,
                minWidth: 0,
                "&:hover": { color: "#0f172a", bgcolor: "transparent" },
              }}
            >
              Reset zoom
            </Button>
          )}

          <ToggleButtonGroup
            value={daysRange}
            exclusive
            onChange={(_, v) => v && onRangeChange(v)}
            size="small"
            sx={{
              height: 32,
              bgcolor: "#ffffff",
              "& .MuiToggleButton-root": {
                border: "1px solid #e2e8f0",
                fontSize: 12,
                fontWeight: 600,
                color: "#64748b",
                px: 1.5,
                textTransform: "none",
                "&.Mui-selected": {
                  bgcolor: "#f1f5f9",
                  color: "#0f172a",
                  fontWeight: 700,
                  borderColor: "#cbd5e1",
                },
              },
            }}
          >
            {RANGE_OPTIONS.map((r) => (
              <ToggleButton key={r.days} value={r.days}>
                {r.label}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>

          <Button
            size="small"
            variant="outlined"
            onClick={onManageKeywords}
            startIcon={<AddIcon sx={{ fontSize: 15, color: "#0284c7" }} />}
            sx={{
              height: 32,
              borderRadius: "6px",
              bgcolor: "#f0f9ff",
              borderColor: "#bae6fd",
              color: "#0369a1",
              textTransform: "none",
              fontWeight: 600,
              fontSize: 12,
              px: 1.5,
              boxShadow: "none",
              "&:hover": {
                bgcolor: "#e0f2fe",
                borderColor: "#7dd3fc",
                boxShadow: "none",
              },
            }}
          >
            Manage Keywords
          </Button>
        </Box>
      </Box>

      {/* ── Main Chart SVG Area ── */}
      <Box sx={{ px: 1, pt: 1, pb: 0.5, position: "relative" }}>
        {isLoadingHistory && (
          <Box
            sx={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              bgcolor: "rgba(255,255,255,0.8)",
              zIndex: 2,
            }}
          >
            <CircularProgress size={26} sx={{ color: "#0f172a" }} />
          </Box>
        )}
        {filteredSeries.length === 0 && !isLoadingHistory ? (
          <Box sx={{ height: H, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 1 }}>
            <Typography sx={{ color: "#475569", fontSize: 14, fontWeight: 700 }}>
              No keywords match the selected filter criteria
            </Typography>
            <Typography sx={{ color: "#94a3b8", fontSize: 12 }}>
              Try selecting "All" or resetting search & position filters below.
            </Typography>
          </Box>
        ) : (
          <Box sx={{ overflowX: "auto" }}>
            <svg
              ref={svgRef}
              viewBox={`0 0 ${W} ${H}`}
              width="100%"
              style={{
                display: "block",
                touchAction: "none",
                cursor: zoomDomain ? (isPanning ? "grabbing" : "grab") : "default",
              }}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerLeave={handlePointerUp}
            >
              <defs>
                <clipPath id="plotAreaClip">
                  <rect x={PAD.left} y={PAD.top} width={chartW} height={chartH} />
                </clipPath>

                {/* Glow filter for highlighted lines */}
                <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="2" result="blur" />
                  <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>
              </defs>

              {/* Y grid lines + labels */}
              {yTicks.map((tick) => {
                const y = toY(tick);
                return (
                  <g key={tick}>
                    <line
                      x1={PAD.left}
                      y1={y}
                      x2={W - PAD.right}
                      y2={y}
                      stroke="#f1f5f9"
                      strokeWidth={1}
                      strokeDasharray="4 3"
                    />
                    <text x={PAD.left - 8} y={y + 4} textAnchor="end" fontSize={10.5} fontWeight={600} fill="#94a3b8">
                      #{tick}
                    </text>
                  </g>
                );
              })}

              {/* X axis date labels */}
              {xTicks.map((ts) => {
                const x = toX(ts);
                return (
                  <text key={ts} x={x} y={H - 6} textAnchor="middle" fontSize={10.5} fontWeight={600} fill="#94a3b8">
                    {formatDate(ts)}
                  </text>
                );
              })}

              {/* Y axis label */}
              <text
                transform={`translate(12, ${PAD.top + chartH / 2}) rotate(-90)`}
                textAnchor="middle"
                fontSize={10.5}
                fontWeight={700}
                fill="#64748b"
              >
                Rank Position
              </text>

              {/* ── Chart Lines Layer ── */}
              <g clipPath="url(#plotAreaClip)">
                {filteredSeries.map((s) => {
                  const isHovered = hoveredLabel === s.label;
                  const isPinned = pinnedLabels.includes(s.label);
                  const isHighlighted = isHovered || isPinned;

                  let opacity = 0.65;
                  let strokeWidth = 1.8;
                  let strokeColor = s.color;

                  if (hasActiveSelection) {
                    if (isHighlighted) {
                      opacity = 1;
                      strokeWidth = 2.8;
                    } else {
                      opacity = 0.15;
                      strokeWidth = 1.2;
                      strokeColor = "#cbd5e1";
                    }
                  }

                  const pts = s.records.map((r) => ({
                    x: toX(new Date(r.tracked_date).getTime()),
                    y: toY(r.rank!),
                  }));

                  return (
                    <path
                      key={`line-${s.label}`}
                      d={buildSmoothPath(pts)}
                      fill="none"
                      stroke={strokeColor}
                      strokeWidth={strokeWidth}
                      strokeDasharray={s.isCompetitor ? "4 3" : undefined}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      opacity={opacity}
                      filter={isHighlighted ? "url(#glow)" : undefined}
                      style={{ transition: "all 0.2s ease", cursor: "pointer" }}
                      onMouseEnter={() => setHoveredLabel(s.label)}
                      onMouseLeave={() => setHoveredLabel(null)}
                      onClick={() => togglePinLabel(s.label)}
                    />
                  );
                })}
              </g>

              {/* Hover crosshair */}
              {hoveredPoint && (
                <g clipPath="url(#plotAreaClip)">
                  <line
                    x1={hoveredPoint.x}
                    y1={PAD.top}
                    x2={hoveredPoint.x}
                    y2={bottomY}
                    stroke="#cbd5e1"
                    strokeWidth={1}
                    strokeDasharray="3 3"
                  />
                </g>
              )}

              {/* ── Selective Dot Markers Layer (Noise-Reduced) ── */}
              <g clipPath="url(#plotAreaClip)">
                {filteredSeries.map((s) => {
                  const isHovered = hoveredLabel === s.label;
                  const isPinned = pinnedLabels.includes(s.label);
                  const isHighlighted = isHovered || isPinned;

                  // Render dots ONLY when line is highlighted or hovered
                  if (hasActiveSelection && !isHighlighted) return null;

                  return s.records.map((r) => {
                    const cx = toX(new Date(r.tracked_date).getTime());
                    const cy = toY(r.rank!);
                    return (
                      <g key={`dot-${s.label}-${r.id}`}>
                        {isHighlighted && (
                          <circle
                            cx={cx}
                            cy={cy}
                            r={3.5}
                            fill="#ffffff"
                            stroke={s.color}
                            strokeWidth={2}
                            pointerEvents="none"
                          />
                        )}
                        <circle
                          cx={cx}
                          cy={cy}
                          r={9}
                          fill="transparent"
                          style={{ cursor: "pointer" }}
                          onMouseEnter={() => {
                            setHoveredLabel(s.label);
                            setHoveredPoint({
                              x: cx,
                              y: cy,
                              date: new Date(r.tracked_date).getTime(),
                              keyword: s.label,
                              rank: r.rank!,
                              color: s.color,
                            });
                          }}
                          onMouseLeave={() => {
                            setHoveredLabel(null);
                            setHoveredPoint(null);
                          }}
                          onClick={() => togglePinLabel(s.label)}
                        />
                      </g>
                    );
                  });
                })}
              </g>

              {/* ── Hover Tooltip ── */}
              {hoveredPoint && (() => {
                const maxLabelLen = 24;
                const label =
                  hoveredPoint.keyword.length > maxLabelLen
                    ? hoveredPoint.keyword.slice(0, maxLabelLen - 1) + "…"
                    : hoveredPoint.keyword;
                const dateLine =
                  daysRange === 1
                    ? `${new Date(hoveredPoint.date).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })} · Rank #${hoveredPoint.rank}`
                    : `${formatDate(hoveredPoint.date)} · Rank #${hoveredPoint.rank}`;
                const estWidth = Math.max(label.length * 6.5, dateLine.length * 5.8) + 22;
                const tw = Math.min(Math.max(estWidth, 110), 230);
                const th = 48;
                const tx = hoveredPoint.x + tw + 12 > W ? hoveredPoint.x - tw - 10 : hoveredPoint.x + 10;
                const ty = Math.max(PAD.top, Math.min(hoveredPoint.y - th / 2, bottomY - th));

                return (
                  <g pointerEvents="none">
                    <circle cx={hoveredPoint.x} cy={hoveredPoint.y} r={6} fill={hoveredPoint.color} stroke="#fff" strokeWidth={2.5} />
                    <rect x={tx} y={ty} width={tw} height={th} rx={7} fill="#0f172a" opacity={0.95} style={{ filter: "drop-shadow(0 4px 12px rgba(0,0,0,0.15))" }} />
                    <text x={tx + 10} y={ty + 19} fontSize={11.5} fontWeight={700} fill="#ffffff">
                      {label}
                    </text>
                    <text x={tx + 10} y={ty + 34} fontSize={10.5} fontWeight={500} fill="#cbd5e1">
                      {dateLine}
                    </text>
                  </g>
                );
              })()}
            </svg>
          </Box>
        )}
      </Box>

      {/* ── Interactive Legend & Filter Bar ── */}
      {series.length > 0 && (
        <Box sx={{ borderTop: "1px solid #f1f5f9", bgcolor: "#f8fafc", px: 2.5, py: 2 }}>
          {/* Row 1: Search & Position Shift Chips */}
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1.75, flexWrap: "wrap", gap: 1.5 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, flexWrap: "wrap" }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <FilterListIcon sx={{ fontSize: 16, color: "#475569" }} />
                <Typography sx={{ fontSize: 12, fontWeight: 800, color: "#0f172a", textTransform: "uppercase", letterSpacing: 0.5 }}>
                  Filter Position Changes
                </Typography>
              </Box>

              {/* Keyword Search Input */}
              <TextField
                size="small"
                placeholder="Search keywords..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                slotProps={{
                  input: {
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchIcon sx={{ fontSize: 15, color: "#94a3b8" }} />
                      </InputAdornment>
                    ),
                    endAdornment: searchQuery ? (
                      <InputAdornment position="end">
                        <IconButton size="small" onClick={() => setSearchQuery("")} sx={{ p: 0.2 }}>
                          <CloseIcon sx={{ fontSize: 13, color: "#64748b" }} />
                        </IconButton>
                      </InputAdornment>
                    ) : null,
                  },
                }}
                sx={{
                  width: { xs: "100%", sm: 200 },
                  "& .MuiOutlinedInput-root": {
                    height: 30,
                    fontSize: 12,
                    bgcolor: "#ffffff",
                    borderRadius: "8px",
                    px: 1,
                    "& fieldset": { borderColor: "#cbd5e1" },
                    "&:hover fieldset": { borderColor: "#94a3b8" },
                    "&.Mui-focused fieldset": { borderColor: "#3b82f6" },
                  },
                }}
              />
            </Box>

            {/* Position Change Filter Pills */}
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75 }}>
              <Chip
                label={`All (${movementCounts.total})`}
                size="small"
                onClick={() => setPositionFilter("ALL")}
                sx={{
                  fontSize: 11.5,
                  fontWeight: 700,
                  height: 26,
                  px: 0.5,
                  bgcolor: positionFilter === "ALL" ? "#0f172a" : "#ffffff",
                  color: positionFilter === "ALL" ? "#ffffff" : "#475569",
                  border: "1px solid #cbd5e1",
                  cursor: "pointer",
                  "&:hover": { bgcolor: positionFilter === "ALL" ? "#1e293b" : "#f1f5f9" },
                }}
              />
              <Chip
                label={`🟢 Rank Gainers (${movementCounts.improved})`}
                size="small"
                onClick={() => setPositionFilter("IMPROVED")}
                sx={{
                  fontSize: 11.5,
                  fontWeight: 700,
                  height: 26,
                  px: 0.5,
                  bgcolor: positionFilter === "IMPROVED" ? "#059669" : "#ecfdf5",
                  color: positionFilter === "IMPROVED" ? "#ffffff" : "#047857",
                  border: "1px solid #a7f3d0",
                  cursor: "pointer",
                  "&:hover": { bgcolor: positionFilter === "IMPROVED" ? "#047857" : "#d1fae5" },
                }}
              />
              <Chip
                label={`🔴 Rank Drops (${movementCounts.dropped})`}
                size="small"
                onClick={() => setPositionFilter("DROPPED")}
                sx={{
                  fontSize: 11.5,
                  fontWeight: 700,
                  height: 26,
                  px: 0.5,
                  bgcolor: positionFilter === "DROPPED" ? "#dc2626" : "#fef2f2",
                  color: positionFilter === "DROPPED" ? "#ffffff" : "#b91c1c",
                  border: "1px solid #fca5a5",
                  cursor: "pointer",
                  "&:hover": { bgcolor: positionFilter === "DROPPED" ? "#b91c1c" : "#fee2e2" },
                }}
              />
              <Chip
                label={`⚪ Stable (${movementCounts.stable})`}
                size="small"
                onClick={() => setPositionFilter("STABLE")}
                sx={{
                  fontSize: 11.5,
                  fontWeight: 700,
                  height: 26,
                  px: 0.5,
                  bgcolor: positionFilter === "STABLE" ? "#475569" : "#f1f5f9",
                  color: positionFilter === "STABLE" ? "#ffffff" : "#475569",
                  border: "1px solid #cbd5e1",
                  cursor: "pointer",
                  "&:hover": { bgcolor: positionFilter === "STABLE" ? "#334155" : "#e2e8f0" },
                }}
              />
              <Chip
                label={`🔥 All Movers (${movementCounts.movers})`}
                size="small"
                onClick={() => setPositionFilter("MOVERS")}
                sx={{
                  fontSize: 11.5,
                  fontWeight: 700,
                  height: 26,
                  px: 0.5,
                  bgcolor: positionFilter === "MOVERS" ? "#2563eb" : "#eff6ff",
                  color: positionFilter === "MOVERS" ? "#ffffff" : "#1d4ed8",
                  border: "1px solid #bfdbfe",
                  cursor: "pointer",
                  "&:hover": { bgcolor: positionFilter === "MOVERS" ? "#1d4ed8" : "#dbeafe" },
                }}
              />
            </Box>
          </Box>

          {/* Row 2: App Filter, Rank Bracket, and Sorting Controls */}
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 1.5, pt: 1, borderTop: "1px solid #e2e8f0" }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, flexWrap: "wrap" }}>
              {/* App Filter Selector */}
              <FormControl size="small">
                <Select
                  value={appTypeFilter}
                  onChange={(e) => setAppTypeFilter(e.target.value as any)}
                  sx={{
                    height: 28,
                    fontSize: 11.5,
                    fontWeight: 700,
                    bgcolor: "#ffffff",
                    borderRadius: "6px",
                    "& .MuiOutlinedInput-notchedOutline": { borderColor: "#cbd5e1" },
                  }}
                >
                  <MenuItem value="ALL">All Apps & Competitors</MenuItem>
                  <MenuItem value="YOUR_APP">Your App Only</MenuItem>
                  <MenuItem value="COMPETITOR">Competitors Only</MenuItem>
                </Select>
              </FormControl>

              {/* Rank Bracket Selector */}
              <FormControl size="small">
                <Select
                  value={rankBracketFilter}
                  onChange={(e) => setRankBracketFilter(e.target.value as any)}
                  sx={{
                    height: 28,
                    fontSize: 11.5,
                    fontWeight: 700,
                    bgcolor: "#ffffff",
                    borderRadius: "6px",
                    "& .MuiOutlinedInput-notchedOutline": { borderColor: "#cbd5e1" },
                  }}
                >
                  <MenuItem value="ALL">All Rank Positions</MenuItem>
                  <MenuItem value="TOP10">Top 10 Ranks (#1–#10)</MenuItem>
                  <MenuItem value="TOP30">Top 30 Ranks (#1–#30)</MenuItem>
                  <MenuItem value="OUTSIDE30">Outside Top 30 (#31+)</MenuItem>
                </Select>
              </FormControl>
            </Box>

            {/* Sort Order Selector */}
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <Typography sx={{ fontSize: 11.5, fontWeight: 700, color: "#64748b" }}>
                Sort By:
              </Typography>
              <FormControl size="small">
                <Select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  sx={{
                    height: 28,
                    fontSize: 11.5,
                    fontWeight: 700,
                    bgcolor: "#ffffff",
                    borderRadius: "6px",
                    "& .MuiOutlinedInput-notchedOutline": { borderColor: "#cbd5e1" },
                  }}
                >
                  <MenuItem value="BIGGEST_GAINERS">Biggest Gainers (Rank ↑)</MenuItem>
                  <MenuItem value="BIGGEST_DROPS">Worst Drops (Rank ↓)</MenuItem>
                  <MenuItem value="BEST_RANK">Best Rank (#1 First)</MenuItem>
                  <MenuItem value="WORST_RANK">Worst Rank (#100 First)</MenuItem>
                  <MenuItem value="NAME">Keyword Name (A–Z)</MenuItem>
                </Select>
              </FormControl>

              {pinnedLabels.length > 0 && (
                <Chip
                  label="Clear Highlight Pin"
                  size="small"
                  onClick={handleClearSelection}
                  sx={{
                    fontSize: 11,
                    fontWeight: 700,
                    height: 26,
                    bgcolor: "#fef2f2",
                    color: "#b91c1c",
                    border: "1px solid #fca5a5",
                    cursor: "pointer",
                    ml: 1,
                  }}
                />
              )}
            </Box>
          </Box>

          {/* Scrollable Legend Pills */}
          <Box
            sx={{
              display: "flex",
              gap: 1,
              flexWrap: "wrap",
              maxHeight: 110,
              overflowY: "auto",
              pt: 1.25,
              mt: 1,
              borderTop: "1px stroke #f1f5f9",
              "&::-webkit-scrollbar": { width: 4, height: 4 },
              "&::-webkit-scrollbar-thumb": { bgcolor: "#cbd5e1", borderRadius: 4 },
            }}
          >
            {filteredSeries.length === 0 ? (
              <Typography sx={{ fontSize: 12, color: "#64748b", py: 0.5, fontStyle: "italic" }}>
                No keywords matching active filters or search query
              </Typography>
            ) : (
              filteredSeries.map((s) => {
                const isPinned = pinnedLabels.includes(s.label);
                const isHovered = hoveredLabel === s.label;
                const isHighlighted = isHovered || isPinned;

                return (
                  <Box
                    key={s.label}
                    onClick={() => togglePinLabel(s.label)}
                    onMouseEnter={() => setHoveredLabel(s.label)}
                    onMouseLeave={() => setHoveredLabel(null)}
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      gap: 0.75,
                      cursor: "pointer",
                      px: 1.25,
                      py: 0.4,
                      borderRadius: "6px",
                      bgcolor: isPinned ? "#ffffff" : isHovered ? "#ffffff" : "#ffffff",
                      border: `1px solid ${isHighlighted ? s.color : "#e2e8f0"}`,
                      boxShadow: isHighlighted ? `0 2px 8px ${s.color}33` : "none",
                      opacity: hasActiveSelection && !isHighlighted ? 0.45 : 1,
                      transition: "all 0.15s ease",
                      "&:hover": { borderColor: s.color, bgcolor: "#ffffff" },
                    }}
                  >
                    <Box
                      sx={{
                        width: 10,
                        height: 10,
                        borderRadius: "50%",
                        bgcolor: s.color,
                        flexShrink: 0,
                      }}
                    />
                    <Typography
                      sx={{
                        fontSize: 11.5,
                        fontWeight: isHighlighted ? 700 : 500,
                        color: isHighlighted ? "#0f172a" : "#475569",
                      }}
                    >
                      {s.label}
                    </Typography>
                    <Typography sx={{ fontSize: 10.5, fontWeight: 700, color: s.color, ml: 0.25 }}>
                      #{s.latestRank}
                    </Typography>
                    {isPinned && <PushPinIcon sx={{ fontSize: 11, color: s.color, ml: 0.25 }} />}
                  </Box>
                );
              })
            )}
          </Box>
        </Box>
      )}

      {/* ── Companion Keyword Sparkline & Rank Table ── */}
      {series.length > 0 && (
        <Box sx={{ borderTop: "1px solid #e2e8f0" }}>
          <Box sx={{ px: 3, py: 1.5, bgcolor: "#ffffff", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <Typography sx={{ fontSize: 13, fontWeight: 800, color: "#0f172a" }}>
              Keyword Performance Summary ({filteredSeries.length})
            </Typography>
            <Typography sx={{ fontSize: 11.5, color: "#64748b" }}>
              Hover rows to trace lines on chart above
            </Typography>
          </Box>

          <TableContainer sx={{ maxHeight: 220, overflowY: "auto" }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow sx={{ "& th": { bgcolor: "#f8fafc", color: "#475569", fontSize: 11.5, fontWeight: 700, py: 1 } }}>
                  <TableCell sx={{ pl: 3 }}>Keyword / Series</TableCell>
                  <TableCell align="center">{headers.startHeader}</TableCell>
                  <TableCell align="center">{headers.endHeader}</TableCell>
                  <TableCell align="center">{headers.changeHeader}</TableCell>
                  <TableCell align="center">Best Rank</TableCell>
                  <TableCell align="right" sx={{ pr: 3 }}>Highlight</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredSeries.map((s) => {
                  const isPinned = pinnedLabels.includes(s.label);
                  const isHovered = hoveredLabel === s.label;
                  const isHighlighted = isHovered || isPinned;
                  const startBadge = getRankBadgeBg(s.firstRank);
                  const badge = getRankBadgeBg(s.latestRank);

                  return (
                    <TableRow
                      key={`table-${s.label}`}
                      onMouseEnter={() => setHoveredLabel(s.label)}
                      onMouseLeave={() => setHoveredLabel(null)}
                      onClick={() => togglePinLabel(s.label)}
                      sx={{
                        cursor: "pointer",
                        bgcolor: isHighlighted ? "#f0f9ff" : "transparent",
                        transition: "bgcolor 0.15s ease",
                        "&:hover": { bgcolor: "#f8fafc" },
                        "& td": { borderBottom: "1px solid #f1f5f9", py: 1 },
                      }}
                    >
                      {/* Keyword Name */}
                      <TableCell sx={{ pl: 3 }}>
                        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                          <Box sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: s.color }} />
                          <Typography sx={{ fontSize: 12.5, fontWeight: isHighlighted ? 700 : 600, color: "#0f172a" }}>
                            {s.label}
                          </Typography>
                          {s.isCompetitor && (
                            <Chip
                              label="Competitor"
                              size="small"
                              sx={{ fontSize: 9.5, height: 16, bgcolor: "#f1f5f9", color: "#64748b", fontWeight: 700 }}
                            />
                          )}
                        </Box>
                      </TableCell>

                      {/* Start / Yesterday Rank */}
                      <TableCell align="center">
                        <Chip
                          label={`#${s.firstRank}`}
                          size="small"
                          sx={{
                            fontSize: 11,
                            fontWeight: 800,
                            height: 20,
                            bgcolor: startBadge.bg,
                            color: startBadge.color,
                          }}
                        />
                      </TableCell>

                      {/* Current / Today Rank */}
                      <TableCell align="center">
                        <Chip
                          label={`#${s.latestRank}`}
                          size="small"
                          sx={{
                            fontSize: 11,
                            fontWeight: 800,
                            height: 20,
                            bgcolor: badge.bg,
                            color: badge.color,
                          }}
                        />
                      </TableCell>

                      {/* Rank Change */}
                      <TableCell align="center">
                        {s.rankChange > 0 ? (
                          <Box sx={{ display: "inline-flex", alignItems: "center", color: "#059669", fontWeight: 700, fontSize: 11.5 }}>
                            <TrendingUpIcon sx={{ fontSize: 14, mr: 0.25 }} />
                            +{s.rankChange}
                          </Box>
                        ) : s.rankChange < 0 ? (
                          <Box sx={{ display: "inline-flex", alignItems: "center", color: "#dc2626", fontWeight: 700, fontSize: 11.5 }}>
                            <TrendingDownIcon sx={{ fontSize: 14, mr: 0.25 }} />
                            {s.rankChange}
                          </Box>
                        ) : (
                          <Box sx={{ display: "inline-flex", alignItems: "center", color: "#94a3b8", fontWeight: 600, fontSize: 11.5 }}>
                            <RemoveIcon sx={{ fontSize: 13, mr: 0.25 }} />
                            0
                          </Box>
                        )}
                      </TableCell>

                      {/* Best Rank */}
                      <TableCell align="center">
                        <Typography sx={{ fontSize: 12, fontWeight: 700, color: "#334155" }}>
                          #{s.bestRank}
                        </Typography>
                      </TableCell>

                      {/* Pin Button */}
                      <TableCell align="right" sx={{ pr: 3 }}>
                        <IconButton
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation();
                            togglePinLabel(s.label);
                          }}
                          sx={{ color: isPinned ? s.color : "#cbd5e1" }}
                        >
                          {isPinned ? <PushPinIcon sx={{ fontSize: 15 }} /> : <PushPinOutlinedIcon sx={{ fontSize: 15 }} />}
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      )}
    </Paper>
  );
}