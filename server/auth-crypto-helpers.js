const crypto = require('crypto');

function hashToken(token) {
    return crypto.createHash('sha256').update(token).digest('hex');
}

function randomToken() {
    return crypto.randomBytes(32).toString('hex');
}

function hashPassword(password) {
    return new Promise((resolve, reject) => {
        const salt = crypto.randomBytes(16);
        crypto.scrypt(password, salt, 64, (error, derivedKey) => {
            if (error) {
                reject(error);
                return;
            }

            resolve(`scrypt$${salt.toString('hex')}$${derivedKey.toString('hex')}`);
        });
    });
}

function verifyPassword(password, storedHash) {
    return new Promise((resolve, reject) => {
        const [scheme, saltHex, keyHex] = String(storedHash || '').split('$');
        if (scheme !== 'scrypt' || !saltHex || !keyHex) {
            resolve(false);
            return;
        }

        crypto.scrypt(password, Buffer.from(saltHex, 'hex'), 64, (error, derivedKey) => {
            if (error) {
                reject(error);
                return;
            }

            const expected = Buffer.from(keyHex, 'hex');
            if (expected.length !== derivedKey.length) {
                resolve(false);
                return;
            }

            resolve(crypto.timingSafeEqual(expected, derivedKey));
        });
    });
}

module.exports = {
    hashPassword,
    hashToken,
    randomToken,
    verifyPassword
};
