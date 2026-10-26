import React, { useEffect, useState, useCallback } from 'react';
import { View, Text } from 'react-native';
import { supabase } from '../supabase';
import { etiquetasEstadoPedido, etiquetasEstadoSolicitud, plata, fechaLinda } from '../theme';
import { etiquetasAcuerdo } from '../acuerdo';
import { H1, P, Chico, Encabezado, Tarjeta, Fila, Etiqueta, Boton, Campo, Aviso, Cargando, Seccion, Estrellas } from '../ui';

function tonoPedido(e) {
  if (e === 'aceptado' || e === 'aceptada' || e === 'realizada') return 'ok';
  if (e === 'pendiente' || e === 'presupuestado') return 'aviso';
  if (e === 'rechazado' || e === 'rechazada' || e === 'cancelado' || e === 'cancelada') return 'error';
  return undefined;
}

function Calificar({ t, onEnviar, titulo }) {
  const [puntaje, setPuntaje] = useState(0);
  const [comentario, setComentario] = useState('');
  const [enviando, setEnviando] = useState(false);
  return (
    <View style={{ gap: 8, paddingTop: 6 }}>
      <Text style={{ color: t.ink, fontWeight: '600' }}>{titulo}</Text>
      <Estrellas t={t} valor={puntaje} onCambio={setPuntaje} />
      <Campo t={t} value={comentario} onChangeText={setComentario} placeholder="Comentario (opcional)" />
      <Boton
        t={t}
        chico
        variant="accent"
        title="Enviar calificación"
        disabled={!puntaje}
        loading={enviando}
        onPress={async () => {
          setEnviando(true);
          await onEnviar(puntaje, comentario.trim() || null);
          setEnviando(false);
        }}
      />
    </View>
  );
}

// Botón al acuerdo de un pedido aceptado
function BotonAcuerdo({ t, p, acuerdo, nav }) {
  if (p.estado !== 'aceptado') return null;
  const estado = acuerdo ? acuerdo.estado : 'sin_proponer';
  return (
    <Boton
      t={t}
      chico
      variant={estado === 'firmado' ? 'outline' : 'accent'}
      title={(estado === 'firmado' ? '✓ ' : '') + etiquetasAcuerdo[estado] + '  →'}
      onPress={() => nav.ir('acuerdo', { pedidoId: p.id })}
    />
  );
}

function PedidoRecibido({ t, p, onCambio, acuerdo, nav }) {
  const [respuesta, setRespuesta] = useState('');
  return (
    <Tarjeta t={t}>
      <Fila style={{ justifyContent: 'space-between' }}>
        <Text style={{ color: t.ink, fontWeight: '700', fontSize: 16, flex: 1 }} numberOfLines={1}>
          {p.canciones ? p.canciones.titulo : 'Canción'}
        </Text>
        <Etiqueta t={t} text={etiquetasEstadoPedido[p.estado]} tono={tonoPedido(p.estado)} />
      </Fila>
      <Chico t={t}>
        Pedido por {p.artista ? p.artista.nombre : 'un artista'} · {fechaLinda(p.creado_en)}
      </Chico>
      {p.mensaje ? <P t={t}>“{p.mensaje}”</P> : null}
      {p.respuesta ? <Chico t={t}>Tu respuesta: {p.respuesta}</Chico> : null}
      <BotonAcuerdo t={t} p={p} acuerdo={acuerdo} nav={nav} />
      {p.estado === 'pendiente' ? (
        <View style={{ gap: 8 }}>
          <Campo t={t} value={respuesta} onChangeText={setRespuesta} placeholder="Respuesta (opcional): cómo seguimos, contacto…" multiline />
          <Fila>
            <Boton t={t} chico style={{ flex: 1 }} title="Aceptar" onPress={() => onCambio(p.id, 'aceptado', respuesta)} />
            <Boton t={t} chico style={{ flex: 1 }} variant="quiet" title="Rechazar" onPress={() => onCambio(p.id, 'rechazado', respuesta)} />
          </Fila>
        </View>
      ) : null}
    </Tarjeta>
  );
}

