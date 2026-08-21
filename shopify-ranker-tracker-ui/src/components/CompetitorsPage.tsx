import { useEffect, useState } from "react";
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
  Paper,
  Typography,
  Select,
  MenuItem,
  FormControl,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import RemoveIcon from "@mui/icons-material/RemoveCircleOutlined";
import AddIcon from "@mui/icons-material/AddCircleOutlined";
import CheckIcon from "@mui/icons-material/CheckCircleOutlined";
import { api, type App } from "../api";

interface Competitor {
  id: number;
  name: string;
  url: string;
  rating?: number;
  reviews_count?: number;
  price_text?: string;
}

interface ActivityItem {
  id: string;
  app_name: string;
  is_competitor: boolean;
  type: "PRICE" | "LISTING" | "REVIEW" | "CATEGORY" | "LANGUAGE" | "TECHNICAL";
  text: string;
  date: string;
  has_details: boolean;
  details?: {
    title: string;
    subtitle: string;
    previous: string[];
    current: string[];
  };
}

interface CompetitorsPageProps {
  apps: App[];
  selectedApp: App;
  onSelectApp: (app: App) => void;
  showToast: (message: string, severity?: "success" | "error" | "info") => void;
}

interface DiffPart {
  type: "added" | "removed" | "equal";
  value: string;
}

