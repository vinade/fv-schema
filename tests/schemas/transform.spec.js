import { SR } from '../../src/SR';
import { Schema } from '../../src/Schema';
import { ErrorMessages, BadSchemaError,DataTypeError } from '../../src/errors';


describe('CRITICAL: Transform & Pipelines', () => {

    test('transform should modify value for subsequent rules', async () => {
        const schema = new Schema({
            tag: SR.string()
                .transform(v => v.toUpperCase())
                .equal('URGENT') // A validação acontece DEPOIS do transform?
        });

        await expect(schema.validate({ tag: 'urgent' })).resolves.toBeUndefined();
    });

    test('transform should affect the final output data if raw chain', async () => {
        // Nota: Sua implementação de Schema não retorna os dados sanitizados (como Yup faz com cast),
        // ela apenas valida. Mas internamente o context.value muda. 
        // É importante saber se isso vaza ou se perde.

        let capturedValue;
        const schema = new Schema(
            SR.string()
                .transform(v => v.trim())
                .custom((v) => { capturedValue = v; return true; })
        );

        await schema.validate('   data   ');
        expect(capturedValue).toBe('data');
    });

    test('transform failure should be caught', async () => {
        const schema = new Schema({
            val: SR.string().transform(() => { throw new Error('Transform failed') })
        });

        await expect(schema.validate({ val: 'x' })).rejects.toThrow('Transform failed');
    });

    test('LIMIT: Ref to Transformed Value', async () => {
        const schema = new Schema({
            // Transforma '100' (string) em 100 (number)
            ageStr: SR.string().transform(v => parseInt(v)),

            // Valida se outro campo é igual ao valor JÁ TRANSFORMADO
            ageConfirm: SR.number().custom((val, ageStrValue) => {
                // ageStrValue deve ser o valor orignal '100', e não transformado
                return (typeof ageStrValue === 'string') && (val == ageStrValue);
            }, SR.ref('ageStr'))
        });

        const data = {
            ageStr: '100',
            ageConfirm: 100
        };

        // Se o SR.ref pegar o valor bruto (string), o custom vai comparar 100 === '100' (false)
        await expect(schema.validate(data)).resolves.toBeUndefined();
    });

    test('transform should not affect params resolution of previous rules', async () => {
        let seenInMin;
        let seenInCustom;

        const schema = new Schema({
            val: SR.string()
                .min(3)
                .custom((value) => {
                    seenInMin = value;
                    return true;
                })
                .transform(v => v.toUpperCase())
                .custom((value) => {
                    seenInCustom = value;
                    return true;
                })
        });

        await schema.validate({ val: 'abc' });

        // Antes do transform
        expect(seenInMin).toBe('abc');

        // Depois do transform
        expect(seenInCustom).toBe('ABC');
    });

    test('dynamic error message should not observe value mutated by later transform', async () => {

        const schema = new Schema({
            val: SR.string()
                .custom(() => false)
                .error(ctx => `Value was "${ctx.value}"`)
                .transform(v => v.toUpperCase())
        });

        try {
            await schema.validate({ val: 'abc' });
            throw new Error('Should fail');
        } catch (err) {
            expect(err.report.val[0]).toBe('Value was "abc"');
        }

    });

    test('transform in one field must not affect refs in other fields', async () => {

        const schema = new Schema({
            a: SR.string().transform(() => 'X'),
            b: SR.string().equal(SR.ref('a'))
        });

        const data = { a: 'original', b: 'original' };

        await expect(schema.validate(data)).resolves.toBeUndefined();
    });

    test('transform exception must not poison future validations', async () => {

        const schema = new Schema({
            val: SR.string().transform(v => {
                if (v === 'bad') throw new Error('Bad transform');
                return v;
            })
        });

        await expect(schema.validate({ val: 'bad' }))
            .rejects.toThrow('Bad transform');

        // Segunda execução deve funcionar normalmente
        await expect(schema.validate({ val: 'ok' }))
            .resolves.toBeUndefined();
    });
});