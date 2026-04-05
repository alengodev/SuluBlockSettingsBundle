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

## Requirements

| Package | Version |
|---|---|
| PHP | `^8.2` |
| Sulu | `^3.0` |
| Symfony | `^7.0` |

## License

MIT — [alengo.dev](https://alengo.dev)
