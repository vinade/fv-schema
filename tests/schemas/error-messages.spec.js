import { SR } from '../../src/SR';
import { Schema } from '../../src/Schema';
import { ErrorMessages, BadSchemaError,DataTypeError } from '../../src/errors';

describe('Error messages — default messages', () => {

    test('should use default STRING message', async () => {
        const schema = new Schema(
            SR.string()
        );

        try {
            await schema.validate(123);
        } catch (err) {
            expect(err).toBeInstanceOf(DataTypeError);
            expect(err.report).toContain(ErrorMessages.STRING);
        }
    });

    test('should use default MIN message', async () => {
        const schema = new Schema(
            SR.string().min(5)
        );

        try {
            await schema.validate('abc');
        } catch (err) {
            expect(err).toBeInstanceOf(DataTypeError);
            expect(err.report[0]).toBe(ErrorMessages.MIN);
        }
    });

    test('should collect multiple default messages', async () => {
        const schema = new Schema(
            SR.string().min(5).matches(/[A-Z]/)
        );

        try {
            await schema.validate('abc');
        } catch (err) {
            expect(err).toBeInstanceOf(DataTypeError);
            expect(err.report.length).toBe(2);
            expect(err.report).toContain(ErrorMessages.MIN);
            expect(err.report).toContain(ErrorMessages.MATCHES);
        }
    });

    test('LIMIT: Error message priority in registered chains', async () => {
        SR.register('atLeastTen', SR.number().min(10), 'Custom Parent Error');

        const schema = new Schema({
            val: SR.atLeastTen()
        });

        try {
            await schema.validate({ val: 5 });
        } catch (err) {
            // Quem ganha? O erro específico do .min() ou o erro genérico do registro?
            // O ideal é que o 'Custom Parent Error' prevaleça se foi definido no registro.
            expect(err.report.val[0]).toBe('Custom Parent Error');
        }
    });

});


