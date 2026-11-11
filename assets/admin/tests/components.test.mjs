/*
 * Renders the wrappers with the admin's real react/mobx/babel, Sulu's components replaced by stubs that record their
 * props. Optional: BLOCK_TYPE_LOCK_ADMIN=/path/to/project/assets/admin (with installed node_modules)
 */
import {before, after, test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';

const require = createRequire(import.meta.url);
const {BLOCK_TYPE_LOCK_PATH} = require('../webpack.js');
const adminPath = process.env.BLOCK_TYPE_LOCK_ADMIN;
const skip = !adminPath;

const STUBS = {
    'sulu-admin-bundle/services/initializer': `
        import {observable} from 'mobx';
        export default observable({config: undefined}, {config: observable.ref});
    `,
    'sulu-admin-bundle/components/SingleSelect': `
        import React from 'react';
        const Option = () => null;
        export default function SingleSelect(props) {
            globalThis.recorded.select = props;
            return null;
        }
        SingleSelect.Option = Option;
        SingleSelect.Action = () => null;
        SingleSelect.Divider = () => null;
    `,
    'sulu-admin-bundle/components/BlockCollection/SortableBlock': `
        import React from 'react';
        import BlockTypeLockContext from '${path.join(BLOCK_TYPE_LOCK_PATH, 'BlockTypeLockContext.js')}';
        export default function SortableBlock(props) {
            globalThis.recorded.blocks.push(props);
            return (
                <BlockTypeLockContext.Consumer>
                    {(allowedTypes) => { globalThis.recorded.lock.push(allowedTypes); return props.children || null; }}
                </BlockTypeLockContext.Consumer>
            );
        }
    `,
    'sulu-admin-bundle/containers/FieldBlocks/FieldBlocks': `
        import React from 'react';
        export default function FieldBlocks(props) {
            globalThis.recorded.fieldBlocks = props;
            return props.children || null;
        }
    `,
};

const ENTRY = `
    import React from 'react';
    import {renderToStaticMarkup} from 'react-dom/server';
    import {observable} from 'mobx';
    import {useStaticRendering} from 'mobx-react';
    import SingleSelect from 'sulu-admin-bundle/components/SingleSelect';
    import BlockTypeSelect from '${path.join(BLOCK_TYPE_LOCK_PATH, 'BlockTypeSelect.js')}';
    import SortableBlock from '${path.join(BLOCK_TYPE_LOCK_PATH, 'SortableBlock.js')}';
    import FieldBlocks from '${path.join(BLOCK_TYPE_LOCK_PATH, 'FieldBlocks.js')}';
    import BlockTypeLockContext from '${path.join(BLOCK_TYPE_LOCK_PATH, 'BlockTypeLockContext.js')}';
    import {getSectionTypePrefix} from '${path.join(BLOCK_TYPE_LOCK_PATH, 'config.js')}';
    import initializer from 'sulu-admin-bundle/services/initializer';
    useStaticRendering(true);
    export {React, renderToStaticMarkup, observable, SingleSelect, BlockTypeSelect, SortableBlock, FieldBlocks,
        BlockTypeLockContext, getSectionTypePrefix, initializer};
`;

let lib;
let dir;

before(async () => {
    if (skip) {
        return;
    }

    const nodeModules = path.join(adminPath, 'node_modules');
    const fromAdmin = (request) => require(path.join(nodeModules, request));
    const webpack = fromAdmin('webpack');
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'block-type-lock-components-'));

    const alias = {};
    Object.entries(STUBS).forEach(([request, source], index) => {
        const file = path.join(dir, `stub${index}.js`);
        fs.writeFileSync(file, source);
        alias[`${request}$`] = file;
    });
    fs.writeFileSync(path.join(dir, 'entry.js'), ENTRY);

    const stats = await new Promise((resolve, reject) => webpack({
        mode: 'development',
        devtool: false,
        target: 'node',
        context: dir,
        entry: './entry.js',
        output: {path: path.join(dir, 'dist'), filename: 'lib.js', library: {type: 'commonjs2'}},
        resolve: {alias, modules: ['node_modules', nodeModules]},
        resolveLoader: {modules: [nodeModules]},
        module: {
            rules: [{
                test: /\.js$/,
                exclude: /node_modules/,
                use: {
                    loader: 'babel-loader',
                    options: {
                        babelrc: false,
                        configFile: false,
                        presets: [path.join(nodeModules, '@babel/preset-react')],
                        plugins: [path.join(nodeModules, '@babel/plugin-transform-flow-strip-types')],
                    },
                },
            }],
        },
    }, (error, result) => (error ? reject(error) : resolve(result))));

    assert.deepEqual(stats.toJson({all: false, errors: true}).errors.map((error) => error.message), []);
    lib = require(path.join(dir, 'dist', 'lib.js'));
});

