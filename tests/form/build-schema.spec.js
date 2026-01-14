/**
 * @jest-environment jsdom
 */

import { FV } from '../../src/FV';
import { SR, RULE_INSTANCE, SRDataCheck } from '../../src/SR';
import { Schema } from '../../src/Schema';


describe('FV building Schema', () => {

    let form;

    beforeEach(() => {
        // Cria um form fictício no DOM
        form = document.createElement('form');
        document.body.appendChild(form);
    });

    afterEach(() => {
        document.body.innerHTML = '';
    });

    test('should build a Schema', () => {
        const input = document.createElement('input');
        input.name = 'username';
        input.value = 'testuser';
        input.setAttribute('data-type', 'string');
        form.appendChild(input);

        const fv = new FV(form);
        const schema = fv.buildSchema();

        expect(schema).toBeInstanceOf(Schema);
    });

    test('should build a Schema with SchemaDescription', () => {
        var name = 'username';
        const input = document.createElement('input');
        input.name = name;
        input.value = 'testuser';
        input.setAttribute('data-type', 'string');
        form.appendChild(input);

        const fv = new FV(form);
        const schema = fv.buildSchema();
        expect(schema).toBeInstanceOf(Schema);

        const rule = fv.schemaDescription[name];
        expect(rule).not.toBeFalsy();
        expect(rule[RULE_INSTANCE]).not.toBeNull();
    });

    test('should build a Schema with email validator', () => {
        var name = 'email';
        const input = document.createElement('input');
        input.name = name;
        input.value = 'teste@teste.com';
        input.setAttribute('data-type', 'email');
        form.appendChild(input);

        const fv = new FV(form);
        const schema = fv.buildSchema();
        expect(schema).toBeInstanceOf(Schema);

        const rule = fv.schemaDescription[name];
        expect(rule).not.toBeFalsy();
        expect(rule[RULE_INSTANCE]).not.toBeFalsy();
        const scFn = SR.email().chain[0].val;
        const ruleFn = rule.chain[0].val;
        expect(ruleFn).toBe(scFn);
        expect(typeof ruleFn).toBe('function');
    });


    test('should build a Schema with email and string validators', () => {
        var nameEmail = 'emailProfissional';
        const input = document.createElement('input');
        input.name = nameEmail;
        input.value = 'teste@teste.com';
        input.setAttribute('data-type', 'email');

        const nameCompany = 'nameCompany';
        const input2 = document.createElement('input');
        input2.name = nameCompany;
        input2.value = 'Capsule Corp';
        input2.setAttribute('data-type', 'string');

        form.appendChild(input);
        form.appendChild(input2);

        const fv = new FV(form);
        const schema = fv.buildSchema();
        expect(schema).toBeInstanceOf(Schema);

        const rule1 = fv.schemaDescription[nameEmail];
        expect(rule1).not.toBeFalsy();
        expect(rule1[RULE_INSTANCE]).not.toBeFalsy();
        const scFn1 = SR.email().chain[0].val;
        const ruleFn1 = rule1.chain[0].val;
        expect(ruleFn1).toBe(scFn1);
        expect(typeof ruleFn1).toBe('function');


        const rule2 = fv.schemaDescription[nameCompany];
        expect(rule2).not.toBeFalsy();
        expect(rule2[RULE_INSTANCE]).not.toBeFalsy();
        const scFn2 = SR.string().chain[0].val;
        const ruleFn2 = rule2.chain[0].val;
        expect(ruleFn2).toBe(scFn2);
        expect(typeof ruleFn2).toBe('function');
    });

    test('should fail with invalid password, on composite rule', async () => {
        var namePassword = 'senha';
        const input = document.createElement('input');
        input.name = namePassword;
        input.value = 'senha';
        input.type = 'password';
        input.setAttribute('data-type', 'password');
        form.appendChild(input);

        const passwordRules = SR
                .string()
                .min(8)
                .matches(/[A-Z]/)
                .matches(/[a-z]/)
                .matches(/[0-9]/)
                .matches(/[@#$%!*]/)
                .custom((value)=>{
                    if (!SRDataCheck.isString(value)){
                        return false;
                    }

                    return value.indexOf('senha') === -1;
                });

        SR.register('password', passwordRules, "Senha inválida");

        const fv = new FV(form);
        const schema = fv.buildSchema();
        expect(schema).toBeInstanceOf(Schema);

        const result = await fv.validate();
        expect(result.errors).not.toBeFalsy();
    });

    test('should accept a valid password, on composite rule', async () => {
        var namePassword = 'senha';
        const input = document.createElement('input');
        input.name = namePassword;
        input.value = 'AT#CF2d32dwqa$ac';
        input.type = 'password';
        input.setAttribute('data-type', 'password');
        form.appendChild(input);

        const passwordRules = SR
                .string()
                .min(8)
                .matches(/[A-Z]/)
                .matches(/[a-z]/)
                .matches(/[0-9]/)
                .matches(/[@#$%!*]/)
                .custom((value)=>{
                    if (!SRDataCheck.isString(value)){
                        return false;
                    }

                    return value.indexOf('senha') === -1;
                });

        SR.register('password', passwordRules, "Senha inválida");

        const fv = new FV(form);
        const schema = fv.buildSchema();
        expect(schema).toBeInstanceOf(Schema);

        const result = await fv.validate();
        expect(result.errors).toBeFalsy();
    });

});
