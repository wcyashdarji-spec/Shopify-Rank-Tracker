import { useEffect, useState, useRef } from "react";
import {
  Box,
  Button,
  CircularProgress,
  Typography,
  Collapse,
  IconButton,
  Divider,
  LinearProgress,
  Select,
  MenuItem,
  FormControl,
  Chip,
  Alert,
  Paper,
  Tabs,
  Tab,
} from "@mui/material";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import CancelIcon from "@mui/icons-material/Cancel";
import WarningIcon from "@mui/icons-material/Warning";
import InfoIcon from "@mui/icons-material/Info";
import ArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import ArrowUpIcon from "@mui/icons-material/KeyboardArrowUp";
import RefreshIcon from "@mui/icons-material/Refresh";
import PdfIcon from "@mui/icons-material/PictureAsPdf";
import TitleIcon from "@mui/icons-material/Title";
import ImageIcon from "@mui/icons-material/Image";
import LanguageIcon from "@mui/icons-material/Translate";
import TechIcon from "@mui/icons-material/DeveloperMode";
import CategoryIcon from "@mui/icons-material/Category";
import DescIcon from "@mui/icons-material/Description";
import StarIcon from "@mui/icons-material/Star";
import ScheduleIcon from "@mui/icons-material/Schedule";
import AssessmentIcon from "@mui/icons-material/Assessment";
import LaunchIcon from "@mui/icons-material/Launch";
import { api, type App } from "../api";

interface ListingOptimizerProps {
  apps: App[];
  selectedApp: App;
  onSelectApp: (app: App) => void;
  showToast: (message: string, severity: "success" | "error" | "info") => void;
}

