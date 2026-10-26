import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, Linking } from 'react-native';
import { supabase } from '../supabase';
import { tiposEvento, plata, formaciones } from '../theme';
import {
  Encabezado,
  P,
  Chico,
  Tarjeta,
  Fila,
  Etiqueta,
  Boton,
  Campo,
  Aviso,
  Cargando,
  H2,
  Chip,
  Chips,
  Interruptor,
  Estrellas,
} from '../ui';
import { useGeneros, nombreGenero } from '../generos';
import { CartelRevision, PanelAdmin, BotonReportar } from '../revision';

export default function Propuesta({ t, nav, uid, params, perfil }) {
  const generos = useGeneros();
  const [p, setP] = useState(null);
  const [stats, setStats] = useState(null);
  const [resenas, setResenas] = useState([]);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [f, setF] = useState({
    fecha: '',
    hora: '',
    provincia: perfil.provincia || '',
    localidad: perfil.localidad || '',
    tipo: '',
    privado: false,
    sonido: false,
    duracion: '',
    mensaje: '',
  });

  function campo(k, v) {
    setF(Object.assign({}, f, { [k]: v }));
  }

  const cargar = useCallback(async () => {
    const { data, error: e } = await supabase
      .from('propuestas_vivo')
      .select('*, perfiles:perfiles!propuestas_vivo_artista_id_fkey(nombre), propuesta_generos(genero_id)')
      .eq('id', params.id)
      .maybeSingle();
    if (e || !data) {
      setError('No encontramos esta propuesta.');
      return;
    }
    setP(data);
    const [s, r] = await Promise.all([
      supabase.from('estadisticas_vivo').select('*').eq('artista_id', data.artista_id).maybeSingle(),
      supabase
        .from('resenas_vivo')
        .select('puntaje,comentario,creado_en')
        .eq('artista_id', data.artista_id)
        .order('creado_en', { ascending: false })
        .limit(5),
    ]);
    setStats(s.data || null);
    setResenas(r.data || []);
  }, [params.id]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  if (!p) {
    return (
      <View style={{ gap: 16 }}>
        <Encabezado t={t} onVolver={nav.volver} />
        {error ? <Aviso t={t} texto={error} /> : <Cargando t={t} />}
      </View>
    );
  }

  const esMia = p.artista_id === uid;
  const gens = (p.propuesta_generos || []).map((g) => nombreGenero(generos, g.genero_id)).filter(Boolean);
  const formacion = (formaciones.find((x) => x.id === p.formacion) || {}).nombre;

  async function pedirPresupuesto() {
    setError('');
    setOk('');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(f.fecha.trim())) {
      setError('Escribí la fecha así: AAAA-MM-DD (por ejemplo 2026-12-20).');
      return;
    }
    if (!f.localidad.trim()) {
      setError('Contanos en qué localidad es el evento.');
      return;
    }
    setEnviando(true);
    const { error: e } = await supabase.from('solicitudes_vivo').insert({
      propuesta_id: p.id,
      organizador_id: uid,
      artista_id: p.artista_id,
      fecha_evento: f.fecha.trim(),
      hora: f.hora.trim() || null,
      provincia: f.provincia.trim() || null,
      localidad: f.localidad.trim(),
      tipo_evento: f.tipo || null,
      evento_privado: f.privado || f.tipo === 'Evento privado',
      necesita_sonido: f.sonido,
      duracion_minutos: parseInt(f.duracion, 10) || null,
      mensaje: f.mensaje.trim() || null,
    });
    setEnviando(false);
    if (e) {
      if (/pasó/i.test(e.message || '')) setError('La fecha del evento ya pasó.');
      else if (/disponible/i.test(e.message || '')) setError('Esta propuesta no está disponible ahora.');
      else setError('No se pudo enviar el pedido. Revisá los datos y probá de nuevo.');
      return;
    }
    if (!perfil.es_organizador) await supabase.from('perfiles').update({ es_organizador: true }).eq('id', uid);
    setOk('¡Pedido enviado! Cuando te respondan con un presupuesto lo vas a ver en Pedidos.');
    setF(Object.assign({}, f, { mensaje: '' }));
  }

  return (
    <View style={{ gap: 18 }}>
      <Encabezado t={t} onVolver={nav.volver} titulo={p.nombre_artistico} />
      <Chips>
        <Etiqueta t={t} text={p.tipo === 'sonido' ? 'Sonido y luces' : 'Artista'} />
        {p.incluye_sonido ? <Etiqueta t={t} text="Incluye sonido" /> : null}
        {p.incluye_iluminacion ? <Etiqueta t={t} text="Con iluminación" /> : null}
        {!p.activa ? <Etiqueta t={t} text="Pausada" tono="error" /> : null}
      </Chips>
      {esMia ? <CartelRevision t={t} item={p} que="propuesta" /> : null}
      {perfil.es_admin ? (
        <PanelAdmin t={t} item={p} tabla="propuestas_vivo" duenoId={p.artista_id} campoReporte="propuesta_id" onCambio={cargar} />
      ) : null}

      <Tarjeta t={t}>
        <Fila style={{ justifyContent: 'space-between' }}>
          <View>
            <Text style={{ color: t.ink, fontWeight: '700', fontSize: 18 }}>
              {stats && stats.promedio ? '★ ' + String(stats.promedio).replace('.', ',') : 'Sin reseñas todavía'}
            </Text>
            <Chico t={t}>
              {stats ? stats.shows_realizados : 0} eventos realizados por la app · {stats ? stats.resenas : 0} reseñas
            </Chico>
          </View>
          {p.precio_desde ? (
            <View style={{ alignItems: 'flex-end' }}>
              <Chico t={t}>Desde</Chico>
              <Text style={{ color: t.link, fontWeight: '800', fontSize: 18 }}>{plata(p.precio_desde)}</Text>
            </View>
          ) : null}
        </Fila>
      </Tarjeta>

      {p.descripcion ? <P t={t}>{p.descripcion}</P> : null}
      <View style={{ gap: 4 }}>
        {gens.length ? <P t={t}>Géneros: {gens.join(', ')}</P> : null}
        {formacion ? (
          <P t={t}>
            Formación: {formacion}
            {p.integrantes ? ' (' + p.integrantes + ' integrantes)' : ''}
          </P>
        ) : null}
        {p.equipamiento ? <P t={t}>Equipamiento: {p.equipamiento}</P> : null}
        {p.capacidad_personas ? <P t={t}>Sirve para hasta {p.capacidad_personas} personas</P> : null}
        {p.duracion_minutos ? <P t={t}>Duración del show: {p.duracion_minutos} minutos</P> : null}
        {(p.provincias || []).length ? <P t={t}>Zonas: {p.provincias.join(', ')}</P> : null}
        {(p.tipos_evento || []).length ? <P t={t}>Eventos: {p.tipos_evento.join(', ')}</P> : null}
      </View>

      {(p.videos || []).length ? (
        <View style={{ gap: 8 }}>
          <H2 t={t}>Videos</H2>
          {p.videos.map((v, i) => (
            <Boton key={i} t={t} chico variant="quiet" title={'Ver video ' + (i + 1)} onPress={() => Linking.openURL(v)} />
          ))}
        </View>
      ) : null}

      {resenas.length ? (
        <View style={{ gap: 8 }}>
          <H2 t={t}>Lo que dicen</H2>
          {resenas.map((r, i) => (
            <Tarjeta key={i} t={t}>
              <Estrellas t={t} valor={r.puntaje} tamano={18} />
              {r.comentario ? <P t={t}>{r.comentario}</P> : null}
            </Tarjeta>
          ))}
        </View>
      ) : null}

      <Aviso t={t} texto={error} />
      <Aviso t={t} texto={ok} tono="ok" />

      {esMia ? (
        <Boton t={t} variant="accent" title="Editar mi propuesta" onPress={() => nav.ir('editarPropuesta', { id: p.id })} />
      ) : p.activa && p.revision === 'aprobada' ? (
        <Tarjeta t={t}>
          <H2 t={t}>Pedir presupuesto</H2>
          <Campo t={t} label="Fecha del evento" value={f.fecha} onChangeText={(v) => campo('fecha', v)} placeholder="AAAA-MM-DD" />
          <Campo t={t} label="Hora (opcional)" value={f.hora} onChangeText={(v) => campo('hora', v)} placeholder="21:30" />
          <Campo t={t} label="Provincia" value={f.provincia} onChangeText={(v) => campo('provincia', v)} />
          <Campo t={t} label="Localidad" value={f.localidad} onChangeText={(v) => campo('localidad', v)} />
          <View style={{ gap: 6 }}>
            <Text style={{ color: t.ink, fontWeight: '600', fontSize: 14 }}>Tipo de evento</Text>
            <Chips>
              {tiposEvento.map((e) => (
                <Chip key={e} t={t} label={e} selected={f.tipo === e} onPress={() => campo('tipo', e)} />
              ))}
            </Chips>
          </View>
          <Interruptor t={t} label="Es un evento privado" value={f.privado} onValueChange={(v) => campo('privado', v)} />
          {p.tipo === 'artista' && !p.incluye_sonido ? (
            <Interruptor
              t={t}
              label="Necesito que traigan sonido"
              hint="Este artista no lleva equipo propio."
              value={f.sonido}
              onValueChange={(v) => campo('sonido', v)}
            />
          ) : null}
          <Campo t={t} label="Duración (minutos, opcional)" value={f.duracion} onChangeText={(v) => campo('duracion', v)} keyboardType="number-pad" />
          <Campo t={t} label="Mensaje" value={f.mensaje} onChangeText={(v) => campo('mensaje', v)} multiline placeholder="Contá cómo es el evento, cuánta gente va, etc." />
          <Boton t={t} variant="accent" title="Enviar pedido" onPress={pedirPresupuesto} loading={enviando} />
        </Tarjeta>
      ) : null}
      {!esMia && p.revision === 'aprobada' ? <BotonReportar t={t} uid={uid} campo="propuesta_id" id={p.id} /> : null}
    </View>
  );
}
