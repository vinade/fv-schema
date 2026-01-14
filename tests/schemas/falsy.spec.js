import { SR } from '../../src/SR';
import { Schema } from '../../src/Schema';
import { ErrorMessages, BadSchemaError,DataTypeError } from '../../src/errors';


describe('CRITICAL: Falsy Values & Type Coercion', () => {

    test('should treat 0 as a valid number and present value (not null)', async () => {
        const schema = new Schema({
            count: SR.number().required()
        });

        await expect(schema.validate({ count: 0 })).resolves.toBeUndefined();
    });

    test('should treat false as a valid boolean (if boolean support existed) or present value', async () => {
        // Como você não tem SR.boolean() nativo ainda, testamos com custom
        const schema = new Schema({
            isActive: SR.custom(v => typeof v === 'boolean').required()
        });

        await expect(schema.validate({ isActive: false })).resolves.toBeUndefined();
    });

    test('nullable should allow null but validate type if not null', async () => {
        const schema = new Schema({
            score: SR.number().nullable()
        });

        await expect(schema.validate({ score: null })).resolves.toBeUndefined();
        await expect(schema.validate({ score: 10 })).resolves.toBeUndefined();
        
        // Se não é null, tem que ser number
        await expect(schema.validate({ score: "not a number" })).rejects.toBeInstanceOf(DataTypeError);
    });
});