import React, { useState } from 'react';
import { View, Text } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { supabase, subirArchivo } from '../supabase';
import { voces } from '../theme';
import { Encabezado, P, Chico, Campo, Boton, Aviso, Tarjeta, H2, Chip, Chips, Interruptor, Fila } from '../ui';
import { useGeneros, SelectorGenero } from '../generos';
import { analizarAudio, puedeAnalizar } from '../analisisAudio';
import { ElegirFragmento, validarFragmento, columnasFragmento, fragmentoInicial } from '../fragmento';

const roles = [
  { id: 'letra_y_musica', nombre: 'Letra y música' },
  { id: 'letra', nombre: 'Letra' },
  { id: 'musica', nombre: 'Música' },
];

function ControlesAudio({ t, analisis }) {
  if (!analisis) return null;
  if (analisis === 'revisando') return <Chico t={t}>Revisando el audio…</Chico>;
  if (analisis === 'sin_revisar') {
    return <Chico t={t}>No pudimos revisar este audio automáticamente. Lo revisamos nosotros antes de publicarlo.</Chico>;
  }
  const color = { ok: '#1ED760', aviso: '#F6C744', bloquea: '#FF6B6B' };
  const icono = { ok: '✓', aviso: '!', bloquea: '✕' };
  return (
    <View style={{ gap: 6 }}>
      {analisis.controles.map((c) => (
        <View key={c.id} style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-start' }}>
          <Text style={{ color: color[c.estado], fontWeight: '800', width: 14, textAlign: 'center' }}>{icono[c.estado]}</Text>
          <Text style={{ color: c.estado === 'ok' ? t.muted : t.ink, flex: 1, fontSize: 13, lineHeight: 18 }}>{c.texto}</Text>
        </View>
      ))}
      {analisis.bloquea ? (
        <Text style={{ color: '#FF6B6B', fontWeight: '700', fontSize: 13 }}>Este audio no se puede subir. Elegí otro.</Text>
      ) : null}
    </View>
  );
}

