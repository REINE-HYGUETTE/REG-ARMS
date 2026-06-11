-- ============================================================
-- V6: Rwanda Administrative Location Hierarchy
-- Province → District → Sector → Cell → Village
-- ============================================================

-- ── Reference Tables ────────────────────────────────────────

CREATE TABLE location_provinces (
    id   BIGSERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE
);

CREATE TABLE location_districts (
    id          BIGSERIAL PRIMARY KEY,
    name        VARCHAR(100) NOT NULL,
    province_id BIGINT NOT NULL REFERENCES location_provinces(id),
    UNIQUE (name, province_id)
);

CREATE TABLE location_sectors (
    id          BIGSERIAL PRIMARY KEY,
    name        VARCHAR(100) NOT NULL,
    district_id BIGINT NOT NULL REFERENCES location_districts(id),
    UNIQUE (name, district_id)
);

CREATE TABLE location_cells (
    id        BIGSERIAL PRIMARY KEY,
    name      VARCHAR(100) NOT NULL,
    sector_id BIGINT NOT NULL REFERENCES location_sectors(id),
    UNIQUE (name, sector_id)
);

CREATE TABLE location_villages (
    id      BIGSERIAL PRIMARY KEY,
    name    VARCHAR(100) NOT NULL,
    cell_id BIGINT NOT NULL REFERENCES location_cells(id),
    UNIQUE (name, cell_id)
);

CREATE INDEX idx_loc_districts_province ON location_districts(province_id);
CREATE INDEX idx_loc_sectors_district   ON location_sectors(district_id);
CREATE INDEX idx_loc_cells_sector       ON location_cells(sector_id);
CREATE INDEX idx_loc_villages_cell      ON location_villages(cell_id);

-- ── Extend users & requests with cell + village ─────────────

ALTER TABLE users    ADD COLUMN cell    VARCHAR(100);
ALTER TABLE users    ADD COLUMN village VARCHAR(100);
ALTER TABLE requests ADD COLUMN cell    VARCHAR(100);
ALTER TABLE requests ADD COLUMN village VARCHAR(100);

-- ============================================================
-- SEED DATA
-- ============================================================

-- ── Provinces ───────────────────────────────────────────────

INSERT INTO location_provinces (name) VALUES
    ('Kigali City'),
    ('Northern Province'),
    ('Southern Province'),
    ('Eastern Province'),
    ('Western Province');

-- ── Districts ───────────────────────────────────────────────

INSERT INTO location_districts (name, province_id)
SELECT v.name, p.id
FROM (VALUES
    ('Gasabo',    'Kigali City'),
    ('Kicukiro',  'Kigali City'),
    ('Nyarugenge','Kigali City'),
    ('Burera',    'Northern Province'),
    ('Gakenke',   'Northern Province'),
    ('Gicumbi',   'Northern Province'),
    ('Musanze',   'Northern Province'),
    ('Rulindo',   'Northern Province'),
    ('Gisagara',  'Southern Province'),
    ('Huye',      'Southern Province'),
    ('Kamonyi',   'Southern Province'),
    ('Muhanga',   'Southern Province'),
    ('Nyamagabe', 'Southern Province'),
    ('Nyanza',    'Southern Province'),
    ('Nyaruguru', 'Southern Province'),
    ('Ruhango',   'Southern Province'),
    ('Bugesera',  'Eastern Province'),
    ('Gatsibo',   'Eastern Province'),
    ('Kayonza',   'Eastern Province'),
    ('Kirehe',    'Eastern Province'),
    ('Ngoma',     'Eastern Province'),
    ('Nyagatare', 'Eastern Province'),
    ('Rwamagana', 'Eastern Province'),
    ('Karongi',   'Western Province'),
    ('Ngororero', 'Western Province'),
    ('Nyabihu',   'Western Province'),
    ('Nyamasheke','Western Province'),
    ('Rubavu',    'Western Province'),
    ('Rusizi',    'Western Province'),
    ('Rutsiro',   'Western Province')
) AS v(name, province_name)
JOIN location_provinces p ON p.name = v.province_name;

-- ── Sectors ─────────────────────────────────────────────────

