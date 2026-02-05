import { test, describe, it } from 'node:test';
import assert from 'node:assert';

// We need to mock IINA globals before importing utils
global.iina = {
    console: {
        log: () => {},
        error: () => {}
    },
    standaloneWindow: {
        postMessage: () => {}
    }
};

import { base64Encode, base64Decode } from '../src/shared/utils.js';

describe('Utils', () => {
    describe('Base64', () => {
        it('should encode string correctly', () => {
            const input = 'Hello World';
            const expected = 'SGVsbG8gV29ybGQ=';
            assert.strictEqual(base64Encode(input), expected);
        });

        it('should decode string correctly', () => {
            const input = 'SGVsbG8gV29ybGQ=';
            const expected = 'Hello World';
            assert.strictEqual(base64Decode(input), expected);
        });

        it('should handle empty string', () => {
            assert.strictEqual(base64Encode(''), '');
            assert.strictEqual(base64Decode(''), '');
        });
    });
});
