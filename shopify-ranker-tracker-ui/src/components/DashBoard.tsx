// React
import { useEffect, useMemo, useState } from "react";

// Third-party
import { Box, Chip, Container, Typography } from "@mui/material";

// API
import { api } from "../api";
import type { App, KeywordHistory } from "../api";

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
}

export default function Dashboard({
  selectedApp,
  apiUrl,
  onRefreshApps,
  onUpdateSelectedApp,
  showToast,
}: DashboardProps) {
  const [historyData, setHistoryData] = useState<KeywordHistory[]>([]);
  const [selectedKeywords, setSelectedKeywords] = useState<number[]>([]);
  const [daysRange, setDaysRange] = useState<number>(30);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [isAddingKeywords, setIsAddingKeywords] = useState(false);
  const [viewScreenshotPath, setViewScreenshotPath] = useState<string | null>(null);
  const [keywordsDialogOpen, setKeywordsDialogOpen] = useState(false);

  // Reset selected keywords whenever the app changes
  useEffect(() => {
    setSelectedKeywords([]);
  }, [selectedApp?.id]);

  useEffect(() => {
    if (!selectedApp) {
      setHistoryData([]);
      return;
    }
    const load = async () => {
      setIsLoadingHistory(true);
      try {
        const kwIds = selectedApp.keywords.map((k) => k.id);
        if (kwIds.length === 0) {
          setHistoryData([]);
          return;
        }
        const data = await api.getHistory(selectedApp.id, kwIds, daysRange);
        setHistoryData(data.keywords || []);
        setSelectedKeywords((prev) => (prev.length === 0 ? kwIds : prev));
      } catch (err: any) {
        showToast(err?.message || "Failed to load history", "error");
      } finally {
        setIsLoadingHistory(false);
      }
    };
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedApp, daysRange]);

  const handleToggleKeyword = (id: number) => {
    if (selectedKeywords.includes(id)) {
      if (selectedKeywords.length > 1) setSelectedKeywords(selectedKeywords.filter((k) => k !== id));
      else showToast("Keep at least one keyword active", "info");
    } else {
      setSelectedKeywords([...selectedKeywords, id]);
    }
  };

  const handleAddKeywords = async (keywordsList: string[]) => {
    if (!selectedApp) return;
    setIsAddingKeywords(true);
    try {
      const res = await api.addKeywords(selectedApp.id, keywordsList);
      showToast(`Added ${res.added.length} keywords`, "success");
      const updated = await api.getApps();
      const app = updated.apps.find((a) => a.id === selectedApp.id);
      if (app) onUpdateSelectedApp(app);
      await onRefreshApps();
    } catch (err: any) {
      showToast(err.message || "Failed to add keywords", "error");
    } finally {
      setIsAddingKeywords(false);
    }
  };

  const handleRemoveKeyword = async (keywordId: number, keywordName: string) => {
    if (!selectedApp) return;
    try {
      await api.removeKeyword(selectedApp.id, keywordId);
      showToast(`Removed '${keywordName}'`, "success");
      const updated = await api.getApps();
      const app = updated.apps.find((a) => a.id === selectedApp.id);
      if (app) {
        onUpdateSelectedApp(app);
        setSelectedKeywords((prev) => prev.filter((id) => id !== keywordId));
      }
      await onRefreshApps();
    } catch (err: any) {
      showToast(err.message || "Failed to remove keyword", "error");
    }
  };

  const getScreenshotUrl = (path: string | null) => {
    if (!path) return null;
    const clean = path.replace(/\\/g, "/");
    const filename = clean.split("/").pop();
    return filename ? `${apiUrl}/screenshots/${filename}` : null;
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
    const rows: { id: number; keyword: string; rank: number | null; page: number | null; found: boolean; screenshot_path: string | null; tracked_date: string }[] = [];
    historyData.forEach((kh) => {
      if (!selectedKeywords.includes(kh.keyword.id)) return;
      kh.history.forEach((r) =>
        rows.push({ id: r.id, keyword: kh.keyword.name, rank: r.rank, page: r.page, found: r.found, screenshot_path: r.screenshot_path, tracked_date: r.tracked_date })
      );
    });
    return rows.sort((a, b) => new Date(b.tracked_date).getTime() - new Date(a.tracked_date).getTime());
  }, [historyData, selectedKeywords]);

  const daysLabel = daysRange === 9999 ? "All time" : `Last ${daysRange} days`;

  return (
    <>
      {!selectedApp ? (
        <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: 2, color: "text.secondary" }}>
          <Box sx={{ width: 64, height: 64, borderRadius: "16px", bgcolor: "#f3f4f6", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28 }}>
            📊
          </Box>
          <Typography sx={{ fontWeight: 600, fontSize: 16, color: "#111827" }}>
            Select an app to view rankings
          </Typography>
          <Typography sx={{ fontSize: 13, color: "#6b7280", maxWidth: 360, textAlign: "center" }}>
            Choose a tracked Shopify app from the sidebar, or click "Track App" to add a new one.
          </Typography>
        </Box>
      ) : (
        <Container maxWidth="xl" sx={{ py: 3, px: 3 }}>
          <Box sx={{ display: "flex", gap: 1, mb: 3 }}>
            <Chip
              label={selectedApp.name}
              size="small"
              variant="outlined"
              sx={{ fontSize: 12.5, fontWeight: 500, borderColor: "#e5e7eb", color: "#374151", bgcolor: "#fff", height: 28, px: 0.5 }}
            />
            <Chip
              icon={<Box component="span" sx={{ fontSize: 12, mr: -0.5 }}>📅</Box>}
              label={daysLabel}
              size="small"
              variant="outlined"
              sx={{ fontSize: 12.5, fontWeight: 500, borderColor: "#e5e7eb", color: "#374151", bgcolor: "#fff", height: 28, px: 0.5 }}
            />
          </Box>

          <MetricCards
            totalKeywords={dashboardStats.totalKeywords}
            currentAvgRank={dashboardStats.currentAvgRank}
            successRate={dashboardStats.successRate}
            topPositions={dashboardStats.topPositions}
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
            tableRows={tableRows}
            onViewScreenshot={(path) => setViewScreenshotPath(getScreenshotUrl(path))}
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