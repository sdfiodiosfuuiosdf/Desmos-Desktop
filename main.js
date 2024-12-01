import { app, BrowserWindow, Menu, ipcMain } from 'electron';
import Store from 'electron-store';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let safeExit = false;

const store = new Store({
  defaults: {
    windowSize: [1000, 600],
    windowPos: [200, 200],
    filePath: null,
  },
});

function sendReq(msg, data = null) {
  win.webContents.send('mainprocess-request', { msg, data });
}

const menuTemplate = [
  {
    label: 'File',
    submenu: [
      {
        label: 'New',
        accelerator: 'CmdOrCtrl+N',
        click() {
          sendReq('NewFile');
        },
      },
      {
        label: 'Open',
        accelerator: 'CmdOrCtrl+O',
        click() {
          sendReq('OpenFile');
        },
      },
      {
        label: 'Save',
        accelerator: 'CmdOrCtrl+S',
        click() {
          sendReq('SaveFile');
        },
      },
      {
        label: 'Save As',
        accelerator: 'CmdOrCtrl+Shift+S',
        click() {
          sendReq('SaveAsFile');
        },
      },
      { type: 'separator' },
      {
        label: 'Export',
        accelerator: 'CmdOrCtrl+E',
        click() {
          sendReq('ExportImage');
        },
      },
    ],
  },
  {
    label: 'Edit',
    submenu: [
      {
        label: 'Undo',
        accelerator: 'CmdOrCtrl+Z',
        click() {
          sendReq('Undo');
        },
      },
      {
        label: 'Redo',
        accelerator: 'CmdOrCtrl+Shift+Z',
        click() {
          sendReq('Redo');
        },
      },
      {
        label: 'Clear',
        accelerator: 'CmdOrCtrl+Shift+C',
        click() {
          sendReq('Clear');
        },
      },
    ],
  },
  {
    label: 'View',
    submenu: [
      { role: 'resetzoom' },
      { role: 'zoomin' },
      { role: 'zoomout' },
      { type: 'separator' },
      { role: 'togglefullscreen' },
    ],
  },
  {
    role: 'help',
    submenu: [
      {
        label: 'Learn More',
        accelerator: 'CmdOrCtrl+H',
        click() {
          createInfoWindow();
        },
      },
    ],
  },
];

if (process.platform === 'darwin') {
  menuTemplate.unshift({
    label: app.getName(),
    submenu: [
      { role: 'about' },
      { type: 'separator' },
      { role: 'services', submenu: [] },
      { type: 'separator' },
      { role: 'hide' },
      { role: 'hideothers' },
      { role: 'unhide' },
      { type: 'separator' },
      { role: 'quit' },
    ],
  });
}

let win;
let infoWin;

function createWindow() {
  let pos = store.get('windowPos');
  let x = pos[0];
  let y = pos[1];

  let shape = store.get('windowSize');
  let width = shape[0];
  let height = shape[1];

  win = new BrowserWindow({
    width,
    height,
    x,
    y,
    icon: path.join(__dirname, '/res/icons/icon.png'),
  });

  win.loadURL(
    url.format({
      pathname: path.join(__dirname, 'index.html'),
      protocol: 'file',
      slashes: true,
    })
  );

  const menu = Menu.buildFromTemplate(menuTemplate);
  Menu.setApplicationMenu(menu);

  win.on('resize', () => {
    let size = win.getSize();
    store.set('windowSize', size);
  });

  win.on('move', () => {
    let pos = win.getPosition();
    store.set('windowPos', pos);
  });

  win.on('close', (e) => {
    if (!safeExit) {
      e.preventDefault();
      sendReq('Exitting');
    }
  });
}

function createInfoWindow() {
  infoWin = new BrowserWindow({
    width: 400,
    height: 450,
    resizable: false,
    parent: win,
    icon: path.join(__dirname, '/res/icons/icon.png'),
  });
  infoWin.loadURL(
    url.format({
      pathname: path.join(__dirname, '/src/info.html'),
      protocol: 'file',
      slashes: true,
    })
  );

  infoWin.on('close', () => {
    infoWin = null;
  });
}

app.on('ready', createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

ipcMain.on('renderer-response', (event, arg) => {
  switch (arg.msg) {
    case 'Exit':
      safeExit = true;
      app.quit();
      break;
  }
});

ipcMain.on('renderer-request', (event, arg) => {
  switch (arg.msg) {
    case 'TitleChanged':
      store.set('filePath', arg.data);
      break;
    case 'ToInit':
      sendReq('Init', store.get('filePath'));
      break;
    default:
      break;
  }
});
