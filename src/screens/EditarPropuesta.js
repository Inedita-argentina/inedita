import React, { useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import { supabase } from '../supabase';
import { tiposEvento, formaciones } from '../theme';
import { Encabezado, P, Chico, Campo, Boton, Aviso, Tarjeta, H2, Chip, Chips, Interruptor, Cargando } from '../ui';
import { useGeneros, SelectorGenerosMultiple } from '../generos';

function aLista(texto) {
  return texto
    .split(/[\n,]/)
    .map((x) => x.trim())
    .filter(Boolean);
}

export default function EditarPropuesta({ t, nav, uid, params, perfil, recargarPerfil }) {
  const generos = useGeneros();
  const [cargado, setCargado] = useState(!params.id);
  const [id, setId] = useState(params.id || null);
  const [tipo, setTipo] = useState(params.tipo || (perfil.es_sonidista && !perfil.es_artista ? 'sonido' : 'artista'));
  const [nombre, setNombre] = useState(perfil.nombre || '');
  const [descripcion, setDescripcion] = useState('');
  const [formacion, setFormacion] = useState('');
  const [integrantes, setIntegrantes] = useState('');
  const [gens, setGens] = useState([]);
  const [otroGenero, setOtroGenero] = useState('');
  const [incluyeSonido, setIncluyeSonido] = useState(false);
  const [equipamiento, setEquipamiento] = useState('');
  const [capacidad, setCapacidad] = useState('');
  const [iluminacion, setIluminacion] = useState(false);
  const [provincias, setProvincias] = useState(perfil.provincia || '');
  const [eventos, setEventos] = useState([]);
  const [duracion, setDuracion] = useState('');
  const [precio, setPrecio] = useState('');
  const [videos, setVideos] = useState('');
  const [activa, setActiva] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!params.id) return;
    (async () => {
      const { data } = await supabase
        .from('propuestas_vivo')
        .select('*, propuesta_generos(genero_id)')
        .eq('id', params.id)
        .maybeSingle();
      if (data) {
        setTipo(data.tipo);
        setNombre(data.nombre_artistico || '');
        setDescripcion(data.descripcion || '');
        setFormacion(data.formacion || '');
        setIntegrantes(data.integrantes ? String(data.integrantes) : '');
        setGens((data.propuesta_generos || []).map((g) => g.genero_id));
        setOtroGenero(data.otro_genero || '');
        setIncluyeSonido(!!data.incluye_sonido);
        setEquipamiento(data.equipamiento || '');
        setCapacidad(data.capacidad_personas ? String(data.capacidad_personas) : '');
        setIluminacion(!!data.incluye_iluminacion);
        setProvincias((data.provincias || []).join(', '));
        setEventos(data.tipos_evento || []);
        setDuracion(data.duracion_minutos ? String(data.duracion_minutos) : '');
        setPrecio(data.precio_desde ? String(Math.round(data.precio_desde)) : '');
        setVideos((data.videos || []).join('\n'));
        setActiva(!!data.activa);
      }
      setCargado(true);
    })();
  }, [params.id]);

  function alternarEvento(e) {
    if (eventos.indexOf(e) >= 0) setEventos(eventos.filter((x) => x !== e));
    else setEventos(eventos.concat(e));
  }

  async function guardar() {
    setError('');
    if (!nombre.trim()) return setError('Poné el nombre artístico o del servicio.');
    if (tipo === 'artista' && !gens.length && !otroGenero.trim()) return setError('Elegí al menos un género.');
    setGuardando(true);
    const fila = {
      artista_id: uid,
      tipo,
      nombre_artistico: nombre.trim(),
      descripcion: descripcion.trim() || null,
      formacion: tipo === 'artista' ? formacion || null : null,
      integrantes: tipo === 'artista' ? parseInt(integrantes, 10) || null : null,
      incluye_sonido: tipo === 'artista' ? incluyeSonido : false,
      otro_genero: tipo === 'artista' ? otroGenero.trim() || null : null,
      equipamiento: tipo === 'sonido' ? equipamiento.trim() || null : null,
      capacidad_personas: tipo === 'sonido' ? parseInt(capacidad, 10) || null : null,
      incluye_iluminacion: tipo === 'sonido' ? iluminacion : false,
      provincias: aLista(provincias),
      tipos_evento: eventos,
      duracion_minutos: parseInt(duracion, 10) || null,
      precio_desde: parseInt(String(precio).replace(/\D/g, ''), 10) || null,
      videos: aLista(videos),
      activa,
    };
    let propuestaId = id;
    let res;
    if (id) res = await supabase.from('propuestas_vivo').update(fila).eq('id', id).select('id').single();
    else res = await supabase.from('propuestas_vivo').insert(fila).select('id').single();
    if (res.error) {
      setGuardando(false);
      setError('No se pudo guardar. Revisá los datos y probá de nuevo.');
      return;
    }
    propuestaId = res.data.id;
    setId(propuestaId);
    await supabase.from('propuesta_generos').delete().eq('propuesta_id', propuestaId);
    if (tipo === 'artista' && gens.length) {
      await supabase.from('propuesta_generos').insert(gens.map((g) => ({ propuesta_id: propuestaId, genero_id: g })));
    }
    const rol = tipo === 'sonido' ? { es_sonidista: true } : { es_artista: true };
    if ((tipo === 'sonido' && !perfil.es_sonidista) || (tipo === 'artista' && !perfil.es_artista)) {
      await supabase.from('perfiles').update(rol).eq('id', uid);
      recargarPerfil();
    }
    setGuardando(false);
    nav.reemplazar('propuesta', { id: propuestaId });
  }

  if (!cargado) {
    return (
      <View style={{ gap: 16 }}>
        <Encabezado t={t} onVolver={nav.volver} />
        <Cargando t={t} />
      </View>
    );
  }

  return (
    <View style={{ gap: 18 }}>
      <Encabezado t={t} onVolver={nav.volver} titulo={id ? 'Editar propuesta' : 'Tu propuesta en vivo'} />
      <P t={t} muted>
        Así te van a encontrar los que organizan eventos.
      </P>

      {!id ? (
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Chip t={t} label="Soy artista o banda" selected={tipo === 'artista'} onPress={() => setTipo('artista')} />
          <Chip t={t} label="Ofrezco sonido / luces" selected={tipo === 'sonido'} onPress={() => setTipo('sonido')} />
        </View>
      ) : null}

      <Campo t={t} label={tipo === 'artista' ? 'Nombre artístico' : 'Nombre del servicio'} value={nombre} onChangeText={setNombre} />
      <Campo
        t={t}
        label="Descripción"
        value={descripcion}
        onChangeText={setDescripcion}
        multiline
        placeholder={tipo === 'artista' ? 'Qué tocan, trayectoria, qué ofrecen…' : 'Qué incluye tu servicio, experiencia…'}
      />

      {tipo === 'artista' ? (
        <View style={{ gap: 18 }}>
          <View style={{ gap: 6 }}>
            <Text style={{ color: t.ink, fontWeight: '600', fontSize: 14 }}>Formación</Text>
            <Chips>
              {formaciones.map((fo) => (
                <Chip key={fo.id} t={t} label={fo.nombre} selected={formacion === fo.id} onPress={() => setFormacion(fo.id)} />
              ))}
            </Chips>
          </View>
          <Campo t={t} label="Cantidad de integrantes" value={integrantes} onChangeText={setIntegrantes} keyboardType="number-pad" />
          <Tarjeta t={t}>
            <H2 t={t}>Géneros que tocan</H2>
            <SelectorGenerosMultiple t={t} lista={generos} valores={gens} onCambio={setGens} otro={otroGenero} onOtro={setOtroGenero} />
          </Tarjeta>
          <Interruptor
            t={t}
            label="Contamos con nuestro propio sonido"
            hint="Muchos lugares buscan bandas con sonido incluido."
            value={incluyeSonido}
            onValueChange={setIncluyeSonido}
          />
        </View>
      ) : (
        <View style={{ gap: 18 }}>
          <Campo t={t} label="Equipamiento" value={equipamiento} onChangeText={setEquipamiento} multiline placeholder="Consola, parlantes, micrófonos, monitores…" />
          <Campo t={t} label="¿Para cuántas personas sirve?" value={capacidad} onChangeText={setCapacidad} keyboardType="number-pad" />
          <Interruptor t={t} label="Incluye iluminación" value={iluminacion} onValueChange={setIluminacion} />
        </View>
      )}

      <Campo t={t} label="Zonas donde trabajás" value={provincias} onChangeText={setProvincias} hint="Separadas por coma. Ej.: Córdoba, Santa Fe" />
      <View style={{ gap: 6 }}>
        <Text style={{ color: t.ink, fontWeight: '600', fontSize: 14 }}>Tipos de evento</Text>
        <Chips>
          {tiposEvento.map((e) => (
            <Chip key={e} t={t} label={e} selected={eventos.indexOf(e) >= 0} onPress={() => alternarEvento(e)} />
          ))}
        </Chips>
      </View>
      <Campo t={t} label="Duración habitual (minutos)" value={duracion} onChangeText={setDuracion} keyboardType="number-pad" />
      <Campo t={t} label="Precio desde ($, opcional)" value={precio} onChangeText={setPrecio} keyboardType="number-pad" />
      <Campo t={t} label="Links a videos" value={videos} onChangeText={setVideos} multiline autoCapitalize="none" hint="Uno por línea: YouTube, Instagram, etc." />
      {id ? <Interruptor t={t} label="Propuesta activa" hint="Si la desactivás, no aparece en las búsquedas." value={activa} onValueChange={setActiva} /> : null}

      <Aviso t={t} texto={error} />
      <Boton t={t} variant="accent" title="Guardar propuesta" onPress={guardar} loading={guardando} />
      <Chico t={t}>Podés cambiarla cuando quieras.</Chico>
    </View>
  );
}
