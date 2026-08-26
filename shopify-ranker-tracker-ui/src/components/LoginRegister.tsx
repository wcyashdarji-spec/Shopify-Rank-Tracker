import { useState } from "react";
import {
  Box,
  Button,
  Card,
  Chip,
  Container,
  TextField,
  Typography,
  Link,
  CircularProgress,
  Alert,
  Checkbox,
  FormControlLabel,
  InputAdornment,
  IconButton,
} from "@mui/material";
import VisibilityIcon from "@mui/icons-material/Visibility";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import EmailOutlinedIcon from "@mui/icons-material/EmailOutlined";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import AppLogo from "./AppLogo";
import { api } from "../api";

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
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Validation Helpers
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const isEmailValid = emailRegex.test(email.trim());

  const hasMinLength = password.length >= 8;
  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasNumberOrSpecial = /[0-9!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);
  const isPasswordValid = hasMinLength && hasUppercase && hasLowercase && hasNumberOrSpecial;

  const passwordsMatch = password.length > 0 && password === confirmPassword;

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

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        bgcolor: "#f8fafc",
        alignItems: "center",
        justifyContent: "center",
        p: { xs: 2, md: 4 },
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Dynamic Animated Background Blobs & Dot Matrix Mesh */}
      <Box
        sx={{
          position: "absolute",
          inset: 0,
          backgroundImage: "radial-gradient(circle, #94a3b8 1.2px, transparent 1.2px)",
          backgroundSize: "32px 32px",
          opacity: 0.35,
          animation: "pulseGrid 8s ease-in-out infinite",
          pointerEvents: "none",
        }}
      />

      {/* Morphing Gradient Orbs */}
      <Box
        sx={{
          position: "absolute",
          top: "-10%",
          left: "-8%",
          width: 520,
          height: 520,
          background: "radial-gradient(circle, rgba(99, 102, 241, 0.3) 0%, rgba(139, 92, 246, 0.08) 60%, transparent 80%)",
          filter: "blur(50px)",
          animation: "morphOrb1 16s ease-in-out infinite",
          pointerEvents: "none",
        }}
      />
      <Box
        sx={{
          position: "absolute",
          bottom: "-15%",
          right: "-8%",
          width: 580,
          height: 580,
          background: "radial-gradient(circle, rgba(236, 72, 153, 0.25) 0%, rgba(168, 85, 247, 0.08) 60%, transparent 80%)",
          filter: "blur(60px)",
          animation: "morphOrb2 20s ease-in-out infinite",
          pointerEvents: "none",
        }}
      />
      <Box
        sx={{
          position: "absolute",
          top: "35%",
          right: "15%",
          width: 420,
          height: 420,
          background: "radial-gradient(circle, rgba(16, 185, 129, 0.22) 0%, rgba(99, 102, 241, 0.05) 60%, transparent 80%)",
          filter: "blur(50px)",
          animation: "morphOrb1 18s ease-in-out infinite reverse",
          pointerEvents: "none",
        }}
      />



      {/* Global CSS Keyframe Animations */}
      <style>{`
        @keyframes morphOrb1 {
          0% { transform: translate(0px, 0px) rotate(0deg) scale(1); border-radius: 40% 60% 70% 30% / 40% 50% 60% 50%; }
          33% { transform: translate(70px, -50px) rotate(120deg) scale(1.18); border-radius: 60% 40% 30% 70% / 50% 60% 40% 60%; }
          66% { transform: translate(-30px, 40px) rotate(240deg) scale(0.92); border-radius: 30% 70% 50% 50% / 60% 30% 70% 40%; }
          100% { transform: translate(0px, 0px) rotate(360deg) scale(1); border-radius: 40% 60% 70% 30% / 40% 50% 60% 50%; }
        }
        @keyframes morphOrb2 {
          0% { transform: translate(0px, 0px) rotate(0deg) scale(1); border-radius: 60% 40% 50% 50% / 30% 60% 40% 70%; }
          50% { transform: translate(-80px, 60px) rotate(180deg) scale(1.22); border-radius: 40% 60% 70% 30% / 60% 40% 50% 50%; }
          100% { transform: translate(0px, 0px) rotate(360deg) scale(1); border-radius: 60% 40% 50% 50% / 30% 60% 40% 70%; }
        }
        @keyframes pulseGrid {
          0%, 100% { opacity: 0.35; }
          50% { opacity: 0.65; }
        }
        @keyframes floatBadge1 {
          0%, 100% { transform: translateY(0px) rotate(-2deg); }
          50% { transform: translateY(-16px) rotate(2deg); }
        }
        @keyframes floatBadge2 {
          0%, 100% { transform: translateY(0px) rotate(3deg); }
          50% { transform: translateY(-20px) rotate(-1deg); }
        }
        @keyframes floatBadge3 {
          0%, 100% { transform: translateY(0px) rotate(-1deg); }
          50% { transform: translateY(-14px) rotate(2deg); }
        }
      `}</style>

      <Container maxWidth="lg" sx={{ p: "0 !important", position: "relative", zIndex: 2 }}>
        <Card
          elevation={0}
          sx={{
            display: "flex",
            flexDirection: { xs: "column", md: "row" },
            borderRadius: "20px",
            overflow: "hidden",
            border: "1px solid #e2e8f0",
            boxShadow: "0 20px 50px rgba(15, 23, 42, 0.08)",
            bgcolor: "#ffffff",
            minHeight: 620,
          }}
        >
          {/* Left Visual Branding Panel */}
          <Box
            sx={{
              flex: { md: 1.1 },
              background: "linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #312e81 100%)",
              p: { xs: 4, md: 6 },
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              position: "relative",
              color: "#fff",
              overflow: "hidden",
            }}
          >
            {/* Ambient Background Glow */}
            <Box
              sx={{
                position: "absolute",
                top: "-10%",
                right: "-10%",
                width: 300,
                height: 300,
                borderRadius: "50%",
                background: "radial-gradient(circle, rgba(99, 102, 241, 0.35) 0%, rgba(0,0,0,0) 70%)",
                filter: "blur(40px)",
                pointerEvents: "none",
              }}
            />

            {/* Brand Logo & Header */}
            <Box sx={{ position: "relative", zIndex: 1 }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 4 }}>
                <AppLogo size={42} />
                <Typography sx={{ fontWeight: 700, fontSize: 20, letterSpacing: "-0.5px" }}>
                  Rank Tracker
                </Typography>
              </Box>

              <Typography variant="h4" sx={{ fontWeight: 800, lineHeight: 1.2, mb: 2, fontSize: { xs: 26, md: 32 } }}>
                Track & Dominate Your Shopify App Rankings
              </Typography>
              <Typography sx={{ color: "#94a3b8", fontSize: 14.5, lineHeight: 1.6, maxWidth: 440 }}>
                Real-time keyword position tracking, competitor head-to-head analysis, and automated listing optimization for Shopify developers.
              </Typography>
            </Box>

            {/* Feature Showcase Card */}
            <Box sx={{ position: "relative", zIndex: 1, my: 4 }}>
              <Box
                sx={{
                  p: 3,
                  borderRadius: "16px",
                  bgcolor: "rgba(255, 255, 255, 0.05)",
                  backdropFilter: "blur(12px)",
                  border: "1px solid rgba(255, 255, 255, 0.1)",
                  display: "flex",
                  flexDirection: "column",
                  gap: 2,
                }}
              >
                <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <TrendingUpIcon sx={{ color: "#10b981", fontSize: 20 }} />
                    <Typography sx={{ fontSize: 13, fontWeight: 700, color: "#34d399" }}>
                      RANK BOOST +48%
                    </Typography>
                  </Box>
                  <Typography sx={{ fontSize: 11, color: "#94a3b8" }}>Updated Live</Typography>
                </Box>

                {[
                  "Daily automated Shopify App Store rank scans",
                  "Side-by-side competitor head-to-head matrix",
                  "Actionable ASO listing audit scores",
                ].map((feat) => (
                  <Box key={feat} sx={{ display: "flex", alignItems: "center", gap: 1.25 }}>
                    <CheckCircleIcon sx={{ fontSize: 16, color: "#818cf8" }} />
                    <Typography sx={{ fontSize: 13, color: "#cbd5e1", fontWeight: 500 }}>
                      {feat}
                    </Typography>
                  </Box>
                ))}
              </Box>
            </Box>

            {/* Footer Copy */}
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
              <Box sx={{ mb: 4 }}>
                <Typography variant="h5" sx={{ fontWeight: 800, color: "#0f172a", fontSize: 24, mb: 1 }}>
                  {isLogin ? "Welcome back" : "Get started free"}
                </Typography>
                <Typography sx={{ color: "#64748b", fontSize: 13.5 }}>
                  {isLogin
                    ? "Enter your credentials to access your store ranking dashboard."
                    : "Create an account to start tracking app store positions today."}
                </Typography>
              </Box>

              {success && (
                <Alert
                  severity="success"
                  variant="outlined"
                  sx={{
                    mb: 3,
                    borderRadius: "10px",
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
                    borderRadius: "10px",
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
                    placeholder="name@company.com"
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
                          borderRadius: "10px",
                          bgcolor: "#f8fafc",
                          "& fieldset": { borderColor: "#e2e8f0" },
                        },
                      },
                      inputLabel: { shrink: true, sx: { fontSize: 13.5, fontWeight: 600, color: "#475569" } },
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
                          borderRadius: "10px",
                          bgcolor: "#f8fafc",
                          "& fieldset": { borderColor: "#e2e8f0" },
                        },
                      },
                      inputLabel: { shrink: true, sx: { fontSize: 13.5, fontWeight: 600, color: "#475569" } },
                    }}
                  />

                  {/* Live Password Requirements (Registration Mode) */}
                  {!isLogin && password.length > 0 && (
                    <Box
                      sx={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 1,
                        p: 1.5,
                        borderRadius: "10px",
                        bgcolor: "#f8fafc",
                        border: "1px solid #e2e8f0",
                        mt: -0.5,
                      }}
                    >
                      <Typography sx={{ fontSize: 11.5, fontWeight: 600, color: "#64748b" }}>
                        Password Requirements:
                      </Typography>
                      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75 }}>
                        <Chip
                          size="small"
                          label="8+ chars"
                          color={hasMinLength ? "success" : "default"}
                          variant={hasMinLength ? "filled" : "outlined"}
                          sx={{ fontSize: 11, height: 22, fontWeight: 600 }}
                        />
                        <Chip
                          size="small"
                          label="1 Uppercase"
                          color={hasUppercase ? "success" : "default"}
                          variant={hasUppercase ? "filled" : "outlined"}
                          sx={{ fontSize: 11, height: 22, fontWeight: 600 }}
                        />
                        <Chip
                          size="small"
                          label="1 Lowercase"
                          color={hasLowercase ? "success" : "default"}
                          variant={hasLowercase ? "filled" : "outlined"}
                          sx={{ fontSize: 11, height: 22, fontWeight: 600 }}
                        />
                        <Chip
                          size="small"
                          label="Number/Symbol"
                          color={hasNumberOrSpecial ? "success" : "default"}
                          variant={hasNumberOrSpecial ? "filled" : "outlined"}
                          sx={{ fontSize: 11, height: 22, fontWeight: 600 }}
                        />
                      </Box>
                    </Box>
                  )}

                  {/* Confirm Password Field (Registration Mode) */}
                  {!isLogin && (
                    <Box sx={{ display: "flex", flexDirection: "column", gap: 0.75 }}>
                      <TextField
                        fullWidth
                        label="Confirm Password"
                        type={showConfirmPassword ? "text" : "password"}
                        placeholder="••••••••"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        disabled={isLoading}
                        error={confirmPassword.length > 0 && !passwordsMatch}
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
                              borderRadius: "10px",
                              bgcolor: "#f8fafc",
                              "& fieldset": { borderColor: "#e2e8f0" },
                            },
                          },
                          inputLabel: { shrink: true, sx: { fontSize: 13.5, fontWeight: 600, color: "#475569" } },
                        }}
                      />
                      {confirmPassword.length > 0 && (
                        <Typography
                          sx={{
                            fontSize: 12,
                            fontWeight: 600,
                            color: passwordsMatch ? "#16a34a" : "#dc2626",
                            display: "flex",
                            alignItems: "center",
                            gap: 0.5,
                            pl: 0.5,
                          }}
                        >
                          {passwordsMatch ? "✓ Passwords match" : "✕ Passwords do not match"}
                        </Typography>
                      )}
                    </Box>
                  )}

                  {isLogin && (
                    <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mt: -0.5 }}>
                      <FormControlLabel
                        control={
                          <Checkbox
                            size="small"
                            checked={rememberMe}
                            onChange={(e) => setRememberMe(e.target.checked)}
                            sx={{ color: "#94a3b8", "&.Mui-checked": { color: "#6366f1" } }}
                          />
                        }
                        label={<Typography sx={{ fontSize: 12.5, color: "#475569", fontWeight: 500 }}>Remember me</Typography>}
                      />
                      <Link
                        component="button"
                        type="button"
                        onClick={() => alert("Please contact support to reset your password.")}
                        sx={{ fontSize: 12.5, fontWeight: 600, color: "#6366f1", textDecoration: "none", "&:hover": { textDecoration: "underline" } }}
                      >
                        Forgot password?
                      </Link>
                    </Box>
                  )}

                  <Button
                    fullWidth
                    type="submit"
                    variant="contained"
                    disabled={isLoading}
                    sx={{
                      bgcolor: "#0f172a",
                      color: "#fff",
                      py: 1.25,
                      borderRadius: "10px",
                      fontWeight: 700,
                      textTransform: "none",
                      fontSize: 14,
                      boxShadow: "0 4px 14px rgba(15, 23, 42, 0.25)",
                      "&:hover": {
                        bgcolor: "#1e293b",
                        boxShadow: "0 6px 20px rgba(15, 23, 42, 0.35)",
                      },
                    }}
                  >
                    {isLoading ? (
                      <CircularProgress size={22} color="inherit" />
                    ) : isLogin ? (
                      "Sign In to Dashboard"
                    ) : (
                      "Create Account"
                    )}
                  </Button>

                  {/* Divider */}
                  <Box sx={{ display: "flex", alignItems: "center", my: 0.5, gap: 1.5 }}>
                    <Box sx={{ flex: 1, height: "1px", bgcolor: "#e2e8f0" }} />
                    <Typography sx={{ fontSize: 12, color: "#94a3b8", fontWeight: 500 }}>
                      OR
                    </Typography>
                    <Box sx={{ flex: 1, height: "1px", bgcolor: "#e2e8f0" }} />
                  </Box>

                  {/* Google Sign-In Button */}
                  <Button
                    fullWidth
                    type="button"
                    variant="outlined"
                    onClick={() => {
                      onLoginSuccess();
                    }}
                    startIcon={
                      <svg width="18" height="18" viewBox="0 0 24 24">
                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                      </svg>
                    }
                    sx={{
                      bgcolor: "#ffffff",
                      color: "#1e293b",
                      borderColor: "#cbd5e1",
                      py: 1.1,
                      borderRadius: "10px",
                      fontWeight: 600,
                      textTransform: "none",
                      fontSize: 13.5,
                      boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
                      "&:hover": {
                        bgcolor: "#f8fafc",
                        borderColor: "#94a3b8",
                      },
                    }}
                  >
                    Sign in with Google
                  </Button>

                  <Box sx={{ textAlign: "center", mt: 1.5 }}>
                    <Typography sx={{ color: "#64748b", fontSize: 13 }}>
                      {isLogin ? "Don't have an account? " : "Already have an account? "}
                      <Link
                        component="button"
                        type="button"
                        onClick={() => {
                          setIsLogin(!isLogin);
                          setError(null);
                          setSuccess(null);
                        }}
                        sx={{
                          color: "#6366f1",
                          fontWeight: 700,
                          fontSize: 13,
                          textDecoration: "none",
                          "&:hover": { textDecoration: "underline" },
                        }}
                      >
                        {isLogin ? "Sign Up" : "Sign In"}
                      </Link>
                    </Typography>
                  </Box>
                </Box>
              </form>
            </Box>
          </Box>
        </Card>
      </Container>
    </Box>
  );
}
