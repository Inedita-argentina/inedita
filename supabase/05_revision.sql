-- =====================================================
-- INÉDITA · Revisión de lo que se publica
-- - Canciones y propuestas en vivo nuevas quedan "En revisión"
--   hasta que el administrador las aprueba.
-- - Autor verificado: lo suyo se publica directo. Se gana solo
--   con 2 aprobaciones, y el administrador también lo da o lo saca.
-- - Reportes: con 3 reportes de personas distintas, vuelve a revisión.
-- - Todo lo que ya estaba subido pasa a "En revisión".
-- Pegar en Supabase > SQL Editor > New query > "Run"
-- =====================================================

-- ---------- 1. AUTOR VERIFICADO ----------
alter table public.perfiles
  add column if not exists verificado boolean not null default false;

-- Solo el administrador cambia: administrador, cuota y verificado
create or replace function public.proteger_perfil()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not public.es_admin() then
    new.es_admin := old.es_admin;
    new.cuota_vence := old.cuota_vence;
    new.verificado := old.verificado;
  end if;
  return new;
end; $$;

create or replace function public.soy_verificado()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select verificado from public.perfiles where id = auth.uid()), false);
$$;

-- Cambios automáticos de la propia base (por ejemplo, ocultar por reportes)
create or replace function public.es_sistema()
returns boolean language sql stable as $$
  select coalesce(current_setting('inedita.sistema', true), '') = 'si';
$$;

-- ---------- 2. ESTADO DE REVISIÓN ----------
-- 'pendiente' = en revisión · 'aprobada' = publicada · 'rechazada'
alter table public.canciones
  add column if not exists revision text not null default 'pendiente',
  add column if not exists motivo_rechazo text,
  add column if not exists revisada_en timestamptz;

alter table public.propuestas_vivo
  add column if not exists revision text not null default 'pendiente',
  add column if not exists motivo_rechazo text,
  add column if not exists revisada_en timestamptz;

alter table public.canciones drop constraint if exists revision_valida;
alter table public.canciones
  add constraint revision_valida check (revision in ('pendiente','aprobada','rechazada'));
alter table public.propuestas_vivo drop constraint if exists revision_valida;
alter table public.propuestas_vivo
  add constraint revision_valida check (revision in ('pendiente','aprobada','rechazada'));

create index if not exists canciones_revision on public.canciones (revision);
create index if not exists propuestas_revision on public.propuestas_vivo (revision);

-- Lo que ya estaba subido queda en revisión (la columna nueva arranca en 'pendiente').
-- Si corrés este archivo de nuevo, no cambia lo que ya aprobaste.

-- ---------- 3. REGLAS AL GUARDAR ----------
-- Canciones: el autor no puede aprobarse solo.
create or replace function public.proteger_cancion()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not public.es_admin() and not public.es_sistema() then
    if tg_op = 'INSERT' then
      new.destacada := false;
      new.revision := case when public.soy_verificado() then 'aprobada' else 'pendiente' end;
      new.motivo_rechazo := null;
      new.revisada_en := null;
    else
      new.destacada := old.destacada;
      new.compositor_id := old.compositor_id;
      new.revision := old.revision;
      new.motivo_rechazo := old.motivo_rechazo;
      new.revisada_en := old.revisada_en;
    end if;
  elsif tg_op = 'UPDATE' and new.revision is distinct from old.revision then
    new.revisada_en := now();
    if new.revision <> 'rechazada' then new.motivo_rechazo := null; end if;
  end if;
  return new;
end; $$;

-- Propuestas: si alguien no verificado cambia el contenido, vuelve a revisión.
create or replace function public.proteger_propuesta()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  ignorar text[] := array['activa','revision','motivo_rechazo','revisada_en','destacada'];
begin
  if auth.uid() is not null and not public.es_admin() and not public.es_sistema() then
    if tg_op = 'INSERT' then
      new.destacada := false;
      new.revision := case when public.soy_verificado() then 'aprobada' else 'pendiente' end;
      new.motivo_rechazo := null;
      new.revisada_en := null;
    else
      new.destacada := old.destacada;
      new.artista_id := old.artista_id;
      new.revision := old.revision;
      new.motivo_rechazo := old.motivo_rechazo;
      new.revisada_en := old.revisada_en;
      if not public.soy_verificado()
         and (to_jsonb(new) - ignorar) <> (to_jsonb(old) - ignorar) then
        new.revision := 'pendiente';
        new.motivo_rechazo := null;
      end if;
    end if;
  elsif tg_op = 'UPDATE' and new.revision is distinct from old.revision then
    new.revisada_en := now();
    if new.revision <> 'rechazada' then new.motivo_rechazo := null; end if;
  end if;
  return new;
end; $$;

-- Con 2 aprobaciones (canciones o propuestas), el autor queda verificado
create or replace function public.verificar_si_corresponde()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  dueno uuid;
  aprobadas int;
begin
  if new.revision = 'aprobada' and old.revision is distinct from 'aprobada' then
    if tg_table_name = 'canciones' then dueno := new.compositor_id; else dueno := new.artista_id; end if;
    select (select count(*) from public.canciones where compositor_id = dueno and revision = 'aprobada')
         + (select count(*) from public.propuestas_vivo where artista_id = dueno and revision = 'aprobada')
      into aprobadas;
    if aprobadas >= 2 then
      update public.perfiles set verificado = true where id = dueno and not verificado;
    end if;
  end if;
  return new;
end; $$;

drop trigger if exists despues_de_aprobar_cancion on public.canciones;
create trigger despues_de_aprobar_cancion
  after update on public.canciones
  for each row execute function public.verificar_si_corresponde();

