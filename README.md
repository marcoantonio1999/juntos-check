# Juntos Check

Prototipo minimo en React para probar una lista compartida estilo pareja/to-do en iPhone.

## Probar en tu PC

```powershell
npm install
npm run dev
```

## Publicar en GitHub Pages

1. Crea un repo nuevo en GitHub.
2. En esta carpeta corre:

```powershell
git init
git add .
git commit -m "Primer prototipo"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/TU_REPO.git
git push -u origin main
npm run deploy
```

3. En GitHub, activa Pages usando la rama `gh-pages`.

## Probar en iPhone

1. Abre la URL de GitHub Pages en Safari.
2. Toca `Compartir`.
3. Elige `Agregar a pantalla de inicio`.

## Notas

- Esta version guarda datos solo en `localStorage`.
- No sincroniza entre dos telefonos todavia.
- Sirve para validar la idea y el look antes de meter backend.
