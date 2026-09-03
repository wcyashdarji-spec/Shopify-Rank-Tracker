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
import StarIcon from "@mui/icons-material/Star";
import CompareArrowsIcon from "@mui/icons-material/CompareArrows";
import TimelineIcon from "@mui/icons-material/Timeline";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import AddIcon from "@mui/icons-material/AddCircle";
import RemoveIcon from "@mui/icons-material/RemoveCircle";
import { api, type App } from "../api";

interface Competitor {
  id: number;
  name: string;
  url: string;
  icon_url?: string | null;
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
    previous_features?: string[];
    current_features?: string[];
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
      isChanged: p !== curr[idx],
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

interface ParsedListingData {
  desc: string;
  bullets: string[];
}

function parseDescriptionAndListing(
  rawText: string,
  explicitFeatures?: string[]
): ParsedListingData {
  if (!rawText) return { desc: "", bullets: explicitFeatures || [] };

  const bullets: string[] = explicitFeatures ? [...explicitFeatures] : [];
  let desc = rawText;

  // 1. If explicit features exist, clean them from desc
  if (bullets.length > 0) {
    for (const feat of bullets) {
      if (feat && desc.includes(feat)) {
        desc = desc.replace(feat, "").trim();
      }
    }
    desc = desc.replace(/\s+/g, " ").trim();
    return { desc, bullets };
  }

  // 2. Split on newlines if present
  const lines = rawText.split(/\n+/).map((l) => l.trim()).filter(Boolean);
  if (lines.length > 1) {
    const descLines: string[] = [];
    const bulletLines: string[] = [];
    for (const line of lines) {
      if (line.startsWith("•") || line.startsWith("-") || line.startsWith("*")) {
        bulletLines.push(line.replace(/^[•\-\*]\s*/, ""));
      } else {
        descLines.push(line);
      }
    }
    if (bulletLines.length > 0) {
      return { desc: descLines.join(" "), bullets: bulletLines };
    }
  }

  // 3. Sentence heuristics for merged continuous text
  const sentences = rawText.match(/[^.!?]+[.!?]+/g) || [rawText];
  if (sentences.length >= 4) {
    const descSentences: string[] = [];
    const bulletSentences: string[] = [];
    const bulletVerbs = /^(collect|customize|display|launch|import|run|manage|track|boost|automate|sync|create|build|add|setup|generate|integrate|offer|drive|increase|grow|maximize|optimize|streamline|transform|deliver|send|showcase|highlight|capture|enable|export)\b/i;

    let foundBullets = false;
    for (let i = 0; i < sentences.length; i++) {
      const sentence = sentences[i].trim();
      if (!foundBullets && i >= 3 && bulletVerbs.test(sentence) && sentence.length < 180) {
        foundBullets = true;
      }

      if (foundBullets) {
        bulletSentences.push(sentence);
      } else {
        descSentences.push(sentence);
      }
    }

    if (bulletSentences.length > 0) {
      return {
        desc: descSentences.join(" ").trim(),
        bullets: bulletSentences,
      };
    }
  }

  return { desc: rawText.trim(), bullets: [] };
}

interface RenderDiffTextProps {
  prevText: string;
  currText: string;
  mode: "previous" | "current";
}

function RenderDiffText({ prevText, currText, mode }: RenderDiffTextProps) {
  if (!prevText && !currText) return null;
  if (!prevText) {
    return mode === "current" ? (
      <Box component="span" sx={{ bgcolor: "#a7f3d0", color: "#047857", fontWeight: 700, px: 0.6, py: 0.2, borderRadius: "4px", mx: 0.2 }}>
        {currText}
      </Box>
    ) : null;
  }
  if (!currText) {
    return mode === "previous" ? (
      <Box component="span" sx={{ bgcolor: "#fecdd3", color: "#9f1239", fontWeight: 700, px: 0.6, py: 0.2, borderRadius: "4px", mx: 0.2 }}>
        {prevText}
      </Box>
    ) : null;
  }

  const diffs = diffWords(prevText, currText);

  return (
    <>
      {diffs.map((part, i) => {
        if (mode === "previous") {
          if (part.type === "removed") {
            return (
              <Box
                key={i}
                component="span"
                sx={{
                  bgcolor: "#fecdd3",
                  color: "#9f1239",
                  fontWeight: 700,
                  px: 0.6,
                  py: 0.2,
                  borderRadius: "4px",
                  mx: 0.2,
                }}
              >
                {part.value}
              </Box>
            );
          }
          if (part.type === "equal") {
            return <span key={i}>{part.value}</span>;
          }
          return null;
        } else {
          if (part.type === "added") {
            return (
              <Box
                key={i}
                component="span"
                sx={{
                  bgcolor: "#a7f3d0",
                  color: "#047857",
                  fontWeight: 700,
                  px: 0.6,
                  py: 0.2,
                  borderRadius: "4px",
                  mx: 0.2,
                }}
              >
                {part.value}
              </Box>
            );
          }
          if (part.type === "equal") {
            return <span key={i}>{part.value}</span>;
          }
          return null;
        }
      })}
    </>
  );
}

const TYPE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  PRICE: { bg: "#fff7ed", text: "#ea580c", border: "#ffedd5" },
  LISTING: { bg: "#f0f9ff", text: "#0284c7", border: "#e0f2fe" },
  REVIEW: { bg: "#ecfdf5", text: "#059669", border: "#d1fae5" },
  CATEGORY: { bg: "#ecfeff", text: "#0891b2", border: "#cffafe" },
  LANGUAGE: { bg: "#e0e7ff", text: "#4f46e5", border: "#c7d2fe" },
  TECHNICAL: { bg: "#f1f5f9", text: "#475569", border: "#e2e8f0" },
};

