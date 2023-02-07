const { app, BrowserWindow, ipcMain, Menu } = require('electron');
const path = require('path');

if (require('electron-squirrel-startup')) {
  app.quit();
}

ipcMain.on('ondragstart', (ev, path) => {
  ev.sender.startDrag({file: path, icon: 'dragicon.png'})
})

const createWindow = () => {
  const mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: true,
      contextIsolation: false
    },
  });

  mainWindow.loadFile(path.join(__dirname, 'src/index.html'));
  mainWindow.webContents.openDevTools();

  ipcMain.on('show-app-context-menu', (event, args) => {
    const menu = Menu.buildFromTemplate([
      {
        label: 'Show Package Contents',
        click: () => {
          mainWindow.webContents.send('navigate', {
            tab: args.tab,
            file: path.join(args.file, 'Contents')
          });
        }
      }
    ]);
    menu.popup({ window: mainWindow, x: args.x, y: args.y });
  });
};

app.on('ready', createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
