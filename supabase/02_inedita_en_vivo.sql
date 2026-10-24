-- =====================================================
-- INÉDITA EN VIVO · Contrataciones para eventos · versión 1
-- Pegar DESPUÉS de 01_base_de_datos.sql
-- Supabase > SQL Editor > New query > pegar > "Run"
-- =====================================================

-- ---------- 1. NUEVO TIPO DE PERFIL: ORGANIZADOR ----------
alter table public.perfiles
  add column if not exists es_organizador boolean not null default false;

-- Sonidistas: ofrecen sonido e iluminación para eventos
alter table public.perfiles
  add column if not exists es_sonidista boolean not null default false;

-- ---------- 2. PROPUESTAS DE LOS ARTISTAS ----------
create table public.propuestas_vivo (
  id uuid primary key default gen_random_uuid(),
  artista_id uuid not null references public.perfiles(id) on delete cascade,
  -- 'artista' = banda o solista; 'sonido' = sonidista / alquiler de sonido e iluminación
  tipo text not null default 'artista' check (tipo in ('artista','sonido')),
  nombre_artistico text not null,
  incluye_sonido boolean not null default false,  -- la banda lleva su propio equipo
  equipamiento text,                              -- para sonidistas: consola, parlantes, luces...
  capacidad_personas int check (capacidad_personas > 0),
  incluye_iluminacion boolean not null default false,
  formacion text check (formacion in ('solista','duo','trio','grupo','orquesta')),
  integrantes int check (integrantes > 0),
  descripcion text,
  provincias text[] not null default '{}',   -- zonas donde toca
  tipos_evento text[] not null default '{}', -- evento privado, peña, bar, casamiento, cumpleaños, festival, empresa...
  duracion_minutos int check (duracion_minutos > 0),
  precio_desde numeric(12,2) check (precio_desde >= 0),
  videos text[] not null default '{}',       -- links de YouTube, Instagram, etc.
  fotos text[] not null default '{}',        -- rutas en el almacenamiento "vivo"
  audios text[] not null default '{}',       -- rutas en el almacenamiento "vivo"
  activa boolean not null default true,
  destacada boolean not null default false,
  creado_en timestamptz not null default now()
);

create index on public.propuestas_vivo (artista_id);
create index on public.propuestas_vivo (tipo);

-- Géneros que toca cada artista (puede ser más de uno: chacarera doble, zamba, cuarteto…)
create table public.propuesta_generos (
  propuesta_id uuid not null references public.propuestas_vivo(id) on delete cascade,
  genero_id text not null references public.generos(id),
  primary key (propuesta_id, genero_id)
);

create index on public.propuesta_generos (genero_id);

-- Solo el administrador puede destacar propuestas
create or replace function public.proteger_propuesta()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not public.es_admin() then
    if tg_op = 'INSERT' then
      new.destacada := false;
    else
      new.destacada := old.destacada;
      new.artista_id := old.artista_id;
    end if;
  end if;
  return new;
end; $$;

create trigger antes_de_guardar_propuesta
  before insert or update on public.propuestas_vivo
  for each row execute function public.proteger_propuesta();