function SolicitudRecibida({ t, s, onActualizar }) {
  const [monto, setMonto] = useState('');
  const [respuesta, setRespuesta] = useState('');
  return (
    <Tarjeta t={t}>
      <Fila style={{ justifyContent: 'space-between' }}>
        <Text style={{ color: t.ink, fontWeight: '700', fontSize: 16, flex: 1 }}>
          {s.tipo_evento || 'Evento'} · {fechaLinda(s.fecha_evento)}
        </Text>
        <Etiqueta t={t} text={etiquetasEstadoSolicitud[s.estado]} tono={tonoPedido(s.estado)} />
      </Fila>
      <Chico t={t}>
        {s.organizador ? s.organizador.nombre : 'Organizador'} · {[s.localidad, s.provincia].filter(Boolean).join(', ')}
        {s.hora ? ' · ' + s.hora : ''}
      </Chico>
      <Chico t={t}>
        Para: {s.propuestas_vivo ? s.propuestas_vivo.nombre_artistico : ''}
        {s.evento_privado ? ' · Evento privado' : ''}
        {s.necesita_sonido ? ' · Necesita sonido' : ''}
        {s.duracion_minutos ? ' · ' + s.duracion_minutos + ' min' : ''}
      </Chico>
      {s.mensaje ? <P t={t}>“{s.mensaje}”</P> : null}
      {s.monto ? <P t={t}>Presupuesto: {plata(s.monto)}</P> : null}
      {s.respuesta ? <Chico t={t}>Tu respuesta: {s.respuesta}</Chico> : null}
      {s.estado === 'pendiente' ? (
        <View style={{ gap: 8 }}>
          <Campo t={t} label="Tu presupuesto ($)" value={monto} onChangeText={setMonto} keyboardType="number-pad" />
          <Campo t={t} value={respuesta} onChangeText={setRespuesta} placeholder="Qué incluye, condiciones, contacto…" multiline />
          <Fila>
            <Boton
              t={t}
              chico
              style={{ flex: 1 }}
              title="Enviar presupuesto"
              disabled={!monto}
              onPress={() =>
                onActualizar(s.id, { estado: 'presupuestado', monto: parseInt(monto.replace(/\D/g, ''), 10), respuesta: respuesta.trim() || null })
              }
            />
            <Boton t={t} chico variant="quiet" title="No puedo" onPress={() => onActualizar(s.id, { estado: 'rechazada', respuesta: respuesta.trim() || null })} />
          </Fila>
        </View>
      ) : null}
      {s.estado === 'presupuestado' ? (
        <Boton t={t} chico variant="quiet" title="Retirar presupuesto" onPress={() => onActualizar(s.id, { estado: 'rechazada' })} />
      ) : null}
      {s.estado === 'aceptada' ? (
        <Boton t={t} chico variant="quiet" title="Cancelar la fecha" onPress={() => onActualizar(s.id, { estado: 'cancelada' })} />
      ) : null}
    </Tarjeta>
  );
}

