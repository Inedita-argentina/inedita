// Panel del administrador: lo que espera revisión y lo que fue reportado.
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import { supabase } from '../supabase';
import { Encabezado, Seccion, Tarjeta, Chico, Etiqueta, Fila, Cargando, P } from '../ui';
import { fechaLinda } from '../theme';

export default function Revision({ t, nav, perfil }) {
  const [datos, setDatos] = useState(null);

  const cargar = useCallback(async () => {
    const [c, p, r] = await Promise.all([
      supabase
        .from('canciones')
        .select('id,titulo,creado_en,perfiles:perfiles!canciones_compositor_id_fkey(nombre)')
        .eq('revision', 'pendiente')
        .order('creado_en', { ascending: true }),
      supabase
        .from('propuestas_vivo')
        .select('id,nombre_artistico,tipo,creado_en,perfiles:perfiles!propuestas_vivo_artista_id_fkey(nombre)')
        .eq('revision', 'pendiente')
        .order('creado_en', { ascending: true }),
      supabase
        .from('reportes')
        .select('id,cancion_id,propuesta_id,motivo,canciones(titulo,revision),propuestas_vivo(nombre_artistico,revision)')
        .eq('resuelto', false),
    ]);
    // Reportes agrupados por publicación (solo las que siguen publicadas; las ocultas ya aparecen arriba)
    const grupos = {};
    (r.data || []).forEach((x) => {
      const clave = x.cancion_id ? 'c' + x.cancion_id : 'p' + x.propuesta_id;
      const info = x.cancion_id ? x.canciones : x.propuestas_vivo;
      if (!info || info.revision !== 'aprobada') return;
      if (!grupos[clave]) {
        grupos[clave] = {
          clave,
          ir: x.cancion_id ? ['cancion', { id: x.cancion_id }] : ['propuesta', { id: x.propuesta_id }],
          titulo: x.cancion_id ? info.titulo : info.nombre_artistico,
          tipo: x.cancion_id ? 'Canción' : 'En vivo',
          n: 0,
        };
      }
      grupos[clave].n += 1;
    });
    setDatos({ canciones: c.data || [], propuestas: p.data || [], reportes: Object.values(grupos) });
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  if (!perfil.es_admin) {
    return (
      <View style={{ gap: 16 }}>
        <Encabezado t={t} onVolver={nav.volver} titulo="Para revisar" />
        <P t={t}>Esta sección es solo para el administrador.</P>
      </View>
    );
  }

  return (
    <View style={{ gap: 22 }}>
      <Encabezado t={t} onVolver={nav.volver} titulo="Para revisar" />
      {!datos ? (
        <Cargando t={t} />
      ) : (
        <>
          <Chico t={t}>Tocá cada una para escucharla o verla, y aprobarla o rechazarla.</Chico>

          <Seccion t={t} titulo={'Canciones (' + datos.canciones.length + ')'}>
            {datos.canciones.length === 0 ? <Chico t={t}>No hay canciones esperando.</Chico> : null}
            {datos.canciones.map((c) => (
              <Tarjeta key={c.id} t={t} onPress={() => nav.ir('cancion', { id: c.id })}>
                <Text style={{ color: t.ink, fontWeight: '700' }}>{c.titulo}</Text>
                <Chico t={t}>
                  {c.perfiles ? c.perfiles.nombre : ''} · {fechaLinda(String(c.creado_en).slice(0, 10))}
                </Chico>
              </Tarjeta>
            ))}
          </Seccion>

          <Seccion t={t} titulo={'Propuestas en vivo (' + datos.propuestas.length + ')'}>
            {datos.propuestas.length === 0 ? <Chico t={t}>No hay propuestas esperando.</Chico> : null}
            {datos.propuestas.map((p) => (
              <Tarjeta key={p.id} t={t} onPress={() => nav.ir('propuesta', { id: p.id })}>
                <Text style={{ color: t.ink, fontWeight: '700' }}>{p.nombre_artistico}</Text>
                <Chico t={t}>
                  {p.tipo === 'sonido' ? 'Sonido' : 'Artista'} · {p.perfiles ? p.perfiles.nombre : ''}
                </Chico>
              </Tarjeta>
            ))}
          </Seccion>

          <Seccion t={t} titulo={'Reportadas (' + datos.reportes.length + ')'}>
            {datos.reportes.length === 0 ? <Chico t={t}>No hay reportes nuevos.</Chico> : null}
            {datos.reportes.map((g) => (
              <Tarjeta key={g.clave} t={t} onPress={() => nav.ir(g.ir[0], g.ir[1])}>
                <Fila style={{ justifyContent: 'space-between' }}>
                  <Text style={{ color: t.ink, fontWeight: '700', flex: 1 }} numberOfLines={1}>
                    {g.titulo}
                  </Text>
                  <Etiqueta t={t} text={g.n + (g.n === 1 ? ' reporte' : ' reportes')} tono="aviso" />
                </Fila>
                <Chico t={t}>{g.tipo}</Chico>
              </Tarjeta>
            ))}
          </Seccion>
        </>
      )}
    </View>
  );
}
