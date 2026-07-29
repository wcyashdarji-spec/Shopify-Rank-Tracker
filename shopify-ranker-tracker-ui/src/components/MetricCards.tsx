// Material UI
import { Box, Paper, Typography } from "@mui/material";
import CheckIcon from "@mui/icons-material/CheckCircleOutlined";
import TrophyIcon from "@mui/icons-material/EmojiEvents";
import SearchIcon from "@mui/icons-material/Search";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import StarIcon from "@mui/icons-material/Star";

interface MetricCardsProps {
  totalKeywords: number;
  currentAvgRank: string;
  successRate: string;
  topPositions: number;
  listingScore: number | null;
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
  listingScore,
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
    {
      label: "Listing Score",
      value: listingScore !== null ? listingScore : "--",
      icon: <StarIcon sx={{ fontSize: 18 }} />,
      accent: "#006e52",
    },
  ];

  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: {
          xs: "repeat(2, 1fr)",
          sm: "repeat(2, 1fr)",
          md: "repeat(5, 1fr)",
        },
        gap: 2,
        mb: 3,
      }}
    >
      {cards.map((card) => (
        <Paper
          key={card.label}
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
      ))}
    </Box>
  );
}
