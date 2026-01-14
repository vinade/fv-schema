import { SR } from '../../src/SR';
import { Schema } from '../../src/Schema';
import { ErrorMessages, BadSchemaError,DataTypeError } from '../../src/errors';


describe('Schema validation', () => {

    test('valid data passes validation', async () => {
        const schema = new Schema({
            name: SR.string().required().min(3),
            age: SR.number().min(18)
        });

        await expect(schema.validate({
            name: 'John',
            age: 25
        })).resolves.toBeUndefined();
    });

    test('required field failure', async () => {
        const schema = new Schema({
            name: SR.string().required()
        });

        await expect(schema.validate({}))
            .rejects
            .toBeInstanceOf(DataTypeError);
    });

    test('error report contains field messages', async () => {
        const schema = new Schema({
            name: SR.string().min(5)
        });

        try {
            await schema.validate({ name: 'abc' });
        } catch (err) {
            expect(err.report.name[0]).toEqual("This value is below the allowed minimum.");
        }
    });

    test('abortEarly stops at first error', async () => {
        const schema = new Schema({
            value: SR.number().min(10).max(20)
        });

        try {
            await schema.validate({ value: 5 }, true);
        } catch (err) {
            expect(err.report.value.length).toBe(1);
        }
    });

    test('shape validates nested object', async () => {
        const schema = new Schema({
            user: SR.shape({
                email: SR.string().email().required()
            })
        });

        await expect(schema.validate({
            user: { email: 'test@test.com' }
        })).resolves.toBeUndefined();
    });

    test('shape reports nested errors', async () => {
        const schema = new Schema({
            user: SR.shape({
                email: SR.string().email().required()
            })
        });

        try {
            await schema.validate({
                user: { email: 'invalid' }
            });
        } catch (err) {
            expect(err.report.user.email).toBeDefined();
        }
    });

    test('oneOf validates allowed values', async () => {
        const schema = new Schema({
            role: SR.string().oneOf(['admin', 'user'])
        });

        await expect(schema.validate({ role: 'admin' }))
            .resolves.toBeUndefined();

        await expect(schema.validate({ role: 'guest' }))
            .rejects.toBeInstanceOf(DataTypeError);
    });

    test('ref works across fields', async () => {
        const schema = new Schema({
            password: SR.string().min(6),
            confirm: SR.string().oneOf([SR.ref('password')])
        });

        await expect(schema.validate({
            password: '123456',
            confirm: '123456'
        })).resolves.toBeUndefined();

        await expect(schema.validate({
            password: '123456',
            confirm: 'abcdef'
        })).rejects.toBeInstanceOf(DataTypeError);
    });

});

describe('Concurrency validation (Promise.all)', () => {

    test('multiple concurrent validations do not leak state', async () => {
        const schema = new Schema({
            value: SR.string()
                .nullable()
                .transform(v => v && v.trim())
                .min(3)
        });

        const inputs = [
            { value: ' abc ' },
            { value: null },
            { value: 'xy' },     // inválido
            { value: ' valid ' }
        ];

        const results = await Promise.allSettled(
            inputs.map(data => schema.validate(data))
        );

        expect(results[0].status).toBe('fulfilled');
        expect(results[1].status).toBe('fulfilled');
        expect(results[2].status).toBe('rejected');
        expect(results[3].status).toBe('fulfilled');

        if (results[2].status === 'rejected') {
            expect(results[2].reason).toBeInstanceOf(DataTypeError);
        }
    });

});

