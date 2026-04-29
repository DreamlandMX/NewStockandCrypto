const fs = require('fs');
const path = require('path');

const MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.ico': 'image/x-icon',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2'
};

function safeJoin(basePath, targetPath) {
    const resolvedBase = path.resolve(basePath);
    const sanitizedTarget = String(targetPath || '').replace(/^[\\/]+/, '');
    const resolvedPath = path.resolve(resolvedBase, sanitizedTarget);

    if (resolvedPath !== resolvedBase && !resolvedPath.startsWith(`${resolvedBase}${path.sep}`)) {
        return null;
    }

    return resolvedPath;
}

function readStaticFile(filePath, res, sendJson) {
    fs.readFile(filePath, (error, data) => {
        if (error) {
            if (error.code === 'ENOENT') {
                sendJson(res, 404, { error: 'Not found' });
                return;
            }

            sendJson(res, 500, { error: 'File read failed', detail: error.message });
            return;
        }

        const extension = path.extname(filePath).toLowerCase();
        const contentType = MIME_TYPES[extension] || 'application/octet-stream';
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(data);
    });
}

function createStaticFileService(config) {
    const { webRoot, uploadsRoot, sendJson } = config;

    function serveFile(basePath, requestPath, res, options = {}) {
        const filePath = safeJoin(basePath, decodeURIComponent(requestPath));

        if (!filePath) {
            sendJson(res, 400, { error: 'Invalid path' });
            return;
        }

        let targetPath = filePath;
        if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
            if (options.allowDirectories === false) {
                sendJson(res, 404, { error: 'Not found' });
                return;
            }

            targetPath = path.join(filePath, 'index.html');
        }

        readStaticFile(targetPath, res, sendJson);
    }

    function serveStatic(req, res) {
        const requestPath = req.url === '/'
            ? 'index.html'
            : req.url.split('?')[0].replace(/^[\\/]+/, '');
        serveFile(webRoot, requestPath, res, { allowDirectories: true });
    }

    function serveUploads(req, res) {
        const requestPath = req.url.split('?')[0].replace(/^\/uploads\/?/, '');
        if (!requestPath) {
            sendJson(res, 404, { error: 'Not found' });
            return;
        }

        serveFile(uploadsRoot, requestPath, res, { allowDirectories: false });
    }

    return {
        serveStatic,
        serveUploads,
        serveFile
    };
}

module.exports = {
    createStaticFileService,
    safeJoin,
    MIME_TYPES
};
