// Material UI
import { Box, Grid, Paper, Typography } from "@mui/material";
import CheckIcon from "@mui/icons-material/CheckCircleOutlined";
import TrophyIcon from "@mui/icons-material/EmojiEvents";
import SearchIcon from "@mui/icons-material/Search";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";

interface MetricCardsProps {
  totalKeywords: number;
  currentAvgRank: string;
  successRate: string;
  topPositions: number;
}

interface CardDef {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  accent: string;
}

export default function MetricCards({
  totalKeywords,
  currentAvgRank,
  successRate,
  topPositions,
}: MetricCardsProps) {
  const cards: CardDef[] = [
    {
      label: "Tracked Keywords",
      value: totalKeywords,
      icon: <SearchIcon sx={{ fontSize: 18 }} />,
      accent: "#6366f1",
    },
    {
      label: "Avg. Position",
      value: currentAvgRank,
      icon: <TrendingUpIcon sx={{ fontSize: 18 }} />,
      accent: "#14b8a6",
    },
    {
      label: "Found Rate",
      value: successRate,
      icon: <CheckIcon sx={{ fontSize: 18 }} />,
      accent: "#f59e0b",
    },
    {
      label: "Top 5 Hits",
      value: topPositions,
      icon: <TrophyIcon sx={{ fontSize: 18 }} />,
      accent: "#ec4899",
    },
  ];

  return (
    <Grid container spacing={2} sx={{ mb: 3 }}>
      {cards.map((card) => (
        <Grid size={{ xs: 6, sm: 3 }} key={card.label}>
          <Paper
            elevation={0}
            sx={{
              p: 2,
              borderRadius: "12px",
              border: "1px solid #e5e7eb",
              bgcolor: "#fff",
              display: "flex",
              alignItems: "flex-start",
              gap: 1.5,
              transition: "box-shadow 0.2s",
              "&:hover": { boxShadow: "0 4px 16px rgba(0,0,0,0.06)" },
            }}
          >
            <Box
              sx={{
                width: 36,
                height: 36,
                borderRadius: "10px",
                bgcolor: `${card.accent}14`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: card.accent,
                flexShrink: 0,
              }}
            >
              {card.icon}
            </Box>
            <Box>
              <Typography sx={{ fontSize: 11.5, color: "#6b7280", fontWeight: 500, mb: 0.25 }}>
                {card.label}
              </Typography>
              <Typography sx={{ fontSize: 22, fontWeight: 700, color: "#111827", lineHeight: 1.2 }}>
                {card.value}
              </Typography>
            </Box>
          </Paper>
        </Grid>
      ))}
    </Grid>
  );
}