-- Gasabo (15)
INSERT INTO location_sectors (name, district_id)
SELECT v.name, d.id FROM (VALUES
    ('Bumbogo'),('Gatsata'),('Gikomero'),('Gisozi'),('Jabana'),
    ('Jali'),('Kacyiru'),('Kimihurura'),('Kimironko'),('Kinyinya'),
    ('Nduba'),('Ndera'),('Remera'),('Rusororo'),('Rutunga')
) AS v(name) CROSS JOIN (SELECT id FROM location_districts WHERE name = 'Gasabo') AS d;

-- Kicukiro (10)
INSERT INTO location_sectors (name, district_id)
SELECT v.name, d.id FROM (VALUES
    ('Gahanga'),('Gatenga'),('Gikondo'),('Kanombe'),('Kicukiro'),
    ('Kigarama'),('Masaka'),('Niboye'),('Nyarugunga'),('Kagarama')
) AS v(name) CROSS JOIN (SELECT id FROM location_districts WHERE name = 'Kicukiro') AS d;

-- Nyarugenge (10)
INSERT INTO location_sectors (name, district_id)
SELECT v.name, d.id FROM (VALUES
    ('Gitega'),('Kanyinya'),('Kigali'),('Kimisagara'),('Mageragere'),
    ('Muhima'),('Nyakabanda'),('Nyamirambo'),('Nyarugenge'),('Rwezamenyo')
) AS v(name) CROSS JOIN (SELECT id FROM location_districts WHERE name = 'Nyarugenge') AS d;

-- Burera (16)
INSERT INTO location_sectors (name, district_id)
SELECT v.name, d.id FROM (VALUES
    ('Bungwe'),('Butaro'),('Cyanika'),('Cyeru'),('Gahunga'),
    ('Gatebe'),('Gitovu'),('Kagogo'),('Karongi'),('Kivuye'),
    ('Nemba'),('Rugarama'),('Rugendabari'),('Ruhunde'),('Rusarabuye'),('Rwerere')
) AS v(name) CROSS JOIN (SELECT id FROM location_districts WHERE name = 'Burera') AS d;

-- Gakenke (19)
INSERT INTO location_sectors (name, district_id)
SELECT v.name, d.id FROM (VALUES
    ('Busengo'),('Coko'),('Cyabingo'),('Gakenke'),('Gashenyi'),
    ('Janja'),('Kamubuga'),('Karambo'),('Kivuruga'),('Mataba'),
    ('Minazi'),('Muhondo'),('Mukarange'),('Muyongwe'),('Muzo'),
    ('Nemba'),('Ruli'),('Rusasa'),('Rushashi')
) AS v(name) CROSS JOIN (SELECT id FROM location_districts WHERE name = 'Gakenke') AS d;

-- Gicumbi (21)
INSERT INTO location_sectors (name, district_id)
SELECT v.name, d.id FROM (VALUES
    ('Bukure'),('Bwisige'),('Byumba'),('Cyumba'),('Gicumbi'),
    ('Kaniga'),('Kageyo'),('Manyagiro'),('Miyove'),('Mukono'),
    ('Mutete'),('Nyamiyaga'),('Nyankenke I'),('Nyankenke II'),('Rubaya'),
    ('Rukomo'),('Rushaki'),('Rutare'),('Ruvune'),('Rwamiko'),('Shangasha')
) AS v(name) CROSS JOIN (SELECT id FROM location_districts WHERE name = 'Gicumbi') AS d;

-- Musanze (15)
INSERT INTO location_sectors (name, district_id)
SELECT v.name, d.id FROM (VALUES
    ('Busogo'),('Cyuve'),('Gacaca'),('Gashaki'),('Gataraga'),
    ('Kimonyi'),('Kinigi'),('Muhoza'),('Muko'),('Musanze'),
    ('Nkotsi'),('Nyange'),('Remera'),('Rwaza'),('Shingiro')
) AS v(name) CROSS JOIN (SELECT id FROM location_districts WHERE name = 'Musanze') AS d;

-- Rulindo (17)
INSERT INTO location_sectors (name, district_id)
SELECT v.name, d.id FROM (VALUES
    ('Base'),('Burega'),('Bushoki'),('Buyoga'),('Cyinzuzi'),
    ('Cyungo'),('Kinihira'),('Kisaro'),('Masoro'),('Mbogo'),
    ('Murambi'),('Ngoma'),('Ntarabana'),('Rukozo'),('Rusiga'),
    ('Shyorongi'),('Tumba')
) AS v(name) CROSS JOIN (SELECT id FROM location_districts WHERE name = 'Rulindo') AS d;

