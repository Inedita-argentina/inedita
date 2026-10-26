-- =====================================================
-- INÉDITA · Fragmento destacado
-- El autor elige desde qué segundo se escucha la vista previa
-- de su canción y si dura 30 o 40 segundos.
-- Pegar en Supabase > SQL Editor > New query > "Run"
-- =====================================================

alter table public.canciones
  add column if not exists fragmento_inicio int not null default 0,
  add column if not exists fragmento_duracion int not null default 30;

alter table public.canciones drop constraint if exists fragmento_valido;
alter table public.canciones
  add constraint fragmento_valido
  check (fragmento_inicio >= 0 and fragmento_duracion in (30, 40));

-- Para que cualquiera con cuenta pueda escuchar el fragmento, la app
-- necesita leer el audio. La app corta la reproducción al terminar el fragmento.
-- (Versión prototipo: más adelante conviene guardar el fragmento como un
-- archivo aparte, para que el audio completo quede protegido de verdad.)
drop policy if exists "escuchar audios y ver partituras" on storage.objects;
drop policy if exists "escuchar audios" on storage.objects;
drop policy if exists "ver partituras" on storage.objects;

create policy "escuchar audios" on storage.objects
  for select to authenticated
  using (bucket_id = 'audios');

create policy "ver partituras" on storage.objects
  for select to authenticated
  using (bucket_id = 'partituras'
         and ((storage.foldername(name))[1] = auth.uid()::text or public.tiene_acceso()));

-- Fin
