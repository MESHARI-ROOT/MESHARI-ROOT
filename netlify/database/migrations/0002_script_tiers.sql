-- Existing private scripts remain paid and protected.
ALTER TABLE zen_scripts ADD COLUMN access_tier varchar(4) NOT NULL DEFAULT 'paid' CHECK (access_tier IN ('free','paid'));
ALTER TABLE zen_scripts ADD COLUMN price_halalas integer NOT NULL DEFAULT 0 CHECK (price_halalas BETWEEN 0 AND 100000000);
ALTER TABLE zen_scripts ADD CONSTRAINT zen_free_price CHECK (access_tier <> 'free' OR price_halalas = 0);
CREATE INDEX zen_scripts_catalog ON zen_scripts(published,access_tier,updated_at DESC);
