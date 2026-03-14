DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typname = 'AssetStatus'
      AND e.enumlabel = 'PURGED'
  ) THEN
    ALTER TYPE "AssetStatus" ADD VALUE 'PURGED';
  END IF;
END $$;
