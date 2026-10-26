// Revisión automática del audio antes de subirlo (versión web).
// Mide duración, calidad del archivo, volumen, saturación y silencios.
// Devuelve una lista de controles: { id, estado: 'ok' | 'aviso' | 'bloquea', texto }.
import { Platform } from 'react-native';

export const LIMITES = {
  minSeg: 60, // menos de 1 minuto: no se puede subir
  maxSeg: 8 * 60, // más de 8 minutos: no se puede subir
  minKbps: 64, // calidad muy baja (notas de voz muy comprimidas): no se puede subir
  avisoKbps: 112, // calidad baja: avisa
  maxSilencio: 0.5, // más de la mitad en silencio: no se puede subir
  silencioInicial: 15, // más de 15 segundos callado al principio: avisa
  volumenBajoDb: -30, // volumen promedio por debajo de esto: avisa
  saturado: 0.03, // más del 3 % del audio "pegado al techo": avisa
};

const FREC = 22050; // se analiza a menor resolución para no gastar memoria del celular

function dbfs(x) {
  return x > 0 ? 20 * Math.log10(x) : -120;
}

function mmss(seg) {
  const n = Math.round(seg);
  return Math.floor(n / 60) + ':' + String(n % 60).padStart(2, '0');
}

export function puedeAnalizar() {
  return Platform.OS === 'web' && typeof window !== 'undefined' && !!(window.OfflineAudioContext || window.webkitOfflineAudioContext);
}

async function decodificar(buffer) {
  const Ctx = window.OfflineAudioContext || window.webkitOfflineAudioContext;
  const ctx = new Ctx(1, FREC, FREC);
  return await new Promise((resolver, rechazar) => {
    const p = ctx.decodeAudioData(buffer, resolver, rechazar);
    if (p && p.then) p.then(resolver, rechazar);
  });
}

// archivo: el "asset" de DocumentPicker ({ uri, size, name, file? })
export async function analizarAudio(archivo) {
  if (!puedeAnalizar()) return null;
  const resp = await fetch(archivo.uri);
  const buffer = await resp.arrayBuffer();
  const bytes = archivo.size || buffer.byteLength;
  const audio = await decodificar(buffer);

  const dur = audio.duration;
  const kbps = (bytes * 8) / 1000 / dur;
  const nCanales = audio.numberOfChannels;
  const canales = [];
  for (let c = 0; c < nCanales; c++) canales.push(audio.getChannelData(c));
  const largo = canales[0].length;

  // Recorremos el audio en ventanas de 50 ms
  const ventana = Math.max(1, Math.round(audio.sampleRate * 0.05));
  let ventanas = 0;
  let silenciosas = 0;
  let sumaCuad = 0;
  let cuentaSonido = 0;
  let pico = 0;
  let alTope = 0;
  let primeraConSonido = -1;
  for (let i = 0; i < largo; i += ventana) {
    const fin = Math.min(largo, i + ventana);
    let cuad = 0;
    for (let j = i; j < fin; j++) {
      let v = 0;
      for (let c = 0; c < nCanales; c++) v += canales[c][j];
      v /= nCanales;
      const a = Math.abs(v);
      if (a > pico) pico = a;
      cuad += v * v;
    }
    const rms = Math.sqrt(cuad / (fin - i));
    ventanas++;
    if (dbfs(rms) < -50) silenciosas++;
    else {
      if (primeraConSonido < 0) primeraConSonido = i / audio.sampleRate;
      sumaCuad += cuad;
      cuentaSonido += fin - i;
    }
  }
  // Saturación: si el sonido llega al techo y se queda ahí (la onda aparece "cortada" arriba)
  if (pico >= 0.9) {
    const techo = pico * 0.97;
    for (let j = 0; j < largo; j++) {
      let v = 0;
      for (let c = 0; c < nCanales; c++) v += canales[c][j];
      if (Math.abs(v / nCanales) >= techo) alTope++;
    }
  }
  const volumen = cuentaSonido ? dbfs(Math.sqrt(sumaCuad / cuentaSonido)) : -120;
  const fraccionSilencio = ventanas ? silenciosas / ventanas : 1;
  const fraccionTope = largo ? alTope / largo : 0;

  const L = LIMITES;
  const controles = [];

  if (dur < L.minSeg) {
    controles.push({ id: 'duracion', estado: 'bloquea', texto: 'Dura ' + mmss(dur) + '. Tiene que durar al menos 1 minuto.' });
  } else if (dur > L.maxSeg) {
    controles.push({ id: 'duracion', estado: 'bloquea', texto: 'Dura ' + mmss(dur) + '. El máximo es 8 minutos.' });
  } else {
    controles.push({ id: 'duracion', estado: 'ok', texto: 'Duración: ' + mmss(dur) });
  }

  if (kbps < L.minKbps) {
    controles.push({
      id: 'calidad',
      estado: 'bloquea',
      texto: 'La calidad del archivo es muy baja (parece una nota de voz). Exportalo como mp3 de 128 kbps o más.',
    });
  } else if (kbps < L.avisoKbps) {
    controles.push({ id: 'calidad', estado: 'aviso', texto: 'La calidad del archivo es baja. Si podés, subilo en mp3 de 128 kbps o más.' });
  } else {
    controles.push({ id: 'calidad', estado: 'ok', texto: 'Calidad del archivo: buena' });
  }

  if (fraccionSilencio > L.maxSilencio) {
    controles.push({ id: 'silencio', estado: 'bloquea', texto: 'Más de la mitad del audio está en silencio.' });
  } else if (primeraConSonido > L.silencioInicial) {
    controles.push({
      id: 'silencio',
      estado: 'aviso',
      texto: 'Los primeros ' + Math.round(primeraConSonido) + ' segundos están en silencio. Conviene recortarlos.',
    });
  } else {
    controles.push({ id: 'silencio', estado: 'ok', texto: 'Sin silencios largos' });
  }

  if (fraccionTope > L.saturado) {
    controles.push({
      id: 'volumen',
      estado: 'aviso',
      texto: 'El audio suena saturado (se grabó demasiado fuerte). Podés subirlo igual, pero va a sonar peor.',
    });
  } else if (volumen < L.volumenBajoDb || pico < 0.25) {
    controles.push({
      id: 'volumen',
      estado: 'aviso',
      texto: 'El audio suena muy bajo. Podés subirlo igual, pero va a vender menos.',
    });
  } else {
    controles.push({ id: 'volumen', estado: 'ok', texto: 'Volumen: bien' });
  }

  return {
    controles,
    bloquea: controles.some((c) => c.estado === 'bloquea'),
    duracion: dur,
  };
}
