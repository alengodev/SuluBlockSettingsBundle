/*
 * Which section types (e.g. content-*) a section block may switch to: only those whose block fields allow all of its
 * inline block types (e.g. property-*). Pure functions, used by TypeLockingSortableBlock.
 */
const hasOwn = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
const isObject = (value) => !!value && typeof value === 'object';

// Inline block types per field name of a block value, e.g. {blocks: ['property-text', 'property-image']}
export function getInlineBlockTypes(value, toList = (list) => (Array.isArray(list) ? list : null)) {
    const inlineBlockTypes = {};

    if (!isObject(value)) {
        return inlineBlockTypes;
    }

    Object.keys(value).forEach((key) => {
        const items = toList(value[key]);
        const types = items
            ? items
                .filter((item) => isObject(item) && typeof item.type === 'string' && item.type !== '')
                .map((item) => item.type)
            : [];

        if (types.length > 0) {
            inlineBlockTypes[key] = Array.from(new Set(types));
        }
    });

    return inlineBlockTypes;
}

// Block fields of a form schema by name, also inside sections (their data is not nested)
export function getBlockFields(form, depth = 0) {
    const blockFields = {};

    if (!isObject(form) || depth > 10) {
        return blockFields;
    }

    Object.keys(form).forEach((key) => {
        const entry = form[key];

        if (!isObject(entry)) {
            return;
        }

        if (entry.type === 'section') {
            Object.assign(blockFields, getBlockFields(entry.items, depth + 1));
        } else if (isObject(entry.types)) {
            blockFields[key] = entry;
        }
    });

    return blockFields;
}

function allowsInlineBlocks(schemaType, inlineBlockTypes) {
    const blockFields = getBlockFields(schemaType && schemaType.form);

    return Object.keys(inlineBlockTypes).every((key) => {
        const blockField = blockFields[key];

        return !!blockField && inlineBlockTypes[key].every((inlineType) => hasOwn(blockField.types, inlineType));
    });
}

/*
 * Types of the block field (keys of schemaTypes) the block may switch to, the active type included.
 * Only values of fields that are block fields of the active type count as inline blocks (other fields may hold
 * arrays of objects with a "type" too, e.g. selections).
 * null: no restriction (no prefix, no section type, no inline blocks or no metadata).
 */
export function getAllowedTypes(activeType, inlineBlockTypes, schemaTypes, sectionTypePrefix) {
    if (typeof sectionTypePrefix !== 'string' || sectionTypePrefix === ''
        || typeof activeType !== 'string' || !activeType.startsWith(sectionTypePrefix)
        || !isObject(schemaTypes) || !hasOwn(schemaTypes, activeType) || !isObject(inlineBlockTypes)
    ) {
        return null;
    }

    const activeBlockFields = getBlockFields(schemaTypes[activeType] && schemaTypes[activeType].form);
    const relevantInlineBlockTypes = {};

    Object.keys(inlineBlockTypes).forEach((key) => {
        if (hasOwn(activeBlockFields, key) && Array.isArray(inlineBlockTypes[key]) && inlineBlockTypes[key].length) {
            relevantInlineBlockTypes[key] = inlineBlockTypes[key];
        }
    });

    if (Object.keys(relevantInlineBlockTypes).length === 0) {
        return null;
    }

    return Object.keys(schemaTypes).filter(
        (type) => type === activeType || allowsInlineBlocks(schemaTypes[type], relevantInlineBlockTypes)
    );
}
