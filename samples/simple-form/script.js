const { FV, SR } = FVSchema;

const form = document.getElementById('register-form');
const sendButton = document.getElementById('send');
const title = document.getElementById('title');

const fv = new FV(form);

SR.register('passwordConfirm', function(...args){
    const [value, password] = args;
    console.log(args);
    return value === password;
}, 'This field must have the same value of Password');

/**
 * =========================
 * Helpers de UI (Erros)
 * =========================
 */

function getErrorSpan(input) {
    return input.closest('.field')?.querySelector('.error-message') || null;
}

function clearInputError(input) {
    input.classList.remove('error');

    const errorSpan = getErrorSpan(input);
    if (errorSpan) {
        errorSpan.textContent = '';
    }
}

function setInputError(input, message) {
    input.classList.add('error');

    const errorSpan = getErrorSpan(input);
    if (errorSpan) {
        errorSpan.textContent = message;
    }
}

function clearAllErrors() {
    form.querySelectorAll('input').forEach(clearInputError);
}

/**
 * Limpa erro do campo assim que o usuário digitar
 */
function bindClearErrorsOnInput() {
    form.addEventListener('input', (event) => {
        const target = event.target;

        if (target.tagName === 'INPUT') {
            clearInputError(target);
        }
    });
}

/**
 * =========================
 * Fake submit (mock async)
 * =========================
 */
function fakeSubmit() {
    const originalTitle = title.innerText;
    title.innerText = `${originalTitle} - Success`;

    return new Promise(resolve => {
        setTimeout(() => {
            title.innerText = originalTitle;
            resolve();
        }, 5000);
    });
}

/**
 * =========================
 * Validação e Submit
 * =========================
 */

async function handleSubmit(event) {
    event.preventDefault();

    clearAllErrors();

    try {
        const result = await fv.validate();

        if (result.valid) {
            await submitForm();
            return;
        }

        showValidationErrors(result.errors);

    } catch (error) {
        console.error('Erro interno na validação:', error);
        throw error;
    }
}

async function submitForm() {
    sendButton.disabled = true;

    try {
        await fakeSubmit();
    } finally {
        sendButton.disabled = false;
    }
}

function showValidationErrors(errors) {
    Object.values(errors).forEach(({ element, messages }) => {
        setInputError(element, messages[0]);
    });
}

/**
 * =========================
 * Init
 * =========================
 */
sendButton.addEventListener('click', handleSubmit);
bindClearErrorsOnInput();
