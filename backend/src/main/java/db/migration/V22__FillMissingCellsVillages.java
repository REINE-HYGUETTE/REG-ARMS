package db.migration;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.flywaydb.core.api.migration.BaseJavaMigration;
import org.flywaydb.core.api.migration.Context;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.sql.*;
import java.time.Duration;
import java.util.*;
import java.util.logging.Logger;

/**
 * V22 — Fill cells and villages for sectors that V18 missed due to name
 * mismatches between the GitHub JSON and our DB sector names.
 *
 * Strategy (in order of priority):
 *  1. Exact match (same as V18)
 *  2. Normalised match: lowercase, collapse spaces, strip punctuation
 *  3. Roman-numeral → digit normalisation  (e.g. "Nyankenke I" ↔ "Nyankenke 1")
 *  4. Strip trailing ordinal words          (e.g. "Nyankenke I" → "Nyankenke")
 *
 * Only operates on sectors that currently have 0 cells.
 * Safe to re-run: ON CONFLICT DO NOTHING on every INSERT.
 */
public class V22__FillMissingCellsVillages extends BaseJavaMigration {

    private static final Logger log = Logger.getLogger(V22__FillMissingCellsVillages.class.getName());
    private static final String DATA_URL =
            "https://raw.githubusercontent.com/jnkindi/rwanda-locations-json/master/locations.json";

    @Override
    public void migrate(Context context) throws Exception {
        Connection conn = context.getConnection();

        // ── Find sectors with 0 cells ────────────────────────────────────────
        Map<Long, String> emptySectors = new LinkedHashMap<>();   // id → name
        try (Statement st = conn.createStatement();
             ResultSet rs = st.executeQuery(
                     "SELECT s.id, s.name " +
                     "FROM location_sectors s " +
                     "WHERE (SELECT COUNT(*) FROM location_cells c WHERE c.sector_id = s.id) = 0 " +
                     "ORDER BY s.id")) {
            while (rs.next()) {
                emptySectors.put(rs.getLong("id"), rs.getString("name").trim());
            }
        }

        if (emptySectors.isEmpty()) {
            log.info("V22: All sectors already have cells. Nothing to do.");
            return;
        }
        log.info("V22: Found " + emptySectors.size() + " sectors with no cells. Filling gaps...");

        // ── Download JSON ────────────────────────────────────────────────────
        log.info("V22: Downloading Rwanda location data from GitHub...");
        HttpClient http = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(30))
                .build();
        HttpRequest req = HttpRequest.newBuilder()
                .uri(URI.create(DATA_URL))
                .timeout(Duration.ofSeconds(120))
                .build();
        String body = http.send(req, HttpResponse.BodyHandlers.ofString()).body();
        log.info("V22: Download complete (" + body.length() / 1024 + " KB). Parsing...");

        // ── Parse: sector (raw) → cell → villages ────────────────────────────
        Map<String, Map<String, Set<String>>> tree = new LinkedHashMap<>();
        ObjectMapper mapper = new ObjectMapper();
        JsonNode records = mapper.readTree(body);
        for (JsonNode rec : records) {
            String sector  = clean(rec.path("sector_name").asText(""));
            String cell    = clean(rec.path("cell_name").asText(""));
            String village = clean(rec.path("village_name").asText(""));
            if (sector.isEmpty() || cell.isEmpty() || village.isEmpty()) continue;
            tree.computeIfAbsent(sector, k -> new LinkedHashMap<>())
                .computeIfAbsent(cell, k -> new LinkedHashSet<>())
                .add(village);
        }

        // Build lookup maps for the JSON keys
        Map<String, String>   jsonNorm = new LinkedHashMap<>();  // normalised → original key
        for (String key : tree.keySet()) {
            jsonNorm.put(normalise(key), key);
        }

        // ── Match each empty sector to a JSON entry ──────────────────────────
        Map<Long, String> sectorToJsonKey = new LinkedHashMap<>();
        for (Map.Entry<Long, String> entry : emptySectors.entrySet()) {
            long   id   = entry.getKey();
            String name = entry.getValue();

            // 1. Exact
            if (tree.containsKey(name)) {
                sectorToJsonKey.put(id, name);
                continue;
            }
            // 2. Normalised
            String norm = normalise(name);
            if (jsonNorm.containsKey(norm)) {
                sectorToJsonKey.put(id, jsonNorm.get(norm));
                continue;
            }
            // 3. Roman numeral ↔ digit (e.g. "Nyankenke I" ↔ "Nyankenke 1")
            String digitVersion = romanToDigit(norm);
            if (jsonNorm.containsKey(digitVersion)) {
                sectorToJsonKey.put(id, jsonNorm.get(digitVersion));
                continue;
            }
            // 4. Strip trailing roman / digit suffix
            String stripped = stripSuffix(norm);
            if (!stripped.equals(norm) && jsonNorm.containsKey(stripped)) {
                sectorToJsonKey.put(id, jsonNorm.get(stripped));
                continue;
            }
            log.warning("V22: No JSON match for sector id=" + id + " name='" + name + "'. Skipping.");
        }

