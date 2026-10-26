// Estallido de fiesta al entrar a Inédita en Vivo: destello, onda y chispas que salen disparadas.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Animated, Easing, AccessibilityInfo, Platform } from 'react-native';

const COLORES = ['#F6C744', '#FFE08A', '#FFFFFF', '#E0314F', '#B02643', '#FF9F43'];
const USAR_NATIVO = Platform.OS !== 'web';

function azar(min, max) {
  return min + Math.random() * (max - min);
}

function armarChispas(n) {
  const lista = [];
  for (let i = 0; i < n; i++) {
    const angulo = (i / n) * Math.PI * 2 + azar(-0.18, 0.18);
    const distancia = azar(110, 360);
    const esRayo = i % 4 === 0;
    lista.push({
      dx: Math.cos(angulo) * distancia,
      dy: Math.sin(angulo) * distancia * 0.85,
      caida: azar(40, 110), // la gravedad las hace caer un poco al final
      tam: esRayo ? azar(3, 4) : azar(5, 11),
      largo: esRayo ? azar(16, 26) : 0,
      giro: (angulo * 180) / Math.PI,
      color: COLORES[i % COLORES.length],
      demora: azar(0, 0.12),
    });
  }
  return lista;
}

// disparo: número que cambia cada vez que hay que estallar
// origen: { x, y } dentro del contenedor
export function Estallido({ disparo, origen }) {
  const avance = useRef(new Animated.Value(0)).current;
  const [visible, setVisible] = useState(false);
  const chispas = useMemo(() => armarChispas(42), [disparo]);

  useEffect(() => {
    if (!disparo) return;
    let cancelado = false;
    AccessibilityInfo.isReduceMotionEnabled()
      .catch(() => false)
      .then((reducir) => {
        if (cancelado || reducir) return;
        avance.setValue(0);
        setVisible(true);
        Animated.timing(avance, {
          toValue: 1,
          duration: 1150,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: USAR_NATIVO,
        }).start(() => {
          if (!cancelado) setVisible(false);
        });
      });
    return () => {
      cancelado = true;
    };
  }, [disparo]);

  if (!visible || !origen) return null;

  const destello = {
    opacity: avance.interpolate({ inputRange: [0, 0.08, 0.45], outputRange: [0, 0.75, 0], extrapolate: 'clamp' }),
    transform: [{ scale: avance.interpolate({ inputRange: [0, 0.45], outputRange: [0.2, 9], extrapolate: 'clamp' }) }],
  };
  const onda = {
    opacity: avance.interpolate({ inputRange: [0, 0.1, 0.7], outputRange: [0, 0.9, 0], extrapolate: 'clamp' }),
    transform: [{ scale: avance.interpolate({ inputRange: [0, 0.7], outputRange: [0.1, 7], extrapolate: 'clamp' }) }],
  };

  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 1, zIndex: 50, overflow: 'visible' }}
    >
      {/* Destello de luz */}
      <Animated.View
        style={[
          {
            position: 'absolute',
            left: origen.x - 40,
            top: origen.y - 40,
            width: 80,
            height: 80,
            borderRadius: 40,
            backgroundColor: '#FFE08A',
          },
          destello,
        ]}
      />
      {/* Onda expansiva */}
      <Animated.View
        style={[
          {
            position: 'absolute',
            left: origen.x - 30,
            top: origen.y - 30,
            width: 60,
            height: 60,
            borderRadius: 30,
            borderWidth: 2,
            borderColor: '#F6C744',
          },
          onda,
        ]}
      />
      {/* Chispas */}
      {chispas.map((c, i) => {
        const ini = c.demora;
        const p = avance.interpolate({ inputRange: [ini, 1], outputRange: [0, 1], extrapolate: 'clamp' });
        const ancho = c.largo || c.tam;
        const alto = c.tam;
        return (
          <Animated.View
            key={i}
            style={{
              position: 'absolute',
              left: origen.x - ancho / 2,
              top: origen.y - alto / 2,
              width: ancho,
              height: alto,
              borderRadius: alto / 2,
              backgroundColor: c.color,
              opacity: p.interpolate({ inputRange: [0, 0.05, 0.65, 1], outputRange: [0, 1, 1, 0] }),
              transform: [
                { translateX: p.interpolate({ inputRange: [0, 1], outputRange: [0, c.dx] }) },
                {
                  translateY: p.interpolate({
                    inputRange: [0, 0.5, 1],
                    outputRange: [0, c.dy * 0.8, c.dy + c.caida],
                  }),
                },
                { rotate: c.giro + 'deg' },
                { scale: p.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0.2, 1.3, 0.5] }) },
              ],
            }}
          />
        );
      })}
    </View>
  );
}

// La pantalla aparece con un pequeño "golpe" (crece un poco y se acomoda)
// Solo mientras dura la animación se usa una capa animada; después, la pantalla queda "plana"
// (una capa transformada enorme hace lento el desplazamiento en los celulares).
export function Aparecer({ clave, activo, children }) {
  const v = useRef(new Animated.Value(1)).current;
  const [animando, setAnimando] = useState(false);
  useEffect(() => {
    if (!activo) return;
    v.setValue(0);
    setAnimando(true);
    Animated.spring(v, { toValue: 1, friction: 7, tension: 80, useNativeDriver: USAR_NATIVO }).start(() => setAnimando(false));
  }, [clave]);
  if (!animando) return <View>{children}</View>;
  return (
    <Animated.View
      style={{
        opacity: v.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0, 1, 1] }),
        transform: [
          { scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1] }) },
          { translateY: v.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) },
        ],
      }}
    >
      {children}
    </Animated.View>
  );
}
