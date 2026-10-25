import React from 'react';
import { View, Text, Pressable, TextInput, ActivityIndicator, Switch } from 'react-native';
import { colores } from './theme';

export function H1({ t, children, style }) {
  return (
    <Text style={[{ fontSize: 28, fontWeight: '800', color: t.ink, letterSpacing: -0.5 }, style]}>
      {children}
    </Text>
  );
}

export function H2({ t, children, style }) {
  return <Text style={[{ fontSize: 20, fontWeight: '700', color: t.ink }, style]}>{children}</Text>;
}

export function P({ t, muted, children, style, numberOfLines }) {
  return (
    <Text
      numberOfLines={numberOfLines}
      style={[{ fontSize: 15, lineHeight: 21, color: muted ? t.muted : t.ink }, style]}
    >
      {children}
    </Text>
  );
}

export function Chico({ t, children, style, numberOfLines }) {
  return (
    <Text numberOfLines={numberOfLines} style={[{ fontSize: 13, lineHeight: 18, color: t.muted }, style]}>
      {children}
    </Text>
  );
}

export function Boton({ t, title, onPress, variant, disabled, loading, style, chico }) {
  const v = variant || 'primary';
  let bg = t.primary;
  let fg = t.onCard;
  let borde = 0;
  if (v === 'accent') {
    bg = t.destacado;
    fg = t.onAccent;
  } else if (v === 'outline') {
    bg = 'transparent';
    fg = t.link;
    borde = 1.5;
  } else if (v === 'quiet') {
    bg = t.surface;
    fg = t.ink;
    borde = 1;
  }
  return (
    <Pressable
      accessibilityRole="button"
      onPress={disabled || loading ? undefined : onPress}
      style={({ pressed }) => [
        {
          minHeight: chico ? 40 : 48,
          borderRadius: 14,
          paddingHorizontal: chico ? 12 : 16,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: bg,
          borderWidth: borde,
          borderColor: v === 'quiet' ? t.line : t.link,
          opacity: disabled ? 0.45 : pressed ? 0.8 : 1,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <Text style={{ color: fg, fontWeight: '700', fontSize: chico ? 14 : 15 }}>{title}</Text>
      )}
    </Pressable>
  );
}

export function Campo({
  t,
  label,
  value,
  onChangeText,
  placeholder,
  multiline,
  keyboardType,
  autoCapitalize,
  hint,
  style,
  maxLength,
}) {
  return (
    <View style={[{ gap: 6 }, style]}>
      {label ? <Text style={{ color: t.ink, fontWeight: '600', fontSize: 14 }}>{label}</Text> : null}
      <TextInput
        value={value === null || value === undefined ? '' : String(value)}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={t.muted}
        multiline={multiline}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        maxLength={maxLength}
        accessibilityLabel={label || placeholder}
        style={{
          backgroundColor: t.surface,
          borderWidth: 1,
          borderColor: t.line,
          borderRadius: 12,
          paddingHorizontal: 14,
          paddingVertical: 12,
          color: t.ink,
          fontSize: 16,
          minHeight: multiline ? 110 : 48,
          textAlignVertical: multiline ? 'top' : 'center',
        }}
      />
      {hint ? <Chico t={t}>{hint}</Chico> : null}
    </View>
  );
}

export function Chip({ t, label, selected, onPress }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      onPress={onPress}
      style={{
        minHeight: 36,
        paddingHorizontal: 14,
        borderRadius: 18,
        justifyContent: 'center',
        backgroundColor: selected ? t.primary : t.surface,
        borderWidth: 1,
        borderColor: selected ? t.primary : t.line,
      }}
    >
      <Text style={{ color: selected ? t.onCard : t.ink, fontSize: 14, fontWeight: selected ? '700' : '500' }}>
        {label}
      </Text>
    </Pressable>
  );
}

