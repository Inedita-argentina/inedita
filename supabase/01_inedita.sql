-- =====================================================
-- INÉDITA · Base de datos · versión 1
-- Pegar completo en Supabase > SQL Editor y tocar "Run"
-- =====================================================

-- ---------- 1. PERFILES ----------
create table public.perfiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nombre text not null default '',
  es_compositor boolean not null default false,
  es_artista boolean not null default false,
  es_admin boolean not null default false,
  provincia text,
  localidad text,
  bio text,
  foto_path text,
  cuota_vence date,
  creado_en timestamptz not null default now()
);

-- ¿El usuario actual es administrador?
create or replace function public.es_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select es_admin from public.perfiles where id = auth.uid()), false);
$$;

-- ¿El usuario actual puede escuchar el catálogo? (admin o cuota al día)
create or replace function public.tiene_acceso()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((
    select es_admin or (cuota_vence is not null and cuota_vence >= current_date)
    from public.perfiles where id = auth.uid()
  ), false);
$$;

-- Crear el perfil automáticamente cuando alguien se registra
create or replace function public.crear_perfil()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.perfiles (id, nombre)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'nombre',
             new.raw_user_meta_data->>'full_name',
             split_part(new.email, '@', 1))
  );
  return new;
end; $$;

create trigger al_crear_usuario
  after insert on auth.users
  for each row execute function public.crear_perfil();

-- Solo el administrador puede cambiar "es_admin" y el vencimiento de la cuota
create or replace function public.proteger_perfil()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not public.es_admin() then
    new.es_admin := old.es_admin;
    new.cuota_vence := old.cuota_vence;
  end if;
  return new;
end; $$;

create trigger antes_de_editar_perfil
  before update on public.perfiles
  for each row execute function public.proteger_perfil();

-- ---------- 1b. GÉNEROS Y SUBGÉNEROS (árbol) ----------
-- Cada género puede tener subgéneros, y esos a su vez otros:
-- Folklore > Zamba > Zamba carpera. La lista la edita el administrador.
create table public.generos (
  id text primary key,                 -- identificador corto: 'zamba-carpera'
  nombre text not null,                -- lo que ve el usuario: 'Zamba carpera'
  padre_id text references public.generos(id) on delete restrict,
  orden int not null default 0,
  activo boolean not null default true
);

create index on public.generos (padre_id);