after(() => dir && fs.rmSync(dir, {recursive: true, force: true}));

const lockConfig = (blockTypeLock) => ({alengo_block_settings: {blockTypeLock}});
const ENABLED = lockConfig({enabled: true, sectionTypePrefix: 'content-'});

function render(element, config = ENABLED) {
    lib.initializer.config = config;
    globalThis.recorded = {blocks: [], lock: []};
    lib.renderToStaticMarkup(element);

    return globalThis.recorded;
}

const blockField = (...types) => ({type: 'block', types: Object.fromEntries(types.map((type) => [type, {}]))});
const schemaTypes = {
    'content-text': {title: 'Text', form: {blocks: blockField('property-text', 'property-image')}},
    'content-media': {title: 'Media', form: {blocks: blockField('property-image')}},
    'content-plain': {title: 'Plain', form: {}},
};

function renderBlock(value, onTypeChange = () => {}, config = ENABLED) {
    const {React, FieldBlocks, SortableBlock} = lib;

    return render(
        React.createElement(FieldBlocks, {types: schemaTypes},
            React.createElement(SortableBlock, {activeType: value.type, index: 0, onTypeChange, value})
        ),
        config
    );
}

test('getSectionTypePrefix reads alengo_block_settings.blockTypeLock, disabled unless enabled === true', {skip}, () => {
    const {getSectionTypePrefix, initializer} = lib;
    assert.equal(getSectionTypePrefix(undefined), null);
    assert.equal(getSectionTypePrefix({}), null);
    assert.equal(getSectionTypePrefix(lockConfig({enabled: false, sectionTypePrefix: 'content-'})), null);
    assert.equal(getSectionTypePrefix(lockConfig({enabled: 'true', sectionTypePrefix: 'content-'})), null);
    assert.equal(getSectionTypePrefix(lockConfig({enabled: true, sectionTypePrefix: ' '})), null);
    assert.equal(getSectionTypePrefix(lockConfig({enabled: true})), null);
    assert.equal(getSectionTypePrefix(lockConfig({enabled: true, sectionTypePrefix: 'section-'})), 'section-');
    initializer.config = ENABLED;
    assert.equal(getSectionTypePrefix(), 'content-');
});

test('lock disabled (default): block passed through unchanged', {skip}, () => {
    const onTypeChange = () => {};
    const value = {type: 'content-text', blocks: [{type: 'property-image'}]};
    [null, {}, lockConfig({enabled: false, sectionTypePrefix: 'content-'})].forEach((config) => {
        const {blocks, lock} = renderBlock(value, onTypeChange, config);
        assert.deepEqual(lock, [null]);
        assert.equal(blocks[0].onTypeChange, onTypeChange);
    });
});

test('section type prefix comes from the config', {skip}, () => {
    const value = {type: 'content-text', blocks: [{type: 'property-image'}]};
    const {lock} = renderBlock(value, () => {}, lockConfig({enabled: true, sectionTypePrefix: 'section-'}));
    assert.deepEqual(lock, [null]);
});

test('FieldBlocks passes all props through', {skip}, () => {
    const {React, FieldBlocks} = lib;
    const props = {types: schemaTypes, value: [], dataPath: '/blocks'};
    const {fieldBlocks} = render(React.createElement(FieldBlocks, props));
    assert.deepEqual(Object.keys(fieldBlocks).sort(), Object.keys(props).sort());
});

