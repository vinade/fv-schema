import { SRDataCheck, SRuleExecutor } from './SR';
import { DataTypeError, BadSchemaError, ErrorMessages, formatMessage } from './errors';


/**
 * Schema
 *
 * Executes validation rules against data.
 *
 * Handles:
 * - Object validation
 * - Nested schemas (shape)
 * - Array item validation (.of)
 * - Error aggregation and reporting
 *
 * Schema instances are immutable after creation.
 */
export const Schema = (() => {

    return function (schemaObj) {

        const PUBLIC = this;
        const PRIVATE = {};

        PRIVATE.isRawChain = false;

        PRIVATE.executeRules = async function (ctx, chain, abortEarly) {
            let errors;

            for (const { fn, errorMessage } of chain) {

                const result = await fn(ctx);
                let isValid = !!result;

                ctx._params = SRuleExecutor.resolveParams(ctx._params, ctx.root);

                if (result instanceof DataTypeError) {
                    const message = formatMessage(errorMessage, ctx);
                    if (message) {
                        errors = [message, result.report]; // se tem mensagem própia, agrupa
                    } else {
                        errors = result.report; // se não tem mensagem própria, assume a interna
                    }
                    continue;
                }

                if (!isValid) {
                    errors = errors || [];
                    const message = formatMessage(errorMessage, ctx);
                    errors.push(message);

                    if (abortEarly) {
                        break;
                    }
                }
            }

            return errors;
        };

        PRIVATE.createContext = (name, value, data, args, root) => {
            const resolvedRoot = root ?? data;

            return {
                name,
                value,
                data: resolvedRoot,
                args,
                root: resolvedRoot,
            };
        };

        PRIVATE.validateField = async (instance, ctx, abortEarly) => {
            // required / nullable
            const preErrors = await PRIVATE.validatePreChain(instance, ctx, abortEarly);
            if (preErrors) {
                return preErrors;
            }

            if (ctx.bypass) {
                return undefined;
            }

            // shape
            const shapeErrors = await PRIVATE.validateShape(instance, ctx, abortEarly);
            if (shapeErrors) {
                return shapeErrors;
            }

            // array (.of)
            const arrayErrors = await PRIVATE.validateArrayItems(instance, ctx, abortEarly);
            if (arrayErrors) {
                return arrayErrors;
            }

            // regras normais
            if (!instance.chain?.length) {
                return undefined;
            }

            return await PRIVATE.executeRules(ctx, instance.chain, abortEarly);
        };


        PRIVATE.validatePreChain = async (instance, ctx, abortEarly) => {
            const preChain = [instance._isRequired, instance._isNullable].filter(Boolean);
            return PRIVATE.executeRules(ctx, preChain, abortEarly);
        };


        PRIVATE.validateShape = async (instance, ctx, abortEarly) => {
            if (!instance._shape) {
                return undefined;
            }

            if (!SRDataCheck.isObject(ctx.value)) {
                return [ErrorMessages.OBJECT];
            }

            try {
                await instance._shape.validate(
                    ctx.value,
                    abortEarly,
                    undefined,
                    ctx.root
                );
            } catch (err) {
                if (err instanceof DataTypeError) {
                    return err.report;
                }
                throw err;
            }

            return undefined;
        };


        PRIVATE.validateArrayItems = async (instance, ctx, abortEarly) => {
            if (!instance._of) {
                return undefined;
            }

            if (!SRDataCheck.isArray(ctx.value)) {
                return [DEFAULT_ARRAY_FAIL_MESSAGE];
            }

            const itemErrors = [];

            for (let i = 0; i < ctx.value.length; i++) {
                try {
                    await instance._of.validate(
                        ctx.value[i],
                        abortEarly,
                        undefined,
                        ctx.root
                    );
                    itemErrors.push(undefined);
                } catch (err) {
                    if (!(err instanceof DataTypeError)) {
                        throw err;
                    }

                    itemErrors.push(err.report);

                    if (abortEarly) {
                        break;
                    }
                }
            }

            return itemErrors.some(Boolean) ? itemErrors : undefined;
        };

        PUBLIC.validate = async (
            data,
            abortEarly = false,
            args = undefined,
            root = undefined
        ) => {
            if (PRIVATE.isRawChain) {
                data = { value: data };
            }

            const keys = Object.keys(PRIVATE.schemaObj);
            let report = {};
            let valid = true;

            for (const key of keys) {
                const instance = PRIVATE.schemaObj[key];
                const value = data[key];

                const ctx = PRIVATE.createContext(key, value, data, args, root);

                const fieldErrors = await PRIVATE.validateField(
                    instance,
                    ctx,
                    abortEarly
                );

                if (fieldErrors !== undefined) {
                    report[key] = fieldErrors;
                    valid = false;
                }
            }

            if (!valid) {
                throw new DataTypeError(
                    'Data validation failed.',
                    PRIVATE.isRawChain ? report.value : report
                );
            }
        };

        if (SRDataCheck.isSchemaRuleInstance(schemaObj)) {
            PRIVATE.schemaObj = { value: schemaObj };
            PRIVATE.isRawChain = true;
        } else if (SRDataCheck.isPlainObject(schemaObj)) {
            PRIVATE.schemaObj = schemaObj;
        } else {
            throw new BadSchemaError('Invalid schema description on Schema constructor.');
        }
    };
})();
