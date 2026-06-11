"""
generate_location_migration.py
-------------------------------
Downloads the complete Rwanda administrative location data from GitHub,
matches cells and villages to the existing sectors in our database,
and generates a Flyway migration file:
    V18__real_location_data.sql

Usage:
    python generate_location_migration.py

Requirements:
    pip install requests

Output:
    backend/src/main/resources/db/migration/V18__real_location_data.sql
"""

import requests
import json
import os
import re
from collections import defaultdict

DATA_URL = "https://raw.githubusercontent.com/jnkindi/rwanda-locations-json/master/locations.json"

OUTPUT_PATH = os.path.join(
    os.path.dirname(__file__),
    "backend", "src", "main", "resources", "db", "migration",
    "V18__real_location_data.sql"
)

# ── Our existing sector names exactly as inserted in V6 ──────────────────────
# Used to match against the downloaded data (case-insensitive).
KNOWN_SECTORS = {
    # Gasabo
    "Bumbogo","Gatsata","Gikomero","Gisozi","Jabana","Jali","Kacyiru",
    "Kimihurura","Kimironko","Kinyinya","Nduba","Ndera","Remera","Rusororo","Rutunga",
    # Kicukiro
    "Gahanga","Gatenga","Gikondo","Kanombe","Kicukiro","Kigarama","Masaka",
    "Niboye","Nyarugunga","Kagarama",
    # Nyarugenge
    "Gitega","Kanyinya","Kigali","Kimisagara","Mageragere","Muhima",
    "Nyakabanda","Nyamirambo","Nyarugenge","Rwezamenyo",
    # Burera
    "Bungwe","Butaro","Cyanika","Cyeru","Gahunga","Gatebe","Gitovu","Kagogo",
    "Karongi","Kivuye","Nemba","Rugarama","Rugendabari","Ruhunde","Rusarabuye","Rwerere",
    # Gakenke
    "Busengo","Coko","Cyabingo","Gakenke","Gashenyi","Janja","Kamubuga","Karambo",
    "Kivuruga","Mataba","Minazi","Muhondo","Mukarange","Muyongwe","Muzo",
    "Nemba","Ruli","Rusasa","Rushashi",
    # Gicumbi
    "Bukure","Bwisige","Byumba","Cyumba","Gicumbi","Kaniga","Kageyo","Manyagiro",
    "Miyove","Mukono","Mutete","Nyamiyaga","Nyankenke I","Nyankenke II","Rubaya",
    "Rukomo","Rushaki","Rutare","Ruvune","Rwamiko","Shangasha",
    # Musanze
    "Busogo","Cyuve","Gacaca","Gashaki","Gataraga","Kimonyi","Kinigi","Muhoza",
    "Muko","Musanze","Nkotsi","Nyange","Remera","Rwaza","Shingiro",
    # Rulindo
    "Base","Burega","Bushoki","Buyoga","Cyinzuzi","Cyungo","Kinihira","Kisaro",
    "Masoro","Mbogo","Murambi","Ngoma","Ntarabana","Rukozo","Rusiga","Shyorongi","Tumba",
    # Gisagara
    "Gikonko","Gishubi","Kansi","Kibirizi","Kigembe","Mamba","Muganza","Mugombwa",
    "Mukindo","Musha","Ndora","Nyanza","Save",
    # Huye
    "Gishamvu","Huye","Karama","Kigoma","Kinazi","Maraba","Mbazi","Mukura",
    "Ngoma","Ruhashya","Rusatira","Rwaniro","Simbi","Tumba",
    # Kamonyi
    "Gacurabwenge","Kamonyi","Kayenzi","Kayumbu","Mugina","Musambira","Ngamba",
    "Nyamiyaga","Nyarubaka","Rugarika","Rukoma","Runda",
    # Muhanga
    "Cyeza","Kabacuzi","Kibangu","Kiyumba","Muhanga","Mushishiro","Nyabinoni",
    "Nyamabuye","Nyamiyaga","Rongi","Rugendabari","Shyogwe",
    # Nyamagabe
    "Buruhukiro","Cyanika","Gasaka","Gatare","Kaduha","Kamegeri","Kibirizi",
    "Kibumbwe","Kitabi","Mbazi","Mugano","Musange","Musebeya","Mushubi",
    # Nyanza
    "Busasamana","Cyabakamyi","Kibirizi","Kigoma","Mukingo","Muyira","Ntyazo",
    "Nyagisozi","Rwabicuma",
    # Nyaruguru
    "Cyahinda","Kibeho","Kivu","Mata","Muganza","Munini","Ngera","Ngoma",
    "Nyabimata","Nyagisozi","Ruheru","Ruramba","Rusenge","Simbi",
    # Ruhango
    "Byimana","Kabagari","Kinazi","Kinihira","Mbuye","Mwendo","Ntongwe","Ruhango","Nzaratsi",
    # Bugesera
    "Gashora","Juru","Kamabuye","Mareba","Mayange","Musenyi","Mwogo","Ngeruka",
    "Ntarama","Nyamata","Nyarugenge","Rilima","Ruhuha","Rweru","Shyara",
    # Gatsibo
    "Gasange","Gatsibo","Gitoki","Kabarore","Kageyo","Kiramuruzi","Kiziguro",
    "Muhura","Murambi","Ngarama","Nyagihanga","Remera","Rugarama","Rwimbogo",
    # Kayonza
    "Gahini","Kabare","Kabarondo","Mukarange","Murama","Murundi","Mwiri","Ndego",
    "Nyamirama","Rukara","Ruramira","Rwinkwavu","Kazo",
    # Kirehe
    "Gahara","Gatore","Kigarama","Kigina","Kirehe","Mahama","Mpanga","Musaza",
    "Mushikiri","Nasho","Nyamugari","Nyarubuye",
    # Ngoma
    "Gashanda","Jarama","Karembo","Kazo","Kibungo","Mugesera","Murama","Mutenderi",
    "Remera","Rukira","Rukumberi","Rurenge","Sake","Zaza",
    # Nyagatare
    "Gatunda","Karama","Karangazi","Katabagemu","Kazo","Kibali","Kirama","Kiyombe",
    "Matimba","Mimuli","Mukama","Musheri","Nyagatare","Rukomo","Rwempasha","Rwimiyaga","Tabagwe",
    # Rwamagana
    "Fumbwe","Gahengeri","Gishari","Karenge","Kigabiro","Muhazi","Munyaga",
    "Munyiginya","Musha","Muyumbu","Mwulire","Nyakaliro",
    # Karongi
    "Bwishyura","Gashari","Gishyita","Gitesi","Mubuga","Murambi","Murundi",
    "Mutuntu","Rubengera","Rugabano","Ruganda","Rwankuba","Twumba",
    # Ngororero
    "Bwira","Gatumba","Hindiro","Kabaya","Kageyo","Kavumu","Matyazo","Muhanda",
    "Muhororo","Ndaro","Ngororero","Nyange","Sovu",
    # Nyabihu
    "Bigogwe","Jenda","Jomba","Kabatwa","Karago","Kintobo","Mukamira","Muringa",
    "Rambura","Rugera","Rurembo","Shyira","Shyorongi",
    # Nyamasheke
    "Bushekeri","Bushenge","Cyato","Gihombo","Kagano","Kanjongo","Karambi",
    "Karengera","Kirimbi","Macuba","Mahembe","Nyabitekeri","Nyakabuye","Rangiro",
    "Ruharambuga","Shangi",
    # Rubavu
    "Bugeshi","Busasamana","Cyanzarwe","Gisenyi","Kanama","Kanzenze","Mudende",
    "Nyakiriba","Nyamyumba","Nyundo","Rubavu","Rugerero",
    # Rusizi
    "Bugarama","Bweyeye","Gashonga","Giheke","Gihundwe","Gikundamvura","Gitambi",
    "Kamembe","Muganza","Mururu","Nkanka","Nkombo","Nkungu","Nyakabuye","Nyandungu",
    "Rugabano","Ruganda","Rusizi","Rwimboko",
    # Rutsiro
    "Boneza","Gihango","Kigeyo","Kivumu","Manihira","Mukura","Murunda","Musasa",
    "Mushonyi","Mushubati","Nyabirasi","Ruhango","Rusebeya",
}

