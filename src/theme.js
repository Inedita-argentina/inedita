// Dos climas: Inédita (verde con salpicado amarillo) e Inédita en Vivo (noche estrellada).
export const temas = {
  inedita: {
    nombre: 'inedita',
    bg: '#06140C',
    surface: '#0F2318',
    tabOn: '#1B3A27',
    ink: '#F0FAF3',
    muted: '#A6C2B0',
    line: '#1E3828',
    track: '#0A1C11',
    primary: '#2BD46B',
    onCard: '#04130A',
    cardB: '#5BE38E',
    cardC: '#1FB85A',
    eyebrow: '#04130A',
    cardSub: '#0B2A17',
    accent: '#04130A',
    onAccent: '#5BE38E',
    soft: '#12301F',
    softLine: '#22553A',
    link: '#FFD23F',
    onLink: '#04130A',
    destacado: '#FFD23F',
    destacadoSoft: '#0F2A1A',
    destacadoLine: '#4A5A1F',
  },
  vivo: {
    nombre: 'vivo',
    bg: '#040817',
    surface: '#0B1229',
    tabOn: '#18224A',
    ink: '#F2F5FC',
    muted: '#A6B0CC',
    line: '#18213F',
    track: '#070C1F',
    primary: '#142257',
    onCard: '#FFFFFF',
    cardB: '#1C2D69',
    cardC: '#0E1946',
    eyebrow: '#F4E3A1',
    cardSub: '#D5DCF0',
    accent: '#F4E3A1',
    onAccent: '#040817',
    soft: '#111B3D',
    softLine: '#243262',
    link: '#F4E3A1',
    onLink: '#040817',
    destacado: '#F4E3A1',
    destacadoSoft: '#0E1636',
    destacadoLine: '#2C3A6E',
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
