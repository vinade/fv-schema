import { DynamicMessage, DataTypeError, BadSchemaError, ErrorMessages as MSG } from './errors';
import { Schema } from './Schema';

let IS_TEST = false;

try{
    IS_TEST = process.env.NODE_ENV === 'test';
}catch(err){}

export const RULE_INSTANCE = Symbol('SC_RULE_INSTANCE');

export const CAST_SYMBOL = Symbol('SR_CAST_TYPE');

// Mapeamento interno de tipos
export const CAST_TYPES = {
    NUMBER: 'number',
    BOOLEAN: 'boolean',
    STRING: 'string',
    UNKNOWN: 'unknown',
};

const DataReference = function (path) {
    this.path = path.split('.');
};

const REGEX = {
    EMAIL: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/
};

const NATIVE_TYPE_RULES = new Set([
    'string',
    'number',
    'integer',
    'object',
    'array',
    'email'
]);

const REGISTERED_TYPE_RULES = new Set([]);


/**
 * SRuleFactory
 *
 * Responsible for creating and cloning Schema Rule instances.
 *
 * Centralizes the logic that determines whether a new rule
 * chain is created or an existing one is cloned, ensuring
 * immutability and consistency across chained calls.
 *
 * This module is internal and not exposed to consumers.
 */
const SRuleFactory = (() => {
    const PUBLIC = {};
    const PRIVATE = {};

    PRIVATE.newInstance = function () {
        return {
            chain: [],
            _isNullable: null,
            _isRequired: null,
            _shape: null,
            _of: null,
            ...SR,
        }
    };

    PRIVATE.cloneInstance = function (instance) {
        return {
            chain: [...instance.chain],
            _isRequired: instance._isRequired,
            _isNullable: instance._isNullable,
            _shape: instance._shape,
            _of: instance._of,
            ...SR,
        }
    };

    PUBLIC.newSRInstance = (SRRef) => {

        if (!SRRef) {
            throw new Error('Critic error. SR reference is lost.');
        }

        if (!SRRef[RULE_INSTANCE]) {
            throw new Error('Critic error. SR reference is invalid.');
        }

        if (SRRef === SR) {
            return PRIVATE.newInstance();
        }

        return PRIVATE.cloneInstance(SRRef);
    };

    PUBLIC.registerRule = (name, rule, errorMessage, options = {}) => {

        if (typeof rule === 'function') {
            rule = SR.custom(rule);
        }

        if (!SRDataCheck.isSchemaRuleInstance(rule)) {
            throw new BadSchemaError(`SRuleFactory.registerRule() expects an SR chain or a function. Received ${typeof rule} ${rule}`);
        }

        const schema = new Schema(rule);
        REGISTERED_TYPE_RULES.add(name);
        SR[name] = SRuleExecutor.valFactor(async (...args) => {
            let result = true;
            const [value, data] = args;
            const ctx = args[args.length - 1];

            try {
                await schema.validate(value, false, args, ctx?.root);
            } catch (err) {
                if (err instanceof DataTypeError) {
                    result = err;
                } else {
                    throw err;
                }
            }
            return result;
        }, errorMessage, undefined, true);

        // Set inferred cast type
        const inferred = SRuleExecutor.inferCast(rule);
        SR[name][CAST_SYMBOL] = options.cast || inferred;
    };


    return PUBLIC;

})();


/**
 * SRuleExecutor
 *
 * Internal execution engine for schema rules.
 *
 * Responsible for:
 * - Resolving dynamic parameters (e.g. references)
 * - Executing rule functions (sync or async)
 * - Normalizing execution results
 *
 * This module is intentionally decoupled from the public API.
 */
