import React from "react";
import { Box, Paper, Typography } from "@mui/material";
import CheckIcon from "@mui/icons-material/CheckCircleOutlined";
import TrophyIcon from "@mui/icons-material/EmojiEvents";
import SearchIcon from "@mui/icons-material/Search";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import StarIcon from "@mui/icons-material/Star";
import { motion } from "motion/react";

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
  gradientBg: string;
  badgeText?: string;
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
      subtext: "Keywords tracked",
      icon: <SearchIcon sx={{ fontSize: 20 }} />,
      accent: "#3b82f6",
      bg: "#eff6ff",
      gradientBg: "linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(239, 246, 255, 0.7) 100%)",
      badgeText: "Active",
    },
    {
      label: "Avg. Position",
      value: currentAvgRank,
      subtext: "Average rank",
      icon: <TrendingUpIcon sx={{ fontSize: 20 }} />,
      accent: "#10b981",
      bg: "#ecfdf5",
      gradientBg: "linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(236, 253, 245, 0.7) 100%)",
      badgeText: "Current Rank",
    },
    {
      label: "Found Rate",
      value: successRate,
      subtext: "Found in search",
      icon: <CheckIcon sx={{ fontSize: 20 }} />,
      accent: "#f59e0b",
      bg: "#fffbeb",
      gradientBg: "linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(254, 243, 199, 0.7) 100%)",
      badgeText: "Found",
    },
    {
      label: "Top 5 Hits",
      value: topPositions,
      subtext: "Top 5 rankings",
      icon: <TrophyIcon sx={{ fontSize: 20 }} />,
      accent: "#ec4899",
      bg: "#fce7f3",
      gradientBg: "linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(252, 231, 243, 0.7) 100%)",
      badgeText: "Top Ranks",
    },
    {
      label: "Listing Score",
      value: listingScore !== null ? `${listingScore}/100` : "--",
      subtext: "Listing score",
      icon: <StarIcon sx={{ fontSize: 20 }} />,
      accent: "#8b5cf6",
      bg: "#f5f3ff",
      gradientBg: "linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(245, 243, 255, 0.7) 100%)",
      badgeText: "Health Score",
    },
  ];

  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: {
          xs: "1fr",
          sm: "repeat(2, 1fr)",
          md: "repeat(3, 1fr)",
          lg: "repeat(5, 1fr)",
        },
        gap: { xs: 1.75, sm: 2.5 },
        mb: 3.5,
      }}
    >
      {cards.map((card) => (
        <motion.div
          key={card.label}
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          whileHover={{
            y: -5,
            scale: 1.02,
            transition: { type: "spring", stiffness: 400, damping: 22 },
          }}
          whileTap={{ scale: 0.98 }}
        >
          <Paper
            elevation={0}
            sx={{
              p: { xs: 2, sm: 2.5 },
              borderRadius: "20px",
              border: "1px solid #e2e8f0",
              background: card.gradientBg,
              backdropFilter: "blur(16px)",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              boxShadow: "0 4px 20px -2px rgba(15, 23, 42, 0.04)",
              transition: "all 0.25s ease-in-out",
              position: "relative",
              overflow: "hidden",
              "&:hover": {
                borderColor: card.accent,
                boxShadow: `0 14px 32px -4px ${card.accent}30`,
              },
            }}
          >
            {/* Ambient Accent Glow Pill Top Right */}
            <Box
              sx={{
                position: "absolute",
                top: -15,
                right: -15,
                width: 60,
                height: 60,
                borderRadius: "50%",
                background: `radial-gradient(circle, ${card.accent}25 0%, rgba(255,255,255,0) 70%)`,
                pointerEvents: "none",
              }}
            />

            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 2 }}>
              <Typography
                sx={{
                  fontSize: 11,
                  fontWeight: 800,
                  color: "#64748b",
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                }}
              >
                {card.label}
              </Typography>
              <Box
                sx={{
                  width: 36,
                  height: 36,
                  borderRadius: "12px",
                  bgcolor: card.bg,
                  color: card.accent,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  boxShadow: `0 4px 10px ${card.accent}20`,
                }}
              >
                {card.icon}
              </Box>
            </Box>

            <Box>
              <Box sx={{ display: "flex", alignItems: "baseline", gap: 1 }}>
                <Typography
                  sx={{
                    fontSize: { xs: 22, sm: 26, md: 28 },
                    fontWeight: 800,
                    color: "#0f172a",
                    lineHeight: 1.1,
                    fontFamily: "'Plus Jakarta Sans', sans-serif",
                  }}
                >
                  {card.value}
                </Typography>
              </Box>
              <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mt: 0.75 }}>
                <Typography sx={{ fontSize: 11, color: "#64748b", fontWeight: 500 }}>
                  {card.subtext}
                </Typography>
                {card.badgeText && (
                  <Typography
                    sx={{
                      fontSize: 10,
                      fontWeight: 700,
                      color: card.accent,
                      bgcolor: card.bg,
                      px: 0.75,
                      py: 0.2,
                      borderRadius: "6px",
                      border: `1px solid ${card.accent}30`,
                    }}
                  >
                    {card.badgeText}
                  </Typography>
                )}
              </Box>
            </Box>
          </Paper>
        </motion.div>
      ))}
    </Box>
  );
}
