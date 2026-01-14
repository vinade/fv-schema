import { DataTypeError, BadSchemaError } from './errors';
import { SR, SRDataCheck } from './SR';
import { Schema } from './Schema';

export const FV = (() => {

    const STATIC = {};

    return function (formRef) {

        const PUBLIC = this;
        const PRIVATE = {};

        if (!(formRef instanceof HTMLFormElement)) {
            throw new Error('Invalid form reference');
        }

        PRIVATE.form = formRef;

        PUBLIC.readForm = function () {

            const form = PRIVATE.form;
            const elements = Array.from(form.elements);
            const result = {};
            const checkboxGroups = {};

            PUBLIC.elements = elements;
            elements.forEach(el => {
                if (!el.name || el.disabled) return;

                const { tagName, name, value, multiple, options } = el;
                const tag = tagName.toUpperCase();

                if (!result.hasOwnProperty(name)) {
                    result[name] = null;
                }

                if (tag === 'INPUT') {
                    const { type, checked } = el;

                    switch (type) {
                        case 'radio':
                            if (checked) {
                                result[name] = value;
                            }
                            break;

                        case 'checkbox':
                            if (!checkboxGroups[name]) {
                                checkboxGroups[name] = { value: [], counter: 0 };
                            }

                            if (checked) {
                                checkboxGroups[name].value.push(value);
                            }
                            checkboxGroups[name].counter += 1;
                            break;

                        default:
                            result[name] = value;
                    }
                } else if ((tag === 'SELECT') && multiple) {
                    result[name] = Array.from(options)
                        .filter(option => option.selected)
                        .map(option => option.value);
                } else {
                    result[name] = value;
                }

            });

            // Normalização final dos checkboxes
            Object.entries(checkboxGroups).forEach(([name, item]) => {
                if (item.counter === 1) {
                    result[name] = (item.value[0] !== undefined) ? item.value[0] : null;
                } else {
                    result[name] = item.value;
                }
            });

            return result;
        };

        PRIVATE.readFlagAttribute = (el, name) => {
            const hasIt = el.hasAttribute(name);

            if (!hasIt) {
                return false;
            }

            const value = el.getAttribute(name);
            return !(/false/i.test(`${value}`));
        };

        PUBLIC.buildSchema = function () {

            const schemaObj = {};
            PRIVATE.elementMap = {};

            if (PUBLIC.elements === undefined) {
                PUBLIC.readForm();
            }

            PUBLIC.elements.forEach(el => {

                const name = el.getAttribute('name');
                const dataType = el.getAttribute('data-type');
                const required = PRIVATE.readFlagAttribute(el, 'required');
                const dataRef = el.getAttribute('data-ref');
                const nullable = PRIVATE.readFlagAttribute(el, 'nullable');

                if (!name) { // todo dado a ser validado deve ter nome
                    return;
                }

                let chain = SR;

                if (required) {
                    chain = chain.required();
                }

                if (nullable) {
                    chain = chain.nullable();
                }

                if (dataType) {
                    if (!SRDataCheck.isValidRule(dataType)) {
                        throw new BadSchemaError(`Unknown data-type: ${dataType}`);
                    }

                    if (dataRef) {
                        chain = chain[dataType](SR.ref(dataRef));
                    } else {
                        chain = chain[dataType]();
                    }

                } else if (dataRef) {
                    chain = chain.equal(SR.ref(dataRef));
                }

                if (chain === SR) {
                    chain = chain.noop();
                }

                schemaObj[name] = chain;
                PRIVATE.elementMap[name] = el;
            });

            PUBLIC.schema = new Schema(schemaObj);
            PUBLIC.schemaDescription = schemaObj;
            return PUBLIC.schema;
        };

        PUBLIC.validate = async function (abortEarly = false) {

            const data = PUBLIC.readForm();

            if (!PUBLIC.schema) {
                PUBLIC.buildSchema();
            }

            try {
                await PUBLIC.schema.validate(data, abortEarly);
                return { valid: true, errors: null };

            } catch (err) {
                if (!(err instanceof DataTypeError)) {
                    throw err;
                }

                const errors = {};

                Object.entries(err.report).forEach(([field, messages]) => {
                    if (!messages) return;

                    errors[field] = {
                        element: PRIVATE.elementMap[field],
                        messages
                    };
                });

                return {
                    valid: false,
                    errors
                };
            }
        };
    };
})();
