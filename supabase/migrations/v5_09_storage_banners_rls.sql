-- v5_09_storage_banners_rls.sql
-- Este script permite que cualquier usuario (incluso anónimos) pueda listar el contenido del bucket 'banners'.
-- Esto arreglará el problema donde salen de fallback "Tu Anuncio Aquí".

-- Asegurarnos de que el bucket existe y es público
INSERT INTO storage.buckets (id, name, public) 
VALUES ('banners', 'banners', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Crear política para permitir SELECT (lectura y listado) a cualquiera
CREATE POLICY "Allow public read access to banners"
ON storage.objects FOR SELECT
USING (bucket_id = 'banners');
