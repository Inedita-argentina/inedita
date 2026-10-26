import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, ScrollView, Platform } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { supabase, configuracionCompleta } from './src/supabase';
import { temas } from './src/theme';
import { Cargando, H1, P } from './src/ui';

// La página está en castellano rioplatense: así el navegador no la "traduce" (y no cambia el voseo)
if (Platform.OS === 'web' && typeof document !== 'undefined') {
  document.documentElement.lang = 'es-AR';
  document.documentElement.setAttribute('translate', 'no');
  if (!document.querySelector('meta[name="google"]')) {
    const m = document.createElement('meta');
    m.name = 'google';
    m.content = 'notranslate';
    document.head.appendChild(m);
  }
}
import Login from './src/screens/Login';
import Onboarding from './src/screens/Onboarding';
import Inicio from './src/screens/Inicio';
import Cancion from './src/screens/Cancion';
import SubirCancion from './src/screens/SubirCancion';
import Pedidos from './src/screens/Pedidos';
import Propuesta from './src/screens/Propuesta';
import EditarPropuesta from './src/screens/EditarPropuesta';
import Perfil from './src/screens/Perfil';
import Revision from './src/screens/Revision';

// Fondo decorativo: salpicado amarillo (Inédita) o estrellas (Inédita en Vivo)
function Decorado({ seccion }) {
  const puntos = useMemo(() => {
    let seed = seccion === 'vivo' ? 11 : 29;
    const rnd = () => {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };
    const out = [];
    if (seccion === 'vivo') {
      for (let i = 0; i < 70; i++) {
        out.push({
          left: (rnd() * 100).toFixed(2) + '%',
          top: (rnd() * 100).toFixed(2) + '%',
          size: 1 + Math.round(rnd() * 2),
          opacity: 0.35 + rnd() * 0.6,
          color: i % 9 === 0 ? temas.vivo.decorado : '#FFFFFF',
        });
      }
    } else {
      const centros = [[85, 6], [10, 30], [90, 52], [15, 78], [78, 92]];
      centros.forEach((c) => {
        for (let j = 0; j < 9; j++) {
          const ang = rnd() * 6.283;
          const dist = Math.pow(rnd(), 1.6) * 14;
          out.push({
            left: Math.max(0, Math.min(99, c[0] + Math.cos(ang) * dist)).toFixed(2) + '%',
            top: Math.max(0, Math.min(99, c[1] + Math.sin(ang) * dist * 0.6)).toFixed(2) + '%',
            size: j === 0 ? 10 + Math.round(rnd() * 6) : 2 + Math.round(rnd() * 5),
            opacity: 0.55 + rnd() * 0.45,
            color: temas.inedita.decorado,
          });
        }
      });
      for (let q = 0; q < 18; q++) {
        out.push({
          left: (rnd() * 100).toFixed(2) + '%',
          top: (rnd() * 100).toFixed(2) + '%',
          size: 1 + Math.round(rnd() * 3),
          opacity: 0.4 + rnd() * 0.5,
          color: temas.inedita.decorado,
        });
      }
    }
    return out;
  }, [seccion]);

  return (
    <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
      {puntos.map((p, i) => (
        <View
          key={i}
          style={{
            position: 'absolute',
            left: p.left,
            top: p.top,
            width: p.size,
            height: p.size,
            borderRadius: p.size / 2,
            backgroundColor: p.color,
            opacity: p.opacity,
          }}
        />
      ))}
    </View>
  );
}