export default function Pedidos({ t, uid, nav }) {
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');

  const cargar = useCallback(async () => {
    const [recibidos, enviados, solRecibidas, solEnviadas, misCalif, misResenas, acuerdos] = await Promise.all([
      supabase
        .from('pedidos')
        .select('*, canciones(titulo), artista:perfiles!pedidos_artista_id_fkey(nombre)')
        .eq('compositor_id', uid)
        .order('creado_en', { ascending: false }),
      supabase
        .from('pedidos')
        .select('*, canciones(titulo), compositor:perfiles!pedidos_compositor_id_fkey(nombre)')
        .eq('artista_id', uid)
        .order('creado_en', { ascending: false }),
      supabase
        .from('solicitudes_vivo')
        .select('*, propuestas_vivo(nombre_artistico), organizador:perfiles!solicitudes_vivo_organizador_id_fkey(nombre)')
        .eq('artista_id', uid)
        .order('creado_en', { ascending: false }),
      supabase
        .from('solicitudes_vivo')
        .select('*, propuestas_vivo(nombre_artistico)')
        .eq('organizador_id', uid)
        .order('creado_en', { ascending: false }),
      supabase.from('calificaciones').select('pedido_id').eq('artista_id', uid),
      supabase.from('resenas_vivo').select('solicitud_id').eq('organizador_id', uid),
      supabase.from('acuerdos').select('pedido_id,estado').or('autor_id.eq.' + uid + ',artista_id.eq.' + uid),
    ]);
    const mapaAcuerdos = {};
    (acuerdos.data || []).forEach((a) => (mapaAcuerdos[a.pedido_id] = a));
    setDatos({
      recibidos: recibidos.data || [],
      enviados: enviados.data || [],
      solRecibidas: solRecibidas.data || [],
      solEnviadas: solEnviadas.data || [],
      calificados: (misCalif.data || []).map((c) => c.pedido_id),
      resenados: (misResenas.data || []).map((r) => r.solicitud_id),
      acuerdos: mapaAcuerdos,
    });
  }, [uid]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  async function cambiarPedido(id, estado, respuesta) {
    setError('');
    setOk('');
    const cambios = { estado };
    if (respuesta !== undefined) cambios.respuesta = (respuesta || '').trim() || null;
    const { error: e } = await supabase.from('pedidos').update(cambios).eq('id', id);
    if (e) setError('No se pudo actualizar el pedido.');
    else cargar();
  }

  async function actualizarSolicitud(id, cambios) {
    setError('');
    setOk('');
    const { error: e } = await supabase.from('solicitudes_vivo').update(cambios).eq('id', id);
    if (e) {
      if (/permitido/i.test(e.message || '')) setError('Ese cambio todavía no se puede hacer (por ejemplo, marcar realizado antes de la fecha).');
      else setError('No se pudo actualizar.');
    } else cargar();
  }

  async function calificarCancion(pedido, puntaje, comentario) {
    const { error: e } = await supabase
      .from('calificaciones')
      .insert({ pedido_id: pedido.id, artista_id: uid, compositor_id: pedido.compositor_id, puntaje, comentario });
    if (e) setError('No se pudo guardar la calificación.');
    else {
      setOk('¡Gracias por calificar!');
      cargar();
    }
  }

  async function resenar(sol, puntaje, comentario) {
    const { error: e } = await supabase
      .from('resenas_vivo')
      .insert({ solicitud_id: sol.id, organizador_id: uid, artista_id: sol.artista_id, puntaje, comentario });
    if (e) setError('No se pudo guardar la reseña.');
    else {
      setOk('¡Gracias por tu reseña!');
      cargar();
    }
  }

  if (!datos) {
    return (
      <View style={{ gap: 16 }}>
        <Encabezado t={t} titulo="Pedidos" onVolver={() => nav.raiz('inicio')} />
        <Cargando t={t} />
      </View>
    );
  }

  const vacio =
    !datos.recibidos.length && !datos.enviados.length && !datos.solRecibidas.length && !datos.solEnviadas.length;

  return (
    <View style={{ gap: 22 }}>
      <Encabezado t={t} titulo="Pedidos" onVolver={() => nav.raiz('inicio')} />
      <Aviso t={t} texto={error} />
      <Aviso t={t} texto={ok} tono="ok" />
      {vacio ? (
        <P t={t} muted>
          Todavía no tenés pedidos. Cuando pidas una canción o un presupuesto, o cuando alguien te pida algo, aparece acá.
        </P>
      ) : null}

      {datos.recibidos.length ? (
        <Seccion t={t} titulo="Pedidos de tus canciones">
          {datos.recibidos.map((p) => (
            <PedidoRecibido key={p.id} t={t} p={p} onCambio={cambiarPedido} acuerdo={datos.acuerdos[p.id]} nav={nav} />
          ))}
        </Seccion>
      ) : null}

      {datos.enviados.length ? (
        <Seccion t={t} titulo="Canciones que pediste">
          {datos.enviados.map((p) => (
            <Tarjeta key={p.id} t={t}>
              <Fila style={{ justifyContent: 'space-between' }}>
                <Text
                  style={{ color: t.ink, fontWeight: '700', fontSize: 16, flex: 1 }}
                  numberOfLines={1}
                  onPress={() => nav.ir('cancion', { id: p.cancion_id })}
                >
                  {p.canciones ? p.canciones.titulo : 'Canción'}
                </Text>
                <Etiqueta t={t} text={etiquetasEstadoPedido[p.estado]} tono={tonoPedido(p.estado)} />
              </Fila>
              <Chico t={t}>
                De {p.compositor ? p.compositor.nombre : 'el autor'} · {fechaLinda(p.creado_en)}
              </Chico>
              {p.respuesta ? <P t={t}>Respuesta: {p.respuesta}</P> : null}
              <BotonAcuerdo t={t} p={p} acuerdo={datos.acuerdos[p.id]} nav={nav} />
              {p.estado === 'pendiente' ? (
                <Boton t={t} chico variant="quiet" title="Cancelar pedido" onPress={() => cambiarPedido(p.id, 'cancelado')} />
              ) : null}
              {p.estado === 'aceptado' && datos.calificados.indexOf(p.id) < 0 ? (
                <Calificar t={t} titulo="¿Cómo fue trabajar con el autor?" onEnviar={(pt, com) => calificarCancion(p, pt, com)} />
              ) : null}
            </Tarjeta>
          ))}
        </Seccion>
      ) : null}

      {datos.solRecibidas.length ? (
        <Seccion t={t} titulo="Te pidieron presupuesto">
          {datos.solRecibidas.map((s) => (
            <SolicitudRecibida key={s.id} t={t} s={s} onActualizar={actualizarSolicitud} />
          ))}
        </Seccion>
      ) : null}

      {datos.solEnviadas.length ? (
        <Seccion t={t} titulo="Presupuestos que pediste">
          {datos.solEnviadas.map((s) => (
            <Tarjeta key={s.id} t={t}>
              <Fila style={{ justifyContent: 'space-between' }}>
                <Text style={{ color: t.ink, fontWeight: '700', fontSize: 16, flex: 1 }} numberOfLines={1}>
                  {s.propuestas_vivo ? s.propuestas_vivo.nombre_artistico : 'Propuesta'}
                </Text>
                <Etiqueta t={t} text={etiquetasEstadoSolicitud[s.estado]} tono={tonoPedido(s.estado)} />
              </Fila>
              <Chico t={t}>
                {s.tipo_evento || 'Evento'} · {fechaLinda(s.fecha_evento)} · {[s.localidad, s.provincia].filter(Boolean).join(', ')}
              </Chico>
              {s.monto ? <P t={t}>Presupuesto: {plata(s.monto)}</P> : null}
              {s.respuesta ? <Chico t={t}>Respuesta: {s.respuesta}</Chico> : null}
              {s.estado === 'presupuestado' ? (
                <Fila>
                  <Boton t={t} chico style={{ flex: 1 }} title="Aceptar presupuesto" onPress={() => actualizarSolicitud(s.id, { estado: 'aceptada' })} />
                  <Boton t={t} chico variant="quiet" title="Cancelar" onPress={() => actualizarSolicitud(s.id, { estado: 'cancelada' })} />
                </Fila>
              ) : null}
              {s.estado === 'pendiente' ? (
                <Boton t={t} chico variant="quiet" title="Cancelar pedido" onPress={() => actualizarSolicitud(s.id, { estado: 'cancelada' })} />
              ) : null}
              {s.estado === 'aceptada' ? (
                <Fila>
                  <Boton t={t} chico style={{ flex: 1 }} title="Ya se realizó" onPress={() => actualizarSolicitud(s.id, { estado: 'realizada' })} />
                  <Boton t={t} chico variant="quiet" title="Cancelar" onPress={() => actualizarSolicitud(s.id, { estado: 'cancelada' })} />
                </Fila>
              ) : null}
              {s.estado === 'realizada' && datos.resenados.indexOf(s.id) < 0 ? (
                <Calificar t={t} titulo="¿Cómo estuvo?" onEnviar={(pt, com) => resenar(s, pt, com)} />
              ) : null}
            </Tarjeta>
          ))}
        </Seccion>
      ) : null}
    </View>
  );
}
