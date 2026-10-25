import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, Linking } from 'react-native';
import { supabase } from '../supabase';
import { semaforoCuota, etiquetasEstadoCancion } from '../theme';
import {
  H1,
  H2,
  P,
  Chico,
  Campo,
  Boton,
  Aviso,
  Tarjeta,
  Interruptor,
  Semaforo,
  Seccion,
  Fila,
  Etiqueta,
  Chips,
  Inicial,
  Encabezado,
} from '../ui';

export default function Perfil({ t, uid, perfil, recargarPerfil, nav }) {
  const [nombre, setNombre] = useState(perfil.nombre || '');
  const [provincia, setProvincia] = useState(perfil.provincia || '');
  const [localidad, setLocalidad] = useState(perfil.localidad || '');
  const [bio, setBio] = useState(perfil.bio || '');
  const [roles, setRoles] = useState({
    es_compositor: !!perfil.es_compositor,
    es_artista: !!perfil.es_artista,
    es_organizador: !!perfil.es_organizador,
    es_sonidista: !!perfil.es_sonidista,
  });
  const [canciones, setCanciones] = useState([]);
  const [propuestas, setPropuestas] = useState([]);
  const [insignias, setInsignias] = useState([]);
  const [stats, setStats] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  const [mail, setMail] = useState('');
  const [modoPrueba, setModoPrueba] = useState(false);

  const cargar = useCallback(async () => {
    const [c, p, i, s, u, cfg] = await Promise.all([
      supabase.from('canciones').select('id,titulo,estado,para_versionar').eq('compositor_id', uid).order('creado_en', { ascending: false }),
      supabase.from('propuestas_vivo').select('id,nombre_artistico,tipo,activa').eq('artista_id', uid),
      supabase.from('insignias').select('*').eq('perfil_id', uid),
      supabase.from('estadisticas_compositor').select('*').eq('compositor_id', uid).maybeSingle(),
      supabase.auth.getUser(),
      supabase.from('configuracion').select('modo_prueba').eq('id', 1).maybeSingle(),
    ]);
    setCanciones(c.data || []);
    setPropuestas(p.data || []);
    setInsignias(i.data || []);
    setStats(s.data || null);
    setMail(u.data && u.data.user ? u.data.user.email : '');
    setModoPrueba(!!(cfg.data && cfg.data.modo_prueba));
  }, [uid]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const cuota = modoPrueba && !perfil.es_admin
    ? { color: 'verde', texto: 'Período de prueba: acceso completo y gratis' }
    : semaforoCuota(perfil.cuota_vence, perfil.es_admin);

  async function guardar() {
    setError('');
    setOk('');
    if (!nombre.trim()) return setError('El nombre no puede quedar vacío.');
    if (!roles.es_compositor && !roles.es_artista && !roles.es_organizador && !roles.es_sonidista) {
      return setError('Dejá al menos una opción marcada.');
    }
    setGuardando(true);
    const { error: e } = await supabase
      .from('perfiles')
      .update(
        Object.assign(
          { nombre: nombre.trim(), provincia: provincia.trim() || null, localidad: localidad.trim() || null, bio: bio.trim() || null },
          roles
        )
      )
      .eq('id', uid);
    setGuardando(false);
    if (e) setError('No se pudo guardar.');
    else {
      setOk('Perfil actualizado.');
      recargarPerfil();
    }
  }

  return (
    <View style={{ gap: 22 }}>
      <Encabezado t={t} onVolver={() => nav.raiz('inicio')} />
      <Fila>
        <Inicial t={t} nombre={perfil.nombre} tamano={56} />
        <View style={{ flex: 1 }}>
          <H1 t={t}>{perfil.nombre}</H1>
          <Chico t={t}>{mail}</Chico>
        </View>
      </Fila>

      <Tarjeta t={t}>
        <H2 t={t}>Tu cuota</H2>
        <Semaforo t={t} color={cuota.color} texto={cuota.texto} />
        <Chico t={t}>
          Con la cuota al día escuchás todos los demos, leés las letras y pedís canciones. Para activarla o renovarla,
          escribinos.
        </Chico>
        <Boton
          t={t}
          chico
          variant="outline"
          title="Escribir a Inédita"
          onPress={() => Linking.openURL('mailto:inedita.musica.argentina@gmail.com?subject=Cuota%20Inédita')}
        />
      </Tarjeta>

      {stats || insignias.length ? (
        <Tarjeta t={t}>
          <H2 t={t}>Tu recorrido como autor</H2>
          {stats ? (
            <P t={t}>
              {stats.canciones} canciones · ♥ {stats.favoritos} favoritos · {stats.pedidos} pedidos · {stats.grabadas} grabadas
              {stats.promedio ? ' · ★ ' + String(stats.promedio).replace('.', ',') : ''}
            </P>
          ) : null}
          {insignias.length ? (
            <Chips>
              {insignias.map((i) => (
                <Etiqueta key={i.id} t={t} text={'🏅 ' + i.nombre} />
              ))}
            </Chips>
          ) : null}
        </Tarjeta>
      ) : null}

      <Seccion t={t} titulo="Tus canciones" accion="+ Subir" onAccion={() => nav.ir('subir', {})}>
        {canciones.length === 0 ? (
          <Chico t={t}>Todavía no subiste canciones.</Chico>
        ) : (
          canciones.map((c) => (
            <Tarjeta key={c.id} t={t} onPress={() => nav.ir('cancion', { id: c.id })}>
              <Fila style={{ justifyContent: 'space-between' }}>
                <Text style={{ color: t.ink, fontWeight: '600', flex: 1 }} numberOfLines={1}>
                  {c.titulo}
                </Text>
                <Etiqueta t={t} text={c.para_versionar ? 'Para versionar' : etiquetasEstadoCancion[c.estado]} />
              </Fila>
            </Tarjeta>
          ))
        )}
      </Seccion>

      <Seccion t={t} titulo="Tus propuestas en vivo" accion="+ Crear" onAccion={() => nav.ir('editarPropuesta', {})}>
        {propuestas.length === 0 ? (
          <Chico t={t}>Todavía no armaste una propuesta para eventos.</Chico>
        ) : (
          propuestas.map((p) => (
            <Tarjeta key={p.id} t={t} onPress={() => nav.ir('propuesta', { id: p.id })}>
              <Fila style={{ justifyContent: 'space-between' }}>
                <Text style={{ color: t.ink, fontWeight: '600', flex: 1 }} numberOfLines={1}>
                  {p.nombre_artistico}
                </Text>
                <Etiqueta t={t} text={p.activa ? (p.tipo === 'sonido' ? 'Sonido' : 'Artista') : 'Pausada'} tono={p.activa ? undefined : 'error'} />
              </Fila>
            </Tarjeta>
          ))
        )}
      </Seccion>

      <Tarjeta t={t}>
        <H2 t={t}>Tus datos</H2>
        <Campo t={t} label="Nombre o nombre artístico" value={nombre} onChangeText={setNombre} />
        <Campo t={t} label="Provincia" value={provincia} onChangeText={setProvincia} />
        <Campo t={t} label="Localidad" value={localidad} onChangeText={setLocalidad} />
        <Campo t={t} label="Sobre vos (opcional)" value={bio} onChangeText={setBio} multiline />
        <Interruptor t={t} label="Compongo canciones" value={roles.es_compositor} onValueChange={(v) => setRoles(Object.assign({}, roles, { es_compositor: v }))} />
        <Interruptor t={t} label="Canto o toco" value={roles.es_artista} onValueChange={(v) => setRoles(Object.assign({}, roles, { es_artista: v }))} />
        <Interruptor t={t} label="Organizo eventos" value={roles.es_organizador} onValueChange={(v) => setRoles(Object.assign({}, roles, { es_organizador: v }))} />
        <Interruptor t={t} label="Hago sonido o tengo equipos" value={roles.es_sonidista} onValueChange={(v) => setRoles(Object.assign({}, roles, { es_sonidista: v }))} />
        <Aviso t={t} texto={error} />
        <Aviso t={t} texto={ok} tono="ok" />
        <Boton t={t} title="Guardar cambios" onPress={guardar} loading={guardando} />
      </Tarjeta>

      <Boton t={t} variant="quiet" title="Cerrar sesión" onPress={() => supabase.auth.signOut()} />
      <Chico t={t} style={{ textAlign: 'center' }}>
        Inédita · versión de prueba 0.1
      </Chico>
    </View>
  );
}
