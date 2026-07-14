// React
import { useMemo, useRef, useState, useEffect } from "react";

// Material UI
import { Box, Button, CircularProgress, Paper, ToggleButton, ToggleButtonGroup, Typography } from "@mui/material";

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

// Smooth bezier curve path
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
  { label: "7D", days: 7 },
  { label: "30D", days: 30 },
  { label: "90D", days: 90 },
  { label: "1Y", days: 365 },
  { label: "All", days: 9999 },
];

const LINE_COLORS = [
  "#f59e0b", "#14b8a6", "#ca8a04", "#3b82f6",
  "#7c3aed", "#ec4899", "#10b981", "#ef4444",
];

export default function RankChart({
  historyData,
  selectedKeywords,
  // onToggleKeyword,
  daysRange,
  onRangeChange,
  keywords,
  isLoadingHistory,
  onManageKeywords,
}: RankChartProps) {
  const [hovered, setHovered] = useState<{
    x: number;
    y: number;
    date: number;
    keyword: string;
    rank: number;
    color: string;
  } | null>(null);
  const [hiddenKeywords, setHiddenKeywords] = useState<number[]>([]);

  const [zoomDomain, setZoomDomain] = useState<{ min: number; max: number } | null>(null);
  const [isPanning, setIsPanning] = useState(false);
  const svgRef = useRef<SVGSVGElement>(null);
  const panStart = useRef<{ x: number; min: number; max: number } | null>(null);

  const toggleHiddenKeyword = (id: number) => {
    setHiddenKeywords((prev) =>
      prev.includes(id) ? prev.filter((k) => k !== id) : [...prev, id]
    );
  };

  const W = 900;
  const H = 260;
  const PAD = { top: 24, right: 20, bottom: 40, left: 52 };
  const chartW = W - PAD.left - PAD.right;
  const chartH = H - PAD.top - PAD.bottom;

  // Map keyword id -> color index
  const kwColorIndex = useMemo(() => {
    const m: Record<number, number> = {};
    keywords.forEach((k, i) => { m[k.id] = i; });
    return m;
  }, [keywords]);

  // Build chart series
  const series = useMemo(() => {
    if (!historyData || historyData.length === 0) return [];
    return historyData
      .filter((kh) => selectedKeywords.includes(kh.keyword.id))
      .map((kh) => {
        const sorted = [...kh.history]
          .filter((r) => r.rank !== null)
          .sort((a, b) => new Date(a.tracked_date).getTime() - new Date(b.tracked_date).getTime());
        return { keyword: kh.keyword, records: sorted, colorIdx: kwColorIndex[kh.keyword.id] ?? 0 };
      })
      .filter((s) => s.records.length > 0);
  }, [historyData, selectedKeywords, kwColorIndex]);

  const { minDate, maxDate, minRank, maxRank, yTicks } = useMemo(() => {
    let minDate = Infinity;
    let maxDate = -Infinity;
    let minRank = Infinity;
    let maxRank = -Infinity;
    series.forEach((s) =>
      s.records.forEach((r) => {
        const t = new Date(r.tracked_date).getTime();
        if (t < minDate) minDate = t;
        if (t > maxDate) maxDate = t;
        if (r.rank! < minRank) minRank = r.rank!;
        if (r.rank! > maxRank) maxRank = r.rank!;
      })
    );
    if (!isFinite(minDate)) {
      return { minDate: 0, maxDate: 1, minRank: 1, maxRank: 100, yTicks: [] as number[] };
    }
    const rankPad = Math.max(2, Math.ceil((maxRank - minRank) * 0.2));
    const rMin = Math.max(1, minRank - rankPad);
    const rMax = maxRank + rankPad;
    const yStep = Math.ceil((rMax - rMin) / 5);
    const yTicksArr: number[] = [];
    for (let v = rMin; v <= rMax; v += yStep) yTicksArr.push(v);
    return { minDate, maxDate, minRank: rMin, maxRank: rMax, yTicks: yTicksArr };
  }, [series]);

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
  function toY(rank: number) {
    const range = maxRank - minRank || 1;
    // Inverted: lower rank = higher on chart
    return PAD.top + ((rank - minRank) / range) * chartH;
  }

  const bottomY = PAD.top + chartH;
  const formatDate = (ts: number) =>
    new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const isEmpty = series.length === 0;

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

      if (newMin < minDate) { newMin = minDate; newMax = newMin + newRange; }
      if (newMax > maxDate) { newMax = maxDate; newMin = newMax - newRange; }

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
    if (newMin < minDate) { newMin = minDate; newMax = newMin + range; }
    if (newMax > maxDate) { newMax = maxDate; newMin = newMax - range; }

    setZoomDomain({ min: newMin, max: newMax });
  }

  function handlePointerUp() {
    setIsPanning(false);
    panStart.current = null;
  }

  return (
    <Paper
      elevation={0}
      sx={{
        borderRadius: "12px",
        border: "1px solid #e5e7eb",
        overflow: "hidden",
        mb: 3,
      }}
    >
      {/* Section header */}
      <Box sx={{ px: 3, pt: 2.5, pb: 1.5, display: "flex", alignItems: "flex-start", justifyContent: "space-between", borderBottom: "1px solid #f3f4f6" }}>
        <Box>
          <Typography sx={{ fontWeight: 600, fontSize: 15, color: "#111827", mb: 0.5 }}>
            Keyword position changes
          </Typography>
          <Typography sx={{ fontSize: 11.5, color: "#9ca3af", mt: 0.75 }}>
            You can view up to 10 search terms at a time. Scroll to zoom, drag to pan.
          </Typography>
        </Box>
        {/* Right side: Manage link + range toggle + reset zoom */}
        <Box sx={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 1.5 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
            {zoomDomain && (
              <Button
                size="small"
                onClick={() => setZoomDomain(null)}
                sx={{
                  textTransform: "none",
                  fontSize: 12,
                  fontWeight: 600,
                  color: "#6b7280",
                  p: 0,
                  minWidth: 0,
                  "&:hover": { bgcolor: "transparent", textDecoration: "underline" },
                }}
              >
                Reset zoom
              </Button>
            )}
            <Button
              size="small"
              onClick={onManageKeywords}
              sx={{
                textTransform: "none",
                fontSize: 13,
                fontWeight: 600,
                color: "#f97316",
                p: 0,
                minWidth: 0,
                "&:hover": { bgcolor: "transparent", textDecoration: "underline" },
              }}
            >
              Manage keywords Delete and Add
            </Button>
          </Box>
          <ToggleButtonGroup
            value={daysRange}
            exclusive
            onChange={(_, v) => v && onRangeChange(v)}
            size="small"
            sx={{
              "& .MuiToggleButton-root": {
                border: "1px solid #e5e7eb",
                borderRadius: "6px !important",
                fontSize: 12,
                fontWeight: 500,
                color: "#6b7280",
                px: 1.25,
                py: 0.4,
                mx: 0.25,
                textTransform: "none",
                "&.Mui-selected": {
                  bgcolor: "#f3f4f6",
                  color: "#111827",
                  fontWeight: 600,
                  borderColor: "#d1d5db",
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
        </Box>
      </Box>

      {/* Chart area */}
      <Box sx={{ px: 1, pt: 1, pb: 0.5, position: "relative" }}>
        {isLoadingHistory && (
          <Box sx={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", bgcolor: "rgba(255,255,255,0.8)", zIndex: 2 }}>
            <CircularProgress size={24} sx={{ color: "#6366f1" }} />
          </Box>
        )}
        {isEmpty && !isLoadingHistory ? (
          <Box sx={{ height: H, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Typography sx={{ color: "#9ca3af", fontSize: 13 }}>
              No ranking data available for the selected period.
            </Typography>
          </Box>
        ) : (
          <Box sx={{ overflowX: "auto" }}>
            <svg
              ref={svgRef}
              viewBox={`0 0 ${W} ${H}`}
              width="100%"
              style={{ display: "block", touchAction: "none", cursor: zoomDomain ? (isPanning ? "grabbing" : "grab") : "default" }}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerLeave={handlePointerUp}
            >
              {/* Clip path for the plot area — keeps lines/dots from bleeding into axis labels when zoomed */}
              <defs>
                <clipPath id="plotAreaClip">
                  <rect x={PAD.left} y={PAD.top} width={chartW} height={chartH} />
                </clipPath>
              </defs>

              {/* Y grid lines + labels */}
              {yTicks.map((tick) => {
                const y = toY(tick);
                return (
                  <g key={tick}>
                    <line
                      x1={PAD.left} y1={y} x2={W - PAD.right} y2={y}
                      stroke="#f3f4f6" strokeWidth={1} strokeDasharray="4 3"
                    />
                    <text x={PAD.left - 8} y={y + 4} textAnchor="end" fontSize={10} fill="#9ca3af">
                      {tick}
                    </text>
                  </g>
                );
              })}

              {/* X axis date labels */}
              {xTicks.map((ts) => {
                const x = toX(ts);
                return (
                  <text key={ts} x={x} y={H - 6} textAnchor="middle" fontSize={10} fill="#9ca3af">
                    {formatDate(ts)}
                  </text>
                );
              })}

              {/* Y axis label */}
              <text
                transform={`translate(12, ${PAD.top + chartH / 2}) rotate(-90)`}
                textAnchor="middle" fontSize={10} fill="#9ca3af"
              >
                Search term position
              </text>

              {/* Lines — clipped to plot area */}
              <g clipPath="url(#plotAreaClip)">
                {series
                  .filter((s) => !hiddenKeywords.includes(s.keyword.id))
                  .map((s) => {
                    const color = LINE_COLORS[s.colorIdx % LINE_COLORS.length];
                    const pts = s.records.map((r) => ({
                      x: toX(new Date(r.tracked_date).getTime()),
                      y: toY(r.rank!),
                    }));
                    return (
                      <path
                        key={`line-${s.keyword.id}`}
                        d={buildSmoothPath(pts)}
                        fill="none"
                        stroke={color}
                        strokeWidth={2}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    );
                  })}
              </g>

              {/* Hover crosshair — clipped to plot area */}
              {hovered && (
                <g clipPath="url(#plotAreaClip)">
                  <line
                    x1={hovered.x} y1={PAD.top} x2={hovered.x} y2={bottomY}
                    stroke="#d1d5db" strokeWidth={1} strokeDasharray="3 3"
                  />
                </g>
              )}

              {/* Dot markers at data points — clipped to plot area */}
              <g clipPath="url(#plotAreaClip)">
                {series
                  .filter((s) => !hiddenKeywords.includes(s.keyword.id))
                  .map((s) => {
                    const color = LINE_COLORS[s.colorIdx % LINE_COLORS.length];
                    return s.records.map((r) => {
                      const cx = toX(new Date(r.tracked_date).getTime());
                      const cy = toY(r.rank!);
                      return (
                        <g key={`dot-${s.keyword.id}-${r.id}`}>
                          <circle
                            cx={cx} cy={cy} r={3}
                            fill="#fff" stroke={color} strokeWidth={1.5}
                            pointerEvents="none"
                          />
                          <circle
                            cx={cx} cy={cy} r={8}
                            fill="transparent"
                            style={{ cursor: "pointer" }}
                            onMouseEnter={() =>
                              setHovered({
                                x: cx,
                                y: cy,
                                date: new Date(r.tracked_date).getTime(),
                                keyword: s.keyword.name,
                                rank: r.rank!,
                                color,
                              })
                            }
                            onMouseLeave={() => setHovered(null)}
                          />
                        </g>
                      );
                    });
                  })}
              </g>

              {/* Tooltip — NOT clipped, so it can render even near the edge */}
              {hovered && (() => {
                const maxLabelLen = 22;
                const label =
                  hovered.keyword.length > maxLabelLen
                    ? hovered.keyword.slice(0, maxLabelLen - 1) + "…"
                    : hovered.keyword;
                const dateLine = `${formatDate(hovered.date)} · Rank #${hovered.rank}`;
                const estWidth = Math.max(label.length * 6.4, dateLine.length * 5.6) + 20;
                const tw = Math.min(Math.max(estWidth, 100), 220);
                const th = 46;
                const tx = hovered.x + tw + 12 > W ? hovered.x - tw - 10 : hovered.x + 10;
                const ty = Math.max(PAD.top, Math.min(hovered.y - th / 2, bottomY - th));
                return (
                  <g pointerEvents="none">
                    <circle cx={hovered.x} cy={hovered.y} r={5} fill={hovered.color} stroke="#fff" strokeWidth={2} />
                    <rect x={tx} y={ty} width={tw} height={th} rx={6} fill="#111827" opacity={0.95} />
                    <text x={tx + 10} y={ty + 18} fontSize={11} fontWeight={600} fill="#fff">
                      {label}
                    </text>
                    <text x={tx + 10} y={ty + 33} fontSize={10} fill="#d1d5db">
                      {dateLine}
                    </text>
                  </g>
                );
              })()}
            </svg>
          </Box>
        )}
      </Box>

      {/* Legend */}
      {series.length > 0 && (
        <Box sx={{ px: 3, pb: 2, display: "flex", gap: 2, flexWrap: "wrap", justifyContent: "center" }}>
          {series.map((s) => {
            const color = LINE_COLORS[s.colorIdx % LINE_COLORS.length];
            return (
              <Box
                key={s.keyword.id}
                onClick={() => toggleHiddenKeyword(s.keyword.id)}
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 0.75,
                  cursor: "pointer",
                  px: 1,
                  py: 0.5,
                  borderRadius: 1,
                  opacity: hiddenKeywords.includes(s.keyword.id) ? 0.35 : 1,
                  textDecoration: hiddenKeywords.includes(s.keyword.id) ? "line-through" : "none",
                  transition: "all .15s",
                  "&:hover": { bgcolor: "#f5f5f5" },
                }}
              >
                <Box sx={{ width: 24, height: 2, bgcolor: color, borderRadius: 1 }} />
                <Typography
                  sx={{
                    fontSize: 11.5,
                    color: hiddenKeywords.includes(s.keyword.id) ? "#9ca3af" : "#6b7280",
                    textDecoration: hiddenKeywords.includes(s.keyword.id) ? "line-through" : "none",
                  }}
                >
                  {s.keyword.name}
                </Typography>
              </Box>
            );
          })}
        </Box>
      )}
    </Paper>
  );
}