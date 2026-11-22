const { app, BrowserWindow, shell } = require("electron");

const GAME_URL = "https://oliveraeliasemanuel08-a11y.github.io/UNO-/";

function createWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 900,
    minHeight: 620,
    show: false,
    backgroundColor: "#101014",
    autoHideMenuBar: true,
    title: "UNO! CLUB",
    webPreferences: {
      preload: require("node:path").join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  // Carga la versión publicada en GitHub Pages para conservar Firebase
  // y evitar restricciones CORS de módulos ES al abrir archivos file://.
  win.loadURL(GAME_URL);
  win.once("ready-to-show", () => win.show());

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("https://") || url.startsWith("http://")) {
      shell.openExternal(url);
    }
    return { action: "deny" };
  });

  win.webContents.on("will-navigate", (event, url) => {
    if (!url.startsWith(GAME_URL)) {
      event.preventDefault();
      if (url.startsWith("https://") || url.startsWith("http://")) {
        shell.openExternal(url);
      }
    }
  });
}

app.whenReady().then(() => {
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
