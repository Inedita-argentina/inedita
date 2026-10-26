-- =====================================================
-- INÉDITA · Acuerdos entre autor e intérprete
-- - Cuando el autor acepta un pedido, propone las condiciones
--   (exclusividad, plazo para grabar, pago, créditos).
-- - Los dos firman de forma electrónica y queda guardado el texto firmado.
-- - El modelo de autorización es un texto editable por el administrador.
-- - La comisión de Inédita es un número que cambia el administrador.
-- Pegar en Supabase > SQL Editor > New query > "Run"
-- (Se puede correr de nuevo sin problema.)
-- =====================================================

-- ---------- 1. COMISIÓN DE INÉDITA (para ir probando números) ----------
alter table public.configuracion
  add column if not exists comision_inedita numeric(5,2) not null default 10
  check (comision_inedita >= 0 and comision_inedita <= 50);

-- ---------- 2. TEXTOS LEGALES EDITABLES ----------
create table if not exists public.plantillas (
  id text primary key,
  titulo text not null,
  texto text not null,
  actualizado_en timestamptz not null default now()
);

alter table public.plantillas enable row level security;
drop policy if exists "ver plantillas" on public.plantillas;
create policy "ver plantillas" on public.plantillas
  for select to authenticated using (true);
drop policy if exists "editar plantillas" on public.plantillas;
create policy "editar plantillas" on public.plantillas
  for all to authenticated using (public.es_admin()) with check (public.es_admin());

insert into public.plantillas (id, titulo, texto) values (
'autorizacion',
'Autorización de uso de obra musical',
$texto$AUTORIZACIÓN DE USO DE OBRA MUSICAL
(Modelo de prueba: texto a revisar por un abogado)

En la fecha {FECHA}, {AUTOR_NOMBRE} (DNI {AUTOR_DNI}), en adelante "el Autor", y {ARTISTA_NOMBRE} (DNI {ARTISTA_DNI}), en adelante "el Intérprete", acuerdan lo siguiente a través de la plataforma Inédita:

1. OBRA. El Autor declara ser autor de la obra musical titulada "{CANCION}", o contar con la autorización de sus coautores. Autores de la obra: {AUTORES_OBRA}.

2. AUTORIZACIÓN. El Autor autoriza al Intérprete a grabar la obra, publicar y difundir esa grabación en formatos físicos y digitales, e interpretarla en vivo.

3. EXCLUSIVIDAD. {EXCLUSIVIDAD}

4. PLAZO PARA GRABAR. {PLAZO_GRABACION}

5. PAGO. {PAGO}

6. DERECHOS DE AUTOR. El Autor conserva en todo momento la autoría y los derechos morales sobre la obra, y el derecho a cobrar los derechos de autor que correspondan por su difusión, a través de SADAIC u otras entidades. Esta autorización no implica ceder la autoría.

7. CRÉDITOS. En toda publicación de la grabación, el Intérprete mencionará la autoría así: {CREDITOS}.

8. INTEGRIDAD DE LA OBRA. El Intérprete no podrá cambiar la letra ni la melodía sin autorización escrita del Autor. Se permiten los cambios de arreglo, tonalidad y estilo propios de su interpretación.

9. CONDICIONES PARTICULARES. {CONDICIONES}

10. PLATAFORMA. Inédita actúa como espacio de encuentro entre las partes y no es parte de este acuerdo.

Las partes aceptan este acuerdo de forma electrónica desde sus cuentas de Inédita.

Autor: {AUTOR_NOMBRE} · firmó el {FIRMA_AUTOR}
Intérprete: {ARTISTA_NOMBRE} · firmó el {FIRMA_ARTISTA}$texto$
) on conflict (id) do nothing;

