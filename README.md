# Juntos Check

Lista compartida en tiempo real para una pareja. React + Vite + Supabase, con un look dark moderno y gradientes.

## Probar en local

```powershell
npm install
npm run dev
```

Sin variables de entorno la app corre en modo local (guarda en `localStorage`). Para sincronizar entre dos telefonos, configura Supabase.

## Conectar Supabase

1. Crea un proyecto en [supabase.com](https://supabase.com).
2. En el SQL Editor, pega el contenido de `supabase/migrations/0001_init.sql` y ejecuta. Eso crea la tabla `tasks`, activa RLS con politicas anon abiertas y habilita Realtime.
3. Copia `.env.example` a `.env.local` y pega tu URL y anon key:

```powershell
copy .env.example .env.local
```

```
VITE_SUPABASE_URL=https://TU-PROYECTO.supabase.co
VITE_SUPABASE_ANON_KEY=TU-ANON-KEY
```

4. Reinicia `npm run dev`. Cuando la app conecta, veras el indicador "En vivo" arriba a la derecha.

> Nota: las politicas RLS estan abiertas a cualquiera con la anon key. Esto es OK porque la app no tiene login y el link es privado (solo tu y ella). Si planeas hacerla publica, agrega auth.

## Publicar en GitHub Pages

```powershell
npm run deploy
```

Para que la version desplegada conecte con Supabase, configura las variables como secretos del build (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) en tu pipeline o usa un `.env.production.local` antes de `npm run build`.

## Probar en iPhone

1. Abre la URL en Safari.
2. Toca `Compartir`.
3. Elige `Agregar a pantalla de inicio`.

## Estructura

```
src/
  App.tsx         # UI y logica de tareas
  style.css       # tema dark con gradientes
  lib/supabase.ts # cliente y tipos
supabase/
  migrations/0001_init.sql
```

## Notas

- Realtime: cualquier cambio (insert/update/delete) aparece al instante en los dos telefonos.
- Updates optimistas: la UI no espera al round trip; si Supabase falla, hace rollback.
- Modo offline: si las env vars faltan, sigue funcionando con `localStorage`.
