import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {createRequire} from 'node:module';

const require = createRequire(import.meta.url);
const applyBlockTypeLock = require('../webpack.js');
const {REPLACEMENTS, BLOCK_TYPE_LOCK_PATH, BlockTypeLockCheckPlugin} = applyBlockTypeLock;

class NormalModuleReplacementPlugin {
    constructor(request, handler) {
        this.request = request;
        this.handler = handler;
    }
}
const fakeWebpack = {NormalModuleReplacementPlugin};

const replacementPlugins = (config) => config.plugins.filter((plugin) => plugin instanceof NormalModuleReplacementPlugin);
const checkPlugin = (config) => config.plugins.find((plugin) => plugin instanceof BlockTypeLockCheckPlugin);

// Runs the check plugin against a fake compiler, returns {errors, warnings}
function runCheck(plugin) {
    let thisCompilation;
    let finishModules;
    plugin.apply({hooks: {thisCompilation: {tap: (name, fn) => (thisCompilation = fn)}}});
    const compilation = {
        errors: [],
        warnings: [],
        hooks: {finishModules: {tap: (name, fn) => (finishModules = fn)}},
    };
    thisCompilation(compilation);
    finishModules();

    return compilation;
}

const contexts = [
    '/p/assets/admin/node_modules/sulu-admin-bundle/components/BlockCollection',
    '/p/assets/admin/node_modules/sulu-admin-bundle/components/Block',
    '/p/assets/admin/node_modules/sulu-admin-bundle/containers/FieldBlocks',
];

test('wrapper files exist', () => {
    REPLACEMENTS.forEach(({wrapper}) => assert.ok(fs.existsSync(path.join(BLOCK_TYPE_LOCK_PATH, wrapper)), wrapper));
});

test('adds three replacements and the check plugin, keeps existing plugins', () => {
    const existing = {};
    const config = applyBlockTypeLock({plugins: [existing]}, fakeWebpack);
    assert.equal(config.plugins[0], existing);
    assert.equal(replacementPlugins(config).length, 3);
    assert.ok(checkPlugin(config));
    assert.equal(config.plugins.length, 5);
});

test('creates a missing plugins array', () => {
    assert.equal(applyBlockTypeLock({}, fakeWebpack).plugins.length, 4);
});

test('is idempotent', () => {
    const config = applyBlockTypeLock({plugins: []}, fakeWebpack);
    applyBlockTypeLock(config, fakeWebpack);
    assert.equal(replacementPlugins(config).length, 3);
});

