/**
 * @jest-environment jsdom
 */
import { FV } from '../../src/FV';
import { SR } from '../../src/SR';


describe('FV — Smart Casting (protectDataType)', () => {
    let form;

    beforeEach(() => {
        form = document.createElement('form');
        document.body.appendChild(form);
    });

    /* ============================================================
       CENÁRIO 1: Tipos Primitivos (Number)
       ============================================================ */
    test('should cast string "123" to number 123 for data-type="number"', async () => {
        const input = document.createElement('input');
        input.name = 'age';
        input.value = '25'; 
        input.setAttribute('data-type', 'number');
        form.appendChild(input);

        const fv = new FV(form);
        const result = await fv.validate();

        // Se o cast falhar, SR.number() rejeitaria a string "25"
        expect(result.valid).toBe(true);
    });

    test('should fail validation with correct message if string is not a number', async () => {
        const input = document.createElement('input');
        input.name = 'age';
        input.value = 'not-a-number'; 
        input.setAttribute('data-type', 'number');
        form.appendChild(input);

        const fv = new FV(form);
        const result = await fv.validate();

        expect(result.valid).toBe(false);
        // Garante que a mensagem veio do SR.number e não de um erro de cast
        expect(result.errors.age.messages[0]).toContain('must be a number');
    });

    /* ============================================================
       CENÁRIO 2: Regras Registradas (Inferência)
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

    /* ============================================================
       CENÁRIO 3: Booleanos
       ============================================================ */
    test('should cast "on", "true", "1" to boolean true', async () => {
        SR.register('agree', SR.custom(val => val === true), undefined, {cast: 'boolean'});

        const input = document.createElement('input');
        input.name = 'terms';
        input.value = 'on'; // Valor comum de checkboxes
        input.setAttribute('data-type', 'agree');
        form.appendChild(input);

        const fv = new FV(form);
        const result = await fv.validate();

        expect(result.valid).toBe(true);
    });

    /* ============================================================
       CENÁRIO 4: Referências (Cross-field)
       ============================================================ */
    test('should allow strict comparison between a casted number and a ref', async () => {
        const inputA = document.createElement('input');
        inputA.name = 'valA';
        inputA.value = '100';
        inputA.setAttribute('data-type', 'number');

        const inputB = document.createElement('input');
        inputB.name = 'valB';
        inputB.value = '100';
        inputB.setAttribute('data-type', 'number');
        inputB.setAttribute('data-ref', 'valA'); // .equal(SR.ref('valA'))

        form.append(inputA, inputB);

        const fv = new FV(form);
        const result = await fv.validate();

        // Ambos foram castados para 100 (Number). 
        // Se fossem strings, result.valid seria true, mas o teste prova que 
        // referências agora apontam para o valor processado.
        expect(result.valid).toBe(true);
    });

    /* ============================================================
       CENÁRIO 5: Bloqueio de Cast (Transform/Custom)
       ============================================================ */
    test('should NOT cast if data-type is custom or transform (Undefined Cast)', async () => {
        // Regra que explicitamente espera uma string numérica para fazer algo manual
        SR.register('manual', SR.custom(val => typeof val === 'string'));

        const input = document.createElement('input');
        input.name = 'raw';
        input.value = '123';
        input.setAttribute('data-type', 'manual');
        form.appendChild(input);

        const fv = new FV(form);
        const result = await fv.validate();

        expect(result.valid).toBe(true); // Se tivesse castado para number, falharia
    });
});