        log.info("V22: Matched " + sectorToJsonKey.size() + " of " + emptySectors.size() + " empty sectors.");

        // ── Insert cells and villages ─────────────────────────────────────────
        String sqlInsertCell    = "INSERT INTO location_cells (name, sector_id) VALUES (?, ?) " +
                                  "ON CONFLICT (name, sector_id) DO NOTHING";
        String sqlSelectCell    = "SELECT id FROM location_cells WHERE name = ? AND sector_id = ?";
        String sqlInsertVillage = "INSERT INTO location_villages (name, cell_id) VALUES (?, ?) " +
                                  "ON CONFLICT (name, cell_id) DO NOTHING";

        int cellCount = 0, villageCount = 0;

        try (PreparedStatement psInsertCell    = conn.prepareStatement(sqlInsertCell);
             PreparedStatement psSelectCell    = conn.prepareStatement(sqlSelectCell);
             PreparedStatement psInsertVillage = conn.prepareStatement(sqlInsertVillage)) {

            for (Map.Entry<Long, String> entry : sectorToJsonKey.entrySet()) {
                long   sectorId  = entry.getKey();
                String jsonKey   = entry.getValue();
                Map<String, Set<String>> cellMap = tree.get(jsonKey);
                if (cellMap == null) continue;

                for (Map.Entry<String, Set<String>> cellEntry : cellMap.entrySet()) {
                    String cellName = cellEntry.getKey();

                    psInsertCell.setString(1, cellName);
                    psInsertCell.setLong(2, sectorId);
                    psInsertCell.executeUpdate();
                    cellCount++;

                    psSelectCell.setString(1, cellName);
                    psSelectCell.setLong(2, sectorId);
                    long cellId;
                    try (ResultSet rs = psSelectCell.executeQuery()) {
                        if (!rs.next()) continue;
                        cellId = rs.getLong("id");
                    }

                    for (String villageName : cellEntry.getValue()) {
                        psInsertVillage.setString(1, villageName);
                        psInsertVillage.setLong(2, cellId);
                        psInsertVillage.executeUpdate();
                        villageCount++;
                    }
                }
            }
        }

        log.info(String.format("V22: Done! Inserted %,d cells and %,d villages across %d sectors.",
                cellCount, villageCount, sectorToJsonKey.size()));
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    /** Title-case a raw string. */
    private String clean(String raw) {
        if (raw == null) return "";
        String[] words = raw.trim().split("\\s+");
        StringBuilder sb = new StringBuilder();
        for (String w : words) {
            if (w.isEmpty()) continue;
            if (sb.length() > 0) sb.append(" ");
            sb.append(Character.toUpperCase(w.charAt(0)));
            if (w.length() > 1) sb.append(w.substring(1).toLowerCase());
        }
        return sb.toString();
    }

    /** Lowercase + collapse whitespace + strip non-alphanumeric (keep spaces). */
    private String normalise(String s) {
        return s.toLowerCase(Locale.ROOT)
                .replaceAll("[^a-z0-9 ]", "")
                .replaceAll("\\s+", " ")
                .trim();
    }

    /** Replace trailing roman numeral (i/ii/iii/iv/v) with digit. */
    private String romanToDigit(String s) {
        return s.replaceAll("\\biii\\b", "3")
                .replaceAll("\\bii\\b",  "2")
                .replaceAll("\\biv\\b",  "4")
                .replaceAll("\\bvi\\b",  "6")
                .replaceAll("\\bv\\b",   "5")
                .replaceAll("\\bi\\b",   "1")
                .trim();
    }

    /** Strip a trailing roman numeral or digit word from a normalised string. */
    private String stripSuffix(String s) {
        return s.replaceAll("\\s+(i{1,3}|iv|vi{0,3}|[0-9]+)$", "").trim();
    }
}
