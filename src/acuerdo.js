// Acuerdos entre autor e intérprete: modalidades de pago, armado del texto y simulador de números.
import React, { useState } from 'react';
import { View, Text } from 'react-native';
import { Chico, Campo, Chip, Chips } from './ui';

export const modalidadesPago = [
  { id: 'sin_cargo', nombre: 'Sin pago directo', ayuda: 'El autor cobra sus derechos por SADAIC cuando la canción suena.' },
  { id: 'monto_fijo', nombre: 'Monto fijo', ayuda: 'El intérprete paga una suma única al autor.' },
  { id: 'porcentaje', nombre: 'Porcentaje', ayuda: 'El autor recibe un porcentaje de lo que genere la grabación.' },
  { id: 'mixto', nombre: 'Anticipo + porcentaje', ayuda: 'Un monto al firmar y además un porcentaje de lo que genere.' },
];

export const etiquetasAcuerdo = {
  sin_proponer: 'Falta proponer el acuerdo',
  propuesto: 'Acuerdo en curso',
  firmado: 'Acuerdo firmado',
  anulado: 'Acuerdo anulado',
};

export function numero(texto) {
  const n = parseFloat(String(texto || '').replace(/\./g, '').replace(',', '.'));
  return isNaN(n) ? null : n;
}

export function dinero(n, moneda) {
  if (n == null || isNaN(n)) return '—';
  const r = Math.round(n * 100) / 100;
  const txt = r.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  return (moneda === 'USD' ? 'US$ ' : '$ ') + txt;
}

function fechaHora(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  const p = (x) => String(x).padStart(2, '0');
  return p(d.getDate()) + '/' + p(d.getMonth() + 1) + '/' + d.getFullYear() + ' a las ' + p(d.getHours()) + ':' + p(d.getMinutes());
}

// Lo que va en la cláusula de pago
export function textoPago(a) {
  const monto = dinero(a.monto, a.moneda);
  const comision =
    (a.modalidad_pago === 'monto_fijo' || a.modalidad_pago === 'mixto') && a.monto && a.comision_pct > 0
      ? (a.modalidad_pago === 'mixto' ? ' Del anticipo,' : ' De ese monto,') +
        ' Inédita retendrá una comisión del ' +
        String(a.comision_pct).replace('.', ',') +
        '% por la intermediación.'
      : '';
  if (a.modalidad_pago === 'monto_fijo') {
    return 'El Intérprete pagará al Autor la suma única de ' + monto + ' al firmar este acuerdo.' + comision;
  }
  if (a.modalidad_pago === 'porcentaje') {
    return (
      'El Intérprete pagará al Autor el ' +
      String(a.porcentaje || 0).replace('.', ',') +
      '% de los ingresos netos que obtenga por la grabación (ventas, plataformas digitales y otros usos de la grabación), con liquidaciones cada seis meses.'
    );
  }
  if (a.modalidad_pago === 'mixto') {
    return (
      'El Intérprete pagará al Autor un anticipo de ' +
      monto +
      ' al firmar este acuerdo y, además, el ' +
      String(a.porcentaje || 0).replace('.', ',') +
      '% de los ingresos netos que obtenga por la grabación, con liquidaciones cada seis meses.' +
      comision
    );
  }
  return 'El Intérprete no pagará un monto al Autor por esta autorización. El Autor cobrará sus derechos de autor según la cláusula 6.';
}

export function textoExclusividad(a) {
  if (!a.exclusivo) return 'La autorización no es exclusiva: el Autor puede autorizar también a otros intérpretes.';
  if (a.exclusividad_meses) {
    return 'El Autor no autorizará a otros intérpretes a grabar la obra durante ' + a.exclusividad_meses + ' meses desde la firma.';
  }
  return 'El Autor no autorizará a otros intérpretes a grabar la obra mientras esta autorización siga vigente.';
}

export function textoPlazo(a) {
  if (!a.plazo_grabacion_meses) return 'No se fija un plazo para grabar.';
  return (
    'Si el Intérprete no publica la grabación dentro de los ' +
    a.plazo_grabacion_meses +
    ' meses desde la firma, esta autorización (y su exclusividad, si la tiene) queda sin efecto.'
  );
}

// Arma el texto completo a partir del modelo editable
export function armarTexto(plantilla, a, datos) {
  const pendiente = '(a completar)';
  const valores = {
    FECHA: a.firmado_artista_en || a.firmado_autor_en ? fechaHora(a.firmado_artista_en || a.firmado_autor_en).split(' a las ')[0] : fechaHora(new Date().toISOString()).split(' a las ')[0],
    AUTOR_NOMBRE: (a.autor_nombre_legal || '').trim() || datos.autorNombre || pendiente,
    AUTOR_DNI: (a.autor_dni || '').trim() || pendiente,
    ARTISTA_NOMBRE: (a.artista_nombre_legal || '').trim() || datos.artistaNombre || pendiente,
    ARTISTA_DNI: (a.artista_dni || '').trim() || pendiente,
    CANCION: datos.cancion || pendiente,
    AUTORES_OBRA: datos.autoresObra || datos.autorNombre || pendiente,
    EXCLUSIVIDAD: textoExclusividad(a),
    PLAZO_GRABACION: textoPlazo(a),
    PAGO: textoPago(a),
    CREDITOS: (a.creditos || '').trim() || (datos.autoresObra || datos.autorNombre || pendiente),
    CONDICIONES: (a.condiciones || '').trim() || 'No hay.',
    FIRMA_AUTOR: a.firmado_autor_en ? fechaHora(a.firmado_autor_en) : '(sin firmar)',
    FIRMA_ARTISTA: a.firmado_artista_en ? fechaHora(a.firmado_artista_en) : '(sin firmar)',
  };
  return String(plantilla || '').replace(/\{([A-Z_]+)\}/g, (m, k) => (k in valores ? valores[k] : m));
}

