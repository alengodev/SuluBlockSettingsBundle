// @flow
import React from 'react';
import {isObservableArray} from 'mobx';
import {observer} from 'mobx-react';
import SortableBlock from 'sulu-admin-bundle/components/BlockCollection/SortableBlock';
import BlockTypeLockContext from './BlockTypeLockContext';
import BlockTypesContext from './BlockTypesContext';
import {getAllowedTypes, getInlineBlockTypes} from './allowedBlockTypes';
import {getSectionTypePrefix} from './config';

/*
 * Replaces the "./SortableBlock" import of Sulu's SortableBlockList (see ../webpack.js).
 *
 * A section block (content-*) with inline blocks may only switch to section types whose block fields allow all of
 * its inline block types: Sulu only rewrites "type" of the outer block and carries the nested blocks over, so a
 * section that does not allow them would end up with invalid data. Inline blocks (property-*) are not restricted.
 * Without alengo_block_settings.block_type_lock.enabled the block is passed through unchanged.
 */
function toList(value: mixed): ?Array<mixed> {
    if (Array.isArray(value)) {
        return value;
    }

    return isObservableArray(value) ? Array.from((value: any)) : null;
}

function TypeLockingSortableBlock(props: Object) {
    const {activeType, onTypeChange, value} = props;
    // Read here, not in the consumer callback, so that observer tracks the config and the inline blocks
    const sectionTypePrefix = getSectionTypePrefix();
    const inlineBlockTypes = sectionTypePrefix ? getInlineBlockTypes(value, toList) : {};

    return (
        <BlockTypesContext.Consumer>
            {(schemaTypes) => {
                const allowedTypes = getAllowedTypes(activeType, inlineBlockTypes, schemaTypes, sectionTypePrefix);
                const handleTypeChange = allowedTypes && onTypeChange
                    ? (type, index) => {
                        if (allowedTypes.includes(type)) {
                            onTypeChange(type, index);
                        }
                    }
                    : onTypeChange;

                return (
                    <BlockTypeLockContext.Provider value={allowedTypes}>
                        <SortableBlock {...props} onTypeChange={handleTypeChange} />
                    </BlockTypeLockContext.Provider>
                );
            }}
        </BlockTypesContext.Consumer>
    );
}

export default observer(TypeLockingSortableBlock);