function diffWords(prev: string, curr: string): DiffPart[] {
  const prevWords = prev.split(/(\s+)/);
  const currWords = curr.split(/(\s+)/);

  const dp: number[][] = Array(prevWords.length + 1)
    .fill(null)
    .map(() => Array(currWords.length + 1).fill(0));

  for (let i = 1; i <= prevWords.length; i++) {
    for (let j = 1; j <= currWords.length; j++) {
      if (prevWords[i - 1] === currWords[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  const result: DiffPart[] = [];
  let i = prevWords.length;
  let j = currWords.length;

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && prevWords[i - 1] === currWords[j - 1]) {
      result.unshift({ type: "equal", value: prevWords[i - 1] });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      result.unshift({ type: "added", value: currWords[j - 1] });
      j--;
    } else {
      result.unshift({ type: "removed", value: prevWords[i - 1] });
      i--;
    }
  }
  return result;
}

interface AlignedRow {
  prev: string | null;
  curr: string | null;
  isChanged: boolean;
}

function alignLists(prev: string[], curr: string[]): AlignedRow[] {
  if (prev.length === curr.length) {
    return prev.map((p, idx) => ({
      prev: p,
      curr: curr[idx],
      isChanged: p !== curr[idx]
    }));
  }

  const dp: number[][] = Array(prev.length + 1)
    .fill(null)
    .map(() => Array(curr.length + 1).fill(0));

  for (let i = 1; i <= prev.length; i++) {
    for (let j = 1; j <= curr.length; j++) {
      if (prev[i - 1] === curr[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  const rows: AlignedRow[] = [];
  let i = prev.length;
  let j = curr.length;

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && prev[i - 1] === curr[j - 1]) {
      rows.unshift({ prev: prev[i - 1], curr: curr[j - 1], isChanged: false });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      rows.unshift({ prev: null, curr: curr[j - 1], isChanged: true });
      j--;
    } else {
      rows.unshift({ prev: prev[i - 1], curr: null, isChanged: true });
      i--;
    }
  }
  return rows;
}

const TYPE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  PRICE: { bg: "#fff7ed", text: "#ea580c", border: "#ea580c" },
  LISTING: { bg: "#f0f9ff", text: "#0284c7", border: "#0284c7" },
  REVIEW: { bg: "#f0fdf4", text: "#16a34a", border: "#16a34a" },
  CATEGORY: { bg: "#ecfeff", text: "#0891b2", border: "#0891b2" },
  LANGUAGE: { bg: "#e0e7ff", text: "#4f46e5", border: "#4f46e5" },
  TECHNICAL: { bg: "#f1f5f9", text: "#475569", border: "#475569" },
};

export default function CompetitorsPage({ apps, selectedApp, onSelectApp, showToast }: CompetitorsPageProps) {
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Competitor H2H Selection State
  const [activeCompetitorId, setActiveCompetitorId] = useState<number | null>(null);
  const [headToHead, setHeadToHead] = useState<any>(null);
  const [isLoadingH2H, setIsLoadingH2H] = useState(false);
  const [activeTab, setActiveTab] = useState<"compare" | "activity">("compare");
  const [mainAppDetails, setMainAppDetails] = useState<any>(null);

  // Filters
  const [selectedType, setSelectedType] = useState<string>("ALL");
  const [selectedApps, setSelectedApps] = useState<string[]>(["ALL"]);

  // Details Modal
  const [activeDetails, setActiveDetails] = useState<ActivityItem | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    try {
      // 1. Fetch linked competitors
      const compData = await api.getCompetitors(selectedApp.id);
      setMainAppDetails(compData.main_app || null);
      
      // Map to list
      const mappedCompetitors = (compData.competitors || []).map((c: any) => ({
        id: c.id,
        name: c.name,
        url: c.url,
        rating: c.rating ?? 4.8,
        reviews_count: c.reviews_count ?? "0 reviews",
        price_text: c.price_text ?? "Free plan",
      }));
      setCompetitors(mappedCompetitors);
      if (mappedCompetitors.length > 0) {
        setActiveCompetitorId(mappedCompetitors[0].id);
      } else {
        setActiveCompetitorId(null);
      }

      // 2. Fetch activity logs
      const activityData = await api.getCompetitorsActivity(selectedApp.id);
      setActivities(activityData.activities || []);
    } catch (err: any) {
      showToast(err?.message || "Failed to load competitor activity feed", "error");
    } finally {
      setIsLoading(false);
    }
  };

  const fetchH2H = async (competitorId: number) => {
    setIsLoadingH2H(true);
    try {
      const data = await api.getHeadToHead(selectedApp.id, competitorId);
      setHeadToHead(data);
    } catch (err: any) {
      showToast(err?.message || "Failed to load head-to-head comparison data", "error");
    } finally {
      setIsLoadingH2H(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedApp.id]);

  useEffect(() => {
    if (activeCompetitorId !== null) {
      fetchH2H(activeCompetitorId);
    } else {
      setHeadToHead(null);
    }
  }, [activeCompetitorId]);

  const handleTypeFilterClick = (type: string) => {
    setSelectedType((prev) => (prev === type ? "ALL" : type));
  };

  const handleAppFilterClick = (appName: string) => {
    setSelectedApps((prev) => {
      if (appName === "ALL") return ["ALL"];
      const newApps = prev.filter((a) => a !== "ALL");
      if (newApps.includes(appName)) {
        const filtered = newApps.filter((a) => a !== appName);
        return filtered.length === 0 ? ["ALL"] : filtered;
      } else {
        return [...newApps, appName];
      }
    });
  };

  // Filter logs
  const filteredActivities = activities.filter((act) => {
    // Type Filter
    if (selectedType !== "ALL" && act.type !== selectedType) return false;

    // App Filter
    if (!selectedApps.includes("ALL")) {
      const matchName = act.app_name;
      if (!selectedApps.includes(matchName)) return false;
    }
    return true;
  });

  const getAvatarColor = (name: string) => {
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    const colors = ["#f97316", "#14b8a6", "#3b82f6", "#8b5cf6", "#ec4899", "#10b981", "#ef4444"];
    return colors[Math.abs(hash) % colors.length];
  };

  return (
    <Box sx={{ py: 3, px: 3 }}>
      {/* Page Header */}
      <Box sx={{ mb: 4, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700, color: "#111827", mb: 0.5 }}>
            Competitors
          </Typography>
          <Typography sx={{ fontSize: 13, color: "#6b7280" }}>
            Compare performance and track day-over-day listing variations with competitors side-by-side.
          </Typography>
        </Box>
        <FormControl size="small" sx={{ minWidth: 220 }}>
          <Select
            value={selectedApp?.id || ""}
            onChange={(e) => {
              const app = apps.find((a) => a.id === e.target.value);
              if (app) onSelectApp(app);
            }}
            sx={{
              bgcolor: "#ffffff",
              fontSize: 13.5,
              fontWeight: 600,
              borderRadius: "8px",
              "& .MuiOutlinedInput-notchedOutline": { borderColor: "#e5e7eb" },
              "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: "#d1d5db" },
              "&.Mui-focused .MuiOutlinedInput-notchedOutline": { borderColor: "#006e52" }
            }}
          >
            {apps.map((app) => (
              <MenuItem key={app.id} value={app.id} sx={{ fontSize: 13.5 }}>
                {app.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>

      {/* Competitors List Cards */}
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)", md: "repeat(3, 1fr)" },
          gap: 2,
          mb: 4,
        }}
      >
        {/* Own App Card */}
        <Paper
          elevation={0}
          sx={{
            p: 2.5,
            borderRadius: "12px",
            border: "2px solid #006e52",
            bgcolor: "#fff",
            display: "flex",
            flexDirection: "column",
            gap: 1.5,
            position: "relative",
          }}
        >
          <Chip
            label="YOU"
            size="small"
            sx={{
              position: "absolute",
              top: 12,
              right: 12,
              bgcolor: "#006e52",
              color: "#fff",
              fontWeight: 700,
              fontSize: 10,
              height: 20,
            }}
          />
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
            <Avatar
              sx={{
                width: 44,
                height: 44,
                bgcolor: getAvatarColor(selectedApp.name),
                fontSize: 18,
                fontWeight: 700,
              }}
            >
              {selectedApp.name[0]?.toUpperCase()}
            </Avatar>
            <Box>
              <Typography sx={{ fontWeight: 700, fontSize: 14.5, color: "#111827", pr: 4 }} noWrap>
                {selectedApp.name}
              </Typography>
              <Typography sx={{ fontSize: 12, color: "#6b7280" }}>Your Tracked App</Typography>
            </Box>
          </Box>
          <Divider />
          <Box sx={{ display: "flex", gap: 3, alignItems: "center" }}>
            <Box>
              <Typography sx={{ fontSize: 11, color: "#9ca3af", textTransform: "uppercase", fontWeight: 600 }}>
                Reviews
              </Typography>
              <Typography sx={{ fontSize: 13, fontWeight: 600, color: "#374151" }}>
                ★ {mainAppDetails?.rating || "4.8"} ({mainAppDetails?.reviews_count || "Active"})
              </Typography>
            </Box>
            <Box>
              <Typography sx={{ fontSize: 11, color: "#9ca3af", textTransform: "uppercase", fontWeight: 600 }}>
                Starting Price
              </Typography>
              <Typography sx={{ fontSize: 13, fontWeight: 600, color: "#374151" }}>
                {mainAppDetails?.price_text || "Free tier"}
              </Typography>
            </Box>
          </Box>
        </Paper>

        {/* Competitor Cards */}
        {competitors.map((comp) => {
          const isSelected = activeCompetitorId === comp.id;
          const avatarColor = getAvatarColor(comp.name);
          return (
            <Paper
              key={comp.id}
              elevation={0}
              onClick={() => {
                setActiveCompetitorId(comp.id);
                setActiveTab("compare");
              }}
              sx={{
                p: 2.5,
                borderRadius: "12px",
                border: isSelected ? `2px solid ${avatarColor}` : "1px solid #e5e7eb",
                bgcolor: "#fff",
                display: "flex",
                flexDirection: "column",
                gap: 1.5,
                cursor: "pointer",
                transition: "border 0.2s, box-shadow 0.2s",
                "&:hover": { boxShadow: "0 4px 12px rgba(0,0,0,0.05)" },
              }}
            >
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
              <Avatar
                sx={{
                  width: 44,
                  height: 44,
                  bgcolor: getAvatarColor(comp.name),
                  fontSize: 18,
                  fontWeight: 700,
                }}
              >
                {comp.name[0]?.toUpperCase()}
              </Avatar>
              <Box>
                <Typography sx={{ fontWeight: 700, fontSize: 14.5, color: "#111827" }} noWrap>
                  {comp.name}
                </Typography>
                <Typography sx={{ fontSize: 12, color: "#6b7280" }}>Competitor</Typography>
              </Box>
            </Box>
            <Divider />
            <Box sx={{ display: "flex", gap: 3, alignItems: "center" }}>
              <Box>
                <Typography sx={{ fontSize: 11, color: "#9ca3af", textTransform: "uppercase", fontWeight: 600 }}>
                  Reviews
                </Typography>
                <Typography sx={{ fontSize: 13, fontWeight: 600, color: "#374151" }}>
                  ★ {comp.rating} ({comp.reviews_count})
                </Typography>
              </Box>
              <Box>
                <Typography sx={{ fontSize: 11, color: "#9ca3af", textTransform: "uppercase", fontWeight: 600 }}>
                  Starting Price
                </Typography>
                <Typography sx={{ fontSize: 13, fontWeight: 600, color: "#374151" }}>
                  {comp.price_text}
                </Typography>
              </Box>
            </Box>
          </Paper>
          );
        })}

        {competitors.length === 0 && (
          <Paper
            elevation={0}
            sx={{
              p: 2.5,
              borderRadius: "12px",
              border: "1px dashed #e5e7eb",
              bgcolor: "#f9fafb",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              minHeight: 120,
              gridColumn: "span 2",
            }}
          >
            <Typography sx={{ fontSize: 12.5, color: "#9ca3af", textAlign: "center" }}>
              No competitors tracked yet. Add one in the dashboard Competitors Manager!
            </Typography>
          </Paper>
        )}
      </Box>

      {/* View Selector Tabs */}
      {activeCompetitorId !== null && (
        <Box sx={{ display: "flex", gap: 1.5, mb: 4, borderBottom: "1px solid #e5e7eb", pb: 0.5 }}>
          <Button
            size="small"
            variant="text"
            onClick={() => setActiveTab("compare")}
            sx={{
              textTransform: "none",
              fontWeight: 700,
              fontSize: 13.5,
              color: activeTab === "compare" ? "#006e52" : "#6b7280",
              borderBottom: activeTab === "compare" ? "3px solid #006e52" : "3px solid transparent",
              borderRadius: 0,
              px: 1.5,
              pb: 0.75,
              "&:hover": { bgcolor: "transparent", color: "#006e52" }
            }}
          >
            Head-to-Head Compare
          </Button>
          <Button
            size="small"
            variant="text"
            onClick={() => setActiveTab("activity")}
            sx={{
              textTransform: "none",
              fontWeight: 700,
              fontSize: 13.5,
              color: activeTab === "activity" ? "#006e52" : "#6b7280",
              borderBottom: activeTab === "activity" ? "3px solid #006e52" : "3px solid transparent",
              borderRadius: 0,
              px: 1.5,
              pb: 0.75,
              "&:hover": { bgcolor: "transparent", color: "#006e52" }
            }}
          >
            ASO Activity Feed
          </Button>
        </Box>
      )}

      {/* Head-to-Head Section */}
      {activeTab === "compare" && activeCompetitorId !== null && (
        <Box>
          {/* Head-to-Head comparison table */}
          <Paper
            elevation={0}
            sx={{
              p: 3,
              borderRadius: "12px",
              border: "1px solid #e5e7eb",
              bgcolor: "#fff",
              mb: 4,
            }}
          >
            <Typography sx={{ fontWeight: 700, fontSize: 16, mb: 3, color: "#111827" }}>
              Head-to-Head
            </Typography>

            {/* Header Row */}
            <Box sx={{ display: "grid", gridTemplateColumns: "1fr 180px 1fr", gap: 2, pb: 2, borderBottom: "2px solid #e5e7eb", alignItems: "center" }}>
              <Typography sx={{ fontWeight: 700, fontSize: 14, color: "#006e52", textAlign: "right" }}>
                {selectedApp.name}
              </Typography>
              <Typography sx={{ fontWeight: 700, fontSize: 11, color: "#9ca3af", textAlign: "center", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                METRIC
              </Typography>
              <Typography sx={{ fontWeight: 700, fontSize: 14, color: "#ef4444", textAlign: "left" }}>
                {competitors.find((c) => c.id === activeCompetitorId)?.name || "Competitor"}
              </Typography>
            </Box>

            {/* Metric Rows */}
            {isLoadingH2H ? (
              <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
                <CircularProgress size={24} sx={{ color: "#111827" }} />
              </Box>
            ) : headToHead ? (
              <Box>
                {[
                  { label: "REVIEWS", key: "reviews", youColor: "#374151", themColor: "#ef4444" },
                  { label: "RATING", key: "rating", youColor: "#374151", themColor: "#ef4444" },
                  { label: "PRICE", key: "price", youColor: "#374151", themColor: "#374151" },
                  { label: "BFS BADGE", key: "bfs_badge", youColor: "#374151", themColor: "#374151" },
                  { label: "SCREENSHOTS", key: "screenshots", youColor: "#006e52", themColor: "#374151" },
                  { label: "VIDEO", key: "video", youColor: "#374151", themColor: "#374151" },
                  { label: "LANGUAGES", key: "languages", youColor: "#006e52", themColor: "#374151" },
                  { label: "FEATURES", key: "features", youColor: "#374151", themColor: "#374151" },
                ].map((metric) => (
                  <Box
                    key={metric.label}
                    sx={{
                      display: "grid",
                      gridTemplateColumns: "1fr 180px 1fr",
                      gap: 2,
                      py: 1.75,
                      borderBottom: "1px solid #f3f4f6",
                      alignItems: "center",
                    }}
                  >
                    <Typography sx={{ fontSize: 13.5, fontWeight: 600, color: metric.youColor, textAlign: "right" }}>
                      {headToHead.you[metric.key]}
                    </Typography>
                    <Typography sx={{ fontSize: 11, fontWeight: 700, color: "#6b7280", textAlign: "center", letterSpacing: "0.05em" }}>
                      {metric.label}
                    </Typography>
                    <Typography sx={{ fontSize: 13.5, fontWeight: 600, color: metric.themColor, textAlign: "left" }}>
                      {headToHead.them[metric.key]}
                    </Typography>
                  </Box>
                ))}
              </Box>
            ) : (
              <Typography sx={{ py: 3, textAlign: "center", color: "#9ca3af", fontSize: 13 }}>
                No comparison details loaded.
              </Typography>
            )}
          </Paper>
        </Box>
      )}

      {/* Activity Feed Section */}
      {(activeTab === "activity" || activeCompetitorId === null) && (
        <Box>
          {/* Activity Title */}
          <Box sx={{ mb: 2 }}>
            <Typography variant="h6" sx={{ fontWeight: 700, color: "#111827", fontSize: 16 }}>
              ACTIVITY
            </Typography>
            <Typography sx={{ fontSize: 12.5, color: "#6b7280" }}>
              Your moves and your competitors', side by side.
            </Typography>
          </Box>

          {/* Filter Toolbar */}
          <Box
            sx={{
              bgcolor: "#f9fafb",
              border: "1px solid #e5e7eb",
              borderRadius: "12px",
              p: 2,
              mb: 3,
              display: "flex",
              flexDirection: "column",
              gap: 1.5,
            }}
          >
            {/* Type Filter Buttons */}
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
              <Typography sx={{ fontSize: 12, fontWeight: 600, color: "#374151", mr: 1 }}>
                TYPE:
              </Typography>
              <Button
                size="small"
                variant={selectedType === "ALL" ? "contained" : "outlined"}
                onClick={() => setSelectedType("ALL")}
                sx={{
                  textTransform: "none",
                  fontSize: 11,
                  fontWeight: 600,
                  borderRadius: "20px",
                  py: 0.25,
                  px: 1.5,
                  bgcolor: selectedType === "ALL" ? "#111827" : "transparent",
                  color: selectedType === "ALL" ? "#fff" : "#374151",
                  borderColor: "#e5e7eb",
                  "&:hover": { bgcolor: selectedType === "ALL" ? "#1f2937" : "#f3f4f6" },
                }}
              >
                ALL
              </Button>
              {Object.keys(TYPE_COLORS).map((type) => {
                const colors = TYPE_COLORS[type];
                const isActive = selectedType === type;
                return (
                  <Button
                    key={type}
                    size="small"
                    variant={isActive ? "contained" : "outlined"}
                    onClick={() => handleTypeFilterClick(type)}
                    sx={{
                      textTransform: "none",
                      fontSize: 11,
                      fontWeight: 600,
                      borderRadius: "20px",
                      py: 0.25,
                      px: 1.5,
                      bgcolor: isActive ? colors.text : "transparent",
                      color: isActive ? "#fff" : colors.text,
                      borderColor: colors.border,
                      "&:hover": {
                        bgcolor: isActive ? colors.text : `${colors.bg}e6`,
                      },
                    }}
                  >
                    {type}
                  </Button>
                );
              })}
            </Box>

            {/* Apps Filter Buttons */}
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
              <Typography sx={{ fontSize: 12, fontWeight: 600, color: "#374151", mr: 1 }}>
                APPS:
              </Typography>
              <Button
                size="small"
                variant={selectedApps.includes("ALL") ? "contained" : "outlined"}
                onClick={() => handleAppFilterClick("ALL")}
                sx={{
                  textTransform: "none",
                  fontSize: 11,
                  fontWeight: 600,
                  borderRadius: "20px",
                  py: 0.25,
                  px: 1.5,
                  bgcolor: selectedApps.includes("ALL") ? "#111827" : "transparent",
                  color: selectedApps.includes("ALL") ? "#fff" : "#374151",
                  borderColor: "#e5e7eb",
                  "&:hover": { bgcolor: selectedApps.includes("ALL") ? "#1f2937" : "#f3f4f6" },
                }}
              >
                ALL
              </Button>

              {/* Own App Filter button */}
              <Button
                size="small"
                variant={selectedApps.includes(selectedApp.name) ? "contained" : "outlined"}
                onClick={() => handleAppFilterClick(selectedApp.name)}
                sx={{
                  textTransform: "none",
                  fontSize: 11,
                  fontWeight: 600,
                  borderRadius: "20px",
                  py: 0.25,
                  px: 1.5,
                  bgcolor: selectedApps.includes(selectedApp.name) ? "#006e52" : "transparent",
                  color: selectedApps.includes(selectedApp.name) ? "#fff" : "#006e52",
                  borderColor: "#006e52",
                  "&:hover": { bgcolor: selectedApps.includes(selectedApp.name) ? "#00553f" : "#f0fdf4" },
                }}
              >
                {selectedApp.name} (YOU)
              </Button>

              {/* Competitor Filter buttons */}
              {competitors.map((comp) => {
                const isSelected = selectedApps.includes(comp.name);
                const avatarColor = getAvatarColor(comp.name);
                return (
                  <Button
                    key={comp.id}
                    size="small"
                    variant={isSelected ? "contained" : "outlined"}
                    onClick={() => handleAppFilterClick(comp.name)}
                    sx={{
                      textTransform: "none",
                      fontSize: 11,
                      fontWeight: 600,
                      borderRadius: "20px",
                      py: 0.25,
                      px: 1.5,
                      bgcolor: isSelected ? avatarColor : "transparent",
                      color: isSelected ? "#fff" : avatarColor,
                      borderColor: avatarColor,
                      "&:hover": { bgcolor: isSelected ? avatarColor : "#f9fafb" },
                    }}
                  >
                    {comp.name}
                  </Button>
                );
              })}
            </Box>
          </Box>

          {/* Activity Logs Feed */}
          {isLoading ? (
            <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
              <CircularProgress size={36} sx={{ color: "#111827" }} />
            </Box>
          ) : filteredActivities.length === 0 ? (
            <Paper
              elevation={0}
              sx={{
                p: 4,
                borderRadius: "12px",
                border: "1px solid #e5e7eb",
                bgcolor: "#fff",
                textAlign: "center",
              }}
            >
              <Typography sx={{ fontSize: 13, color: "#9ca3af" }}>
                No activity matches the current filters.
              </Typography>
            </Paper>
          ) : (
            <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
              {filteredActivities.map((act) => {
                const colors = TYPE_COLORS[act.type] || { bg: "#f9fafb", text: "#374151", border: "#e5e7eb" };
                return (
                  <Paper
                    key={act.id}
                    elevation={0}
                    sx={{
                      p: 2,
                      borderRadius: "8px",
                      border: "1px solid #e5e7eb",
                      borderLeft: `4px solid ${colors.border}`,
                      bgcolor: "#fff",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      transition: "transform 0.15s",
                      "&:hover": { transform: "translateX(4px)" },
                    }}
                  >
                    <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                        <Typography sx={{ fontWeight: 700, fontSize: 13.5, color: "#111827" }}>
                          {act.app_name}
                        </Typography>
                        {act.app_name === selectedApp.name && (
                          <Chip
                            label="YOU"
                            size="small"
                            sx={{
                              bgcolor: "#006e52",
                              color: "#fff",
                              fontWeight: 700,
                              fontSize: 9,
                              height: 16,
                              px: 0.5,
                            }}
                          />
                        )}
                        <Chip
                          label={act.type}
                          size="small"
                          sx={{
                            bgcolor: colors.bg,
                            color: colors.text,
                            fontWeight: 700,
                            fontSize: 9,
                            height: 16,
                            px: 0.5,
                          }}
                        />
                        
                        {/* View details / link */}
                        {act.has_details ? (
                          <Typography
                            onClick={() => setActiveDetails(act)}
                            sx={{
                              fontSize: 11.5,
                              color: "#3b82f6",
                              cursor: "pointer",
                              fontWeight: 600,
                              "&:hover": { textDecoration: "underline" },
                            }}
                          >
                            Click for details
                          </Typography>
                        ) : act.type === "REVIEW" ? (
                          <Typography
                            sx={{
                              fontSize: 11.5,
                              color: "#9ca3af",
                              fontWeight: 500,
                            }}
                          >
                            View newest reviews ↗
                          </Typography>
                        ) : null}
                      </Box>

                      <Typography sx={{ fontSize: 13, color: "#4b5563" }}>{act.text}</Typography>
                    </Box>

                    <Typography sx={{ fontSize: 12, color: "#9ca3af", fontWeight: 500 }}>
                      {act.date}
                    </Typography>
                  </Paper>
                );
              })}
            </Box>
          )}
        </Box>
      )}

      {/* Side-by-Side Comparison Details Modal */}
      <Dialog
        open={!!activeDetails}
        onClose={() => setActiveDetails(null)}
        maxWidth="md"
        fullWidth
        slotProps={{
          paper: {
            sx: {
              borderRadius: "16px",
              boxShadow: "0 24px 64px rgba(0,0,0,0.15)",
              border: "1px solid #e5e7eb",
              p: 1,
            },
          },
        }}
      >
        {activeDetails && (
          <>
            <DialogTitle
              sx={{
                display: "flex",
                alignItems: "flex-start",
                justifyContent: "space-between",
                pb: 1.5,
              }}
            >
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 700, fontSize: 17, color: "#111827" }}>
                  {activeDetails.app_name}
                </Typography>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1, mt: 0.5 }}>
                  <Chip
                    label={`${activeDetails.type} UPDATE`}
                    size="small"
                    sx={{
                      bgcolor: TYPE_COLORS[activeDetails.type]?.bg,
                      color: TYPE_COLORS[activeDetails.type]?.text,
                      fontWeight: 700,
                      fontSize: 10,
                      height: 18,
                    }}
                  />
                  <Typography sx={{ fontSize: 12.5, color: "#6b7280" }}>
                    {activeDetails.details?.subtitle} • {activeDetails.date}
                  </Typography>
                </Box>
              </Box>
              <IconButton size="small" onClick={() => setActiveDetails(null)}>
                <CloseIcon sx={{ fontSize: 20 }} />
              </IconButton>
            </DialogTitle>

            <DialogContent sx={{ pb: 3, pt: 1 }}>
              {activeDetails.details?.subtitle === "Description" ? (
                <Box
                  sx={{
                    display: "grid",
                    gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
                    gap: 3,
                  }}
                >
                  {/* PREVIOUS column */}
                  <Box>
                    <Typography
                      sx={{
                        fontSize: 12,
                        fontWeight: 700,
                        color: "#b91c1c",
                        display: "flex",
                        alignItems: "center",
                        gap: 0.5,
                        mb: 1.5,
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                      }}
                    >
                      <RemoveIcon sx={{ fontSize: 16 }} />
                      PREVIOUS
                    </Typography>
                    <Box
                      sx={{
                        p: 2.5,
                        borderRadius: "12px",
                        bgcolor: "#fff5f5",
                        border: "1px solid #fecaca",
                        color: "#4b5563",
                        fontSize: 13.5,
                        lineHeight: 1.65,
                        whiteSpace: "pre-line",
                      }}
                    >
                      {(() => {
                        const prevText = activeDetails.details?.previous[0] || "";
                        const currText = activeDetails.details?.current[0] || "";
                        const parts = diffWords(prevText, currText);
                        return parts.map((part, idx) => {
                          if (part.type === "added") return null;
                          if (part.type === "removed") {
                            return (
                              <span key={idx} style={{ backgroundColor: "#fecaca", color: "#991b1b", padding: "1px 3px", borderRadius: "3px" }}>
                                {part.value}
                              </span>
                            );
                          }
                          return <span key={idx}>{part.value}</span>;
                        });
                      })()}
                    </Box>
                  </Box>

                  {/* CURRENT column */}
                  <Box>
                    <Typography
                      sx={{
                        fontSize: 12,
                        fontWeight: 700,
                        color: "#0f766e",
                        display: "flex",
                        alignItems: "center",
                        gap: 0.5,
                        mb: 1.5,
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                      }}
                    >
                      <AddIcon sx={{ fontSize: 16 }} />
                      CURRENT
                    </Typography>
                    <Box
                      sx={{
                        p: 2.5,
                        borderRadius: "12px",
                        bgcolor: "#f0fdf4",
                        border: "1px solid #bbf7d0",
                        color: "#4b5563",
                        fontSize: 13.5,
                        lineHeight: 1.65,
                        whiteSpace: "pre-line",
                      }}
                    >
                      {(() => {
                        const prevText = activeDetails.details?.previous[0] || "";
                        const currText = activeDetails.details?.current[0] || "";
                        const parts = diffWords(prevText, currText);
                        return parts.map((part, idx) => {
                          if (part.type === "removed") return null;
                          if (part.type === "added") {
                            return (
                              <span key={idx} style={{ backgroundColor: "#a7f3d0", color: "#065f46", fontWeight: "bold", padding: "1px 3px", borderRadius: "3px" }}>
                                {part.value}
                              </span>
                            );
                          }
                          return <span key={idx}>{part.value}</span>;
                        });
                      })()}
                    </Box>
                  </Box>
                </Box>
              ) : activeDetails.details?.subtitle === "Feature List" ? (
                <Box
                  sx={{
                    display: "grid",
                    gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
                    gap: 3,
                  }}
                >
                  {/* PREVIOUS column */}
                  <Box>
                    <Typography
                      sx={{
                        fontSize: 12,
                        fontWeight: 700,
                        color: "#b91c1c",
                        display: "flex",
                        alignItems: "center",
                        gap: 0.5,
                        mb: 1.5,
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                      }}
                    >
                      <RemoveIcon sx={{ fontSize: 16 }} />
                      PREVIOUS ({activeDetails.details?.previous.length || 0})
                    </Typography>
                    <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                      {alignLists(activeDetails.details?.previous || [], activeDetails.details?.current || []).map((row, idx) => {
                        if (row.prev === null) {
                          return (
                            <Box
                              key={idx}
                              sx={{
                                p: 1.25,
                                borderRadius: "8px",
                                bgcolor: "transparent",
                                border: "1px dashed #e5e7eb",
                                color: "#9ca3af",
                                fontSize: 13,
                                fontStyle: "italic",
                                height: "42px",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                              }}
                            >
                              -
                            </Box>
                          );
                        }
                        return (
                          <Box
                            key={idx}
                            sx={{
                              p: 1.25,
                              borderRadius: "8px",
                              bgcolor: row.isChanged ? "#fee2e2" : "#f9fafb",
                              border: `1px solid ${row.isChanged ? "#fecaca" : "#e5e7eb"}`,
                              color: row.isChanged ? "#b91c1c" : "#4b5563",
                              fontSize: 13,
                              fontWeight: row.isChanged ? 600 : 500,
                              textDecoration: row.isChanged ? "line-through" : "none",
                              display: "flex",
                              alignItems: "center",
                              gap: 1,
                            }}
                          >
                            <Box sx={{ display: "flex", flexGrow: 1, whiteSpace: "pre-line" }}>{row.prev}</Box>
                          </Box>
                        );
                      })}
                    </Box>
                  </Box>

                  {/* CURRENT column */}
                  <Box>
                    <Typography
                      sx={{
                        fontSize: 12,
                        fontWeight: 700,
                        color: "#0f766e",
                        display: "flex",
                        alignItems: "center",
                        gap: 0.5,
                        mb: 1.5,
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                      }}
                    >
                      <AddIcon sx={{ fontSize: 16 }} />
                      CURRENT ({activeDetails.details?.current.length || 0})
                    </Typography>
                    <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                      {alignLists(activeDetails.details?.previous || [], activeDetails.details?.current || []).map((row, idx) => {
                        if (row.curr === null) {
                          return (
                            <Box
                              key={idx}
                              sx={{
                                p: 1.25,
                                borderRadius: "8px",
                                bgcolor: "transparent",
                                border: "1px dashed #e5e7eb",
                                color: "#9ca3af",
                                fontSize: 13,
                                fontStyle: "italic",
                                height: "42px",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                              }}
                            >
                              -
                            </Box>
                          );
                        }
                        return (
                          <Box
                            key={idx}
                            sx={{
                              p: 1.25,
                              borderRadius: "8px",
                              bgcolor: row.isChanged ? "#d1fae5" : "#f9fafb",
                              border: `1px solid ${row.isChanged ? "#a7f3d0" : "#e5e7eb"}`,
                              color: row.isChanged ? "#065f46" : "#4b5563",
                              fontSize: 13,
                              fontWeight: row.isChanged ? 600 : 500,
                              display: "flex",
                              alignItems: "center",
                              gap: 1,
                            }}
                          >
                            {row.isChanged && (
                              <Chip
                                label="NEW"
                                size="small"
                                sx={{
                                  height: 16,
                                  bgcolor: "#065f46",
                                  color: "#fff",
                                  fontSize: 9,
                                  fontWeight: 700,
                                  mr: 0.5,
                                }}
                              />
                            )}
                            <Box sx={{ display: "flex", flexGrow: 1, whiteSpace: "pre-line", fontWeight: row.isChanged ? 600 : 500 }}>{row.curr}</Box>
                            {row.isChanged && <CheckIcon sx={{ fontSize: 15, color: "#065f46" }} />}
                          </Box>
                        );
                      })}
                    </Box>
                  </Box>
                </Box>
              ) : (
                <Box
                  sx={{
                    display: "grid",
                    gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
                    gap: 3,
                  }}
                >
                  {/* PREVIOUS column */}
                  <Box>
                    <Typography
                      sx={{
                        fontSize: 12,
                        fontWeight: 700,
                        color: "#b91c1c",
                        display: "flex",
                        alignItems: "center",
                        gap: 0.5,
                        mb: 1.5,
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                      }}
                    >
                      <RemoveIcon sx={{ fontSize: 16 }} />
                      PREVIOUS ({activeDetails.details?.previous.length || 0})
                    </Typography>
                    <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                      {(activeDetails.details?.previous || []).map((item, idx) => {
                        const isDeleted = !activeDetails.details?.current.includes(item);
                        return (
                          <Box
                            key={idx}
                            sx={{
                              p: 1.25,
                              borderRadius: "8px",
                              bgcolor: isDeleted ? "#fef2f2" : "#f9fafb",
                              border: `1px solid ${isDeleted ? "#fecaca" : "#e5e7eb"}`,
                              color: isDeleted ? "#991b1b" : "#4b5563",
                              fontSize: 13,
                              fontWeight: isDeleted ? 600 : 500,
                              display: "flex",
                              alignItems: "center",
                              gap: 1,
                            }}
                          >
                            <Box sx={{ display: "flex", flexGrow: 1, whiteSpace: "pre-line" }}>{item}</Box>
                          </Box>
                        );
                      })}
                      {activeDetails.details?.previous.length === 0 && (
                        <Typography sx={{ fontSize: 12.5, color: "#9ca3af", fontStyle: "italic" }}>
                          No items recorded.
                        </Typography>
                      )}
                    </Box>
                  </Box>

                  {/* CURRENT column */}
                  <Box>
                    <Typography
                      sx={{
                        fontSize: 12,
                        fontWeight: 700,
                        color: "#0f766e",
                        display: "flex",
                        alignItems: "center",
                        gap: 0.5,
                        mb: 1.5,
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                      }}
                    >
                      <AddIcon sx={{ fontSize: 16 }} />
                      CURRENT ({activeDetails.details?.current.length || 0})
                    </Typography>
                    <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                      {(activeDetails.details?.current || []).map((item, idx) => {
                        const isNew = !activeDetails.details?.previous.includes(item);
                        return (
                          <Box
                            key={idx}
                            sx={{
                              p: 1.25,
                              borderRadius: "8px",
                              bgcolor: isNew ? "#f0fdf4" : "#f9fafb",
                              border: `1px solid ${isNew ? "#bbf7d0" : "#e5e7eb"}`,
                              color: isNew ? "#0f766e" : "#4b5563",
                              fontSize: 13,
                              fontWeight: isNew ? 600 : 500,
                              display: "flex",
                              alignItems: "center",
                              gap: 1,
                            }}
                          >
                            {isNew && (
                              <Chip
                                label="NEW"
                                size="small"
                                sx={{
                                  height: 16,
                                  bgcolor: "#0f766e",
                                  color: "#fff",
                                  fontSize: 9,
                                  fontWeight: 700,
                                  mr: 0.5,
                                }}
                              />
                            )}
                            <Box sx={{ display: "flex", flexGrow: 1, whiteSpace: "pre-line" }}>{item}</Box>
                            {isNew && <CheckIcon sx={{ fontSize: 15, color: "#0f766e" }} />}
                          </Box>
                        );
                      })}
                      {activeDetails.details?.current.length === 0 && (
                        <Typography sx={{ fontSize: 12.5, color: "#9ca3af", fontStyle: "italic" }}>
                          No items recorded.
                        </Typography>
                      )}
                    </Box>
                  </Box>
                </Box>
              )}
            </DialogContent>

            <DialogActions sx={{ px: 3, pb: 2 }}>
              <Button
                variant="outlined"
                size="small"
                onClick={() => setActiveDetails(null)}
                sx={{
                  borderRadius: "8px",
                  borderColor: "#d1d5db",
                  color: "#4b5563",
                  textTransform: "none",
                  fontWeight: 600,
                  "&:hover": { borderColor: "#9ca3af" },
                }}
              >
                Close details
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>
    </Box>
  );
}
