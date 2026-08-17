import { useEffect, useState, useRef } from "react";
import {
  Box,
  Button,
  Card,
  CardContent,
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
  Alert
} from "@mui/material";
import {
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  Warning as WarningIcon,
  Info as InfoIcon,
  KeyboardArrowDown as ArrowDownIcon,
  KeyboardArrowUp as ArrowUpIcon,
  Refresh as RefreshIcon,
  PictureAsPdf as PdfIcon,
  Title as TitleIcon,
  Image as ImageIcon,
  Translate as LanguageIcon,
  DeveloperMode as TechIcon,
  Category as CategoryIcon,
  Description as DescIcon,
  Star as StarIcon
} from "@mui/icons-material";
import { api, type App } from "../api";

interface ListingOptimizerProps {
  apps: App[];
  selectedApp: App;
  onSelectApp: (app: App) => void;
  showToast: (message: string, severity: "success" | "error" | "info") => void;
}

export default function ListingOptimizer({ apps, selectedApp, onSelectApp, showToast }: ListingOptimizerProps) {
  const appId = selectedApp.id;
  const appName = selectedApp.name;
  const appUrl = selectedApp.url;

  const [loading, setLoading] = useState(false);
  const [auditData, setAuditData] = useState<any>(null);
  const [expandedCard, setExpandedCard] = useState<string | null>(null);
  const lastFetchedId = useRef<number | null>(null);

  const fetchAudit = async (forceRefresh = false) => {
    setLoading(true);
    try {
      let data;
      if (forceRefresh) {
        data = await api.runListingAudit(appId);
        showToast("Audit completed successfully!", "success");
      } else {
        data = await api.getListingAudit(appId);
      }
      setAuditData(data);
    } catch (err: any) {
      console.error(err);
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
      <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: 400, gap: 2.5 }}>
        <CircularProgress size={52} sx={{ color: "#006e52" }} />
        <Typography sx={{ color: "#374151", fontWeight: 600, fontSize: 16 }}>
          Running optimization audit for your app & competitors...
        </Typography>
        <Typography sx={{ color: "#6b7280", fontSize: 13.5 }}>
          Scraping Shopify listings and analyzing SEO metadata. This may take up to 20 seconds.
        </Typography>
      </Box>
    );
  }

  if (!auditData || auditData.status === "not_run") {
    const isLimitReached = auditData?.remaining_audits === 0 && auditData?.daily_audit_limit;

    return (
      <Box sx={{ p: 4, bgcolor: "#f9fafb", minHeight: "100vh", fontFamily: "'Inter', sans-serif" }}>
        {/* Header welcome */}
        <Box sx={{ maxWidth: 800, mx: "auto", textAlign: "center", mt: 6, mb: 6 }}>
          <Typography variant="h4" sx={{ fontWeight: 800, color: "#004b3a", mb: 2, letterSpacing: "-0.02em" }}>
            Shopify Listing Optimizer
          </Typography>
          <Typography variant="subtitle1" sx={{ color: "#4b5563", maxWidth: 640, mx: "auto", mb: 4, lineHeight: 1.6, fontSize: 15 }}>
            Run an AI-powered ASO (App Store Optimization) audit on <strong>{appName}</strong>. We scrape the live App Store listing, evaluate keyword coverage, visual layouts, technical parameters, and log benchmarks for your ASO Activity Feed.
          </Typography>
          <Button 
            variant="contained" 
            onClick={handleReRunAudit} 
            disabled={loading || isLimitReached}
            startIcon={<RefreshIcon />}
            sx={{ 
              bgcolor: isLimitReached ? "#9ca3af" : "#006e52", 
              textTransform: "none",
              borderRadius: "10px",
              px: 4,
              py: 1.75,
              fontSize: 14.5,
              fontWeight: 600,
              boxShadow: isLimitReached ? "none" : "0 4px 14px rgba(0, 110, 82, 0.2)",
              transition: "all 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
              "&:hover": { 
                bgcolor: isLimitReached ? "#9ca3af" : "#005a44",
                transform: isLimitReached ? "none" : "translateY(-1px)",
                boxShadow: isLimitReached ? "none" : "0 6px 20px rgba(0, 110, 82, 0.3)"
              } 
            }}
          >
            Start Optimization Audit
          </Button>
          
          {isLimitReached ? (
            <Alert severity="warning" sx={{ mt: 3, maxWidth: 480, mx: "auto", borderRadius: "8px", textAlign: "left" }}>
              Daily re-audit limit of <strong>{auditData.daily_audit_limit}</strong> audits reached for this application. Please try again tomorrow.
            </Alert>
          ) : (
            auditData?.daily_audit_limit && (
              <Typography variant="body2" sx={{ color: "#6b7280", mt: 2, fontSize: 13 }}>
                Daily limit remaining: <strong>{auditData.remaining_audits}</strong> of <strong>{auditData.daily_audit_limit}</strong> audits left today.
              </Typography>
            )
          )}
        </Box>

        {/* Feature Grid */}
        <Box sx={{ maxWidth: 900, mx: "auto" }}>
          <Typography variant="subtitle2" sx={{ color: "#4b5563", fontWeight: 700, mb: 3.5, textTransform: "uppercase", letterSpacing: "0.08em", textAlign: "center", fontSize: 12 }}>
            What We Analyze
          </Typography>
          <Box sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr", md: "1fr 1fr 1fr" },
            gap: 3
          }}>
            {[
              { key: "title_optimization", desc: "Title character length, brand prefix matching, and keyword positioning checks." },
              { key: "visual_assets", desc: "Screenshot quality benchmarks, media counts, contrast, and image search alt tags." },
              { key: "languages", desc: "Localization support checking for presence of high-value languages in target regions." },
              { key: "technical_signals", desc: "Built for Shopify badge checks, privacy policy links, FAQs, and developer docs." },
              { key: "categories_discoverability", desc: "Store category indexing, integration compatibility, and ASO feature tags." },
              { key: "description_content", desc: "Semantic keyword density, Meta descriptions, value promises, and feature lists." }
            ].map((feat) => (
              <Card key={feat.key} sx={{
                borderRadius: "12px",
                border: "1px solid #e5e7eb",
                boxShadow: "0 4px 12px rgba(0, 0, 0, 0.02)",
                display: "flex",
                flexDirection: "column",
                p: 3,
                bgcolor: "#ffffff",
                transition: "transform 0.2s",
                "&:hover": {
                  transform: "translateY(-2px)",
                  borderColor: "#d1d5db"
                }
              }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 1.75 }}>
                  <Box sx={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    bgcolor: "#e6f1ee",
                    borderRadius: "8px",
                    p: 1.25
                  }}>
                    {getMetricIcon(feat.key)}
                  </Box>
                  <Typography sx={{ fontWeight: 700, fontSize: 14.5, color: "#111827" }}>
                    {getMetricTitle(feat.key)}
                  </Typography>
                </Box>
                <Typography sx={{ fontSize: 13, color: "#4b5563", lineHeight: 1.55 }}>
                  {feat.desc}
                </Typography>
              </Card>
            ))}
          </Box>
        </Box>
      </Box>
    );
  }

  const { overall_score, rating_val, reviews_text } = auditData;
  const categories: Record<string, any> =
    auditData.categories && !Array.isArray(auditData.categories) && typeof auditData.categories === "object"
      ? auditData.categories
      : {};

  function renderIcon(type: string) {
    switch (type) {
      case "check_circle":
        return <CheckCircleIcon sx={{ color: "#006e52", fontSize: 20 }} />;
      case "cancel":
        return <CancelIcon sx={{ color: "#d97706", fontSize: 20 }} />; // Dark orange/red
      case "warning":
        return <WarningIcon sx={{ color: "#f59e0b", fontSize: 20 }} />;
      case "info":
      default:
        return <InfoIcon sx={{ color: "#2563eb", fontSize: 20 }} />;
    }
  }

  function getMetricIcon(key: string) {
    switch (key) {
      case "title_optimization":
        return <TitleIcon sx={{ color: "#111827", fontSize: 20 }} />;
      case "visual_assets":
        return <ImageIcon sx={{ color: "#111827", fontSize: 20 }} />;
      case "languages":
        return <LanguageIcon sx={{ color: "#111827", fontSize: 20 }} />;
      case "technical_signals":
        return <TechIcon sx={{ color: "#111827", fontSize: 20 }} />;
      case "categories_discoverability":
        return <CategoryIcon sx={{ color: "#111827", fontSize: 20 }} />;
      case "description_content":
        return <DescIcon sx={{ color: "#111827", fontSize: 20 }} />;
      default:
        return <InfoIcon sx={{ color: "#111827", fontSize: 20 }} />;
    }
  }

  function getMetricTitle(key: string) {
    return key
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  }

  function getScoreColor(score: number) {
    if (score >= 90) return "#006e52"; // Emerald green
    if (score >= 70) return "#f59e0b"; // Amber
    return "#ef4444"; // Red
  }

  return (
    <Box sx={{ p: 4, bgcolor: "#f9fafb", minHeight: "100vh", fontFamily: "'Inter', sans-serif" }}>
      {/* Top Header Bar */}
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 4, "@media print": { display: "none" } }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 3 }}>
          <Typography sx={{ fontSize: 22, fontWeight: 700, color: "#004b3a", letterSpacing: "-0.02em" }}>
            LISTING OPTIMIZER
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
        <Box sx={{ display: "flex", gap: 2 }}>
          <Button
            variant="outlined"
            onClick={handleExportPdf}
            startIcon={<PdfIcon />}
            sx={{
              borderColor: "#e5e7eb",
              color: "#374151",
              textTransform: "none",
              fontWeight: 500,
              borderRadius: "8px",
              bgcolor: "#ffffff",
              "&:hover": { borderColor: "#d1d5db", bgcolor: "#f9fafb" }
            }}
          >
            Export PDF
          </Button>
          <Button
            variant="contained"
            onClick={handleReRunAudit}
            disabled={loading || auditData?.remaining_audits === 0}
            startIcon={loading ? <CircularProgress size={16} sx={{ color: "#fff" }} /> : <RefreshIcon />}
            sx={{
              bgcolor: auditData?.remaining_audits === 0 ? "#9ca3af" : "#006e52",
              color: "#ffffff",
              textTransform: "none",
              fontWeight: 500,
              borderRadius: "8px",
              "&:hover": { bgcolor: auditData?.remaining_audits === 0 ? "#9ca3af" : "#005a44" }
            }}
          >
            {loading ? "Auditing..." : "Re-run Audit"}
          </Button>
        </Box>
      </Box>

      {/* Sync Status & Limits Bar */}
      {auditData && auditData.status !== "not_run" && (
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 2, alignItems: "center", mb: 3, "@media print": { display: "none" } }}>
          {auditData.audit_last_synced_at && (
            <Chip
              label={`Last synced: ${new Date(auditData.audit_last_synced_at).toLocaleString()}`}
              size="small"
              variant="outlined"
              sx={{ color: "#374151", borderColor: "#e5e7eb", bgcolor: "#ffffff", fontWeight: 500, px: 0.5 }}
            />
          )}
          {auditData.daily_audit_limit !== null && auditData.daily_audit_limit !== undefined && (
            <Chip
              label={
                auditData.remaining_audits === 0 
                  ? `Daily Limit Reached (0 of ${auditData.daily_audit_limit} left)` 
                  : `Daily Audits: ${auditData.remaining_audits} of ${auditData.daily_audit_limit} left today`
              }
              color={auditData.remaining_audits === 0 ? "error" : auditData.remaining_audits === 1 ? "warning" : "success"}
              size="small"
              sx={{ fontWeight: 600, px: 0.5 }}
            />
          )}
        </Box>
      )}

      {/* Limit Exceeded Alert */}
      {auditData?.remaining_audits === 0 && auditData?.daily_audit_limit && (
        <Alert severity="warning" sx={{ mb: 3, borderRadius: "12px", border: "1px solid #ffeeba" }}>
          You have reached your daily optimization limit of <strong>{auditData.daily_audit_limit}</strong> audits for this application. Re-run button is disabled and will reset tomorrow.
        </Alert>
      )}

      {/* Header Info Displayed Only on Print */}
      <Box sx={{ display: "none", "@media print": { display: "block", mb: 4 } }}>
        <Typography variant="h4" sx={{ fontWeight: 700, color: "#004b3a" }}>
          Shopify Store Listing Audit Report
        </Typography>
        <Typography variant="subtitle1" sx={{ color: "#6b7280" }}>
          Generated for: {appName} ({appUrl})
        </Typography>
      </Box>

      {/* Main Score Header Card */}
      <Card
        sx={{
          borderRadius: "16px",
          boxShadow: "0 4px 20px rgba(0, 0, 0, 0.03)",
          border: "1px solid #e5e7eb",
          mb: 4,
          overflow: "visible",
          background: "#ffffff"
        }}
      >
        <CardContent sx={{ p: 4 }}>
          <Box
            sx={{
              display: "flex",
              flexDirection: { xs: "column", sm: "row" },
              alignItems: "center",
              gap: 4
            }}
          >
            {/* Circular score gauge */}
            <Box sx={{ display: "flex", justifyContent: "center", flexShrink: 0 }}>
              <Box sx={{ position: "relative", display: "inline-flex" }}>
                <CircularProgress
                  variant="determinate"
                  value={100}
                  size={120}
                  thickness={5}
                  sx={{ color: "#f3f4f6" }}
                />
                <CircularProgress
                  variant="determinate"
                  value={overall_score}
                  size={120}
                  thickness={5}
                  sx={{
                    color: getScoreColor(overall_score),
                    position: "absolute",
                    left: 0,
                    strokeLinecap: "round"
                  }}
                />
                <Box
                  sx={{
                    top: 0,
                    left: 0,
                    bottom: 0,
                    right: 0,
                    position: "absolute",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center"
                  }}
                >
                  <Typography sx={{ fontSize: 32, fontWeight: 800, color: "#111827", lineHeight: 1 }}>
                    {overall_score}
                  </Typography>
                  <Typography sx={{ fontSize: 12, fontWeight: 500, color: "#6b7280", mt: 0.5 }}>
                    / 100
                  </Typography>
                </Box>
              </Box>
            </Box>

            {/* App name and general review info */}
            <Box sx={{ flexGrow: 1, textAlign: { xs: "center", sm: "left" } }}>
              <Typography variant="h5" sx={{ fontWeight: 700, color: "#111827", mb: 1 }}>
                {appName}
              </Typography>
              <Box sx={{ display: "flex", alignItems: "center", justifyContent: { xs: "center", sm: "flex-start" }, gap: 0.5 }}>
                <StarIcon sx={{ color: "#f59e0b", fontSize: 18 }} />
                <Typography sx={{ fontSize: 14, color: "#4b5563", fontWeight: 500 }}>
                  {typeof rating_val === "number" ? `${rating_val.toFixed(1)} stars` : "0.0 stars"}
                </Typography>
                <Typography sx={{ fontSize: 14, color: "#9ca3af", mx: 1 }}>•</Typography>
                <Typography sx={{ fontSize: 14, color: "#4b5563", fontWeight: 500 }}>
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
        </CardContent>
      </Card>

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
          gap: 3
        }}
      >
        {Object.entries(categories).map(([key, data]: [string, any]) => {
          const isExpanded = expandedCard === key;
          const score = data.score;
          const progressColor = getScoreColor(score);

          return (
            <Box key={key}>
              <Card
                sx={{
                  borderRadius: "12px",
                  boxShadow: isExpanded ? "0 10px 30px rgba(0, 0, 0, 0.05)" : "0 4px 12px rgba(0, 0, 0, 0.02)",
                  border: isExpanded ? "1px solid #006e52" : "1px solid #e5e7eb",
                  bgcolor: "#ffffff",
                  transition: "all 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
                  cursor: "pointer",
                  "&:hover": {
                    borderColor: isExpanded ? "#006e52" : "#d1d5db",
                    transform: "translateY(-1px)"
                  }
                }}
                onClick={() => toggleExpand(key)}
              >
                <CardContent sx={{ p: 3, "&:last-child": { pb: 3 } }}>
                  {/* Category Header */}
                  <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1.5 }}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                      {getMetricIcon(key)}
                      <Typography sx={{ fontWeight: 700, fontSize: 16, color: "#111827" }}>
                        {getMetricTitle(key)}
                      </Typography>
                    </Box>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                      <Typography sx={{ fontWeight: 800, fontSize: 18, color: progressColor }}>
                        {score}
                      </Typography>
                      <IconButton size="small" sx={{ p: 0.25 }}>
                        {isExpanded ? <ArrowUpIcon sx={{ fontSize: 18 }} /> : <ArrowDownIcon sx={{ fontSize: 18 }} />}
                      </IconButton>
                    </Box>
                  </Box>

                  {/* Horizontal Linear Progress Bar */}
                  <Box sx={{ width: "100%", mb: 1.5 }}>
                    <LinearProgress
                      variant="determinate"
                      value={score}
                      sx={{
                        height: 6,
                        borderRadius: 3,
                        bgcolor: "#f3f4f6",
                        "& .MuiLinearProgress-bar": {
                          bgcolor: progressColor,
                          borderRadius: 3
                        }
                      }}
                    />
                  </Box>

                  {/* Summary Subtext */}
                  <Typography sx={{ fontSize: 13, color: "#4b5563", lineHeight: 1.4 }}>
                    {data.subtext}
                  </Typography>

                  {/* Accordion / Expandable Detailed Checklist */}
                  <Collapse in={isExpanded} timeout="auto" unmountOnExit onClick={(e) => e.stopPropagation()}>
                    <Divider sx={{ my: 2 }} />
                    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
                      {(data.items || []).map((item: any, idx: number) => (
                        <Box key={idx} sx={{ display: "flex", gap: 1.5, alignItems: "flex-start" }}>
                          <Box sx={{ mt: 0.25, display: "flex" }}>{renderIcon(item.type)}</Box>
                          <Box>
                            <Typography sx={{ fontWeight: 600, fontSize: 13.5, color: "#111827" }}>
                              {item.title}
                            </Typography>
                            <Typography sx={{ fontSize: 12.5, color: "#4b5563", mt: 0.25, lineHeight: 1.4 }}>
                              {item.desc}
                            </Typography>
                          </Box>
                        </Box>
                      ))}
                    </Box>
                  </Collapse>
                </CardContent>
              </Card>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}
