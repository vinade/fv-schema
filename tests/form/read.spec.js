/**
 * @jest-environment jsdom
 */

import { FV } from '../../src/FV';

describe('FV reading Form', () => {

    let form;

    beforeEach(() => {
        // Cria um form fictício no DOM
        form = document.createElement('form');
        document.body.appendChild(form);
    });

    afterEach(() => {
        document.body.innerHTML = '';
    });

    test('should throw error if formRef is not a HTMLFormElement', () => {
        expect(() => new FV({})).toThrow('Invalid form reference');
        expect(() => new FV(null)).toThrow('Invalid form reference');
    });

    test('should read text input value', () => {
        const input = document.createElement('input');
        input.name = 'username';
        input.value = 'testuser';
        form.appendChild(input);

        const fv = new FV(form);
        const result = fv.readForm();

        expect(result).toEqual({ username: 'testuser' });
    });

    test('should read textarea value', () => {
        const textarea = document.createElement('textarea');
        textarea.name = 'bio';
        textarea.value = 'me';
        form.appendChild(textarea);

        const fv = new FV(form);
        const result = fv.readForm();

        expect(result).toEqual({ bio: 'me' });
    });

    test('should read radio buttons', () => {
        const radio1 = document.createElement('input');
        radio1.type = 'radio';
        radio1.name = 'gender';
        radio1.value = 'male';
        const radio2 = document.createElement('input');
        radio2.type = 'radio';
        radio2.name = 'gender';
        radio2.value = 'female';
        radio2.checked = true;

        form.appendChild(radio1);
        form.appendChild(radio2);

        const fv = new FV(form);
        const result = fv.readForm();

        expect(result).toEqual({ gender: 'female' });
    });

    test('should read single checkbox', () => {
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.name = 'subscribe';
        checkbox.value = 'yes';
        checkbox.checked = true;

        form.appendChild(checkbox);

        const fv = new FV(form);
        const result = fv.readForm();

        expect(result).toEqual({ subscribe: 'yes' });
    });

    test('should read multiple checkboxes', () => {
        const cb1 = document.createElement('input');
        cb1.type = 'checkbox';
        cb1.name = 'colors';
        cb1.value = 'red';
        cb1.checked = true;

        const cb2 = document.createElement('input');
        cb2.type = 'checkbox';
        cb2.name = 'colors';
        cb2.value = 'green';

        const cb3 = document.createElement('input');
        cb3.type = 'checkbox';
        cb3.name = 'colors';
        cb3.value = 'blue';
        cb3.checked = true;

        form.appendChild(cb1);
        form.appendChild(cb2);
        form.appendChild(cb3);

        const fv = new FV(form);
        const result = fv.readForm();

        expect(result).toEqual({ colors: ['red', 'blue'] });
    });

    test('should read multiple select', () => {
        const select = document.createElement('select');
        select.name = 'fruits';
        select.multiple = true;

        const option1 = document.createElement('option');
        option1.value = 'apple';
        option1.selected = true;

        const option2 = document.createElement('option');
        option2.value = 'banana';

        const option3 = document.createElement('option');
        option3.value = 'orange';
        option3.selected = true;

        select.append(option1, option2, option3);
        form.appendChild(select);

        const fv = new FV(form);
        const result = fv.readForm();

        expect(result).toEqual({ fruits: ['apple', 'orange'] });
    });

    test('should ignore disabled elements and elements without name', () => {
        const input1 = document.createElement('input');
        input1.name = 'valid';
        input1.value = 'ok';

        const input2 = document.createElement('input');
        input2.disabled = true;
        input2.name = 'disabled';
        input2.value = 'should not appear';

        const input3 = document.createElement('input');
        input3.value = 'no name';

        form.append(input1, input2, input3);

        const fv = new FV(form);
        const result = fv.readForm();

        expect(result).toEqual({ valid: 'ok' });
    });

});