insert into public.generos (id, nombre, padre_id, orden) values
  -- Familias principales
  ('folklore', 'Folklore', null, 1),
  ('tango', 'Tango', null, 2),
  ('cuarteto', 'Cuarteto', null, 3),
  ('cumbia', 'Cumbia', null, 4),
  ('otros', 'Otros géneros', null, 9),

  -- Folklore
  ('zamba', 'Zamba', 'folklore', 1),
    ('zamba-lenta', 'Zamba lenta', 'zamba', 1),
    ('zamba-carpera', 'Zamba carpera', 'zamba', 2),
    ('zamba-cueca', 'Zamba cueca', 'zamba', 3),
    ('zamba-romantica', 'Zamba romántica', 'zamba', 4),
  ('chacarera', 'Chacarera', 'folklore', 2),
    ('chacarera-lenta', 'Chacarera lenta', 'chacarera', 1),
    ('chacarera-romantica', 'Chacarera romántica', 'chacarera', 2),
    ('chacarera-bailable', 'Chacarera bailable', 'chacarera', 3),
    ('chacarera-doble', 'Chacarera doble', 'chacarera', 4),
    ('chacarera-trunca', 'Chacarera trunca', 'chacarera', 5),
  ('chamame', 'Chamamé', 'folklore', 3),
  ('gato', 'Gato', 'folklore', 4),
  ('escondido', 'Escondido', 'folklore', 5),
  ('cueca', 'Cueca', 'folklore', 6),
  ('tonada', 'Tonada', 'folklore', 7),
  ('vidala', 'Vidala', 'folklore', 8),
  ('baguala', 'Baguala', 'folklore', 9),
  ('carnavalito', 'Carnavalito', 'folklore', 10),
  ('huayno', 'Huayno', 'folklore', 11),
  ('malambo', 'Malambo', 'folklore', 12),
  ('huella', 'Huella', 'folklore', 13),
  ('milonga-campera', 'Milonga campera', 'folklore', 14),
  ('estilo', 'Estilo', 'folklore', 15),
  ('rasguido-doble', 'Rasguido doble', 'folklore', 16),
  ('polca', 'Polca', 'folklore', 17),
  ('valseado', 'Valseado', 'folklore', 18),

  -- Tango
  ('tango-tango', 'Tango', 'tango', 1),
  ('tango-cancion', 'Tango canción', 'tango', 2),
  ('milonga', 'Milonga', 'tango', 3),
  ('vals-criollo', 'Vals criollo', 'tango', 4),
  ('tango-electronico', 'Tango electrónico', 'tango', 5),

  -- Cuarteto
  ('cuarteto-tradicional', 'Cuarteto tradicional', 'cuarteto', 1),
  ('cuarteto-lento', 'Cuarteto lento', 'cuarteto', 2),
  ('cuarteto-moderno', 'Cuarteto moderno', 'cuarteto', 3),
  ('cuarteto-romantico', 'Cuarteto romántico', 'cuarteto', 4),

  -- Cumbia
  ('cumbia-villera', 'Cumbia villera', 'cumbia', 1),
  ('cumbia-santafesina', 'Cumbia santafesina', 'cumbia', 2),
  ('cumbia-reggaeton', 'Cumbia reggaetón', 'cumbia', 3),
  ('cumbia-romantica', 'Cumbia romántica', 'cumbia', 4),
  ('cumbia-nortena', 'Cumbia norteña', 'cumbia', 5),
  ('cumbia-pop', 'Cumbia pop', 'cumbia', 6),

  -- Otros
  ('rock-nacional', 'Rock nacional', 'otros', 1),
  ('pop', 'Pop', 'otros', 2),
  ('balada', 'Balada', 'otros', 3),
  ('bolero', 'Bolero', 'otros', 4),
  ('murga', 'Murga', 'otros', 5),
  ('candombe', 'Candombe', 'otros', 6);

-- Vista con el recorrido completo de cada género, para buscar y filtrar:
-- ej. zamba-carpera -> raiz 'folklore', ruta 'Folklore › Zamba › Zamba carpera'
create view public.generos_arbol as
with recursive arbol as (
  select id, nombre, padre_id, orden, id as raiz_id, nombre::text as ruta,
         array[id] as camino, 1 as nivel
  from public.generos where padre_id is null and activo
  union all
  select g.id, g.nombre, g.padre_id, g.orden, a.raiz_id, a.ruta || ' › ' || g.nombre,
         a.camino || g.id, a.nivel + 1
  from public.generos g join arbol a on g.padre_id = a.id
  where g.activo
)
select * from arbol;

grant select on public.generos_arbol to authenticated, anon;

-- ---------- 2. CANCIONES ----------
create table public.canciones (
  id uuid primary key default gen_random_uuid(),
  compositor_id uuid not null references public.perfiles(id) on delete cascade,
  titulo text not null,
  genero_id text not null references public.generos(id),  -- el más específico: 'zamba-carpera'
  tonalidad text,
  voz text check (voz in ('masculina','femenina','indistinta')),
  tematica text,
  audio_path text,
  partitura_path text,
  registrada_sadaic boolean not null default false,
  numero_registro text,
  -- "Para versionar": canciones que el autor ya grabó y publicó
  ya_publicada boolean not null default false,
  para_versionar boolean not null default false,
  enlace_youtube text,
  enlace_spotify text,
  anio_publicacion int,
  estado text not null default 'disponible'
    check (estado in ('disponible','reservada','grabada','oculta')),
  grabada_por text,
  destacada boolean not null default false,
  creado_en timestamptz not null default now()
);

create index on public.canciones (compositor_id);
create index on public.canciones (genero_id);
create index on public.canciones (para_versionar);

-- Una canción ya publicada necesita al menos un enlace para escucharla completa
alter table public.canciones
  add constraint publicada_con_enlace
  check (not ya_publicada or enlace_youtube is not null or enlace_spotify is not null);

-- Solo se puede ofrecer para versionar una canción ya publicada
alter table public.canciones
  add constraint versionar_solo_publicadas
  check (not para_versionar or ya_publicada);

