import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

const node = process.execPath;

function loadConfig(env) {
    return spawnSync(
        node,
        [
            '--input-type=module',
            '-e',
            `
                import assert from 'node:assert/strict';
                const config = (await import('./next.config.js')).default ?? (await import('./next.config.js'));
                assert.equal(config.env.NEXT_PUBLIC_API_URL, process.env.EXPECTED_API_URL);
                assert.equal(typeof config.rewrites, 'undefined');
            `,
        ],
        {
            cwd: process.cwd(),
            env: {
                ...process.env,
                ...env,
            },
            encoding: 'utf8',
        },
    );
}

const missingProduction = spawnSync(
    node,
    ['-e', "process.env.NODE_ENV='production'; delete process.env.NEXT_PUBLIC_API_URL; require('./next.config.js');"],
    {
        cwd: process.cwd(),
        env: {
            ...process.env,
            NODE_ENV: 'production',
            NEXT_PUBLIC_API_URL: '',
        },
        encoding: 'utf8',
    },
);
assert.notEqual(missingProduction.status, 0, 'production config must fail without NEXT_PUBLIC_API_URL');
assert.match(
    `${missingProduction.stderr}\n${missingProduction.stdout}`,
    /NEXT_PUBLIC_API_URL/,
    'missing production API URL error should name NEXT_PUBLIC_API_URL',
);

const localhostProduction = spawnSync(
    node,
    ['-e', "process.env.NODE_ENV='production'; process.env.NEXT_PUBLIC_API_URL='http://localhost:8000'; require('./next.config.js');"],
    {
        cwd: process.cwd(),
        env: {
            ...process.env,
            NODE_ENV: 'production',
            NEXT_PUBLIC_API_URL: 'http://localhost:8000',
        },
        encoding: 'utf8',
    },
);
assert.notEqual(localhostProduction.status, 0, 'production config must reject localhost API URLs');
assert.match(
    `${localhostProduction.stderr}\n${localhostProduction.stdout}`,
    /public https/i,
    'invalid production API URL error should require a public HTTPS origin',
);

const production = loadConfig({
    NODE_ENV: 'production',
    NEXT_PUBLIC_API_URL: 'https://api.isikschedule.yigiokur.me',
    EXPECTED_API_URL: 'https://api.isikschedule.yigiokur.me',
});
assert.equal(production.status, 0, production.stderr || production.stdout);

const development = loadConfig({
    NODE_ENV: 'development',
    NEXT_PUBLIC_API_URL: '',
    EXPECTED_API_URL: 'http://localhost:8000',
});
assert.equal(development.status, 0, development.stderr || development.stdout);
