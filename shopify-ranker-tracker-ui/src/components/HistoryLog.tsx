// React
import { useState } from "react";

// Material UI
import { Box, Chip, IconButton, InputAdornment, Paper, Table, TableBody, TableCell, TableHead, TablePagination, TableRow, TextField, Typography } from "@mui/material";
import { Image as ImageIcon, Search as SearchIcon } from "@mui/icons-material";

interface TableRowData {
  id: number;
  keyword: string;
  rank: number | null;
  page: number | null;
  found: boolean;
  screenshot_path: string | null;
  tracked_date: string;
}

interface HistoryLogProps {
  tableRows: TableRowData[];
  onViewScreenshot: (path: string) => void;
}

export default function HistoryLog({ tableRows, onViewScreenshot }: HistoryLogProps) {
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(8);
  const [search, setSearch] = useState("");

  const filtered = tableRows.filter((r) =>
    r.keyword.toLowerCase().includes(search.toLowerCase())
  );
  const paginated = filtered.slice(page * rowsPerPage, (page + 1) * rowsPerPage);

  return (
    <Paper
      elevation={0}
      sx={{
        borderRadius: "12px",
        border: "1px solid #e5e7eb",
        overflow: "hidden",
        mb: 3,
      }}
    >
      <Box
        sx={{
          px: 3,
          py: 2,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderBottom: "1px solid #f3f4f6",
        }}
      >
        <Typography sx={{ fontWeight: 600, fontSize: 15, color: "#111827" }}>
          Ranking History
        </Typography>
        <TextField
          size="small"
          placeholder="Filter keywords…"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(0); }}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon sx={{ fontSize: 15, color: "#9ca3af" }} />
                </InputAdornment>
              ),
              sx: {
                fontSize: 13,
                borderRadius: "8px",
                bgcolor: "#f9fafb",
                "& fieldset": { borderColor: "#e5e7eb" },
                "&:hover fieldset": { borderColor: "#d1d5db" },
              },
            },
          }}
          sx={{ width: 200, "& .MuiOutlinedInput-root": { borderRadius: "8px" } }}
        />
      </Box>

      <Box sx={{ overflowX: "auto" }}>
        <Table size="small" sx={{ minWidth: 550 }}>
          <TableHead>
            <TableRow sx={{ "& th": { bgcolor: "#f9fafb", borderColor: "#f3f4f6" } }}>
              <TableCell sx={{ fontSize: 12, fontWeight: 600, color: "#6b7280", py: 1.25 }}>Keyword</TableCell>
              <TableCell sx={{ fontSize: 12, fontWeight: 600, color: "#6b7280", py: 1.25 }}>Rank</TableCell>
              <TableCell sx={{ fontSize: 12, fontWeight: 600, color: "#6b7280", py: 1.25 }}>Page</TableCell>
              <TableCell sx={{ fontSize: 12, fontWeight: 600, color: "#6b7280", py: 1.25 }}>Status</TableCell>
              <TableCell sx={{ fontSize: 12, fontWeight: 600, color: "#6b7280", py: 1.25 }}>Date</TableCell>
              <TableCell sx={{ fontSize: 12, fontWeight: 600, color: "#6b7280", py: 1.25, width: 48 }}></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {paginated.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} align="center" sx={{ py: 4, color: "#9ca3af", fontSize: 13 }}>
                  {tableRows.length === 0 ? "No history recorded yet." : "No results match your filter."}
                </TableCell>
              </TableRow>
            ) : (
              paginated.map((row) => (
                <TableRow
                  key={row.id}
                  hover
                  sx={{
                    "&:last-child td": { border: 0 },
                    "& td": { borderColor: "#f3f4f6", py: 1.25 },
                  }}
                >
                  <TableCell sx={{ fontSize: 13, color: "#111827", fontWeight: 500 }}>
                    {row.keyword}
                  </TableCell>
                  <TableCell sx={{ fontSize: 13, color: row.rank ? "#111827" : "#9ca3af" }}>
                    {row.rank ?? "—"}
                  </TableCell>
                  <TableCell sx={{ fontSize: 13, color: row.page ? "#111827" : "#9ca3af" }}>
                    {row.page ?? "—"}
                  </TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      label={row.found ? "Found" : "Not Found"}
                      sx={{
                        height: 22,
                        fontSize: 11.5,
                        fontWeight: 600,
                        borderRadius: "6px",
                        bgcolor: row.found ? "#d1fae5" : "#fee2e2",
                        color: row.found ? "#065f46" : "#991b1b",
                        border: `1px solid ${row.found ? "#6ee7b7" : "#fca5a5"}`,
                      }}
                    />
                  </TableCell>
                  <TableCell sx={{ fontSize: 12, color: "#6b7280" }}>
                    {new Date(row.tracked_date).toLocaleDateString("en-US", {
                      month: "short", day: "numeric", year: "numeric",
                    })}
                  </TableCell>
                  <TableCell>
                    {row.screenshot_path && (
                      <IconButton
                        size="small"
                        onClick={() => onViewScreenshot(row.screenshot_path!)}
                        sx={{ color: "#6366f1", "&:hover": { bgcolor: "#ede9fe" } }}
                        title="View screenshot"
                      >
                        <ImageIcon sx={{ fontSize: 16 }} />
                      </IconButton>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Box>

      <TablePagination
        component="div"
        count={filtered.length}
        page={page}
        rowsPerPage={rowsPerPage}
        onPageChange={(_, p) => setPage(p)}
        onRowsPerPageChange={(e) => { setRowsPerPage(+e.target.value); setPage(0); }}
        rowsPerPageOptions={[8, 20, 50]}
        sx={{
          borderTop: "1px solid #f3f4f6",
          "& .MuiTablePagination-toolbar": { fontSize: 13 },
          "& .MuiTablePagination-selectLabel, & .MuiTablePagination-displayedRows": { fontSize: 12, color: "#6b7280" },
        }}
      />
    </Paper>
  );
}
