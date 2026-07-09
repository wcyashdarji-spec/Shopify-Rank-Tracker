// React
import { Fragment, useState } from "react";

// Material UI
import { Box, Button, Divider, IconButton, List, ListItem, ListItemText, Paper, TextField, Typography } from "@mui/material";
import { AddCircleOutlined as AddIcon, Delete as DeleteIcon, Label as LabelIcon } from "@mui/icons-material";

// Types
import type { App } from "../api";

interface KeywordsManagerProps {
  selectedApp: App;
  onAddKeywords: (keywords: string[]) => void;
  onRemoveKeyword: (keywordId: number, keywordName: string) => void;
  isAddingKeywords: boolean;
}

export default function KeywordsManager({
  selectedApp,
  onAddKeywords,
  onRemoveKeyword,
  isAddingKeywords,
}: KeywordsManagerProps) {
  const [newKeywordsInput, setNewKeywordsInput] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKeywordsInput.trim()) return;

    const keywordsList = newKeywordsInput
      .replace(/,/g, "\n")
      .split("\n")
      .map((k) => k.trim())
      .filter((k) => k.length > 0);

    if (keywordsList.length === 0) return;

    onAddKeywords(keywordsList);
    setNewKeywordsInput("");
  };

  return (
    <Paper
      sx={{
        bgcolor: "rgba(22, 26, 41, 0.65)",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 4,
        p: 3,
        backdropFilter: "blur(12px)",
        height: "100%",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <Typography variant="h6" sx={{ fontSize: 18, color: "#fff", fontWeight: 600, display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
        <LabelIcon sx={{ color: "#8b5cf6" }} /> Manage Keywords
      </Typography>

      <Box component="form" onSubmit={handleSubmit} sx={{ mb: 3 }}>
        <TextField
          fullWidth
          multiline
          rows={3}
          label="Add New Keywords (one per line)"
          placeholder="order tags&#10;auto tagger&#10;tag flow"
          value={newKeywordsInput}
          onChange={(e) => setNewKeywordsInput(e.target.value)}
          slotProps={{
            inputLabel: { style: { color: "text.secondary" } }
          }}
          sx={{
            mb: 1.5,
            "& .MuiInputBase-root": { color: "#fff" },
            "& .MuiOutlinedInput-notchedOutline": { borderColor: "rgba(255, 255, 255, 0.08)" }
          }}
        />
        <Button
          type="submit"
          variant="contained"
          color="secondary"
          disabled={isAddingKeywords}
          startIcon={<AddIcon />}
          sx={{ fontWeight: 600 }}
        >
          {isAddingKeywords ? "Adding..." : "Add Keywords"}
        </Button>
      </Box>

      <Typography variant="caption" sx={{ color: "text.secondary", textTransform: "uppercase", fontWeight: 600, letterSpacing: 0.5, mb: 1, display: "block" }}>
        Active Scraper Keywords ({selectedApp.keywords?.length || 0})
      </Typography>

      <Box sx={{ flexGrow: 1, overflowY: "auto", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 2, bgcolor: "rgba(0,0,0,0.15)", maxH: 260 }}>
        {selectedApp.keywords?.length === 0 ? (
          <Typography variant="body2" sx={{ color: "text.secondary", p: 2, textAlign: "center" }}>
            No keywords tracked. Add some above!
          </Typography>
        ) : (
          <List disablePadding>
            {selectedApp.keywords.map((kw, index) => (
              <Fragment key={kw.id}>
                {index > 0 && <Divider sx={{ borderColor: "rgba(255,255,255,0.05)" }} />}
                <ListItem
                  secondaryAction={
                    <IconButton
                      edge="end"
                      aria-label="delete"
                      onClick={() => onRemoveKeyword(kw.id, kw.name)}
                      sx={{ color: "text.secondary", "&:hover": { color: "error.main" } }}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  }
                  sx={{ py: 1, px: 2 }}
                >
                  <ListItemText
                    primary={<Typography sx={{ color: "#f3f4f6", fontSize: 14, fontWeight: 500 }}>{kw.name}</Typography>}
                  />
                </ListItem>
              </Fragment>
            ))}
          </List>
        )}
      </Box>
    </Paper>
  );
}