describe('Error messages — template messages', () => {

    test('should interpolate {name}', async () => {
        const schema = new Schema(
            SR.string().error('Field {name} must be a string')
        );

        try {
            await schema.validate(123);
        } catch (err) {
            expect(err).toBeInstanceOf(DataTypeError);
            expect(err.report[0]).toBe('Field value must be a string');
        }
    });

    test('should interpolate positional params {0}', async () => {
        const schema = new Schema(
            SR.string().min(8).error('{name} must have at least {0} characters')
        );

        try {
            await schema.validate('abc');
        } catch (err) {
            expect(err).toBeInstanceOf(DataTypeError);
            expect(err.report[0])
                .toBe('value must have at least 8 characters');
        }
    });

    test('should accept registered rules', async () => {

        SR.register('password', SR
            .string()
            .min(8)
            .matches(/[A-Z]/)
            .matches(/[a-z]/)
            .matches(/[0-9]/)
            .matches(/[@#$%!*]/)
            , '{name} is not a valid password.');

        const schema = new Schema(SR.noop().password());

        try {
            await schema.validate(5);
        } catch (err) {
            expect(err).toBeInstanceOf(DataTypeError);
            expect(err.report[0])
                .toBe('value is not a valid password.');
        }
    });

    test('should interpolate multiple params {0} and {1}', async () => {

        SR.register('between10and20', SR.number().min(10).max(20), '{name} must be between 10 and 20')

        const schema = new Schema(
            SR.number().between10and20()
        );

        try {
            await schema.validate(5);
        } catch (err) {
            expect(err).toBeInstanceOf(DataTypeError);
            expect(err.report[0])
                .toBe('value must be between 10 and 20');
        }
    });

    test('should interpolate multiple params {0} and {1}', async () => {

        SR.register('between', (value, min, max) => {
            if (value < min) {
                return false;
            }

            if (value > max) {
                return false;
            }
            return true;
        }, '{name} must be between {0} and {1}')

        const schema = new Schema(
            SR.between(10, 20)
        );

        try {
            await schema.validate(5);
        } catch (err) {
            expect(err).toBeInstanceOf(DataTypeError);
            expect(err.report[0])
                .toBe('value must be between 10 and 20');
        }
    });

    test('should interpolate {value}', async () => {
        const schema = new Schema(
            SR.number().error('Invalid value: {value}')
        );

        try {
            await schema.validate('abc');
        } catch (err) {
            expect(err).toBeInstanceOf(DataTypeError);
            expect(err.report[0])
                .toBe('Invalid value: abc');
        }
    });

    test('should work with object schema and field names', async () => {
        const schema = new Schema({
            age: SR.number().min(18).error('{name} must be >= {0}')
        });

        try {
            await schema.validate({ age: 15 });
        } catch (err) {
            expect(err).toBeInstanceOf(DataTypeError);
            expect(err.report.age[0]).toBe('age must be >= 18');
        }
    });


    test('LIMIT: Parallel Validation Context Integrity', async () => {
        // Regra registrada que usa o nome do campo na mensagem
        SR.register('checkValue', SR.number().min(100), '{name} must be at least {0}');

        const schema = new Schema({
            fieldA: SR.checkValue(),
            fieldB: SR.checkValue(),
            fieldC: SR.checkValue()
        });

        // Todos os valores são inválidos
        const data = {
            fieldA: 10,
            fieldB: 20,
            fieldC: 30
        };

        try {
            // Executamos a validação (que internamente deve rodar os campos em paralelo ou sequência rápida)
            await schema.validate(data, false);
        } catch (err) {
            // O risco: fieldB receber a mensagem "fieldA must be at least 100" 
            // devido ao compartilhamento de alguma variável estática no SR ou SRuleExecutor
            expect(err.report.fieldA[0]).toContain('fieldA');
            expect(err.report.fieldB[0]).toContain('fieldB');
            expect(err.report.fieldC[0]).toContain('fieldC');
        }
    });


});


describe('Error messages — dynamic messages (DM)', () => {

    test('should compute message dynamically', async () => {
        const schema = new Schema(
            SR.string().error((ctx) => `Invalid type for ${ctx.name}`)
        );

        try {
            await schema.validate(100);
        } catch (err) {
            expect(err).toBeInstanceOf(DataTypeError);
            expect(err.report[0]).toBe('Invalid type for value');
        }
    });

    test('should receive resolved params in dynamic message', async () => {
        const schema = new Schema(
            SR
                .string()
                .min(6)
                .error((ctx, params) => `${ctx.name} must be at least ${params[0]} chars`)
        );

        try {
            await schema.validate('abc');
        } catch (err) {
            expect(err).toBeInstanceOf(DataTypeError);
            expect(err.report[0])
                .toBe('value must be at least 6 chars');
        }
    });

    test('should use ctx.value inside dynamic message', async () => {
        const schema = new Schema(
            SR.number().error(ctx => `Value "${ctx.value}" is not a number`)
        );

        try {
            await schema.validate('xyz');
        } catch (err) {
            expect(err).toBeInstanceOf(DataTypeError);
            expect(err.report[0])
                .toBe('Value "xyz" is not a number');
        }
    });

    test('should work with object schema and dynamic message', async () => {
        const schema = new Schema({
            password: SR.string().min(8).error((ctx, params) => `${ctx.name} requires ${params[0]} characters`)
        });

        try {
            await schema.validate({ password: '123' });
        } catch (err) {
            expect(err).toBeInstanceOf(DataTypeError);
            expect(err.report.password[0])
                .toBe('password requires 8 characters');
        }
    });
});

describe('DESIGN: Validation rule errors must fail fast', () => {

    test('exception inside custom rule must propagate and abort validation', async () => {

        const schema = new Schema({
            val: SR.string().custom(() => {
                throw new Error('Validation rule bug');
            })
        });

        await expect(
            schema.validate({ val: 'x' })
        ).rejects.toThrow('Validation rule bug');
    });

});
