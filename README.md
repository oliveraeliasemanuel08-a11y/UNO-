# UNO! Club

Juego web de cartas UNO! con interfaz en español.

## Publicar con GitHub Pages

1. Abrí **Settings → Pages** en este repositorio.
2. En **Build and deployment**, elegí **Deploy from a branch**.
3. Seleccioná la rama `main` y la carpeta `/(root)`.
4. Guardá los cambios y esperá a que GitHub termine la publicación.
5. La página quedará disponible en:

   https://oliveraeliasemanuel08-a11y.github.io/UNO-/

## Archivos principales

- `index.html`: aplicación web. Debe permanecer en la raíz del repositorio.
- `.nojekyll`: evita que GitHub Pages procese el sitio con Jekyll.

## Estado de la conexión online

El HTML actual intenta inicializar Firebase únicamente cuando existe la variable especial `__firebase_config`. GitHub Pages no proporciona esa variable automáticamente. Para habilitar partidas online desde el sitio publicado, todavía hay que integrar la configuración de la aplicación web de Firebase y definir una arquitectura segura para las operaciones de juego.

No publiques claves privadas ni credenciales de cuentas de servicio en este repositorio.