describe('Schema reuse across multiple validations', () => {

    test('same schema can be reused sequentially', async () => {
        const schema = new Schema({
            name: SR.string().required().min(3),
            age: SR.number().min(18)
        });

        await expect(schema.validate({
            name: 'John',
            age: 30
        })).resolves.toBeUndefined();

        await expect(schema.validate({
            name: 'Al',
            age: 30
        })).rejects.toBeInstanceOf(DataTypeError);

        await expect(schema.validate({
            name: 'Alice',
            age: 15
        })).rejects.toBeInstanceOf(DataTypeError);

        // Validação válida novamente
        await expect(schema.validate({
            name: 'Robert',
            age: 40
        })).resolves.toBeUndefined();
    });

    test('transform does not persist between validations', async () => {
        const schema = new Schema({
            code: SR.string("para ser abc, precisa ser String")
                .transform(v => v.trim())
                .min(3)
        });

        await schema.validate({ code: ' abc ' });

        // se o valor tivesse sido persistido internamente, isso quebraria
        await expect(schema.validate({ code: 'ab' }))
            .rejects
            .toBeInstanceOf(DataTypeError);
    });


    test('should works with composite rules', async () => {
        const passwordRules = SR
            .string()
            .min(8)
            .matches(/[A-Z]/)
            .matches(/[a-z]/)
            .matches(/[0-9]/)
            .matches(/[@#$%!*]/)
            .transform(v => `${v}`)
            .custom((value) => {
                return value.indexOf('senha') === -1;
            });

        const schema = new Schema(passwordRules);
        await expect(schema.validate(23432432)).rejects.toBeInstanceOf(DataTypeError);
        await expect(schema.validate('aa123')).rejects.toBeInstanceOf(DataTypeError);
        await expect(schema.validate('123fw#fewe')).rejects.toBeInstanceOf(DataTypeError);
        await expect(schema.validate('123AEW%FEF')).rejects.toBeInstanceOf(DataTypeError);
        await expect(schema.validate('AT#CFGa$ac')).rejects.toBeInstanceOf(DataTypeError);
        await expect(schema.validate('AT7CFGa4ac')).rejects.toBeInstanceOf(DataTypeError);
        await expect(schema.validate('AT#CF2a$ac')).resolves.toBeUndefined();
        await expect(schema.validate('AT#CF2d32dwqa$ac')).resolves.toBeUndefined();
        await expect(schema.validate('AT#CFsenha2a$ac')).rejects.toBeInstanceOf(DataTypeError);
        await expect(schema.validate()).rejects.toBeInstanceOf(DataTypeError);
    });

});

describe('RISK: Field execution order dependency (corrected)', () => {

    const buildSchemaA = () => new Schema({
        base: SR.number(),
        derived: SR.number()
            .min(SR.ref('base'))
            .error(ctx => `${ctx.name} >= base`)
    });

    const buildSchemaB = () => new Schema({
        derived: SR.number()
            .min(SR.ref('base'))
            .error(ctx => `${ctx.name} >= base`),
        base: SR.number()
    });

    test('schema behavior must not depend on key order', async () => {

        const data = {
            base: 10,
            derived: 5
        };

        // Ambos devem falhar exatamente da mesma forma
        try {
            await buildSchemaA().validate(data);
            throw new Error('Should fail');
        } catch (errA) {
            expect(errA.report.derived[0]).toBe('derived >= base');
        }

        try {
            await buildSchemaB().validate(data);
            throw new Error('Should fail');
        } catch (errB) {
            expect(errB.report.derived[0]).toBe('derived >= base');
        }
    });

});


describe('RISK: Field order + registered rule + dynamic message', () => {

    SR.register(
        'atLeastBase',
        SR.number().min(SR.ref('base')),
        '{name} must be >= base'
    );

    const buildSchemaA = () => new Schema({
        base: SR.number(),
        derived: SR.atLeastBase()
    });

    const buildSchemaB = () => new Schema({
        derived: SR.atLeastBase(),
        base: SR.number()
    });

    test('registered rules must be order-independent', async () => {

        const data = { base: 10, derived: 5 };

        for (const build of [buildSchemaA, buildSchemaB]) {
            try {
                await build().validate(data);
                throw new Error('Should fail');
            } catch (err) {
                expect(err.report.derived[0]).toContain('derived');
            }
        }
    });

});
