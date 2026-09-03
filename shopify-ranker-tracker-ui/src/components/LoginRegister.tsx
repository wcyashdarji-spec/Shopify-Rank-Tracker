import { useState, useEffect } from "react";
import {
  Box,
  Button,
  Card,
  Chip,
  Container,
  TextField,
  Typography,
  CircularProgress,
  Alert,
  InputAdornment,
  IconButton,
} from "@mui/material";
import VisibilityIcon from "@mui/icons-material/Visibility";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import EmailOutlinedIcon from "@mui/icons-material/EmailOutlined";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import { motion } from "motion/react";
import AppLogo from "./AppLogo";
import { api } from "../api";

declare global {
  interface Window {
    google?: any;
  }
}

const GoogleIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24">
    <path
      fill="#4285F4"
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
    />
    <path
      fill="#34A853"
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
    />
    <path
      fill="#FBBC05"
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
    />
    <path
      fill="#EA4335"
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
    />
  </svg>
);

interface LoginRegisterProps {
  onLoginSuccess: () => void;
}

export default function LoginRegister({ onLoginSuccess }: LoginRegisterProps) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleRedirecting, setIsGoogleRedirecting] = useState(false);
  const [isGoogleAuthLoading, setIsGoogleAuthLoading] = useState(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      return params.has("auth_code") || params.has("code");
    }
    return false;
  });

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const authCode = urlParams.get("auth_code");
    const code = urlParams.get("code");

    if (authCode) {
      window.history.replaceState({}, document.title, window.location.pathname);
      handleAuthCodeExchange(authCode);
    } else if (code) {
      window.history.replaceState({}, document.title, window.location.pathname);
      handleGoogleOAuthCallback(code);
    }
  }, []);

  const handleAuthCodeExchange = async (authCode: string) => {
    setIsGoogleAuthLoading(true);
    setError(null);
    try {
      await api.exchangeAuthCode(authCode);
      onLoginSuccess();
    } catch (err: any) {
      setError(err?.message || "Authentication code exchange failed.");
    } finally {
      setIsGoogleAuthLoading(false);
    }
  };

  const handleGoogleOAuthCallback = async (code: string) => {
    setIsGoogleAuthLoading(true);
    setError(null);
    try {
      await api.googleOAuthCallback(code);
      onLoginSuccess();
    } catch (err: any) {
      setError(err?.message || "Google OAuth 2.0 authorization code exchange failed.");
    } finally {
      setIsGoogleAuthLoading(false);
    }
  };

  const handleGoogleButtonClick = async () => {
    setIsGoogleRedirecting(true);
    setError(null);
    try {
      const res = await api.getGoogleAuthUrl();
      if (res?.url) {
        window.location.href = res.url;
        return;
      }
      setError("Google OAuth is not configured on the server.");
      setIsGoogleRedirecting(false);
    } catch (err: any) {
      setError(err?.message || "Failed to initiate Google OAuth login.");
      setIsGoogleRedirecting(false);
    }
  };

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const isEmailValid = emailRegex.test(email.trim());

  const hasMinLength = password.length >= 8;
  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasNumberOrSpecial = /[0-9!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);
  const isPasswordValid = hasMinLength && hasUppercase && hasLowercase && hasNumberOrSpecial;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password || (!isLogin && !confirmPassword)) {
      setError("Please fill in all required fields.");
      return;
    }

    if (!isEmailValid) {
      setError("Please enter a valid email address (e.g. user@domain.com).");
      return;
    }

    if (!isLogin) {
      if (!isPasswordValid) {
        setError("Password does not meet security criteria (8+ chars, uppercase, lowercase, and number/symbol).");
        return;
      }

      if (password !== confirmPassword) {
        setError("Passwords do not match. Please re-enter your confirm password.");
        return;
      }
    }

    setIsLoading(true);
    try {
      if (isLogin) {
        await api.login(trimmedEmail, password);
        onLoginSuccess();
      } else {
        await api.register(trimmedEmail, password);
        setSuccess("Account created successfully! Please sign in using your credentials.");
        setIsLogin(true);
        setPassword("");
        setConfirmPassword("");
      }
    } catch (err: any) {
      setError(err?.message || "Authentication failed. Please check your credentials.");
    } finally {
      setIsLoading(false);
    }
  };

  if (isGoogleAuthLoading) {
    return (
      <Box
        sx={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          bgcolor: "#f8fafc",
          color: "#0f172a",
          gap: 2.5,
          position: "relative",
          overflow: "hidden",
        }}
      >
        <CircularProgress size={56} thickness={4} sx={{ color: "#3b82f6" }} />
        <Box sx={{ textAlign: "center", zIndex: 1 }}>
          <Typography sx={{ fontSize: 20, fontWeight: 800, color: "#0f172a", mb: 0.5 }}>
            Authenticating...
          </Typography>
          <Typography sx={{ fontSize: 14, color: "#64748b", fontWeight: 500 }}>
            Signing you into your Shopify Rank Tracker dashboard
          </Typography>
        </Box>
      </Box>
    );
  }

  return (
    <Box
      className="animated-mesh-bg tech-grid-pattern"
      sx={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        p: { xs: 2, md: 4 },
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Dynamic Animated Floating Orbs */}
      <Box className="animated-orb-blue" sx={{ top: "-15%", left: "-10%" }} />
      <Box className="animated-orb-purple" sx={{ bottom: "-15%", right: "-10%" }} />
      <Box className="animated-orb-emerald" sx={{ top: "20%", right: "15%" }} />
      <Box className="animated-orb-orange" sx={{ bottom: "10%", left: "10%" }} />

      {/* Floating Animated Accent Particles */}
      <Box className="floating-particle" sx={{ width: 10, height: 10, bgcolor: "#3b82f6", top: "15%", left: "20%", animationDelay: "0s" }} />
      <Box className="floating-particle" sx={{ width: 14, height: 14, bgcolor: "#8b5cf6", top: "70%", left: "15%", animationDelay: "2s" }} />
      <Box className="floating-particle" sx={{ width: 12, height: 12, bgcolor: "#10b981", top: "25%", right: "25%", animationDelay: "4s" }} />
      <Box className="floating-particle" sx={{ width: 8, height: 8, bgcolor: "#ec4899", bottom: "20%", right: "18%", animationDelay: "1s" }} />

      <Container maxWidth="lg" sx={{ p: "0 !important", position: "relative", zIndex: 2 }}>
        <Box
          component={motion.div}
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        >
          <Card
            elevation={0}
            sx={{
              display: "flex",
              flexDirection: { xs: "column", md: "row" },
              borderRadius: "24px",
              overflow: "hidden",
              border: "1px solid rgba(226, 232, 240, 0.8)",
              boxShadow: "0 25px 60px -15px rgba(15, 23, 42, 0.08)",
              bgcolor: "#ffffff",
              minHeight: 640,
            }}
          >
            {/* Left Branding Showcase Panel */}
            <Box
              sx={{
                flex: { md: 1.1 },
                background: "linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)",
                p: { xs: 4, md: 6 },
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                position: "relative",
                color: "#fff",
                overflow: "hidden",
              }}
            >
              <Box sx={{ position: "relative", zIndex: 1 }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 4 }}>
                  <AppLogo size={40} />
                  <Typography sx={{ fontWeight: 800, fontSize: 22, letterSpacing: "-0.5px" }}>
                    Rank Tracker
                  </Typography>
                </Box>

                <Typography variant="h4" sx={{ fontWeight: 800, lineHeight: 1.25, mb: 2, fontSize: { xs: 26, md: 34 } }}>
                  Track & Dominate Your Shopify App Rankings
                </Typography>
                <Typography sx={{ color: "#94a3b8", fontSize: 15, lineHeight: 1.6, maxWidth: 440 }}>
                  Real-time keyword position tracking, competitor head-to-head analysis, and automated ASO listing audit tools built for Shopify app developers.
                </Typography>
              </Box>

              {/* Feature Showcase Card */}
              <Box
                component={motion.div}
                whileHover={{ y: -4 }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
                sx={{ position: "relative", zIndex: 1, my: 4 }}
              >
                <Box
                  sx={{
                    p: 3,
                    borderRadius: "18px",
                    bgcolor: "rgba(255, 255, 255, 0.06)",
                    backdropFilter: "blur(16px)",
                    border: "1px solid rgba(255, 255, 255, 0.12)",
                    display: "flex",
                    flexDirection: "column",
                    gap: 2,
                  }}
                >
                  <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                      <TrendingUpIcon sx={{ color: "#10b981", fontSize: 20 }} />
                      <Typography sx={{ fontSize: 13, fontWeight: 800, color: "#34d399", letterSpacing: "0.03em" }}>
                        ASO RANK BOOST
                      </Typography>
                    </Box>
                    <Chip label="Live Scans" size="small" sx={{ bgcolor: "rgba(59, 130, 246, 0.2)", color: "#60a5fa", fontSize: 10, fontWeight: 700 }} />
                  </Box>

                  {[
                    "Daily automated Shopify App Store rank tracking",
                    "Side-by-side competitor keyword visibility matrix",
                    "Instant ASO listing optimization score audits",
                  ].map((feat) => (
                    <Box key={feat} sx={{ display: "flex", alignItems: "center", gap: 1.25 }}>
                      <CheckCircleIcon sx={{ fontSize: 17, color: "#38bdf8" }} />
                      <Typography sx={{ fontSize: 13.5, color: "#e2e8f0", fontWeight: 500 }}>
                        {feat}
                      </Typography>
                    </Box>
                  ))}
                </Box>
              </Box>

              <Typography sx={{ fontSize: 12, color: "#64748b", position: "relative", zIndex: 1 }}>
                © {new Date().getFullYear()} Shopify Rank Tracker. All rights reserved.
              </Typography>
            </Box>

            {/* Right Authentication Form Panel */}
            <Box
              sx={{
                flex: 1,
                bgcolor: "#ffffff",
                p: { xs: 3.5, sm: 5, md: 6 },
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
              }}
            >
              <Box sx={{ maxWidth: 400, mx: "auto", width: "100%" }}>
                {/* Tab Controls */}
                <Box
                  sx={{
                    display: "flex",
                    bgcolor: "#f1f5f9",
                    p: 0.5,
                    borderRadius: "12px",
                    mb: 3.5,
                  }}
                >
                  <Button
                    fullWidth
                    onClick={() => setIsLogin(true)}
                    sx={{
                      py: 0.85,
                      borderRadius: "9px",
                      fontSize: 13,
                      fontWeight: 700,
                      textTransform: "none",
                      color: isLogin ? "#0f172a" : "#64748b",
                      bgcolor: isLogin ? "#ffffff" : "transparent",
                      boxShadow: isLogin ? "0 2px 8px rgba(15, 23, 42, 0.08)" : "none",
                      transition: "all 0.2s ease",
                    }}
                  >
                    Sign In
                  </Button>
                  <Button
                    fullWidth
                    onClick={() => setIsLogin(false)}
                    sx={{
                      py: 0.85,
                      borderRadius: "9px",
                      fontSize: 13,
                      fontWeight: 700,
                      textTransform: "none",
                      color: !isLogin ? "#0f172a" : "#64748b",
                      bgcolor: !isLogin ? "#ffffff" : "transparent",
                      boxShadow: !isLogin ? "0 2px 8px rgba(15, 23, 42, 0.08)" : "none",
                      transition: "all 0.2s ease",
                    }}
                  >
                    Create Account
                  </Button>
                </Box>

                <Box sx={{ mb: 3.5 }}>
                  <Typography variant="h5" sx={{ fontWeight: 800, color: "#0f172a", fontSize: 24, mb: 0.5 }}>
                    {isLogin ? "Welcome Back" : "Get Started Free"}
                  </Typography>
                  <Typography sx={{ color: "#64748b", fontSize: 13.5 }}>
                    {isLogin
                      ? "Enter your account credentials to view your app store rank metrics."
                      : "Create your free account to track keyword positions today."}
                  </Typography>
                </Box>

                {success && (
                  <Alert
                    severity="success"
                    variant="outlined"
                    sx={{
                      mb: 3,
                      borderRadius: "12px",
                      fontSize: 13,
                      bgcolor: "#f0fdf4",
                      color: "#15803d",
                      borderColor: "#bbf7d0",
                    }}
                    onClose={() => setSuccess(null)}
                  >
                    {success}
                  </Alert>
                )}

                {error && (
                  <Alert
                    severity="error"
                    variant="outlined"
                    sx={{
                      mb: 3,
                      borderRadius: "12px",
                      fontSize: 13,
                      bgcolor: "#fef2f2",
                      color: "#b91c1c",
                      borderColor: "#fca5a5",
                    }}
                    onClose={() => setError(null)}
                  >
                    {error}
                  </Alert>
                )}

                <form onSubmit={handleSubmit}>
                  <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5 }}>
                    <TextField
                      fullWidth
                      label="Email Address"
                      type="email"
                      placeholder="developer@company.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      disabled={isLoading}
                      slotProps={{
                        input: {
                          startAdornment: (
                            <InputAdornment position="start">
                              <EmailOutlinedIcon sx={{ fontSize: 18, color: "#94a3b8" }} />
                            </InputAdornment>
                          ),
                          sx: {
                            fontSize: 13.5,
                            borderRadius: "12px",
                            bgcolor: "#f8fafc",
                            "& fieldset": { borderColor: "#e2e8f0" },
                            "&:hover fieldset": { borderColor: "#cbd5e1" },
                            "&.Mui-focused fieldset": { borderColor: "#3b82f6" },
                          },
                        },
                        inputLabel: { shrink: true, sx: { fontSize: 13.5, fontWeight: 700, color: "#475569" } },
                      }}
                    />

                    <TextField
                      fullWidth
                      label="Password"
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      disabled={isLoading}
                      slotProps={{
                        input: {
                          startAdornment: (
                            <InputAdornment position="start">
                              <LockOutlinedIcon sx={{ fontSize: 18, color: "#94a3b8" }} />
                            </InputAdornment>
                          ),
                          endAdornment: (
                            <InputAdornment position="end">
                              <IconButton
                                size="small"
                                onClick={() => setShowPassword(!showPassword)}
                                edge="end"
                              >
                                {showPassword ? (
                                  <VisibilityOffIcon sx={{ fontSize: 18, color: "#94a3b8" }} />
                                ) : (
                                  <VisibilityIcon sx={{ fontSize: 18, color: "#94a3b8" }} />
                                )}
                              </IconButton>
                            </InputAdornment>
                          ),
                          sx: {
                            fontSize: 13.5,
                            borderRadius: "12px",
                            bgcolor: "#f8fafc",
                            "& fieldset": { borderColor: "#e2e8f0" },
                            "&:hover fieldset": { borderColor: "#cbd5e1" },
                            "&.Mui-focused fieldset": { borderColor: "#3b82f6" },
                          },
                        },
                        inputLabel: { shrink: true, sx: { fontSize: 13.5, fontWeight: 700, color: "#475569" } },
                      }}
                    />

                    {!isLogin && (
                      <TextField
                        fullWidth
                        label="Confirm Password"
                        type={showConfirmPassword ? "text" : "password"}
                        placeholder="••••••••"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        disabled={isLoading}
                        slotProps={{
                          input: {
                            startAdornment: (
                              <InputAdornment position="start">
                                <LockOutlinedIcon sx={{ fontSize: 18, color: "#94a3b8" }} />
                              </InputAdornment>
                            ),
                            endAdornment: (
                              <InputAdornment position="end">
                                <IconButton
                                  size="small"
                                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                  edge="end"
                                >
                                  {showConfirmPassword ? (
                                    <VisibilityOffIcon sx={{ fontSize: 18, color: "#94a3b8" }} />
                                  ) : (
                                    <VisibilityIcon sx={{ fontSize: 18, color: "#94a3b8" }} />
                                  )}
                                </IconButton>
                              </InputAdornment>
                            ),
                            sx: {
                              fontSize: 13.5,
                              borderRadius: "12px",
                              bgcolor: "#f8fafc",
                              "& fieldset": { borderColor: "#e2e8f0" },
                              "&:hover fieldset": { borderColor: "#cbd5e1" },
                              "&.Mui-focused fieldset": { borderColor: "#3b82f6" },
                            },
                          },
                          inputLabel: { shrink: true, sx: { fontSize: 13.5, fontWeight: 700, color: "#475569" } },
                        }}
                      />
                    )}

                    <Button
                      fullWidth
                      component={motion.button}
                      whileHover={{ scale: 1.01 }}
                      whileTap={{ scale: 0.98 }}
                      transition={{ type: "spring", stiffness: 400, damping: 20 }}
                      type="submit"
                      variant="contained"
                      disabled={isLoading}
                      sx={{
                        py: 1.35,
                        mt: 1,
                        background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
                        borderRadius: "12px",
                        fontSize: 14,
                        fontWeight: 800,
                        textTransform: "none",
                        boxShadow: "0 6px 18px rgba(15, 23, 42, 0.2)",
                        "&:hover": {
                          background: "linear-gradient(135deg, #1e293b 0%, #334155 100%)",
                          boxShadow: "0 8px 24px rgba(15, 23, 42, 0.28)",
                        },
                      }}
                    >
                      {isLoading ? (
                        <CircularProgress size={22} sx={{ color: "#ffffff" }} />
                      ) : isLogin ? (
                        "Sign In"
                      ) : (
                        "Create Free Account"
                      )}
                    </Button>
                  </Box>
                </form>

                {/* Google Single Sign-On Button */}
                <Box sx={{ mt: 3, pt: 3, borderTop: "1px solid #f1f5f9" }}>
                  <Button
                    fullWidth
                    variant="outlined"
                    onClick={handleGoogleButtonClick}
                    disabled={isGoogleRedirecting}
                    startIcon={<GoogleIcon />}
                    sx={{
                      py: 1.2,
                      borderRadius: "12px",
                      borderColor: "#e2e8f0",
                      color: "#334155",
                      fontSize: 13.5,
                      fontWeight: 700,
                      textTransform: "none",
                      boxShadow: "0 2px 6px rgba(0,0,0,0.02)",
                      "&:hover": {
                        borderColor: "#cbd5e1",
                        bgcolor: "#f8fafc",
                      },
                    }}
                  >
                    {isGoogleRedirecting ? "Connecting to Google..." : "Continue with Google"}
                  </Button>
                </Box>
              </Box>
            </Box>
          </Card>
        </Box>
      </Container>
    </Box>
  );
}