-- ---------- 3. PEDIDOS DE PRESUPUESTO ----------
-- Recorrido: pendiente -> presupuestado -> aceptada -> realizada
--            (o rechazada / cancelada en el camino)
create table public.solicitudes_vivo (
  id uuid primary key default gen_random_uuid(),
  propuesta_id uuid not null references public.propuestas_vivo(id) on delete cascade,
  organizador_id uuid not null references public.perfiles(id) on delete cascade,
  artista_id uuid not null references public.perfiles(id) on delete cascade,
  fecha_evento date not null,
  hora text,
  provincia text,
  localidad text,
  tipo_evento text,
  evento_privado boolean not null default false,
  necesita_sonido boolean not null default false,
  duracion_minutos int,
  mensaje text,
  estado text not null default 'pendiente'
    check (estado in ('pendiente','presupuestado','aceptada','rechazada','cancelada','realizada')),
  monto numeric(12,2) check (monto >= 0),
  respuesta text,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

create index on public.solicitudes_vivo (artista_id);
create index on public.solicitudes_vivo (organizador_id);

create or replace function public.controlar_solicitud()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  activa_prop boolean;
begin
  if tg_op = 'INSERT' then
    select artista_id, activa into new.artista_id, activa_prop
      from public.propuestas_vivo where id = new.propuesta_id;
    if activa_prop is distinct from true then
      raise exception 'Esta propuesta no está disponible';
    end if;
    if new.artista_id = new.organizador_id then
      raise exception 'No podés pedirte presupuesto a vos mismo';
    end if;
    if new.fecha_evento < current_date then
      raise exception 'La fecha del evento ya pasó';
    end if;
    new.estado := 'pendiente';
    new.monto := null;
    new.respuesta := null;
    return new;
  end if;

  if auth.uid() is not null and not public.es_admin() then
    -- Datos fijos
    new.propuesta_id := old.propuesta_id;
    new.organizador_id := old.organizador_id;
    new.artista_id := old.artista_id;
    new.creado_en := old.creado_en;

    if auth.uid() = old.artista_id then
      -- El artista presupuesta o rechaza; no cambia los datos del evento
      new.fecha_evento := old.fecha_evento; new.hora := old.hora;
      new.provincia := old.provincia; new.localidad := old.localidad;
      new.tipo_evento := old.tipo_evento; new.duracion_minutos := old.duracion_minutos;
      new.evento_privado := old.evento_privado; new.necesita_sonido := old.necesita_sonido;
      new.mensaje := old.mensaje;
      if new.estado <> old.estado and not (
           (old.estado = 'pendiente' and new.estado in ('presupuestado','rechazada'))
        or (old.estado = 'presupuestado' and new.estado = 'rechazada')
        or (old.estado = 'aceptada' and new.estado = 'cancelada')
      ) then
        raise exception 'Cambio de estado no permitido';
      end if;
      if new.estado = 'presupuestado' and new.monto is null then
        raise exception 'Indicá el monto del presupuesto';
      end if;
      if old.estado not in ('pendiente','presupuestado') then
        new.monto := old.monto;
      end if;

    elsif auth.uid() = old.organizador_id then
      -- El organizador acepta, cancela o marca como realizada; no toca el monto
      new.monto := old.monto;
      new.respuesta := old.respuesta;
      if new.estado <> old.estado and not (
           (old.estado = 'presupuestado' and new.estado = 'aceptada')
        or (old.estado in ('pendiente','presupuestado','aceptada') and new.estado = 'cancelada')
        or (old.estado = 'aceptada' and new.estado = 'realizada' and old.fecha_evento <= current_date)
      ) then
        raise exception 'Cambio de estado no permitido';
      end if;
      if old.estado <> 'pendiente' then
        new.fecha_evento := old.fecha_evento; new.hora := old.hora;
        new.provincia := old.provincia; new.localidad := old.localidad;
        new.tipo_evento := old.tipo_evento; new.duracion_minutos := old.duracion_minutos;
        new.evento_privado := old.evento_privado; new.necesita_sonido := old.necesita_sonido;
      end if;
    end if;
  end if;

  new.actualizado_en := now();
  return new;
end; $$;

create trigger antes_de_guardar_solicitud
  before insert or update on public.solicitudes_vivo
  for each row execute function public.controlar_solicitud();

-- ---------- 4. RESEÑAS (solo después de un show realizado) ----------
create table public.resenas_vivo (
  solicitud_id uuid primary key references public.solicitudes_vivo(id) on delete cascade,
  organizador_id uuid not null references public.perfiles(id) on delete cascade,
  artista_id uuid not null references public.perfiles(id) on delete cascade,
  puntaje int not null check (puntaje between 1 and 5),
  comentario text,
  creado_en timestamptz not null default now()
);

create index on public.resenas_vivo (artista_id);

create or replace function public.controlar_resena()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  s record;
begin
  select * into s from public.solicitudes_vivo where id = new.solicitud_id;
  if s.estado is distinct from 'realizada' then
    raise exception 'Solo se puede reseñar un show realizado';
  end if;
  if auth.uid() is not null and auth.uid() <> s.organizador_id then
    raise exception 'Solo reseña el organizador que contrató';
  end if;
  new.organizador_id := s.organizador_id;
  new.artista_id := s.artista_id;
  return new;
end; $$;

create trigger antes_de_resenar
  before insert on public.resenas_vivo
  for each row execute function public.controlar_resena();

-- ---------- 5. ESTADÍSTICAS DEL ARTISTA EN VIVO ----------
create view public.estadisticas_vivo as
select
  p.id as artista_id,
  (select count(*) from public.solicitudes_vivo s
     where s.artista_id = p.id and s.estado = 'realizada') as shows_realizados,
  (select count(*) from public.resenas_vivo r where r.artista_id = p.id) as resenas,
  (select round(avg(puntaje), 1) from public.resenas_vivo r where r.artista_id = p.id) as promedio
from public.perfiles p
where p.es_artista or p.es_sonidista;

revoke all on public.estadisticas_vivo from anon;
grant select on public.estadisticas_vivo to authenticated;

-- ---------- 6. SEGURIDAD ----------
alter table public.propuestas_vivo  enable row level security;
alter table public.solicitudes_vivo enable row level security;
alter table public.resenas_vivo     enable row level security;
alter table public.propuesta_generos enable row level security;

-- Géneros de cada propuesta: todos los ven; los carga el dueño de la propuesta
create policy "ver generos de propuestas" on public.propuesta_generos
  for select to authenticated using (true);
create policy "gestionar generos de mi propuesta" on public.propuesta_generos
  for all to authenticated
  using (exists (select 1 from public.propuestas_vivo p
                 where p.id = propuesta_id and (p.artista_id = auth.uid() or public.es_admin())))
  with check (exists (select 1 from public.propuestas_vivo p
                      where p.id = propuesta_id and (p.artista_id = auth.uid() or public.es_admin())));

-- Propuestas: todos ven las activas; cada artista gestiona las suyas
create policy "ver propuestas" on public.propuestas_vivo
  for select to authenticated
  using (activa or artista_id = auth.uid() or public.es_admin());
create policy "crear mi propuesta" on public.propuestas_vivo
  for insert to authenticated with check (artista_id = auth.uid());
create policy "editar mi propuesta" on public.propuestas_vivo
  for update to authenticated
  using (artista_id = auth.uid() or public.es_admin())
  with check (artista_id = auth.uid() or public.es_admin());
create policy "borrar mi propuesta" on public.propuestas_vivo
  for delete to authenticated
  using (artista_id = auth.uid() or public.es_admin());

-- Solicitudes: solo las ven las dos partes (y el administrador)
create policy "ver mis solicitudes" on public.solicitudes_vivo
  for select to authenticated
  using (organizador_id = auth.uid() or artista_id = auth.uid() or public.es_admin());
create policy "pedir presupuesto" on public.solicitudes_vivo
  for insert to authenticated with check (organizador_id = auth.uid());
create policy "gestionar mis solicitudes" on public.solicitudes_vivo
  for update to authenticated
  using (organizador_id = auth.uid() or artista_id = auth.uid() or public.es_admin())
  with check (organizador_id = auth.uid() or artista_id = auth.uid() or public.es_admin());

-- Reseñas: públicas para los usuarios; las escribe el organizador
create policy "ver resenas" on public.resenas_vivo
  for select to authenticated using (true);
create policy "resenar lo que contraté" on public.resenas_vivo
  for insert to authenticated with check (organizador_id = auth.uid());

-- ---------- 7. ARCHIVOS DE INÉDITA EN VIVO ----------
-- Fotos y audios de presentación: los ven todos los usuarios registrados
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('vivo', 'vivo', false, 26214400,
    array['image/jpeg','image/png','image/webp',
          'audio/mpeg','audio/mp4','audio/x-m4a','audio/m4a','audio/wav','audio/x-wav',
          'audio/aac','audio/ogg','audio/webm']);

create policy "subir archivos vivo" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'vivo' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "reemplazar archivos vivo" on storage.objects
  for update to authenticated
  using (bucket_id = 'vivo' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "borrar archivos vivo" on storage.objects
  for delete to authenticated
  using (bucket_id = 'vivo' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "ver archivos vivo" on storage.objects
  for select to authenticated
  using (bucket_id = 'vivo');

-- Fin
