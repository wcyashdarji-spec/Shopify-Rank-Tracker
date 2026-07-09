// React
import type { ReactNode } from "react";

// Material UI
import { Box, IconButton, Tooltip } from "@mui/material";
import { Menu as MenuIcon } from "@mui/icons-material";

// Components
import ScraperLogs from "./ScraperLogs";
import Sidebar from "./Sidebar";

// Types
import type { App } from "../api";

interface LayoutProps {
  apps: App[];
  selectedApp: App | null;
  onSelectApp: (app: App) => void;
  onRunAllSaved: () => void;
  onTrackApp: (name: string, url: string, keywordsList: string[]) => void;
  onDeleteApp: (appId: number) => void;
  isScraping: boolean;
  scrapingLogs: string[];
  logsConsoleRef: React.RefObject<HTMLDivElement | null>;
  isLoadingApps: boolean;
  apiUrl: string;
  onSaveSettings: (url: string) => void;
  currentPage: "dashboard" | "history";
  onNavigate: (page: "dashboard" | "history") => void;
  /** Optional top bar content rendered per-page (title, action buttons, etc.) */
  headerContent?: ReactNode;
  /** Whether the sidebar is currently hidden */
  sidebarCollapsed: boolean;
  /** Toggles the sidebar open/closed */
  onToggleSidebar: () => void;
  children: ReactNode;
  
}

const SIDEBAR_WIDTH = 240;

export default function Layout({
  apps,
  selectedApp,
  onSelectApp,
  onRunAllSaved,
  onTrackApp,
  onDeleteApp,
  isScraping,
  scrapingLogs,
  logsConsoleRef,
  isLoadingApps,
  apiUrl,
  onSaveSettings,
  currentPage,
  onNavigate,
  headerContent,
  sidebarCollapsed,
  onToggleSidebar,
  children,
}: LayoutProps) {
  return (
    <Box sx={{ display: "flex", height: "100vh", overflow: "hidden", bgcolor: "background.default" }}>
      {/* Sidebar wrapper — collapses width to 0 instead of unmounting, so Sidebar's own state
          (search text, expanded Reports/Apps sections, etc.) survives toggling */}
      <Box
        sx={{
          width: sidebarCollapsed ? 0 : SIDEBAR_WIDTH,
          flexShrink: 0,
          overflow: "hidden",
          transition: "width 0.2s ease",
        }}
      >
        <Box sx={{ width: SIDEBAR_WIDTH, height: "100%" }}>
          <Sidebar
            apps={apps}
            selectedApp={selectedApp}
            onSelectApp={onSelectApp}
            onRunAllSaved={onRunAllSaved}
            onTrackApp={onTrackApp}
            onDeleteApp={onDeleteApp}
            isScraping={isScraping}
            isLoadingApps={isLoadingApps}
            apiUrl={apiUrl}
            onSaveSettings={onSaveSettings}
            currentPage={currentPage}
            onNavigate={onNavigate}
          />
        </Box>
      </Box>

      {/* Main panel */}
      <Box sx={{ flexGrow: 1, display: "flex", flexDirection: "column", height: "100vh", overflow: "hidden", minWidth: 0 }}>
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 1.5,
            px: 3,
            py: 1.5,
            bgcolor: "#fff",
            borderBottom: "1px solid #e5e7eb",
            flexShrink: 0,
          }}
        >
          <Tooltip title={sidebarCollapsed ? "Show sidebar" : "Hide sidebar"}>
            <IconButton
              size="small"
              onClick={onToggleSidebar}
              sx={{
                border: "1px solid #e5e7eb",
                borderRadius: "8px",
                width: 32,
                height: 32,
                color: "#6b7280",
                flexShrink: 0,
                "&:hover": {
                  bgcolor: "#f9fafb",
                  borderColor: "#d1d5db",
                },
              }}
            >
              <MenuIcon sx={{ fontSize: 18 }} />
            </IconButton>
          </Tooltip>

          {headerContent}
          
        </Box>

        <Box sx={{ flexGrow: 1, overflowY: "auto" }}>
          {isScraping ? <ScraperLogs logs={scrapingLogs} logsConsoleRef={logsConsoleRef} /> : children}
        </Box>
      </Box>
    </Box>
  );
}