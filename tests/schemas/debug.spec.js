import { SR } from '../../src/SR';
import { Schema } from '../../src/Schema';
import { ErrorMessages, BadSchemaError,DataTypeError } from '../../src/errors';

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
