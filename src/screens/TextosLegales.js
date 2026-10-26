// Administrador: editar el modelo de autorización y la comisión de Inédita.
import React, { useEffect, useState } from 'react';
import { View, Text, TextInput } from 'react-native';
import { supabase } from '../supabase';
import { Encabezado, Tarjeta, H2, P, Chico, Campo, Boton, Aviso, Cargando, Chip, Chips } from '../ui';

const marcadores = [
  ['{FECHA}', 'fecha de la firma'],
  ['{AUTOR_NOMBRE}', 'nombre completo del autor'],
  ['{AUTOR_DNI}', 'DNI del autor'],
  ['{ARTISTA_NOMBRE}', 'nombre completo del intérprete'],
  ['{ARTISTA_DNI}', 'DNI del intérprete'],
  ['{CANCION}', 'título de la canción'],
  ['{AUTORES_OBRA}', 'autores cargados en la canción'],
  ['{EXCLUSIVIDAD}', 'cláusula de exclusividad'],
  ['{PLAZO_GRABACION}', 'plazo para grabar'],
  ['{PAGO}', 'cláusula de pago'],
  ['{CREDITOS}', 'cómo aparece el crédito'],
  ['{CONDICIONES}', 'otras condiciones'],
  ['{FIRMA_AUTOR}', 'fecha y hora en que firmó el autor'],
  ['{FIRMA_ARTISTA}', 'fecha y hora en que firmó el intérprete'],
];

export default function TextosLegales({ t, nav, perfil }) {
  const [textos, setTextos] = useState(null);
  const [cual, setCual] = useState('autorizacion');
  const texto = textos ? textos[cual] || '' : null;
  const setTexto = (v) => setTextos(Object.assign({}, textos, { [cual]: v }));
  const [comision, setComision] = useState('');
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    Promise.all([
      supabase.from('plantillas').select('id,texto'),
      supabase.from('configuracion').select('comision_inedita').eq('id', 1).maybeSingle(),
    ]).then(([p, c]) => {
      const m = {};
      (p.data || []).forEach((x) => (m[x.id] = x.texto));
      setTextos(m);
      setComision(c.data ? String(c.data.comision_inedita).replace('.', ',') : '10');
    });
  }, []);

  if (!perfil.es_admin) {
    return (
      <View style={{ gap: 16 }}>
        <Encabezado t={t} onVolver={nav.volver} titulo="Textos legales" />
        <P t={t}>Esta sección es solo para el administrador.</P>
      </View>
    );
  }
  if (texto === null) {
    return (
      <View style={{ gap: 16 }}>
        <Encabezado t={t} onVolver={nav.volver} titulo="Textos legales" />
        <Cargando t={t} />
      </View>
    );
  }

  async function guardar() {
    setError('');
    setOk('');
    const pct = parseFloat(String(comision).replace(',', '.'));
    if (isNaN(pct) || pct < 0 || pct > 50) return setError('La comisión tiene que estar entre 0 y 50.');
    if (!texto.trim()) return setError('El texto no puede quedar vacío.');
    setGuardando(true);
    const [a, b] = await Promise.all([
      supabase.from('plantillas').update({ texto, actualizado_en: new Date().toISOString() }).eq('id', cual),
      supabase.from('configuracion').update({ comision_inedita: pct }).eq('id', 1),
    ]);
    setGuardando(false);
    if (a.error || b.error) return setError('No se pudo guardar.');
    setOk(cual === 'autorizacion' ? 'Guardado. Los acuerdos nuevos usan este texto; los ya firmados no cambian.' : 'Guardado.');
  }

  return (
    <View style={{ gap: 18 }}>
      <Encabezado t={t} onVolver={nav.volver} titulo="Textos legales" />

      <Tarjeta t={t}>
        <H2 t={t}>Comisión de Inédita</H2>
        <Campo
          t={t}
          label="Porcentaje sobre los montos fijos (%)"
          value={comision}
          onChangeText={setComision}
          keyboardType="decimal-pad"
          hint="Se aplica a los acuerdos nuevos. Ponelo en 0 si todavía no querés cobrar."
        />
      </Tarjeta>

      <Chips>
        <Chip t={t} label="Autorización autor–intérprete" selected={cual === 'autorizacion'} onPress={() => setCual('autorizacion')} />
        <Chip t={t} label="Política de privacidad" selected={cual === 'privacidad'} onPress={() => setCual('privacidad')} />
      </Chips>

      {cual === 'privacidad' ? (
        <Tarjeta t={t}>
          <H2 t={t}>Política de privacidad</H2>
          <Chico t={t}>La ve cualquiera desde la pantalla de entrada y desde el perfil. Reemplazala cuando la revise el abogado.</Chico>
        </Tarjeta>
      ) : null}

      <Tarjeta t={t}>
        {cual === 'autorizacion' ? (
          <>
        <H2 t={t}>Modelo de autorización autor–intérprete</H2>
        <Chico t={t}>
          Cuando el abogado lo revise, reemplazá el texto acá. Las palabras entre llaves se completan solas con los datos de cada
          acuerdo:
        </Chico>
        <View style={{ gap: 2 }}>
          {marcadores.map(([m, d]) => (
            <Chico key={m} t={t}>
              <Text style={{ color: t.destacado, fontWeight: '700' }}>{m}</Text> · {d}
            </Chico>
          ))}
        </View>
          </>
        ) : null}
        <TextInput
          value={texto}
          onChangeText={setTexto}
          multiline
          style={{
            minHeight: 420,
            color: t.ink,
            backgroundColor: t.track,
            borderColor: t.line,
            borderWidth: 1,
            borderRadius: 12,
            padding: 12,
            fontSize: 14,
            lineHeight: 20,
            textAlignVertical: 'top',
          }}
        />
      </Tarjeta>

      <Aviso t={t} texto={error} />
      <Aviso t={t} texto={ok} tono="ok" />
      <Boton t={t} variant="accent" title="Guardar" onPress={guardar} loading={guardando} />
    </View>
  );
}
