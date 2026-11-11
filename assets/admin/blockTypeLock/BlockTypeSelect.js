// @flow
import React from 'react';
import SingleSelect from 'sulu-admin-bundle/components/SingleSelect';
import BlockTypeLockContext from './BlockTypeLockContext';

/*
 * Replaces the "../SingleSelect" import of Sulu's Block (see ../webpack.js), i.e. only the type select in a
 * block header: options not allowed by TypeLockingSortableBlock are disabled, the whole select when none is left.
 */
function BlockTypeSelect(props: Object) {
    return (
        <BlockTypeLockContext.Consumer>
            {(allowedTypes) => {
                if (!allowedTypes) {
                    return <SingleSelect {...props} />;
                }

                const children = React.Children.map(props.children, (child) => (
                    child && child.type === SingleSelect.Option
                        ? React.cloneElement(child, {
                            disabled: child.props.disabled || !allowedTypes.includes(child.props.value),
                        })
                        : child
                ));

                return (
                    <SingleSelect {...props} disabled={props.disabled || allowedTypes.length <= 1}>
                        {children}
                    </SingleSelect>
                );
            }}
        </BlockTypeLockContext.Consumer>
    );
}

// Block renders the options as SingleSelect.Option, SingleSelect compares against exactly this component
BlockTypeSelect.Option = SingleSelect.Option;
BlockTypeSelect.Action = SingleSelect.Action;
BlockTypeSelect.Divider = SingleSelect.Divider;

export default BlockTypeSelect;
