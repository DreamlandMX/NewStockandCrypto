const test = require('node:test');
const assert = require('node:assert/strict');
const {
    formatUnhandledRejection,
    startUnifiedHttpServer
} = require('../server/server-lifecycle');

test('server lifecycle formats unhandled rejection errors clearly', () => {
    const error = new Error('boom');

    assert.match(formatUnhandledRejection(error), /^UNHANDLED_REJECTION: Error: boom/);
    assert.equal(formatUnhandledRejection('plain failure'), 'UNHANDLED_REJECTION: plain failure');
});

test('server lifecycle creates a server, registers rejection logging, and starts listening', () => {
    const events = {};
    const calls = [];
    const fakeServer = {
        listen(port, host, onStarted) {
            calls.push({ port, host });
            onStarted();
        }
    };
    const fakeHttp = {
        createServer(handler) {
            calls.push({ handler });
            return fakeServer;
        }
    };
    const fakeProcess = {
        on(eventName, handler) {
            events[eventName] = handler;
        }
    };
    const loggerMessages = [];
    let started = false;

    const server = startUnifiedHttpServer({
        appRouter: () => {},
        host: '127.0.0.1',
        port: 9000,
        httpModule: fakeHttp,
        processObject: fakeProcess,
        logger: { error: (message) => loggerMessages.push(message) },
        onStarted: () => {
            started = true;
        }
    });

    events.unhandledRejection('bad promise');

    assert.equal(server, fakeServer);
    assert.equal(started, true);
    assert.equal(calls[1].port, 9000);
    assert.equal(calls[1].host, '127.0.0.1');
    assert.deepEqual(loggerMessages, ['UNHANDLED_REJECTION: bad promise']);
});