test('rewrites only the matching import in the matching sulu-admin-bundle directory', () => {
    const plugins = replacementPlugins(applyBlockTypeLock({plugins: []}, fakeWebpack));

    plugins.forEach((plugin, index) => {
        const {wrapper} = REPLACEMENTS[index];
        const hit = {context: contexts[index], request: 'x'};
        plugin.handler(hit);
        assert.equal(hit.request, path.join(BLOCK_TYPE_LOCK_PATH, wrapper));

        const windowsHit = {context: contexts[index].replace(/\//g, '\\'), request: 'x'};
        plugin.handler(windowsHit);
        assert.equal(windowsHit.request, path.join(BLOCK_TYPE_LOCK_PATH, wrapper));

        // same relative import elsewhere (another bundle, own wrapper directory, sub directory) stays untouched
        ['/p/node_modules/sulu-page-bundle/components/Block', BLOCK_TYPE_LOCK_PATH, `${contexts[index]}/tests`]
            .forEach((context) => {
                const miss = {context, request: 'x'};
                plugin.handler(miss);
                assert.equal(miss.request, 'x', context);
            });

        plugin.handler(undefined);
        plugin.handler({request: 'x'});
    });
});

test('request patterns match exactly the imports in Sulu', () => {
    assert.ok(REPLACEMENTS[0].request.test('./SortableBlock'));
    assert.ok(!REPLACEMENTS[0].request.test('./SortableBlockList'));
    assert.ok(REPLACEMENTS[1].request.test('../SingleSelect'));
    assert.ok(!REPLACEMENTS[1].request.test('../SingleSelect/Option'));
    assert.ok(REPLACEMENTS[2].request.test('./FieldBlocks'));
    assert.ok(!REPLACEMENTS[2].request.test('./FieldBlocks.scss'));
});

test('build fails when a replacement never matched (strict)', () => {
    const config = applyBlockTypeLock({plugins: []}, fakeWebpack);
    const plugins = replacementPlugins(config);
    plugins[0].handler({context: contexts[0], request: 'x'});

    const {errors, warnings} = runCheck(checkPlugin(config));
    assert.equal(warnings.length, 0);
    assert.equal(errors.length, 1);
    assert.match(errors[0].message, /SingleSelect/);
    assert.match(errors[0].message, /FieldBlocks/);
    assert.doesNotMatch(errors[0].message, /SortableBlock/);
});

test('only warns when strict is disabled', () => {
    const config = applyBlockTypeLock({plugins: []}, fakeWebpack, {strict: false});
    const {errors, warnings} = runCheck(checkPlugin(config));
    assert.equal(errors.length, 0);
    assert.equal(warnings.length, 1);
});

test('no report when every replacement matched (also on later watch rebuilds)', () => {
    const config = applyBlockTypeLock({plugins: []}, fakeWebpack);
    replacementPlugins(config).forEach((plugin, index) => plugin.handler({context: contexts[index], request: 'x'}));
    const plugin = checkPlugin(config);
    assert.deepEqual(runCheck(plugin).errors, []);
    assert.deepEqual(runCheck(plugin).errors, []);
});

test('rejects invalid arguments', () => {
    assert.throws(() => applyBlockTypeLock(null, fakeWebpack), TypeError);
    assert.throws(() => applyBlockTypeLock([{}], fakeWebpack), TypeError);
    assert.throws(() => applyBlockTypeLock({}, {}), TypeError);
    assert.throws(() => applyBlockTypeLock({}, fakeWebpack, null), TypeError);
    assert.throws(() => applyBlockTypeLock({}, fakeWebpack, {sectionTypePrefix: 'content-'}), /block_type_lock/);
    assert.throws(() => applyBlockTypeLock({}, fakeWebpack, {strict: 'yes'}), TypeError);
});

// Real webpack (optional): BLOCK_TYPE_LOCK_ADMIN=/path/to/project/assets/admin (with installed node_modules)
const adminPath = process.env.BLOCK_TYPE_LOCK_ADMIN;
const requireFromAdmin = (request) => require(path.join(adminPath, 'node_modules', request));

function compile(webpack, config) {
    return new Promise((resolve, reject) => webpack(config, (error, stats) => (error ? reject(error) : resolve(stats))));
}

test('real webpack: build without the Sulu imports fails with the lock error', {skip: !adminPath}, async () => {
    const webpack = requireFromAdmin('webpack');
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'block-type-lock-'));
    fs.writeFileSync(path.join(dir, 'entry.js'), 'export default 1;\n');

    try {
        const stats = await compile(webpack, applyBlockTypeLock({
            mode: 'development',
            context: dir,
            entry: './entry.js',
            output: {path: path.join(dir, 'dist')},
            plugins: [],
        }, webpack));

        assert.ok(stats.hasErrors());
        assert.match(stats.toJson({all: false, errors: true}).errors[0].message, /block type lock is not active/);
    } finally {
        fs.rmSync(dir, {recursive: true, force: true});
    }
});

test('real Sulu admin build: all three imports are replaced', {skip: !adminPath, timeout: 300000}, async () => {
    const webpack = requireFromAdmin('webpack');
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'block-type-lock-sulu-'));
    const cwd = process.cwd();

    try {
        process.chdir(adminPath); // loaders and the babel config are resolved from here, as in "npm run build"
        const config = require(path.join(adminPath, 'webpack.config.js'))({}, {mode: 'development'});
        config.mode = 'development';
        config.devtool = false;
        config.cache = false;
        config.output.path = dir;
        // the package is not installed into the admin's node_modules here, resolve its imports from there
        config.resolve.modules = ['node_modules', path.join(adminPath, 'node_modules')];

        const stats = await compile(webpack, applyBlockTypeLock(config, webpack));
        const {errors, modules} = stats.toJson({all: false, errors: true, modules: true});

        assert.deepEqual(errors.map((error) => error.message), []);
        REPLACEMENTS.forEach(({wrapper}) => assert.ok(
            modules.some((module) => (module.nameForCondition || '') === path.join(BLOCK_TYPE_LOCK_PATH, wrapper)),
            wrapper
        ));

        // config.js must read the initializer instance Sulu fills with the admin config, not a second copy
        const initializers = modules.filter((module) => /sulu-admin-bundle[/\\]services[/\\]initializer[/\\]index\.js$/
            .test(module.nameForCondition || ''));
        assert.equal(initializers.length, 1);
        assert.ok(modules.some((module) => (module.nameForCondition || '') === path.join(BLOCK_TYPE_LOCK_PATH, 'config.js')));
    } finally {
        process.chdir(cwd);
        fs.rmSync(dir, {recursive: true, force: true});
    }
});