function Linea({ t, label, valor, fuerte }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 10 }}>
      <Text style={{ color: fuerte ? t.ink : t.muted, fontWeight: fuerte ? '800' : '400', flex: 1 }}>{label}</Text>
      <Text style={{ color: fuerte ? t.destacado : t.ink, fontWeight: fuerte ? '800' : '600' }}>{valor}</Text>
    </View>
  );
}

// Simulador: para imaginar cuánto recibe cada uno según la modalidad
export function Simulador({ t, a }) {
  const [ingresos, setIngresos] = useState('');
  const [repro, setRepro] = useState('100000');
  const [porMil, setPorMil] = useState('3000');
  const [modo, setModo] = useState('repro');
  const pct = Number(a.porcentaje) || 0;
  const com = Number(a.comision_pct) || 0;
  const monto = Number(a.monto) || 0;
  const usaMonto = a.modalidad_pago === 'monto_fijo' || a.modalidad_pago === 'mixto';
  const usaPct = a.modalidad_pago === 'porcentaje' || a.modalidad_pago === 'mixto';

  const ing = modo === 'repro' ? ((numero(repro) || 0) / 1000) * (numero(porMil) || 0) : numero(ingresos) || 0;
  const parteAutor = (ing * pct) / 100;

  return (
    <View style={{ gap: 10 }}>
      {a.modalidad_pago === 'sin_cargo' ? (
        <Chico t={t}>
          Sin pago directo: el intérprete no le paga al autor por la autorización. El autor cobra sus derechos de autor a través de
          SADAIC cada vez que la canción suena (radio, shows, plataformas), si es socio.
        </Chico>
      ) : null}

      {usaMonto ? (
        <View style={{ gap: 6 }}>
          <Text style={{ color: t.ink, fontWeight: '700' }}>{a.modalidad_pago === 'mixto' ? 'El anticipo' : 'El monto fijo'}</Text>
          <Linea t={t} label="Paga el intérprete" valor={dinero(monto, a.moneda)} />
          <Linea t={t} label={'Comisión de Inédita (' + String(com).replace('.', ',') + '%)'} valor={'− ' + dinero((monto * com) / 100, a.moneda)} />
          <Linea t={t} label="Recibe el autor" valor={dinero(monto - (monto * com) / 100, a.moneda)} fuerte />
        </View>
      ) : null}

      {usaPct ? (
        <View style={{ gap: 8 }}>
          <Text style={{ color: t.ink, fontWeight: '700' }}>El porcentaje: imaginá cuánto genera la grabación</Text>
          <Chips>
            <Chip t={t} label="Por reproducciones" selected={modo === 'repro'} onPress={() => setModo('repro')} />
            <Chip t={t} label="Por ingresos totales" selected={modo === 'ingresos'} onPress={() => setModo('ingresos')} />
          </Chips>
          {modo === 'repro' ? (
            <View style={{ gap: 8 }}>
              <Campo t={t} label="Reproducciones en plataformas" value={repro} onChangeText={setRepro} keyboardType="number-pad" />
              <Campo
                t={t}
                label="Cuánto paga cada 1.000 reproducciones (estimado)"
                value={porMil}
                onChangeText={setPorMil}
                keyboardType="number-pad"
                hint="Es una estimación para imaginar números: cada plataforma paga distinto y cambia con el tiempo."
              />
            </View>
          ) : (
            <Campo
              t={t}
              label="Ingresos netos de la grabación"
              value={ingresos}
              onChangeText={setIngresos}
              keyboardType="number-pad"
              placeholder="Ej.: 500000"
            />
          )}
          <Linea t={t} label="Genera la grabación" valor={dinero(ing, a.moneda)} />
          <Linea t={t} label={'Le corresponde al autor (' + String(pct).replace('.', ',') + '%)'} valor={dinero(parteAutor, a.moneda)} fuerte />
          <Linea t={t} label="Le queda al intérprete" valor={dinero(ing - parteAutor, a.moneda)} />
        </View>
      ) : null}

      <Chico t={t}>
        Además, el autor sigue cobrando sus derechos de autor por SADAIC cuando la canción se difunde. Eso no se descuenta de este
        acuerdo.
      </Chico>
    </View>
  );
}
