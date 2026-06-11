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
 * V18 — Replace placeholder cells/villages with real Rwanda administrative data.
 *
 * Source: github.com/jnkindi/rwanda-locations-json (222,630+ records)
 *
 * This migration runs automatically on backend startup via Flyway.
 * It only does work if placeholder data (Akabeza / Amahoro / Inzira / Urugwiro)
 * is still present — otherwise it exits immediately.
 * Flyway records it in flyway_schema_history so it never runs twice.
 */
public class V18__RealLocationData extends BaseJavaMigration {

    private static final Logger log = Logger.getLogger(V18__RealLocationData.class.getName());

    private static final String DATA_URL =
            "https://raw.githubusercontent.com/jnkindi/rwanda-locations-json/master/locations.json";

    @Override
    public void migrate(Context context) throws Exception {
        Connection conn = context.getConnection();

        // ── Guard: skip if placeholder data is already gone ──────────────────
        try (Statement st = conn.createStatement();
             ResultSet rs = st.executeQuery(
                     "SELECT COUNT(*) FROM location_cells " +
                     "WHERE name IN ('Akabeza','Amahoro','Inzira','Urugwiro')")) {
            rs.next();
            long fakeCount = rs.getLong(1);
            if (fakeCount == 0) {
                log.info("V18: No placeholder data found — already replaced. Skipping.");
                return;
            }
            log.info("V18: Found " + fakeCount + " placeholder cells. Replacing with real data...");
        }

        // ── Download JSON from GitHub ─────────────────────────────────────────
        log.info("V18: Downloading Rwanda location data from GitHub (~15 MB)...");
        HttpClient http = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(30))
                .build();
        HttpRequest req = HttpRequest.newBuilder()
                .uri(URI.create(DATA_URL))
                .timeout(Duration.ofSeconds(120))
                .build();
        String body = http.send(req, HttpResponse.BodyHandlers.ofString()).body();
        log.info("V18: Download complete (" + body.length() / 1024 + " KB). Parsing...");

        // ── Parse flat JSON array ─────────────────────────────────────────────
        // Each record: { sector_name, cell_name, village_name, … }
        ObjectMapper mapper = new ObjectMapper();
        JsonNode records = mapper.readTree(body);

        // sector (normalised) → cell (title-cased) → villages (title-cased)
        Map<String, Map<String, Set<String>>> tree = new LinkedHashMap<>();
        for (JsonNode rec : records) {
            String sector  = clean(rec.path("sector_name").asText(""));
            String cell    = clean(rec.path("cell_name").asText(""));
            String village = clean(rec.path("village_name").asText(""));
            if (sector.isEmpty() || cell.isEmpty() || village.isEmpty()) continue;
            tree.computeIfAbsent(sector, k -> new LinkedHashMap<>())
                .computeIfAbsent(cell, k -> new LinkedHashSet<>())
                .add(village);
        }
        log.info("V18: Parsed " + records.size() + " records → " + tree.size() + " unique sectors.");

        // ── Load sector name → DB id ──────────────────────────────────────────
        Map<String, Long> sectorIds    = new HashMap<>();
        Map<String, Long> sectorLower  = new HashMap<>();   // lowercase fallback
        try (Statement st = conn.createStatement();
             ResultSet rs = st.executeQuery("SELECT id, name FROM location_sectors")) {
            while (rs.next()) {
                String name = rs.getString("name").trim();
                long   id   = rs.getLong("id");
                sectorIds.put(name, id);
                sectorLower.put(name.toLowerCase(), id);
            }
        }

        // ── Clear placeholder data ────────────────────────────────────────────
        try (Statement st = conn.createStatement()) {
            st.execute("DELETE FROM location_villages");
            st.execute("DELETE FROM location_cells");
        }
        log.info("V18: Placeholder data cleared.");

        // ── Insert real cells and villages ────────────────────────────────────
        String sqlInsertCell   = "INSERT INTO location_cells (name, sector_id) VALUES (?, ?) " +
                                 "ON CONFLICT (name, sector_id) DO NOTHING";
        String sqlSelectCell   = "SELECT id FROM location_cells WHERE name = ? AND sector_id = ?";
        String sqlInsertVillage= "INSERT INTO location_villages (name, cell_id) VALUES (?, ?) " +
                                 "ON CONFLICT (name, cell_id) DO NOTHING";

        int cellCount = 0, villageCount = 0, skippedSectors = 0;

        try (PreparedStatement psInsertCell    = conn.prepareStatement(sqlInsertCell);
             PreparedStatement psSelectCell    = conn.prepareStatement(sqlSelectCell);
             PreparedStatement psInsertVillage = conn.prepareStatement(sqlInsertVillage)) {

            for (Map.Entry<String, Map<String, Set<String>>> sectorEntry : tree.entrySet()) {
                String sectorName = sectorEntry.getKey();

                // Match sector to DB: exact first, then case-insensitive
                Long sectorId = sectorIds.get(sectorName);
                if (sectorId == null) sectorId = sectorLower.get(sectorName.toLowerCase());
                if (sectorId == null) {
                    log.warning("V18: Sector not found in DB, skipping: " + sectorName);
                    skippedSectors++;
                    continue;
                }

                for (Map.Entry<String, Set<String>> cellEntry : sectorEntry.getValue().entrySet()) {
                    String cellName = cellEntry.getKey();

                    // Insert cell
                    psInsertCell.setString(1, cellName);
                    psInsertCell.setLong(2, sectorId);
                    psInsertCell.executeUpdate();
                    cellCount++;

                    // Retrieve cell id
                    psSelectCell.setString(1, cellName);
                    psSelectCell.setLong(2, sectorId);
                    long cellId;
                    try (ResultSet rs = psSelectCell.executeQuery()) {
                        if (!rs.next()) continue;
                        cellId = rs.getLong("id");
                    }

                    // Insert villages for this cell
                    for (String villageName : cellEntry.getValue()) {
                        psInsertVillage.setString(1, villageName);
                        psInsertVillage.setLong(2, cellId);
                        psInsertVillage.executeUpdate();
                        villageCount++;
                    }
                }
            }
        }

        log.info(String.format(
                "V18: Complete! Inserted %,d cells and %,d villages. Skipped sectors: %d.",
                cellCount, villageCount, skippedSectors));
    }

    /**
     * Title-cases a string: "KACYIRU" → "Kacyiru", "nyamirambo" → "Nyamirambo".
     */
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
}
