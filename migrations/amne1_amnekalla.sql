-- ÄMNE-1 (K4): logga ämneskällan per textgenerering, så drift går att granska i
-- efterhand utan att gissa. "inlaggstext" | "bild" | "amnesfalt" | "tomt" — se
-- lib/content/amneskalla.ts. Additiv, ingen befintlig rad påverkas.
ALTER TABLE generation_log ADD COLUMN IF NOT EXISTS amne_kalla text;

NOTIFY pgrst, 'reload schema';