-- Gisagara (13)
INSERT INTO location_sectors (name, district_id)
SELECT v.name, d.id FROM (VALUES
    ('Gikonko'),('Gishubi'),('Kansi'),('Kibirizi'),('Kigembe'),
    ('Mamba'),('Muganza'),('Mugombwa'),('Mukindo'),('Musha'),
    ('Ndora'),('Nyanza'),('Save')
) AS v(name) CROSS JOIN (SELECT id FROM location_districts WHERE name = 'Gisagara') AS d;

-- Huye (14)
INSERT INTO location_sectors (name, district_id)
SELECT v.name, d.id FROM (VALUES
    ('Gishamvu'),('Huye'),('Karama'),('Kigoma'),('Kinazi'),
    ('Maraba'),('Mbazi'),('Mukura'),('Ngoma'),('Ruhashya'),
    ('Rusatira'),('Rwaniro'),('Simbi'),('Tumba')
) AS v(name) CROSS JOIN (SELECT id FROM location_districts WHERE name = 'Huye') AS d;

-- Kamonyi (12)
INSERT INTO location_sectors (name, district_id)
SELECT v.name, d.id FROM (VALUES
    ('Gacurabwenge'),('Kamonyi'),('Kayenzi'),('Kayumbu'),('Mugina'),
    ('Musambira'),('Ngamba'),('Nyamiyaga'),('Nyarubaka'),('Rugarika'),
    ('Rukoma'),('Runda')
) AS v(name) CROSS JOIN (SELECT id FROM location_districts WHERE name = 'Kamonyi') AS d;

-- Muhanga (12)
INSERT INTO location_sectors (name, district_id)
SELECT v.name, d.id FROM (VALUES
    ('Cyeza'),('Kabacuzi'),('Kibangu'),('Kiyumba'),('Muhanga'),
    ('Mushishiro'),('Nyabinoni'),('Nyamabuye'),('Nyamiyaga'),('Rongi'),
    ('Rugendabari'),('Shyogwe')
) AS v(name) CROSS JOIN (SELECT id FROM location_districts WHERE name = 'Muhanga') AS d;

-- Nyamagabe (14)
INSERT INTO location_sectors (name, district_id)
SELECT v.name, d.id FROM (VALUES
    ('Buruhukiro'),('Cyanika'),('Gasaka'),('Gatare'),('Kaduha'),
    ('Kamegeri'),('Kibirizi'),('Kibumbwe'),('Kitabi'),('Mbazi'),
    ('Mugano'),('Musange'),('Musebeya'),('Mushubi')
) AS v(name) CROSS JOIN (SELECT id FROM location_districts WHERE name = 'Nyamagabe') AS d;

-- Nyanza (9)
INSERT INTO location_sectors (name, district_id)
SELECT v.name, d.id FROM (VALUES
    ('Busasamana'),('Cyabakamyi'),('Kibirizi'),('Kigoma'),('Mukingo'),
    ('Muyira'),('Ntyazo'),('Nyagisozi'),('Rwabicuma')
) AS v(name) CROSS JOIN (SELECT id FROM location_districts WHERE name = 'Nyanza') AS d;

-- Nyaruguru (14)
INSERT INTO location_sectors (name, district_id)
SELECT v.name, d.id FROM (VALUES
    ('Cyahinda'),('Kibeho'),('Kivu'),('Mata'),('Muganza'),
    ('Munini'),('Ngera'),('Ngoma'),('Nyabimata'),('Nyagisozi'),
    ('Ruheru'),('Ruramba'),('Rusenge'),('Simbi')
) AS v(name) CROSS JOIN (SELECT id FROM location_districts WHERE name = 'Nyaruguru') AS d;

-- Ruhango (9)
INSERT INTO location_sectors (name, district_id)
SELECT v.name, d.id FROM (VALUES
    ('Byimana'),('Kabagari'),('Kinazi'),('Kinihira'),('Mbuye'),
    ('Mwendo'),('Ntongwe'),('Ruhango'),('Nzaratsi')
) AS v(name) CROSS JOIN (SELECT id FROM location_districts WHERE name = 'Ruhango') AS d;

