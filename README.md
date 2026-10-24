# Inédita

App para la música popular argentina, con dos secciones:

- **Inédita**: compositores suben canciones inéditas (o ya grabadas, "para versionar") y artistas las escuchan y las piden.
- **Inédita en Vivo**: artistas, bandas y sonidistas ofrecen sus servicios; organizadores de eventos piden presupuesto.

Versión de prueba 0.1.

## Tecnología

- **Expo / React Native**: un solo código para web, Android y iPhone.
- **Supabase**: base de datos, ingreso con código por mail, almacenamiento de audios.
- **Vercel**: publica la versión web.

## Configuración en Vercel

Variables de entorno (Settings → Environment Variables):

| Nombre | Valor |
|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` | `https://vzemhjxzkkngvmnmaffi.supabase.co` |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | la clave pública (anon / publishable) del proyecto de Supabase |

El archivo `vercel.json` ya indica cómo armar la web (`npx expo export -p web`, carpeta `dist`).

## Base de datos

Los archivos de `supabase/` se ejecutan en Supabase → SQL Editor, en orden:

1. `01_inedita.sql`: perfiles, géneros, canciones, pedidos, calificaciones, insignias, archivos.
2. `02_inedita_en_vivo.sql`: propuestas en vivo, sonidistas, pedidos de presupuesto, reseñas.

## Tareas del administrador (desde Supabase → Table Editor)

- **Activar o renovar la cuota de un artista**: tabla `perfiles`, columna `cuota_vence` (fecha hasta la que tiene acceso).
- **Hacerse administrador**: tabla `perfiles`, columna `es_admin` en `true`.
- **Destacar una canción**: tabla `canciones`, columna `destacada` en `true`.
- **Destacar una propuesta en vivo**: tabla `propuestas_vivo`, columna `destacada` en `true`.
- **Dar una insignia**: tabla `insignias`, nueva fila con `perfil_id` y `nombre` (ej.: "Compositor destacado").
- **Agregar o renombrar géneros**: tabla `generos`.

## Pendiente para próximas versiones

- Avisos por mail cuando llega un pedido (hoy se ven dentro de la app, en "Pedidos").
- Cobro automático de la cuota (hoy se activa a mano).
- Ingreso con Google.
- Fotos y audios en las propuestas en vivo.
- Panel de administración dentro de la app.
- Revisión de seguridad por un programador antes de abrir al público.
