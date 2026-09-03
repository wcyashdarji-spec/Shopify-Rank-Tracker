import type { ReactNode } from "react";
import { Box, IconButton, Tooltip } from "@mui/material";
import MenuIcon from "@mui/icons-material/Menu";
import { motion, AnimatePresence } from "motion/react";
import Sidebar from "./Sidebar";
import type { App } from "../api";

interface LayoutProps {
  apps: App[];
  selectedApp: App | null;
  onSelectApp: (app: App | null) => void;
  onRunAllSaved: () => void;
  onTrackApp: (name: string, url: string, keywordsList: string[]) => void;
  onDeleteApp: (appId: number) => void;
  isLoadingApps: boolean;
  currentPage: "dashboard" | "history" | "settings" | "optimizer" | "competitors" | "integrations";
  onNavigate: (page: "dashboard" | "history" | "settings" | "optimizer" | "competitors" | "integrations") => void;
  headerContent?: ReactNode;
  sidebarCollapsed: boolean;
  onToggleSidebar: () => void;
  children: ReactNode;
  onLogout?: () => void;
}

const SIDEBAR_WIDTH = 250;

export default function Layout({
  apps,
  selectedApp,
  onSelectApp,
  onRunAllSaved,
  onTrackApp,
  onDeleteApp,
  isLoadingApps,
  currentPage,
  onNavigate,
  headerContent,
  sidebarCollapsed,
  onToggleSidebar,
  children,
  onLogout,
}: LayoutProps) {
  return (
    <Box
      className="animated-mesh-bg tech-grid-pattern"
      sx={{
        display: "flex",
        height: "100vh",
        overflow: "hidden",
        position: "relative",
      }}
    >
      {/* Ambient Radial Background Spheres & Floating Orbs */}
      <Box className="animated-orb-blue" sx={{ top: "-150px", left: "-100px" }} />
      <Box className="animated-orb-purple" sx={{ top: "30%", right: "-150px" }} />
      <Box className="animated-orb-emerald" sx={{ bottom: "-100px", left: "20%" }} />

      {/* Floating Animated Accent Particles */}
      <Box className="floating-particle" sx={{ width: 8, height: 8, bgcolor: "#3b82f6", top: "10%", left: "30%", animationDelay: "0s" }} />
      <Box className="floating-particle" sx={{ width: 12, height: 12, bgcolor: "#8b5cf6", top: "60%", right: "15%", animationDelay: "3s" }} />
      <Box className="floating-particle" sx={{ width: 10, height: 10, bgcolor: "#10b981", bottom: "15%", left: "45%", animationDelay: "1.5s" }} />

      {/* Sidebar Wrapper */}
      <Box
        component={motion.div}
        animate={{ width: sidebarCollapsed ? 0 : SIDEBAR_WIDTH }}
        transition={{ type: "spring", stiffness: 350, damping: 30 }}
        sx={{
          flexShrink: 0,
          overflow: "hidden",
          height: "100%",
          zIndex: 10,
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
            isLoadingApps={isLoadingApps}
            currentPage={currentPage}
            onNavigate={onNavigate}
            onLogout={onLogout}
          />
        </Box>
      </Box>

      {/* Main Panel Content Area */}
      <Box
        sx={{
          flexGrow: 1,
          display: "flex",
          flexDirection: "column",
          height: "100vh",
          overflow: "hidden",
          minWidth: 0,
          position: "relative",
          zIndex: 1,
        }}
      >
        {/* Sticky Glass Navbar */}
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 1.5,
            px: 3,
            py: 1.5,
            bgcolor: "rgba(255, 255, 255, 0.85)",
            backdropFilter: "blur(16px)",
            WebkitBackdropFilter: "blur(16px)",
            borderBottom: "1px solid rgba(226, 232, 240, 0.8)",
            flexShrink: 0,
            boxShadow: "0 2px 10px rgba(15, 23, 42, 0.02)",
          }}
        >
          <Tooltip title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}>
            <IconButton
              component={motion.button}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              size="small"
              onClick={onToggleSidebar}
              sx={{
                border: "1px solid #e2e8f0",
                borderRadius: "10px",
                width: 36,
                height: 36,
                color: "#475569",
                bgcolor: "#ffffff",
                boxShadow: "0 2px 5px rgba(0,0,0,0.03)",
                flexShrink: 0,
                "&:hover": {
                  bgcolor: "#f8fafc",
                  borderColor: "#cbd5e1",
                  color: "#0f172a",
                },
              }}
            >
              <MenuIcon sx={{ fontSize: 18 }} />
            </IconButton>
          </Tooltip>

          {headerContent}
        </Box>

        {/* Dynamic Route Children Area */}
        <Box
          sx={{
            flexGrow: 1,
            overflowY: "auto",
            p: { xs: 2, sm: 3, md: 4 },
          }}
        >
          <AnimatePresence mode="wait">
            <Box
              key={currentPage}
              component={motion.div}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -14 }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            >
              {children}
            </Box>
          </AnimatePresence>
        </Box>
      </Box>
    </Box>
  );
}