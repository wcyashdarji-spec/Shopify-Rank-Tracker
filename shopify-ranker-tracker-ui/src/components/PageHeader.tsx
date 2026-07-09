// React
import type { ReactNode } from "react";

// Material UI
import { Box, Typography } from "@mui/material";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}

export default function PageHeader({
  title,
  subtitle,
  actions,
}: PageHeaderProps) {
  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        width: "100%",
      }}
    >
      <Box sx={{ flexGrow: 1 }}>
        <Typography sx={{ fontSize: 14, fontWeight: 600 }}>
          {title}
        </Typography>

        {subtitle && (
          <Typography sx={{ fontSize: 12, color: "#6b7280" }}>
            {subtitle}
          </Typography>
        )}
      </Box>

      {actions}
    </Box>
  );
}