import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { supabase } from '../supabase';
import { tiposEvento, etiquetasEstadoCancion, plata } from '../theme';
import {
  H2,
  P,
  Chico,
  Chip,
  Chips,
  Tarjeta,
  Fila,
  Etiqueta,
  Seccion,
  Cargando,
  Aviso,
  Inicial,
  Campo,
} from '../ui';
import { useGeneros, hijos, descendientes, nombreGenero } from '../generos';

// Cada pestaña tiene su color propio: verde para Inédita, dorado para Inédita en Vivo.
// La activa va rellena con su color; la otra, con borde y letras de su color.
function Selector({ t, seccion, setSeccion }) {
  const op = [
    { id: 'inedita', label: 'Inédita', color: '#1ED760', texto: '#04120A' },
    { id: 'vivo', label: 'Inédita en Vivo', color: '#F6C744', texto: '#1A0508' },
  ];
  return (
    <View
      style={{
        flexDirection: 'row',
        backgroundColor: t.surface,
        borderWidth: 1,
        borderColor: t.line,
        borderRadius: 16,
        padding: 5,
        gap: 6,
      }}
    >
      {op.map((o) => {
        const activa = seccion === o.id;
        return (
          <Pressable
            key={o.id}
            accessibilityRole="tab"
            accessibilityState={{ selected: activa }}
            onPress={() => setSeccion(o.id)}
            style={({ pressed }) => ({
              flex: 1,
              minHeight: 48,
              borderRadius: 12,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: activa ? o.color : 'transparent',
              borderWidth: activa ? 0 : 1.5,
              borderColor: o.color + '88',
              opacity: pressed ? 0.85 : 1,
            })}
          >
            <Text style={{ color: activa ? o.texto : o.color, fontWeight: '800', fontSize: 16 }}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// Luna creciente dibujada con dos círculos (sin imágenes ni librerías extra)
function Luna({ color, fondo, tamano }) {
  const s = tamano || 16;
  const hueco = s * 0.78;
  return (
    <View style={{ width: s, height: s, marginTop: -s * 0.55 }} accessibilityElementsHidden importantForAccessibility="no">
      <View style={{ position: 'absolute', width: s, height: s, borderRadius: s / 2, backgroundColor: color }} />
      <View
        style={{
          position: 'absolute',
          width: hueco,
          height: hueco,
          borderRadius: hueco / 2,
          backgroundColor: fondo,
          top: -s * 0.12,
          left: s * 0.36,
        }}
      />
    </View>
  );
}

function Destacada({ t, c, generos, stats, onPress, i }) {
  const fondos = [t.primary, t.cardC, t.cardB];
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={{
        width: 220,
        borderRadius: 20,
        backgroundColor: fondos[i % 3],
        padding: 16,
        gap: 8,
      }}
    >
      <Text style={{ color: t.eyebrow, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 }}>
        {nombreGenero(generos, c.genero_id)}
      </Text>
      <Text style={{ color: t.onCard, fontSize: 20, fontWeight: '800' }} numberOfLines={2}>
        {c.titulo}
      </Text>
      <Text style={{ color: t.cardSub, fontSize: 13 }}>de {c.perfiles ? c.perfiles.nombre : ''}</Text>
      <Text style={{ color: t.cardSub, fontSize: 13 }}>
        ♥ {stats.favoritos || 0} · {stats.pedidos || 0} pedidos
      </Text>
    </Pressable>
  );
}

function FilaCancion({ t, c, generos, onPress }) {
  const tono = c.estado === 'disponible' ? 'ok' : c.estado === 'reservada' ? 'aviso' : undefined;
  return (
    <Tarjeta t={t} onPress={onPress} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <View
        style={{
          width: 44,
          height: 44,
          borderRadius: 12,
          backgroundColor: t.soft,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text style={{ color: t.link, fontSize: 18 }}>▶</Text>
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ color: t.ink, fontWeight: '600', fontSize: 15 }} numberOfLines={1}>
          {c.titulo}
        </Text>
        <Chico t={t} numberOfLines={1}>
          {nombreGenero(generos, c.genero_id)}
          {c.tonalidad ? ' · ' + c.tonalidad : ''} · de {c.perfiles ? c.perfiles.nombre : ''}
        </Chico>
      </View>
      {c.para_versionar ? (
        <Etiqueta t={t} text="Para versionar" />
      ) : (
        <Etiqueta t={t} text={etiquetasEstadoCancion[c.estado] || c.estado} tono={tono} />
      )}
    </Tarjeta>
  );
}

function Banner({ t, titulo, texto, onPress }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={{
        borderRadius: 18,
        backgroundColor: t.destacadoSoft,
        borderWidth: 1,
        borderColor: t.destacadoLine,
        padding: 16,
        gap: 4,
      }}
    >
      <Text style={{ color: t.ink, fontWeight: '700', fontSize: 15 }}>{titulo}</Text>
      <Chico t={t}>{texto}</Chico>
    </Pressable>
  );
}

function InicioInedita({ t, nav }) {
  const generos = useGeneros();
  const [familia, setFamilia] = useState(null);
  const [busqueda, setBusqueda] = useState('');
  const [lista, setLista] = useState(null);
  const [stats, setStats] = useState({});
  const [error, setError] = useState('');

  const cargar = useCallback(async () => {
    setError('');
    let q = supabase
      .from('canciones')
      .select('id,titulo,genero_id,tonalidad,estado,destacada,para_versionar,compositor_id,creado_en,perfiles:perfiles!canciones_compositor_id_fkey(nombre)')
      .neq('estado', 'oculta')
      .order('creado_en', { ascending: false })
      .limit(60);
    if (familia && generos.length) q = q.in('genero_id', descendientes(generos, familia));
    if (busqueda.trim()) q = q.ilike('titulo', '%' + busqueda.trim() + '%');
    const { data, error: e } = await q;
    if (e) {
      setError('No se pudieron cargar las canciones.');
      setLista([]);
      return;
    }
    setLista(data || []);
    const ids = (data || []).map((c) => c.id);
    if (ids.length) {
      const { data: st } = await supabase.from('estadisticas_cancion').select('*').in('cancion_id', ids);
      const m = {};
      (st || []).forEach((s) => {
        m[s.cancion_id] = s;
      });
      setStats(m);
    }
  }, [familia, busqueda, generos]);

  useEffect(() => {
    const id = setTimeout(cargar, busqueda ? 350 : 0);
    return () => clearTimeout(id);
  }, [cargar, busqueda]);

  const destacadas = (lista || []).filter((c) => c.destacada);
  const versionar = (lista || []).filter((c) => c.para_versionar);
  const recientes = (lista || []).filter((c) => !c.para_versionar);

  return (
    <View style={{ gap: 22 }}>
      <Campo t={t} value={busqueda} onChangeText={setBusqueda} placeholder="Buscar por título…" />
      <Chips>
        <Chip t={t} label="Todos" selected={!familia} onPress={() => setFamilia(null)} />
        {hijos(generos, null).map((g) => (
          <Chip key={g.id} t={t} label={g.nombre} selected={familia === g.id} onPress={() => setFamilia(g.id)} />
        ))}
      </Chips>

      <Aviso t={t} texto={error} />
      {lista === null ? <Cargando t={t} /> : null}

      {destacadas.length ? (
        <Seccion t={t} titulo="Destacadas">
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12 }}>
            {destacadas.map((c, i) => (
              <Destacada
                key={c.id}
                t={t}
                c={c}
                i={i}
                generos={generos}
                stats={stats[c.id] || {}}
                onPress={() => nav.ir('cancion', { id: c.id })}
              />
            ))}
          </ScrollView>
        </Seccion>
      ) : null}

      {lista !== null ? (
        <Seccion t={t} titulo="Recién subidas">
          {recientes.length === 0 ? (
            <P t={t} muted>
              Todavía no hay canciones acá. ¡Subí la primera!
            </P>
          ) : (
            recientes.map((c) => (
              <FilaCancion key={c.id} t={t} c={c} generos={generos} onPress={() => nav.ir('cancion', { id: c.id })} />
            ))
          )}
        </Seccion>
      ) : null}

      {versionar.length ? (
        <Seccion t={t} titulo="Para versionar">
          <Chico t={t}>Canciones ya grabadas por sus autores, listas para que las cantes vos.</Chico>
          {versionar.map((c) => (
            <FilaCancion key={c.id} t={t} c={c} generos={generos} onPress={() => nav.ir('cancion', { id: c.id })} />
          ))}
        </Seccion>
      ) : null}

      <Banner
        t={t}
        titulo="¿Tenés una canción guardada?"
        texto="Subila en 2 minutos, aunque sea grabada con el celular."
        onPress={() => nav.ir('subir', {})}
      />
    </View>
  );
}

function InicioVivo({ t, nav }) {
  const generos = useGeneros();
  const [tipo, setTipo] = useState('artista');
  const [evento, setEvento] = useState(null);
  const [lista, setLista] = useState(null);
  const [stats, setStats] = useState({});
  const [error, setError] = useState('');

  const cargar = useCallback(async () => {
    setError('');
    setLista(null);
    let q = supabase
      .from('propuestas_vivo')
      .select('*, perfiles:perfiles!propuestas_vivo_artista_id_fkey(nombre), propuesta_generos(genero_id)')
      .eq('activa', true)
      .eq('tipo', tipo)
      .order('destacada', { ascending: false })
      .order('creado_en', { ascending: false })
      .limit(60);
    if (evento) q = q.contains('tipos_evento', [evento]);
    const { data, error: e } = await q;
    if (e) {
      setError('No se pudieron cargar las propuestas.');
      setLista([]);
      return;
    }
    setLista(data || []);
    const ids = Array.from(new Set((data || []).map((p) => p.artista_id)));
    if (ids.length) {
      const { data: st } = await supabase.from('estadisticas_vivo').select('*').in('artista_id', ids);
      const m = {};
      (st || []).forEach((s) => {
        m[s.artista_id] = s;
      });
      setStats(m);
    }
  }, [tipo, evento]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  function Mosaico({ id, titulo, sub }) {
    const sel = tipo === id;
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ selected: sel }}
        onPress={() => setTipo(id)}
        style={{
          flex: 1,
          backgroundColor: t.surface,
          borderRadius: 16,
          padding: 14,
          gap: 4,
          borderWidth: sel ? 1.5 : 1,
          borderColor: sel ? t.link : t.line,
        }}
      >
        <Text style={{ color: t.ink, fontWeight: '700', fontSize: 15 }}>{titulo}</Text>
        <Chico t={t}>{sub}</Chico>
      </Pressable>
    );
  }

  return (
    <View style={{ gap: 22 }}>
      <View style={{ backgroundColor: t.primary, borderRadius: 20, padding: 18, gap: 8 }}>
        <Text style={{ color: t.onCard, fontSize: 22, fontWeight: '800' }}>Música en vivo para tu evento</Text>
        <Text style={{ color: t.cardSub, fontSize: 14 }}>
          Encontrá artistas y sonido, pedí presupuesto y confirmá todo desde la app.
        </Text>
      </View>

      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Mosaico id="artista" titulo="Artistas" sub="Bandas, dúos, solistas" />
        <Mosaico id="sonido" titulo="Sonido y luces" sub="Sonidistas y equipos" />
      </View>

      <Chips>
        <Chip t={t} label="Todos" selected={!evento} onPress={() => setEvento(null)} />
        {tiposEvento.map((e) => (
          <Chip key={e} t={t} label={e} selected={evento === e} onPress={() => setEvento(e)} />
        ))}
      </Chips>

      <Aviso t={t} texto={error} />

      <Seccion t={t} titulo={tipo === 'artista' ? 'Artistas' : 'Sonido y luces'}>
        {lista === null ? <Cargando t={t} /> : null}
        {lista && lista.length === 0 ? (
          <P t={t} muted>
            Todavía no hay propuestas acá.
          </P>
        ) : null}
        {(lista || []).map((p) => {
          const st = stats[p.artista_id] || {};
          const gens = (p.propuesta_generos || []).map((g) => nombreGenero(generos, g.genero_id)).filter(Boolean);
          let detalle = '';
          if (p.tipo === 'artista') {
            detalle = [gens.slice(0, 3).join(', '), p.formacion, (p.provincias || []).join(', ')].filter(Boolean).join(' · ');
          } else {
            detalle = [
              p.capacidad_personas ? 'Hasta ' + p.capacidad_personas + ' personas' : '',
              p.incluye_iluminacion ? 'con luces' : '',
              (p.provincias || []).join(', '),
            ]
              .filter(Boolean)
              .join(' · ');
          }
          return (
            <Tarjeta key={p.id} t={t} onPress={() => nav.ir('propuesta', { id: p.id })}>
              <Fila>
                <Inicial t={t} nombre={p.nombre_artistico} fondo={t.cardB} color="#FFFFFF" />
                <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                  <Text style={{ color: t.ink, fontWeight: '700', fontSize: 16 }} numberOfLines={1}>
                    {p.nombre_artistico}
                  </Text>
                  <Chico t={t} numberOfLines={2}>
                    {detalle}
                  </Chico>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={{ color: t.ink, fontWeight: '700' }}>
                    {st.promedio ? '★ ' + String(st.promedio).replace('.', ',') : 'Nuevo'}
                  </Text>
                  <Chico t={t}>{st.shows_realizados || 0} eventos</Chico>
                </View>
              </Fila>
              <Fila style={{ justifyContent: 'space-between' }}>
                {p.incluye_sonido ? <Etiqueta t={t} text="Incluye sonido" /> : <View />}
                {p.precio_desde ? <Chico t={t}>Desde {plata(p.precio_desde)}</Chico> : null}
              </Fila>
            </Tarjeta>
          );
        })}
      </Seccion>

      <Banner
        t={t}
        titulo="¿Tocás en vivo?"
        texto="Armá tu propuesta y recibí pedidos de fechas."
        onPress={() => nav.ir('editarPropuesta', { tipo: 'artista' })}
      />
      <Banner
        t={t}
        titulo="¿Sos sonidista o tenés equipo?"
        texto="Ofrecé tu servicio y que te contraten para eventos."
        onPress={() => nav.ir('editarPropuesta', { tipo: 'sonido' })}
      />
    </View>
  );
}

