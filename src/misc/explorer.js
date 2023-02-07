const files = require('./files');
const $ = require('jquery');
const path = require('path');
const fs = require('fs');

var tabs = {};
var selectedFiles = [];
// Selected example:
// [ { tab: (tab id), file: (file path) } ]

var tabView = $("#tab-view");

/**
 * Create a new tab and display all files and directories.
 * @param {string} directory
 */
function createTab(directory) {
    var tabID = genId();

    var tab = $(`<div class="tab" tab-id="${tabID}"></div>`);
    var tabTitle = $(`<input type="text" class="tab-title" value="${directory}"></input>`);
    tabTitle.on('keydown', (event) => {
        if (event.key === 'Enter') {
            tabTitle.trigger('blur');
            naviagteTab(tabID, tabTitle.val());
        }
    });

    var tabContent = $(`<div class="tab-content"></div>`);
    tab.append(tabTitle);
    tab.append(tabContent);
    
    var fileListing = files.listDirectory(directory);
    for (var i = 0; i < fileListing.length; i++) {
        var file = fileListing[i];
        var fileDiv = createFile(file);
        tabContent.append(fileDiv);
    }

    tabView.append(tab);
}

/**
 * Navigate a tab to a spesified directory.
 * @param {string} tabID
 * @param {string} directory
 */
function naviagteTab(tabID, directory) {
    var tab = $(`.tab[tab-id="${tabID}"]`);
    var tabContent = tab.find('.tab-content');
    tabContent.empty();

    var fileListing = files.listDirectory(directory);
    for (var i = 0; i < fileListing.length; i++) {
        var file = fileListing[i];
        var fileDiv = createFile(file);
        tabContent.append(fileDiv);
    }

    tab.find('.tab-title').val(directory);
}

var isMacOS = process.platform === 'darwin';

/**
 * Create a file div
 * @param {files.File} file 
 * @returns {jQuery}
 */
function createFile(file) {
    var fileDiv = $(`<div class="file"></div>`);
    var fileName = $(`<div class="file-name">${file.name}</div>`);
    getThumbnail(file).then((fileThumbnail) => {
        if (!fileThumbnail) return;
        if (fileThumbnail.startsWith('data:image/png;base64,')) {
            var fileIcon = $(`<img class="file-icon" src="${fileThumbnail}"></img>`);
            fileDiv.append(fileIcon);
        } else {
            var fileIcon = $(`<div class="file-icon">${fileThumbnail}</div>`);
            fileDiv.append(fileIcon);
        }
    });

    fileDiv.append(fileName);

    return fileDiv;
}

/**
 * Get a thumbnail for a file
 * @param {string} file
 * @returns {string} Base64 encoded image
 */ 
function getThumbnail(file) {
    return new Promise((resolve, reject) => {
        var ext = path.extname(file.name).toLowerCase().trim().substring(1);

        // if .app
        if (ext == 'app' && file.extra.plist) {
            var plist = file.extra.plist;
            var iconFile = plist.CFBundleIconFile;
            if (!iconFile) { return null; } 
            if (!iconFile.endsWith('.icns')) iconFile += '.icns';

            console.log(file.name + " Icon: " + iconFile);
            var iconPath = path.join(file.path, 'Contents', 'Resources', iconFile);

            var pngOutput = files.icnsToPng(iconPath).then((png) => {
                resolve(png);
            }).catch((err) => {
                console.log("Fail in fetching icns file for: " + file.name, err);
                console.log("Got path: " + iconPath);
            });
        }
        else if (isImage(file.name)) {
            var read = fs.readFileSync(file.path);
            var base64 = read.toString('base64');
            resolve('data:image/png;base64,' + base64);
        } else {
            if (file.directory) { resolve("<i class='fas fa-folder'></i>"); return; }
            if (file.name.startsWith('.')) {
                console.log(file.stats.isFile())
            }

            var fileDictionary = {
                "fas fa-file-archive": ['zip', 'rar', '7z', 'tar', 'gz', 'xz', 'bz2', 'pkg', 'dmg'],
                "fas fa-file-alt": ['txt'],
                "fas fa-file-audio": ['mp3', 'wav', 'ogg', 'flac'],
                "fas fa-file-video": ['mp4', 'avi', 'mov', 'mkv', 'wmv', 'flv', 'webm'],
                "fas fa-file-code": ['js', 'css', 'html', 'php', 'py', 'java', 'c', 'cpp', 'cs', 'swift', 'sh', 'json'],
                "fas fa-file-excel": ['xls', 'xlsx'],
                "fas fa-file-image": ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'tiff', 'svg'],
                "fas fa-file-pdf": ['pdf'],
                "fas fa-file-powerpoint": ['ppt', 'pptx'],
                "fas fa-file-word": ['doc', 'docx', 'ttf', 'otf', 'woff', 'woff2'],
                "fas fa-file": ['exe', 'app', 'bin'],
            };

            for (var key in fileDictionary) {
                if (fileDictionary[key].includes(ext)) {
                    resolve(`<i class="${key}"></i>`);
                    return;
                }
            }

            resolve(`<i class="fas fa-file"></i>`);
        }
    });
}

function isImage(name) {
    var extensions = ['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.tiff', '.svg'];
    var ext = path.extname(name).toLowerCase().trim();
    return extensions.includes(ext);
}

createTab('/Users/nebuladev/Downloads');

module.exports = {
    createTab
};

