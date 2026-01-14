import { SR } from '../../src/SR';
import { Schema } from '../../src/Schema';
import { DataTypeError } from '../../src/errors';


const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

describe('Asynchronous validations', () => {

    test('async custom validation passes', async () => {
        const schema = new Schema({
            username: SR.string().custom(async (value) => {
                await delay(50);
                return value !== 'admin';
            }, 'Username not allowed')
        });

        await expect(schema.validate({
            username: 'user123'
        })).resolves.toBeUndefined();
    });

    test('async custom validation fails', async () => {
        const schema = new Schema({
            username: SR.string().custom(async (...args) => {
                const value = args[0];
                await delay(20);
                return value !== 'admin';
            }, 'Username not allowed')
        });

        await expect(schema.validate({
            username: 'admin'
        })).rejects.toBeInstanceOf(DataTypeError);
    });

    test('multiple async validations run independently', async () => {
        const schema = new Schema({
            a: SR.string().custom(async v => {
                await delay(30);
                return v === 'ok';
            }),
            b: SR.string().custom(async v => {
                await delay(10);
                return v === 'ok';
            })
        });

        await expect(schema.validate({
            a: 'ok',
            b: 'ok'
        })).resolves.toBeUndefined();
    });

    test('LIMIT: Concurrent validation of different schemas', async () => {
        const schema1 = new Schema({ a: SR.number().min(100) });
        const schema2 = new Schema({ a: SR.number().max(50) });

        const p1 = schema1.validate({ a: 10 }); // Deve falhar
        const p2 = schema2.validate({ a: 10 }); // Deve passar

        const results = await Promise.allSettled([p1, p2]);

        expect(results[0].status).toBe('rejected');
        expect(results[1].status).toBe('fulfilled');
    });


    test('parallel validations must not mix ctx.name or params', async () => {

        SR.register(
            'minX',
            SR.number().min(10),
            '{name} must be >= {0}'
        );

        const schema = new Schema({
            a: SR.minX(),
            b: SR.minX()
        });

        const data = { a: 1, b: 2 };

        const [r1, r2] = await Promise.allSettled([
            schema.validate(data),
            schema.validate(data)
        ]);

        const err1 = r1.reason;
        const err2 = r2.reason;

        [err1, err2].forEach(err => {
            expect(err.report.a[0]).toContain('a');
            expect(err.report.b[0]).toContain('b');
        });
    });

});
