-- Normalize city/country data to fix duplicates like Mexico City/Mexico City, México/Mexico
-- Also adds a trigger to normalize on future writes

-- 1. Fix existing country data
UPDATE profiles SET country = 'México' WHERE lower(country) IN ('mexico', 'méxico', 'mx');
UPDATE profiles SET country = 'España' WHERE lower(country) IN ('spain', 'españa', 'es');
UPDATE profiles SET country = 'Estados Unidos' WHERE lower(country) IN ('united states', 'usa', 'us', 'estados unidos');
UPDATE profiles SET country = 'Colombia' WHERE lower(country) IN ('colombia', 'co');
UPDATE profiles SET country = 'Argentina' WHERE lower(country) IN ('argentina', 'ar');
UPDATE profiles SET country = 'Perú' WHERE lower(country) IN ('peru', 'perú', 'pe');
UPDATE profiles SET country = 'Chile' WHERE lower(country) IN ('chile', 'cl');
UPDATE profiles SET country = 'Panamá' WHERE lower(country) IN ('panama', 'panamá', 'pa');

-- 2. Fix existing city data: Title Case normalization
-- This converts "mexico_city" → "Mexico City", "MEXICO CITY" → "Mexico City", preserves accents
UPDATE profiles SET city = initcap(lower(trim(city))) WHERE city IS NOT NULL;

-- 3. Merge "Mexico City" → "Mexico City" (the canonical Spanish form)
UPDATE profiles SET city = 'Mexico City' WHERE lower(city) = 'mexico_city';

-- 4. Other common cities that might have accent issues
UPDATE profiles SET city = 'Ciudad de México' WHERE lower(city) IN ('cdmx', 'ciudad de mexico', 'ciudad de méxico', 'mexico city');
UPDATE profiles SET city = 'Cancún' WHERE lower(city) IN ('cancun', 'cancún');
UPDATE profiles SET city = 'San José' WHERE lower(city) IN ('san jose', 'san josé');
UPDATE profiles SET city = 'Bogotá' WHERE lower(city) IN ('bogota', 'bogotá');
UPDATE profiles SET city = 'Medellín' WHERE lower(city) IN ('medellin', 'medellín');
UPDATE profiles SET city = 'Panamá' WHERE lower(city) = 'panama' AND lower(country) = 'panamá';

-- 5. Create trigger to normalize city/country on future inserts/updates
CREATE OR REPLACE FUNCTION normalize_profile_location()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Normalize city: trim + Title Case
  IF NEW.city IS NOT NULL THEN
    NEW.city := initcap(lower(trim(NEW.city)));
    -- Fix known accent variants
    IF lower(NEW.city) = 'mexico_city' THEN NEW.city := 'Mexico City'; END IF;
    IF lower(NEW.city) IN ('cdmx', 'ciudad de mexico') THEN NEW.city := 'Ciudad de México'; END IF;
    IF lower(NEW.city) = 'cancun' THEN NEW.city := 'Cancún'; END IF;
    IF lower(NEW.city) = 'bogota' THEN NEW.city := 'Bogotá'; END IF;
    IF lower(NEW.city) = 'medellin' THEN NEW.city := 'Medellín'; END IF;
  END IF;

  -- Normalize country
  IF NEW.country IS NOT NULL THEN
    CASE lower(trim(NEW.country))
      WHEN 'mexico', 'méxico', 'mx' THEN NEW.country := 'México';
      WHEN 'spain', 'españa', 'es' THEN NEW.country := 'España';
      WHEN 'united states', 'usa', 'us', 'estados unidos' THEN NEW.country := 'Estados Unidos';
      WHEN 'colombia', 'co' THEN NEW.country := 'Colombia';
      WHEN 'argentina', 'ar' THEN NEW.country := 'Argentina';
      WHEN 'peru', 'perú', 'pe' THEN NEW.country := 'Perú';
      WHEN 'chile', 'cl' THEN NEW.country := 'Chile';
      WHEN 'panama', 'panamá', 'pa' THEN NEW.country := 'Panamá';
      ELSE NEW.country := trim(NEW.country);
    END CASE;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_normalize_profile_location ON profiles;
CREATE TRIGGER trg_normalize_profile_location
  BEFORE INSERT OR UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION normalize_profile_location();

NOTIFY pgrst, 'reload schema';
