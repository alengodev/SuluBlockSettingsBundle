import {test} from 'node:test';
import assert from 'node:assert/strict';
import {
    SECTION_TYPE_PREFIX,
    getAllowedTypes,
    getBlockFields,
    getInlineBlockTypes,
} from '../blockTypeLock/allowedBlockTypes.js';

const blockField = (...types) => ({type: 'block', types: Object.fromEntries(types.map((type) => [type, {}]))});

// content-text: blocks [text, image]; content-media: blocks [image] inside a section; content-plain: no block field
const schemaTypes = {
    'content-text': {form: {title: {type: 'text_line'}, blocks: blockField('property-text', 'property-image')}},
    'content-media': {form: {main: {type: 'section', items: {blocks: blockField('property-image')}}}},
    'content-plain': {form: {title: {type: 'text_line'}}},
    'content-other-field': {form: {items: blockField('property-text', 'property-image')}},
};

test('default prefix', () => {
    assert.equal(SECTION_TYPE_PREFIX, 'content-');
});

test('getInlineBlockTypes collects block types per array field, deduplicated', () => {
    assert.deepEqual(
        getInlineBlockTypes({
            title: 'x',
            settings: {type: 'ignored'},
            blocks: [{type: 'property-text'}, {type: 'property-text'}, {type: 'property-image'}],
            tags: ['a', 'b'],
            empty: [],
            broken: [null, 5, {type: ''}, {type: 3}],
        }),
        {blocks: ['property-text', 'property-image']}
    );
});

test('getInlineBlockTypes tolerates non-object values and uses the given toList', () => {
    assert.deepEqual(getInlineBlockTypes(null), {});
    assert.deepEqual(getInlineBlockTypes('x'), {});
    const observableLike = {toArray: () => [{type: 'property-text'}]};
    assert.deepEqual(
        getInlineBlockTypes({blocks: observableLike}, (list) => (list && list.toArray ? list.toArray() : null)),
        {blocks: ['property-text']}
    );
});

test('getBlockFields finds block fields inside sections and ignores malformed entries', () => {
    assert.deepEqual(Object.keys(getBlockFields(schemaTypes['content-media'].form)), ['blocks']);
    assert.deepEqual(getBlockFields(null), {});
    assert.deepEqual(getBlockFields({a: null, b: 'x', c: {types: 'nope'}}), {});
});

test('getBlockFields stops on pathologically deep sections', () => {
    let form = {blocks: blockField('property-text')};
    for (let i = 0; i < 50; i++) {
        form = {[`s${i}`]: {type: 'section', items: form}};
    }
    assert.deepEqual(getBlockFields(form), {});
});

test('section with inline blocks may only switch to types allowing all of them', () => {
    assert.deepEqual(
        getAllowedTypes('content-text', {blocks: ['property-image']}, schemaTypes),
        ['content-text', 'content-media']
    );
    assert.deepEqual(
        getAllowedTypes('content-text', {blocks: ['property-text', 'property-image']}, schemaTypes),
        ['content-text']
    );
});

test('field name matters, not only the inline types', () => {
    // content-other-field allows the same types but under "items"
    assert.ok(!getAllowedTypes('content-text', {blocks: ['property-text']}, schemaTypes).includes('content-other-field'));
});

test('no restriction without inline blocks, for non-section types or without metadata', () => {
    assert.equal(getAllowedTypes('content-text', {}, schemaTypes), null);
    assert.equal(getAllowedTypes('property-text', {blocks: ['property-image']}, schemaTypes), null);
    assert.equal(getAllowedTypes('content-text', {blocks: ['property-image']}, null), null);
    assert.equal(getAllowedTypes(undefined, {blocks: ['property-image']}, schemaTypes), null);
    assert.equal(getAllowedTypes('content-text', null, schemaTypes), null);
});

test('no restriction when the active type is unknown to the metadata', () => {
    assert.equal(getAllowedTypes('content-unknown', {blocks: ['property-image']}, schemaTypes), null);
});

test('arrays of non-block fields (e.g. selections with "type") do not lock the select', () => {
    assert.equal(
        getAllowedTypes('content-text', {teasers: ['pages'], blocks: []}, schemaTypes),
        null
    );
    assert.deepEqual(
        getAllowedTypes('content-text', {teasers: ['pages'], blocks: ['property-image']}, schemaTypes),
        ['content-text', 'content-media']
    );
});

test('inherited object keys are not treated as allowed block types', () => {
    assert.deepEqual(
        getAllowedTypes('content-text', {blocks: ['toString']}, schemaTypes),
        ['content-text']
    );
});

test('custom section prefix', () => {
    const types = {
        'section-a': {form: {blocks: blockField('inline-x')}},
        'section-b': {form: {blocks: blockField('inline-x')}},
    };
    assert.equal(getAllowedTypes('section-a', {blocks: ['inline-x']}, types), null);
    assert.deepEqual(getAllowedTypes('section-a', {blocks: ['inline-x']}, types, 'section-'), ['section-a', 'section-b']);
});
