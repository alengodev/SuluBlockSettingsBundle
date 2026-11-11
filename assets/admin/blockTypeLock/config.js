// @flow
import initializer from 'sulu-admin-bundle/services/initializer';

/*
 * Section type prefix if the block type lock is enabled (alengo_block_settings.block_type_lock in the Symfony config,
 * passed by BlockSettingsAdmin), otherwise null. initializer.config is observable, so observers re-render on change.
 */
export function getSectionTypePrefix(config: ?Object = initializer.config): ?string {
    const blockTypeLock = config && config.alengo_block_settings && config.alengo_block_settings.blockTypeLock;

    if (!blockTypeLock || blockTypeLock.enabled !== true) {
        return null;
    }

    const {sectionTypePrefix} = blockTypeLock;

    return typeof sectionTypePrefix === 'string' && sectionTypePrefix.trim() !== '' ? sectionTypePrefix : null;
}
