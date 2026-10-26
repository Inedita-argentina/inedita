// Pantalla para invitados cuando quieren hacer algo que necesita cuenta.
import React from 'react';
import { View, Text } from 'react-native';
import { Encabezado, Tarjeta, P, Chico, Boton } from '../ui';

export default function CrearCuenta({ t, nav, onEntrar, motivo }) {
  return (
    <View style={{ gap: 18 }}>
      <Encabezado t={t} onVolver={() => nav.raiz('inicio')} titulo="Creá tu cuenta" />
      <Tarjeta t={t}>
        <Text style={{ color: t.ink, fontWeight: '800', fontSize: 20 }}>{motivo || 'Para esto necesitás una cuenta'}</Text>
        <P t={t} muted>
          Con tu cuenta podés subir canciones, pedirlas, armar tu propuesta para eventos y pedir presupuestos. Es gratis y entrás
          con tu mail o con Google, sin contraseña.
        </P>
        <Boton t={t} variant="accent" title="Crear cuenta o entrar" onPress={onEntrar} />
        <Chico t={t}>Solo guardamos tu mail y lo que completes en tu perfil.</Chico>
      </Tarjeta>
      <Boton t={t} variant="quiet" title="Seguir mirando como invitado" onPress={() => nav.raiz('inicio')} />
    </View>
  );
}