-- Solo el administrador puede destacar canciones
create or replace function public.proteger_cancion()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not public.es_admin() then
    if tg_op = 'INSERT' then
      new.destacada := false;
    else
      new.destacada := old.destacada;
      new.compositor_id := old.compositor_id;
    end if;
  end if;
  return new;
end; $$;

create trigger antes_de_guardar_cancion
  before insert or update on public.canciones
  for each row execute function public.proteger_cancion();

-- Letras aparte: solo las ve el compositor o quien tiene acceso
create table public.letras (
  cancion_id uuid primary key references public.canciones(id) on delete cascade,
  letra text not null
);

-- Autores y porcentajes (como en SADAIC)
create table public.autores (
  id uuid primary key default gen_random_uuid(),
  cancion_id uuid not null references public.canciones(id) on delete cascade,
  nombre text not null,
  rol text not null check (rol in ('letra','musica','letra_y_musica')),
  porcentaje numeric(5,2) check (porcentaje > 0 and porcentaje <= 100)
);

create index on public.autores (cancion_id);

-- ---------- 3. FAVORITOS ----------
create table public.favoritos (
  artista_id uuid not null references public.perfiles(id) on delete cascade,
  cancion_id uuid not null references public.canciones(id) on delete cascade,
  creado_en timestamptz not null default now(),
  primary key (artista_id, cancion_id)
);

-- ---------- 4. PEDIDOS ----------
create table public.pedidos (
  id uuid primary key default gen_random_uuid(),
  cancion_id uuid not null references public.canciones(id) on delete cascade,
  artista_id uuid not null references public.perfiles(id) on delete cascade,
  compositor_id uuid not null references public.perfiles(id) on delete cascade,
  mensaje text,
  estado text not null default 'pendiente'
    check (estado in ('pendiente','aceptado','rechazado','cancelado')),
  respuesta text,
  creado_en timestamptz not null default now(),
  respondido_en timestamptz
);

create index on public.pedidos (compositor_id);
create index on public.pedidos (artista_id);

-- Reglas de los pedidos
create or replace function public.controlar_pedido()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  estado_cancion text;
begin
  if tg_op = 'INSERT' then
    select compositor_id, estado into new.compositor_id, estado_cancion
      from public.canciones where id = new.cancion_id;
    if estado_cancion is distinct from 'disponible' then
      raise exception 'La canción no está disponible';
    end if;
    if new.compositor_id = new.artista_id then
      raise exception 'No podés pedir tu propia canción';
    end if;
    new.estado := 'pendiente';
    new.respuesta := null;
    new.respondido_en := null;
    return new;
  end if;

  -- Cambios en un pedido existente
  if auth.uid() is not null and not public.es_admin() then
    new.cancion_id := old.cancion_id;
    new.artista_id := old.artista_id;
    new.compositor_id := old.compositor_id;
    new.creado_en := old.creado_en;
    if auth.uid() = old.compositor_id then
      new.mensaje := old.mensaje;
      if new.estado <> old.estado
         and not (old.estado = 'pendiente' and new.estado in ('aceptado','rechazado')) then
        raise exception 'Cambio de estado no permitido';
      end if;
    elsif auth.uid() = old.artista_id then
      new.respuesta := old.respuesta;
      if new.estado <> old.estado
         and not (old.estado = 'pendiente' and new.estado = 'cancelado') then
        raise exception 'Cambio de estado no permitido';
      end if;
    end if;
  end if;

  if new.estado <> old.estado and new.estado in ('aceptado','rechazado') then
    new.respondido_en := now();
  end if;
  return new;
end; $$;

create trigger antes_de_guardar_pedido
  before insert or update on public.pedidos
  for each row execute function public.controlar_pedido();

-- Si el compositor acepta, una canción inédita pasa a "reservada".
-- Las de "Para versionar" siguen disponibles: varios artistas pueden grabarlas.
create or replace function public.al_aceptar_pedido()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.estado = 'aceptado' and old.estado <> 'aceptado' then
    update public.canciones set estado = 'reservada'
      where id = new.cancion_id and estado = 'disponible' and not ya_publicada;
  end if;
  return new;
end; $$;

