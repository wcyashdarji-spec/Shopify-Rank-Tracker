import React from "react";
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
  subtext: string;
  icon: React.ReactNode;
  accent: string;
  bg: string;
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
      subtext: "Search queries",
      icon: <SearchIcon sx={{ fontSize: 20 }} />,
      accent: "#0284c7",
      bg: "#e0f2fe",
    },
    {
      label: "Avg. Position",
      value: currentAvgRank,
      subtext: "Rank placement",
      icon: <TrendingUpIcon sx={{ fontSize: 20 }} />,
      accent: "#10b981",
      bg: "#ecfdf5",
    },
    {
      label: "Found Rate",
      value: successRate,
      subtext: "Index coverage",
      icon: <CheckIcon sx={{ fontSize: 20 }} />,
      accent: "#f59e0b",
      bg: "#fffbeb",
    },
    {
      label: "Top 5 Hits",
      value: topPositions,
      subtext: "High ranking terms",
      icon: <TrophyIcon sx={{ fontSize: 20 }} />,
      accent: "#ec4899",
      bg: "#fce7f3",
    },
    {
      label: "Listing Score",
      value: listingScore !== null ? `${listingScore}/100` : "--",
      subtext: "ASO health audit",
      icon: <StarIcon sx={{ fontSize: 20 }} />,
      accent: "#0f172a",
      bg: "#f1f5f9",
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
        gap: 2.5,
        mb: 3.5,
      }}
    >
      {cards.map((card) => (
        <Paper
          key={card.label}
          elevation={0}
          sx={{
            p: 2.25,
            borderRadius: "14px",
            border: "1px solid #e2e8f0",
            bgcolor: "#ffffff",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            boxShadow: "0 4px 14px rgba(0,0,0,0.02)",
            transition: "all 0.2s ease-in-out",
            "&:hover": {
              transform: "translateY(-2px)",
              boxShadow: "0 8px 24px rgba(0,0,0,0.06)",
              borderColor: card.accent,
            },
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1.5 }}>
            <Typography sx={{ fontSize: 12, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.03em" }}>
              {card.label}
            </Typography>
            <Box
              sx={{
                width: 36,
                height: 36,
                borderRadius: "10px",
                bgcolor: card.bg,
                color: card.accent,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              {card.icon}
            </Box>
          </Box>

          <Box>
            <Typography sx={{ fontSize: 24, fontWeight: 800, color: "#0f172a", lineHeight: 1.1 }}>
              {card.value}
            </Typography>
            <Typography sx={{ fontSize: 11, color: "#94a3b8", mt: 0.5, fontWeight: 500 }}>
              {card.subtext}
            </Typography>
          </Box>
        </Paper>
      ))}
    </Box>
  );
}
