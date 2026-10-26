-- =====================================================
-- INÉDITA · Modo invitado y política de privacidad
-- - Sin cuenta se puede mirar el catálogo publicado y escuchar los fragmentos.
-- - Para subir, pedir, firmar o reportar hace falta una cuenta.
-- - La política de privacidad es un texto editable por el administrador.
-- Pegar en Supabase > SQL Editor > New query > "Run"
-- (Se puede correr de nuevo sin problema.)
-- =====================================================

-- ---------- 1. LO QUE VE UN INVITADO (solo lo publicado) ----------
drop policy if exists "invitado ve canciones" on public.canciones;
create policy "invitado ve canciones" on public.canciones
  for select to anon
  using (estado <> 'oculta' and revision = 'aprobada');

drop policy if exists "invitado ve autores" on public.autores;
create policy "invitado ve autores" on public.autores
  for select to anon
  using (exists (select 1 from public.canciones c
                 where c.id = cancion_id and c.estado <> 'oculta' and c.revision = 'aprobada'));

drop policy if exists "invitado ve propuestas" on public.propuestas_vivo;
create policy "invitado ve propuestas" on public.propuestas_vivo
  for select to anon
  using (activa and revision = 'aprobada');

drop policy if exists "invitado ve generos de propuestas" on public.propuesta_generos;
create policy "invitado ve generos de propuestas" on public.propuesta_generos
  for select to anon using (true);

drop policy if exists "invitado ve insignias" on public.insignias;
create policy "invitado ve insignias" on public.insignias
  for select to anon using (true);

drop policy if exists "invitado ve resenas" on public.resenas_vivo;
create policy "invitado ve resenas" on public.resenas_vivo
  for select to anon using (true);

-- De los perfiles, el invitado solo ve el nombre público y datos generales (nada de cuota ni administración)
drop policy if exists "invitado ve perfiles" on public.perfiles;
create policy "invitado ve perfiles" on public.perfiles
  for select to anon using (true);
revoke select on public.perfiles from anon;
grant select (id, nombre, provincia, localidad, bio, foto_path, verificado,
              es_compositor, es_artista, creado_en) on public.perfiles to anon;

grant select on public.estadisticas_compositor to anon;
grant select on public.estadisticas_cancion to anon;
grant select on public.estadisticas_vivo to anon;

-- Audios (para el fragmento) y fotos de En Vivo
drop policy if exists "invitado escucha audios" on storage.objects;
create policy "invitado escucha audios" on storage.objects
  for select to anon
  using (bucket_id in ('audios', 'vivo'));

-- ---------- 2. POLÍTICA DE PRIVACIDAD (editable) ----------
drop policy if exists "invitado ve plantillas" on public.plantillas;
create policy "invitado ve plantillas" on public.plantillas
  for select to anon using (id = 'privacidad');

insert into public.plantillas (id, titulo, texto) values (
'privacidad',
'Política de privacidad',
$texto$POLÍTICA DE PRIVACIDAD DE INÉDITA
(Versión de prueba: texto a revisar por un abogado)

En Inédita cuidamos tus datos. Acá te contamos, en simple, qué guardamos y para qué.

1. QUÉ DATOS GUARDAMOS
• Tu mail, para que puedas entrar con un código. Si entrás con Google, recibimos tu mail y tu nombre de Google.
• Lo que vos completes en tu perfil: nombre o nombre artístico, provincia, localidad y una descripción. Todo es opcional salvo el nombre.
• Lo que subas: canciones (audio, letra, autores), propuestas para eventos, fotos y videos.
• Tus pedidos, presupuestos, calificaciones y reseñas.
• Solo si firmás un acuerdo: tu nombre completo y DNI. Los ven únicamente la otra parte del acuerdo y el administrador.

2. PARA QUÉ LOS USAMOS
• Para que la app funcione: mostrar tu perfil, tus canciones y propuestas, y conectar autores, intérpretes y organizadores.
• Para cuidar la comunidad: revisar lo que se publica y atender reportes.
• No vendemos tus datos ni los usamos para publicidad de terceros.

3. QUIÉN MÁS VE TUS DATOS
• Los demás usuarios ven tu nombre público y lo que publicás. Tu mail no se muestra.
• Usamos servicios externos para guardar la información y enviar los mails (por ejemplo, Supabase, Vercel y Google). Solo los usan para hacer funcionar Inédita.

4. TUS DERECHOS
Podés pedirnos ver, corregir o borrar tus datos cuando quieras, escribiendo a inedita.musica.argentina@gmail.com. Te respondemos dentro de los plazos de la Ley 25.326 de Protección de Datos Personales.
La Agencia de Acceso a la Información Pública es el órgano de control de esa ley y atiende denuncias y reclamos de quienes consideren que no se respetan sus derechos.

5. CAMBIOS
Si cambiamos esta política, lo vamos a avisar en la app.

Última actualización: octubre de 2026.$texto$
) on conflict (id) do nothing;

-- Fin
