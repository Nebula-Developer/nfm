const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

function listDirectory(directory) {
  if (!fs.existsSync(directory)) return null;
  const files = fs.readdirSync(directory);
  const results = [];

  files.forEach(file => {
    const filePath = path.resolve(directory, file);

    let stat = null;
    let hidden = /^\./.test(file);
    let type = null;
    let permissions = null;
    let size = null;
    let modified = null;

    try {
      stat = fs.statSync(filePath);
      type = stat.isFile() ? 'file' : 'directory';
      permissions = stat.mode;
      size = stat.size;
      modified = stat.mtime;
    } catch (err) {
      type = 'unknown';
    }

    results.push({
      name: file,
      type,
      hidden,
      permissions,
      size,
      modified
    });
  });

  return results;
}

if (require('electron-squirrel-startup')) {
  app.quit();
}

const createWindow = () => {
  // Create the browser window.
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

  ipcMain.on('list-directory', (event, directory) => {
    event.returnValue = listDirectory(directory);
  });

  ipcMain.on('open-file', (event, file) => {
    var proc = require('child_process').execFile;
    proc(file, function(err, data) {
      console.log(err)
      console.log(data.toString());
    });
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
