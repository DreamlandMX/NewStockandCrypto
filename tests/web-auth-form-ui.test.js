const test = require('node:test');
const assert = require('node:assert/strict');

globalThis.document = {
    createElement() {
        return {
            className: '',
            dataset: {},
            style: {},
            textContent: ''
        };
    }
};

const {
    renderFormMessage,
    setButtonBusy
} = require('../web/js/auth-form-ui');

function fakeForm() {
    let messageNode = null;
    return {
        querySelector(selector) {
            return selector === '.auth-message' ? messageNode : null;
        },
        prepend(node) {
            messageNode = node;
        },
        get messageNode() {
            return messageNode;
        }
    };
}

test('form UI renders an error message in the form', () => {
    const form = fakeForm();

    renderFormMessage(form, 'Try again', 'error');

    assert.equal(form.messageNode.textContent, 'Try again');
    assert.equal(form.messageNode.style.display, 'block');
    assert.match(form.messageNode.style.color, /FECACA/);
});

test('form UI hides empty messages', () => {
    const form = fakeForm();

    renderFormMessage(form, '');

    assert.equal(form.messageNode.textContent, '');
    assert.equal(form.messageNode.style.display, 'none');
});

test('form UI toggles button busy state', () => {
    const button = {
        dataset: {},
        disabled: false,
        textContent: 'Sign In'
    };

    setButtonBusy(button, true, 'Signing in...');
    assert.equal(button.disabled, true);
    assert.equal(button.textContent, 'Signing in...');

    setButtonBusy(button, false);
    assert.equal(button.disabled, false);
    assert.equal(button.textContent, 'Sign In');
});
