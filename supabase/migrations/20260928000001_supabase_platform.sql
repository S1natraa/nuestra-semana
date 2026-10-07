-- =====================================================================
-- Nuestra Semana · piezas específicas de la plataforma Supabase
-- (Realtime y Storage). No se ejecuta en el modo demo.
-- =====================================================================

-- Realtime: cada cambio relevante incrementa couples.revision, así que basta
-- con escuchar esa fila para que la pareja vea los cambios al instante.
-- RLS se respeta: solo los miembros reciben los eventos de su pareja.
alter publication supabase_realtime add table public.couples;

-- Storage: fotos de perfil. Cada persona solo escribe dentro de su carpeta
-- avatars/<user_id>/...; la lectura es pública para poder mostrar la imagen.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "avatars: lectura" on storage.objects
  for select using (bucket_id = 'avatars');

create policy "avatars: subir en tu carpeta" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "avatars: reemplazar en tu carpeta" on storage.objects
  for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "avatars: borrar en tu carpeta" on storage.objects
  for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
