import { test, describe, it, mock } from 'node:test';
import assert from 'node:assert';

// Mock IINA
global.iina = {
    console: { log: () => {}, error: () => {} },
    utils: { exec: async () => {} }
};

import { XtreamAPI } from '../src/global/api.js';

describe('XtreamAPI', () => {
    it('should construct with credentials', () => {
        const creds = { server: 'http://test.com', username: 'user', password: 'pass' };
        const api = new XtreamAPI(creds);
        assert.strictEqual(api.server, 'http://test.com');
        assert.strictEqual(api.username, 'user');
        assert.strictEqual(api.password, 'pass');
    });

    it('should build stream URL correctly for live', () => {
        const creds = { server: 'http://test.com', username: 'user', password: 'pass' };
        const api = new XtreamAPI(creds);
        const url = api.getStreamUrl(123, 'live');
        assert.strictEqual(url, 'http://test.com/live/user/pass/123.ts');
    });

    it('should build stream URL correctly for movies', () => {
        const creds = { server: 'http://test.com', username: 'user', password: 'pass' };
        const api = new XtreamAPI(creds);
        const url = api.getStreamUrl(456, 'movie', 'mkv');
        assert.strictEqual(url, 'http://test.com/movie/user/pass/456.mkv');
    });
    
    it('should build stream URL correctly for series', () => {
        const creds = { server: 'http://test.com', username: 'user', password: 'pass' };
        const api = new XtreamAPI(creds);
        const url = api.getStreamUrl(789, 'series', 'mp4');
        assert.strictEqual(url, 'http://test.com/series/user/pass/789.mp4');
    });
});
