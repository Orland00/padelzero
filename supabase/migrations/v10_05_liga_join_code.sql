-- ═══════════════════════════════════════════════════════════
-- PadelZero — V10-05 LIGA JOIN CODES
-- Shareable invite links for ligas
-- ═══════════════════════════════════════════════════════════

ALTER TABLE ligas ADD COLUMN IF NOT EXISTS join_code TEXT UNIQUE;

-- Auto-generate join_code on insert
CREATE OR REPLACE FUNCTION generate_liga_join_code()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.join_code IS NULL THEN
    NEW.join_code := substring(md5(random()::text || clock_timestamp()::text) from 1 for 6);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_liga_join_code ON ligas;
CREATE TRIGGER set_liga_join_code
  BEFORE INSERT ON ligas
  FOR EACH ROW EXECUTE FUNCTION generate_liga_join_code();

-- Backfill existing ligas
UPDATE ligas SET join_code = substring(md5(random()::text || id::text) from 1 for 6) WHERE join_code IS NULL;
