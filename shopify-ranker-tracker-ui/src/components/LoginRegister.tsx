import { useState } from "react";
import {
  Box,
  Button,
  Card,
  CardContent,
  Container,
  TextField,
  Typography,
  Link,
  CircularProgress,
  Alert,
} from "@mui/material";
import { api } from "../api";

interface LoginRegisterProps {
  onLoginSuccess: () => void;
}

export default function LoginRegister({ onLoginSuccess }: LoginRegisterProps) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      setError("Please fill in all fields.");
      return;
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
        alignItems: "center",
        justifyContent: "center",
        bgcolor: "#f9fafb", // Matches index.css body background
        py: 4,
      }}
    >
      <Container maxWidth="xs">
        <Card
          elevation={0}
          sx={{
            borderRadius: "12px",
            border: "1px solid #e5e7eb", // Matches other cards / Paper panels in application
            bgcolor: "#ffffff",
            boxShadow: "0 10px 30px rgba(0, 0, 0, 0.04)",
          }}
        >
          <CardContent sx={{ p: 4 }}>
            {/* Header / Logo branding matching the sidebar theme */}
            <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", mb: 3.5 }}>
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 48,
                  height: 48,
                  borderRadius: "10px",
                  background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)", // Matches Sidebar logo
                  color: "#fff",
                  fontWeight: 800,
                  fontSize: 20,
                  mb: 2,
                  boxShadow: "0 4px 12px rgba(99, 102, 241, 0.2)",
                }}
              >
                R
              </Box>
              <Typography
                variant="h5"
                sx={{
                  fontWeight: 700,
                  color: "#111827",
                  fontSize: 20,
                  letterSpacing: "-0.5px",
                }}
              >
                Rank Tracker
              </Typography>
              <Typography variant="body2" sx={{ color: "#6b7280", mt: 0.5, textAlign: "center" }}>
                {isLogin ? "Sign in to track your store keywords" : "Create a new tracker account"}
              </Typography>
            </Box>

            {success && (
              <Alert
                severity="success"
                variant="outlined"
                sx={{
                  mb: 2.5,
                  borderRadius: "8px",
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
                  mb: 2.5,
                  borderRadius: "8px",
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
                  size="small"
                  label="Email Address"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isLoading}
                  slotProps={{
                    input: {
                      sx: {
                        fontSize: 13,
                        borderRadius: "8px",
                      },
                    },
                  }}
                />

                <TextField
                  fullWidth
                  size="small"
                  label="Password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isLoading}
                  slotProps={{
                    input: {
                      sx: {
                        fontSize: 13,
                        borderRadius: "8px",
                      },
                    },
                  }}
                />

                <Button
                  fullWidth
                  type="submit"
                  variant="contained"
                  disabled={isLoading}
                  sx={{
                    bgcolor: "#111827", // Primary main
                    color: "#fff",
                    py: 1,
                    borderRadius: "8px",
                    fontWeight: 600,
                    textTransform: "none",
                    fontSize: 13,
                    boxShadow: "none",
                    "&:hover": {
                      bgcolor: "#1f2937",
                    },
                  }}
                >
                  {isLoading ? (
                    <CircularProgress size={20} color="inherit" />
                  ) : isLogin ? (
                    "Sign In"
                  ) : (
                    "Create Account"
                  )}
                </Button>

                <Box sx={{ textAlign: "center", mt: 1 }}>
                  <Typography variant="body2" sx={{ color: "#6b7280", fontSize: 12.5 }}>
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
                        color: "#f97316", // Secondary main (orange)
                        fontWeight: 600,
                        fontSize: 12.5,
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
          </CardContent>
        </Card>
      </Container>
    </Box>
  );
}