export const SRuleExecutor = (() => {

    const PUBLIC = {};
    const PRIVATE = {};

    PRIVATE.getValueFromPath = (path, data) => {
        let current = data;

        for (const step of path) {
            if (current == null || typeof current !== 'object') {
                return undefined;
            }
            current = current[step];
        }

        return current;
    };

    PUBLIC.resolveParams = (param, data) => {
        let result = param;

        if (param instanceof DataReference) {
            return PRIVATE.getValueFromPath(param.path, data);
        }

        if (SRDataCheck.isArray(param)) {
            result = [...param];
            result.forEach((item, key) => {
                result[key] = PUBLIC.resolveParams(result[key], data);
            });
        } else if (SRDataCheck.isPlainObject(param)) {
            result = { ...param };
            Object.keys(result).forEach(key => {
                result[key] = PUBLIC.resolveParams(result[key], data);
            });
        }

        return result;
    };

    PRIVATE.filterArgs = (args) => {
        args = args || [];
        args = args.slice(1, -2); // remove value, data and context
        return args;
    };

    PUBLIC.valFactor = (val, errorMessage, specialRule, passContext, castSymbol) => {
        return function (...params) {
            const instance = SRuleFactory.newSRInstance(this);

            const rule = {
                fn: async (ctx) => {
                    const { value, data, bypass, root, args } = ctx;

                    if (bypass) {
                        return true;
                    }

                    const resolvedParams = [
                        ...PUBLIC.resolveParams(params, root ?? data),
                        ...PRIVATE.filterArgs(args),
                    ];

                    ctx._params = resolvedParams;

                    const fnArgs = [value, ...resolvedParams, data];
                    if (passContext) {
                        fnArgs.push(ctx);
                    }

                    return val(...fnArgs);
                },
                errorMessage,
            };

            if (IS_TEST) {
                rule.val = val;
            }

            if (specialRule) {
                instance[specialRule] = rule;

                if (instance._isRequired && instance._isNullable) {
                    throw new BadSchemaError(
                        'A field cannot be nullable and required at the same time.'
                    );
                }

                return instance;
            }

            if (instance._shape) {
                throw new BadSchemaError('Rules cannot be applied to shaped objects');
            }

            instance.chain.push(rule);
            rule.fn[CAST_SYMBOL] = castSymbol;
            return instance;
        };
    };

    PUBLIC.inferCast = (ruleChain) => {
        if (!SRDataCheck.isSchemaRuleInstance(ruleChain)){
            return;
        }

        const typedRule = ruleChain.chain.find(rule => {
            return !!rule.fn[CAST_SYMBOL];
        });

        if (!typedRule){ // nenhuma regra define necessidade de tipo
            return;
        }

        if (typedRule.fn[CAST_SYMBOL] === CAST_TYPES.UNKNOWN){ // transform, custom (regras que destroem tipos)
            return;
        }

        return typedRule.fn[CAST_SYMBOL];
    };

    return PUBLIC;

})();


/**
 * SRDataCheck
 *
 * Collection of pure utility functions used to validate
 * values and types.
 *
 * These functions do not depend on Schema, SR instances,
 * or execution context. They are designed to be deterministic
 * and easily testable in isolation.
 */