test('section with inline blocks: allowed types provided and onTypeChange guarded', {skip}, () => {
    const changes = [];
    const {blocks, lock} = renderBlock(
        {type: 'content-text', blocks: [{type: 'property-image'}]},
        (type, index) => changes.push([type, index])
    );

    assert.deepEqual(lock, [['content-text', 'content-media']]);
    assert.equal(blocks[0].index, 0);
    blocks[0].onTypeChange('content-plain', 0);
    blocks[0].onTypeChange('content-media', 0);
    assert.deepEqual(changes, [['content-media', 0]]);
});

test('works with observable (mobx) block values', {skip}, () => {
    const {lock} = renderBlock(lib.observable({type: 'content-text', blocks: [{type: 'property-text'}]}));
    assert.deepEqual(lock, [['content-text']]);
});

test('no restriction without inline blocks, onTypeChange untouched', {skip}, () => {
    const onTypeChange = () => {};
    const {blocks, lock} = renderBlock({type: 'content-text', blocks: []}, onTypeChange);
    assert.deepEqual(lock, [null]);
    assert.equal(blocks[0].onTypeChange, onTypeChange);
});

test('no restriction outside FieldBlocks (no metadata)', {skip}, () => {
    const {React, SortableBlock} = lib;
    const {lock} = render(React.createElement(SortableBlock, {
        activeType: 'content-text',
        value: {type: 'content-text', blocks: [{type: 'property-image'}]},
    }));
    assert.deepEqual(lock, [null]);
});

test('nested block field resets the lock of the outer block', {skip}, () => {
    const {React, FieldBlocks, SortableBlock} = lib;
    const inner = React.createElement(FieldBlocks, {types: {'property-image': {form: {}}}},
        React.createElement(SortableBlock, {activeType: 'property-image', value: {type: 'property-image'}})
    );
    const {lock} = render(
        React.createElement(FieldBlocks, {types: schemaTypes},
            React.createElement(SortableBlock, {
                activeType: 'content-text',
                value: {type: 'content-text', blocks: [{type: 'property-image'}]},
                children: inner,
            })
        )
    );
    assert.deepEqual(lock, [['content-text', 'content-media'], null]);
});

function renderSelect(allowedTypes, props = {}) {
    const {React, BlockTypeSelect, BlockTypeLockContext} = lib;
    const options = ['content-text', 'content-media', 'content-plain'].map((value) => (
        React.createElement(BlockTypeSelect.Option, {key: value, value}, value)
    ));

    return render(
        React.createElement(BlockTypeLockContext.Provider, {value: allowedTypes},
            React.createElement(BlockTypeSelect, {value: 'content-text', onChange: () => {}, ...props}, options)
        )
    ).select;
}

const disabledOptions = (select) => lib.React.Children.toArray(select.children)
    .filter((child) => child.props.disabled)
    .map((child) => child.props.value);

test('BlockTypeSelect disables options that are not allowed', {skip}, () => {
    const select = renderSelect(['content-text', 'content-media']);
    assert.equal(select.disabled, false);
    assert.deepEqual(disabledOptions(select), ['content-plain']);
    lib.React.Children.forEach(select.children, (child) => assert.equal(child.type, lib.SingleSelect.Option));
});

test('BlockTypeSelect disables the whole select when only the active type is left', {skip}, () => {
    assert.equal(renderSelect(['content-text']).disabled, true);
});

test('BlockTypeSelect without lock passes everything through', {skip}, () => {
    const select = renderSelect(null);
    assert.equal(select.disabled, undefined);
    assert.deepEqual(disabledOptions(select), []);
});

test('BlockTypeSelect keeps a disabled select disabled', {skip}, () => {
    assert.equal(renderSelect(['content-text', 'content-media'], {disabled: true}).disabled, true);
});

test('BlockTypeSelect exposes the SingleSelect statics', {skip}, () => {
    ['Option', 'Action', 'Divider'].forEach((name) => assert.equal(lib.BlockTypeSelect[name], lib.SingleSelect[name]));
});