create trigger despues_de_aceptar_pedido
  after update on public.pedidos
  for each row execute function public.al_aceptar_pedido();

-- ---------- 4b. CALIFICACIONES (solo quien compró la canción) ----------
create table public.calificaciones (
  pedido_id uuid primary key references public.pedidos(id) on delete cascade,
  artista_id uuid not null references public.perfiles(id) on delete cascade,
  compositor_id uuid not null references public.perfiles(id) on delete cascade,
  puntaje int not null check (puntaje between 1 and 5),
  comentario text,
  creado_en timestamptz not null default now()
);

create index on public.calificaciones (compositor_id);

create or replace function public.controlar_calificacion()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  p record;
begin
  select * into p from public.pedidos where id = new.pedido_id;
  if p.estado is distinct from 'aceptado' then
    raise exception 'Solo se puede calificar una canción comprada';
  end if;
  if auth.uid() is not null and auth.uid() <> p.artista_id then
    raise exception 'Solo califica el artista que compró la canción';
  end if;
  new.artista_id := p.artista_id;
  new.compositor_id := p.compositor_id;
  return new;
end; $$;

create trigger antes_de_calificar
  before insert on public.calificaciones
  for each row execute function public.controlar_calificacion();

-- ---------- 4c. INSIGNIAS (las otorga el administrador) ----------
create table public.insignias (
  id uuid primary key default gen_random_uuid(),
  perfil_id uuid not null references public.perfiles(id) on delete cascade,
  nombre text not null,          -- ej.: 'Compositor destacado', 'Tema grabado por ...'
  detalle text,
  otorgada_en timestamptz not null default now()
);

create index on public.insignias (perfil_id);

-- ---------- 5. ESTADÍSTICAS (señales positivas) ----------
create view public.estadisticas_compositor as
select
  p.id as compositor_id,
  count(distinct c.id) filter (where c.estado <> 'oculta') as canciones,
  count(distinct f.artista_id::text || f.cancion_id::text) as favoritos,
  count(distinct pe.id) as pedidos,
  count(distinct c.id) filter (where c.estado = 'grabada') as grabadas,
  (select count(*) from public.calificaciones ca where ca.compositor_id = p.id) as calificaciones,
  (select round(avg(puntaje), 1) from public.calificaciones ca where ca.compositor_id = p.id) as promedio
from public.perfiles p
left join public.canciones c on c.compositor_id = p.id
left join public.favoritos f on f.cancion_id = c.id
left join public.pedidos pe on pe.cancion_id = c.id
where p.es_compositor
group by p.id;

create view public.estadisticas_cancion as
select
  c.id as cancion_id,
  (select count(*) from public.favoritos f where f.cancion_id = c.id) as favoritos,
  (select count(*) from public.pedidos pe where pe.cancion_id = c.id) as pedidos
from public.canciones c
where c.estado <> 'oculta';

revoke all on public.estadisticas_compositor from anon;
revoke all on public.estadisticas_cancion from anon;
grant select on public.estadisticas_compositor to authenticated;
grant select on public.estadisticas_cancion to authenticated;

-- ---------- 6. SEGURIDAD: quién ve y edita qué ----------
alter table public.generos   enable row level security;

-- Géneros: todos los ven; solo el administrador los edita
create policy "ver generos" on public.generos
  for select to authenticated, anon using (true);
create policy "editar generos" on public.generos
  for all to authenticated
  using (public.es_admin()) with check (public.es_admin());

alter table public.perfiles  enable row level security;
alter table public.canciones enable row level security;
alter table public.letras    enable row level security;
alter table public.autores   enable row level security;
alter table public.favoritos enable row level security;
alter table public.pedidos   enable row level security;
alter table public.calificaciones enable row level security;
alter table public.insignias enable row level security;

-- Insignias: todos las ven, solo el administrador las otorga o quita
create policy "ver insignias" on public.insignias
  for select to authenticated using (true);
create policy "otorgar insignias" on public.insignias
  for all to authenticated
  using (public.es_admin()) with check (public.es_admin());

-- Calificaciones
create policy "ver calificaciones" on public.calificaciones
  for select to authenticated using (true);
create policy "calificar lo que compré" on public.calificaciones
  for insert to authenticated with check (artista_id = auth.uid());

