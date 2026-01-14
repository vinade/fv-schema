import { SR } from '../../src/SR';
import { Schema } from '../../src/Schema';
import { ErrorMessages, BadSchemaError,DataTypeError } from '../../src/errors';


function randomValue() {
    const pool = [
        null,
        undefined,
        '',
        Math.random() * 100,
        Math.random() > 0.5 ? 'abc' : '123',
        [],
        {},
        { a: Math.random() }
    ];

    return pool[Math.floor(Math.random() * pool.length)];
}

function randomData() {
    return {
        name: randomValue(),
        age: randomValue(),
        email: randomValue()
    };
}

describe('Fuzz testing', () => {

    test('random inputs never crash the validator', async () => {
        const schema = new Schema({
            name: SR.string().required().min(2),
            age: SR.number().min(18),
            email: SR.string().email()
        });

        const runs = 100;

        for (let i = 0; i < runs; i++) {
            try {
                await schema.validate(randomData());
            } catch (err) {
                expect(err).toBeInstanceOf(DataTypeError);
                expect(err.report).toBeDefined();
            }
        }
    });

    test('fuzz with concurrent validations', async () => {
        const schema = new Schema({
            value: SR.string().nullable().min(3)
        });

        const inputs = Array.from({ length: 50 }, () => ({
            value: randomValue()
        }));

        const results = await Promise.allSettled(
            inputs.map(data => schema.validate(data))
        );

        results.forEach(result => {
            if (result.status === 'rejected') {
                expect(result.reason).toBeInstanceOf(DataTypeError);
            }
        });
    });

});
