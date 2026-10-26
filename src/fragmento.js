// Reproductor de audio con "fragmento destacado": el autor elige desde qué segundo
// se escucha la vista previa y cuánto dura (30 o 40 segundos).
import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { Audio } from 'expo-av';
import { supabase } from './supabase';
import { Chico, Aviso, Campo, Chip, Chips } from './ui';

export const duracionesFragmento = [30, 40];

// "1:05" -> 65 ; "65" -> 65 ; inválido -> null
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

// Reproduce una canción. Si recibe "desde" y "duracion", solo suena ese fragmento.
// Fuente: "uri" (archivo local recién elegido) o "ruta" (archivo guardado en Supabase).
export function Reproductor({ t, ruta, uri, desde, duracion, titulo, subtitulo, onDuracion }) {
  const sonidoRef = useRef(null);
  const [sonando, setSonando] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [pos, setPos] = useState(0);
  const [error, setError] = useState('');
  const esFragmento = duracion != null;
  const inicioMs = (desde || 0) * 1000;
  const finMs = esFragmento ? inicioMs + duracion * 1000 : null;

  // Si cambia la canción o el fragmento, se descarta lo cargado
  useEffect(() => {
    return () => {
      const s = sonidoRef.current;
      sonidoRef.current = null;
      if (s) s.unloadAsync();
      setSonando(false);
      setPos(0);
    };
  }, [ruta, uri, desde, duracion]);

  function alActualizar(st) {
    if (!st.isLoaded) return;
    setPos(st.positionMillis || 0);
    if (st.durationMillis && onDuracion) onDuracion(st.durationMillis / 1000);
    if (finMs != null && st.isPlaying && st.positionMillis >= finMs) {
      const s = sonidoRef.current;
      if (s) s.pauseAsync().then(() => s.setPositionAsync(inicioMs));
      setSonando(false);
    }
    if (st.didJustFinish) {
      setSonando(false);
      const s = sonidoRef.current;
      if (s) s.setPositionAsync(inicioMs);
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
          if (finMs != null && (st.positionMillis < inicioMs || st.positionMillis >= finMs)) {
            await actual.setPositionAsync(inicioMs);
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
        { shouldPlay: false, progressUpdateIntervalMillis: 250 },
        alActualizar
      );
      sonidoRef.current = sound;
      if (inicioMs) await sound.setPositionAsync(inicioMs);
      await sound.playAsync();
      setSonando(true);
    } catch (e) {
      setError('No se pudo reproducir el audio. Probá de nuevo en un momento.');
    } finally {
      setCargando(false);
    }
  }

  // Barra de avance (solo para el fragmento, que tiene largo conocido)
  let avance = 0;
  if (esFragmento && pos > inicioMs) avance = Math.min(1, (pos - inicioMs) / (duracion * 1000));

  const textoTitulo = titulo || (esFragmento ? 'Fragmento destacado' : 'Escuchar el demo');
  const textoSub =
    subtitulo ||
    (esFragmento
      ? (sonando ? 'Sonando · ' : '') + duracion + ' segundos desde el ' + escribirTiempo(desde)
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
          <View style={{ height: 4, borderRadius: 2, backgroundColor: t.line, overflow: 'hidden' }}>
            <View style={{ height: 4, width: avance * 100 + '%', backgroundColor: t.destacado }} />
          </View>
        ) : null}
      </Pressable>
      <Aviso t={t} texto={error} />
    </View>
  );
}

// Para que el autor elija el fragmento: desde qué minuto y cuánto dura, con botón para probarlo.
export function ElegirFragmento({ t, uri, ruta, inicioTexto, onInicioTexto, duracion, onDuracion }) {
  const [largo, setLargo] = useState(null);
  const desde = leerTiempo(inicioTexto);
  let aviso = '';
  if (desde == null) aviso = 'Escribilo como minutos y segundos, por ejemplo 1:05.';
  else if (largo && desde >= largo) aviso = 'Tu audio dura ' + escribirTiempo(largo) + '. Elegí un momento anterior.';

  return (
    <View style={{ gap: 12 }}>
      <Campo
        t={t}
        label="¿Desde qué minuto empieza el fragmento?"
        value={inicioTexto}
        onChangeText={onInicioTexto}
        placeholder="0:45"
        keyboardType="numbers-and-punctuation"
        maxLength={5}
        hint="Por ejemplo, donde arranca el estribillo o la estrofa más linda."
      />
      <View style={{ gap: 6 }}>
        <Text style={{ color: t.ink, fontWeight: '600', fontSize: 14 }}>¿Cuánto dura?</Text>
        <Chips>
          {duracionesFragmento.map((d) => (
            <Chip key={d} t={t} label={d + ' segundos'} selected={duracion === d} onPress={() => onDuracion(d)} />
          ))}
        </Chips>
      </View>
      <Aviso t={t} texto={aviso} />
      {desde != null ? (
        <Reproductor
          t={t}
          uri={uri}
          ruta={ruta}
          desde={desde}
          duracion={duracion}
          titulo="Probar el fragmento"
          onDuracion={setLargo}
        />
      ) : null}
    </View>
  );
}
