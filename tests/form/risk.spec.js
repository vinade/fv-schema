/**
 * @jest-environment jsdom
 */
import { FV } from '../../src/FV';
import { SR } from '../../src/SR';
import { DataTypeError } from '../../src/errors';

describe('FV — Risk exploration tests', () => {

    let form;

    beforeEach(() => {
        form = document.createElement('form');
        document.body.appendChild(form);
    });

    afterEach(() => {
        document.body.innerHTML = '';
    });

    /* ============================================================
       RISK 1 — Ordem fixa de composição de regras
       ============================================================ */

    test('required is evaluated before data-type', async () => {
        const input = document.createElement('input');
        input.name = 'field';
        input.setAttribute('required', 'f');
        input.setAttribute('data-type', 'string');
        input.value = '';

        form.appendChild(input);

        const fv = new FV(form);

        const result = await fv.validate();
        expect(result.valid).toBe(false);
        expect(result.errors.field).toBeTruthy();
    });

    test('nullable skips validation regardless of data-type', async () => {
        const input = document.createElement('input');
        input.name = 'field';
        input.setAttribute('nullable', '');
        input.setAttribute('data-type', 'number');
        input.value = '';

        form.appendChild(input);

        const fv = new FV(form);
        const result = await fv.validate();

        expect(result.valid).toBe(true);
    });

    /* ============================================================
       RISK 2 — required + nullable coexistence
       ============================================================ */

    test('required and nullable together defers error to core validation', async () => {
        const input = document.createElement('input');
        input.name = 'field';
        input.setAttribute('required', '');
        input.setAttribute('nullable', '');
        input.setAttribute('data-type', 'string');

        form.appendChild(input);

        const fv = new FV(form);

        await expect(
            fv.validate()
        ).rejects.toBeInstanceOf(Error);
    });

    /* ============================================================
       RISK 3 — data-ref strict equality behavior
       ============================================================ */

    test('data-ref resolves only from root, not transformed values', async () => {
        SR.register(
            'trimString',
            SR.string().transform(v => v.trim()),
            'Invalid'
        );

        SR.register('same', (a,b) => a===b);

        const a = document.createElement('input');
        a.name = 'a';
        a.value = ' abc ';
        a.setAttribute('data-type', 'trimString');

        const b = document.createElement('input');
        b.name = 'b';
        b.value = 'abc';
        b.setAttribute('data-type', 'same');
        b.setAttribute('data-ref', 'a');

        form.append(a, b);

        const fv = new FV(form);
        const result = await fv.validate();

        expect(result.valid).toBe(false);
    });

    test('data-ref resolves as parameter of new rule', async () => {
        SR.register('same', (a,b) => a===b);

        const a = document.createElement('input');
        a.name = 'a';
        a.value = 'abc';

        const b = document.createElement('input');
        b.name = 'b';
        b.value = 'abc';
        b.setAttribute('data-type', 'same');
        b.setAttribute('data-ref', 'a');

        form.append(a, b);

        const fv = new FV(form);
        const result = await fv.validate();

        expect(result.valid).toBe(true);
    });

    /* ============================================================
       RISK 4 — Schema congelado após primeiro validate
       ============================================================ */

    test('schema does not change if DOM is modified after first validate', async () => {
        const input = document.createElement('input');
        input.name = 'field';
        input.value = 'abc';
        input.setAttribute('data-type', 'string');

        form.appendChild(input);

        const fv = new FV(form);

        let result = await fv.validate();
        expect(result.valid).toBe(true);

        input.setAttribute('required', '');
        input.value = '';

        result = await fv.validate();
        expect(result.valid).toBe(true); // schema congelado
    });

    /* ============================================================
       RISK 5 — Campos sem regras viram noop
       ============================================================ */

    test('field without validation attributes always passes', async () => {
        const input = document.createElement('input');
        input.name = 'noop';
        input.value = '';

        form.appendChild(input);

        const fv = new FV(form);
        const result = await fv.validate();

        expect(result.valid).toBe(true);
    });

    /* ============================================================
       RISK 6 — Boolean attributes behavior
       ============================================================ */

    test('nullable attribute with value \"false\" is still treated as nullable', async () => {
        const input = document.createElement('input');
        input.name = 'field';
        input.setAttribute('nullable', 'false');
        input.setAttribute('data-type', 'string');
        input.value = '';

        form.appendChild(input);

        const fv = new FV(form);
        const result = await fv.validate();

        expect(result.valid).toBe(true);
    });

    /* ============================================================
       RISK 7 — data-type inválido deve falhar rápido
       ============================================================ */

    test('unknown data-type throws schema error', () => {
        const input = document.createElement('input');
        input.name = 'field';
        input.setAttribute('data-type', 'does-not-exist');

        form.appendChild(input);

        const fv = new FV(form);

        expect(() => fv.buildSchema()).toThrow();
    });

    /* ============================================================
       RISK 8 — Erro dentro de custom não é convertido
       ============================================================ */

    test('exception inside custom rule propagates and aborts validation', async () => {
        SR.register(
            'explosive',
            SR.string().custom(() => {
                throw new Error('Boom');
            }),
            'Invalid'
        );

        const input = document.createElement('input');
        input.name = 'field';
        input.value = 'x';
        input.setAttribute('data-type', 'explosive');

        form.appendChild(input);

        const fv = new FV(form);

        await expect(
            fv.validate()
        ).rejects.toThrow('Boom');
    });

    /* ============================================================
       RISK 9 — DataTypeError é tratado como erro de dado
       ============================================================ */

    test('DataTypeError inside rule is captured as validation error', async () => {
        SR.register(
            'fail',
            SR.string().custom(() => {
                return new DataTypeError('Invalid');
            }),
            'Invalid'
        );

        const input = document.createElement('input');
        input.name = 'field';
        input.value = 'x';
        input.setAttribute('data-type', 'fail');

        form.appendChild(input);

        const fv = new FV(form);
        const result = await fv.validate();

        expect(result.valid).toBe(false);
        expect(result.errors.field).toBeTruthy();
    });

});