export default function ListingOptimizer({
  apps,
  selectedApp,
  onSelectApp,
  showToast,
}: ListingOptimizerProps) {
  if (!selectedApp) {
    return (
      <Box sx={{ p: 4, textAlign: "center", maxWidth: 500, mx: "auto", mt: 6 }}>
        <Paper elevation={0} sx={{ p: 4, borderRadius: "16px", border: "1px solid #e2e8f0" }}>
          <Typography variant="h6" sx={{ color: "#0f172a", fontWeight: 800, mb: 1 }}>
            No Tracked App Selected
          </Typography>
          <Typography sx={{ color: "#64748b", fontSize: 13.5 }}>
            Please add or select a Shopify application from the Home Overview page to run ASO listing audits.
          </Typography>
        </Paper>
      </Box>
    );
  }

  const appId = selectedApp.id;
  const appName = selectedApp.name;
  const appUrl = selectedApp.url;

  const [loading, setLoading] = useState(false);
  const [auditData, setAuditData] = useState<any>(null);
  const [expandedCard, setExpandedCard] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>("all");
  const lastFetchedId = useRef<number | null>(null);

  const fetchAudit = async (forceRefresh = false) => {
    setLoading(true);
    try {
      let data;
      if (forceRefresh) {
        data = await api.runListingAudit(appId);
        showToast("Optimization audit completed successfully!", "success");
      } else {
        data = await api.getListingAudit(appId);
      }
      setAuditData(data);
    } catch (err: any) {
      console.error("Listing audit fetch error:", err);
      showToast(err?.message || "Failed to load listing audit data.", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (appId && lastFetchedId.current !== appId) {
      lastFetchedId.current = appId;
      setAuditData(null);
      setExpandedCard(null);
      fetchAudit(false);
    }
  }, [appId]);

  const handleReRunAudit = () => {
    fetchAudit(true);
  };

  const handleExportPdf = () => {
    window.print();
  };

  const toggleExpand = (cardKey: string) => {
    setExpandedCard(expandedCard === cardKey ? null : cardKey);
  };

  if (loading) {
    return (
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          minHeight: 450,
          gap: 2.5,
          p: 4,
        }}
      >
        <CircularProgress size={48} sx={{ color: "#0f172a" }} />
        <Typography sx={{ color: "#0f172a", fontWeight: 700, fontSize: 16 }}>
          Auditing App Store Listing for "{appName}"...
        </Typography>
        <Typography sx={{ color: "#64748b", fontSize: 13.5, maxWidth: 420, textAlign: "center" }}>
          Analyzing keyword density, title character counts, visual assets, technical signals, and discoverability factors.
        </Typography>
      </Box>
    );
  }

  if (!auditData || auditData.status === "not_run") {
    const isLimitReached = auditData?.remaining_audits === 0 && auditData?.daily_audit_limit;

    return (
      <Box sx={{ p: { xs: 2, sm: 4 }, maxWidth: 1000, mx: "auto" }}>
        <Paper
          elevation={0}
          sx={{
            p: { xs: 3, sm: 5 },
            borderRadius: "16px",
            border: "1px solid #e2e8f0",
            bgcolor: "#ffffff",
            textAlign: "center",
            boxShadow: "0 10px 30px rgba(0,0,0,0.03)",
            mb: 4,
          }}
        >
          <Box
            sx={{
              width: 56,
              height: 56,
              borderRadius: "14px",
              bgcolor: "#f1f5f9",
              color: "#0f172a",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              mx: "auto",
              mb: 2,
            }}
          >
            <AssessmentIcon sx={{ fontSize: 32 }} />
          </Box>
          <Typography variant="h5" sx={{ fontWeight: 800, color: "#0f172a", mb: 1, letterSpacing: "-0.02em" }}>
            Shopify Listing Optimizer
          </Typography>
          <Typography variant="body2" sx={{ color: "#64748b", maxWidth: 600, mx: "auto", mb: 3.5, lineHeight: 1.6, fontSize: 14 }}>
            Run an AI-powered ASO (App Store Optimization) audit on <strong>{appName}</strong>. We evaluate live Shopify App Store listings, title keyword density, media counts, localization, and technical ASO signals.
          </Typography>
          <Button
            variant="contained"
            onClick={handleReRunAudit}
            disabled={loading || isLimitReached}
            startIcon={<RefreshIcon />}
            sx={{
              bgcolor: isLimitReached ? "#94a3b8" : "#0f172a",
              color: "#ffffff",
              textTransform: "none",
              borderRadius: "10px",
              px: 4,
              py: 1.25,
              fontSize: 14,
              fontWeight: 700,
              boxShadow: "0 4px 14px rgba(15, 23, 42, 0.15)",
              "&:hover": {
                bgcolor: isLimitReached ? "#94a3b8" : "#1e293b",
              },
            }}
          >
            Start Optimization Audit
          </Button>

          {isLimitReached ? (
            <Alert severity="warning" sx={{ mt: 3, maxWidth: 500, mx: "auto", borderRadius: "10px", textAlign: "left" }}>
              Daily re-audit limit of <strong>{auditData.daily_audit_limit}</strong> audits reached for this application. Please try again tomorrow.
            </Alert>
          ) : (
            auditData?.daily_audit_limit && (
              <Typography variant="body2" sx={{ color: "#94a3b8", mt: 2, fontSize: 12.5 }}>
                Daily limit remaining: <strong>{auditData.remaining_audits}</strong> of <strong>{auditData.daily_audit_limit}</strong> audits left today.
              </Typography>
            )
          )}
        </Paper>
      </Box>
    );
  }

  const { overall_score = 0, rating_val, reviews_text } = auditData;
  const categories: Record<string, any> =
    auditData.categories && !Array.isArray(auditData.categories) && typeof auditData.categories === "object"
      ? auditData.categories
      : {};

  function renderIcon(type: string) {
    switch (type) {
      case "check_circle":
        return <CheckCircleIcon sx={{ color: "#059669", fontSize: 18 }} />;
      case "cancel":
        return <CancelIcon sx={{ color: "#dc2626", fontSize: 18 }} />;
      case "warning":
        return <WarningIcon sx={{ color: "#d97706", fontSize: 18 }} />;
      case "info":
      default:
        return <InfoIcon sx={{ color: "#0284c7", fontSize: 18 }} />;
    }
  }

  function getMetricIcon(key: string) {
    switch (key) {
      case "title_optimization":
        return <TitleIcon sx={{ fontSize: 18 }} />;
      case "visual_assets":
        return <ImageIcon sx={{ fontSize: 18 }} />;
      case "languages":
        return <LanguageIcon sx={{ fontSize: 18 }} />;
      case "technical_signals":
        return <TechIcon sx={{ fontSize: 18 }} />;
      case "categories_discoverability":
        return <CategoryIcon sx={{ fontSize: 18 }} />;
      case "description_content":
        return <DescIcon sx={{ fontSize: 18 }} />;
      default:
        return <InfoIcon sx={{ fontSize: 18 }} />;
    }
  }

  function getMetricTitle(key: string) {
    return key
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  }

  function getScoreColor(score: number) {
    if (score >= 80) return "#059669"; // Emerald green
    if (score >= 60) return "#d97706"; // Amber
    return "#dc2626"; // Red
  }

  function getScoreBg(score: number) {
    if (score >= 80) return "#ecfdf5";
    if (score >= 60) return "#fffbeb";
    return "#fef2f2";
  }

  // Filter categories based on active tab
  const categoryKeys = Object.keys(categories);
  const filteredKeys = categoryKeys.filter((key) => {
    if (activeTab === "title") return key === "title_optimization" || key === "description_content";
    if (activeTab === "media") return key === "visual_assets";
    if (activeTab === "tech") return key === "technical_signals" || key === "languages" || key === "categories_discoverability";
    return true;
  });

  return (
    <Box sx={{ p: { xs: 2, sm: 3, md: 4 }, maxWidth: 1080, mx: "auto" }}>
      {/* 1. Unified Control Header Bar (All Controls in One Sleek Card) */}
      <Paper
        elevation={0}
        sx={{
          borderRadius: "16px",
          border: "1px solid #e2e8f0",
          p: 2.5,
          bgcolor: "#ffffff",
          mb: 3,
          boxShadow: "0 4px 12px rgba(0,0,0,0.02)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 2,
          "@media print": { display: "none" },
        }}
      >
        {/* App Switcher Dropdown & Info */}
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, flexWrap: "wrap" }}>
          <Typography sx={{ fontSize: 13, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Application:
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

          {auditData.audit_last_synced_at && (
            <Chip
              icon={<ScheduleIcon sx={{ fontSize: 13 }} />}
              label={`Synced: ${new Date(auditData.audit_last_synced_at).toLocaleDateString()}`}
              size="small"
              sx={{ color: "#475569", bgcolor: "#f8fafc", border: "1px solid #e2e8f0", fontWeight: 600, fontSize: 11.5, height: 26 }}
            />
          )}

          {auditData.daily_audit_limit !== null && auditData.daily_audit_limit !== undefined && (
            <Chip
              label={`${auditData.remaining_audits} of ${auditData.daily_audit_limit} audits left`}
              color={auditData.remaining_audits === 0 ? "error" : "success"}
              size="small"
              sx={{ fontWeight: 700, fontSize: 11.5, height: 26 }}
            />
          )}
        </Box>

        {/* Action Buttons */}
        <Box sx={{ display: "flex", gap: 1.25 }}>
          <Button
            variant="outlined"
            onClick={handleExportPdf}
            startIcon={<PdfIcon sx={{ fontSize: 16 }} />}
            sx={{
              borderColor: "#e2e8f0",
              color: "#475569",
              textTransform: "none",
              fontWeight: 700,
              fontSize: 12.5,
              borderRadius: "8px",
              bgcolor: "#ffffff",
              px: 1.75,
              py: 0.6,
              "&:hover": { borderColor: "#cbd5e1", bgcolor: "#f8fafc" },
            }}
          >
            Export PDF
          </Button>
          <Button
            variant="contained"
            onClick={handleReRunAudit}
            disabled={loading || auditData?.remaining_audits === 0}
            startIcon={loading ? <CircularProgress size={13} sx={{ color: "#ffffff" }} /> : <RefreshIcon sx={{ fontSize: 16 }} />}
            sx={{
              bgcolor: auditData?.remaining_audits === 0 ? "#94a3b8" : "#0f172a",
              color: "#ffffff",
              textTransform: "none",
              fontWeight: 700,
              fontSize: 12.5,
              borderRadius: "8px",
              px: 2,
              py: 0.6,
              boxShadow: "0 2px 6px rgba(15, 23, 42, 0.15)",
              "&:hover": { bgcolor: auditData?.remaining_audits === 0 ? "#94a3b8" : "#1e293b" },
            }}
          >
            {loading ? "Auditing..." : "Re-run Audit"}
          </Button>
        </Box>
      </Paper>

      {/* 2. Hero Overview & Quick Action Plan Card */}
      <Paper
        elevation={0}
        sx={{
          borderRadius: "16px",
          boxShadow: "0 10px 30px rgba(0, 0, 0, 0.03)",
          border: "1px solid #e2e8f0",
          mb: 3,
          p: { xs: 3, sm: 4 },
          bgcolor: "#ffffff",
        }}
      >
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", md: "240px 1fr" },
            gap: 4,
            alignItems: "center",
          }}
        >
          {/* Left Column: Overall Score Circular Gauge */}
          <Box
            sx={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              py: 1,
            }}
          >
            <Box sx={{ position: "relative", display: "inline-flex", mb: 1.75 }}>
              <CircularProgress
                variant="determinate"
                value={100}
                size={110}
                thickness={6}
                sx={{ color: "#f1f5f9" }}
              />
              <CircularProgress
                variant="determinate"
                value={overall_score}
                size={110}
                thickness={6}
                sx={{
                  color: getScoreColor(overall_score),
                  position: "absolute",
                  left: 0,
                  strokeLinecap: "round",
                }}
              />
              <Box
                sx={{
                  inset: 0,
                  position: "absolute",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Typography sx={{ fontSize: 32, fontWeight: 800, color: "#0f172a", lineHeight: 1 }}>
                  {overall_score}
                </Typography>
                <Typography sx={{ fontSize: 11, fontWeight: 600, color: "#94a3b8", mt: 0.25 }}>
                  out of 100
                </Typography>
              </Box>
            </Box>

            <Chip
              label={
                overall_score >= 80
                  ? "● Great Listing Health"
                  : overall_score >= 60
                  ? "● Needs Minor Optimization"
                  : "● Requires ASO Improvements"
              }
              size="small"
              sx={{
                fontSize: 11.5,
                fontWeight: 700,
                bgcolor: getScoreBg(overall_score),
                color: getScoreColor(overall_score),
                height: 24,
                px: 0.5,
              }}
            />
          </Box>

          {/* Right Column: App Header & Priority Action Plan Cards */}
          <Box>
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1, flexWrap: "wrap", gap: 1 }}>
              <Typography variant="h5" sx={{ fontWeight: 800, color: "#0f172a" }}>
                {appName}
              </Typography>
              <Button
                component="a"
                href={appUrl}
                target="_blank"
                rel="noopener noreferrer"
                size="small"
                variant="outlined"
                endIcon={<LaunchIcon sx={{ fontSize: 12 }} />}
                sx={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: "#0f172a",
                  borderColor: "#e2e8f0",
                  bgcolor: "#f8fafc",
                  borderRadius: "7px",
                  textTransform: "none",
                  py: 0.3,
                  px: 1.25,
                  "&:hover": { borderColor: "#0f172a", bgcolor: "#f1f5f9" },
                }}
              >
                View in App Store
              </Button>
            </Box>

            <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
              <StarIcon sx={{ color: "#f59e0b", fontSize: 17 }} />
              <Typography sx={{ fontSize: 13.5, color: "#334155", fontWeight: 700 }}>
                {typeof rating_val === "number" ? `${rating_val.toFixed(1)} stars` : "0.0 stars"}
              </Typography>
              <Typography sx={{ fontSize: 13.5, color: "#cbd5e1" }}>•</Typography>
              <Typography sx={{ fontSize: 13.5, color: "#64748b", fontWeight: 600 }}>
                {(() => {
                  if (!reviews_text) return "0 reviews";
                  const cleaned = reviews_text.trim();
                  if (cleaned.toLowerCase().includes("reviews") || cleaned.toLowerCase().includes("ratings")) {
                    return cleaned;
                  }
                  const numMatch = cleaned.match(/\d+/);
                  return numMatch ? `${numMatch[0]} reviews` : `${cleaned} reviews`;
                })()}
              </Typography>
            </Box>
          </Box>
        </Box>
      </Paper>

      {/* 3. Organized Filter Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: "#e2e8f0", mb: 2.5 }}>
        <Tabs
          value={activeTab}
          onChange={(_, val) => setActiveTab(val)}
          textColor="primary"
          indicatorColor="primary"
          sx={{
            minHeight: 40,
            "& .MuiTab-root": {
              fontSize: 13,
              fontWeight: 700,
              textTransform: "none",
              minHeight: 40,
              py: 1,
              px: 2,
              color: "#64748b",
              "&.Mui-selected": { color: "#0f172a" },
            },
            "& .MuiTabs-indicator": { bgcolor: "#0f172a", height: 3 },
          }}
        >
          <Tab value="all" label={`All Audit Areas (${categoryKeys.length})`} />
          <Tab value="title" label="Title & Description" />
          <Tab value="media" label="Visual Media" />
          <Tab value="tech" label="Technical & Discoverability" />
        </Tabs>
      </Box>

      {/* 4. Organized Audit List */}
      <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {filteredKeys.map((key) => {
          const data = categories[key] || {};
          const isExpanded = expandedCard === key;
          const score = data.score || 0;
          const progressColor = getScoreColor(score);

          return (
            <Paper
              key={key}
              elevation={0}
              sx={{
                borderRadius: "14px",
                border: isExpanded ? "1.5px solid #0f172a" : "1px solid #e2e8f0",
                bgcolor: "#ffffff",
                transition: "all 0.2s ease",
                overflow: "hidden",
                boxShadow: isExpanded ? "0 8px 24px rgba(15, 23, 42, 0.08)" : "0 2px 8px rgba(0,0,0,0.02)",
              }}
            >
              {/* Card Header Bar (Clickable) */}
              <Box
                onClick={() => toggleExpand(key)}
                sx={{
                  p: 2.5,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  cursor: "pointer",
                  bgcolor: isExpanded ? "#f8fafc" : "#ffffff",
                  "&:hover": { bgcolor: "#f8fafc" },
                }}
              >
                <Box sx={{ display: "flex", alignItems: "center", gap: 2, flex: 1, minWidth: 0, mr: 2 }}>
                  <Box
                    sx={{
                      width: 38,
                      height: 38,
                      borderRadius: "10px",
                      bgcolor: getScoreBg(score),
                      color: progressColor,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    {getMetricIcon(key)}
                  </Box>

                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 0.5, flexWrap: "wrap" }}>
                      <Typography sx={{ fontWeight: 700, fontSize: 15, color: "#0f172a" }}>
                        {getMetricTitle(key)}
                      </Typography>
                      <Chip
                        label={score >= 80 ? "Pass" : score >= 60 ? "Warning" : "Action Needed"}
                        size="small"
                        sx={{
                          fontSize: 10.5,
                          fontWeight: 700,
                          height: 20,
                          bgcolor: getScoreBg(score),
                          color: progressColor,
                        }}
                      />
                    </Box>
                    <Typography sx={{ fontSize: 12.5, color: "#64748b" }} noWrap>
                      {data.subtext}
                    </Typography>
                  </Box>
                </Box>

                {/* Score Dial & Expand Arrow */}
                <Box sx={{ display: "flex", alignItems: "center", gap: 2, flexShrink: 0 }}>
                  <Box sx={{ width: 100, textAlign: "right", display: { xs: "none", sm: "block" } }}>
                    <Box sx={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 0.5, mb: 0.5 }}>
                      <Typography sx={{ fontWeight: 800, fontSize: 16, color: progressColor }}>
                        {score}
                      </Typography>
                      <Typography sx={{ fontSize: 11, color: "#94a3b8" }}>/ 100</Typography>
                    </Box>
                    <LinearProgress
                      variant="determinate"
                      value={score}
                      sx={{
                        height: 5,
                        borderRadius: 3,
                        bgcolor: "#f1f5f9",
                        "& .MuiLinearProgress-bar": { bgcolor: progressColor, borderRadius: 3 },
                      }}
                    />
                  </Box>

                  <IconButton size="small" sx={{ color: "#64748b" }}>
                    {isExpanded ? <ArrowUpIcon sx={{ fontSize: 20 }} /> : <ArrowDownIcon sx={{ fontSize: 20 }} />}
                  </IconButton>
                </Box>
              </Box>

              {/* Expandable Checklist Details */}
              <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                <Divider sx={{ borderColor: "#e2e8f0" }} />
                <Box sx={{ p: 3, bgcolor: "#ffffff", display: "flex", flexDirection: "column", gap: 2 }}>
                  {(data.items || []).map((item: any, idx: number) => (
                    <Box
                      key={idx}
                      sx={{
                        display: "flex",
                        gap: 1.5,
                        alignItems: "flex-start",
                        p: 1.75,
                        borderRadius: "10px",
                        bgcolor: "#f8fafc",
                        border: "1px solid #f1f5f9",
                      }}
                    >
                      <Box sx={{ mt: 0.25, display: "flex", flexShrink: 0 }}>{renderIcon(item.type)}</Box>
                      <Box sx={{ minWidth: 0 }}>
                        <Typography sx={{ fontWeight: 700, fontSize: 13.5, color: "#0f172a" }}>
                          {item.title}
                        </Typography>
                        <Typography sx={{ fontSize: 12.5, color: "#64748b", mt: 0.25, lineHeight: 1.5 }}>
                          {item.desc}
                        </Typography>
                      </Box>
                    </Box>
                  ))}
                </Box>
              </Collapse>
            </Paper>
          );
        })}
      </Box>
    </Box>
  );
}
