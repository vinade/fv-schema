/**
 * @jest-environment jsdom
 */

import { FV } from '../../src/FV';
import { SR } from '../../src/SR';
import { DataTypeError } from '../../src/errors';


describe('FV — Dynamic data-ref Injection Tests', () => {
    let form;

    beforeEach(() => {
        form = document.createElement('form');
        document.body.appendChild(form);
    });

    /* ============================================================
       CENÁRIO 1: Tipos Primitivos (Number)
         ============================================================ */
    test('should infer number cast for custom rules registered from number chain', async () => {
        // Registramos 'score' que é baseado em number
        SR.register('score', SR.number().min(0).max(100));

        const input = document.createElement('input');
        input.name = 'points';
        input.value = '50';
        input.setAttribute('data-type', 'score');
        form.appendChild(input);

        const fv = new FV(form);
        const result = await fv.validate();

        expect(result.valid).toBe(true);
    });


});
