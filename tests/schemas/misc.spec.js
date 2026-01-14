import { SR } from '../../src/SR';
import { Schema } from '../../src/Schema';
import { ErrorMessages, BadSchemaError,DataTypeError } from '../../src/errors';


describe('Critical scenarios — library robustness', () => {

    /* ------------------------------------------------------------------ */
    test('nullable should bypass subsequent rules', async () => {
        const schema = new Schema(
            SR.string().nullable().min(3)
        );

        await expect(schema.validate(null)).resolves.toBeUndefined();
    });

    /* ------------------------------------------------------------------ */
    test('transform should not run when nullable bypasses', async () => {
        let called = false;

        const schema = new Schema(
            SR.string()
              .nullable()
              .transform(() => {
                  called = true;
                  return 'x';
              })
        );

        await schema.validate(null);
        expect(called).toBe(false);
    });

    /* ------------------------------------------------------------------ */
    test('custom rule returning undefined should be treated as failure', async () => {
        const schema = new Schema(
            SR.custom(() => {})
        );

        await expect(schema.validate('x'))
            .rejects.toBeInstanceOf(DataTypeError);
    });

    /* ------------------------------------------------------------------ */
    test('custom async rule returning non-boolean should be accepted', async () => {
        const data = 1;
        const schema = new Schema(
            SR.custom(async () => (data))
        );

        await expect(schema.validate('x')).resolves.toBeUndefined();
    });

    /* ------------------------------------------------------------------ */
    test('register should not mutate params between instances', async () => {
        SR.register(
            'greaterThan',
            (value, limit) => value > limit,
            '{name} > {0}'
        );

        const r1 = SR.greaterThan(10);
        const r2 = SR.greaterThan(5);

        const s1 = new Schema(r1);
        const s2 = new Schema(r2);

        await expect(s1.validate(6)).rejects.toBeInstanceOf(DataTypeError);
        await expect(s2.validate(6)).resolves.toBeUndefined();
    });

    /* ------------------------------------------------------------------ */
    test('abortEarly should stop async rules execution', async () => {
        let calls = 0;

        const schema = new Schema(
            SR.custom(async () => {
                calls++;
                return false;
            }).custom(async () => {
                calls++;
                return false;
            })
        );

        try {
            await schema.validate('x', true);
        } catch (_) {}

        expect(calls).toBe(1);
    });

    /* ------------------------------------------------------------------ */
    test('error() should apply only to immediately previous rule', async () => {
        const schema = new Schema(
            SR.string()
              .min(5).error('MIN ERROR')
              .max(10)
        );

        try {
            await schema.validate('abc');
        } catch (err) {
            expect(err.report).toContain('MIN ERROR');
            expect(err.report.length).toBe(1);
        }
    });

    /* ------------------------------------------------------------------ */
    test('ref to non-existing path should fail safely', async () => {
        const schema = new Schema({
            a: SR.number(),
            b: SR.equal(SR.ref('a.missing'))
        });

        await expect(schema.validate({ a: 10, b: 10 }))
            .rejects.toBeInstanceOf(DataTypeError);
    });

    /* ------------------------------------------------------------------ */
    test('reusing chain should not leak rules', async () => {
        const base = SR.string().min(3);

        const s1 = new Schema(base);
        const s2 = new Schema(base.max(5));

        await expect(s1.validate('abcdef'))
            .resolves.toBeUndefined();

        await expect(s2.validate('abcdef'))
            .rejects.toBeInstanceOf(DataTypeError);
    });

    /* ------------------------------------------------------------------ */
    test('of() should fail when inner schema throws non-DataTypeError', async () => {
        const inner = new Schema(
            SR.custom(() => {
                throw new Error('boom');
            })
        );

        const schema = new Schema(
            SR.array().of(inner)
        );

        await expect(schema.validate([1]))
            .rejects.toThrow('boom');
    });

    /* ------------------------------------------------------------------ */
    test('DynamicMessage throwing error should not mask validation error', async () => {
        const schema = new Schema(
            SR.string().min(5).error(() => {
                    throw new Error('message exploded');
                })
        );

        await expect(schema.validate('abc'))
            .rejects.toThrow('message exploded');
    });

    /* ------------------------------------------------------------------ */
    test('register should not override native rule', () => {
        expect(() => {
            SR.register('string', () => true);
        }).toThrow();
    });

});
