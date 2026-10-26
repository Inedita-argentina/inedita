import React, { useState } from 'react';
import { View, Text, Platform } from 'react-native';
import { supabase } from '../supabase';
import { H1, P, Campo, Boton, Aviso, Chico } from '../ui';

function traducirError(e) {
  const m = (e && e.message) || '';
  if (/rate|seconds|security purposes/i.test(m)) return 'Esperá un minuto antes de pedir otro código.';
  if (/expired|invalid|token/i.test(m)) return 'El código no es correcto o ya venció. Pedí uno nuevo.';
  if (/email/i.test(m) && /valid/i.test(m)) return 'Revisá que el mail esté bien escrito.';
  return 'Algo salió mal. Probá de nuevo en un momento.';
}

export default function Login({ t }) {
  const [paso, setPaso] = useState('mail');
  const [mail, setMail] = useState('');
  const [codigo, setCodigo] = useState('');
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');

  async function pedirCodigo() {
    setError('');
    const limpio = mail.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(limpio)) {
      setError('Escribí un mail válido.');
      return;
    }
    setCargando(true);
    const { error: e } = await supabase.auth.signInWithOtp({
      email: limpio,
      options: { shouldCreateUser: true },
    });
    setCargando(false);
    if (e) setError(traducirError(e));
    else {
      setMail(limpio);
      setPaso('codigo');
    }
  }

  async function verificar() {
    setError('');
    const limpio = codigo.replace(/\D/g, '');
    if (limpio.length < 6) {
      setError('El código tiene 6 números.');
      return;
    }
    setCargando(true);
    const { error: e } = await supabase.auth.verifyOtp({ email: mail, token: limpio, type: 'email' });
    setCargando(false);
    if (e) setError(traducirError(e));
  }

  return (
    <View style={{ flex: 1, backgroundColor: t.bg, justifyContent: 'center' }}>
      <View
        style={{
          width: '100%',
          maxWidth: 440,
          alignSelf: 'center',
          padding: 24,
          paddingTop: Platform.OS === 'web' ? 24 : 60,
          gap: 18,
        }}
      >
        <View style={{ gap: 6 }}>
          <H1 t={t} style={{ fontSize: 40 }}>
            Inédita
          </H1>
          <Text style={{ color: t.destacado, fontSize: 22, fontWeight: '800', marginTop: -4 }}>
            ¡La canción que buscás!
          </Text>
          <P t={t} muted style={{ marginTop: 6 }}>
            Canciones que todavía nadie cantó, y música en vivo para tu evento.
          </P>
        </View>

        {paso === 'mail' ? (
          <View style={{ gap: 14 }}>
            <Campo
              t={t}
              label="Tu mail"
              value={mail}
              onChangeText={setMail}
              placeholder="nombre@gmail.com"
              keyboardType="email-address"
              autoCapitalize="none"
              hint="Te mandamos un código para entrar. No hace falta contraseña."
            />
            <Aviso t={t} texto={error} />
            <Boton t={t} title="Recibir código" onPress={pedirCodigo} loading={cargando} />
          </View>
        ) : (
          <View style={{ gap: 14 }}>
            <P t={t}>
              Te mandamos un código a <P t={t} style={{ fontWeight: '700' }}>{mail}</P>. Si no lo ves, revisá la carpeta de spam.
            </P>
            <Campo
              t={t}
              label="Código"
              value={codigo}
              onChangeText={setCodigo}
              placeholder="123456"
              keyboardType="number-pad"
              maxLength={10}
            />
            <Aviso t={t} texto={error} />
            <Boton t={t} title="Entrar" onPress={verificar} loading={cargando} />
            <Boton
              t={t}
              variant="outline"
              title="Usar otro mail"
              onPress={() => {
                setPaso('mail');
                setCodigo('');
                setError('');
              }}
            />
            <Chico t={t}>El código vence en una hora.</Chico>
          </View>
        )}
      </View>
    </View>
  );
}
