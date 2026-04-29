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
    getRegisterFormError,
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

test('register validation explains the first missing field', () => {
    assert.equal(getRegisterFormError({}), 'Enter your full name.');
    assert.equal(getRegisterFormError({ fullName: 'Ada' }), 'Enter your email address.');
    assert.equal(
        getRegisterFormError({ fullName: 'Ada', email: 'ada@example.com', password: 'short' }),
        'Password must be at least 8 characters.'
    );
});

test('register validation requires matching password and terms agreement', () => {
    assert.equal(
        getRegisterFormError({
            fullName: 'Ada',
            email: 'ada@example.com',
            password: 'Password123',
            confirmPassword: 'Password124',
            termsAccepted: true
        }),
        'Passwords do not match.'
    );
    assert.equal(
        getRegisterFormError({
            fullName: 'Ada',
            email: 'ada@example.com',
            password: 'Password123',
            confirmPassword: 'Password123',
            termsAccepted: false
        }),
        'Please agree to the Terms of Service and Privacy Policy.'
    );
    assert.equal(
        getRegisterFormError({
            fullName: 'Ada',
            email: 'ada@example.com',
            password: 'Password123',
            confirmPassword: 'Password123',
            termsAccepted: true
        }),
        ''
    );
});