export default function SubirCancion({ t, nav, uid, perfil }) {
  const generos = useGeneros();
  const [titulo, setTitulo] = useState('');
  const [genero, setGenero] = useState(null);
  const [tonalidad, setTonalidad] = useState('');
  const [voz, setVoz] = useState('indistinta');
  const [tematica, setTematica] = useState('');
  const [letra, setLetra] = useState('');
  const [sadaic, setSadaic] = useState(false);
  const [registro, setRegistro] = useState('');
  const [publicada, setPublicada] = useState(false);
  const [versionar, setVersionar] = useState(false);
  const [youtube, setYoutube] = useState('');
  const [spotify, setSpotify] = useState('');
  const [anio, setAnio] = useState('');
  const [audio, setAudio] = useState(null);
  const [frag, setFrag] = useState(fragmentoInicial(null));
  const [analisis, setAnalisis] = useState(null); // null | 'revisando' | 'sin_revisar' | resultado
  const [autores, setAutores] = useState([{ nombre: perfil.nombre || '', rol: 'letra_y_musica', porcentaje: '100' }]);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  async function elegirAudio() {
    setError('');
    const res = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true });
    if (res.canceled || !res.assets || !res.assets.length) return;
    const a = res.assets[0];
    const ext = ((a.name || '').split('.').pop() || '').toLowerCase();
    const permitidas = ['mp3', 'm4a', 'wav', 'aac', 'ogg', 'opus', 'mp4', 'webm'];
    if (permitidas.indexOf(ext) < 0 && !(a.mimeType || '').startsWith('audio/')) {
      setError('Ese archivo no parece un audio. Probá con mp3, m4a, wav, aac, ogg u opus.');
      return;
    }
    if (a.size && a.size > 25 * 1024 * 1024) {
      setError('El audio pesa más de 25 MB. Probá con una grabación más corta o en mp3.');
      return;
    }
    setAudio(a);
    if (!puedeAnalizar()) {
      setAnalisis(null);
      return;
    }
    setAnalisis('revisando');
    try {
      const r = await analizarAudio(a);
      setAnalisis(r || 'sin_revisar');
    } catch (e) {
      setAnalisis('sin_revisar');
    }
  }

  function cambiarAutor(i, campo, valor) {
    const copia = autores.slice();
    copia[i] = Object.assign({}, copia[i], { [campo]: valor });
    setAutores(copia);
  }

  async function guardar() {
    setError('');
    if (!titulo.trim()) return setError('Poné el título de la canción.');
    if (!genero) return setError('Elegí el género.');
    if (publicada && !youtube.trim() && !spotify.trim()) {
      return setError('Si la canción ya está publicada, pegá el link de YouTube o de Spotify.');
    }
    if (!publicada && !audio) return setError('Subí el audio del demo para que los artistas la puedan escuchar.');
    if (audio && analisis === 'revisando') return setError('Esperá un momento: estamos revisando el audio.');
    if (audio && analisis && analisis.bloquea) return setError('El audio no cumple los requisitos. Mirá los detalles en "Audio del demo".');
    const fragRes = validarFragmento(frag);
    if (audio && fragRes.error) return setError('Fragmento destacado: ' + fragRes.error);
    const autoresValidos = autores.filter((a) => a.nombre.trim());
    const suma = autoresValidos.reduce((s, a) => s + (parseFloat(String(a.porcentaje).replace(',', '.')) || 0), 0);
    if (suma > 100.01) return setError('Los porcentajes de los autores suman más de 100%.');

    setGuardando(true);
    try {
      let audioPath = null;
      if (audio) audioPath = await subirArchivo('audios', uid, audio);
      const { data, error: e } = await supabase
        .from('canciones')
        .insert({
          compositor_id: uid,
          titulo: titulo.trim(),
          genero_id: genero,
          tonalidad: tonalidad.trim() || null,
          voz,
          tematica: tematica.trim() || null,
          audio_path: audioPath,
          ...(audioPath ? columnasFragmento(fragRes.partes) : {}),
          registrada_sadaic: sadaic,
          numero_registro: sadaic ? registro.trim() || null : null,
          ya_publicada: publicada,
          para_versionar: publicada && versionar,
          enlace_youtube: publicada ? youtube.trim() || null : null,
          enlace_spotify: publicada ? spotify.trim() || null : null,
          anio_publicacion: publicada && anio ? parseInt(anio, 10) || null : null,
        })
        .select('id')
        .single();
      if (e) throw e;
      if (letra.trim()) await supabase.from('letras').insert({ cancion_id: data.id, letra: letra.trim() });
      if (autoresValidos.length) {
        await supabase.from('autores').insert(
          autoresValidos.map((a) => ({
            cancion_id: data.id,
            nombre: a.nombre.trim(),
            rol: a.rol,
            porcentaje: parseFloat(String(a.porcentaje).replace(',', '.')) || null,
          }))
        );
      }
      if (!perfil.es_compositor) await supabase.from('perfiles').update({ es_compositor: true }).eq('id', uid);
      setGuardando(false);
      nav.reemplazar('cancion', { id: data.id });
    } catch (e) {
      setGuardando(false);
      const m = (e && e.message) || '';
      if (/mime|type/i.test(m)) setError('Ese tipo de archivo no se puede subir. Probá con mp3, m4a, wav u ogg.');
      else setError('No se pudo guardar la canción. Revisá los datos y probá de nuevo.');
    }
  }

  return (
    <View style={{ gap: 18 }}>
      <Encabezado t={t} onVolver={nav.volver} titulo="Subir una canción" />
      <P t={t} muted>
        Completá lo que puedas. Lo importante es el título, el género y el audio.
      </P>

      <Campo t={t} label="Título" value={titulo} onChangeText={setTitulo} />

      <Tarjeta t={t}>
        <H2 t={t}>Género</H2>
        <SelectorGenero t={t} lista={generos} valor={genero} onCambio={setGenero} />
      </Tarjeta>

      <Tarjeta t={t}>
        <H2 t={t}>¿Ya está grabada y publicada?</H2>
        <Interruptor
          t={t}
          label="Sí, ya la grabé y está publicada"
          hint="Si la marcás, pegá el link para que se escuche completa."
          value={publicada}
          onValueChange={setPublicada}
        />
        {publicada ? (
          <View style={{ gap: 12 }}>
            <Campo t={t} label="Link de YouTube" value={youtube} onChangeText={setYoutube} autoCapitalize="none" placeholder="https://youtube.com/…" />
            <Campo t={t} label="Link de Spotify" value={spotify} onChangeText={setSpotify} autoCapitalize="none" placeholder="https://open.spotify.com/…" />
            <Campo t={t} label="Año en que se publicó" value={anio} onChangeText={setAnio} keyboardType="number-pad" maxLength={4} />
            <Interruptor
              t={t}
              label="Disponible para versionar"
              hint="Otros artistas pueden pedirte grabar su propia versión."
              value={versionar}
              onValueChange={setVersionar}
            />
          </View>
        ) : null}
      </Tarjeta>

      <Tarjeta t={t}>
        <H2 t={t}>Audio del demo</H2>
        <Chico t={t}>Puede ser una grabación con el celular: guitarra y voz alcanzan. Hasta 25 MB.</Chico>
        <Boton t={t} variant="outline" title={audio ? 'Cambiar audio' : 'Elegir audio'} onPress={elegirAudio} />
        {audio ? <Text style={{ color: t.link, fontWeight: '600' }}>✓ {audio.name}</Text> : null}
        <ControlesAudio t={t} analisis={audio ? analisis : null} />
        {!audio ? (
          <View style={{ gap: 4, paddingTop: 4 }}>
            <Text style={{ color: t.ink, fontWeight: '700', fontSize: 14 }}>Para que tu demo suene bien</Text>
            <Chico t={t}>• Entre 1 y 8 minutos.</Chico>
            <Chico t={t}>• Celular cerca, pero no pegado a la boca ni a la guitarra.</Chico>
            <Chico t={t}>• Un lugar sin eco ni ruido de fondo (ni tele, ni calle, ni ventilador).</Chico>
            <Chico t={t}>• Mejor en mp3 o m4a que como nota de voz de WhatsApp.</Chico>
          </View>
        ) : null}
      </Tarjeta>

      {audio && !(analisis && analisis.bloquea) ? (
        <Tarjeta t={t}>
          <H2 t={t}>Fragmento destacado</H2>
          <Chico t={t}>
            Es lo primero que escucha un artista: elegí la parte que más vende tu canción, o armalo con dos partes. Probalo antes de publicar.
          </Chico>
          <ElegirFragmento
            t={t}
            uri={audio.uri}
            valor={frag}
            onCambio={setFrag}
          />
        </Tarjeta>
      ) : null}

      <Campo t={t} label="Tonalidad (opcional)" value={tonalidad} onChangeText={setTonalidad} placeholder="Ej.: Re menor" />
      <View style={{ gap: 6 }}>
        <Text style={{ color: t.ink, fontWeight: '600', fontSize: 14 }}>Para qué voz</Text>
        <Chips>
          {voces.map((v) => (
            <Chip key={v.id} t={t} label={v.nombre} selected={voz === v.id} onPress={() => setVoz(v.id)} />
          ))}
        </Chips>
      </View>
      <Campo t={t} label="Temática (opcional)" value={tematica} onChangeText={setTematica} placeholder="Ej.: amor, el río, la tierra" />
      <Campo t={t} label="Letra (opcional)" value={letra} onChangeText={setLetra} multiline hint="Solo la ven los artistas con la cuota al día." />

      <Tarjeta t={t}>
        <H2 t={t}>Autores</H2>
        <Chico t={t}>Como en el registro de SADAIC: quién escribió la letra, quién la música y qué porcentaje tiene cada uno.</Chico>
        {autores.map((a, i) => (
          <View key={i} style={{ gap: 8, paddingTop: i ? 10 : 0, borderTopWidth: i ? 1 : 0, borderTopColor: t.line }}>
            <Campo t={t} label={'Autor ' + (i + 1)} value={a.nombre} onChangeText={(v) => cambiarAutor(i, 'nombre', v)} placeholder="Nombre y apellido" />
            <Chips>
              {roles.map((r) => (
                <Chip key={r.id} t={t} label={r.nombre} selected={a.rol === r.id} onPress={() => cambiarAutor(i, 'rol', r.id)} />
              ))}
            </Chips>
            <Fila>
              <Campo
                t={t}
                style={{ flex: 1 }}
                label="Porcentaje"
                value={a.porcentaje}
                onChangeText={(v) => cambiarAutor(i, 'porcentaje', v)}
                keyboardType="decimal-pad"
              />
              {autores.length > 1 ? (
                <Boton t={t} chico variant="quiet" title="Quitar" onPress={() => setAutores(autores.filter((_, j) => j !== i))} style={{ marginTop: 22 }} />
              ) : null}
            </Fila>
          </View>
        ))}
        <Boton
          t={t}
          chico
          variant="outline"
          title="+ Agregar otro autor"
          onPress={() => setAutores(autores.concat({ nombre: '', rol: 'letra', porcentaje: '' }))}
        />
      </Tarjeta>

      <Tarjeta t={t}>
        <Interruptor t={t} label="Está registrada en SADAIC" value={sadaic} onValueChange={setSadaic} />
        {sadaic ? <Campo t={t} label="Número de registro (opcional)" value={registro} onChangeText={setRegistro} /> : null}
      </Tarjeta>

      <Aviso t={t} texto={error} />
      <Boton t={t} variant="accent" title="Publicar canción" onPress={guardar} loading={guardando} />
      <Chico t={t}>
        Al publicar, confirmás que sos autor o tenés permiso de los autores para compartirla. Las canciones nuevas pasan por una
        revisión antes de aparecer en el catálogo.
      </Chico>
    </View>
  );
}
