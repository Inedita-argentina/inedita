// Política de privacidad: el texto vive en la base (lo edita el administrador).
import React, { useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import { supabase } from '../supabase';
import { Encabezado, Cargando, Chico } from '../ui';

export default function Privacidad({ t, nav, onVolver }) {
  const [texto, setTexto] = useState(null);

  useEffect(() => {
    supabase
      .from('plantillas')
      .select('texto')
      .eq('id', 'privacidad')
      .maybeSingle()
      .then((r) => setTexto(r.data ? r.data.texto : ''));
  }, []);

  return (
    <View style={{ gap: 16 }}>
      <Encabezado t={t} onVolver={onVolver || (nav && nav.volver)} titulo="Privacidad" />
      {texto === null ? (
        <Cargando t={t} />
      ) : texto ? (
        <Text selectable style={{ color: t.ink, fontSize: 15, lineHeight: 23 }}>
          {texto}
        </Text>
      ) : (
        <Chico t={t}>
          Guardamos solo tu mail y lo que completes en tu perfil, para que la app funcione. No vendemos ni compartimos tus datos.
          Para consultas: inedita.musica.argentina@gmail.com
        </Chico>
      )}
    </View>
  );
}