function BarraInferior({ t, actual, onIr, onSubir }) {
  const items = [
    { id: 'inicio', label: 'Inicio' },
    { id: 'subir', label: 'Subir', especial: true },
    { id: 'pedidos', label: 'Pedidos' },
    { id: 'perfil', label: 'Perfil' },
  ];
  return (
    <View
      style={{
        flexDirection: 'row',
        backgroundColor: t.surface,
        borderTopWidth: 1,
        borderTopColor: t.line,
        paddingTop: 8,
        paddingBottom: Platform.OS === 'ios' ? 26 : 10,
      }}
    >
      {items.map((it) =>
        it.especial ? (
          <Pressable
            key={it.id}
            accessibilityRole="button"
            accessibilityLabel="Subir"
            onPress={onSubir}
            style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
          >
            <View
              style={{
                width: 50,
                height: 50,
                borderRadius: 25,
                backgroundColor: t.primary,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{ color: t.onCard, fontSize: 28, fontWeight: '700', marginTop: -2 }}>+</Text>
            </View>
          </Pressable>
        ) : (
          <Pressable
            key={it.id}
            accessibilityRole="button"
            onPress={() => onIr(it.id)}
            style={{ flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 50 }}
          >
            <Text
              style={{
                color: actual === it.id ? t.link : t.muted,
                fontWeight: actual === it.id ? '700' : '500',
                fontSize: 13,
              }}
            >
              {it.label}
            </Text>
          </Pressable>
        )
      )}
    </View>
  );
}

function FaltaConfiguracion() {
  const t = temas.inedita;
  return (
    <View style={{ flex: 1, backgroundColor: t.bg, padding: 24, justifyContent: 'center', gap: 12 }}>
      <H1 t={t}>Falta un dato</H1>
      <P t={t}>
        La app todavía no tiene la clave pública de Supabase. En Vercel, agregá la variable
        EXPO_PUBLIC_SUPABASE_ANON_KEY y volvé a publicar.
      </P>
    </View>
  );
}

export default function App() {
  const [sesion, setSesion] = useState(null);
  const [cargandoSesion, setCargandoSesion] = useState(true);
  const [perfil, setPerfil] = useState(null);
  const [seccion, setSeccion] = useState('inedita');
  const [pila, setPila] = useState([{ nombre: 'inicio' }]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSesion(data.session);
      setCargandoSesion(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_evento, s) => {
      setSesion(s);
      if (!s) {
        setPerfil(null);
        setPila([{ nombre: 'inicio' }]);
      }
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const uid = sesion ? sesion.user.id : null;

  const cargarPerfil = useCallback(async () => {
    if (!uid) return;
    const { data } = await supabase.from('perfiles').select('*').eq('id', uid).maybeSingle();
    if (data) setPerfil(data);
    else setTimeout(cargarPerfil, 1200); // el perfil se crea automáticamente al registrarse
  }, [uid]);

  useEffect(() => {
    cargarPerfil();
  }, [cargarPerfil]);

  const t = temas[seccion];

  const nav = useMemo(
    () => ({
      ir: (nombre, params) => setPila((p) => p.concat({ nombre, params: params || {} })),
      volver: () => setPila((p) => (p.length > 1 ? p.slice(0, -1) : p)),
      raiz: (nombre) => setPila([{ nombre }]),
      reemplazar: (nombre, params) => setPila((p) => p.slice(0, -1).concat({ nombre, params: params || {} })),
    }),
    []
  );

  if (!configuracionCompleta) return <FaltaConfiguracion />;

  if (cargandoSesion) {
    return (
      <View style={{ flex: 1, backgroundColor: t.bg, justifyContent: 'center' }}>
        <Cargando t={t} />
      </View>
    );
  }

  if (!sesion) return <Login t={temas.inedita} />;

  if (!perfil) {
    return (
      <View style={{ flex: 1, backgroundColor: t.bg, justifyContent: 'center' }}>
        <Cargando t={t} texto="Preparando tu perfil…" />
      </View>
    );
  }

  const sinRoles = !perfil.es_compositor && !perfil.es_artista && !perfil.es_organizador && !perfil.es_sonidista;
  if (sinRoles || !perfil.nombre) {
    return <Onboarding t={temas.inedita} perfil={perfil} uid={uid} onListo={cargarPerfil} />;
  }

  const actual = pila[pila.length - 1];
  const ctx = { t, seccion, setSeccion, perfil, recargarPerfil: cargarPerfil, nav, uid, params: actual.params || {} };
  const esRaiz = pila.length === 1;

  let pantalla = null;
  switch (actual.nombre) {
    case 'cancion':
      pantalla = <Cancion {...ctx} />;
      break;
    case 'subir':
      pantalla = <SubirCancion {...ctx} />;
      break;
    case 'pedidos':
      pantalla = <Pedidos {...ctx} />;
      break;
    case 'propuesta':
      pantalla = <Propuesta {...ctx} />;
      break;
    case 'editarPropuesta':
      pantalla = <EditarPropuesta {...ctx} />;
      break;
    case 'perfil':
      pantalla = <Perfil {...ctx} />;
      break;
    case 'revision':
      pantalla = <Revision {...ctx} />;
      break;
    default:
      pantalla = <Inicio {...ctx} />;
  }

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <StatusBar style="light" />
      <Decorado seccion={seccion} />
      <ScrollView
        key={actual.nombre + pila.length}
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 40 }}
        keyboardShouldPersistTaps="handled"
      >
        <View
          style={{
            width: '100%',
            maxWidth: 560,
            alignSelf: 'center',
            paddingHorizontal: 20,
            paddingTop: Platform.OS === 'web' ? 24 : 56,
            gap: 20,
          }}
        >
          {pantalla}
        </View>
      </ScrollView>
      <BarraInferior
        t={t}
        actual={esRaiz ? actual.nombre : ''}
        onIr={(n) => nav.raiz(n)}
        onSubir={() => (seccion === 'vivo' ? nav.ir('editarPropuesta', {}) : nav.ir('subir', {}))}
      />
    </View>
  );
}