export function Chips({ children, style }) {
  return <View style={[{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, style]}>{children}</View>;
}

export function Tarjeta({ t, children, style, onPress }) {
  const base = {
    backgroundColor: t.surface,
    borderWidth: 1,
    borderColor: t.line,
    borderRadius: 18,
    padding: 14,
    gap: 8,
  };
  if (onPress) {
    return (
      <Pressable
        accessibilityRole="button"
        onPress={onPress}
        style={({ pressed }) => [base, { opacity: pressed ? 0.85 : 1 }, style]}
      >
        {children}
      </Pressable>
    );
  }
  return <View style={[base, style]}>{children}</View>;
}

export function Fila({ children, style }) {
  return <View style={[{ flexDirection: 'row', alignItems: 'center', gap: 10 }, style]}>{children}</View>;
}

export function Etiqueta({ t, text, tono }) {
  let bg = t.destacadoSoft;
  let fg = t.destacado;
  let borde = t.destacadoLine;
  if (tono === 'ok') {
    bg = colores.okBg;
    fg = colores.ok;
    borde = 'transparent';
  } else if (tono === 'aviso') {
    bg = colores.avisoBg;
    fg = colores.aviso;
    borde = 'transparent';
  } else if (tono === 'error') {
    bg = colores.errorBg;
    fg = colores.error;
    borde = 'transparent';
  }
  return (
    <View
      style={{
        alignSelf: 'flex-start',
        backgroundColor: bg,
        borderColor: borde,
        borderWidth: 1,
        borderRadius: 8,
        paddingHorizontal: 8,
        paddingVertical: 3,
      }}
    >
      <Text style={{ color: fg, fontSize: 12, fontWeight: '700' }}>{text}</Text>
    </View>
  );
}

export function Interruptor({ t, label, value, onValueChange, hint }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 4 }}>
      <View style={{ flex: 1 }}>
        <Text style={{ color: t.ink, fontSize: 15, fontWeight: '600' }}>{label}</Text>
        {hint ? <Chico t={t}>{hint}</Chico> : null}
      </View>
      <Switch
        value={!!value}
        onValueChange={onValueChange}
        trackColor={{ true: t.interruptor, false: t.line }}
        thumbColor="#FFFFFF"
        accessibilityLabel={label}
      />
    </View>
  );
}

export function Cargando({ t, texto }) {
  return (
    <View style={{ padding: 32, alignItems: 'center', gap: 10 }}>
      <ActivityIndicator color={t.link} size="large" />
      {texto ? <Chico t={t}>{texto}</Chico> : null}
    </View>
  );
}

export function Aviso({ t, texto, tono }) {
  if (!texto) return null;
  const esOk = tono === 'ok';
  return (
    <View
      style={{
        backgroundColor: esOk ? colores.okBg : colores.errorBg,
        borderRadius: 12,
        padding: 12,
      }}
    >
      <Text style={{ color: esOk ? colores.ok : colores.error, fontSize: 14, lineHeight: 20 }}>{texto}</Text>
    </View>
  );
}

export function Seccion({ t, titulo, accion, onAccion, children, style }) {
  return (
    <View style={[{ gap: 10 }, style]}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <H2 t={t}>{titulo}</H2>
        {accion ? (
          <Pressable accessibilityRole="button" onPress={onAccion} hitSlop={10}>
            <Text style={{ color: t.link, fontWeight: '600', fontSize: 14 }}>{accion}</Text>
          </Pressable>
        ) : null}
      </View>
      {children}
    </View>
  );
}

export function Estrellas({ t, valor, onCambio, tamano }) {
  const s = tamano || 28;
  return (
    <View style={{ flexDirection: 'row', gap: 6 }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Pressable
          key={n}
          accessibilityRole="button"
          accessibilityLabel={n + ' estrellas'}
          onPress={onCambio ? () => onCambio(n) : undefined}
          hitSlop={6}
        >
          <Text style={{ fontSize: s, color: n <= (valor || 0) ? t.link : t.line }}>★</Text>
        </Pressable>
      ))}
    </View>
  );
}

export function Encabezado({ t, titulo, onVolver }) {
  return (
    <View style={{ gap: 6 }}>
      {onVolver ? (
        <Pressable accessibilityRole="button" onPress={onVolver} hitSlop={10} style={{ alignSelf: 'flex-start' }}>
          <Text style={{ color: t.link, fontSize: 15, fontWeight: '600' }}>‹ Volver</Text>
        </Pressable>
      ) : null}
      {titulo ? <H1 t={t}>{titulo}</H1> : null}
    </View>
  );
}

export function Semaforo({ t, color, texto }) {
  const mapa = { verde: '#2BD46B', amarillo: '#F6C744', rojo: '#FF6B5A' };
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: mapa[color] || mapa.rojo }} />
      <Text style={{ color: t.ink, fontSize: 15, fontWeight: '600', flex: 1 }}>{texto}</Text>
    </View>
  );
}

export function Inicial({ t, nombre, tamano, fondo, color }) {
  const s = tamano || 44;
  const letra = (nombre || '?').trim().charAt(0).toUpperCase() || '?';
  return (
    <View
      style={{
        width: s,
        height: s,
        borderRadius: s / 3,
        backgroundColor: fondo || t.primary,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ color: color || t.onCard, fontWeight: '800', fontSize: s * 0.42 }}>{letra}</Text>
    </View>
  );
}
