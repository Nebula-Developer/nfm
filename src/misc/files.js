const fs = require('fs');
const path = require('path');
const plist = require('simple-plist');
const icns = require('iconutil');

var isMacOS = process.platform === 'darwin';

/**
 * List all files and directories in a directory.
 * @param {string} directory
 * @returns {File[]}
 */
function listDirectory(directory) {
    return new Promise((resolve, reject) => {
        var files = [];
        directory = formatPath(directory);

        fs.readdirSync(directory).forEach(file => {
            var filePath = path.join(directory, file);
            if (!fs.existsSync(filePath)) return;

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

        resolve(files);
    });
}

class File {
    constructor(name, path, directory, stats, extra) {
        this.name = name;
        this.path = path;
        this.directory = directory;
        this.stats = stats;
        this.extra = extra;
    }
}

/**
 * Convert an apple icon (icns) to a png.
 * @param {string} icnsPath
 */
async function icnsToPng(icnsPath) {
    var png = await (new Promise((resolve, reject) => {
        icns.toIconset(icnsPath, (err, iconset) => {
            if (err) {
                reject(err);
            } else {
                var pngKeys = Object.keys(iconset);
                var Last = pngKeys[pngKeys.length - 1];
                var pngHighest = iconset[Last];

                if (pngHighest == null) {
                    reject("No icon found.");
                    return;
                }

                var base64 = Buffer.from(pngHighest).toString('base64');
                var output = `data:image/png;base64,${base64}`;
                resolve(output);
            }
        });
    }));

    return png;
}

module.exports = {
    listDirectory,
    File,
    icnsToPng
};