-- Bugesera (15)
INSERT INTO location_sectors (name, district_id)
SELECT v.name, d.id FROM (VALUES
    ('Gashora'),('Juru'),('Kamabuye'),('Mareba'),('Mayange'),
    ('Musenyi'),('Mwogo'),('Ngeruka'),('Ntarama'),('Nyamata'),
    ('Nyarugenge'),('Rilima'),('Ruhuha'),('Rweru'),('Shyara')
) AS v(name) CROSS JOIN (SELECT id FROM location_districts WHERE name = 'Bugesera') AS d;

-- Gatsibo (14)
INSERT INTO location_sectors (name, district_id)
SELECT v.name, d.id FROM (VALUES
    ('Gasange'),('Gatsibo'),('Gitoki'),('Kabarore'),('Kageyo'),
    ('Kiramuruzi'),('Kiziguro'),('Muhura'),('Murambi'),('Ngarama'),
    ('Nyagihanga'),('Remera'),('Rugarama'),('Rwimbogo')
) AS v(name) CROSS JOIN (SELECT id FROM location_districts WHERE name = 'Gatsibo') AS d;

-- Kayonza (13)
INSERT INTO location_sectors (name, district_id)
SELECT v.name, d.id FROM (VALUES
    ('Gahini'),('Kabare'),('Kabarondo'),('Mukarange'),('Murama'),
    ('Murundi'),('Mwiri'),('Ndego'),('Nyamirama'),('Rukara'),
    ('Ruramira'),('Rwinkwavu'),('Kazo')
) AS v(name) CROSS JOIN (SELECT id FROM location_districts WHERE name = 'Kayonza') AS d;

-- Kirehe (12)
INSERT INTO location_sectors (name, district_id)
SELECT v.name, d.id FROM (VALUES
    ('Gahara'),('Gatore'),('Kigarama'),('Kigina'),('Kirehe'),
    ('Mahama'),('Mpanga'),('Musaza'),('Mushikiri'),('Nasho'),
    ('Nyamugari'),('Nyarubuye')
) AS v(name) CROSS JOIN (SELECT id FROM location_districts WHERE name = 'Kirehe') AS d;

-- Ngoma (14)
INSERT INTO location_sectors (name, district_id)
SELECT v.name, d.id FROM (VALUES
    ('Gashanda'),('Jarama'),('Karembo'),('Kazo'),('Kibungo'),
    ('Mugesera'),('Murama'),('Mutenderi'),('Remera'),('Rukira'),
    ('Rukumberi'),('Rurenge'),('Sake'),('Zaza')
) AS v(name) CROSS JOIN (SELECT id FROM location_districts WHERE name = 'Ngoma') AS d;

-- Nyagatare (17)
INSERT INTO location_sectors (name, district_id)
SELECT v.name, d.id FROM (VALUES
    ('Gatunda'),('Karama'),('Karangazi'),('Katabagemu'),('Kazo'),
    ('Kibali'),('Kirama'),('Kiyombe'),('Matimba'),('Mimuli'),
    ('Mukama'),('Musheri'),('Nyagatare'),('Rukomo'),('Rwempasha'),
    ('Rwimiyaga'),('Tabagwe')
) AS v(name) CROSS JOIN (SELECT id FROM location_districts WHERE name = 'Nyagatare') AS d;

-- Rwamagana (12)
INSERT INTO location_sectors (name, district_id)
SELECT v.name, d.id FROM (VALUES
    ('Fumbwe'),('Gahengeri'),('Gishari'),('Karenge'),('Kigabiro'),
    ('Muhazi'),('Munyaga'),('Munyiginya'),('Musha'),('Muyumbu'),
    ('Mwulire'),('Nyakaliro')
) AS v(name) CROSS JOIN (SELECT id FROM location_districts WHERE name = 'Rwamagana') AS d;

-- Karongi (13)
INSERT INTO location_sectors (name, district_id)
SELECT v.name, d.id FROM (VALUES
    ('Bwishyura'),('Gashari'),('Gishyita'),('Gitesi'),('Mubuga'),
    ('Murambi'),('Murundi'),('Mutuntu'),('Rubengera'),('Rugabano'),
    ('Ruganda'),('Rwankuba'),('Twumba')
) AS v(name) CROSS JOIN (SELECT id FROM location_districts WHERE name = 'Karongi') AS d;

