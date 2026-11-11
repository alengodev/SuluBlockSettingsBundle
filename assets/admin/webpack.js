/* eslint-disable flowtype/require-valid-file-annotation */
/* eslint-disable import/no-nodejs-modules */
/* eslint-disable no-undef */
const path = require('path');

/*
 * Block type lock: a section block (e.g. content-*) with inline blocks may only switch to section types whose block
 * fields allow all of its inline block types. Sulu offers no extension point for the block type select, so three
 * relative imports inside sulu-admin-bundle are replaced by the wrappers in ./blockTypeLock.
 *
 * Usage in the project's assets/admin/webpack.config.js:
 *
 *     const webpack = require(path.resolve(env.node_modules_path, 'webpack'));
 *     const applyBlockTypeLock = require(path.resolve(env.node_modules_path, 'sulu-block-settings-bundle', 'webpack.js'));
 *     applyBlockTypeLock(config, webpack);
 *
 * The lock itself is switched on at runtime via alengo_block_settings.block_type_lock (Symfony config, default off),
 * without it the wrappers pass everything through.
 *
 * If a Sulu update moves or renames one of the replaced imports, the replacement would silently stop applying and the
 * lock would be gone. Therefore every replacement must match at least once per build, otherwise the build fails
 * (strict, default) or warns (strict: false).
 */
const PLUGIN_NAME = 'BlockTypeLock';
const BLOCK_TYPE_LOCK_PATH = path.resolve(__dirname, 'blockTypeLock');
const APPLIED = Symbol.for('alengo.blockSettings.blockTypeLockApplied');

const REPLACEMENTS = [
    {
        request: /^\.\/SortableBlock$/,
        context: /sulu-admin-bundle[/\\]components[/\\]BlockCollection$/,
        wrapper: 'SortableBlock.js',
        description: '"./SortableBlock" in sulu-admin-bundle/components/BlockCollection',
    },
    {
        request: /^\.\.\/SingleSelect$/,
        context: /sulu-admin-bundle[/\\]components[/\\]Block$/,
        wrapper: 'BlockTypeSelect.js',
        description: '"../SingleSelect" in sulu-admin-bundle/components/Block',
    },
    {
        request: /^\.\/FieldBlocks$/,
        context: /sulu-admin-bundle[/\\]containers[/\\]FieldBlocks$/,
        wrapper: 'FieldBlocks.js',
        description: '"./FieldBlocks" in sulu-admin-bundle/containers/FieldBlocks',
    },
];

function validateOptions(options) {
    if (options === null || typeof options !== 'object' || Array.isArray(options)) {
        throw new TypeError(`${PLUGIN_NAME}: options must be an object.`);
    }

    const {strict = true} = options;

    if ('sectionTypePrefix' in options) {
        throw new TypeError(
            `${PLUGIN_NAME}: "sectionTypePrefix" moved to alengo_block_settings.block_type_lock.section_type_prefix.`
        );
    }

    if (typeof strict !== 'boolean') {
        throw new TypeError(`${PLUGIN_NAME}: "strict" must be a boolean.`);
    }

    return {strict};
}

function createReplacementHandler(replacement, matches) {
    const target = path.resolve(BLOCK_TYPE_LOCK_PATH, replacement.wrapper);

    return (resource) => {
        if (resource && typeof resource.context === 'string' && replacement.context.test(resource.context)) {
            resource.request = target;
            matches.add(replacement);
        }
    };
}

// Reports replacements that never matched. Counted over the compiler's lifetime: watch rebuilds reuse cached modules.
class BlockTypeLockCheckPlugin {
    constructor(replacements, matches, strict) {
        this.replacements = replacements;
        this.matches = matches;
        this.strict = strict;
    }

    apply(compiler) {
        // thisCompilation is not called for child compilations (e.g. mini-css-extract-plugin)
        compiler.hooks.thisCompilation.tap(PLUGIN_NAME, (compilation) => {
            compilation.hooks.finishModules.tap(PLUGIN_NAME, () => {
                const missing = this.replacements.filter((replacement) => !this.matches.has(replacement));

                if (missing.length === 0) {
                    return;
                }

                const WebpackError = compiler.webpack && compiler.webpack.WebpackError || Error;
                const error = new WebpackError(
                    `${PLUGIN_NAME}: import(s) not found, the block type lock is not active: `
                    + missing.map((replacement) => replacement.description).join(', ')
                    + '. Sulu probably changed these files, adjust alengo/block-settings-bundle assets/admin/webpack.js.'
                );

                (this.strict ? compilation.errors : compilation.warnings).push(error);
            });
        });
    }
}

function applyBlockTypeLock(config, webpack, options = {}) {
    if (!config || typeof config !== 'object' || Array.isArray(config)) {
        throw new TypeError(`${PLUGIN_NAME}: config must be a single webpack configuration object.`);
    }

    if (!webpack || typeof webpack.NormalModuleReplacementPlugin !== 'function') {
        throw new TypeError(`${PLUGIN_NAME}: pass the webpack module of the admin build as second argument.`);
    }

    const {strict} = validateOptions(options);

    if (config[APPLIED]) {
        return config;
    }

    const matches = new Set();

    config.plugins = Array.isArray(config.plugins) ? config.plugins : [];
    config.plugins.push(
        ...REPLACEMENTS.map((replacement) => new webpack.NormalModuleReplacementPlugin(
            replacement.request,
            createReplacementHandler(replacement, matches)
        )),
        new BlockTypeLockCheckPlugin(REPLACEMENTS, matches, strict)
    );

    Object.defineProperty(config, APPLIED, {value: true});

    return config;
}

module.exports = applyBlockTypeLock;
module.exports.REPLACEMENTS = REPLACEMENTS;
module.exports.BLOCK_TYPE_LOCK_PATH = BLOCK_TYPE_LOCK_PATH;
module.exports.BlockTypeLockCheckPlugin = BlockTypeLockCheckPlugin;
