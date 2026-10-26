// Reproductor de audio con "fragmento destacado": el autor arma la vista previa
// con una o dos partes de la canción (en total, hasta 40 segundos).
import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { Audio } from 'expo-av';
import { supabase } from './supabase';
import { Chico, Aviso, Campo, Chip, Chips, Interruptor } from './ui';

export const MAX_FRAGMENTO = 40;
const duracionesUna = [30, 40];
const duracionesDos = [10, 15, 20, 25, 30];
const FUNDIDO_MS = 350; // bajada y subida de volumen en cada corte

// "1:05" -> 65 ; "65" -> 65 ; vacío -> 0 ; inválido -> null
export function leerTiempo(texto) {
  const s = String(texto || '').trim().replace(/[.,]/g, ':');
  if (!s) return 0;
  if (/^\d+$/.test(s)) return parseInt(s, 10);
  const m = s.match(/^(\d{1,2}):(\d{1,2})$/);
  if (!m) return null;
  const seg = parseInt(m[2], 10);
  if (seg > 59) return null;
  return parseInt(m[1], 10) * 60 + seg;
}

// 65 -> "1:05"
export function escribirTiempo(seg) {
  const n = Math.max(0, Math.round(seg || 0));
  const m = Math.floor(n / 60);
  const s = n % 60;
  return m + ':' + (s < 10 ? '0' : '') + s;
}

// Las partes guardadas en una canción
export function partesDeCancion(c) {
  const partes = [{ desde: c.fragmento_inicio || 0, dur: c.fragmento_duracion || 30 }];
  if (c.fragmento2_inicio != null && c.fragmento2_duracion) {
    partes.push({ desde: c.fragmento2_inicio, dur: c.fragmento2_duracion });
  }
  return partes;
}

function describirPartes(partes) {
  return partes.map((p) => escribirTiempo(p.desde) + ' (' + p.dur + ' s)').join(' + ');
}

