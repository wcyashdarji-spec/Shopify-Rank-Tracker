// React
import { type RefObject, useEffect } from "react";

// Material UI
import { Box, Typography } from "@mui/material";

interface ScraperLogsProps {
  logs: string[];
  logsConsoleRef: RefObject<HTMLDivElement | null>;
}

export default function ScraperLogs({ logs, logsConsoleRef }: ScraperLogsProps) {
  useEffect(() => {
    if (logsConsoleRef.current) {
      logsConsoleRef.current.scrollTop = logsConsoleRef.current.scrollHeight;
    }
  }, [logs, logsConsoleRef]);

  return (
    <Box
      sx={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        bgcolor: "#f9fafb",
        p: 4,
        gap: 4,
      }}
    >
      {/* Radar animation */}
      <Box sx={{ position: "relative", width: 120, height: 120 }}>
        <svg viewBox="0 0 120 120" width={120} height={120}>
          <circle cx="60" cy="60" r="55" fill="none" stroke="#e5e7eb" strokeWidth="1.5" className="radar-ring" />
          <circle cx="60" cy="60" r="38" fill="none" stroke="#e5e7eb" strokeWidth="1.5" className="radar-ring" style={{ animationDelay: "0.5s" }} />
          <circle cx="60" cy="60" r="20" fill="none" stroke="#e5e7eb" strokeWidth="1.5" className="radar-ring" style={{ animationDelay: "1s" }} />
          <g className="radar-sweep">
            <path d="M60 60 L60 5" stroke="#6366f1" strokeWidth="2" strokeLinecap="round" opacity="0.8" />
            <path d="M60 60 L115 60" stroke="#6366f1" strokeWidth="2" strokeLinecap="round" opacity="0.4" />
          </g>
          <circle cx="60" cy="60" r="4" fill="#6366f1" />
        </svg>
      </Box>

      <Box sx={{ textAlign: "center" }}>
        <Typography sx={{ fontWeight: 600, fontSize: 16, color: "#111827", mb: 0.5 }}>
          Scraper Running
        </Typography>
        <Typography sx={{ fontSize: 13, color: "#6b7280" }}>
          Playwright is scanning Shopify App Store results…
        </Typography>
      </Box>

      {/* Console output */}
      <Box
        ref={logsConsoleRef}
        sx={{
          width: "100%",
          maxWidth: 680,
          height: 220,
          overflowY: "auto",
          bgcolor: "#111827",
          borderRadius: "10px",
          p: 2,
          fontFamily: "'Fira Mono', 'Consolas', monospace",
          fontSize: 12.5,
          lineHeight: 1.7,
          border: "1px solid #e5e7eb",
          boxShadow: "0 4px 20px rgba(0,0,0,0.08)",
        }}
      >
        {logs.map((log, i) => {
          const isError = log.includes("[ERROR]");
          const isDone = log.includes("[Done]");
          const color = isError ? "#f87171" : isDone ? "#34d399" : "#a5b4fc";
          return (
            <Typography
              key={i}
              component="div"
              sx={{
                fontSize: 12.5,
                color,
                fontFamily: "monospace",
                lineHeight: 1.7,
                whiteSpace: "pre-wrap",
              }}
            >
              {log}
            </Typography>
          );
        })}
        {logs.length === 0 && (
          <Typography sx={{ color: "#4b5563", fontSize: 12.5, fontFamily: "monospace" }}>
            Initializing…
          </Typography>
        )}
      </Box>
    </Box>
  );
}
