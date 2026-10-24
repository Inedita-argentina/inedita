import React, { useState } from 'react';
import { View, ScrollView, Platform } from 'react-native';
import { supabase } from '../supabase';
import { H1, P, Campo, Boton, Aviso, Interruptor, Tarjeta, H2 } from '../ui';

export default function Onboarding({ t, perfil, uid, onListo }) {
  const [nombre, setNombre] = useState(perfil.nombre && perfil.nombre.indexOf('@') < 0 ? perfil.nombre : '');
  const [provincia, setProvincia] = useState(perfil.provincia || '');
  const [localidad, setLocalidad] = useState(perfil.localidad || '');
  const [roles, setRoles] = useState({
    es_compositor: !!perfil.es_compositor,
    es_artista: !!perfil.es_artista,
    es_organizador: !!perfil.es_organizador,
    es_sonidista: !!perfil.es_sonidista,
  });
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');

  function cambiar(k, v) {
    setRoles(Object.assign({}, roles, { [k]: v }));
  }

  async function guardar() {
    setError('');
    if (!nombre.trim()) {
      setError('Contanos tu nombre o el nombre artístico.');
      return;
    }
    if (!roles.es_compositor && !roles.es_artista && !roles.es_organizador && !roles.es_sonidista) {
      setError('Elegí al menos una opción. Después la podés cambiar desde tu perfil.');
      return;
    }
    setCargando(true);
    const { error: e } = await supabase
      .from('perfiles')
      .update(
        Object.assign({ nombre: nombre.trim(), provincia: provincia.trim(), localidad: localidad.trim() }, roles)
      )
      .eq('id', uid);
    setCargando(false);
    if (e) setError('No se pudo guardar. Probá de nuevo.');
    else onListo();
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: t.bg }} keyboardShouldPersistTaps="handled">
      <View
        style={{
          width: '100%',
          maxWidth: 520,
          alignSelf: 'center',
          padding: 24,
          paddingTop: Platform.OS === 'web' ? 32 : 64,
          gap: 18,
        }}
      >
        <H1 t={t}>¡Bienvenido!</H1>
        <P t={t} muted>
          Contanos un poco de vos para armar tu perfil.
        </P>
        <Campo t={t} label="Nombre o nombre artístico" value={nombre} onChangeText={setNombre} />
        <Campo t={t} label="Provincia" value={provincia} onChangeText={setProvincia} placeholder="Córdoba" />
        <Campo t={t} label="Localidad" value={localidad} onChangeText={setLocalidad} placeholder="Villa María" />

        <Tarjeta t={t}>
          <H2 t={t}>¿Qué querés hacer en Inédita?</H2>
          <P t={t} muted>
            Podés marcar varias.
          </P>
          <Interruptor
            t={t}
            label="Compongo canciones"
            hint="Subí tus canciones inéditas o para versionar."
            value={roles.es_compositor}
            onValueChange={(v) => cambiar('es_compositor', v)}
          />
          <Interruptor
            t={t}
            label="Canto o toco"
            hint="Buscá canciones nuevas y ofrecé tus shows."
            value={roles.es_artista}
            onValueChange={(v) => cambiar('es_artista', v)}
          />
          <Interruptor
            t={t}
            label="Organizo eventos"
            hint="Contratá artistas y sonido para tu evento."
            value={roles.es_organizador}
            onValueChange={(v) => cambiar('es_organizador', v)}
          />
          <Interruptor
            t={t}
            label="Hago sonido o tengo equipos"
            hint="Ofrecé sonido e iluminación para eventos."
            value={roles.es_sonidista}
            onValueChange={(v) => cambiar('es_sonidista', v)}
          />
        </Tarjeta>

        <Aviso t={t} texto={error} />
        <Boton t={t} title="Empezar" onPress={guardar} loading={cargando} />
      </View>
    </ScrollView>
  );
}