# Lowercase lookup for matching
SECTOR_LOWER = {s.lower(): s for s in KNOWN_SECTORS}


def esc(s):
    """Escape single quotes for SQL."""
    return s.replace("'", "''")


def title_case(s):
    """Capitalise first letter of each word."""
    return " ".join(w.capitalize() for w in s.split())


def main():
    print("Downloading Rwanda location data from GitHub...")
    print("(This may take a moment — the file is ~15 MB)")

    r = requests.get(DATA_URL, timeout=120)
    r.raise_for_status()
    records = r.json()
    print(f"Downloaded {len(records):,} records.")

    # Build: sector_name → {cell_name → set(village_names)}
    tree = defaultdict(lambda: defaultdict(set))

    unmatched_sectors = set()

    for rec in records:
        raw_sector  = rec.get("sector_name",  "").strip()
        raw_cell    = rec.get("cell_name",    "").strip()
        raw_village = rec.get("village_name", "").strip()

        if not raw_sector or not raw_cell or not raw_village:
            continue

        # Try exact match first, then lowercase
        if raw_sector in KNOWN_SECTORS:
            sector = raw_sector
        elif raw_sector.lower() in SECTOR_LOWER:
            sector = SECTOR_LOWER[raw_sector.lower()]
        else:
            unmatched_sectors.add(raw_sector)
            continue

        cell    = title_case(raw_cell)
        village = title_case(raw_village)
        tree[sector][cell].add(village)

    matched   = len(tree)
    unmatched = len(unmatched_sectors)
    total_cells    = sum(len(cells) for cells in tree.values())
    total_villages = sum(len(vs) for cells in tree.values() for vs in cells.values())

    print(f"\nMatched sectors : {matched} / {len(KNOWN_SECTORS)}")
    print(f"Unmatched sectors from source : {unmatched}")
    print(f"Total cells    : {total_cells:,}")
    print(f"Total villages : {total_villages:,}")

    if unmatched_sectors:
        print(f"\nUnmatched sector names (will keep placeholder data):")
        for s in sorted(unmatched_sectors)[:20]:
            print(f"  {s!r}")
        if len(unmatched_sectors) > 20:
            print(f"  ... and {len(unmatched_sectors)-20} more")

    # ── Generate SQL ──────────────────────────────────────────────────────────
    lines = []
    lines.append("-- =============================================================")
    lines.append("-- V18: Replace placeholder cells/villages with real Rwanda data")
    lines.append(f"-- Generated by generate_location_migration.py")
    lines.append(f"-- Source: github.com/jnkindi/rwanda-locations-json")
    lines.append(f"-- Sectors matched: {matched} | Cells: {total_cells:,} | Villages: {total_villages:,}")
    lines.append("-- =============================================================")
    lines.append("")
    lines.append("-- Step 1: Remove all placeholder cells and villages")
    lines.append("DELETE FROM location_villages;")
    lines.append("DELETE FROM location_cells;")
    lines.append("")
    lines.append("-- Step 2: Insert real cells and villages per sector")
    lines.append("")

    for sector_name in sorted(tree.keys()):
        cells = tree[sector_name]
        lines.append(f"-- {sector_name} ({len(cells)} cells)")
        lines.append("DO $$")
        lines.append("DECLARE")
        lines.append(f"    sec_id BIGINT := (SELECT id FROM location_sectors WHERE name = '{esc(sector_name)}' LIMIT 1);")
        lines.append("    cell_id BIGINT;")
        lines.append("BEGIN")
        lines.append("    IF sec_id IS NOT NULL THEN")

        for cell_name in sorted(cells.keys()):
            villages = sorted(cells[cell_name])
            lines.append(f"        INSERT INTO location_cells (name, sector_id)")
            lines.append(f"            VALUES ('{esc(cell_name)}', sec_id)")
            lines.append(f"            ON CONFLICT (name, sector_id) DO NOTHING;")
            lines.append(f"        cell_id := (SELECT id FROM location_cells WHERE name = '{esc(cell_name)}' AND sector_id = sec_id);")

            for village_name in villages:
                lines.append(f"        INSERT INTO location_villages (name, cell_id)")
                lines.append(f"            VALUES ('{esc(village_name)}', cell_id)")
                lines.append(f"            ON CONFLICT (name, cell_id) DO NOTHING;")

        lines.append("    END IF;")
        lines.append("END $$;")
        lines.append("")

    sql = "\n".join(lines)

    os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)
    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        f.write(sql)

    size_kb = os.path.getsize(OUTPUT_PATH) / 1024
    print(f"\nMigration written to:")
    print(f"  {OUTPUT_PATH}")
    print(f"  Size: {size_kb:.0f} KB")
    print(f"\nDone! Restart the Spring Boot backend to apply V18.")


if __name__ == "__main__":
    main()
