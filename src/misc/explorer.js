const files = require('./files');
const $ = require('jquery');
const path = require('path');
const fs = require('fs');
const { ipcRenderer } = require('electron');

var activeTab = null;
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
    directory = formatPath(directory);
    var tabID = genId();

    var tab = $(`<div class="tab" tab-id="${tabID}"></div>`);

    tab.on('click', () => {
        activeTab = tabID;
        $(".tab").removeClass('active');
        tab.addClass('active');
    });

    activeTab = tabID;
    $(".tab").removeClass('active');
    tab.addClass('active');

    var tabTopbar = $(`<div class="tab-topbar"></div>`);
    var tabTitle = $(`<input type="text" class="tab-title" value="${formatFancyPath(directory)}"></input>`);
    var tabBack = $(`<i class="fas fa-arrow-left tab-back topbar-button"></i>`);
    var tabForward = $(`<i class="fas fa-arrow-right tab-forward topbar-button"></i>`);
    var tabClose = $(`<i class="fas fa-times tab-close topbar-button"></i>`);

    tabTitle.on('keydown', (event) => {
        if (event.key === 'Enter') {
            tabTitle.trigger('blur');
            navigateTab(tabID, tabTitle.val());
        }
    });

    tabBack.on('click', () => {
        var history = tabs[tabID].history;
        var index = history.lastIndexOf(tabs[tabID].location);
        if (index > 0) {
            var previous = history[index - 1];
            navigateTab(tabID, previous, false);
        }
    });

    tabForward.on('click', () => {
        var history = tabs[tabID].history;
        var index = history.lastIndexOf(tabs[tabID].location);
        
        if (index < history.length - 1) {
            var next = history[index + 1];
            navigateTab(tabID, next, false);
        }
    });

    tabClose.on('click', () => {
        closeTab(tabID);
    });

    var tabContent = $(`<div class="tab-content"></div>`);
    tabTopbar.append(tabBack);
    tabTopbar.append(tabForward);
    tabTopbar.append(tabTitle);
    tabTopbar.append(tabClose);
    tab.append(tabTopbar);
    tab.append(tabContent);
    
    tabView.append(tab);

    tabs[tabID] = {
        location: directory,
        history: []
    }

    handleTabWindowDrop(tabContent[0], tabID);
    navigateTab(tabID, directory);
}

/**
 * Navigate a tab to a spesified directory.
 * @param {string} tabID
 * @param {string} directory
 */
function navigateTab(tabID, directory, addToHistory = true) {
    directory = formatPath(directory);
    var beforeLocation = tabs[tabID].location;

    var tab = $(`.tab[tab-id="${tabID}"]`);
    var tabContent = tab.find('.tab-content');
    tabContent.empty();

    files.listDirectory(directory).then(async (fileListing) => {
        for (var i = 0; i < fileListing.length; i++) {
            var file = fileListing[i];
            var fileDiv = await createFile(file);
            addFileClickListener(fileDiv, file, tabID);
            tabContent.append(fileDiv);
        }
    });

    tab.find('.tab-title').val(formatFancyPath(directory));
    tabs[tabID].location = directory;
    if (addToHistory) {
        var index = tabs[tabID].history.lastIndexOf(beforeLocation);
        // Remove all history after the previous location
        tabs[tabID].history.splice(index + 1);
        tabs[tabID].history.push(directory);
    }

    // Check if history is available going backwards, if not add tab-back-inactive
    var history = tabs[tabID].history;
    var index = history.lastIndexOf(tabs[tabID].location);
    if (index <= 0) {
        tab.find('.tab-back').addClass('tab-back-inactive');
    } else {
        tab.find('.tab-back').removeClass('tab-back-inactive');
    }
    addTabDirChangeListener(tabID, directory);
}

var isMacOS = process.platform === 'darwin';

/**
 * Create a file div
 * @param {files.File} file 
 * @returns {jQuery}
 */
function createFile(file) {
    return new Promise(async (resolve, reject) => {
        var fileDiv = $(`<div class="file ${file.directory ? "directory" : ""} " file-path="${file.path}"></div>`);
        var fileName = $(`<div class="file-name">${file.name}</div>`);
        var fileThumbnail = await getThumbnail(file);
        
        if (!fileThumbnail) return;
        if (fileThumbnail.startsWith('data:image/png;base64,')) {
            var fileIcon = $(`<img class="file-icon" src="${fileThumbnail}"></img>`);
            fileDiv.append(fileIcon);
        } else {
            var fileIcon = $(`<div class="file-icon">${fileThumbnail}</div>`);
            fileDiv.append(fileIcon);
        }

        fileDiv.append(fileName);

        resolve(fileDiv);
    });
}