-- Perfiles
create policy "ver perfiles" on public.perfiles
  for select to authenticated using (true);
create policy "editar mi perfil" on public.perfiles
  for update to authenticated
  using (id = auth.uid() or public.es_admin())
  with check (id = auth.uid() or public.es_admin());

-- Canciones
create policy "ver canciones" on public.canciones
  for select to authenticated
  using (estado <> 'oculta' or compositor_id = auth.uid() or public.es_admin());
create policy "subir mis canciones" on public.canciones
  for insert to authenticated with check (compositor_id = auth.uid());
create policy "editar mis canciones" on public.canciones
  for update to authenticated
  using (compositor_id = auth.uid() or public.es_admin())
  with check (compositor_id = auth.uid() or public.es_admin());
create policy "borrar mis canciones" on public.canciones
  for delete to authenticated
  using (compositor_id = auth.uid() or public.es_admin());

-- Letras
create policy "ver letras" on public.letras
  for select to authenticated using (
    exists (select 1 from public.canciones c
            where c.id = cancion_id
              and (c.compositor_id = auth.uid() or public.tiene_acceso())));
create policy "gestionar mis letras" on public.letras
  for all to authenticated
  using (exists (select 1 from public.canciones c
                 where c.id = cancion_id
                   and (c.compositor_id = auth.uid() or public.es_admin())))
  with check (exists (select 1 from public.canciones c
                      where c.id = cancion_id
                        and (c.compositor_id = auth.uid() or public.es_admin())));

-- Autores
create policy "ver autores" on public.autores
  for select to authenticated using (true);
create policy "gestionar autores de mis canciones" on public.autores
  for all to authenticated
  using (exists (select 1 from public.canciones c
                 where c.id = cancion_id
                   and (c.compositor_id = auth.uid() or public.es_admin())))
  with check (exists (select 1 from public.canciones c
                      where c.id = cancion_id
                        and (c.compositor_id = auth.uid() or public.es_admin())));

-- Favoritos
create policy "mis favoritos" on public.favoritos
  for all to authenticated
  using (artista_id = auth.uid())
  with check (artista_id = auth.uid());

-- Pedidos
create policy "ver mis pedidos" on public.pedidos
  for select to authenticated
  using (artista_id = auth.uid() or compositor_id = auth.uid() or public.es_admin());
create policy "hacer pedidos" on public.pedidos
  for insert to authenticated
  with check (artista_id = auth.uid() and public.tiene_acceso());
create policy "responder o cancelar pedidos" on public.pedidos
  for update to authenticated
  using (artista_id = auth.uid() or compositor_id = auth.uid() or public.es_admin())
  with check (artista_id = auth.uid() or compositor_id = auth.uid() or public.es_admin());

-- ---------- 7. ARCHIVOS (audios, partituras, fotos) ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('audios', 'audios', false, 26214400,
    array['audio/mpeg','audio/mp4','audio/x-m4a','audio/m4a','audio/wav','audio/x-wav',
          'audio/aac','audio/ogg','audio/webm']),
  ('partituras', 'partituras', false, 10485760,
    array['application/pdf','image/jpeg','image/png']),
  ('fotos', 'fotos', true, 5242880,
    array['image/jpeg','image/png','image/webp']);

-- Cada usuario sube archivos solo dentro de su propia carpeta
create policy "subir mis archivos" on storage.objects
  for insert to authenticated
  with check (bucket_id in ('audios','partituras','fotos')
              and (storage.foldername(name))[1] = auth.uid()::text);
create policy "reemplazar mis archivos" on storage.objects
  for update to authenticated
  using (bucket_id in ('audios','partituras','fotos')
         and (storage.foldername(name))[1] = auth.uid()::text);
create policy "borrar mis archivos" on storage.objects
  for delete to authenticated
  using (bucket_id in ('audios','partituras','fotos')
         and (storage.foldername(name))[1] = auth.uid()::text);

-- Escuchar audios y ver partituras: el dueño, o quien tiene la cuota al día
create policy "escuchar audios y ver partituras" on storage.objects
  for select to authenticated
  using (bucket_id in ('audios','partituras')
         and ((storage.foldername(name))[1] = auth.uid()::text or public.tiene_acceso()));

-- Fin
