// Revisión de lo que se publica: cartel para el autor, panel del administrador y botón Reportar.
import React, { useEffect, useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { supabase } from './supabase';
import { Tarjeta, H2, P, Chico, Boton, Campo, Aviso, Chip, Chips, Interruptor } from './ui';

export const etiquetasRevision = {
  pendiente: 'En revisión',
  aprobada: 'Publicada',
  rechazada: 'Rechazada',
};

export const motivosReporte = [
  { id: 'no_es_cancion', nombre: 'No es una canción' },
  { id: 'no_es_del_autor', nombre: 'No es del autor' },
  { id: 'ofensivo', nombre: 'Contenido ofensivo' },
  { id: 'mala_calidad', nombre: 'No se escucha bien' },
  { id: 'otro', nombre: 'Otro motivo' },
];

const nombreMotivo = (id) => (motivosReporte.find((m) => m.id === id) || {}).nombre || id;

// Lo que ve el autor sobre su canción o propuesta
export function CartelRevision({ t, item, que }) {
  if (!item || item.revision === 'aprobada') return null;
  const rechazada = item.revision === 'rechazada';
  return (
    <View
      style={{
        backgroundColor: rechazada ? '#2A0E0E' : t.destacadoSoft,
        borderColor: rechazada ? '#6B2323' : t.destacadoLine,
        borderWidth: 1,
        borderRadius: 14,
        padding: 14,
        gap: 4,
      }}
    >
      <Text style={{ color: rechazada ? '#FF8A8A' : t.destacado, fontWeight: '800' }}>
        {rechazada ? 'No se publicó' : 'En revisión'}
      </Text>
      <P t={t}>
        {rechazada
          ? 'Revisamos tu ' + que + ' y no la pudimos publicar.'
          : 'Tu ' + que + ' está en revisión. Solo la ves vos hasta que la aprobemos; suele tardar menos de un día.'}
      </P>
      {rechazada && item.motivo_rechazo ? <P t={t}>Motivo: {item.motivo_rechazo}</P> : null}
      {rechazada ? <Chico t={t}>Podés borrarla y volver a subirla con los cambios.</Chico> : null}
    </View>
  );
}

// Panel del administrador dentro de una canción o propuesta
// tabla: 'canciones' | 'propuestas_vivo' ; duenoId: autor ; campoReporte: 'cancion_id' | 'propuesta_id'
export function PanelAdmin({ t, item, tabla, duenoId, campoReporte, onCambio }) {
  const [motivo, setMotivo] = useState('');
  const [verificado, setVerificado] = useState(false);
  const [reportes, setReportes] = useState([]);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  const [guardando, setGuardando] = useState('');

  async function cargar() {
    const [p, r] = await Promise.all([
      supabase.from('perfiles').select('verificado').eq('id', duenoId).maybeSingle(),
      supabase.from('reportes').select('*').eq(campoReporte, item.id).order('creado_en', { ascending: false }),
    ]);
    setVerificado(!!(p.data && p.data.verificado));
    setReportes(r.data || []);
  }

  useEffect(() => {
    cargar();
  }, [item.id, duenoId]);

  async function decidir(revision) {
    setError('');
    setOk('');
    if (revision === 'rechazada' && !motivo.trim()) return setError('Escribí el motivo del rechazo: lo va a leer el autor.');
    setGuardando(revision);
    const cambios = { revision, motivo_rechazo: revision === 'rechazada' ? motivo.trim() : null };
    const { error: e } = await supabase.from(tabla).update(cambios).eq('id', item.id);
    if (!e) {
      // Al decidir, los reportes de esta publicación quedan resueltos
      await supabase.from('reportes').update({ resuelto: true }).eq(campoReporte, item.id).eq('resuelto', false);
    }
    setGuardando('');
    if (e) return setError('No se pudo guardar la decisión.');
    setMotivo('');
    setOk(revision === 'aprobada' ? 'Aprobada: ya la ven todos.' : revision === 'rechazada' ? 'Rechazada.' : 'Volvió a revisión.');
    await cargar();
    onCambio && onCambio();
  }

  async function cambiarVerificado(v) {
    setError('');
    const { error: e } = await supabase.from('perfiles').update({ verificado: v }).eq('id', duenoId);
    if (e) setError('No se pudo cambiar el verificado.');
    else setVerificado(v);
  }

  const abiertos = reportes.filter((r) => !r.resuelto);

  return (
    <Tarjeta t={t} style={{ borderColor: t.destacado, borderWidth: 1 }}>
      <H2 t={t}>Administración</H2>
      <Chico t={t}>Estado: {etiquetasRevision[item.revision] || item.revision}</Chico>

      {abiertos.length ? (
        <View style={{ gap: 4 }}>
          <Text style={{ color: t.ink, fontWeight: '700' }}>
            {abiertos.length} {abiertos.length === 1 ? 'reporte' : 'reportes'} sin resolver
          </Text>
          {abiertos.map((r) => (
            <Chico key={r.id} t={t}>
              • {nombreMotivo(r.motivo)}
              {r.detalle ? ': ' + r.detalle : ''}
            </Chico>
          ))}
        </View>
      ) : null}

      <Campo
        t={t}
        label="Motivo, si la rechazás"
        value={motivo}
        onChangeText={setMotivo}
        placeholder="Ej.: El audio no es una canción."
        multiline
      />
      <Aviso t={t} texto={error} />
      <Aviso t={t} texto={ok} tono="ok" />
      <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
        {item.revision !== 'aprobada' ? (
          <Boton t={t} variant="accent" title="Aprobar" onPress={() => decidir('aprobada')} loading={guardando === 'aprobada'} style={{ flex: 1 }} />
        ) : null}
        {item.revision !== 'rechazada' ? (
          <Boton t={t} variant="outline" title="Rechazar" onPress={() => decidir('rechazada')} loading={guardando === 'rechazada'} style={{ flex: 1 }} />
        ) : null}
      </View>
      {item.revision === 'aprobada' && abiertos.length ? (
        <Boton t={t} chico variant="quiet" title="Está bien: descartar los reportes" onPress={() => decidir('aprobada')} />
      ) : null}
      <Interruptor
        t={t}
        label="Autor verificado"
        hint="Lo que suba se publica sin revisión. Se activa solo con 2 aprobaciones."
        value={verificado}
        onValueChange={cambiarVerificado}
      />
    </Tarjeta>
  );
}

// Botón chico para reportar (lo ve quien no es el autor)
export function BotonReportar({ t, uid, campo, id }) {
  const [abierto, setAbierto] = useState(false);
  const [motivo, setMotivo] = useState(null);
  const [detalle, setDetalle] = useState('');
  const [estado, setEstado] = useState('');
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    supabase
      .from('reportes')
      .select('id')
      .eq(campo, id)
      .eq('autor_id', uid)
      .then((r) => {
        if (r.data && r.data.length) setEstado('enviado');
      });
  }, [campo, id, uid]);

  async function enviar() {
    setError('');
    if (!motivo) return setError('Elegí un motivo.');
    setEnviando(true);
    const { error: e } = await supabase.from('reportes').insert({ [campo]: id, autor_id: uid, motivo, detalle: detalle.trim() || null });
    setEnviando(false);
    if (e && !/duplicate|unique/i.test(e.message || '')) return setError('No se pudo enviar. Probá de nuevo.');
    setEstado('enviado');
    setAbierto(false);
  }

  if (estado === 'enviado') {
    return <Chico t={t} style={{ textAlign: 'center' }}>Gracias, recibimos tu reporte. Lo vamos a revisar.</Chico>;
  }
  if (!abierto) {
    return (
      <Pressable accessibilityRole="button" onPress={() => setAbierto(true)} style={{ alignSelf: 'center', padding: 8 }}>
        <Text style={{ color: t.muted, fontSize: 13, textDecorationLine: 'underline' }}>Reportar un problema</Text>
      </Pressable>
    );
  }
  return (
    <Tarjeta t={t}>
      <H2 t={t}>¿Qué problema hay?</H2>
      <Chips>
        {motivosReporte.map((m) => (
          <Chip key={m.id} t={t} label={m.nombre} selected={motivo === m.id} onPress={() => setMotivo(m.id)} />
        ))}
      </Chips>
      <Campo t={t} label="Contanos más (opcional)" value={detalle} onChangeText={setDetalle} multiline />
      <Aviso t={t} texto={error} />
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Boton t={t} title="Enviar reporte" onPress={enviar} loading={enviando} style={{ flex: 1 }} />
        <Boton t={t} variant="quiet" title="Cancelar" onPress={() => setAbierto(false)} style={{ flex: 1 }} />
      </View>
    </Tarjeta>
  );
}
