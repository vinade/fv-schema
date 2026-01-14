import { SR } from '../../src/SR';
import { Schema } from '../../src/Schema';
import { ErrorMessages, BadSchemaError,DataTypeError } from '../../src/errors';

describe('CRITICAL: Data, Scope and References', () => {

    test('should resolve ref looking at sibling fields in root', async () => {
        const schema = new Schema({
            minVal: SR.number(),
            maxVal: SR.number().min(SR.ref('minVal'))
        });

        // Deve passar
        await expect(schema.validate({ minVal: 10, maxVal: 15 })).resolves.toBeUndefined();

        // Deve falhar
        try {
            await schema.validate({ minVal: 10, maxVal: 5 });
        } catch (err) {
            expect(err.report.maxVal).toBeDefined();
        }
    });

    // forma como o 'data' é passado para schemas aninhados.
    test('should resolve ref from nested object back to root parent', async () => {
        const schema = new Schema({
            threshold: SR.number(),
            details: SR.shape({
                val: SR.number().min(SR.ref('threshold')) // Refere-se a um campo fora do shape
            })
        });

        const data = {
            threshold: 10,
            details: { val: 5 } // Inválido, pois 5 < 10
        };

        // Se o ref procurar 'threshold' dentro de 'details', vai dar undefined ou erro
        try {
            await schema.validate(data);
            throw new Error('Should have failed'); // Força erro se passar
        } catch (err) {
            expect(err).toBeInstanceOf(DataTypeError);
            // Verifica se o erro foi de validação e não de "ref not found" ou undefined
            expect(err.report.details).toBeDefined();
        }
    });

    test('should handle circular references gracefully or fail fast', async () => {
        const schema = new Schema({
            a: SR.number().equal(SR.ref('b')),
            b: SR.number().equal(SR.ref('a'))
        });

        // Lógica circular simples
        await expect(schema.validate({ a: 1, b: 1 })).resolves.toBeUndefined();
    });

    // Array de Objetos validando contra uma constante na Raiz
    // Exemplo: Compras não podem exceder o limite do cartão definido na raiz
    test('should resolve root reference from inside an array', async () => {
        const schema = new Schema({
            maxLimit: SR.number(),
            purchases: SR.array().of(
                SR.shape({
                    amount: SR.number().max(SR.ref('maxLimit'))
                })
            )
        });

        const data = {
            maxLimit: 100,
            purchases: [
                { amount: 50 },
                { amount: 150 } // Deve falhar, pois 150 > 100
            ]
        };

        try {
            await schema.validate(data);
        } catch (err) {
            expect(err).toBeInstanceOf(DataTypeError);
            expect(err.report.purchases[1].amount).toBeDefined();
            expect(err.report.purchases[0]).toBeUndefined();
        }
    });

    // Objeto aninhado dependendo de um irmão do pai
    // Exemplo: Endereço de entrega só é obrigatório se o método for 'delivery'
    test('should resolve reference across different branches of the tree', async () => {
        const schema = new Schema({
            method: SR.string(),
            shipping: SR.shape({
                address: SR.custom((val, data, rootMethod) => {
                    if (rootMethod === 'delivery') return !!val;
                    return true;
                }, [], SR.ref('method')) // Passando ref como argumento do custom
            })
        });

        const invalidData = {
            method: 'delivery',
            shipping: { address: null }
        };
        await expect(schema.validate(invalidData)).rejects.toBeInstanceOf(DataTypeError);

        const validData = {
            method: 'delivery',
            shipping: { address: "there" }
        };
        await expect(schema.validate(validData)).resolves.toBeUndefined();

        const invalidData2 = {
            method: null,
            shipping: { address: null }
        };

        await expect(schema.validate(invalidData2)).rejects.toBeInstanceOf(DataTypeError);

        const validData2 = {
            method: 'pickup',
            shipping: { address: null }
        };

        await expect(schema.validate(validData2)).resolves.toBeUndefined();

    });

    // Referência em Validação Condicional (.when equivalent logic)
    // Simulando um "confirm password" que deve ser igual a "password"
    test('should validate password confirmation using root reference', async () => {
        const schema = new Schema({
            auth: SR.shape({
                password: SR.string(),
                confirm: SR.string().equal(SR.ref('auth.password'))
            })
        });

        const data = {
            auth: {
                password: 'secret',
                confirm: 'wrong'
            }
        };

        try {
            await schema.validate(data);
        } catch (err) {
            expect(err.report.auth.confirm).toBeDefined();
        }
    });


    // O "Truque" do encapsulamento { value: ... }
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

    // Referência falhando em Raw Chain Standalone
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

    // Raw Chain dentro de estrutura (Array)
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

    test('should allow a extended rule to access root data via SR.ref', async () => {
        // 1. Registamos uma regra chamada 'minPurchaseValue'
        // Ela espera que o valor atual seja comparado com um 'minimo' que vem da raiz
        SR.extend({
            minPurchaseValue: SR.number().min(SR.ref('minOrderValue')).error('O valor de {name} não atinge o mínimo do pedido ({0})')
        });

        // 2. Criamos o Schema com aninhamento
        const schema = new Schema({
            minOrderValue: SR.number(), // Valor de referência na raiz
            checkout: SR.shape({
                details: SR.shape({
                    shippingCost: SR.minPurchaseValue() // Regra registrada usada aqui no fundo
                })
            })
        });

        // Caso A: Deve Falhar (custo 10 é menor que o mínimo 50 da raiz)
        const invalidData = {
            minOrderValue: 50,
            checkout: {
                details: {
                    shippingCost: 10
                }
            }
        };

        try {
            await schema.validate(invalidData);
            throw new Error('O teste deveria ter falhado');
        } catch (err) {
            expect(err).toBeInstanceOf(DataTypeError);
            // Verifica se o erro propagou o caminho correto no report
            expect(err.report.checkout.details.shippingCost).toBeDefined();
            expect(err.report.checkout.details.shippingCost[0])
                .toContain('não atinge o mínimo do pedido (50)');
        }

        // Caso B: Deve Passar (custo 60 é maior que o mínimo 50 da raiz)
        const validData = {
            minOrderValue: 50,
            checkout: {
                details: {
                    shippingCost: 60
                }
            }
        };

        await expect(schema.validate(validData)).resolves.toBeUndefined();
    });

    test('CHALLENGE: Deep Cross-Branch Dependency Maze', async () => {
        const schema = new Schema({
            // Nível 0
            globalLimit: SR.number(),

            settings: SR.shape({
                // Nível 1: Depende da Raiz
                localThreshold: SR.number().max(SR.ref('globalLimit')),

                advanced: SR.shape({
                    // Nível 2: Depende de um "tio" (irmão do pai)
                    factor: SR.number().custom((val, threshold, data) => {
                        // Tenta acessar settings.localThreshold via Data
                        expect(threshold).toBe(data.settings.localThreshold);
                        const dataThreshold = data.settings.localThreshold;
                        return val <= dataThreshold / 2;
                    }, SR.ref('settings.localThreshold'))
                })
            }),

            stats: SR.shape({
                // Nível 1: Depende de um valor profundamente aninhado em outro galho
                currentValue: SR.number().min(SR.ref('settings.advanced.factor'))
            })
        });

        // Dados que devem falhar:
        // globalLimit (100) -> localThreshold (50 OK) -> factor (30 FAIL, deve ser <= 25)
        // currentValue (10 FAIL, deve ser >= factor)
        const data = {
            globalLimit: 100,
            settings: {
                localThreshold: 50,
                advanced: {
                    factor: 30
                }
            },
            stats: {
                currentValue: 10
            }
        };

        try {
            await schema.validate(data, false); // Queremos todos os erros
            throw new Error('Should have failed the maze');
        } catch (err) {

            if (err.constructor.name === 'JestAssertionError') {
                throw err;
            }

            expect(err).toBeInstanceOf(DataTypeError);
            // O erro no factor (profundo) foi detectado?
            expect(err.report.settings.advanced.factor).toBeDefined();
            // O erro no stats (outro galho) baseado no factor foi detectado?
            expect(err.report.stats.currentValue).toBeDefined();
        }
    });

    test('CHALLENGE: Reference to missing optional path', async () => {
        const schema = new Schema({
            metadata: SR.nullable().shape({
                version: SR.number()
            }),
            content: SR.string().custom((val, version, data) => {
                if (version === undefined) return true; // Se não tem versão, aceita tudo
                return val.startsWith('V' + version);
            }, [], SR.ref('metadata.version'))
        });

        // O dado não tem a chave 'metadata'
        const data = {
            content: "V1_document"
        };

        // Se o seu getValueFromPath fizer: root['metadata']['version']
        // ele vai lançar um "TypeError: Cannot read property 'version' of undefined"
        // e quebrar a execução da sua lib inteira em vez de retornar um erro de validação.
        await expect(schema.validate(data)).resolves.toBeUndefined();
    });

    test('LIMIT: Deep path resolution with mixed array and objects', async () => {
        const schema = new Schema({
            company: SR.shape({
                departments: SR.array().of(
                    SR.shape({
                        id: SR.string(),
                        manager: SR.shape({
                            name: SR.string()
                        })
                    })
                )
            }),
            // Tenta referenciar o nome do gerente do primeiro departamento
            checkManager: SR.string().equal(SR.ref('company.departments.0.manager.name'))
        });

        const data = {
            company: {
                departments: [
                    { id: 'dev', manager: { name: 'Alice' } },
                    { id: 'hr', manager: { name: 'Bob' } }
                ]
            },
            checkManager: 'Alice'
        };

        await expect(schema.validate(data)).resolves.toBeUndefined();
    });

});