export const SRDataCheck = (() => {

    const PUBLIC = {}

    PUBLIC.isPlainObject = (value) => {
        if (typeof value !== 'object' || value === null) {
            return false;
        }
        return Object.prototype.toString.call(value) === '[object Object]';
    };

    PUBLIC.isEqual = (value1, value2) => value1 === value2;
    PUBLIC.isString = (value) => typeof value === 'string';
    PUBLIC.isNumber = (value) => {
        if (typeof value !== 'number') {
            return false;
        }

        if (isNaN(value)) {
            return false;
        }

        return true;
    };

    PUBLIC.isInteger = (value) => {
        if (!PUBLIC.isNumber(value)) {
            return false;
        }

        if (!isFinite(value)) {
            return false;
        }

        if (Math.floor(value) != value) {
            return false;
        }

        return true;
    };

    PUBLIC.isNull = (value) => {

        if (value === null) {
            return true;
        } else if (value === undefined) {
            return true;
        } else if (value === '') {
            return true;
        }
        return false;
    };

    PUBLIC.isObject = (value) => {
        if (PUBLIC.isNull(value)) {
            return false;
        }

        if (Array.isArray(value)) {
            return false;
        }

        return typeof value === 'object';
    };

    PUBLIC.isArray = (value) => {
        return Array.isArray(value);
    };

    PUBLIC.isEmpty = (value) => {
        if (PUBLIC.isNull(value)) {
            return true;
        }

        if (Array.isArray(value)) {
            return !value.length;
        }

        if (typeof value === 'object') {
            return !(Object.keys(value).length);
        }

        return false;
    };

    PUBLIC.isEmail = (value) => {
        if (!PUBLIC.isString(value)) {
            return false;
        }

        return REGEX.EMAIL.test(value);
    };

    PUBLIC.isValidBy = (value, regexParam) => {

        if (!(regexParam instanceof RegExp)) {
            throw new BadSchemaError(`A regular expression was expected, but ${regexParam} received instead.`);
        }

        if (!PUBLIC.isString(value)) {
            return false;
        }

        return regexParam.test(value);
    };

    PUBLIC.isGreaterThanOrEqual = (value, limit) => {

        if (!PUBLIC.isNumber(limit)) {
            throw new BadSchemaError(`A number was expected, but ${limit} received instead.`);
        }

        if (!PUBLIC.isNumber(value)) {
            return false;
        }

        return value >= limit;
    };

    PUBLIC.isLowerThanOrEqual = (value, limit) => {

        if (!PUBLIC.isNumber(limit)) {
            throw new BadSchemaError(`A number was expected, but ${limit} received instead.`);
        }

        if (!PUBLIC.isNumber(value)) {
            return false;
        }

        return value <= limit;
    };

    PUBLIC.isOneOf = (value, list) => {
        if (!PUBLIC.isArray(list)) {
            throw new BadSchemaError(`An array was expected, but ${list} received instead.`);
        }

        if (PUBLIC.isEmpty(list)) {
            throw new BadSchemaError(`This rule will always fail. ${value} cannot be one of the elements of an empty array`);
        }

        return list.indexOf(value) !== -1;
    };

    PUBLIC.isSchemaRuleInstance = (value) => {
        return Boolean(value && value[RULE_INSTANCE]);
    };

    PUBLIC.isValidRule = (name) => {
        if (NATIVE_TYPE_RULES.has(name)) {
            return true;
        }

        return REGISTERED_TYPE_RULES.has(name);
    };

    return PUBLIC;

})();


/**
 * SR (Schema Rule)
 *
 * Public API for building validation rule chains.
 * Provides a fluent interface to describe validation logic,
 * but does not execute or validate data directly.
 *
 * Example:
 *   SR.string().min(3).required()
 *
 * Instances created from SR are immutable; each call returns
 * a new rule instance.
 */
