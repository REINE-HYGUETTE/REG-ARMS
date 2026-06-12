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
 * V23 — Correct all cell and village data using district-aware matching.
 *
 * Previous migrations (V18, V22) matched sectors by name only, which caused
 * mismatches for the 35 sector names that are duplicated across districts.
 *
 * This migration:
 *   1. Wipes ALL existing cells and villages (clean slate)
 *   2. Downloads the official Rwanda locations JSON (~14,842 records)
 *   3. Adds any sectors from the JSON that are missing in the DB
 *   4. Uses spelling aliases for known r/l, g/d, z/l transliteration differences
 *   5. Matches each record using (district_name, sector_name) — zero ambiguity
 *   6. Inserts all 2,148 cells and 14,842 villages correctly
 *   7. Removes old empty sectors that the official data doesn't recognise
 *
 * Source: github.com/jnkindi/rwanda-locations-json
 * Each record: { province_name, district_name, sector_name, cell_name, village_name, ... }
 */
public class V23__CorrectLocationData extends BaseJavaMigration {

    private static final Logger log = Logger.getLogger(V23__CorrectLocationData.class.getName());

    private static final String DATA_URL =
            "https://raw.githubusercontent.com/jnkindi/rwanda-locations-json/master/locations.json";

    /**
     * Spelling aliases: known Kinyarwanda transliteration differences.
     * Key: "district_lower|json_sector_lower" → Value: DB sector name to map to.
     */
    private static final Map<String, String> SECTOR_ALIASES = Map.ofEntries(
            Map.entry("ruhango|kabagali", "Kabagari"),
            Map.entry("rusizi|rwimbogo", "Rwimboko"),
            Map.entry("burera|rugengabari", "Rugendabari"),
            Map.entry("rwamagana|gishali", "Gishari"),
            Map.entry("nyagatare|mimuri", "Mimuli"),
            Map.entry("bugesera|ririma", "Rilima"),
            Map.entry("nyanza|kibilizi", "Kibirizi"),
            Map.entry("gicumbi|nyankenke", "Nyankenke I")
    );

    @Override
    public void migrate(Context context) throws Exception {
        Connection conn = context.getConnection();

        // ── 1. Wipe existing cells and villages ──────────────────────────────
        log.info("V23: Clearing all existing cells and villages for clean re-import...");
        try (Statement st = conn.createStatement()) {
            st.execute("DELETE FROM location_villages");
            st.execute("DELETE FROM location_cells");
        }
        log.info("V23: Cleared.");

        // ── 2. Download JSON ─────────────────────────────────────────────────
        log.info("V23: Downloading Rwanda location data from GitHub...");
        HttpClient http = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(30))
                .build();
        HttpRequest req = HttpRequest.newBuilder()
                .uri(URI.create(DATA_URL))
                .timeout(Duration.ofSeconds(180))
                .build();
        String body = http.send(req, HttpResponse.BodyHandlers.ofString()).body();
        log.info("V23: Download complete (" + body.length() / 1024 + " KB). Parsing...");

        // ── 3. Parse JSON ────────────────────────────────────────────────────
        ObjectMapper mapper = new ObjectMapper();
        JsonNode records = mapper.readTree(body);
        log.info("V23: Parsed " + records.size() + " records.");

        // Build tree: (district_lower, sector_lower) → cell_titlecase → Set<village_titlecase>
        // Also track all unique (district, sector) pairs and sector title-case names.
        Map<String, Map<String, Map<String, Set<String>>>> tree = new LinkedHashMap<>();
        Map<String, String> sectorTitleMap = new HashMap<>(); // "dist|sec" → title-cased name

        for (JsonNode rec : records) {
            String district = rec.path("district_name").asText("").trim();
            String sector   = rec.path("sector_name").asText("").trim();
            String cell     = rec.path("cell_name").asText("").trim();
            String village  = rec.path("village_name").asText("").trim();

            if (district.isEmpty() || sector.isEmpty() || cell.isEmpty() || village.isEmpty()) continue;

            String distKey = district.toLowerCase(Locale.ROOT);
            String secKey  = sector.toLowerCase(Locale.ROOT);
            String pairKey = distKey + "|" + secKey;

            sectorTitleMap.putIfAbsent(pairKey, titleCase(sector));

            tree.computeIfAbsent(distKey, k -> new LinkedHashMap<>())
                .computeIfAbsent(secKey, k -> new LinkedHashMap<>())
                .computeIfAbsent(titleCase(cell), k -> new LinkedHashSet<>())
                .add(titleCase(village));
        }

        log.info("V23: Built tree: " + tree.size() + " districts.");

        // ── 4. Load district IDs ─────────────────────────────────────────────
        Map<String, Long> districtIds = new HashMap<>();
        try (Statement st = conn.createStatement();
             ResultSet rs = st.executeQuery("SELECT id, LOWER(name) FROM location_districts")) {
            while (rs.next()) {
                districtIds.put(rs.getString(2).trim(), rs.getLong(1));
            }
        }

        // ── 5. Load existing sectors ─────────────────────────────────────────
        // Key: "district_lower|sector_lower" → sector_id
        Map<String, Long> sectorLookup = new HashMap<>();
        try (Statement st = conn.createStatement();
             ResultSet rs = st.executeQuery(
                     "SELECT s.id, LOWER(s.name), LOWER(d.name) " +
                     "FROM location_sectors s " +
                     "JOIN location_districts d ON d.id = s.district_id")) {
            while (rs.next()) {
                String key = rs.getString(3).trim() + "|" + rs.getString(2).trim();
                sectorLookup.put(key, rs.getLong(1));
            }
        }
        log.info("V23: Loaded " + sectorLookup.size() + " existing sectors.");

