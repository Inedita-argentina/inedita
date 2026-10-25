-- =====================================================
-- INÉDITA · Modo prueba (acceso gratis para todos)
-- Pegar en Supabase > SQL Editor > New query > "Run"
-- Para APAGARLO más adelante: Table Editor > configuracion > modo_prueba = false
-- =====================================================

create table if not exists public.configuracion (
  id int primary key default 1 check (id = 1),
  modo_prueba boolean not null default true
);

insert into public.configuracion (id, modo_prueba)
values (1, true)
on conflict (id) do nothing;

alter table public.configuracion enable row level security;

drop policy if exists "ver configuracion" on public.configuracion;
create policy "ver configuracion" on public.configuracion
  for select to authenticated, anon using (true);

drop policy if exists "editar configuracion" on public.configuracion;
create policy "editar configuracion" on public.configuracion
  for update to authenticated
  using (public.es_admin()) with check (public.es_admin());

-- Acceso al catálogo: administrador, cuota al día, o modo prueba encendido
create or replace function public.tiene_acceso()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select modo_prueba from public.configuracion where id = 1), false)
      or coalesce((
           select es_admin or (cuota_vence is not null and cuota_vence >= current_date)
           from public.perfiles where id = auth.uid()
         ), false);
$$;

-- Fin
