function readJsonBody(req, maxBytes = 1_000_000) {
    return new Promise((resolve, reject) => {
        let body = '';

        req.on('data', (chunk) => {
            body += chunk.toString('utf8');

            if (body.length > maxBytes) {
                const error = new Error('Request body too large');
                error.status = 413;
                error.code = 'PAYLOAD_TOO_LARGE';
                reject(error);
                req.destroy();
            }
        });

        req.on('end', () => {
            if (!body.trim()) {
                resolve({});
                return;
            }

            try {
                resolve(JSON.parse(body));
            } catch (error) {
                const invalidJsonError = new Error(`Invalid JSON body: ${error.message}`);
                invalidJsonError.status = 400;
                invalidJsonError.code = 'INVALID_JSON';
                reject(invalidJsonError);
            }
        });

        req.on('error', reject);
    });
}

module.exports = {
    readJsonBody
};
