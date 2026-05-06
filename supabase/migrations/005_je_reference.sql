CREATE OR REPLACE FUNCTION generate_je_reference()
RETURNS text AS $$
DECLARE
  current_year text := to_char(NOW(), 'YYYY');
  next_seq int;
  ref text;
BEGIN
  SELECT COALESCE(MAX(
    CAST(SPLIT_PART(reference, '-', 3) AS integer)
  ), 0) + 1
  INTO next_seq
  FROM journal_entries
  WHERE reference LIKE 'JE-' || current_year || '-%'
    AND is_system_generated = false;

  ref := 'JE-' || current_year || '-' || LPAD(next_seq::text, 3, '0');
  RETURN ref;
END;
$$ LANGUAGE plpgsql;
