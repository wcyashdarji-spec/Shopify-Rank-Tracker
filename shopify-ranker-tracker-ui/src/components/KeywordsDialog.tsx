// React
import { useEffect, useState } from "react";

// Material UI
import {
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  TextField,
  Typography,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";

// Types
import type { Keyword } from "../api";

// Matching chip color palette from reference
const CHIP_COLORS = [
  { bg: "#fef3c7", color: "#92400e", border: "#f59e0b" },
  { bg: "#ccfbf1", color: "#0f766e", border: "#14b8a6" },
  { bg: "#fefce8", color: "#713f12", border: "#ca8a04" },
  { bg: "#dbeafe", color: "#1e40af", border: "#3b82f6" },
  { bg: "#ede9fe", color: "#5b21b6", border: "#7c3aed" },
  { bg: "#fce7f3", color: "#9d174d", border: "#ec4899" },
  { bg: "#d1fae5", color: "#065f46", border: "#10b981" },
  { bg: "#fee2e2", color: "#991b1b", border: "#ef4444" },
];

export function getChipColor(index: number) {
  return CHIP_COLORS[index % CHIP_COLORS.length];
}

interface DraftKeyword {
  id: number;
  name: string;
  isNew?: boolean;
}

interface KeywordsDialogProps {
  open: boolean;
  onClose: () => void;
  keywords: Keyword[];
  onAddKeywords: (keywords: string[]) => Promise<void>;
  onRemoveKeyword: (id: number, name: string) => Promise<void>;
  isLoading: boolean;
}

export default function KeywordsDialog({
  open,
  onClose,
  keywords,
  onAddKeywords,
  onRemoveKeyword,
  isLoading,
}: KeywordsDialogProps) {
  const [draftKeywords, setDraftKeywords] = useState<DraftKeyword[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  // Sync draft keywords whenever modal opens or original keywords change
  useEffect(() => {
    if (open) {
      setDraftKeywords(keywords.map((k) => ({ id: k.id, name: k.name })));
      setInputValue("");
    }
  }, [open, keywords]);

  const handleAddDraft = () => {
    const terms = inputValue
      .split(/[\n,]+/)
      .map((k) => k.trim())
      .filter(Boolean);
    if (terms.length === 0) return;

    setDraftKeywords((prev) => {
      const next = [...prev];
      terms.forEach((term) => {
        if (!next.some((k) => k.name.toLowerCase() === term.toLowerCase())) {
          next.push({
            id: -Date.now() - Math.floor(Math.random() * 1000),
            name: term,
            isNew: true,
          });
        }
      });
      return next;
    });

    setInputValue("");
  };

  const handleRemoveDraft = (name: string) => {
    setDraftKeywords((prev) => prev.filter((k) => k.name.toLowerCase() !== name.toLowerCase()));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddDraft();
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // 1. Keywords to delete: in initial `keywords` prop but absent in `draftKeywords`
      const remainingNames = new Set(draftKeywords.map((k) => k.name.toLowerCase()));
      const removedKeywords = keywords.filter((k) => !remainingNames.has(k.name.toLowerCase()));

      // 2. Keywords to add: marked as `isNew` or absent in initial `keywords` prop
      const initialNames = new Set(keywords.map((k) => k.name.toLowerCase()));
      const addedTerms = draftKeywords
        .filter((k) => k.isNew || !initialNames.has(k.name.toLowerCase()))
        .map((k) => k.name);

      // Perform deletions
      for (const kw of removedKeywords) {
        await onRemoveKeyword(kw.id, kw.name);
      }

      // Perform additions
      if (addedTerms.length > 0) {
        await onAddKeywords(addedTerms);
      }

      onClose();
    } catch (err) {
      console.error("Failed to save keyword changes", err);
    } finally {
      setIsSaving(false);
    }
  };

  const busy = isLoading || isSaving;

  return (
    <Dialog
      open={open}
      onClose={() => {
        if (!busy) onClose();
      }}
      maxWidth="xs"
      fullWidth
      slotProps={{
        paper: {
          sx: {
            borderRadius: "12px",
            boxShadow: "0 20px 60px rgba(0,0,0,0.15)",
            border: "1px solid #e5e7eb",
          },
        },
      }}
    >
      <DialogTitle
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          pb: 1,
          pt: 2,
          px: 2.5,
        }}
      >
        <Typography sx={{ fontWeight: 600, fontSize: 15, color: "#111827" }}>
          Manage Keywords
        </Typography>
        <IconButton size="small" onClick={onClose} disabled={busy} sx={{ color: "#9ca3af" }}>
          <CloseIcon sx={{ fontSize: 18 }} />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ px: 2.5, pt: 1, pb: 1 }}>
        {/* Input + Add button row */}
        <Box sx={{ display: "flex", gap: 1, mb: 2 }}>
          <TextField
            size="small"
            fullWidth
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={busy}
            placeholder="Enter search term to track changes in your app's search position"
            slotProps={{
              input: {
                sx: {
                  fontSize: 13,
                  borderRadius: "8px",
                  bgcolor: "#fff",
                  "& fieldset": { borderColor: "#e5e7eb" },
                  "&:hover fieldset": { borderColor: "#d1d5db" },
                  "&.Mui-focused fieldset": { borderColor: "#6366f1" },
                },
              },
            }}
            sx={{ "& .MuiOutlinedInput-root": { borderRadius: "8px" } }}
          />
          <Button
            variant="contained"
            size="small"
            onClick={handleAddDraft}
            disabled={!inputValue.trim() || busy}
            sx={{
              bgcolor: "#111827",
              color: "#fff",
              borderRadius: "8px",
              textTransform: "none",
              fontWeight: 600,
              fontSize: 13,
              px: 2,
              flexShrink: 0,
              "&:hover": { bgcolor: "#1f2937" },
            }}
          >
            Add
          </Button>
        </Box>

        {/* Keyword chips */}
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75, minHeight: 32 }}>
          {draftKeywords.length === 0 ? (
            <Typography sx={{ fontSize: 12.5, color: "#9ca3af", py: 0.5 }}>
              No keywords tracked yet. Add some above.
            </Typography>
          ) : (
            draftKeywords.map((kw, i) => {
              const chipColor = getChipColor(i);
              return (
                <Box
                  key={kw.name}
                  sx={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 0.5,
                    px: 1,
                    py: 0.4,
                    borderRadius: "6px",
                    bgcolor: chipColor.bg,
                    border: `1px solid ${chipColor.border}`,
                    color: chipColor.color,
                    fontSize: 12.5,
                    fontWeight: 500,
                    cursor: "default",
                    transition: "opacity 0.2s",
                  }}
                >
                  {kw.name}
                  <Box
                    component="span"
                    onClick={() => {
                      if (!busy) handleRemoveDraft(kw.name);
                    }}
                    sx={{
                      display: "inline-flex",
                      alignItems: "center",
                      ml: 0.25,
                      cursor: busy ? "default" : "pointer",
                      opacity: 0.7,
                      fontSize: 13,
                      lineHeight: 1,
                      "&:hover": { opacity: busy ? 0.7 : 1 },
                    }}
                    title={`Remove "${kw.name}"`}
                  >
                    ×
                  </Box>
                </Box>
              );
            })
          )}
        </Box>

        <Typography sx={{ fontSize: 11.5, color: "#9ca3af", mt: 1.5 }}>
          You can track up to 10 search terms at a time. Terms that are not currently tracked will be crawled on the next update.
        </Typography>
      </DialogContent>

      <DialogActions sx={{ px: 2.5, pb: 2, pt: 1.5, gap: 1 }}>
        <Button
          onClick={onClose}
          disabled={busy}
          size="small"
          variant="outlined"
          sx={{
            textTransform: "none",
            borderColor: "#e5e7eb",
            color: "#374151",
            borderRadius: "8px",
            fontSize: 13,
            "&:hover": { borderColor: "#9ca3af", bgcolor: "#f9fafb" },
          }}
        >
          Close
        </Button>
        <Button
          variant="contained"
          size="small"
          onClick={handleSave}
          disabled={busy}
          startIcon={busy ? <CircularProgress size={14} color="inherit" /> : null}
          sx={{
            bgcolor: "#111827",
            color: "#fff",
            borderRadius: "8px",
            textTransform: "none",
            fontWeight: 600,
            fontSize: 13,
            px: 2.5,
            "&:hover": { bgcolor: "#1f2937" },
            "&.Mui-disabled": { bgcolor: "#94a3b8", color: "#ffffff" },
          }}
        >
          {busy ? "Saving…" : "Save"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