// Reproduce una canción. Si recibe "partes", solo suenan esas partes, una detrás de otra.
// Fuente: "uri" (archivo local recién elegido) o "ruta" (archivo guardado en Supabase).
export function Reproductor({ t, ruta, uri, partes, titulo, subtitulo, onDuracion }) {
  const sonidoRef = useRef(null);
  const indiceRef = useRef(0);
  const saltandoRef = useRef(false);
  const volRef = useRef(1);
  const [sonando, setSonando] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [transcurrido, setTranscurrido] = useState(0);
  const [error, setError] = useState('');
  const esFragmento = !!(partes && partes.length);
  const clave = esFragmento ? partes.map((p) => p.desde + '-' + p.dur).join('|') : 'completo';
  const total = esFragmento ? partes.reduce((s, p) => s + p.dur, 0) : 0;

  useEffect(() => {
    return () => {
      const s = sonidoRef.current;
      sonidoRef.current = null;
      if (s) s.unloadAsync();
      indiceRef.current = 0;
      setSonando(false);
      setTranscurrido(0);
    };
  }, [ruta, uri, clave]);

  async function volverAlPrincipio(s) {
    indiceRef.current = 0;
    saltandoRef.current = true;
    try {
      await s.pauseAsync();
      await s.setPositionAsync(partes[0].desde * 1000);
      volRef.current = 1;
      await s.setVolumeAsync(1);
    } finally {
      saltandoRef.current = false;
    }
    setSonando(false);
    setTranscurrido(0);
  }

  async function saltarA(s, i) {
    indiceRef.current = i;
    saltandoRef.current = true;
    try {
      volRef.current = 0;
      await s.setVolumeAsync(0);
      await s.setPositionAsync(partes[i].desde * 1000);
    } finally {
      saltandoRef.current = false;
    }
  }

  function alActualizar(st) {
    if (!st.isLoaded) return;
    if (st.durationMillis && onDuracion) onDuracion(st.durationMillis / 1000);
    const s = sonidoRef.current;
    if (!esFragmento) {
      if (st.didJustFinish) setSonando(false);
      return;
    }
    if (!s || saltandoRef.current || !st.isPlaying) return;
    const i = indiceRef.current;
    const p = partes[i];
    const ini = p.desde * 1000;
    const fin = ini + p.dur * 1000;
    const pos = st.positionMillis || 0;

    const previos = partes.slice(0, i).reduce((a, x) => a + x.dur, 0);
    // La barra se actualiza de a medio segundo, para no redibujar la pantalla todo el tiempo
    const nuevo = Math.min(total, previos + Math.max(0, pos - ini) / 1000);
    setTranscurrido((v) => (Math.abs(nuevo - v) >= 0.5 ? nuevo : v));

    if (pos >= fin || st.didJustFinish) {
      if (i + 1 < partes.length) saltarA(s, i + 1);
      else volverAlPrincipio(s);
      return;
    }
    // Fundido: baja al acercarse al final de cada parte, sube al empezar la segunda
    let vol = Math.min(1, (fin - pos) / FUNDIDO_MS);
    if (i > 0) vol = Math.min(vol, Math.max(0, pos - ini) / FUNDIDO_MS);
    // Solo se toca el volumen cerca de los cortes
    if (vol < 1 || volRef.current < 1) {
      volRef.current = Math.max(0, vol);
      s.setVolumeAsync(volRef.current);
    }
  }

  async function alternar() {
    setError('');
    try {
      const actual = sonidoRef.current;
      if (actual) {
        const st = await actual.getStatusAsync();
        if (st.isPlaying) {
          await actual.pauseAsync();
          setSonando(false);
        } else {
          if (esFragmento) {
            const p = partes[indiceRef.current];
            const pos = st.positionMillis || 0;
            if (pos < p.desde * 1000 || pos >= (p.desde + p.dur) * 1000) {
              await actual.setPositionAsync(p.desde * 1000);
            }
          }
          await actual.playAsync();
          setSonando(true);
        }
        return;
      }
      setCargando(true);
      let fuente = uri;
      if (!fuente) {
        const { data, error: e } = await supabase.storage.from('audios').createSignedUrl(ruta, 900);
        if (e || !data) throw e || new Error('sin url');
        fuente = data.signedUrl;
      }
      const { sound } = await Audio.Sound.createAsync(
        { uri: fuente },
        { shouldPlay: false, progressUpdateIntervalMillis: 100 },
        alActualizar
      );
      sonidoRef.current = sound;
      indiceRef.current = 0;
      if (esFragmento && partes[0].desde) await sound.setPositionAsync(partes[0].desde * 1000);
      await sound.playAsync();
      setSonando(true);
    } catch (e) {
      setError('No se pudo reproducir el audio. Probá de nuevo en un momento.');
    } finally {
      setCargando(false);
    }
  }

  const avance = esFragmento && total ? Math.min(1, transcurrido / total) : 0;
  const textoTitulo = titulo || (esFragmento ? 'Fragmento destacado' : 'Escuchar el demo');
  const textoSub =
    subtitulo ||
    (esFragmento
      ? (sonando ? 'Sonando · ' : '') + total + ' segundos' + (partes.length > 1 ? ' en dos partes' : ' desde el ' + escribirTiempo(partes[0].desde))
      : sonando
      ? 'Sonando el demo completo'
      : 'Tocá para reproducir o pausar');

  return (
    <View style={{ gap: 8 }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={(sonando ? 'Pausar ' : 'Reproducir ') + textoTitulo}
        onPress={alternar}
        style={{ backgroundColor: t.track, borderRadius: 14, padding: 12, gap: 10 }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View
            style={{
              width: 48,
              height: 48,
              borderRadius: 24,
              backgroundColor: esFragmento ? t.destacado : t.primary,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ color: esFragmento ? t.onAccent : t.onCard, fontSize: 18, fontWeight: '800' }}>
              {cargando ? '…' : sonando ? 'II' : '▶'}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: t.ink, fontWeight: '700' }}>{textoTitulo}</Text>
            <Chico t={t}>{textoSub}</Chico>
          </View>
        </View>
        {esFragmento ? (
          <View style={{ flexDirection: 'row', gap: 4 }}>
            {partes.map((p, i) => {
              const previos = partes.slice(0, i).reduce((a, x) => a + x.dur, 0);
              const lleno = Math.min(1, Math.max(0, (transcurrido - previos) / p.dur));
              return (
                <View key={i} style={{ flex: p.dur, height: 4, borderRadius: 2, backgroundColor: t.line, overflow: 'hidden' }}>
                  <View style={{ height: 4, width: lleno * 100 + '%', backgroundColor: t.destacado }} />
                </View>
              );
            })}
          </View>
        ) : null}
      </Pressable>
      <Aviso t={t} texto={error} />
    </View>
  );
}

// Valores del formulario -> partes válidas, o un mensaje de qué corregir
export function validarFragmento(f, largo) {
  const d1 = leerTiempo(f.inicio1);
  if (d1 == null) return { error: 'Revisá el minuto de la parte 1. Escribilo como 1:05.' };
  const partes = [{ desde: d1, dur: f.dur1 }];
  if (f.dos) {
    const d2 = leerTiempo(f.inicio2);
    if (d2 == null) return { error: 'Revisá el minuto de la parte 2. Escribilo como 1:05.' };
    partes.push({ desde: d2, dur: f.dur2 });
  }
  const total = partes.reduce((s, p) => s + p.dur, 0);
  if (total > MAX_FRAGMENTO) {
    return { error: 'Entre las dos partes suman ' + total + ' segundos. El máximo es ' + MAX_FRAGMENTO + '.' };
  }
  if (largo) {
    for (let i = 0; i < partes.length; i++) {
      if (partes[i].desde >= largo) {
        return { error: 'Tu audio dura ' + escribirTiempo(largo) + '. La parte ' + (i + 1) + ' empieza después del final.' };
      }
    }
  }
  return { partes };
}