-- ---------- 3. ACUERDOS ----------
create table if not exists public.acuerdos (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid not null unique references public.pedidos(id) on delete cascade,
  cancion_id uuid not null references public.canciones(id) on delete cascade,
  autor_id uuid not null references public.perfiles(id) on delete cascade,
  artista_id uuid not null references public.perfiles(id) on delete cascade,
  estado text not null default 'propuesto' check (estado in ('propuesto','firmado','anulado')),
  -- Condiciones (las propone el autor)
  exclusivo boolean not null default false,
  exclusividad_meses int check (exclusividad_meses > 0),
  plazo_grabacion_meses int check (plazo_grabacion_meses > 0),
  modalidad_pago text not null default 'sin_cargo'
    check (modalidad_pago in ('sin_cargo','monto_fijo','porcentaje','mixto')),
  monto numeric(14,2) check (monto >= 0),
  moneda text not null default 'ARS' check (moneda in ('ARS','USD')),
  porcentaje numeric(5,2) check (porcentaje > 0 and porcentaje <= 100),
  comision_pct numeric(5,2) not null default 0,
  creditos text,
  condiciones text,
  -- Datos para firmar (cada uno completa los suyos)
  autor_nombre_legal text,
  autor_dni text,
  artista_nombre_legal text,
  artista_dni text,
  comentario_artista text,
  firmado_autor_en timestamptz,
  firmado_artista_en timestamptz,
  texto_firmado text,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

create index if not exists acuerdos_autor on public.acuerdos (autor_id);
create index if not exists acuerdos_artista on public.acuerdos (artista_id);

-- Reglas al guardar un acuerdo
create or replace function public.controlar_acuerdo()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  ped record;
  terminos text[] := array['exclusivo','exclusividad_meses','plazo_grabacion_meses','modalidad_pago',
                           'monto','moneda','porcentaje','creditos','condiciones'];
  cambio_terminos boolean;
  soy_admin boolean := public.es_admin();
begin
  if tg_op = 'INSERT' then
    select * into ped from public.pedidos where id = new.pedido_id;
    if ped is null or ped.estado <> 'aceptado' then
      raise exception 'El pedido tiene que estar aceptado';
    end if;
    if auth.uid() is not null and auth.uid() <> ped.compositor_id and not soy_admin then
      raise exception 'Solo el autor propone el acuerdo';
    end if;
    new.cancion_id := ped.cancion_id;
    new.autor_id := ped.compositor_id;
    new.artista_id := ped.artista_id;
    new.estado := 'propuesto';
    new.comision_pct := coalesce((select comision_inedita from public.configuracion where id = 1), 0);
    new.artista_nombre_legal := null;
    new.artista_dni := null;
    new.firmado_artista_en := null;
    new.comentario_artista := null;
    new.texto_firmado := null;
    if new.firmado_autor_en is not null then new.firmado_autor_en := now(); end if;
    return new;
  end if;

  -- UPDATE
  new.id := old.id;
  new.pedido_id := old.pedido_id;
  new.cancion_id := old.cancion_id;
  new.autor_id := old.autor_id;
  new.artista_id := old.artista_id;
  new.creado_en := old.creado_en;
  new.comision_pct := old.comision_pct;
  new.actualizado_en := now();

  if old.estado in ('firmado','anulado') and not soy_admin then
    raise exception 'Este acuerdo ya está cerrado';
  end if;

  if auth.uid() = old.autor_id then
    -- El autor no toca lo del intérprete
    new.artista_nombre_legal := old.artista_nombre_legal;
    new.artista_dni := old.artista_dni;
    new.comentario_artista := old.comentario_artista;
    new.firmado_artista_en := old.firmado_artista_en;
  elsif auth.uid() = old.artista_id then
    -- El intérprete no cambia las condiciones ni lo del autor
    new.exclusivo := old.exclusivo;
    new.exclusividad_meses := old.exclusividad_meses;
    new.plazo_grabacion_meses := old.plazo_grabacion_meses;
    new.modalidad_pago := old.modalidad_pago;
    new.monto := old.monto;
    new.moneda := old.moneda;
    new.porcentaje := old.porcentaje;
    new.creditos := old.creditos;
    new.condiciones := old.condiciones;
    new.autor_nombre_legal := old.autor_nombre_legal;
    new.autor_dni := old.autor_dni;
    new.firmado_autor_en := old.firmado_autor_en;
    if new.estado = 'anulado' then new.estado := old.estado; end if;
  elsif not soy_admin then
    raise exception 'No podés cambiar este acuerdo';
  end if;

  -- Si cambian las condiciones, las firmas anteriores se borran
  cambio_terminos := exists (
    select 1 from unnest(terminos) k
    where (to_jsonb(new) -> k) is distinct from (to_jsonb(old) -> k)
  );
  if cambio_terminos then
    new.firmado_artista_en := null;
    if new.firmado_autor_en is not distinct from old.firmado_autor_en then
      new.firmado_autor_en := null;
    end if;
  end if;

  -- La hora de la firma la pone la base, no el teléfono
  if new.firmado_autor_en is not null and old.firmado_autor_en is null then new.firmado_autor_en := now(); end if;
  if new.firmado_artista_en is not null and old.firmado_artista_en is null then new.firmado_artista_en := now(); end if;

  -- Para firmar hay que poner nombre y DNI
  if new.firmado_autor_en is not null and (coalesce(trim(new.autor_nombre_legal), '') = '' or coalesce(trim(new.autor_dni), '') = '') then
    raise exception 'Para firmar completá tu nombre completo y DNI';
  end if;
  if new.firmado_artista_en is not null and (coalesce(trim(new.artista_nombre_legal), '') = '' or coalesce(trim(new.artista_dni), '') = '') then
    raise exception 'Para firmar completá tu nombre completo y DNI';
  end if;

  -- Cuando firman los dos, queda cerrado
  if new.estado <> 'anulado' and new.firmado_autor_en is not null and new.firmado_artista_en is not null then
    new.estado := 'firmado';
    if coalesce(new.texto_firmado, '') = '' then
      raise exception 'Falta el texto del acuerdo';
    end if;
  else
    if new.estado = 'firmado' then new.estado := 'propuesto'; end if;
    new.texto_firmado := null;
  end if;
  return new;
end; $$;

drop trigger if exists antes_de_guardar_acuerdo on public.acuerdos;
create trigger antes_de_guardar_acuerdo
  before insert or update on public.acuerdos
  for each row execute function public.controlar_acuerdo();

alter table public.acuerdos enable row level security;

drop policy if exists "ver mis acuerdos" on public.acuerdos;
create policy "ver mis acuerdos" on public.acuerdos
  for select to authenticated
  using (autor_id = auth.uid() or artista_id = auth.uid() or public.es_admin());
drop policy if exists "proponer acuerdo" on public.acuerdos;
create policy "proponer acuerdo" on public.acuerdos
  for insert to authenticated with check (true);
drop policy if exists "editar mis acuerdos" on public.acuerdos;
create policy "editar mis acuerdos" on public.acuerdos
  for update to authenticated
  using (autor_id = auth.uid() or artista_id = auth.uid() or public.es_admin())
  with check (autor_id = auth.uid() or artista_id = auth.uid() or public.es_admin());
drop policy if exists "borrar acuerdos" on public.acuerdos;
create policy "borrar acuerdos" on public.acuerdos
  for delete to authenticated using (public.es_admin());

-- Fin
