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
import BarChartIcon from "@mui/icons-material/BarChart";
import ExtensionIcon from "@mui/icons-material/Extension";
import PeopleIcon from "@mui/icons-material/People";
import SearchIcon from "@mui/icons-material/Search";
import StorefrontIcon from "@mui/icons-material/Storefront";
import LaunchIcon from "@mui/icons-material/Launch";

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
  onRefreshApps,
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

    Promise.allSettled([
      api.getListingAudit(selectedApp.id),
      kwIds.length > 0 ? api.getHistory(selectedApp.id, kwIds, daysRange) : Promise.resolve({ keywords: [] }),
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
      const res = await api.getHistory(selectedApp.id, kwIds, daysRange);
      setHistoryData(res.keywords || []);
    } catch (err) {
      console.error("Failed to fetch history", err);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const getScreenshotUrl = (relativePath: string) => {
    if (!relativePath) return "";
    if (relativePath.startsWith("http://") || relativePath.startsWith("https://")) {
      return relativePath;
    }
    const cleanPath = relativePath.replace(/^\/+/, "");
    const cleanApiUrl = apiUrl.replace(/\/+$/, "");
    return `${cleanApiUrl}/${cleanPath}`;
  };

  const handleToggleKeyword = (kwId: number) => {
    setSelectedKeywords((prev) =>
      prev.includes(kwId) ? prev.filter((id) => id !== kwId) : [...prev, kwId]
    );
  };

  const handleAddKeywords = async (keywordsList: string[]) => {
    if (!selectedApp) return;
    setIsAddingKeywords(true);
    try {
      await api.addKeywords(selectedApp.id, keywordsList);
      showToast(`Added ${keywordsList.length} keyword(s)`, "success");
      await onRefreshApps();
      const updatedApps = await api.getApps();
      const match = updatedApps.apps.find((a) => a.id === selectedApp.id);
      if (match) {
        onUpdateSelectedApp(match);
        const newKwIds = match.keywords.map((k) => k.id);
        setSelectedKeywords(newKwIds);
      }
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
      showToast("Keyword removed", "success");
      await onRefreshApps();
      const updatedApps = await api.getApps();
      const match = updatedApps.apps.find((a) => a.id === selectedApp.id);
      if (match) {
        onUpdateSelectedApp(match);
        setSelectedKeywords((prev) => prev.filter((id) => id !== kwId));
      }
    } catch (err: any) {
      showToast(err?.message || "Failed to remove keyword", "error");
    }
  };

  const dashboardStats = useMemo(() => {
    if (!historyData.length) return { totalKeywords: 0, currentAvgRank: "-", successRate: "0%", topPositions: 0 };
    let records = 0, rankSum = 0, found = 0, top5 = 0;
    historyData.forEach((kh) => {
      if (!selectedKeywords.includes(kh.keyword.id)) return;
      kh.history.forEach((r) => {
        records++;
        if (r.found) {
          found++;
          if (r.rank !== null) {
            rankSum += r.rank;
            if (r.rank <= 5) top5++;
          }
        }
      });
    });
    return {
      totalKeywords: historyData.filter((k) => selectedKeywords.includes(k.keyword.id)).length,
      currentAvgRank: found > 0 ? (rankSum / found).toFixed(1) : "-",
      successRate: records > 0 ? `${Math.round((found / records) * 100)}%` : "0%",
      topPositions: top5,
    };
  }, [historyData, selectedKeywords]);

  const tableRows = useMemo(() => {
    const rows: {
      id: number;
      appName: string;
      isCompetitor: boolean;
      keyword: string;
      rank: number | null;
      page: number | null;
      found: boolean;
      screenshot_path: string | null;
      tracked_date: string;
    }[] = [];

    historyData.forEach((kh) => {
      if (!selectedKeywords.includes(kh.keyword.id)) return;

      // Primary app rankings
      kh.history.forEach((r) =>
        rows.push({
          id: r.id,
          appName: selectedApp?.name || "",
          isCompetitor: false,
          keyword: kh.keyword.name,
          rank: r.rank,
          page: r.page,
          found: r.found,
          screenshot_path: r.screenshot_path,
          tracked_date: r.tracked_date,
        })
      );

      // Competitor app rankings
      if (kh.competitors) {
        kh.competitors.forEach((comp) => {
          comp.history.forEach((r) => {
            rows.push({
              id: r.id,
              appName: comp.name,
              isCompetitor: true,
              keyword: kh.keyword.name,
              rank: r.rank,
              page: r.page,
              found: r.found,
              screenshot_path: null,
              tracked_date: r.tracked_date,
            });
          });
        });
      }
    });

    return rows.sort((a, b) => new Date(b.tracked_date).getTime() - new Date(a.tracked_date).getTime());
  }, [historyData, selectedKeywords, selectedApp]);

  // Overall Portfolio Stats for Home Page
  const portfolioStats = useMemo(() => {
    const totalApps = apps.length;
    const totalKeywords = apps.reduce((sum, a) => sum + (a.keywords ? a.keywords.length : 0), 0);
    return {
      totalApps,
      totalKeywords,
    };
  }, [apps]);

  const daysLabel = daysRange === 9999 ? "All time" : `Last ${daysRange} days`;

  return (
    <>
      {!selectedApp ? (
        /* HOME OVERVIEW PAGE (When no app is selected) */
        <Container maxWidth="xl" sx={{ py: 4, px: { xs: 2, sm: 3, md: 4 } }}>
          {/* Welcome Hero Banner (Light Mode with Animated Backdrop) */}
          <Paper
            elevation={0}
            sx={{
              p: { xs: 3, sm: 4, md: 5 },
              borderRadius: "20px",
              background: "linear-gradient(135deg, #ffffff 0%, #f8fafc 50%, #f1f5f9 100%)",
              border: "1px solid #e2e8f0",
              color: "#0f172a",
              mb: 4,
              boxShadow: "0 10px 30px rgba(0, 0, 0, 0.03)",
              position: "relative",
              overflow: "hidden",
            }}
          >
            {/* Animated Dot-Grid Pattern */}
            <Box
              sx={{
                position: "absolute",
                inset: 0,
                backgroundImage: "radial-gradient(circle, #cbd5e1 1.2px, transparent 1.2px)",
                backgroundSize: "28px 28px",
                opacity: 0.4,
                pointerEvents: "none",
              }}
            />

            {/* Ambient Floating Gradient Orbs */}
            <Box
              sx={{
                position: "absolute",
                top: "-20%",
                right: "-5%",
                width: 380,
                height: 380,
                borderRadius: "50%",
                background: "radial-gradient(circle, rgba(99, 102, 241, 0.18) 0%, rgba(139, 92, 246, 0.03) 70%)",
                filter: "blur(50px)",
                animation: "floatHomeOrb1 12s ease-in-out infinite",
                pointerEvents: "none",
              }}
            />
            <Box
              sx={{
                position: "absolute",
                bottom: "-25%",
                right: "25%",
                width: 320,
                height: 320,
                borderRadius: "50%",
                background: "radial-gradient(circle, rgba(16, 185, 129, 0.18) 0%, rgba(52, 211, 153, 0.03) 70%)",
                filter: "blur(45px)",
                animation: "floatHomeOrb2 15s ease-in-out infinite",
                pointerEvents: "none",
              }}
            />

            {/* Keyframe Styles */}
            <style>{`
              @keyframes floatHomeOrb1 {
                0%, 100% { transform: translate(0px, 0px) scale(1); }
                50% { transform: translate(-40px, 30px) scale(1.15); }
              }
              @keyframes floatHomeOrb2 {
                0%, 100% { transform: translate(0px, 0px) scale(1); }
                50% { transform: translate(50px, -35px) scale(1.2); }
              }
            `}</style>

            <Box sx={{ position: "relative", zIndex: 1, maxWidth: 680 }}>
              <Box sx={{ display: "inline-flex", alignItems: "center", gap: 1, px: 1.5, py: 0.5, borderRadius: "20px", bgcolor: "#ecfdf5", border: "1px solid #a7f3d0", mb: 2 }}>
                <Box sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: "#10b981" }} />
                <Typography sx={{ fontSize: 12, fontWeight: 700, color: "#047857" }}>
                  System Active & Monitoring
                </Typography>
              </Box>

              <Typography variant="h4" sx={{ fontWeight: 800, fontSize: { xs: 24, sm: 30, md: 34 }, lineHeight: 1.25, mb: 1.5, color: "#0f172a" }}>
                Shopify Rank Tracker Overview
              </Typography>
              <Typography sx={{ color: "#475569", fontSize: 14.5, lineHeight: 1.6, mb: 3 }}>
                Monitor live keyword search positions across the Shopify App Store, analyze head-to-head competitor rankings, and optimize listing scores.
              </Typography>

              <Box sx={{ display: "flex", flexWrap: "wrap", gap: 4, pt: 2, borderTop: "1px solid #e2e8f0" }}>
                <Box>
                  <Typography sx={{ fontSize: 11.5, color: "#64748b", fontWeight: 600 }}>Tracked Apps</Typography>
                  <Typography sx={{ fontSize: 24, fontWeight: 800, color: "#0f172a" }}>{portfolioStats.totalApps}</Typography>
                </Box>
                <Box>
                  <Typography sx={{ fontSize: 11.5, color: "#64748b", fontWeight: 600 }}>Active Keywords</Typography>
                  <Typography sx={{ fontSize: 24, fontWeight: 800, color: "#0284c7" }}>{portfolioStats.totalKeywords}</Typography>
                </Box>
                <Box>
                  <Typography sx={{ fontSize: 11.5, color: "#64748b", fontWeight: 600 }}>Auto Daily Scans</Typography>
                  <Typography sx={{ fontSize: 24, fontWeight: 800, color: "#10b981" }}>24/7</Typography>
                </Box>
              </Box>
            </Box>
          </Paper>

          {/* Tracked Apps Grid Section */}
          <Box sx={{ mb: 5 }}>
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 2.5 }}>
              <Box>
                <Typography sx={{ fontSize: 18, fontWeight: 800, color: "#0f172a" }}>
                  Your Tracked Shopify Apps
                </Typography>
                <Typography sx={{ fontSize: 13, color: "#64748b" }}>
                  Select an app to view detailed keyword ranking charts and matrix logs.
                </Typography>
              </Box>
            </Box>

            {apps.length === 0 ? (
              <Paper
                elevation={0}
                sx={{
                  p: 4,
                  textAlign: "center",
                  borderRadius: "16px",
                  border: "1px solid #e2e8f0",
                  bgcolor: "#ffffff",
                }}
              >
                <Box sx={{ width: 56, height: 56, borderRadius: "14px", bgcolor: "#f1f5f9", display: "inline-flex", alignItems: "center", justifyContent: "center", color: "#0f172a", mb: 2 }}>
                  <StorefrontIcon sx={{ fontSize: 28 }} />
                </Box>
                <Typography sx={{ fontWeight: 700, fontSize: 17, color: "#0f172a", mb: 1 }}>
                  No Shopify Apps Tracked Yet
                </Typography>
                <Typography sx={{ fontSize: 13.5, color: "#64748b", maxWidth: 420, mx: "auto", mb: 3 }}>
                  Start tracking your app store positions by adding your first Shopify App URL and keywords.
                </Typography>
              </Paper>
            ) : (
              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)", md: "repeat(3, 1fr)" },
                  gap: 2.5,
                }}
              >
                {apps.map((app) => {
                  const color = getAvatarColor(app.name);
                  return (
                    <Card
                      key={app.id}
                      elevation={0}
                      sx={{
                        borderRadius: "16px",
                        border: "1px solid #e2e8f0",
                        bgcolor: "#ffffff",
                        transition: "all 0.2s ease-in-out",
                        position: "relative",
                        overflow: "hidden",
                        display: "flex",
                        flexDirection: "column",
                        justifyContent: "space-between",
                        "&:hover": {
                          borderColor: color,
                          boxShadow: `0 12px 30px ${color}1a`,
                          transform: "translateY(-2px)",
                        },
                      }}
                    >
                      {/* Top Accent Strip */}
                      <Box sx={{ height: 4, bgcolor: color }} />

                      <CardContent sx={{ p: 3 }}>
                        <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1.75, mb: 2 }}>
                          <Avatar
                            src={app.icon_url || undefined}
                            sx={{
                              width: 44,
                              height: 44,
                              fontSize: 18,
                              fontWeight: 800,
                              bgcolor: color,
                              boxShadow: `0 4px 12px ${color}40`,
                            }}
                          >
                            {app.name[0]?.toUpperCase()}
                          </Avatar>
                          <Box sx={{ minWidth: 0, flex: 1 }}>
                            <Typography sx={{ fontWeight: 700, fontSize: 15, color: "#0f172a", mb: 0.25 }} noWrap title={app.name}>
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
                              fontSize: 11.5,
                              fontWeight: 700,
                              bgcolor: "#f8fafc",
                              color: "#475569",
                              border: "1px solid #e2e8f0",
                              height: 24,
                            }}
                          />

                          <Button
                            size="small"
                            onClick={() => {
                              if (onSelectApp) onSelectApp(app);
                            }}
                            endIcon={<ArrowForwardIcon sx={{ fontSize: 14 }} />}
                            sx={{
                              fontSize: 12.5,
                              fontWeight: 700,
                              color: color,
                              textTransform: "none",
                              "&:hover": { bgcolor: `${color}10` },
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

          {/* Quick Platform Tools Grid */}
          <Box sx={{ mb: 2 }}>
            <Typography sx={{ fontSize: 18, fontWeight: 800, color: "#0f172a", mb: 2.5 }}>
              Platform Features & Tools
            </Typography>

            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)", md: "repeat(3, 1fr)" },
                gap: 2.5,
              }}
            >
              {/* Tool 1: Listing Optimizer */}
              <Paper
                elevation={0}
                sx={{
                  p: 3,
                  borderRadius: "16px",
                  border: "1px solid #e2e8f0",
                  bgcolor: "#ffffff",
                  transition: "all 0.2s ease-in-out",
                  "&:hover": { boxShadow: "0 10px 25px rgba(0,0,0,0.05)" },
                }}
              >
                <Box sx={{ width: 40, height: 40, borderRadius: "10px", bgcolor: "#eff6ff", color: "#3b82f6", display: "flex", alignItems: "center", justifyContent: "center", mb: 2 }}>
                  <BarChartIcon sx={{ fontSize: 22 }} />
                </Box>
                <Typography sx={{ fontWeight: 700, fontSize: 15, color: "#0f172a", mb: 0.75 }}>
                  App Listing Optimizer
                </Typography>
                <Typography sx={{ fontSize: 13, color: "#64748b", lineHeight: 1.5, mb: 2 }}>
                  Analyze app titles, subtitles, and descriptions to improve ASO visibility scores.
                </Typography>
                <Button
                  size="small"
                  onClick={() => onNavigate && onNavigate("optimizer")}
                  sx={{ fontSize: 12.5, fontWeight: 700, color: "#3b82f6", textTransform: "none", p: 0 }}
                >
                  Open Listing Optimizer →
                </Button>
              </Paper>

              {/* Tool 2: Competitor Matrix */}
              <Paper
                elevation={0}
                sx={{
                  p: 3,
                  borderRadius: "16px",
                  border: "1px solid #e2e8f0",
                  bgcolor: "#ffffff",
                  transition: "all 0.2s ease-in-out",
                  "&:hover": { boxShadow: "0 10px 25px rgba(0,0,0,0.05)" },
                }}
              >
                <Box sx={{ width: 40, height: 40, borderRadius: "10px", bgcolor: "#faf5ff", color: "#8b5cf6", display: "flex", alignItems: "center", justifyContent: "center", mb: 2 }}>
                  <PeopleIcon sx={{ fontSize: 22 }} />
                </Box>
                <Typography sx={{ fontWeight: 700, fontSize: 15, color: "#0f172a", mb: 0.75 }}>
                  Competitor Intelligence
                </Typography>
                <Typography sx={{ fontSize: 13, color: "#64748b", lineHeight: 1.5, mb: 2 }}>
                  Compare side-by-side keyword rankings against top competitors head-to-head.
                </Typography>
                <Button
                  size="small"
                  onClick={() => onNavigate && onNavigate("competitors")}
                  sx={{ fontSize: 12.5, fontWeight: 700, color: "#8b5cf6", textTransform: "none", p: 0 }}
                >
                  Manage Competitors →
                </Button>
              </Paper>

              {/* Tool 3: Integrations & Notifications */}
              <Paper
                elevation={0}
                sx={{
                  p: 3,
                  borderRadius: "16px",
                  border: "1px solid #e2e8f0",
                  bgcolor: "#ffffff",
                  transition: "all 0.2s ease-in-out",
                  "&:hover": { boxShadow: "0 10px 25px rgba(0,0,0,0.05)" },
                }}
              >
                <Box sx={{ width: 40, height: 40, borderRadius: "10px", bgcolor: "#f0fdf4", color: "#10b981", display: "flex", alignItems: "center", justifyContent: "center", mb: 2 }}>
                  <ExtensionIcon sx={{ fontSize: 22 }} />
                </Box>
                <Typography sx={{ fontWeight: 700, fontSize: 15, color: "#0f172a", mb: 0.75 }}>
                  Slack & Webhook Alerts
                </Typography>
                <Typography sx={{ fontSize: 13, color: "#64748b", lineHeight: 1.5, mb: 2 }}>
                  Connect Slack channels to get instant automated rank changes & keyword alerts.
                </Typography>
                <Button
                  size="small"
                  onClick={() => onNavigate && onNavigate("integrations")}
                  sx={{ fontSize: 12.5, fontWeight: 700, color: "#10b981", textTransform: "none", p: 0 }}
                >
                  Configure Integrations →
                </Button>
              </Paper>
            </Box>
          </Box>
        </Container>
      ) : (
        /* APP DETAIL DASHBOARD (When an app is selected) */
        <Container maxWidth="xl" sx={{ py: 3, px: 3 }}>
          {/* Single App Control Header Bar */}
          <Paper
            elevation={0}
            sx={{
              p: 2,
              px: 2.5,
              borderRadius: "14px",
              border: "1px solid #e2e8f0",
              bgcolor: "#ffffff",
              mb: 3,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: 2,
              boxShadow: "0 4px 12px rgba(0,0,0,0.02)",
            }}
          >
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
              <Avatar
                src={selectedApp.icon_url || undefined}
                sx={{
                  width: 34,
                  height: 34,
                  fontSize: 14,
                  fontWeight: 800,
                  bgcolor: getAvatarColor(selectedApp.name),
                  color: "#ffffff",
                }}
              >
                {selectedApp.name[0]?.toUpperCase()}
              </Avatar>
              <Box>
                <Typography sx={{ fontSize: 15, fontWeight: 800, color: "#0f172a", lineHeight: 1.2 }}>
                  {selectedApp.name}
                </Typography>
                <Typography
                  component="a"
                  href={selectedApp.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  sx={{
                    fontSize: 12,
                    color: "#0284c7",
                    fontWeight: 600,
                    textDecoration: "none",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 0.5,
                    "&:hover": { textDecoration: "underline" },
                  }}
                >
                  {selectedApp.url} <LaunchIcon sx={{ fontSize: 11 }} />
                </Typography>
              </Box>
            </Box>

            <Chip
              label={daysLabel}
              size="small"
              sx={{
                fontSize: 12,
                fontWeight: 700,
                bgcolor: "#f8fafc",
                color: "#475569",
                border: "1px solid #e2e8f0",
                height: 28,
                px: 1,
              }}
            />
          </Paper>

          <MetricCards
            totalKeywords={dashboardStats.totalKeywords}
            currentAvgRank={dashboardStats.currentAvgRank}
            successRate={dashboardStats.successRate}
            topPositions={dashboardStats.topPositions}
            listingScore={listingScore}
          />

          <RankChart
            historyData={historyData}
            selectedKeywords={selectedKeywords}
            onToggleKeyword={handleToggleKeyword}
            daysRange={daysRange}
            onRangeChange={(d) => setDaysRange(d)}
            keywords={selectedApp.keywords}
            isLoadingHistory={isLoadingHistory}
            onManageKeywords={() => setKeywordsDialogOpen(true)}
          />

          <HistoryLog
            selectedApp={selectedApp}
            historyData={historyData}
            competitors={competitors}
            onAddCompetitor={handleAddCompetitor}
            onDeleteCompetitor={handleDeleteCompetitor}
            onViewScreenshot={(path) => setViewScreenshotPath(getScreenshotUrl(path))}
            tableRows={tableRows}
            onRefresh={fetchHistory}
          />
        </Container>
      )}

      <KeywordsDialog
        open={keywordsDialogOpen}
        onClose={() => setKeywordsDialogOpen(false)}
        keywords={selectedApp?.keywords ?? []}
        onAddKeywords={handleAddKeywords}
        onRemoveKeyword={handleRemoveKeyword}
        isLoading={isAddingKeywords}
      />

      <ScreenshotDialog
        open={!!viewScreenshotPath}
        onClose={() => setViewScreenshotPath(null)}
        screenshotUrl={viewScreenshotPath}
        onShowMessage={(msg, sev) => showToast(msg, sev)}
      />
    </>
  );
}