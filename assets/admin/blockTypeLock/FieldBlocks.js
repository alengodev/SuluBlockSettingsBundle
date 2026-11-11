// @flow
import React from 'react';
import FieldBlocks from 'sulu-admin-bundle/containers/FieldBlocks/FieldBlocks';
import BlockTypesContext from './BlockTypesContext';

/*
 * Replaces the "./FieldBlocks" import of Sulu's containers/FieldBlocks/index.js (see ../webpack.js) to provide
 * the form metadata of the block types to TypeLockingSortableBlock, which only gets the type titles.
 */
export default function TypesProvidingFieldBlocks(props: Object) {
    return (
        <BlockTypesContext.Provider value={props.types}>
            <FieldBlocks {...props} />
        </BlockTypesContext.Provider>
    );
}