        // ── 6. Register aliases and add missing sectors ──────────────────────
        int addedSectors = 0;
        PreparedStatement psInsertSector = conn.prepareStatement(
                "INSERT INTO location_sectors (name, district_id) VALUES (?, ?) " +
                "ON CONFLICT (name, district_id) DO NOTHING",
                Statement.RETURN_GENERATED_KEYS);
        PreparedStatement psSelectSector = conn.prepareStatement(
                "SELECT id FROM location_sectors WHERE LOWER(name) = LOWER(?) AND district_id = ?");

        for (Map.Entry<String, Map<String, Map<String, Set<String>>>> distEntry : tree.entrySet()) {
            String distKey = distEntry.getKey();
            Long distId = districtIds.get(distKey);
            if (distId == null) continue;

            for (String secKey : distEntry.getValue().keySet()) {
                String pairKey = distKey + "|" + secKey;

                // Already in DB?
                if (sectorLookup.containsKey(pairKey)) continue;

                // Has alias?
                String aliasName = SECTOR_ALIASES.get(pairKey);
                if (aliasName != null) {
                    String aliasKey = distKey + "|" + aliasName.toLowerCase(Locale.ROOT);
                    Long existingId = sectorLookup.get(aliasKey);
                    if (existingId != null) {
                        sectorLookup.put(pairKey, existingId);
                        continue;
                    }
                }

                // Add missing sector
                String sectorName = sectorTitleMap.getOrDefault(pairKey, titleCase(secKey));
                psInsertSector.setString(1, sectorName);
                psInsertSector.setLong(2, distId);
                psInsertSector.executeUpdate();

                // Retrieve ID
                psSelectSector.setString(1, sectorName);
                psSelectSector.setLong(2, distId);
                try (ResultSet rs = psSelectSector.executeQuery()) {
                    if (rs.next()) {
                        sectorLookup.put(pairKey, rs.getLong(1));
                        addedSectors++;
                    }
                }
            }
        }
        psInsertSector.close();
        psSelectSector.close();
        log.info("V23: Added " + addedSectors + " missing sectors.");

        // ── 7. Insert cells and villages ─────────────────────────────────────
        String sqlInsertCell    = "INSERT INTO location_cells (name, sector_id) VALUES (?, ?) " +
                                  "ON CONFLICT (name, sector_id) DO NOTHING";
        String sqlSelectCell    = "SELECT id FROM location_cells WHERE name = ? AND sector_id = ?";
        String sqlInsertVillage = "INSERT INTO location_villages (name, cell_id) VALUES (?, ?) " +
                                  "ON CONFLICT (name, cell_id) DO NOTHING";

        int cellCount = 0, villageCount = 0, matchedSectors = 0, unmatchedSectors = 0;

        try (PreparedStatement psInsertCell    = conn.prepareStatement(sqlInsertCell);
             PreparedStatement psSelectCell    = conn.prepareStatement(sqlSelectCell);
             PreparedStatement psInsertVillage = conn.prepareStatement(sqlInsertVillage)) {

            for (Map.Entry<String, Map<String, Map<String, Set<String>>>> distEntry : tree.entrySet()) {
                String distKey = distEntry.getKey();

                for (Map.Entry<String, Map<String, Set<String>>> secEntry : distEntry.getValue().entrySet()) {
                    String secKey  = secEntry.getKey();
                    String pairKey = distKey + "|" + secKey;

                    Long sectorId = sectorLookup.get(pairKey);
                    if (sectorId == null) {
                        unmatchedSectors++;
                        log.warning("V23: No match for " + pairKey);
                        continue;
                    }
                    matchedSectors++;

                    for (Map.Entry<String, Set<String>> cellEntry : secEntry.getValue().entrySet()) {
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
        }

        // ── 8. Remove old empty sectors (no cells = not in official data) ────
        int removedSectors;
        try (Statement st = conn.createStatement()) {
            removedSectors = st.executeUpdate(
                    "DELETE FROM location_sectors " +
                    "WHERE (SELECT COUNT(*) FROM location_cells c WHERE c.sector_id = location_sectors.id) = 0 " +
                    "AND NOT EXISTS (SELECT 1 FROM requests r WHERE LOWER(r.sector) = LOWER(location_sectors.name))");
        }

        log.info(String.format(
                "V23: DONE! Matched %d sectors (skipped %d). " +
                "Inserted %,d cells, %,d villages. Removed %d obsolete sectors.",
                matchedSectors, unmatchedSectors, cellCount, villageCount, removedSectors));
    }

    private String titleCase(String raw) {
        if (raw == null || raw.isEmpty()) return "";
        String[] words = raw.trim().split("\\s+");
        StringBuilder sb = new StringBuilder();
        for (String w : words) {
            if (w.isEmpty()) continue;
            if (sb.length() > 0) sb.append(" ");
            sb.append(Character.toUpperCase(w.charAt(0)));
            if (w.length() > 1) sb.append(w.substring(1).toLowerCase(Locale.ROOT));
        }
        return sb.toString();
    }
}