export default function CompetitorsPage({
  apps,
  selectedApp,
  onSelectApp,
  showToast,
}: CompetitorsPageProps) {
  if (!selectedApp) {
    return (
      <Box sx={{ p: { xs: 2, sm: 4 }, maxWidth: 640, mx: "auto", mt: 4 }}>
        <Paper
          elevation={0}
          sx={{
            p: 4,
            borderRadius: "20px",
            border: "1px solid #e2e8f0",
            bgcolor: "#ffffff",
            boxShadow: "0 10px 30px -10px rgba(15, 23, 42, 0.05)",
            textAlign: "center",
          }}
        >
          <Box
            sx={{
              width: 56,
              height: 56,
              borderRadius: "16px",
              bgcolor: "#faf5ff",
              color: "#8b5cf6",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              mx: "auto",
              mb: 2,
            }}
          >
            <CompareArrowsIcon sx={{ fontSize: 30 }} />
          </Box>
          <Typography variant="h6" sx={{ color: "#0f172a", fontWeight: 800, mb: 1 }}>
            Select an App for Competitor Intelligence
          </Typography>
          <Typography sx={{ color: "#64748b", fontSize: 14, mb: 3 }}>
            Choose one of your tracked Shopify applications below to analyze side-by-side competitor keyword visibility.
          </Typography>

          {apps.length === 0 ? (
            <Typography sx={{ color: "#94a3b8", fontSize: 13 }}>
              No Shopify apps tracked yet. Please add your first app from the Home Overview page.
            </Typography>
          ) : (
            <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
              {apps.map((app) => (
                <Button
                  key={app.id}
                  variant="outlined"
                  onClick={() => onSelectApp(app)}
                  startIcon={
                    <Avatar
                      src={app.icon_url || undefined}
                      sx={{ width: 28, height: 28, fontSize: 13, fontWeight: 800, bgcolor: "#8b5cf6" }}
                    >
                      {app.name[0]?.toUpperCase()}
                    </Avatar>
                  }
                  sx={{
                    justifyContent: "flex-start",
                    p: 1.5,
                    px: 2,
                    borderRadius: "12px",
                    borderColor: "#e2e8f0",
                    color: "#0f172a",
                    fontWeight: 700,
                    fontSize: 14,
                    textTransform: "none",
                    "&:hover": { borderColor: "#8b5cf6", bgcolor: "#faf5ff" },
                  }}
                >
                  {app.name}
                </Button>
              ))}
            </Box>
          )}
        </Paper>
      </Box>
    );
  }

  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [activities, setActivities] = useState<ActivityItem[]>([]);

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
    try {
      const compData = await api.getCompetitors(selectedApp.id);
      setMainAppDetails(compData.main_app || null);

      const mappedCompetitors = (compData.competitors || []).map((c: any) => ({
        id: c.id,
        name: c.name,
        url: c.url,
        icon_url: c.icon_url || null,
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

      const activityData = await api.getCompetitorsActivity(selectedApp.id);
      setActivities(activityData.activities || []);
    } catch (err: any) {
      showToast(err?.message || "Failed to load competitor activity feed", "error");
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

  const filteredActivities = activities.filter((act) => {
    if (selectedType !== "ALL" && act.type !== selectedType) return false;
    if (!selectedApps.includes("ALL")) {
      if (!selectedApps.includes(act.app_name)) return false;
    }
    return true;
  });

  const getAvatarColor = (name: string) => {
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    const colors = ["#0f172a", "#10b981", "#f59e0b", "#0284c7", "#ec4899", "#3b82f6", "#ef4444"];
    return colors[Math.abs(hash) % colors.length];
  };

  const getAppIconUrl = (appName: string) => {
    if (appName === selectedApp.name) {
      return mainAppDetails?.icon_url || selectedApp.icon_url || undefined;
    }
    const matchedComp = competitors.find((c) => c.name === appName);
    return matchedComp?.icon_url || undefined;
  };

  return (
    <Box sx={{ py: { xs: 2, sm: 3, md: 4 }, px: { xs: 2, sm: 3, md: 4 }, maxWidth: 1200, mx: "auto" }}>
      {/* 1. Header Bar with Application Switcher */}
      <Paper
        elevation={0}
        sx={{
          p: 2.5,
          borderRadius: "16px",
          border: "1px solid #e2e8f0",
          bgcolor: "#ffffff",
          mb: 3.5,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 2,
          boxShadow: "0 4px 12px rgba(0,0,0,0.02)",
        }}
      >
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 800, color: "#0f172a", letterSpacing: "-0.02em" }}>
            Competitor Intelligence
          </Typography>
          <Typography sx={{ fontSize: 13, color: "#64748b", mt: 0.25 }}>
            Compare head-to-head performance metrics and track day-over-day ASO listing variations side-by-side.
          </Typography>
        </Box>

        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
          <Typography sx={{ fontSize: 12.5, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.04em" }}>
            Select App:
          </Typography>
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
                fontWeight: 700,
                borderRadius: "10px",
                "& .MuiOutlinedInput-notchedOutline": { borderColor: "#e2e8f0" },
                "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: "#cbd5e1" },
                "&.Mui-focused .MuiOutlinedInput-notchedOutline": { borderColor: "#0f172a" },
              }}
            >
              {apps.map((app) => (
                <MenuItem key={app.id} value={app.id} sx={{ fontSize: 13.5, fontWeight: 600 }}>
                  {app.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>
      </Paper>

      {/* 2. Tracked Apps & Competitor Cards Grid */}
      <Box sx={{ mb: 3.5 }}>
        <Typography sx={{ fontSize: 13, fontWeight: 800, color: "#0f172a", textTransform: "uppercase", letterSpacing: "0.05em", mb: 1.75 }}>
          Compare Apps
        </Typography>
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)", md: "repeat(3, 1fr)" },
            gap: 2.5,
          }}
        >
          {/* Your Tracked App Card */}
          <Paper
            elevation={0}
            sx={{
              p: 2.5,
              borderRadius: "16px",
              border: "2px solid #10b981",
              bgcolor: "#ffffff",
              display: "flex",
              flexDirection: "column",
              gap: 1.75,
              position: "relative",
              boxShadow: "0 4px 16px rgba(16, 185, 129, 0.08)",
            }}
          >
            <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 1.5 }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, minWidth: 0, flex: 1 }}>
                <Avatar
                  src={mainAppDetails?.icon_url || selectedApp.icon_url || undefined}
                  sx={{
                    width: 42,
                    height: 42,
                    bgcolor: getAvatarColor(selectedApp.name),
                    fontSize: 17,
                    fontWeight: 800,
                    flexShrink: 0,
                  }}
                >
                  {selectedApp.name[0]?.toUpperCase()}
                </Avatar>
                <Box sx={{ minWidth: 0 }}>
                  <Typography sx={{ fontWeight: 800, fontSize: 15, color: "#0f172a", lineHeight: 1.35 }}>
                    {selectedApp.name}
                  </Typography>
                  <Typography sx={{ fontSize: 12, color: "#10b981", fontWeight: 700 }}>
                    Your Primary Tracked App
                  </Typography>
                </Box>
              </Box>

              <Chip
                label="Your App"
                size="small"
                sx={{
                  bgcolor: "#ecfdf5",
                  color: "#059669",
                  border: "1px solid #a7f3d0",
                  fontWeight: 800,
                  fontSize: 10.5,
                  height: 22,
                  px: 0.5,
                  flexShrink: 0,
                }}
              />
            </Box>

            <Divider sx={{ borderColor: "#f1f5f9" }} />

            <Box sx={{ display: "flex", gap: 3, alignItems: "center" }}>
              <Box>
                <Typography sx={{ fontSize: 11, color: "#64748b", textTransform: "uppercase", fontWeight: 700 }}>
                  Rating & Reviews
                </Typography>
                <Typography sx={{ fontSize: 13, fontWeight: 700, color: "#0f172a", display: "flex", alignItems: "center", gap: 0.5 }}>
                  <StarIcon sx={{ fontSize: 15, color: "#f59e0b" }} />
                  {mainAppDetails?.rating || "4.8"} ({mainAppDetails?.reviews_count || "Active"})
                </Typography>
              </Box>
              <Box>
                <Typography sx={{ fontSize: 11, color: "#64748b", textTransform: "uppercase", fontWeight: 700 }}>
                  Starting Price
                </Typography>
                <Typography sx={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>
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
                  borderRadius: "16px",
                  border: isSelected ? `2px solid ${avatarColor}` : "1px solid #e2e8f0",
                  bgcolor: "#ffffff",
                  display: "flex",
                  flexDirection: "column",
                  gap: 1.75,
                  cursor: "pointer",
                  transition: "all 0.2s ease-in-out",
                  boxShadow: isSelected ? `0 8px 24px ${avatarColor}18` : "0 2px 8px rgba(0,0,0,0.02)",
                  "&:hover": { borderColor: avatarColor, transform: "translateY(-2px)" },
                }}
              >
                <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                  <Avatar
                    src={comp.icon_url || undefined}
                    sx={{
                      width: 42,
                      height: 42,
                      bgcolor: avatarColor,
                      fontSize: 17,
                      fontWeight: 800,
                    }}
                  >
                    {comp.name[0]?.toUpperCase()}
                  </Avatar>
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Typography sx={{ fontWeight: 800, fontSize: 15, color: "#0f172a", lineHeight: 1.35 }}>
                      {comp.name}
                    </Typography>
                    <Typography sx={{ fontSize: 12, color: "#64748b", fontWeight: 600 }}>
                      Competitor App
                    </Typography>
                  </Box>
                </Box>

                <Divider sx={{ borderColor: "#f1f5f9" }} />

                <Box sx={{ display: "flex", gap: 3, alignItems: "center" }}>
                  <Box>
                    <Typography sx={{ fontSize: 11, color: "#64748b", textTransform: "uppercase", fontWeight: 700 }}>
                      Rating & Reviews
                    </Typography>
                    <Typography sx={{ fontSize: 13, fontWeight: 700, color: "#0f172a", display: "flex", alignItems: "center", gap: 0.5 }}>
                      <StarIcon sx={{ fontSize: 15, color: "#f59e0b" }} />
                      {comp.rating} ({comp.reviews_count})
                    </Typography>
                  </Box>
                  <Box>
                    <Typography sx={{ fontSize: 11, color: "#64748b", textTransform: "uppercase", fontWeight: 700 }}>
                      Starting Price
                    </Typography>
                    <Typography sx={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>
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
                p: 3,
                borderRadius: "16px",
                border: "1px dashed #cbd5e1",
                bgcolor: "#f8fafc",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                minHeight: 120,
                gridColumn: "span 2",
              }}
            >
              <Typography sx={{ fontSize: 13, color: "#64748b", fontWeight: 600, textAlign: "center" }}>
                No competitor apps added yet. Manage competitors via the Dashboard to enable head-to-head analysis!
              </Typography>
            </Paper>
          )}
        </Box>
      </Box>

      {/* 3. Navigation View Selector Tabs */}
      {activeCompetitorId !== null && (
        <Box sx={{ display: "flex", gap: 1.5, mb: 3, borderBottom: "1px solid #e2e8f0" }}>
          <Button
            size="small"
            variant="text"
            startIcon={<CompareArrowsIcon sx={{ fontSize: 18 }} />}
            onClick={() => setActiveTab("compare")}
            sx={{
              textTransform: "none",
              fontWeight: 800,
              fontSize: 14,
              color: activeTab === "compare" ? "#0f172a" : "#64748b",
              borderBottom: activeTab === "compare" ? "3px solid #0f172a" : "3px solid transparent",
              borderRadius: 0,
              px: 2,
              pb: 1,
              "&:hover": { bgcolor: "transparent", color: "#0f172a" },
            }}
          >
            Head-to-Head Compare
          </Button>
          <Button
            size="small"
            variant="text"
            startIcon={<TimelineIcon sx={{ fontSize: 18 }} />}
            onClick={() => setActiveTab("activity")}
            sx={{
              textTransform: "none",
              fontWeight: 800,
              fontSize: 14,
              color: activeTab === "activity" ? "#0f172a" : "#64748b",
              borderBottom: activeTab === "activity" ? "3px solid #0f172a" : "3px solid transparent",
              borderRadius: 0,
              px: 2,
              pb: 1,
              "&:hover": { bgcolor: "transparent", color: "#0f172a" },
            }}
          >
            ASO Activity Feed ({activities.length})
          </Button>
        </Box>
      )}

      {/* 4. Head-to-Head Comparison Table Section */}
      {activeTab === "compare" && activeCompetitorId !== null && (
        <Paper
          elevation={0}
          sx={{
            p: { xs: 2.5, sm: 3.5 },
            borderRadius: "16px",
            border: "1px solid #e2e8f0",
            bgcolor: "#ffffff",
            mb: 4,
            boxShadow: "0 4px 16px rgba(0,0,0,0.02)",
          }}
        >
          <Typography sx={{ fontWeight: 800, fontSize: 16, mb: 3, color: "#0f172a" }}>
            Head-to-Head Feature & Metric Comparison
          </Typography>

          {/* Table Header Row */}
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: "1fr 160px 1fr",
              gap: 2,
              pb: 2,
              borderBottom: "2px solid #e2e8f0",
              alignItems: "center",
              bgcolor: "#f8fafc",
              p: 1.5,
              borderRadius: "10px",
              mb: 1,
            }}
          >
            <Box sx={{ textAlign: "right", minWidth: 0 }}>
              <Typography sx={{ fontWeight: 800, fontSize: 14, color: "#10b981", lineHeight: 1.2 }}>
                {selectedApp.name}
              </Typography>
              <Chip
                label="Your App"
                size="small"
                sx={{ fontSize: 9.5, height: 18, bgcolor: "#ecfdf5", color: "#059669", border: "1px solid #a7f3d0", mt: 0.25 }}
              />
            </Box>
            <Typography
              sx={{
                fontWeight: 800,
                fontSize: 11,
                color: "#64748b",
                textAlign: "center",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
              }}
            >
              METRIC
            </Typography>
            <Typography sx={{ fontWeight: 800, fontSize: 14, color: "#0f172a", textAlign: "left" }}>
              {competitors.find((c) => c.id === activeCompetitorId)?.name || "Competitor"}
            </Typography>
          </Box>

          {/* Metric Comparison Rows */}
          {isLoadingH2H ? (
            <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
              <CircularProgress size={28} sx={{ color: "#0f172a" }} />
            </Box>
          ) : headToHead ? (
            <Box sx={{ display: "flex", flexDirection: "column" }}>
              {[
                { label: "REVIEWS", key: "reviews", youColor: "#0f172a", themColor: "#64748b" },
                { label: "RATING", key: "rating", youColor: "#0f172a", themColor: "#64748b" },
                { label: "PRICE", key: "price", youColor: "#0f172a", themColor: "#0f172a" },
                { label: "BFS BADGE", key: "bfs_badge", youColor: "#059669", themColor: "#64748b" },
                { label: "SCREENSHOTS", key: "screenshots", youColor: "#059669", themColor: "#64748b" },
                { label: "VIDEO", key: "video", youColor: "#0f172a", themColor: "#0f172a" },
                { label: "LANGUAGES", key: "languages", youColor: "#059669", themColor: "#64748b" },
                { label: "FEATURES", key: "features", youColor: "#0f172a", themColor: "#0f172a" },
              ].map((metric) => {
                const youVal = headToHead.you[metric.key];
                const themVal = headToHead.them[metric.key];

                return (
                  <Box
                    key={metric.label}
                    sx={{
                      display: "grid",
                      gridTemplateColumns: "1fr 160px 1fr",
                      gap: 2,
                      py: 1.75,
                      px: 1.5,
                      borderBottom: "1px solid #f1f5f9",
                      alignItems: "center",
                      borderRadius: "8px",
                      transition: "bgcolor 0.15s ease",
                      "&:hover": { bgcolor: "#f8fafc" },
                    }}
                  >
                    <Typography sx={{ fontSize: 13.5, fontWeight: 700, color: metric.youColor, textAlign: "right" }}>
                      {typeof youVal === "boolean" ? (youVal ? "Yes" : "No") : youVal}
                    </Typography>
                    <Typography
                      sx={{
                        fontSize: 11,
                        fontWeight: 800,
                        color: "#64748b",
                        textAlign: "center",
                        letterSpacing: "0.04em",
                      }}
                    >
                      {metric.label}
                    </Typography>
                    <Typography sx={{ fontSize: 13.5, fontWeight: 700, color: metric.themColor, textAlign: "left" }}>
                      {typeof themVal === "boolean" ? (themVal ? "Yes" : "No") : themVal}
                    </Typography>
                  </Box>
                );
              })}
            </Box>
          ) : (
            <Typography sx={{ py: 4, textAlign: "center", color: "#94a3b8", fontSize: 13.5, fontWeight: 600 }}>
              No comparison metrics loaded for this competitor.
            </Typography>
          )}
        </Paper>
      )}

      {/* 5. ASO Activity Feed Section */}
      {(activeTab === "activity" || activeCompetitorId === null) && (
        <Paper
          elevation={0}
          sx={{
            p: { xs: 2.5, sm: 3.5 },
            borderRadius: "16px",
            border: "1px solid #e2e8f0",
            bgcolor: "#ffffff",
            mb: 4,
            boxShadow: "0 4px 16px rgba(0,0,0,0.02)",
          }}
        >
          <Box sx={{ mb: 2.5 }}>
            <Typography variant="h6" sx={{ fontWeight: 800, color: "#0f172a", fontSize: 17, letterSpacing: "-0.01em" }}>
              ASO Activity Log Feed
            </Typography>
            <Typography sx={{ fontSize: 13, color: "#64748b", mt: 0.25 }}>
              Track day-over-day price adjustments, listing description edits, reviews, and feature changes.
            </Typography>
          </Box>

          {/* Filter Toolbar */}
          <Box
            sx={{
              bgcolor: "#f8fafc",
              border: "1px solid #e2e8f0",
              borderRadius: "12px",
              p: 2,
              mb: 3,
              display: "flex",
              flexDirection: "column",
              gap: 1.75,
            }}
          >
            {/* Filter by Change Type */}
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
              <Typography sx={{ fontSize: 12, fontWeight: 800, color: "#475569", mr: 1, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                Filter Type:
              </Typography>
              <Button
                size="small"
                variant={selectedType === "ALL" ? "contained" : "outlined"}
                onClick={() => setSelectedType("ALL")}
                sx={{
                  textTransform: "none",
                  fontSize: 11.5,
                  fontWeight: 700,
                  borderRadius: "20px",
                  py: 0.3,
                  px: 1.75,
                  bgcolor: selectedType === "ALL" ? "#0f172a" : "#ffffff",
                  color: selectedType === "ALL" ? "#ffffff" : "#475569",
                  borderColor: selectedType === "ALL" ? "#0f172a" : "#cbd5e1",
                  "&:hover": { bgcolor: selectedType === "ALL" ? "#1e293b" : "#f1f5f9" },
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
                      fontSize: 11.5,
                      fontWeight: 700,
                      borderRadius: "20px",
                      py: 0.3,
                      px: 1.75,
                      bgcolor: isActive ? colors.text : "#ffffff",
                      color: isActive ? "#ffffff" : colors.text,
                      borderColor: colors.border,
                      "&:hover": { bgcolor: isActive ? colors.text : colors.bg },
                    }}
                  >
                    {type}
                  </Button>
                );
              })}
            </Box>

            {/* Filter by Application */}
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
              <Typography sx={{ fontSize: 12, fontWeight: 800, color: "#475569", mr: 1, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                Filter Apps:
              </Typography>
              <Button
                size="small"
                variant={selectedApps.includes("ALL") ? "contained" : "outlined"}
                onClick={() => handleAppFilterClick("ALL")}
                sx={{
                  textTransform: "none",
                  fontSize: 11.5,
                  fontWeight: 700,
                  borderRadius: "20px",
                  py: 0.3,
                  px: 1.75,
                  bgcolor: selectedApps.includes("ALL") ? "#0f172a" : "#ffffff",
                  color: selectedApps.includes("ALL") ? "#ffffff" : "#475569",
                  borderColor: selectedApps.includes("ALL") ? "#0f172a" : "#cbd5e1",
                  "&:hover": { bgcolor: selectedApps.includes("ALL") ? "#1e293b" : "#f1f5f9" },
                }}
              >
                ALL
              </Button>
              <Button
                size="small"
                variant={selectedApps.includes(selectedApp.name) ? "contained" : "outlined"}
                onClick={() => handleAppFilterClick(selectedApp.name)}
                sx={{
                  textTransform: "none",
                  fontSize: 11.5,
                  fontWeight: 700,
                  borderRadius: "20px",
                  py: 0.3,
                  px: 1.75,
                  bgcolor: selectedApps.includes(selectedApp.name) ? "#10b981" : "#ffffff",
                  color: selectedApps.includes(selectedApp.name) ? "#ffffff" : "#059669",
                  borderColor: "#a7f3d0",
                  "&:hover": { bgcolor: selectedApps.includes(selectedApp.name) ? "#059669" : "#ecfdf5" },
                }}
              >
                {selectedApp.name}
              </Button>
              {competitors.map((comp) => {
                const isActive = selectedApps.includes(comp.name);
                return (
                  <Button
                    key={comp.id}
                    size="small"
                    variant={isActive ? "contained" : "outlined"}
                    onClick={() => handleAppFilterClick(comp.name)}
                    sx={{
                      textTransform: "none",
                      fontSize: 11.5,
                      fontWeight: 700,
                      borderRadius: "20px",
                      py: 0.3,
                      px: 1.75,
                      bgcolor: isActive ? "#0f172a" : "#ffffff",
                      color: isActive ? "#ffffff" : "#0f172a",
                      borderColor: "#e2e8f0",
                      "&:hover": { bgcolor: isActive ? "#1e293b" : "#f8fafc" },
                    }}
                  >
                    {comp.name}
                  </Button>
                );
              })}
            </Box>
          </Box>

          {/* Activity Logs Feed List */}
          <Box sx={{ display: "flex", flexDirection: "column", gap: 1.75 }}>
            {filteredActivities.map((act) => {
              const colors = TYPE_COLORS[act.type] || TYPE_COLORS.TECHNICAL;
              const isOwnApp = act.app_name === selectedApp.name;

              return (
                <Paper
                  key={act.id}
                  elevation={0}
                  sx={{
                    p: 2,
                    borderRadius: "12px",
                    border: "1px solid #e2e8f0",
                    borderLeft: `4px solid ${colors.text}`,
                    bgcolor: "#ffffff",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    flexWrap: "wrap",
                    gap: 2,
                    transition: "all 0.15s ease",
                    "&:hover": { boxShadow: "0 4px 14px rgba(0,0,0,0.03)" },
                  }}
                >
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1.75, flex: 1, minWidth: 0 }}>
                    <Avatar
                      src={getAppIconUrl(act.app_name)}
                      sx={{
                        width: 36,
                        height: 36,
                        bgcolor: getAvatarColor(act.app_name),
                        fontSize: 14,
                        fontWeight: 800,
                      }}
                    >
                      {act.app_name[0]?.toUpperCase()}
                    </Avatar>

                    <Box sx={{ minWidth: 0 }}>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5, flexWrap: "wrap" }}>
                        <Typography sx={{ fontWeight: 800, fontSize: 14, color: "#0f172a" }}>
                          {act.app_name}
                        </Typography>
                        {isOwnApp && (
                          <Chip
                            label="Your App"
                            size="small"
                            sx={{
                              fontSize: 9.5,
                              fontWeight: 800,
                              height: 18,
                              bgcolor: "#ecfdf5",
                              color: "#059669",
                              border: "1px solid #a7f3d0",
                            }}
                          />
                        )}
                        <Chip
                          label={act.type}
                          size="small"
                          sx={{
                            fontSize: 10,
                            fontWeight: 800,
                            height: 18,
                            bgcolor: colors.bg,
                            color: colors.text,
                            border: `1px solid ${colors.border}`,
                          }}
                        />
                      </Box>

                      <Typography sx={{ fontSize: 13, color: "#475569", fontWeight: 500 }}>
                        {act.text}
                      </Typography>
                    </Box>
                  </Box>

                  <Box sx={{ display: "flex", alignItems: "center", gap: 2, flexShrink: 0 }}>
                    {act.has_details && (
                      <Button
                        size="small"
                        onClick={() => setActiveDetails(act)}
                        sx={{
                          fontSize: 12,
                          fontWeight: 700,
                          color: "#0284c7",
                          textTransform: "none",
                          "&:hover": { textDecoration: "underline", bgcolor: "transparent" },
                        }}
                      >
                        Click for details →
                      </Button>
                    )}
                    <Typography sx={{ fontSize: 12, color: "#94a3b8", fontWeight: 600 }}>
                      {new Date(act.date).toLocaleDateString()}
                    </Typography>
                  </Box>
                </Paper>
              );
            })}

            {filteredActivities.length === 0 && (
              <Box sx={{ py: 4, textAlign: "center" }}>
                <Typography sx={{ fontSize: 13.5, color: "#94a3b8", fontWeight: 600 }}>
                  No activity log entries match the selected filters.
                </Typography>
              </Box>
            )}
          </Box>
        </Paper>
      )}

      {/* Details Diff Dialog */}
      <Dialog
        open={!!activeDetails}
        onClose={() => setActiveDetails(null)}
        maxWidth="md"
        fullWidth
        slotProps={{ paper: { sx: { borderRadius: "18px", p: 1 } } }}
      >
        {activeDetails && (
          <>
            <DialogTitle sx={{ pb: 1.5, pt: 2, px: 3 }}>
              <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 2 }}>
                <Box>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                    <Avatar
                      src={getAppIconUrl(activeDetails.app_name)}
                      sx={{
                        width: 32,
                        height: 32,
                        bgcolor: getAvatarColor(activeDetails.app_name),
                        fontSize: 13,
                        fontWeight: 800,
                      }}
                    >
                      {activeDetails.app_name[0]?.toUpperCase()}
                    </Avatar>
                    <Typography variant="h6" sx={{ fontWeight: 800, color: "#0f172a", fontSize: 19 }}>
                      {activeDetails.app_name}
                    </Typography>
                  </Box>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1, mt: 0.5, flexWrap: "wrap" }}>
                    <Chip
                      label={`${activeDetails.type} UPDATE`}
                      size="small"
                      sx={{
                        fontSize: 10,
                        fontWeight: 800,
                        bgcolor: TYPE_COLORS[activeDetails.type]?.bg || "#f1f5f9",
                        color: TYPE_COLORS[activeDetails.type]?.text || "#475569",
                        border: `1px solid ${TYPE_COLORS[activeDetails.type]?.border || "#e2e8f0"}`,
                        height: 20,
                        px: 0.5,
                      }}
                    />
                    <Typography sx={{ fontSize: 13, color: "#64748b", fontWeight: 500 }}>
                      {activeDetails.details?.subtitle || activeDetails.text} • {new Date(activeDetails.date).toLocaleDateString()}
                    </Typography>
                  </Box>
                </Box>
                <IconButton size="small" onClick={() => setActiveDetails(null)} sx={{ color: "#64748b" }}>
                  <CloseIcon sx={{ fontSize: 20 }} />
                </IconButton>
              </Box>
            </DialogTitle>

            <Divider sx={{ borderColor: "#f1f5f9" }} />

            <DialogContent sx={{ py: 3, px: 3, maxHeight: "70vh", overflowY: "auto" }}>
              {activeDetails.details && (() => {
                const prevList = activeDetails.details.previous || [];
                const currList = activeDetails.details.current || [];

                const subtitle = (activeDetails.details?.subtitle || "").toLowerCase();
                const actText = (activeDetails.text || "").toLowerCase();
                const isDescOnly = (subtitle.includes("description") || actText.includes("description text")) && !subtitle.includes("feature");
                const isFeatureOnly = (subtitle.includes("feature list") || actText.includes("feature list")) && !subtitle.includes("description");

                const isSingleParagraphText =
                  prevList.length === 1 &&
                  currList.length === 1 &&
                  (prevList[0].length > 60 || currList[0].length > 60);

                if (isSingleParagraphText || isDescOnly) {
                  const prevText = prevList[0] || "";
                  const currText = currList[0] || "";

                  // When this is purely a description update, diff the full raw text
                  // directly instead of going through parseDescriptionAndListing.
                  // The sentence-heuristic parser can split the text differently for
                  // prev vs curr (or exclude the changed sentences into a hidden
                  // bullets section), making both "desc" portions look identical even
                  // when the underlying texts differ.
                  let prevParsed: ParsedListingData;
                  let currParsed: ParsedListingData;

                  if (isDescOnly) {
                    prevParsed = { desc: prevText, bullets: [] };
                    currParsed = { desc: currText, bullets: [] };
                  } else {
                    prevParsed = parseDescriptionAndListing(
                      prevText,
                      activeDetails.details.previous_features
                    );
                    currParsed = parseDescriptionAndListing(
                      currText,
                      activeDetails.details.current_features
                    );
                  }

                  const alignedBullets = alignLists(prevParsed.bullets, currParsed.bullets);
                  const showDescSection = !isFeatureOnly;
                  const showBulletsSection = !isDescOnly && (prevParsed.bullets.length > 0 || currParsed.bullets.length > 0);

                  return (
                    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 2.5 }}>
                      {/* Previous Column */}
                      <Box
                        sx={{
                          p: 2.5,
                          borderRadius: "14px",
                          bgcolor: "#fff5f5",
                          border: "1px solid #fee2e2",
                          display: "flex",
                          flexDirection: "column",
                          gap: 2.5,
                        }}
                      >
                        <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
                          <RemoveIcon sx={{ fontSize: 16, color: "#dc2626" }} />
                          <Typography sx={{ fontSize: 12, fontWeight: 800, color: "#991b1b", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                            Previous
                          </Typography>
                        </Box>

                        {/* Description Section */}
                        {showDescSection && (
                          <Box sx={{ bgcolor: "#ffffff", p: 2, borderRadius: "10px", border: "1px solid #fecdd3" }}>
                            <Typography sx={{ fontSize: 11, fontWeight: 800, color: "#991b1b", textTransform: "uppercase", letterSpacing: "0.05em", mb: 1 }}>
                              Description Text
                            </Typography>
                            <Typography sx={{ fontSize: 13.5, color: "#7f1d1d", lineHeight: 1.6 }}>
                              <RenderDiffText prevText={prevParsed.desc} currText={currParsed.desc} mode="previous" />
                            </Typography>
                          </Box>
                        )}

                        {/* Listing / Features Section */}
                        {showBulletsSection && (
                          <Box sx={{ bgcolor: "#ffffff", p: 2, borderRadius: "10px", border: "1px solid #fecdd3" }}>
                            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1.5 }}>
                              <Typography sx={{ fontSize: 11, fontWeight: 800, color: "#991b1b", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                                Listing (Key Features) ({prevParsed.bullets.length})
                              </Typography>
                            </Box>
                            <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                              {alignedBullets.map((row, idx) => {
                                const item = row.prev;
                                const isRemoved = item && !row.curr;

                                if (!item) {
                                  return (
                                    <Box
                                      key={idx}
                                      sx={{
                                        p: 1.25,
                                        borderRadius: "8px",
                                        bgcolor: "#f8fafc",
                                        border: "1px dashed #e2e8f0",
                                        minHeight: 38,
                                        opacity: 0.4,
                                      }}
                                    />
                                  );
                                }

                                return (
                                  <Paper
                                    key={idx}
                                    elevation={0}
                                    sx={{
                                      p: 1.25,
                                      px: 1.5,
                                      borderRadius: "8px",
                                      border: isRemoved ? "1px solid #fee2e2" : "1px solid #e2e8f0",
                                      bgcolor: isRemoved ? "#fef2f2" : "#ffffff",
                                      display: "flex",
                                      alignItems: "flex-start",
                                      gap: 1,
                                    }}
                                  >
                                    <Typography sx={{ color: isRemoved ? "#dc2626" : "#64748b", fontWeight: 800, fontSize: 15, lineHeight: 1.3 }}>
                                      •
                                    </Typography>
                                    <Typography
                                      sx={{
                                        fontSize: 13,
                                        fontWeight: isRemoved ? 700 : 500,
                                        color: isRemoved ? "#dc2626" : "#334155",
                                        lineHeight: 1.5,
                                      }}
                                    >
                                      <RenderDiffText prevText={row.prev || ""} currText={row.curr || ""} mode="previous" />
                                    </Typography>
                                  </Paper>
                                );
                              })}
                            </Box>
                          </Box>
                        )}
                      </Box>

                      {/* Current Column */}
                      <Box
                        sx={{
                          p: 2.5,
                          borderRadius: "14px",
                          bgcolor: "#f0fdf4",
                          border: "1px solid #d1fae5",
                          display: "flex",
                          flexDirection: "column",
                          gap: 2.5,
                        }}
                      >
                        <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
                          <AddIcon sx={{ fontSize: 16, color: "#059669" }} />
                          <Typography sx={{ fontSize: 12, fontWeight: 800, color: "#065f46", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                            Current
                          </Typography>
                        </Box>

                        {/* Description Section */}
                        {showDescSection && (
                          <Box sx={{ bgcolor: "#ffffff", p: 2, borderRadius: "10px", border: "1px solid #a7f3d0" }}>
                            <Typography sx={{ fontSize: 11, fontWeight: 800, color: "#065f46", textTransform: "uppercase", letterSpacing: "0.05em", mb: 1 }}>
                              Description Text
                            </Typography>
                            <Typography sx={{ fontSize: 13.5, color: "#047857", lineHeight: 1.6 }}>
                              <RenderDiffText prevText={prevParsed.desc} currText={currParsed.desc} mode="current" />
                            </Typography>
                          </Box>
                        )}

                        {/* Listing / Features Section */}
                        {showBulletsSection && (
                          <Box sx={{ bgcolor: "#ffffff", p: 2, borderRadius: "10px", border: "1px solid #a7f3d0" }}>
                            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1.5 }}>
                              <Typography sx={{ fontSize: 11, fontWeight: 800, color: "#065f46", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                                Listing (Key Features) ({currParsed.bullets.length})
                              </Typography>
                            </Box>
                            <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                              {alignedBullets.map((row, idx) => {
                                const item = row.curr;
                                const isNew = item && !row.prev;

                                if (!item) {
                                  return (
                                    <Box
                                      key={idx}
                                      sx={{
                                        p: 1.25,
                                        borderRadius: "8px",
                                        bgcolor: "#f8fafc",
                                        border: "1px dashed #e2e8f0",
                                        minHeight: 38,
                                        opacity: 0.4,
                                      }}
                                    />
                                  );
                                }

                                return (
                                  <Paper
                                    key={idx}
                                    elevation={0}
                                    sx={{
                                      p: 1.25,
                                      px: 1.5,
                                      borderRadius: "8px",
                                      border: isNew ? "1px solid #a7f3d0" : "1px solid #e2e8f0",
                                      bgcolor: isNew ? "#ecfdf5" : "#ffffff",
                                      display: "flex",
                                      alignItems: "flex-start",
                                      justifyContent: "space-between",
                                      gap: 1,
                                    }}
                                  >
                                    <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1 }}>
                                      <Typography sx={{ color: isNew ? "#059669" : "#64748b", fontWeight: 800, fontSize: 15, lineHeight: 1.3 }}>
                                        •
                                      </Typography>
                                      <Typography
                                        sx={{
                                          fontSize: 13,
                                          fontWeight: isNew ? 700 : 500,
                                          color: isNew ? "#059669" : "#334155",
                                          lineHeight: 1.5,
                                        }}
                                      >
                                        <RenderDiffText prevText={row.prev || ""} currText={row.curr || ""} mode="current" />
                                      </Typography>
                                    </Box>

                                    {isNew && (
                                      <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, flexShrink: 0, mt: 0.2 }}>
                                        <Chip
                                          label="NEW"
                                          size="small"
                                          sx={{
                                            fontSize: 9.5,
                                            fontWeight: 800,
                                            height: 18,
                                            bgcolor: "#059669",
                                            color: "#ffffff",
                                          }}
                                        />
                                        <CheckCircleIcon sx={{ fontSize: 15, color: "#059669" }} />
                                      </Box>
                                    )}
                                  </Paper>
                                );
                              })}
                            </Box>
                          </Box>
                        )}
                      </Box>
                    </Box>
                  );
                }

                const aligned = alignLists(prevList, currList);

                return (
                  <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 2 }}>
                    {/* Previous List Items Column */}
                    <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                      <Typography sx={{ fontSize: 12, fontWeight: 800, color: "#991b1b", textTransform: "uppercase", letterSpacing: "0.05em", mb: 0.5 }}>
                        PREVIOUS ({prevList.length})
                      </Typography>
                      {aligned.map((row, idx) => {
                        const item = row.prev;
                        const isRemoved = item && !row.curr;

                        if (!item) {
                          return (
                            <Box
                              key={idx}
                              sx={{
                                p: 1.5,
                                borderRadius: "10px",
                                bgcolor: "#f8fafc",
                                border: "1px dashed #e2e8f0",
                                minHeight: 44,
                                opacity: 0.4,
                              }}
                            />
                          );
                        }

                        return (
                          <Paper
                            key={idx}
                            elevation={0}
                            sx={{
                              p: 1.5,
                              px: 2,
                              borderRadius: "10px",
                              border: isRemoved ? "1px solid #fee2e2" : "1px solid #e2e8f0",
                              bgcolor: isRemoved ? "#fef2f2" : "#ffffff",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                            }}
                          >
                            <Typography
                              sx={{
                                fontSize: 13.5,
                                fontWeight: isRemoved ? 700 : 600,
                                color: isRemoved ? "#dc2626" : "#334155",
                              }}
                            >
                              <RenderDiffText prevText={row.prev || ""} currText={row.curr || ""} mode="previous" />
                            </Typography>
                          </Paper>
                        );
                      })}
                    </Box>

                    {/* Current List Items Column */}
                    <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                      <Typography sx={{ fontSize: 12, fontWeight: 800, color: "#065f46", textTransform: "uppercase", letterSpacing: "0.05em", mb: 0.5 }}>
                        CURRENT ({currList.length})
                      </Typography>
                      {aligned.map((row, idx) => {
                        const item = row.curr;
                        const isNew = item && !row.prev;

                        if (!item) {
                          return (
                            <Box
                              key={idx}
                              sx={{
                                p: 1.5,
                                borderRadius: "10px",
                                bgcolor: "#f8fafc",
                                border: "1px dashed #e2e8f0",
                                minHeight: 44,
                                opacity: 0.4,
                              }}
                            />
                          );
                        }

                        return (
                          <Paper
                            key={idx}
                            elevation={0}
                            sx={{
                              p: 1.5,
                              px: 2,
                              borderRadius: "10px",
                              border: isNew ? "1px solid #a7f3d0" : "1px solid #e2e8f0",
                              bgcolor: isNew ? "#ecfdf5" : "#ffffff",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                            }}
                          >
                            <Typography
                              sx={{
                                fontSize: 13.5,
                                fontWeight: isNew ? 700 : 600,
                                color: isNew ? "#059669" : "#334155",
                              }}
                            >
                              <RenderDiffText prevText={row.prev || ""} currText={row.curr || ""} mode="current" />
                            </Typography>

                            {isNew && (
                              <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
                                <Chip
                                  label="NEW"
                                  size="small"
                                  sx={{
                                    fontSize: 9.5,
                                    fontWeight: 800,
                                    height: 18,
                                    bgcolor: "#059669",
                                    color: "#ffffff",
                                  }}
                                />
                                <CheckCircleIcon sx={{ fontSize: 16, color: "#059669" }} />
                              </Box>
                            )}
                          </Paper>
                        );
                      })}
                    </Box>
                  </Box>
                );
              })()}
            </DialogContent>

            <Divider sx={{ borderColor: "#f1f5f9" }} />

            <DialogActions sx={{ px: 3, py: 2 }}>
              <Button
                onClick={() => setActiveDetails(null)}
                variant="outlined"
                sx={{
                  borderColor: "#cbd5e1",
                  color: "#475569",
                  bgcolor: "#ffffff",
                  textTransform: "none",
                  fontWeight: 700,
                  fontSize: 13,
                  borderRadius: "8px",
                  px: 2.5,
                  py: 0.6,
                  "&:hover": { borderColor: "#94a3b8", bgcolor: "#f8fafc" },
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