// Lo que se guarda en la tabla canciones
export function columnasFragmento(partes) {
  return {
    fragmento_inicio: partes[0].desde,
    fragmento_duracion: partes[0].dur,
    fragmento2_inicio: partes[1] ? partes[1].desde : null,
    fragmento2_duracion: partes[1] ? partes[1].dur : null,
  };
}

export function fragmentoInicial(c) {
  if (!c) return { inicio1: '0:00', dur1: 30, dos: false, inicio2: '', dur2: 20 };
  const dos = c.fragmento2_inicio != null && !!c.fragmento2_duracion;
  return {
    inicio1: escribirTiempo(c.fragmento_inicio || 0),
    dur1: c.fragmento_duracion || 30,
    dos,
    inicio2: dos ? escribirTiempo(c.fragmento2_inicio) : '',
    dur2: dos ? c.fragmento2_duracion : 20,
  };
}

function Parte({ t, numero, inicio, onInicio, dur, onDur, opciones, hint }) {
  return (
    <View style={{ gap: 10 }}>
      <Campo
        t={t}
        label={numero ? 'Parte ' + numero + ': ¿desde qué minuto?' : '¿Desde qué minuto empieza?'}
        value={inicio}
        onChangeText={onInicio}
        placeholder="0:45"
        keyboardType="numbers-and-punctuation"
        maxLength={5}
        hint={hint}
      />
      <View style={{ gap: 6 }}>
        <Text style={{ color: t.ink, fontWeight: '600', fontSize: 14 }}>¿Cuánto dura?</Text>
        <Chips>
          {opciones.map((d) => (
            <Chip key={d} t={t} label={d + ' s'} selected={dur === d} onPress={() => onDur(d)} />
          ))}
        </Chips>
      </View>
    </View>
  );
}

// Para que el autor arme el fragmento: una o dos partes, con botón para probarlo.
// "valor" es el objeto de fragmentoInicial(); "onCambio" recibe el objeto nuevo.
export function ElegirFragmento({ t, uri, ruta, valor, onCambio }) {
  const [largo, setLargo] = useState(null);
  const f = valor;
  const cambiar = (campo, v) => onCambio(Object.assign({}, f, { [campo]: v }));
  const res = validarFragmento(f, largo);

  function alternarDos(v) {
    // Con dos partes arrancamos con 20 + 20 segundos; con una, 30
    onCambio(Object.assign({}, f, v ? { dos: true, dur1: 20, dur2: 20 } : { dos: false, dur1: 30 }));
  }

  return (
    <View style={{ gap: 14 }}>
      <Parte
        t={t}
        numero={f.dos ? 1 : 0}
        inicio={f.inicio1}
        onInicio={(v) => cambiar('inicio1', v)}
        dur={f.dur1}
        onDur={(v) => cambiar('dur1', v)}
        opciones={f.dos ? duracionesDos : duracionesUna}
        hint={f.dos ? 'Por ejemplo, un pedazo de la primera estrofa.' : 'Por ejemplo, donde arranca el estribillo o la estrofa más linda.'}
      />
      <Interruptor
        t={t}
        label="Armarlo con dos partes"
        hint={'Suenan una detrás de otra. Entre las dos, hasta ' + MAX_FRAGMENTO + ' segundos.'}
        value={f.dos}
        onValueChange={alternarDos}
      />
      {f.dos ? (
        <Parte
          t={t}
          numero={2}
          inicio={f.inicio2}
          onInicio={(v) => cambiar('inicio2', v)}
          dur={f.dur2}
          onDur={(v) => cambiar('dur2', v)}
          opciones={duracionesDos}
          hint="Por ejemplo, el estribillo."
        />
      ) : null}
      <Aviso t={t} texto={res.error} />
      {res.partes ? (
        <Reproductor
          t={t}
          uri={uri}
          ruta={ruta}
          partes={res.partes}
          titulo="Probar el fragmento"
          subtitulo={describirPartes(res.partes) + ' · ' + res.partes.reduce((s, p) => s + p.dur, 0) + ' s en total'}
          onDuracion={setLargo}
        />
      ) : null}
    </View>
  );
}