/**
 * Add a navigation/selection listener to a file element
 * @param {$} fileElm
 * @param {files.File} file
 * @param {string} tabID
 */
function addFileClickListener(fileElm, file, tabID) {
    var doubleClick = false;

    fileElm.on('mousedown', doubleClickListener((e) => {
        if (!e.shiftKey && !e.ctrlKey && !e.metaKey) {
            selectedFiles = [];
            $('.file').removeClass('selected');
        }

        var selected = isSelected(file, tabID);
        if (selected) {
            unselectFile(file, tabID);
            fileElm.removeClass('selected');
        } else {
            selectFile(file, tabID);
            fileElm.addClass('selected');
        }
    }, (e) => {
        if (file.directory && !file.name.toString().endsWith('.app')) {
            if (e.ctrlKey || e.metaKey) {
                createTab(file.path);
            } else {
                navigateTab(tabID, file.path);
            }
        } else {
            openFile(file.path);
        }
    }, 500));

    // Also add a right click menu for .app's that allows you to 'Show Package Contents'
    if (file.name.toString().endsWith('.app')) {
        fileElm.on('contextmenu', (e) => {
            e.preventDefault();
            ipcRenderer.send('show-app-context-menu', { x: e.clientX, y: e.clientY, file: file.path, tab: tabID });
        });
    }

    // When we drag a file to another program, it should think we're dragging the actual file, not the div
    fileElm[0].addEventListener('dragstart',
    /**
     * @param {DragEvent} ev
     */
    (ev) => {
        ev.dataTransfer.effectAllowed = 'copy'
        ev.preventDefault()
        ipcRenderer.send('ondragstart', file.path);
        // ev.dataTransfer.setData('text/plain', file.path);
        ev.dataTransfer.files = selectedFiles.map((file) => file.path);
    });

    fileElm[0].addEventListener('dragover', (ev) => {
        if (!ev.target.classList.contains('directory')) return;
        ev.preventDefault();
        var target = ev.target;
        if (target && target.classList.contains('directory')) target.classList.add('file-dragover');
    });
    
    fileElm[0].addEventListener('dragleave', (ev) => {
        if (!ev.target.classList.contains('directory')) return;
        ev.preventDefault();
        var target = ev.target;
        if (target && target.classList.contains('directory')) target.classList.remove('file-dragover');
    });

    fileElm[0].addEventListener('drop', (ev) => {
        if (!ev.target.classList.contains('directory')) return;
        ev.preventDefault();
        if (ev.target && ev.target.classList.contains('directory')) ev.target.classList.remove('file-dragover');

        // Loop through all selectedFiles and copy them to the target directory
        for (var i = 0; i < selectedFiles.length; i++) {
            moveFile(selectedFiles[i].file, file.path);
        }

        refreshAllTabs();
    });
        
    // Enable dragging
    fileElm.attr('draggable', true);
}

function moveFile(from, to, promptForOverwrite = true) {
    if (!fs.existsSync(from) || !fs.lstatSync(from).isFile() || !fs.existsSync(to) || !fs.lstatSync(to).isDirectory()) return;

    if (promptForOverwrite && fs.existsSync(path.join(to, path.basename(from)))) {
        var overwrite = confirm("File already exists, overwrite?");
        if (!overwrite) return;
    }

    fs.rename(from, path.join(to, path.basename(from)), (err) => {
        if (err) {
            alert("Error moving file: " + err);
        }
    });
}

// On navigate from mainWindow.webContents.send('navigate', args.file);
ipcRenderer.on('navigate', (event, args) => {
    navigateTab(args.tab, args.file);
});

function selectFile(file, tabID) {
    selectedFiles.push({ tab: tabID, file: file.path });
}

function unselectFile(file, tabID) {
    var index = selectedFiles.findIndex((f) => {
        return f.tab == tabID && f.file == file.path;
    });
    selectedFiles.splice(index, 1);
}

function unselectAllFiles(tabID) {
    selectedFiles = selectedFiles.filter((f) => {
        return f.tab != tabID;
    });
}

function isSelected(file, tabID) {
    return selectedFiles.findIndex((f) => {
        return f.tab == tabID && f.file == file.path;
    }) != -1;
}

var appIconCache = {};

