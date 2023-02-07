const fs = require('fs');
const path = require('path');
const plist = require('simple-plist');

var isMacOS = process.platform === 'darwin';

function listDirectory(p) {
    var files = [];

    fs.readdirSync(p).forEach(file => {
        var filePath = path.join(p, file);
        var stats = fs.statSync(filePath);
        var extra = { };
        var isApp = isMacOS && stats.isDirectory() && file.endsWith('.app');

        if (isApp) {
            var infoPlist = path.join(filePath, 'Contents', 'Info.plist');
            try {
                var plistRead = plist.readFileSync(infoPlist);
                extra['plist'] = plistRead;
            } catch { }
        }

        files.push({
            name: file,
            path: filePath,
            directory: stats.isDirectory(),
            stats,
            extra
        });
    });

    return files;
}

module.exports = {
    listDirectory
};
