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

    test('should pass data-ref as an SR.ref argument to the data-type method', async () => {

        SR.register('smax', (a,b)=> a <=b, "{name} exceeds the allowed maximum");
        
        // Cenário: O campo 'max_limit' define o teto para 'score'
        const limitInput = document.createElement('input');
        limitInput.name = 'max_limit';
        limitInput.value = '100';
        limitInput.setAttribute('data-type', 'number');

        const scoreInput = document.createElement('input');
        scoreInput.name = 'score';
        scoreInput.value = '150'; // Inválido: 150 > 100
        scoreInput.setAttribute('data-type', 'smax'); // Aqui 'max' deve receber o ref
        scoreInput.setAttribute('data-ref', 'max_limit');

        form.append(limitInput, scoreInput);

        const fv = new FV(form);
        const result = await fv.validate();

        // O teste prova que o FV não fez .equal(), mas sim .max(SR.ref('max_limit'))
        expect(result.valid).toBe(false);
        expect(result.errors.score.messages[0]).toContain('exceeds the allowed maximum');
    });

    test('should use data-ref as parameter for custom registered rules', async () => {
        // Registramos uma regra que compara se o valor é o dobro do outro
        SR.register('isDouble', (val, other) => val === other * 2, 'Must be double of {0}');

        const baseInput = document.createElement('input');
        baseInput.name = 'baseValue';
        baseInput.value = '50';
        baseInput.setAttribute('data-type', 'number');

        const targetInput = document.createElement('input');
        targetInput.name = 'targetValue';
        targetInput.value = '100'; // Válido: 100 é 50 * 2
        targetInput.setAttribute('data-type', 'isDouble');
        targetInput.setAttribute('data-ref', 'baseValue');

        form.append(baseInput, targetInput);

        const fv = new FV(form);
        const result = await fv.validate();

        expect(result.valid).toBe(true);

        // Agora testando a falha
        targetInput.value = '101';
        const resultFail = await fv.validate();
        expect(resultFail.valid).toBe(false);
        expect(resultFail.errors.targetValue.messages[0]).toContain('Must be double of 50');
    });

    test('should fallback to .equal() when data-ref is present WITHOUT data-type', async () => {
        const password = document.createElement('input');
        password.name = 'password';
        password.value = '123456';

        const confirm = document.createElement('input');
        confirm.name = 'confirm';
        confirm.value = 'different';
        confirm.setAttribute('data-ref', 'password'); // Sem data-type, assume igualdade

        form.append(password, confirm);

        const fv = new FV(form);
        const result = await fv.validate();

        expect(result.valid).toBe(false);
        // Mensagem padrão do SR.equal [cite: 1, 12]
        expect(result.errors.confirm.messages[0]).toContain('does not match the expected value');
    });
});
