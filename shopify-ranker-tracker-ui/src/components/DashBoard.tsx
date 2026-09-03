// React
import { useEffect, useMemo, useState } from "react";

// Third-party
import {
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Container,
  Paper,
  Typography,
} from "@mui/material";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import SearchIcon from "@mui/icons-material/Search";
import StorefrontIcon from "@mui/icons-material/Storefront";
import LaunchIcon from "@mui/icons-material/Launch";
import BarChartIcon from "@mui/icons-material/BarChart";
import PeopleIcon from "@mui/icons-material/People";
import ExtensionIcon from "@mui/icons-material/Extension";
import { motion } from "motion/react";

// API
import { api } from "../api";
import type { App, Competitor, KeywordHistory } from "../api";

// Components
import HistoryLog from "./HistoryLog";
import KeywordsDialog from "./KeywordsDialog";
import MetricCards from "./MetricCards";
import RankChart from "./RankChart";
import ScreenshotDialog from "./ScreenshotDialog";

interface DashboardProps {
  selectedApp: App | null;
  apiUrl: string;
  onRefreshApps: () => Promise<void>;
  onUpdateSelectedApp: (app: App) => void;
  showToast: (message: string, severity?: "success" | "error" | "info") => void;
  apps?: App[];
  onSelectApp?: (app: App) => void;
  onNavigate?: (page: "dashboard" | "history" | "settings" | "optimizer" | "competitors" | "integrations") => void;
}

const AVATAR_COLORS = [
  "#f97316", "#14b8a6", "#3b82f6", "#8b5cf6", "#ec4899", "#10b981", "#f59e0b", "#ef4444",
];

function getAvatarColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

