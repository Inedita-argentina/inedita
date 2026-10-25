// Dos climas: Inédita (negro, verde intenso y amarillo) e Inédita en Vivo (telón rojo con dorado).
export const temas = {
  // Inédita: negro, verde intenso y amarillo
  inedita: {
    nombre: 'inedita',
    bg: '#050505',
    surface: '#121212',
    tabOn: '#232323',
    ink: '#FFFFFF',
    muted: '#B3B3B3',
    line: '#232323',
    track: '#0C0C0C',
    primary: '#0F3D22',
    onCard: '#FFFFFF',
    cardB: '#14532D',
    cardC: '#0A2A17',
    eyebrow: '#FFD23F',
    cardSub: '#D4F5E0',
    accent: '#FFD23F',
    onAccent: '#0A0A0A',
    soft: '#181818',
    softLine: '#2E2E2E',
    link: '#1ED760',
    onLink: '#04120A',
    destacado: '#FFD23F',
    destacadoSoft: '#17170F',
    destacadoLine: '#4A4520',
    interruptor: '#1ED760',
    decorado: '#FFD23F',
  },
  // Inédita en Vivo: telón rojo con dorado
  vivo: {
    nombre: 'vivo',
    bg: '#110407',
    surface: '#1F0A0F',
    tabOn: '#35111A',
    ink: '#FCEFEF',
    muted: '#CFA8AC',
    line: '#331219',
    track: '#18060A',
    primary: '#5C0F1F',
    onCard: '#FFFFFF',
    cardB: '#741629',
    cardC: '#430A16',
    eyebrow: '#F6C744',
    cardSub: '#F3D7DB',
    accent: '#F6C744',
    onAccent: '#1A0508',
    soft: '#2A0C13',
    softLine: '#55202C',
    link: '#F6C744',
    onLink: '#1A0508',
    destacado: '#F6C744',
    destacadoSoft: '#240A10',
    destacadoLine: '#5A4418',
    interruptor: '#B02643',
    decorado: '#F6C744',
  },
};

export const colores = {
  ok: '#8FE0A8',
  okBg: 'rgba(80,190,120,0.18)',
  aviso: '#F6C744',
  avisoBg: 'rgba(246,180,14,0.18)',
  error: '#FF9A8F',
  errorBg: 'rgba(255,110,90,0.16)',
};

export const etiquetasEstadoCancion = {
  disponible: 'Disponible',
  reservada: 'Reservada',
  grabada: 'Grabada',
  oculta: 'Oculta',
};

export const etiquetasEstadoPedido = {
  pendiente: 'Pendiente',
  aceptado: 'Aceptado',
  rechazado: 'Rechazado',
  cancelado: 'Cancelado',
};

export const etiquetasEstadoSolicitud = {
  pendiente: 'Esperando presupuesto',
  presupuestado: 'Presupuesto enviado',
  aceptada: 'Confirmada',
  rechazada: 'Rechazada',
  cancelada: 'Cancelada',
  realizada: 'Realizada',
};

export const tiposEvento = [
  'Evento privado',
  'Peña',
  'Bar',
  'Casamiento',
  'Cumpleaños',
  'Festival',
  'Empresa',
];

export const formaciones = [
  { id: 'solista', nombre: 'Solista' },
  { id: 'duo', nombre: 'Dúo' },
  { id: 'trio', nombre: 'Trío' },
  { id: 'grupo', nombre: 'Grupo' },
  { id: 'orquesta', nombre: 'Orquesta' },
];

export const voces = [
  { id: 'masculina', nombre: 'Voz masculina' },
  { id: 'femenina', nombre: 'Voz femenina' },
  { id: 'indistinta', nombre: 'Indistinta' },
];

export function plata(n) {
  if (n === null || n === undefined || n === '') return '';
  return '$ ' + Number(n).toLocaleString('es-AR');
}

export function fechaLinda(iso) {
  if (!iso) return '';
  const p = String(iso).slice(0, 10).split('-');
  if (p.length !== 3) return iso;
  return p[2] + '/' + p[1] + '/' + p[0];
}

// Semáforo de la cuota: verde (al día), amarillo (vence en 7 días o menos), rojo (vencida o sin cuota)
export function semaforoCuota(cuotaVence, esAdmin) {
  if (esAdmin) return { color: 'verde', texto: 'Administrador: acceso completo' };
  if (!cuotaVence) return { color: 'rojo', texto: 'Sin cuota activa' };
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const vence = new Date(cuotaVence + 'T00:00:00');
  const dias = Math.round((vence - hoy) / 86400000);
  if (dias < 0) return { color: 'rojo', texto: 'Cuota vencida el ' + fechaLinda(cuotaVence) };
  if (dias <= 7) return { color: 'amarillo', texto: 'Tu cuota vence el ' + fechaLinda(cuotaVence) };
  return { color: 'verde', texto: 'Cuota al día hasta el ' + fechaLinda(cuotaVence) };
}
