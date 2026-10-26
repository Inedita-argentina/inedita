import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

// Estos dos datos se cargan en Vercel como "Environment Variables".
// La dirección tiene un valor por defecto; la clave pública (anon key) es obligatoria.
const SUPABASE_URL =
  process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://vzemhjxzkkngvmnmaffi.supabase.co';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

export const configuracionCompleta = SUPABASE_ANON_KEY.length > 20;

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY || 'falta-configurar', {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    // En la web, al volver de "Continuar con Google" la sesión llega en la dirección
    detectSessionInUrl: Platform.OS === 'web',
  },
});

// Sube un archivo elegido con el selector de archivos a un "bucket" de Supabase.
// Devuelve la ruta guardada, por ejemplo "<id-usuario>/1729800000000.m4a".
export async function subirArchivo(bucket, uid, asset) {
  const nombre = asset.name || 'archivo';
  const partes = nombre.split('.');
  const ext = partes.length > 1 ? partes.pop().toLowerCase() : 'bin';
  const ruta = uid + '/' + Date.now() + '.' + ext;
  let cuerpo;
  if (asset.file) {
    cuerpo = asset.file; // navegador web
  } else {
    const resp = await fetch(asset.uri);
    cuerpo = await resp.arrayBuffer(); // celular
  }
  const tipos = {
    mp3: 'audio/mpeg',
    m4a: 'audio/mp4',
    mp4: 'audio/mp4',
    aac: 'audio/aac',
    wav: 'audio/wav',
    ogg: 'audio/ogg',
    opus: 'audio/ogg',
    webm: 'audio/webm',
    pdf: 'application/pdf',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
  };
  const tipo = tipos[ext] || asset.mimeType || undefined;
  const { error } = await supabase.storage.from(bucket).upload(ruta, cuerpo, {
    contentType: tipo,
    upsert: false,
  });
  if (error) throw error;
  return ruta;
}