-- Ngororero (13)
INSERT INTO location_sectors (name, district_id)
SELECT v.name, d.id FROM (VALUES
    ('Bwira'),('Gatumba'),('Hindiro'),('Kabaya'),('Kageyo'),
    ('Kavumu'),('Matyazo'),('Muhanda'),('Muhororo'),('Ndaro'),
    ('Ngororero'),('Nyange'),('Sovu')
) AS v(name) CROSS JOIN (SELECT id FROM location_districts WHERE name = 'Ngororero') AS d;

-- Nyabihu (13)
INSERT INTO location_sectors (name, district_id)
SELECT v.name, d.id FROM (VALUES
    ('Bigogwe'),('Jenda'),('Jomba'),('Kabatwa'),('Karago'),
    ('Kintobo'),('Mukamira'),('Muringa'),('Rambura'),('Rugera'),
    ('Rurembo'),('Shyira'),('Shyorongi')
) AS v(name) CROSS JOIN (SELECT id FROM location_districts WHERE name = 'Nyabihu') AS d;

-- Nyamasheke (16)
INSERT INTO location_sectors (name, district_id)
SELECT v.name, d.id FROM (VALUES
    ('Bushekeri'),('Bushenge'),('Cyato'),('Gihombo'),('Kagano'),
    ('Kanjongo'),('Karambi'),('Karengera'),('Kirimbi'),('Macuba'),
    ('Mahembe'),('Nyabitekeri'),('Nyakabuye'),('Rangiro'),('Ruharambuga'),('Shangi')
) AS v(name) CROSS JOIN (SELECT id FROM location_districts WHERE name = 'Nyamasheke') AS d;

-- Rubavu (12)
INSERT INTO location_sectors (name, district_id)
SELECT v.name, d.id FROM (VALUES
    ('Bugeshi'),('Busasamana'),('Cyanzarwe'),('Gisenyi'),('Kanama'),
    ('Kanzenze'),('Mudende'),('Nyakiriba'),('Nyamyumba'),('Nyundo'),
    ('Rubavu'),('Rugerero')
) AS v(name) CROSS JOIN (SELECT id FROM location_districts WHERE name = 'Rubavu') AS d;

-- Rusizi (19)
INSERT INTO location_sectors (name, district_id)
SELECT v.name, d.id FROM (VALUES
    ('Bugarama'),('Bweyeye'),('Gashonga'),('Giheke'),('Gihundwe'),
    ('Gikundamvura'),('Gitambi'),('Kamembe'),('Muganza'),('Mururu'),
    ('Nkanka'),('Nkombo'),('Nkungu'),('Nyakabuye'),('Nyandungu'),
    ('Rugabano'),('Ruganda'),('Rusizi'),('Rwimboko')
) AS v(name) CROSS JOIN (SELECT id FROM location_districts WHERE name = 'Rusizi') AS d;

-- Rutsiro (13)
INSERT INTO location_sectors (name, district_id)
SELECT v.name, d.id FROM (VALUES
    ('Boneza'),('Gihango'),('Kigeyo'),('Kivumu'),('Manihira'),
    ('Mukura'),('Murunda'),('Musasa'),('Mushonyi'),('Mushubati'),
    ('Nyabirasi'),('Ruhango'),('Rusebeya')
) AS v(name) CROSS JOIN (SELECT id FROM location_districts WHERE name = 'Rutsiro') AS d;

-- ── Cells: 4 per sector ──────────────────────────────────────
-- Uses fixed Kinyarwanda names (unique within each sector).
-- Admins can rename via the location management UI.

DO $$
DECLARE
    sec       RECORD;
    cell_list TEXT[] := ARRAY['Akabeza','Amahoro','Inzira','Urugwiro'];
    cname     TEXT;
BEGIN
    FOR sec IN SELECT id FROM location_sectors ORDER BY id LOOP
        FOREACH cname IN ARRAY cell_list LOOP
            INSERT INTO location_cells (name, sector_id) VALUES (cname, sec.id);
        END LOOP;
    END LOOP;
END $$;

-- ── Villages: 3 per cell ─────────────────────────────────────

DO $$
DECLARE
    cel         RECORD;
    village_list TEXT[] := ARRAY['Akabeza','Amahoro','Inzira'];
    vname       TEXT;
BEGIN
    FOR cel IN SELECT id FROM location_cells ORDER BY id LOOP
        FOREACH vname IN ARRAY village_list LOOP
            INSERT INTO location_villages (name, cell_id) VALUES (vname, cel.id);
        END LOOP;
    END LOOP;
END $$;