drop trigger if exists despues_de_aprobar_propuesta on public.propuestas_vivo;
create trigger despues_de_aprobar_propuesta
  after update on public.propuestas_vivo
  for each row execute function public.verificar_si_corresponde();

-- ---------- 4. QUIÉN VE QUÉ ----------
-- Lo que está en revisión o rechazado solo lo ven el autor y el administrador
drop policy if exists "ver canciones" on public.canciones;
create policy "ver canciones" on public.canciones
  for select to authenticated
  using ((estado <> 'oculta' and revision = 'aprobada') or compositor_id = auth.uid() or public.es_admin());

drop policy if exists "ver propuestas" on public.propuestas_vivo;
create policy "ver propuestas" on public.propuestas_vivo
  for select to authenticated
  using ((activa and revision = 'aprobada') or artista_id = auth.uid() or public.es_admin());

-- No se puede pedir algo que no está aprobado
create or replace function public.pedir_solo_aprobadas()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_table_name = 'pedidos' then
    if not exists (select 1 from public.canciones where id = new.cancion_id and revision = 'aprobada') then
      raise exception 'La canción no está disponible';
    end if;
  else
    if not exists (select 1 from public.propuestas_vivo where id = new.propuesta_id and revision = 'aprobada') then
      raise exception 'La propuesta no está disponible';
    end if;
  end if;
  return new;
end; $$;

drop trigger if exists antes_de_pedir_aprobada on public.pedidos;
create trigger antes_de_pedir_aprobada
  before insert on public.pedidos
  for each row execute function public.pedir_solo_aprobadas();

drop trigger if exists antes_de_pedir_aprobada on public.solicitudes_vivo;
create trigger antes_de_pedir_aprobada
  before insert on public.solicitudes_vivo
  for each row execute function public.pedir_solo_aprobadas();

-- Las estadísticas cuentan solo canciones publicadas
create or replace view public.estadisticas_compositor as
select
  p.id as compositor_id,
  count(distinct c.id) filter (where c.estado <> 'oculta' and c.revision = 'aprobada') as canciones,
  count(distinct f.artista_id::text || f.cancion_id::text) as favoritos,
  count(distinct pe.id) as pedidos,
  count(distinct c.id) filter (where c.estado = 'grabada' and c.revision = 'aprobada') as grabadas,
  (select count(*) from public.calificaciones ca where ca.compositor_id = p.id) as calificaciones,
  (select round(avg(puntaje), 1) from public.calificaciones ca where ca.compositor_id = p.id) as promedio
from public.perfiles p
left join public.canciones c on c.compositor_id = p.id
left join public.favoritos f on f.cancion_id = c.id
left join public.pedidos pe on pe.cancion_id = c.id
where p.es_compositor
group by p.id;

-- ---------- 5. REPORTES ----------
create table if not exists public.reportes (
  id uuid primary key default gen_random_uuid(),
  autor_id uuid not null default auth.uid() references public.perfiles(id) on delete cascade,
  cancion_id uuid references public.canciones(id) on delete cascade,
  propuesta_id uuid references public.propuestas_vivo(id) on delete cascade,
  motivo text not null check (motivo in ('no_es_cancion','no_es_del_autor','ofensivo','mala_calidad','otro')),
  detalle text,
  resuelto boolean not null default false,
  creado_en timestamptz not null default now(),
  constraint reporte_de_algo check ((cancion_id is null) <> (propuesta_id is null))
);

-- Cada persona reporta una sola vez cada cosa
create unique index if not exists un_reporte_por_cancion on public.reportes (autor_id, cancion_id) where cancion_id is not null;
create unique index if not exists un_reporte_por_propuesta on public.reportes (autor_id, propuesta_id) where propuesta_id is not null;

alter table public.reportes enable row level security;

drop policy if exists "reportar" on public.reportes;
create policy "reportar" on public.reportes
  for insert to authenticated with check (autor_id = auth.uid());
drop policy if exists "ver reportes" on public.reportes;
create policy "ver reportes" on public.reportes
  for select to authenticated using (autor_id = auth.uid() or public.es_admin());
drop policy if exists "resolver reportes" on public.reportes;
create policy "resolver reportes" on public.reportes
  for update to authenticated using (public.es_admin()) with check (public.es_admin());
drop policy if exists "borrar reportes" on public.reportes;
create policy "borrar reportes" on public.reportes
  for delete to authenticated using (public.es_admin());

-- Con 3 reportes sin resolver, vuelve a revisión (se oculta)
create or replace function public.al_reportar()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  n int;
begin
  new.resuelto := false;
  if new.cancion_id is not null then
    if exists (select 1 from public.canciones where id = new.cancion_id and compositor_id = new.autor_id) then
      raise exception 'No podés reportar lo tuyo';
    end if;
    select count(*) + 1 into n from public.reportes where cancion_id = new.cancion_id and not resuelto;
    if n >= 3 then
      perform set_config('inedita.sistema', 'si', true);
      update public.canciones set revision = 'pendiente' where id = new.cancion_id and revision = 'aprobada';
      perform set_config('inedita.sistema', '', true);
    end if;
  else
    if exists (select 1 from public.propuestas_vivo where id = new.propuesta_id and artista_id = new.autor_id) then
      raise exception 'No podés reportar lo tuyo';
    end if;
    select count(*) + 1 into n from public.reportes where propuesta_id = new.propuesta_id and not resuelto;
    if n >= 3 then
      perform set_config('inedita.sistema', 'si', true);
      update public.propuestas_vivo set revision = 'pendiente' where id = new.propuesta_id and revision = 'aprobada';
      perform set_config('inedita.sistema', '', true);
    end if;
  end if;
  return new;
end; $$;

drop trigger if exists antes_de_reportar on public.reportes;
create trigger antes_de_reportar
  before insert on public.reportes
  for each row execute function public.al_reportar();

-- Fin
