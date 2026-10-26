import React, { useEffect, useMemo, useState } from 'react';
import { View, Text } from 'react-native';
import { supabase } from './supabase';
import { Chip, Chips, Chico, Campo } from './ui';

let cache = null;

export async function cargarGeneros() {
  if (cache) return cache;
  const { data, error } = await supabase
    .from('generos')
    .select('id,nombre,padre_id,orden')
    .eq('activo', true)
    .order('orden');
  if (error) throw error;
  cache = data || [];
  return cache;
}

export function useGeneros() {
  const [lista, setLista] = useState(cache || []);
  useEffect(() => {
    let vivo = true;
    cargarGeneros()
      .then((d) => {
        if (vivo) setLista(d);
      })
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, []);
  return lista;
}

export function hijos(lista, padre) {
  return lista
    .filter((g) => (g.padre_id || null) === (padre || null))
    .sort((a, b) => a.orden - b.orden);
}

export function descendientes(lista, id) {
  const out = [id];
  const pila = [id];
  while (pila.length) {
    const p = pila.pop();
    lista.forEach((g) => {
      if (g.padre_id === p) {
        out.push(g.id);
        pila.push(g.id);
      }
    });
  }
  return out;
}

export function ruta(lista, id) {
  const m = {};
  lista.forEach((g) => {
    m[g.id] = g;
  });
  const partes = [];
  let g = m[id];
  let guardia = 0;
  while (g && guardia < 10) {
    partes.unshift(g.nombre);
    g = m[g.padre_id];
    guardia++;
  }
  return partes.join(' › ');
}

export function nombreGenero(lista, id) {
  const g = lista.find((x) => x.id === id);
  return g ? g.nombre : '';
}

function caminoHasta(lista, id) {
  const m = {};
  lista.forEach((g) => {
    m[g.id] = g;
  });
  const camino = [];
  let g = m[id];
  let guardia = 0;
  while (g && guardia < 10) {
    camino.unshift(g.id);
    g = m[g.padre_id];
    guardia++;
  }
  return camino;
}

// Selector en cascada: Familia -> Género -> Subgénero. Devuelve el más específico elegido.
export function SelectorGenero({ t, lista, valor, onCambio, otro, onOtro }) {
  const camino = useMemo(() => (valor ? caminoHasta(lista, valor) : []), [lista, valor]);
  const niveles = [];
  niveles.push({ padre: null, opciones: hijos(lista, null) });
  camino.forEach((id) => {
    const h = hijos(lista, id);
    if (h.length) niveles.push({ padre: id, opciones: h });
  });

  function elegir(nivel, id) {
    const nuevo = camino.slice(0, nivel).concat(id);
    onCambio(nuevo[nuevo.length - 1]);
  }

  return (
    <View style={{ gap: 10 }}>
      {niveles.map((n, i) => (
        <View key={(n.padre || 'raiz') + i} style={{ gap: 6 }}>
          {i > 0 ? <Chico t={t}>Podés elegir algo más específico (opcional):</Chico> : null}
          <Chips>
            {n.opciones.map((g) => (
              <Chip
                key={g.id}
                t={t}
                label={g.nombre}
                selected={camino[i] === g.id}
                onPress={() => elegir(i, g.id)}
              />
            ))}
          </Chips>
        </View>
      ))}
      {valor ? (
        <Text style={{ color: t.link, fontWeight: '600' }}>Elegiste: {ruta(lista, valor)}</Text>
      ) : null}
      {onOtro && camino[0] === 'otros' ? (
        <Campo
          t={t}
          label="¿Cuál? (si no está en la lista)"
          value={otro || ''}
          onChangeText={onOtro}
          placeholder="Ej.: jazz, música celta, reggae"
        />
      ) : null}
    </View>
  );
}

// Selector múltiple: familias y sus géneros (dos niveles). Para las propuestas de En Vivo.
// Varios géneros: se ven las familias; al tocar una, se despliegan sus subgéneros.
// "otro" / "onOtro": texto libre para un género que no está en la lista.
export function SelectorGenerosMultiple({ t, lista, valores, onCambio, otro, onOtro }) {
  const familias = hijos(lista, null);
  const [abierta, setAbierta] = useState(null);
  const [verOtro, setVerOtro] = useState(!!otro);

  function alternar(id) {
    if (valores.indexOf(id) >= 0) onCambio(valores.filter((v) => v !== id));
    else onCambio(valores.concat(id));
  }
  // Cuántos elegidos hay dentro de cada familia
  function cuantos(f) {
    const ids = descendientes(lista, f.id);
    return valores.filter((v) => ids.indexOf(v) >= 0).length;
  }

  const fam = familias.find((f) => f.id === abierta);
  return (
    <View style={{ gap: 12 }}>
      <Chico t={t}>Tocá un género para ver sus estilos.</Chico>
      <Chips>
        {familias.map((f) => {
          const n = cuantos(f);
          return (
            <Chip
              key={f.id}
              t={t}
              label={f.nombre + (n ? ' (' + n + ')' : '') + (abierta === f.id ? '  ▴' : '  ▾')}
              selected={abierta === f.id || n > 0}
              onPress={() => setAbierta(abierta === f.id ? null : f.id)}
            />
          );
        })}
        {onOtro ? (
          <Chip t={t} label={'Otro' + (verOtro ? '  ▴' : '  ▾')} selected={verOtro || !!otro} onPress={() => setVerOtro(!verOtro)} />
        ) : null}
      </Chips>
      {fam ? (
        <View style={{ gap: 6, paddingLeft: 10, borderLeftWidth: 2, borderLeftColor: t.destacado }}>
          <Text style={{ color: t.ink, fontWeight: '700' }}>{fam.nombre}</Text>
          <Chips>
            <Chip t={t} label={'Todo ' + fam.nombre} selected={valores.indexOf(fam.id) >= 0} onPress={() => alternar(fam.id)} />
            {hijos(lista, fam.id).map((g) => (
              <Chip key={g.id} t={t} label={g.nombre} selected={valores.indexOf(g.id) >= 0} onPress={() => alternar(g.id)} />
            ))}
          </Chips>
        </View>
      ) : null}
      {onOtro && verOtro ? (
        <Campo
          t={t}
          label="Otro género"
          value={otro || ''}
          onChangeText={onOtro}
          placeholder="Ej.: jazz, música celta, reggae"
          hint="Si tocás algo que no está en la lista, escribilo acá."
        />
      ) : null}
    </View>
  );
}
