import { SR } from '../../src/SR';
import { Schema } from '../../src/Schema';
import { ErrorMessages, BadSchemaError,DataTypeError } from '../../src/errors';


describe('SR builder', () => {

    test('string() creates a new instance', () => {
        const s = SR.string();
        expect(s).not.toBe(SR);
        expect(s.chain.length).toBe(1);
    });

    test('chain is immutable between calls', () => {
        const base = SR.string();
        const min3 = base.min(3);
        const min5 = base.min(5);

        expect(base.chain.length).toBe(1);
        expect(min3.chain.length).toBe(2);
        expect(min5.chain.length).toBe(2);
        expect(min3).not.toBe(min5);
    });

    test('required and nullable cannot coexist', () => {
        expect(() => {
            SR.string().required().nullable();
        }).toThrow(BadSchemaError);
    });

    test('nullable bypasses other rules', async () => {
        const schemaRule = SR.string().nullable().min(5);
        const schema = new Schema({value: schemaRule});

        await expect(schema.validate({
            value: null
        })).resolves.toBeUndefined();
    });

    test('matches validates regex', async () => {
        const schemaRuleChain = SR.string().matches(/^[0-9]+$/);
        const schemaDescription = {value: schemaRuleChain};
        const schema = new Schema(schemaDescription);

        await expect(schema.validate({ value: '123' })).resolves.toBeUndefined();
        await expect(schema.validate({ value: 'abc' })).rejects.toBeInstanceOf(DataTypeError);
    });

    test('uses rule chain as input to Schema', async () => {
        const schemaRuleChain = SR.string().matches(/^[0-9]+abc+$/);
        const schema = new Schema(schemaRuleChain);

        await expect(schema.validate('123')).rejects.toBeInstanceOf(DataTypeError);
        await expect(schema.validate('aa123')).rejects.toBeInstanceOf(DataTypeError);
        await expect(schema.validate('123fwe')).rejects.toBeInstanceOf(DataTypeError);
        await expect(schema.validate('123abcee')).rejects.toBeInstanceOf(DataTypeError);
        await expect(schema.validate('127843abc')).resolves.toBeUndefined();
        await expect(schema.validate('a127843abc')).rejects.toBeInstanceOf(DataTypeError);
        await expect(schema.validate()).rejects.toBeInstanceOf(DataTypeError);
    });

    test('transform mutates context value', async () => {
        const schemaRuleChain = SR.string()
            .transform(v => v.trim())
            .min(3);
        const schemaDescription = {value: schemaRuleChain};
        const schema = new Schema(schemaDescription);

        await expect(schema.validate({ value: 'abc' })).resolves.toBeUndefined();
    });

    test('ref resolves values from data', async () => {
        const schema = SR.number().min(SR.ref('min'));

        const rule = schema.chain[1];

        const ctx = { value: 5, data: { min: 3 } };
        expect(await rule.fn(ctx)).toBe(true);

        ctx.data.min = 10;
        expect(await rule.fn(ctx)).toBe(false);
    });

});