export default function Inicio(props) {
  const { t, seccion, setSeccion, perfil, nav } = props;
  return (
    <View style={{ gap: 18 }}>
      <Fila style={{ justifyContent: 'space-between' }}>
        <Fila style={{ gap: 6 }}>
          <Text style={{ color: t.ink, fontSize: 30, fontWeight: '800', letterSpacing: -0.5 }}>Inédita</Text>
          {seccion === 'vivo' ? (
            <Fila style={{ gap: 5, alignItems: 'flex-end' }}>
              <Text style={{ color: t.link, fontSize: 18, fontWeight: '700' }}>en Vivo</Text>
              <Luna color={t.link} fondo={t.bg} tamano={16} />
            </Fila>
          ) : null}
        </Fila>
        <Pressable accessibilityRole="button" accessibilityLabel="Mi perfil" onPress={() => nav.raiz('perfil')}>
          <Inicial t={t} nombre={perfil.nombre} />
        </Pressable>
      </Fila>
      <P t={t} muted>
        Hola, {perfil.nombre}. ¿Qué buscás hoy?
      </P>
      <Selector t={t} seccion={seccion} setSeccion={setSeccion} />
      {seccion === 'vivo' ? <InicioVivo {...props} /> : <InicioInedita {...props} />}
    </View>
  );
}
