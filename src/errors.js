export const ErrorMessages = {

    STRING: 'This value must be a string.',
    NUMBER: 'This value must be a number.',
    INTEGER: 'This value must be an integer.',
    OBJECT: 'This value must be an object.',
    ARRAY: 'This value must be an array.',
    EMAIL: 'This value must be a valid email address.',

    REQUIRED: 'This value is required.',

    MIN: 'This value is below the allowed minimum.',
    MAX: 'This value exceeds the allowed maximum.',

    EQUAL: 'This value does not match the expected value.',
    ONE_OF: 'This value is not one of the allowed values.',

    MATCHES: 'This value does not match the required pattern.',

    CUSTOM: 'This value is invalid.',
};

/**
 * DynamicMessage
 *
 * Explicit wrapper for dynamic error messages.
 * Prevents ambiguity between rule parameters and error messages.
 */
export class DynamicMessage {

    constructor(fn){

        const fnType = typeof fn;

        if ((fnType !== 'string') && (fnType !== 'function')){
            throw new Error('Dynamic error messages constructos expects string or function as parameter.');
        }

        this.fn = fn;
    }

    compute(ctx, params){

        if (typeof this.fn === 'string'){
            return this.fn;
        }

        return this.fn(ctx, params);
    }
};

export function formatMessage(template, ctx) {

    if (template instanceof DynamicMessage) {
        template = template.compute(ctx, ctx._params || []);
    }

    if (typeof template !== 'string') {
        return '';
    }

    const message = template.replace(/\{([^}]+)\}/g, (_, token) => {
        if (token === 'value') return String(ctx.value ?? '');
        if (token === 'name') return String(ctx.name ?? '');

        if (/^\d+$/.test(token)) {
            const idx = Number(token);
            return ctx._params?.[idx] ?? '';
        }

        return '';
    });

    return message;
}


export class DataTypeError extends Error {
    constructor(message, report) {
        super(message);
        this.name = 'DataTypeError';
        this.report = report;
    }
}

export class BadSchemaError extends Error {
    constructor(message) {
        super(message);
        this.name = 'BadSchemaError';
    }
}
