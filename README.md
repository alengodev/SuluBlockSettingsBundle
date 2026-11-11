# SuluBlockSettingsBundle

Injects configurable section forms into Sulu CMS block settings via a single visitor — replacing the boilerplate of one `FormMetadataVisitor` class per section.

## The Problem

Sulu allows extending the block settings form (`content_block_settings`) via `FormMetadataVisitorInterface`. In practice, every project needs multiple additional sections (theme, spacing, anchor, background, etc.), each requiring its own visitor class and service registration:

```php
// Three nearly identical classes, one per section
class BlockSettingsThemeFormMetadataVisitor implements FormMetadataVisitorInterface { ... }
class BlockSettingsSpacingFormMetadataVisitor implements FormMetadataVisitorInterface { ... }
class BlockSettingsAnchorFormMetadataVisitor implements FormMetadataVisitorInterface { ... }
```

```yaml
# Three service definitions with individual priorities
App\Admin\FormMetadataVisitor\BlockSettingsThemeFormMetadataVisitor:
    tags:
        - { name: sulu_admin.form_metadata_visitor, priority: -10 }
# ...
```

This bundle replaces all of that with a single visitor driven by configuration.

## Installation

```bash
composer require alengo/block-settings-bundle
```

Register the bundle in `config/bundles.php`:

```php
Alengo\SuluBlockSettingsBundle\BlockSettingsBundle::class => ['all' => true],
```

## Configuration

Create `config/packages/alengo_block_settings.yaml`:

```yaml
alengo_block_settings:
    sections:
        - content_block_settings_theme
        - content_block_settings_spacing
        - content_block_settings_anchor
```

Sections are injected in the order defined. Each entry is the key of an XML form registered with Sulu's `XmlFormMetadataLoader` — typically placed in `config/forms/`.

### Full configuration reference

```yaml
alengo_block_settings:
    form_key: content_block_settings  # target form to inject into (default)
    priority: -10                      # visitor tag priority (default)
    sections:
        - content_block_settings_theme
        - content_block_settings_spacing
        - content_block_settings_anchor
```

## How It Works

`BlockSettingsFormMetadataVisitor` is registered as a `sulu_admin.form_metadata_visitor`. On each visit it:

1. Checks if the current form matches the configured `form_key`
2. Loads each configured section via `XmlFormMetadataLoader`
3. Skips sections already present (idempotent across locales)
4. Appends items in configured order

## Project-side XML forms

The bundle provides the injection mechanism — the actual form definitions remain in the project. Example `config/forms/content_block_settings_theme.xml`:

```xml
<?xml version="1.0" ?>
<form xmlns="http://schemas.sulu.io/template/template"
      xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
      xsi:schemaLocation="http://schemas.sulu.io/template/template https://schemas.sulu.io/template/form-1.0.xsd">
    <key>content_block_settings_theme</key>
    <properties>
        <section name="theme">
            <properties>
                <property name="template_theme" type="select">
                    <!-- ... -->
                </property>
            </properties>
        </section>
    </properties>
</form>
```

## Admin: block type lock (optional)

Sulu lets an editor switch the type of a block while keeping its nested blocks. For a section block (e.g. `content-*`) holding inline blocks (e.g. `property-*`) this can produce invalid data when the target section does not allow those inline block types. The admin package in `assets/admin` restricts the type select in the block header to the section types whose block fields allow all inline block types of the block (disabled options, the whole select when none is left). Inline blocks themselves are not restricted.

Sulu has no extension point for this select, so three relative imports inside `sulu-admin-bundle` are replaced at build time (`NormalModuleReplacementPlugin`):

| Replaced import | Wrapper |
|---|---|
| `./FieldBlocks` in `containers/FieldBlocks` | provides the block type metadata via context |
| `./SortableBlock` in `components/BlockCollection` | computes the allowed types, guards `onTypeChange` |
| `../SingleSelect` in `components/Block` | disables options that are not allowed |

### Installation

Add the package to `assets/admin/package.json`:

```json
"sulu-block-settings-bundle": "file:../../vendor/alengo/block-settings-bundle/assets/admin"
```

and apply it in `assets/admin/webpack.config.js` after `webpackConfig(env, argv)`:

```js
const webpack = require(path.resolve(env.node_modules_path, 'webpack'));
const applyBlockTypeLock = require(path.resolve(env.node_modules_path, 'sulu-block-settings-bundle', 'webpack.js'));
applyBlockTypeLock(config, webpack, {sectionTypePrefix: 'content-'});
```

No import in `app.js` is needed. Then run `npm install && npm run build` in `assets/admin`.

Sulu's `.npmrc` sets `install-links=true`, so npm copies the package into `node_modules` instead of linking it. After updating the bundle via Composer, run `npm install` again before building, otherwise the old copy is built.

### Options

| Option | Default | Description |
|---|---|---|
| `sectionTypePrefix` | `content-` | Block types starting with this prefix are section blocks and get locked |
| `strict` | `true` | Fail the build when a replaced import is not found (`false`: warning only) |

`applyBlockTypeLock` expects a single webpack configuration object and is idempotent (applying it twice adds the plugins once).

### Sulu updates

Every replacement must match at least once per build. If Sulu moves or renames one of the replaced imports, the build fails with `BlockTypeLock: import(s) not found, the block type lock is not active` (with `strict: false` it only warns), instead of shipping an admin without the lock.

Notes:

- `bin/adminconsole sulu:admin:update-build` may reset `webpack.config.js` — re-add the call afterwards.
- Keep the package name `sulu-block-settings-bundle`: Sulu's webpack config only transpiles packages in `node_modules` matching `sulu-*-bundle`.

### Tests

```bash
cd assets/admin
npm test
```

Runs without installed dependencies (Node ≥ 22): the logic computing the allowed types and the webpack integration against a fake webpack.

To test against a Sulu project with installed admin dependencies:

```bash
BLOCK_TYPE_LOCK_ADMIN=/path/to/project/assets/admin npm test
```

This additionally

- builds the project's complete admin with the lock applied and checks that all three imports are replaced,
- checks that a build without the Sulu imports fails with the lock error,
- renders the wrappers with the project's React, MobX and Babel (Sulu components stubbed): allowed types, guarded `onTypeChange`, disabled options, observable block values, nested block fields.

## Requirements

| Package | Version |
|---|---|
| PHP | `^8.2` |
| Sulu | `^3.0` |
| Symfony | `^7.1 \|\| ^8.0` |
| Block type lock (optional) | Sulu admin build with webpack 5, React 16.2/17, MobX 4, mobx-react 5 |

## License

MIT — [alengo.dev](https://alengo.dev)
