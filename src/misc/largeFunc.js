const child_process = require('child_process');

var shortcuts = { };

function addShortcutListener(callback, ...keys) {
    var keyMap = {};
    var inOrder = false;

    keys = keys.map(key => {
        if (key == 'inOrder') {
            inOrder = true;
            return null;
        }
        return key.toLowerCase();
    }).filter(key => key != null);

    keys.forEach(key => { keyMap[key] = false; });

    function keyDown(e) {
        var key = e.key.toLowerCase();
        if (keyMap[key] === true) return;
        if (keyMap[key] === false) keyMap[key] = true;

        if (inOrder) {
            var allBefore = true;
            var allAfter = true;
            for (var i = 0; i < keys.length; i++) {
                if (keys[i] == key) break;
                if (keyMap[keys[i]] === false) allBefore = false;
            }
            for (var i = keys.length - 1; i >= 0; i--) {
                if (keys[i] == key) break;
                if (keyMap[keys[i]] === true) allAfter = false;
            }

            if (!allBefore || !allAfter) {
                for (var key in keyMap) keyMap[key] = false;
                keyMap[key] = true;
            }
        }

        var getAll = 0;
        for (var key in keyMap) if (keyMap[key] === true) getAll++;

        if (getAll == keys.length) callback();
    }

    function keyUp(e) {
        var key = e.key.toLowerCase();
        if (keyMap[key] === true) { keyMap[key] = false; }
    }

    document.addEventListener('keydown', keyDown);
    document.addEventListener('keyup', keyUp);

    var id = genId();
    shortcuts[id] = { remove: () => {
        document.removeEventListener('keydown', keyDown);
        document.removeEventListener('keyup', keyUp);
        delete shortcuts[id];
    }, execute: () => { callback(); } };

    return id;
}

function removeShortcutListener(id) {
    if (shortcuts[id]) {
        shortcuts[id].remove();
        return true;
    } else return false;
}

var isMacOS = process.platform === 'darwin';

function openFile(file) {
    if (isMacOS) {
        child_process.exec(`open "${file}"`);
    } else {
        child_process.exec(`start "" "${file}"`);
    }
}