export const SR = (() => {

    const PUBLIC = {}; // deve apenas ter métodos
    const valFactor = SRuleExecutor.valFactor;

    PUBLIC.noop = valFactor(() => true);

    PUBLIC.equal = valFactor(SRDataCheck.isEqual, MSG.EQUAL);

    PUBLIC.string = valFactor(SRDataCheck.isString, MSG.STRING, undefined, undefined, CAST_TYPES.STRING);

    PUBLIC.number = valFactor(SRDataCheck.isNumber, MSG.NUMBER, undefined, undefined, CAST_TYPES.NUMBER);

    PUBLIC.integer = valFactor(SRDataCheck.isInteger, MSG.INTEGER, undefined, undefined, CAST_TYPES.NUMBER);

    PUBLIC.object = valFactor(SRDataCheck.isObject, MSG.OBJECT);

    PUBLIC.array = valFactor(SRDataCheck.isArray, MSG.ARRAY);

    PUBLIC.email = valFactor(SRDataCheck.isEmail, MSG.EMAIL, undefined, undefined, CAST_TYPES.STRING);

    PUBLIC.required = valFactor((value) => { return !SRDataCheck.isNull(value); }, MSG.REQUIRED, '_isRequired');

    PUBLIC.nullable = valFactor((value, data, context) => {
        context.bypass = SRDataCheck.isNull(value);
        return true;
    }, '', '_isNullable', true);

    PUBLIC.matches = valFactor(SRDataCheck.isValidBy, MSG.MATCHES);

    PUBLIC.min = valFactor((value, limit) => {
        if (SRDataCheck.isString(value)) {
            return SRDataCheck.isGreaterThanOrEqual(value.length, limit);
        } else {
            return SRDataCheck.isGreaterThanOrEqual(value, limit);
        }
    }, MSG.MIN);

    PUBLIC.max = valFactor((value, limit) => {
        if (SRDataCheck.isString(value)) {
            return SRDataCheck.isLowerThanOrEqual(value.length, limit);
        } else {
            return SRDataCheck.isLowerThanOrEqual(value, limit);
        }
    }, MSG.MAX);

    PUBLIC.oneOf = valFactor(SRDataCheck.isOneOf, MSG.ONE_OF);

    PUBLIC.custom = valFactor((value, fn, ...args) => {
        let nextArgs = [value, ...args];
        return fn(...nextArgs);
    }, MSG.CUSTOM, undefined, undefined, CAST_TYPES.UNKNOWN);

    PUBLIC.error = function (message) {
        const instance = SRuleFactory.newSRInstance(this);

        if (!instance.chain.length) {
            throw new BadSchemaError('.error() must follow a rule');
        }

        if (!(message instanceof DynamicMessage)) {
            message = new DynamicMessage(message);
        }

        instance.chain[instance.chain.length - 1].errorMessage = message;

        return instance;
    };

    PUBLIC.transform = valFactor((value, fn, data, context) => {
        context.value = fn(value, data);
        return true;
    }, undefined, undefined, true, CAST_TYPES.UNKNOWN);

    PUBLIC.shape = function (schemaData) {
        const instance = SRuleFactory.newSRInstance(this);
        instance._shape = new Schema(schemaData);

        if (instance.chain.length) {
            throw new BadSchemaError('Rules cannot be applied to shaped objects');
        }

        return instance;
    };

    PUBLIC.ref = function (path) {
        if (typeof path !== 'string') {
            throw new BadSchemaError('Ref path must be a string.');
        }

        return new DataReference(path);
    };

    PUBLIC.of = function (schema) {
        const instance = SRuleFactory.newSRInstance(this);

        // if (!instance.chain.some(r => r.fn === PUBLIC.isArray)) {
        //     throw new BadSchemaError('.of() can only be used after array()');
        // }

        if (
            !schema ||
            !(schema[RULE_INSTANCE] || schema instanceof Schema)
        ) {
            throw new BadSchemaError('.of() expects a SC chain or Schema instance');
        }

        instance._of = schema instanceof Schema
            ? schema
            : new Schema(schema);

        return instance;
    };

    PUBLIC.register = (name, rule, errorMessage, options = {}) => {

        if (NATIVE_TYPE_RULES.has(name)) {
            throw new BadSchemaError("You should not override a native method. If you want to do this, use the .override() method.");
        }

        SRuleFactory.registerRule(name, rule, errorMessage, options);
    };

    PUBLIC.override = SRuleFactory.registerRule;

    PUBLIC.extend = (rules, options = {}) => {

        if (!SRDataCheck.isPlainObject(rules)) {
            throw new BadSchemaError('.extend() expects a plain object (key:value), with SR chains');
        }

        const keys = Object.keys(rules);

        keys.forEach(name => {

            if (NATIVE_TYPE_RULES.has(name)) {
                throw new BadSchemaError("You should not override a native method. If you want to do this, use the .override() method.");
            }

            if (!rules[name][RULE_INSTANCE]) {
                throw new BadSchemaError('The values of .extend() param must be SR chains. Like SR.string().required()');
            }

        });

        keys.forEach(name => {
            SRuleFactory.registerRule(name, rules[name], options?.errorMessage, options);
        });

    };

    PUBLIC[RULE_INSTANCE] = true;

    return PUBLIC;
})();
