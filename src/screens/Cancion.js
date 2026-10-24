import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, Pressable, Linking } from 'react-native';
import { Audio } from 'expo-av';
import { supabase } from '../supabase';
import { etiquetasEstadoCancion, etiquetasEstadoPedido, voces } from '../theme';
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
  Inicial,
} from '../ui';
import { useGeneros, ruta } from '../generos';

function Reproductor({ t, ruta: rutaAudio }) {
  const [sonido, setSonido] = useState(null);
  const [sonando, setSonando] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    return () => {
      if (sonido) sonido.unloadAsync();
    };
  }, [sonido]);

  async function alternar() {
    setError('');
    try {
      if (sonido) {
        const st = await sonido.getStatusAsync();
        if (st.isPlaying) {
          await sonido.pauseAsync();
          setSonando(false);
        } else {
          await sonido.playAsync();
          setSonando(true);
        }
        return;
      }
      setCargando(true);
      const { data, error: e } = await supabase.storage.from('audios').createSignedUrl(rutaAudio, 900);
      if (e || !data) throw e || new Error('sin url');
      const { sound } = await Audio.Sound.createAsync({ uri: data.signedUrl }, { shouldPlay: true }, (st) => {
        if (st.didJustFinish) setSonando(false);
      });
      setSonido(sound);
      setSonando(true);
    } catch (e) {
      setError('Para escuchar los demos del catálogo necesitás tener la cuota al día. Revisá tu perfil.');
    } finally {
      setCargando(false);
    }
  }

  return (
    <View style={{ gap: 8 }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={sonando ? 'Pausar demo' : 'Escuchar demo'}
        onPress={alternar}
        style={{
          backgroundColor: t.track,
          borderRadius: 14,
          padding: 12,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <View
          style={{
            width: 48,
            height: 48,
            borderRadius: 24,
            backgroundColor: t.primary,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ color: t.onCard, fontSize: 18, fontWeight: '800' }}>{cargando ? '…' : sonando ? 'II' : '▶'}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: t.ink, fontWeight: '700' }}>{sonando ? 'Sonando el demo' : 'Escuchar el demo'}</Text>
          <Chico t={t}>Tocá para reproducir o pausar</Chico>
        </View>
      </Pressable>
      <Aviso t={t} texto={error} />
    </View>
  );
}

