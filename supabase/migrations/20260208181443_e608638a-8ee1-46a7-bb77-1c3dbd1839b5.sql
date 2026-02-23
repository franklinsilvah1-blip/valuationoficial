-- 1. Renomear roi2025 -> roi2026 (libera o nome roi2025)
ALTER TABLE public.asset_analyses RENAME COLUMN roi2025 TO roi2026;
-- 2. Renomear dy2025 -> roi2025 (usa o nome liberado; libera dy2025)
ALTER TABLE public.asset_analyses RENAME COLUMN dy2025 TO roi2025;
-- 3. Renomear dy2024 -> dy2025 (usa o nome liberado)
ALTER TABLE public.asset_analyses RENAME COLUMN dy2024 TO dy2025;