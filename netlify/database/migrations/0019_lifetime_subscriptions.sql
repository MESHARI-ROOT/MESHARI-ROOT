-- NULL expiry represents a lifetime subscription. Existing dates remain unchanged.
ALTER TABLE zen_clients ALTER COLUMN expires_at DROP NOT NULL;