export default function Dashboard({
  selectedApp,
  apiUrl,
  onUpdateSelectedApp,
  showToast,
  apps = [],
  onSelectApp,
  onNavigate,
}: DashboardProps) {
  const [historyData, setHistoryData] = useState<KeywordHistory[]>([]);
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [selectedKeywords, setSelectedKeywords] = useState<number[]>([]);
  const [daysRange, setDaysRange] = useState<number>(30);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [isAddingKeywords, setIsAddingKeywords] = useState(false);
  const [viewScreenshotPath, setViewScreenshotPath] = useState<string | null>(null);
  const [keywordsDialogOpen, setKeywordsDialogOpen] = useState(false);
  const [listingScore, setListingScore] = useState<number | null>(null);

  const fetchCompetitors = async () => {
    if (!selectedApp) return;
    try {
      const data = await api.getCompetitors(selectedApp.id);
      setCompetitors(data.competitors || []);
    } catch (err) {
      console.error("Failed to load competitors", err);
    }
  };

  const handleAddCompetitor = async (name: string, url: string) => {
    if (!selectedApp) return;
    await api.addCompetitor(selectedApp.id, name, url);
    showToast(`Added competitor: ${name}`, "success");
    await fetchCompetitors();
    await fetchHistory();
  };

  const handleDeleteCompetitor = async (comp: Competitor) => {
    if (!selectedApp) return;
    await api.removeCompetitor(selectedApp.id, comp.id);
    showToast(`Removed competitor: ${comp.name}`, "success");
    await fetchCompetitors();
    await fetchHistory();
  };

  useEffect(() => {
    if (!selectedApp) {
      setListingScore(null);
      setHistoryData([]);
      setSelectedKeywords([]);
      setCompetitors([]);
      return;
    }

    fetchCompetitors();

    let isMounted = true;
    setIsLoadingHistory(true);
    const kwIds = selectedApp.keywords.map((k) => k.id);
    const effectiveDays = daysRange === 1 ? 2 : daysRange;

    Promise.allSettled([
      api.getListingAudit(selectedApp.id),
      kwIds.length > 0 ? api.getHistory(selectedApp.id, kwIds, effectiveDays) : Promise.resolve({ keywords: [] }),
    ]).then(([auditRes, historyRes]) => {
      if (!isMounted) return;

      if (auditRes.status === "fulfilled" && auditRes.value && typeof auditRes.value.overall_score === "number") {
        setListingScore(auditRes.value.overall_score);
      } else {
        setListingScore(null);
      }

      if (historyRes.status === "fulfilled") {
        setHistoryData(historyRes.value.keywords || []);
        setSelectedKeywords((prev) => {
          const isValidPrev = prev.length > 0 && prev.every((id) => kwIds.includes(id));
          return isValidPrev ? prev : kwIds;
        });
      }

      setIsLoadingHistory(false);
    });

    return () => {
      isMounted = false;
    };
  }, [selectedApp, daysRange]);

  const fetchHistory = async () => {
    if (!selectedApp) return;
    const kwIds = selectedApp.keywords.map((k) => k.id);
    if (kwIds.length === 0) {
      setHistoryData([]);
      return;
    }
    setIsLoadingHistory(true);
    try {
      const data = await api.getHistory(selectedApp.id, kwIds, daysRange);
      setHistoryData(data.keywords || []);
    } catch (err) {
      console.error("Failed to fetch history", err);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const handleAddKeywords = async (keywordsList: string[]) => {
    if (!selectedApp || keywordsList.length === 0) return;
    setIsAddingKeywords(true);
    try {
      const res = await api.addKeywords(selectedApp.id, keywordsList);
      if (res.keywords) {
        onUpdateSelectedApp({ ...selectedApp, keywords: res.keywords });
      }
      const hasDuplicates = res.duplicates && res.duplicates.length > 0;
      const addedCount = res.added ? res.added.length : 0;
      
      if (hasDuplicates && addedCount === 0) {
        showToast(res.message || "Keyword(s) already in the list", "info");
      } else if (hasDuplicates) {
        showToast(res.message || `Added ${addedCount} keyword(s). Duplicate(s) skipped`, "info");
      } else {
        showToast(res.message || `Added ${keywordsList.length} keyword(s)`, "success");
      }
      setKeywordsDialogOpen(false);
      await fetchHistory();
    } catch (err: any) {
      showToast(err?.message || "Failed to add keywords", "error");
    } finally {
      setIsAddingKeywords(false);
    }
  };

  const handleRemoveKeyword = async (kwId: number) => {
    if (!selectedApp) return;
    try {
      await api.removeKeyword(selectedApp.id, kwId);
      const updatedKeywords = selectedApp.keywords.filter((k) => k.id !== kwId);
      onUpdateSelectedApp({ ...selectedApp, keywords: updatedKeywords });
      setSelectedKeywords((prev) => prev.filter((id) => id !== kwId));
      showToast("Keyword deleted", "info");
      await fetchHistory();
    } catch (err: any) {
      showToast(err?.message || "Failed to delete keyword", "error");
    }
  };

  const handleToggleKeywordSelect = (kwId: number) => {
    setSelectedKeywords((prev) =>
      prev.includes(kwId) ? prev.filter((id) => id !== kwId) : [...prev, kwId]
    );
  };

  const tableRows = useMemo(() => {
    const rows: any[] = [];
    historyData.forEach((item) => {
      if (item.history && item.history.length > 0) {
        item.history.forEach((h: any) => {
          rows.push({
            id: h.id,
            appName: selectedApp?.name || "Main App",
            isCompetitor: false,
            keyword: item.keyword ? item.keyword.name : "",
            rank: h.rank,
            page: h.page,
            found: h.found,
            screenshot_path: h.screenshot_path,
            tracked_date: h.tracked_date,
          });
        });
      }
    });
    return rows;
  }, [historyData, selectedApp]);

  const metrics = useMemo(() => {
    if (!selectedApp || selectedApp.keywords.length === 0) {
      return {
        totalKeywords: 0,
        currentAvgRank: "--",
        successRate: "--",
        topPositions: 0,
      };
    }

    const totalKeywords = selectedApp.keywords.length;
    let rankSum = 0;
    let rankedCount = 0;
    let top5Count = 0;

    historyData.forEach((kw) => {
      if (kw.history && kw.history.length > 0) {
        const latest = kw.history[kw.history.length - 1];
        if (latest.rank && latest.rank > 0) {
          rankSum += latest.rank;
          rankedCount++;
          if (latest.rank <= 5) top5Count++;
        }
      }
    });

    const currentAvgRank = rankedCount > 0 ? `#${(rankSum / rankedCount).toFixed(1)}` : "--";
    const successRate = totalKeywords > 0 ? `${Math.round((rankedCount / totalKeywords) * 100)}%` : "0%";

    return {
      totalKeywords,
      currentAvgRank,
      successRate,
      topPositions: top5Count,
    };
  }, [selectedApp, historyData]);

  const portfolioStats = useMemo(() => {
    const totalApps = apps.length;
    let totalKeywords = 0;
    apps.forEach((a) => {
      totalKeywords += a.keywords ? a.keywords.length : 0;
    });
    return { totalApps, totalKeywords };
  }, [apps]);

  return (
    <Container maxWidth="xl" sx={{ p: "0 !important" }}>
      {!selectedApp ? (
        <Box
          component={motion.div}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          {/* Welcome Banner */}
          <Paper
            elevation={0}
            sx={{
              p: { xs: 3.5, md: 5 },
              borderRadius: "24px",
              background: "linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)",
              border: "1px solid #e2e8f0",
              boxShadow: "0 10px 30px -10px rgba(15, 23, 42, 0.05)",
              mb: 4,
              position: "relative",
              overflow: "hidden",
            }}
          >
            <Box sx={{ position: "relative", zIndex: 1, maxWidth: 680 }}>
              <Box sx={{ display: "inline-flex", alignItems: "center", gap: 1, px: 1.75, py: 0.6, borderRadius: "20px", bgcolor: "#ecfdf5", border: "1px solid #a7f3d0", mb: 2 }}>
                <Box sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: "#10b981" }} />
                <Typography sx={{ fontSize: 12, fontWeight: 700, color: "#047857" }}>
                  System Active & Scrapers Ready
                </Typography>
              </Box>

              <Typography variant="h4" sx={{ fontWeight: 800, fontSize: { xs: 26, sm: 32 }, lineHeight: 1.2, mb: 1.5, color: "#0f172a" }}>
                Shopify Rank Tracker Overview
              </Typography>
              <Typography sx={{ color: "#475569", fontSize: 15, lineHeight: 1.6, mb: 3 }}>
                Monitor live keyword search positions across the Shopify App Store, analyze head-to-head competitor rankings, and optimize listing scores.
              </Typography>

              <Box sx={{ display: "flex", flexWrap: "wrap", gap: 4, pt: 2.5, borderTop: "1px solid #e2e8f0" }}>
                <Box>
                  <Typography sx={{ fontSize: 11.5, color: "#64748b", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>Tracked Apps</Typography>
                  <Typography sx={{ fontSize: 26, fontWeight: 800, color: "#0f172a" }}>{portfolioStats.totalApps}</Typography>
                </Box>
                <Box>
                  <Typography sx={{ fontSize: 11.5, color: "#64748b", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>Active Keywords</Typography>
                  <Typography sx={{ fontSize: 26, fontWeight: 800, color: "#3b82f6" }}>{portfolioStats.totalKeywords}</Typography>
                </Box>
                <Box>
                  <Typography sx={{ fontSize: 11.5, color: "#64748b", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>Auto Daily Scans</Typography>
                  <Typography sx={{ fontSize: 26, fontWeight: 800, color: "#10b981" }}>24/7 Active</Typography>
                </Box>
              </Box>
            </Box>
          </Paper>

          {/* Tracked Apps Grid Section */}
          <Box sx={{ mb: 5 }}>
            <Typography sx={{ fontSize: 18, fontWeight: 800, color: "#0f172a", mb: 2.5 }}>
              Your Tracked Shopify Apps
            </Typography>

            {apps.length === 0 ? (
              <Paper
                elevation={0}
                sx={{
                  p: 5,
                  textAlign: "center",
                  borderRadius: "20px",
                  border: "1px dashed #cbd5e1",
                  bgcolor: "#ffffff",
                }}
              >
                <Box sx={{ width: 64, height: 64, borderRadius: "16px", bgcolor: "#f1f5f9", display: "inline-flex", alignItems: "center", justifyContent: "center", color: "#0f172a", mb: 2 }}>
                  <StorefrontIcon sx={{ fontSize: 32 }} />
                </Box>
                <Typography sx={{ fontWeight: 800, fontSize: 18, color: "#0f172a", mb: 1 }}>
                  No Shopify Apps Tracked Yet
                </Typography>
                <Typography sx={{ fontSize: 14, color: "#64748b", maxWidth: 440, mx: "auto", mb: 3 }}>
                  Start tracking your app store positions by adding your first Shopify App URL and keywords in the sidebar.
                </Typography>
              </Paper>
            ) : (
              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)", md: "repeat(3, 1fr)" },
                  gap: 3,
                }}
              >
                {apps.map((app) => {
                  const color = getAvatarColor(app.name);
                  return (
                    <Card
                      key={app.id}
                      component={motion.div}
                      whileHover={{ y: -5, scale: 1.015 }}
                      transition={{ type: "spring", stiffness: 400, damping: 22 }}
                      elevation={0}
                      sx={{
                        borderRadius: "18px",
                        border: "1px solid #e2e8f0",
                        bgcolor: "#ffffff",
                        boxShadow: "0 4px 20px -2px rgba(15, 23, 42, 0.03)",
                        cursor: "pointer",
                        overflow: "hidden",
                        display: "flex",
                        flexDirection: "column",
                        justifyContent: "space-between",
                        "&:hover": {
                          borderColor: color,
                          boxShadow: `0 12px 28px -4px ${color}25`,
                        },
                      }}
                      onClick={() => {
                        if (onSelectApp) onSelectApp(app);
                      }}
                    >
                      <Box sx={{ height: 4, bgcolor: color }} />
                      <CardContent sx={{ p: 3 }}>
                        <Box sx={{ display: "flex", alignItems: "flex-start", gap: 2, mb: 2.5 }}>
                          <Avatar
                            src={app.icon_url || undefined}
                            sx={{
                              width: 48,
                              height: 48,
                              fontSize: 18,
                              fontWeight: 800,
                              bgcolor: color,
                              boxShadow: `0 4px 12px ${color}35`,
                            }}
                          >
                            {app.name[0]?.toUpperCase()}
                          </Avatar>
                          <Box sx={{ minWidth: 0, flex: 1 }}>
                            <Typography sx={{ fontWeight: 800, fontSize: 16, color: "#0f172a", mb: 0.25 }} noWrap title={app.name}>
                              {app.name}
                            </Typography>
                            <Typography sx={{ fontSize: 12, color: "#64748b" }} noWrap title={app.url}>
                              {app.url}
                            </Typography>
                          </Box>
                        </Box>

                        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", pt: 2, borderTop: "1px solid #f1f5f9" }}>
                          <Chip
                            icon={<SearchIcon sx={{ fontSize: 14 }} />}
                            label={`${app.keywords ? app.keywords.length : 0} Keywords`}
                            size="small"
                            sx={{
                              fontSize: 12,
                              fontWeight: 700,
                              bgcolor: "#f8fafc",
                              color: "#475569",
                              border: "1px solid #e2e8f0",
                              height: 26,
                            }}
                          />

                          <Button
                            size="small"
                            endIcon={<ArrowForwardIcon sx={{ fontSize: 14 }} />}
                            sx={{
                              fontSize: 13,
                              fontWeight: 700,
                              color: color,
                              textTransform: "none",
                            }}
                          >
                            View Rankings
                          </Button>
                        </Box>
                      </CardContent>
                    </Card>
                  );
                })}
              </Box>
            )}
          </Box>

          {/* Platform Features & Tools Section */}
          <Box sx={{ mt: 5, mb: 3 }}>
            <Typography sx={{ fontSize: 18, fontWeight: 800, color: "#0f172a", mb: 2.5 }}>
              Platform Features & Tools
            </Typography>
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: { xs: "1fr", md: "repeat(3, 1fr)" },
                gap: 3,
              }}
            >
              {/* Tool 1: App Listing Optimizer */}
              <Paper
                elevation={0}
                component={motion.div}
                whileHover={{ y: -4 }}
                transition={{ type: "spring", stiffness: 400, damping: 25 }}
                sx={{
                  p: 3,
                  borderRadius: "18px",
                  border: "1px solid #e2e8f0",
                  bgcolor: "#ffffff",
                  boxShadow: "0 4px 20px -2px rgba(15, 23, 42, 0.03)",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  transition: "all 0.2s ease-in-out",
                  "&:hover": { borderColor: "#3b82f6", boxShadow: "0 10px 25px rgba(59, 130, 246, 0.1)" },
                }}
              >
                <Box>
                  <Box sx={{ width: 42, height: 42, borderRadius: "12px", bgcolor: "#eff6ff", color: "#3b82f6", display: "flex", alignItems: "center", justifyContent: "center", mb: 2 }}>
                    <BarChartIcon sx={{ fontSize: 22 }} />
                  </Box>
                  <Typography sx={{ fontWeight: 800, fontSize: 16, color: "#0f172a", mb: 0.75 }}>
                    App Listing Optimizer
                  </Typography>
                  <Typography sx={{ fontSize: 13, color: "#64748b", lineHeight: 1.5, mb: 2 }}>
                    Analyze app titles, subtitles, and descriptions to improve ASO visibility scores.
                  </Typography>
                </Box>
                <Button
                  size="small"
                  onClick={() => onNavigate && onNavigate("optimizer")}
                  sx={{ fontSize: 13, fontWeight: 700, color: "#3b82f6", textTransform: "none", p: 0, justifyContent: "flex-start", "&:hover": { textDecoration: "underline" } }}
                >
                  Open Listing Optimizer →
                </Button>
              </Paper>

              {/* Tool 2: Competitor Intelligence */}
              <Paper
                elevation={0}
                component={motion.div}
                whileHover={{ y: -4 }}
                transition={{ type: "spring", stiffness: 400, damping: 25 }}
                sx={{
                  p: 3,
                  borderRadius: "18px",
                  border: "1px solid #e2e8f0",
                  bgcolor: "#ffffff",
                  boxShadow: "0 4px 20px -2px rgba(15, 23, 42, 0.03)",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  transition: "all 0.2s ease-in-out",
                  "&:hover": { borderColor: "#8b5cf6", boxShadow: "0 10px 25px rgba(139, 92, 246, 0.1)" },
                }}
              >
                <Box>
                  <Box sx={{ width: 42, height: 42, borderRadius: "12px", bgcolor: "#faf5ff", color: "#8b5cf6", display: "flex", alignItems: "center", justifyContent: "center", mb: 2 }}>
                    <PeopleIcon sx={{ fontSize: 22 }} />
                  </Box>
                  <Typography sx={{ fontWeight: 800, fontSize: 16, color: "#0f172a", mb: 0.75 }}>
                    Competitor Intelligence
                  </Typography>
                  <Typography sx={{ fontSize: 13, color: "#64748b", lineHeight: 1.5, mb: 2 }}>
                    Compare side-by-side keyword rankings against top competitors head-to-head.
                  </Typography>
                </Box>
                <Button
                  size="small"
                  onClick={() => onNavigate && onNavigate("competitors")}
                  sx={{ fontSize: 13, fontWeight: 700, color: "#8b5cf6", textTransform: "none", p: 0, justifyContent: "flex-start", "&:hover": { textDecoration: "underline" } }}
                >
                  Manage Competitors →
                </Button>
              </Paper>

              {/* Tool 3: Slack & Webhook Alerts */}
              <Paper
                elevation={0}
                component={motion.div}
                whileHover={{ y: -4 }}
                transition={{ type: "spring", stiffness: 400, damping: 25 }}
                sx={{
                  p: 3,
                  borderRadius: "18px",
                  border: "1px solid #e2e8f0",
                  bgcolor: "#ffffff",
                  boxShadow: "0 4px 20px -2px rgba(15, 23, 42, 0.03)",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  transition: "all 0.2s ease-in-out",
                  "&:hover": { borderColor: "#10b981", boxShadow: "0 10px 25px rgba(16, 185, 129, 0.1)" },
                }}
              >
                <Box>
                  <Box sx={{ width: 42, height: 42, borderRadius: "12px", bgcolor: "#f0fdf4", color: "#10b981", display: "flex", alignItems: "center", justifyContent: "center", mb: 2 }}>
                    <ExtensionIcon sx={{ fontSize: 22 }} />
                  </Box>
                  <Typography sx={{ fontWeight: 800, fontSize: 16, color: "#0f172a", mb: 0.75 }}>
                    Slack & Webhook Alerts
                  </Typography>
                  <Typography sx={{ fontSize: 13, color: "#64748b", lineHeight: 1.5, mb: 2 }}>
                    Connect Slack channels to get instant automated rank changes & keyword alerts.
                  </Typography>
                </Box>
                <Button
                  size="small"
                  onClick={() => onNavigate && onNavigate("integrations")}
                  sx={{ fontSize: 13, fontWeight: 700, color: "#10b981", textTransform: "none", p: 0, justifyContent: "flex-start", "&:hover": { textDecoration: "underline" } }}
                >
                  Configure Integrations →
                </Button>
              </Paper>
            </Box>
          </Box>
        </Box>
      ) : (
        /* Selected App Detailed Dashboard */
        <Box
          component={motion.div}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          {/* Selected App Header Card */}
          <Paper
            elevation={0}
            sx={{
              p: { xs: 3, md: 4 },
              borderRadius: "20px",
              border: "1px solid #e2e8f0",
              background: "linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)",
              boxShadow: "0 4px 20px -2px rgba(15, 23, 42, 0.03)",
              mb: 3.5,
              display: "flex",
              flexDirection: { xs: "column", sm: "row" },
              alignItems: { xs: "flex-start", sm: "center" },
              justifyContent: "space-between",
              gap: 2.5,
            }}
          >
            <Box sx={{ display: "flex", alignItems: "center", gap: 2.5 }}>
              <Avatar
                src={selectedApp.icon_url || undefined}
                sx={{
                  width: 56,
                  height: 56,
                  fontSize: 22,
                  fontWeight: 800,
                  bgcolor: getAvatarColor(selectedApp.name),
                  boxShadow: `0 4px 14px ${getAvatarColor(selectedApp.name)}40`,
                }}
              >
                {selectedApp.name[0]?.toUpperCase()}
              </Avatar>
              <Box>
                <Typography variant="h5" sx={{ fontWeight: 800, color: "#0f172a", fontSize: { xs: 20, sm: 24 } }}>
                  {selectedApp.name}
                </Typography>
                <Typography
                  component="a"
                  href={selectedApp.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  sx={{
                    fontSize: 13,
                    color: "#3b82f6",
                    textDecoration: "none",
                    fontWeight: 600,
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 0.5,
                    "&:hover": { textDecoration: "underline" },
                  }}
                >
                  {selectedApp.url} <LaunchIcon sx={{ fontSize: 13 }} />
                </Typography>
              </Box>
            </Box>

            <Box sx={{ display: "flex", gap: 1.5, width: { xs: "100%", sm: "auto" } }}>
              <Button
                variant="outlined"
                onClick={() => setKeywordsDialogOpen(true)}
                startIcon={<SearchIcon sx={{ fontSize: 18 }} />}
                sx={{
                  borderRadius: "10px",
                  borderColor: "#e2e8f0",
                  color: "#0f172a",
                  fontWeight: 700,
                  fontSize: 13,
                  textTransform: "none",
                  py: 1,
                  px: 2,
                  "&:hover": { borderColor: "#cbd5e1", bgcolor: "#f8fafc" },
                }}
              >
                Manage Keywords
              </Button>
            </Box>
          </Paper>

          {/* Metric Cards Row */}
          <MetricCards
            totalKeywords={metrics.totalKeywords}
            currentAvgRank={metrics.currentAvgRank}
            successRate={metrics.successRate}
            topPositions={metrics.topPositions}
            listingScore={listingScore}
          />

          {/* Rank Chart Visualization */}
          <RankChart
            historyData={historyData}
            selectedKeywords={selectedKeywords}
            onToggleKeyword={handleToggleKeywordSelect}
            daysRange={daysRange}
            onRangeChange={setDaysRange}
            keywords={selectedApp.keywords}
            isLoadingHistory={isLoadingHistory}
            onManageKeywords={() => setKeywordsDialogOpen(true)}
          />

          {/* HistoryLog Component: Manage Competitors, Summary Cards, and Ranking History Table */}
          <Box sx={{ mt: 4 }}>
            <HistoryLog
              selectedApp={selectedApp}
              historyData={historyData}
              competitors={competitors}
              onAddCompetitor={handleAddCompetitor}
              onDeleteCompetitor={handleDeleteCompetitor}
              onViewScreenshot={(path) => setViewScreenshotPath(path)}
              tableRows={tableRows}
              onRefresh={fetchHistory}
            />
          </Box>

          {/* Dialogs */}
          <KeywordsDialog
            open={keywordsDialogOpen}
            onClose={() => setKeywordsDialogOpen(false)}
            keywords={selectedApp.keywords}
            onAddKeywords={handleAddKeywords}
            onRemoveKeyword={(id) => handleRemoveKeyword(id)}
            isLoading={isAddingKeywords}
          />

          <ScreenshotDialog
            open={!!viewScreenshotPath}
            onClose={() => setViewScreenshotPath(null)}
            screenshotUrl={viewScreenshotPath ? `${apiUrl}${viewScreenshotPath}` : null}
            onShowMessage={showToast}
          />
        </Box>
      )}
    </Container>
  );
}