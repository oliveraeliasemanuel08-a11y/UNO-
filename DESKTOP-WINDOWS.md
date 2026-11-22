# UNO! CLUB Desktop para Windows

La versión de escritorio utiliza Electron y carga el `index.html` del repositorio como contenido local. Las funciones que dependen de Internet, como Firebase y Google Fonts, necesitan conexión.

## Compilar en Windows

1. Instalar Node.js 22 LTS.
2. Descargar/clonar este repositorio.
3. Abrir una terminal dentro de la carpeta del proyecto.
4. Ejecutar:

```bash
npm install
npm run build:win
```

Los ejecutables aparecerán en la carpeta `release`:
- Instalador NSIS: permite elegir carpeta y crea accesos directos.
- Versión portable: se puede ejecutar sin instalación.

## Compilar desde GitHub

1. Abrir la pestaña **Actions** del repositorio.
2. Seleccionar **Build UNO CLUB for Windows**.
3. Pulsar **Run workflow**.
4. Esperar a que termine correctamente.
5. Descargar el artefacto **UNO-CLUB-Windows** desde el resumen de la ejecución.

## Notas

- La aplicación usa el HTML del repositorio al momento de compilar. Para incluir cambios nuevos, volver a ejecutar la compilación.
- Firebase continúa siendo un servicio online; el ejecutable no elimina esa dependencia.
- El ejecutable inicial no está firmado digitalmente, por lo que Windows SmartScreen podría mostrar una advertencia.
- El icono personalizado se puede incorporar cuando se disponga del archivo `.ico` definitivo.
