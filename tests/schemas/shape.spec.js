import { SR } from '../../src/SR';
import { Schema } from '../../src/Schema';
import { ErrorMessages, BadSchemaError,DataTypeError } from '../../src/errors';


function createDeepSchema(depth) {
    let schema = SR.shape({
        value: SR.number().min(1)
    });

    for (let i = 0; i < depth; i++) {
        schema = SR.shape({
            nested: schema
        });
    }

    return schema;
}

function createDeepData(depth, value) {
    let data = { value };

    for (let i = 0; i < depth; i++) {
        data = { nested: data };
    }

    return data;
}

describe('Deep shape stress tests', () => {

    test('deep valid structure passes validation', async () => {
        const depth = 10;
        const schema = new Schema({
            root: createDeepSchema(depth)
        });

        const data = {
            root: createDeepData(depth, 5)
        };

        await expect(schema.validate(data))
            .resolves
            .toBeUndefined();
    });

    test('deep invalid structure reports correct error', async () => {
        const depth = 10;
        const schema = new Schema({
            root: createDeepSchema(depth)
        });

        const data = {
            root: createDeepData(depth, 0) // inválido
        };

        try {
            await schema.validate(data);
        } catch (err) {
            expect(err).toBeInstanceOf(DataTypeError);

            // navega até o erro mais profundo
            let current = err.report.root;
            for (let i = 0; i < depth; i++) {
                current = current.nested;
            }

            expect(current.value).toBeDefined();
        }
    });

    test('deep shape rejects non-object at any level', async () => {
        const depth = 5;
        const schema = new Schema({
            root: createDeepSchema(depth)
        });

        const data = {
            root: {
                nested: {
                    nested: 'invalid'
                }
            }
        };

        await expect(schema.validate(data))
            .rejects
            .toBeInstanceOf(DataTypeError);
    });

});
