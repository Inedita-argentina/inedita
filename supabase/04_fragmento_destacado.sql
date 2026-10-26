-- =====================================================
-- INÉDITA · Fragmento destacado
-- El autor arma la vista previa de su canción con una o dos partes
-- (en total, hasta 40 segundos).
-- Si ya lo corriste antes, no pasa nada: se puede correr de nuevo.
-- Pegar en Supabase > SQL Editor > New query > "Run"
-- =====================================================

alter table public.canciones
  add column if not exists fragmento_inicio int not null default 0,
  add column if not exists fragmento_duracion int not null default 30,
  add column if not exists fragmento2_inicio int,
  add column if not exists fragmento2_duracion int;

-- Una o dos partes; entre las dos, hasta 40 segundos
alter table public.canciones drop constraint if exists fragmento_valido;
alter table public.canciones
  add constraint fragmento_valido
  check (
    fragmento_inicio >= 0
    and fragmento_duracion between 5 and 40
    and ((fragmento2_inicio is null and fragmento2_duracion is null)
         or (fragmento2_inicio >= 0 and fragmento2_duracion between 5 and 40
             and fragmento_duracion + fragmento2_duracion <= 40))
  );

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
