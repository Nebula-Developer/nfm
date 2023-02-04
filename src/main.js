const { ipcRenderer } = require('electron');
const $ = require('jquery');
const path = require('path');

function doubleClickListener(click1 = null, click2 = null, time = 300) {
    var timeout = null;
    return function(e) {
        if (timeout) {
            clearTimeout(timeout);
            timeout = null;
            if (click2) click2(e);
        } else {
            if (click1) click1(e);
            timeout = setTimeout(() => {
                timeout = null;
            }, time);
        }
    }
}

function listDirectory(tab, directory) {
    directory = directory.replace('~', process.env.HOME);
    const files = ipcRenderer.sendSync('list-directory', directory);
    var tabContent = $(tab).find('.tabContent');
    var tabTitle = $(tab).find('.tabTitle');

    tabTitle.val(directory);
    tabContent.empty();

    if (files == null) {
        tabContent.append('<li>Directory does not exist</li>');    
        return;
    };


    files.forEach(file => {
        const li = document.createElement('li');
        li.textContent = file.name;
        if (file.type == 'file') {
            li.textContent += ' (' + Math.round((file.size * 100) / 1024) / 100 + ' KB)';
        }
    
        if (file.type == 'directory') {
            li.addEventListener('mousedown', doubleClickListener((e) => {
                if (!e.ctrlKey && !e.shiftKey && !e.metaKey) {
                    $('li[class="selected"]').removeClass('selected');
                } else if ($(e.target).hasClass('selected')) {
                    $(e.target).removeClass('selected');
                    return;
                }

                $(e.target).addClass('selected');
            }, (e) => {
                if (e.ctrlKey) {
                    createFileTab(path.resolve(directory, file.name));
                    return;
                }
                listDirectory(tab, path.resolve(directory, file.name));
            }));
        } else {
            li.addEventListener('mousedown', doubleClickListener((e) => {
                if (!e.ctrlKey && !e.shiftKey && !e.metaKey) {
                    $('li[class="selected"]').removeClass('selected');
                } else if ($(e.target).hasClass('selected')) {
                    $(e.target).removeClass('selected');
                    return;
                }

                $(e.target).addClass('selected');
            }, (e) => {
                if (e.ctrlKey || e.shiftKey || e.metaKey) return;
                ipcRenderer.send('open-file', path.resolve(directory, file.name));
            }));
        }

        tabContent.append(li);
    });

    const li = document.createElement('li');
    li.textContent = '..';
    li.addEventListener('click', () => {
        listDirectory(tab, path.resolve(directory, '..'));
    });

    tabContent.prepend(li);
}

createFileTab(process.cwd());

function handleFileClick(event, file) {
    
}

function createFileTab(folder) {
    var newTab = $("<div class='tab'></div>");
    var parent = $("#fileView");
    var tabContent = $("<div class='tabContent'></div>");
    var tabTitle = $("<input type='text' class='tabTitle'></input>");
    newTab.append(tabTitle);
    newTab.append(tabContent);
    parent.append(newTab);
    tabTitle.text(folder);
    listDirectory(newTab[0], folder);
    newTab.on('mousedown', () => {
        $('.tab').removeClass('selected');
        newTab.addClass('selected');
    });

    $('.tab').removeClass('selected');
    newTab.addClass('selected');
    $('li').removeClass('selected');

    tabTitle.on('keydown', (e) => {
        if (e.key == 'Enter') {
            listDirectory(newTab[0], tabTitle.val());
        }
    });
}

$(document).on('keydown', (e) => {
    // if ctrl + l, focus on the tab title
    if (e.ctrlKey && e.key == 'l') {
        if ($('.tab.selected').length > 0) {
            $('.tab.selected .tabTitle').focus();
        } else if ($('.tab').length > 0) {
            $('.tab:first-child .tabTitle').focus();
        }
    }

    // if backspace, go back a directory
    if (e.key == 'Backspace') {
        if ($('.tab.selected').length > 0) {
            var tab = $('.tab.selected');
            var tabTitle = tab.find('.tabTitle');
            listDirectory(tab[0], path.resolve(tabTitle.val(), '..'));
        } else if ($('.tab').length > 0) {
            var tab = $('.tab:first-child');
            var tabTitle = tab.find('.tabTitle');
            listDirectory(tab[0], path.resolve(tabTitle.val(), '..'));
        }
    }
});