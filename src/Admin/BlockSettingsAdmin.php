<?php

declare(strict_types=1);

namespace Alengo\SuluBlockSettingsBundle\Admin;

use Sulu\Bundle\AdminBundle\Admin\Admin;

/**
 * Passes the block type lock configuration to the admin (initializer.config.alengo_block_settings).
 */
final class BlockSettingsAdmin extends Admin
{
    public const CONFIG_KEY = 'alengo_block_settings';

    public function __construct(
        private readonly bool $blockTypeLockEnabled,
        private readonly string $sectionTypePrefix,
    ) {
    }

    public function getConfigKey(): ?string
    {
        return self::CONFIG_KEY;
    }

    /**
     * @return array{blockTypeLock: array{enabled: bool, sectionTypePrefix: string}}
     */
    public function getConfig(): ?array
    {
        return [
            'blockTypeLock' => [
                'enabled' => $this->blockTypeLockEnabled,
                'sectionTypePrefix' => $this->sectionTypePrefix,
            ],
        ];
    }
}