/**
 * Get a thumbnail for a file
 * @param {string} file
 * @returns {string} Base64 encoded image
 */ 
function getThumbnail(file, sleep = true) {
    return new Promise(async (resolve, reject) => {
        var ext = path.extname(file.name).toLowerCase().trim().substring(1);

        // if .app
        if (ext == 'app' && file.extra.plist) {
            if (appIconCache[file.path]) {
                resolve(appIconCache[file.path]);
                return;
            }

            var plist = file.extra.plist;
            var iconFile = plist.CFBundleIconFile;
            if (!iconFile) { return null; } 
            if (!iconFile.endsWith('.icns')) iconFile += '.icns';

            var iconPath = path.join(file.path, 'Contents', 'Resources', iconFile);

            var pngOutput = files.icnsToPng(iconPath).then(async (png) => {
                appIconCache[file.path] = png;
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

function refreshTab(tabID) {
    if (!tabs[tabID]) return;
    var directory = tabs[tabID].location;
    var tab = $(`.tab[tab-id="${tabID}"]`);
    var tabContent = tab.find('.tab-content');
    
    files.listDirectory(directory).then(async (fileListing) => {
        tabContent.empty();
        for (var i = 0; i < fileListing.length; i++) {
            var file = fileListing[i];
            var fileDiv = await createFile(file);
            addFileClickListener(fileDiv, file, tabID);
            tabContent.append(fileDiv);
        }
    })

    tab.find('.tab-title').val(formatFancyPath(directory));
    tabs[tabID].location = directory;

    // Check if history is available going backwards, if not add tab-back-inactive
    var history = tabs[tabID].history;
    var index = history.lastIndexOf(tabs[tabID].location);
    if (index <= 0) {
        tab.find('.tab-back').addClass('tab-back-inactive');
    } else {
        tab.find('.tab-back').removeClass('tab-back-inactive');
    }
}

async function addTabDirChangeListener(tabID, directory) {
    var fileFetched = [];
    var first = 0;
    while (tabs[tabID] && tabs[tabID].location == directory) {
        // Dont use files.listDirectory because it's slow,
        // just use fs.readdir
        var newFiles = fs.readdirSync(directory);

        if (newFiles.length != fileFetched.length || $(`.tab[tab-id="${tabID}"]`).find('.tab-content').children().length != newFiles.length) {
            console.log("Reloading: " + directory + " because of change");
            fileFetched = newFiles;
            if (first < 2) first++;
            else refreshTab(tabID);
        }

        await sleep(1000);
    }
}

function refreshAllTabs() {
    for (var tabID in tabs) {
        refreshTab(tabID);
    }
}

function handleTabWindowDrop(tabContent, tabID) {
    tabContent.addEventListener('drop', (ev) => {
        var tabDir = tabs[tabID].location;
        
        for (var i = 0; i < selectedFiles.length; i++) {
            var file = selectedFiles[i].file;
            var dirOfFile = path.dirname(file);
            if (dirOfFile == tabDir) {
                selectFile(selectedFiles[i].file, tabID);
                return;
            };
            moveFile(file, tabDir);
        }

        refreshAllTabs();
    });

    tabContent.addEventListener('dragover', (ev) => {
        ev.preventDefault();
    });

    tabContent.addEventListener('dragenter', (ev) => {
        ev.preventDefault();
    });
}

function closeTab(tabID) {
    var tab = $(`.tab[tab-id="${tabID}"]`);
    tab.remove();
    delete tabs[tabID];
    var tabKeys = Object.keys(tabs);
    if (tabKeys.length > 0) {
        var newActiveTab = tabKeys[0];
        $(`.tab[tab-id="${newActiveTab}"]`).trigger('click');
    } else {
        createTab('~');
    }
}

$(document).on('keydown', (ev) => {
    if (ev.ctrlKey || ev.metaKey) {
        if (ev.key == 'w') {
            ev.preventDefault();
            var activeTab = $('.tab.active');
            if (activeTab.length > 0) {
                var tabID = activeTab.attr('tab-id');
                closeTab(tabID);
            }
        }
    }
    else if (ev.key == 'Backspace') {
        var activeTab = $('.tab.active');
        if (activeTab.length > 0) {
            var tabID = activeTab.attr('tab-id');
            var tabDir = tabs[tabID].location;
            var parentDir = path.dirname(tabDir);
            if (parentDir != tabDir) {
                navigateTab(tabID, parentDir);
            }
        }
    }
});

createTab('~/Downloads');

module.exports = {
    createTab
};
