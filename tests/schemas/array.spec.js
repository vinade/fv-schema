import { SR } from '../../src/SR';
import { Schema } from '../../src/Schema';
import { DataTypeError } from '../../src/errors';


describe('Array validation (array().of(schema))', () => {

    test('valid array of primitives passes', async () => {
        const schema = new Schema({
            values: SR.array().of(
                SR.number().min(1)
            )
        });

        await expect(schema.validate({
            values: [1, 2, 3]
        })).resolves.toBeUndefined();
    });

    test('invalid array item reports index error', async () => {
        const schema = new Schema({
            values: SR.array().of(
                SR.number().min(10)
            )
        });

        try {
            await schema.validate({
                values: [20, 5, 30]
            });
        } catch (err) {
            expect(err).toBeInstanceOf(DataTypeError);
            expect(err.report.values[1]).toBeDefined();
        }
    });

    test('array().of() works with shape', async () => {
        const schema = new Schema({
            users: SR.array().of(
                SR.shape({
                    email: SR.string().email().required()
                })
            )
        });

        await expect(schema.validate({
            users: [
                { email: 'a@test.com' },
                { email: 'b@test.com' }
            ]
        })).resolves.toBeUndefined();
    });

    test('array().of() abortEarly stops at first invalid item', async () => {
        const schema = new Schema({
            values: SR.array().of(
                SR.number().min(5)
            )
        });

        try {
            await schema.validate({
                values: [1, 2, 10]
            }, true);
        } catch (err) {
            expect(Object.keys(err.report.values).length).toBe(1);
        }
    });

    test('LIMIT: Deep Array Index Reporting', async () => {
        const schema = new Schema({
            users: SR.array().of(
                SR.shape({
                    profile: SR.shape({
                        score: SR.number().min(10)
                    })
                })
            )
        });

        // Um array longo onde apenas o último item é inválido
        const users = Array(50).fill({ profile: { score: 20 } });
        users.push({ profile: { score: 5 } }); // O item 50 é o erro

        try {
            await schema.validate({ users }, false);
        } catch (err) {
            // O report deve ser esparso: apenas o índice 50 deve existir
            expect(err.report.users[49]).toBeUndefined(); 
            expect(err.report.users[50].profile.score).toBeDefined();
            // Isso testa se você não está fazendo um .push() simples no array de erros,
            // mas sim respeitando os índices originais.
        }
    });
});