export default function Cancion({ t, nav, uid, params, perfil }) {
  const generos = useGeneros();
  const [c, setC] = useState(null);
  const [autores, setAutores] = useState([]);
  const [letra, setLetra] = useState(null);
  const [esFav, setEsFav] = useState(false);
  const [misPedidos, setMisPedidos] = useState([]);
  const [statsComp, setStatsComp] = useState(null);
  const [insignias, setInsignias] = useState([]);
  const [mensaje, setMensaje] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  const [grabadaPor, setGrabadaPor] = useState('');

  const cargar = useCallback(async () => {
    const { data, error: e } = await supabase
      .from('canciones')
      .select('*, perfiles(nombre)')
      .eq('id', params.id)
      .maybeSingle();
    if (e || !data) {
      setError('No encontramos esta canción.');
      return;
    }
    setC(data);
    setGrabadaPor(data.grabada_por || '');
    const [a, l, f, p, s, ins] = await Promise.all([
      supabase.from('autores').select('*').eq('cancion_id', data.id),
      supabase.from('letras').select('letra').eq('cancion_id', data.id).maybeSingle(),
      supabase.from('favoritos').select('cancion_id').eq('cancion_id', data.id).eq('artista_id', uid),
      supabase.from('pedidos').select('*').eq('cancion_id', data.id).eq('artista_id', uid).order('creado_en', { ascending: false }),
      supabase.from('estadisticas_compositor').select('*').eq('compositor_id', data.compositor_id).maybeSingle(),
      supabase.from('insignias').select('*').eq('perfil_id', data.compositor_id),
    ]);
    setAutores(a.data || []);
    setLetra(l.data ? l.data.letra : null);
    setEsFav(!!(f.data && f.data.length));
    setMisPedidos(p.data || []);
    setStatsComp(s.data || null);
    setInsignias(ins.data || []);
  }, [params.id, uid]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  if (!c) {
    return (
      <View style={{ gap: 16 }}>
        <Encabezado t={t} onVolver={nav.volver} />
        {error ? <Aviso t={t} texto={error} /> : <Cargando t={t} />}
      </View>
    );
  }

  const esMia = c.compositor_id === uid;
  const pendiente = misPedidos.find((p) => p.estado === 'pendiente' || p.estado === 'aceptado');
  const vozNombre = (voces.find((v) => v.id === c.voz) || {}).nombre;

  async function alternarFav() {
    setError('');
    if (esFav) {
      await supabase.from('favoritos').delete().eq('cancion_id', c.id).eq('artista_id', uid);
      setEsFav(false);
    } else {
      const { error: e } = await supabase.from('favoritos').insert({ cancion_id: c.id, artista_id: uid });
      if (!e) setEsFav(true);
    }
  }

  async function pedir() {
    setError('');
    setOk('');
    setEnviando(true);
    const { error: e } = await supabase
      .from('pedidos')
      .insert({ cancion_id: c.id, artista_id: uid, compositor_id: c.compositor_id, mensaje: mensaje.trim() || null });
    setEnviando(false);
    if (e) {
      if (/row-level security|policy/i.test(e.message || '')) {
        setError('Para pedir canciones necesitás tener la cuota al día. Revisá tu perfil.');
      } else if (/disponible/i.test(e.message || '')) {
        setError('Esta canción ya no está disponible.');
      } else {
        setError('No se pudo enviar el pedido. Probá de nuevo.');
      }
      return;
    }
    if (!perfil.es_artista) await supabase.from('perfiles').update({ es_artista: true }).eq('id', uid);
    setMensaje('');
    setOk('¡Listo! Le avisamos al autor. Vas a ver la respuesta en la sección Pedidos.');
    cargar();
  }

  async function cambiarEstado(estado) {
    setError('');
    const cambios = { estado };
    if (estado === 'grabada') cambios.grabada_por = grabadaPor.trim() || null;
    const { error: e } = await supabase.from('canciones').update(cambios).eq('id', c.id);
    if (e) setError('No se pudo actualizar.');
    else cargar();
  }

  const tonoEstado = c.estado === 'disponible' ? 'ok' : c.estado === 'reservada' ? 'aviso' : undefined;

  return (
    <View style={{ gap: 18 }}>
      <Encabezado t={t} onVolver={nav.volver} titulo={c.titulo} />
      <Chips>
        {c.para_versionar ? <Etiqueta t={t} text="Para versionar" /> : null}
        <Etiqueta t={t} text={etiquetasEstadoCancion[c.estado] || c.estado} tono={tonoEstado} />
        {c.registrada_sadaic ? <Etiqueta t={t} text="Registrada en SADAIC" tono="ok" /> : null}
      </Chips>
      <P t={t} muted>
        {ruta(generos, c.genero_id)}
        {c.tonalidad ? ' · ' + c.tonalidad : ''}
        {vozNombre ? ' · ' + vozNombre : ''}
        {c.anio_publicacion ? ' · ' + c.anio_publicacion : ''}
      </P>
      {c.tematica ? <P t={t}>Temática: {c.tematica}</P> : null}

      {c.audio_path ? <Reproductor t={t} ruta={c.audio_path} /> : null}

      {c.enlace_youtube || c.enlace_spotify ? (
        <Fila style={{ flexWrap: 'wrap' }}>
          {c.enlace_youtube ? (
            <Boton t={t} chico variant="quiet" title="Escuchar en YouTube" onPress={() => Linking.openURL(c.enlace_youtube)} />
          ) : null}
          {c.enlace_spotify ? (
            <Boton t={t} chico variant="quiet" title="Escuchar en Spotify" onPress={() => Linking.openURL(c.enlace_spotify)} />
          ) : null}
        </Fila>
      ) : null}

      <Tarjeta t={t}>
        <Fila>
          <Inicial t={t} nombre={c.perfiles ? c.perfiles.nombre : ''} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: t.ink, fontWeight: '700', fontSize: 16 }}>{c.perfiles ? c.perfiles.nombre : ''}</Text>
            {statsComp ? (
              <Chico t={t}>
                {statsComp.canciones} canciones · ♥ {statsComp.favoritos} · {statsComp.pedidos} pedidos · {statsComp.grabadas}{' '}
                grabadas{statsComp.promedio ? ' · ★ ' + String(statsComp.promedio).replace('.', ',') : ''}
              </Chico>
            ) : null}
          </View>
        </Fila>
        {insignias.length ? (
          <Chips>
            {insignias.map((i) => (
              <Etiqueta key={i.id} t={t} text={'🏅 ' + i.nombre} />
            ))}
          </Chips>
        ) : null}
      </Tarjeta>

      {autores.length ? (
        <View style={{ gap: 6 }}>
          <H2 t={t}>Autores</H2>
          {autores.map((a) => (
            <P key={a.id} t={t}>
              {a.nombre} — {a.rol === 'letra' ? 'Letra' : a.rol === 'musica' ? 'Música' : 'Letra y música'}
              {a.porcentaje ? ' (' + a.porcentaje + '%)' : ''}
            </P>
          ))}
        </View>
      ) : null}

      {letra ? (
        <View style={{ gap: 6 }}>
          <H2 t={t}>Letra</H2>
          <P t={t} style={{ lineHeight: 24 }}>
            {letra}
          </P>
        </View>
      ) : null}

      <Aviso t={t} texto={error} />
      <Aviso t={t} texto={ok} tono="ok" />

      {esMia ? (
        <Tarjeta t={t}>
          <H2 t={t}>Es tu canción</H2>
          <Chico t={t}>Cambiá el estado cuando haga falta.</Chico>
          <Chips>
            {['disponible', 'reservada', 'grabada', 'oculta'].map((e) => (
              <Chip key={e} t={t} label={etiquetasEstadoCancion[e]} selected={c.estado === e} onPress={() => cambiarEstado(e)} />
            ))}
          </Chips>
          <Campo
            t={t}
            label="¿Quién la grabó? (opcional)"
            value={grabadaPor}
            onChangeText={setGrabadaPor}
            placeholder="Nombre del artista"
            hint="Se guarda cuando marcás la canción como Grabada."
          />
        </Tarjeta>
      ) : (
        <View style={{ gap: 12 }}>
          <Boton t={t} variant="outline" title={esFav ? '♥ En tus favoritos' : '♡ Guardar en favoritos'} onPress={alternarFav} />
          {pendiente ? (
            <Tarjeta t={t}>
              <P t={t}>
                Ya pediste esta canción. Estado: <P t={t} style={{ fontWeight: '700' }}>{etiquetasEstadoPedido[pendiente.estado]}</P>
              </P>
              {pendiente.respuesta ? <Chico t={t}>Respuesta del autor: {pendiente.respuesta}</Chico> : null}
            </Tarjeta>
          ) : c.estado === 'disponible' ? (
            <Tarjeta t={t}>
              <H2 t={t}>{c.para_versionar ? '¿Querés grabar tu versión?' : '¿Te interesa esta canción?'}</H2>
              <Campo
                t={t}
                label="Mensaje para el autor"
                value={mensaje}
                onChangeText={setMensaje}
                multiline
                placeholder="Contale quién sos, qué hacés y para qué la querés."
              />
              <Boton
                t={t}
                variant="accent"
                title={c.para_versionar ? 'Quiero versionarla' : 'Pedir esta canción'}
                onPress={pedir}
                loading={enviando}
              />
            </Tarjeta>
          ) : null}
        </View>
      )}
    </View>
  );
}
