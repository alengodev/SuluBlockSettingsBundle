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

Sections are injected in the order defined. Each entry is the key of an XML form registered with Sulu's `XmlFormMetadataLoader` — typically placed in `config/forms/`. Empty or duplicate entries are rejected when the container is built; a key without a matching form is skipped.

### Full configuration reference

```yaml
alengo_block_settings:
    form_key: content_block_settings  # target form to inject into (default)
    priority: -10                      # visitor tag priority (default)
    sections:
        - content_block_settings_theme
        - content_block_settings_spacing
        - content_block_settings_anchor
    block_type_lock:
        enabled: false                 # see "Admin: block type lock" (default)
        section_type_prefix: content-  # block types with this prefix are section blocks (default)
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

The lock is **disabled by default**. It needs two steps: the build integration below (once per project) and enabling it in the configuration:

```yaml
alengo_block_settings:
    block_type_lock:
        enabled: true
        section_type_prefix: content-  # default
```

`block_type_lock: true` is a shorthand for `enabled: true`. As usual for Symfony toggles, setting `section_type_prefix` alone also enables the lock. The setting is read at runtime (passed to the admin by `BlockSettingsAdmin` under the `alengo_block_settings` config key), so switching it on or off needs a cache clear, not an admin rebuild. Without the build integration the setting has no effect.

Sulu has no extension point for this select, so three relative imports inside `sulu-admin-bundle` are replaced at build time (`NormalModuleReplacementPlugin`):

| Replaced import | Wrapper |
|---|---|
| `./FieldBlocks` in `containers/FieldBlocks` | provides the block type metadata via context |
| `./SortableBlock` in `components/BlockCollection` | computes the allowed types, guards `onTypeChange` |
| `../SingleSelect` in `components/Block` | disables options that are not allowed |

### Installation

**1. Add the package** to the `dependencies` in `assets/admin/package.json`:

```json
"sulu-block-settings-bundle": "file:../../vendor/alengo/block-settings-bundle/assets/admin"
```

**2. Apply it in `assets/admin/webpack.config.js`.** Insert the three lines after `webpackConfig(env, argv)` and before `return config;` (shown on the file from the Sulu skeleton):

```diff
 const path = require('path');
 const webpackConfig = require('../../vendor/sulu/sulu/webpack.config.js');

 module.exports = (env, argv) => {
     env = env ? env : {};
     argv = argv ? argv : {};

     env.project_root_path = path.resolve(__dirname, '..', '..');
     env.node_modules_path = path.resolve(__dirname, 'node_modules');

     const config = webpackConfig(env, argv);
     config.entry = path.resolve(__dirname, 'index.js');

+    // Block type lock (alengo/block-settings-bundle)
+    const webpack = require(path.resolve(env.node_modules_path, 'webpack'));
+    const applyBlockTypeLock = require(path.resolve(env.node_modules_path, 'sulu-block-settings-bundle', 'webpack.js'));
+    applyBlockTypeLock(config, webpack);
+
     return config;
 };
```

- `config` must exist, so the call goes after `webpackConfig(env, argv)`.
- Load `webpack` from `env.node_modules_path`, the same webpack Sulu builds with, not via a bare `require('webpack')`.
- No import in `app.js` is needed: the wrappers are pulled in by the replaced Sulu imports, the package has no entry point of its own.

**3. Build** in `assets/admin`:

```bash
npm install
npm run build
```

**4. Enable** the lock in `config/packages/alengo_block_settings.yaml` (see above) and clear the cache.

Sulu's `.npmrc` sets `install-links=true`, so npm copies the package into `node_modules` instead of linking it. After updating the bundle via Composer, run `npm install` again before building, otherwise the old copy is built.

### Build options

| Option | Default | Description |
|---|---|---|
| `strict` | `true` | Fail the build when a replaced import is not found (`false`: warning only) |

The section type prefix is configured in YAML (`section_type_prefix`), not here; the former `sectionTypePrefix` build option fails with a pointer to the YAML key. `applyBlockTypeLock` expects a single webpack configuration object and is idempotent (applying it twice adds the plugins once).

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
- renders the wrappers with the project's React, MobX and Babel (Sulu components stubbed): enabled/disabled via config, section prefix from config, allowed types, guarded `onTypeChange`, disabled options, observable block values, nested block fields.

## Tests

```bash
composer install
composer test        # PHPUnit: configuration, service registration, admin config, form metadata visitor
```

The admin package has its own tests, see [Tests](#tests) above.

## Requirements

| Package | Version |
|---|---|
| PHP | `^8.2` |
| Sulu | `^3.0` |
| Symfony | `^7.1 \|\| ^8.0` |
| Block type lock (optional) | Sulu admin build with webpack 5, React 16.2/17, MobX 4, mobx-react 5 |

## License

MIT — [alengo.dev](https://alengo.dev)
