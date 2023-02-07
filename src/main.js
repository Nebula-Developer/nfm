const { ipcRenderer } = require('electron');
const explorer = require('./misc/explorer');

explorer.createTab('~/Documents');
