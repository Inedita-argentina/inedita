import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, Pressable, Linking } from 'react-native';
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
import { CartelRevision, PanelAdmin, BotonReportar } from '../revision';
import { Reproductor, ElegirFragmento, validarFragmento, columnasFragmento, fragmentoInicial, partesDeCancion } from '../fragmento';

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
  const [acceso, setAcceso] = useState(false);
  const [frag, setFrag] = useState(fragmentoInicial(null));
  const [okFrag, setOkFrag] = useState('');

  const cargar = useCallback(async () => {
    const { data, error: e } = await supabase
      .from('canciones')
      .select('*, perfiles:perfiles!canciones_compositor_id_fkey(nombre)')
      .eq('id', params.id)
      .maybeSingle();
    if (e || !data) {
      setError('No encontramos esta canción.');
      return;
    }
    setC(data);
    setGrabadaPor(data.grabada_por || '');
    setFrag(fragmentoInicial(data));
    if (uid) supabase.rpc('tiene_acceso').then((r) => setAcceso(!!r.data));
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

  async function guardarFragmento() {
    setError('');
    setOkFrag('');
    const res = validarFragmento(frag);
    if (res.error) return setError(res.error);
    const { error: e } = await supabase
      .from('canciones')
      .update(columnasFragmento(res.partes))
      .eq('id', c.id);
    if (e) setError('No se pudo guardar el fragmento.');
    else {
      setOkFrag('Fragmento guardado.');
      cargar();
    }
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
        {c.otro_genero ? ' (' + c.otro_genero + ')' : ''}
        {c.tonalidad ? ' · ' + c.tonalidad : ''}
        {vozNombre ? ' · ' + vozNombre : ''}
        {c.anio_publicacion ? ' · ' + c.anio_publicacion : ''}
      </P>
      {c.tematica ? <P t={t}>Temática: {c.tematica}</P> : null}
      {esMia ? <CartelRevision t={t} item={c} que="canción" /> : null}
      {perfil.es_admin ? (
        <PanelAdmin t={t} item={c} tabla="canciones" duenoId={c.compositor_id} campoReporte="cancion_id" onCambio={cargar} />
      ) : null}

      {c.audio_path ? (
        <View style={{ gap: 10 }}>
          <Reproductor t={t} ruta={c.audio_path} partes={partesDeCancion(c)} />
          {acceso || esMia ? (
            <Reproductor t={t} ruta={c.audio_path} />
          ) : (
            <Chico t={t}>
              {uid
                ? 'Para escuchar el demo completo necesitás tener la cuota al día. Revisá tu perfil.'
                : 'Creá tu cuenta para escuchar el demo completo y leer la letra.'}
            </Chico>
          )}
        </View>
      ) : null}

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
      ) : null}

      {esMia && c.audio_path ? (
        <Tarjeta t={t}>
          <H2 t={t}>Fragmento destacado</H2>
          <Chico t={t}>Elegí la parte de la canción que escuchan primero los artistas. Podés armarlo con una o dos partes.</Chico>
          <ElegirFragmento
            t={t}
            ruta={c.audio_path}
            valor={frag}
            onCambio={setFrag}
          />
          <Aviso t={t} texto={okFrag} tono="ok" />
          <Boton t={t} title="Guardar fragmento" onPress={guardarFragmento} />
        </Tarjeta>
      ) : null}

      {esMia ? null : !uid ? (
        <Tarjeta t={t}>
          <H2 t={t}>¿Te interesa esta canción?</H2>
          <P t={t} muted>Creá tu cuenta gratis: entrás con tu mail o con Google, sin contraseña.</P>
          <Boton t={t} variant="accent" title="Crear cuenta o entrar" onPress={() => nav.raiz('perfil')} />
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
      {uid && !esMia && c.revision === 'aprobada' ? <BotonReportar t={t} uid={uid} campo="cancion_id" id={c.id} /> : null}
    </View>
  );
}
