import { SR } from '../../src/SR';
import { Schema } from '../../src/Schema';
import { ErrorMessages, BadSchemaError,DataTypeError } from '../../src/errors';


describe('EDGE CASE: Raw Chain & References', () => {

    // CASO 1: O "Truque" do encapsulamento { value: ... }
    // Este teste mostra como o Schema Raw encapsula o dado.
    // Se o dado vira { value: 'abc' }, então ref('value') deve funcionar (auto-referência).
    test('raw chain standalone can reference itself via "value" key', async () => {
        // Regra: O valor deve ser igual ao valor (tautologia, mas prova o encapsulamento)
        const schema = new Schema(
            SR.string().equal(SR.ref('value')) 
        );

        // Internamente vira { value: 'teste' }
        // ref('value') busca nesse objeto e acha 'teste'. 'teste' === 'teste'.
        await expect(schema.validate('teste')).resolves.toBeUndefined();
    });

    // CASO 2: Referência falhando em Raw Chain Standalone
    // Como não há "irmãos", referenciar qualquer outra coisa deve falhar/ser undefined
    test('raw chain standalone cannot find non-existent keys', async () => {
        const schema = new Schema(
            SR.string().equal(SR.ref('otherField'))
        );

        // Internamente vira { value: 'teste' }. 'otherField' é undefined.
        // 'teste' === undefined -> Falso.
        try {
            await schema.validate('teste');
        } catch (err) {
            expect(err).toBeInstanceOf(DataTypeError);
            // Confirma que o erro é de igualdade
            expect(err.report).toBeDefined(); 
        }
    });

    // CASO CRÍTICO 3: Raw Chain dentro de estrutura (Array)
    // Esse é o caso REAL onde Raw Chain precisa de Refs.
    // Cada item do array é validado isoladamente. Se não passarmos o ROOT,
    // o item '10' vira { value: 10 } e não acha 'maxVal' no pai.
    test('nested raw chain (array item) MUST see root data', async () => {
        const schema = new Schema({
            maxVal: SR.number(),
            // .of() cria validações que são tecnicamente Raw Chains para cada item
            numbers: SR.array().of(
                SR.number().max(SR.ref('maxVal'))
            )
        });

        const data = {
            maxVal: 5,
            numbers: [3, 4, 6] // 6 falha
        };

        // Sem a correção de propagação de ROOT, isso falharia incorretamente (acharia undefined em maxVal)
        // ou passaria incorretamente (dependendo da lógica de comparação com undefined).
        // Com a correção, ele deve pegar o 5 lá de cima.
        try {
            await schema.validate(data);
        } catch (err) {
            // Esperamos erro no índice 2
            expect(err.report.numbers[2]).toBeDefined();
            // Índice 0 e 1 devem passar
            expect(err.report.numbers[0]).toBeUndefined();
        }
    });
});