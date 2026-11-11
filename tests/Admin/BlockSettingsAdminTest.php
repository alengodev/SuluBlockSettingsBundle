<?php

declare(strict_types=1);

namespace Alengo\SuluBlockSettingsBundle\Tests\Admin;

use Alengo\SuluBlockSettingsBundle\Admin\BlockSettingsAdmin;
use PHPUnit\Framework\TestCase;
use Sulu\Bundle\AdminBundle\Admin\Admin;

final class BlockSettingsAdminTest extends TestCase
{
    public function testConfigKeyMatchesTheKeyReadByTheAdminPackage(): void
    {
        $admin = new BlockSettingsAdmin(false, 'content-');

        self::assertInstanceOf(Admin::class, $admin);
        // assets/admin/blockTypeLock/config.js reads initializer.config.alengo_block_settings.blockTypeLock
        self::assertSame('alengo_block_settings', $admin->getConfigKey());
        self::assertSame(BlockSettingsAdmin::CONFIG_KEY, $admin->getConfigKey());
    }

    public function testConfig(): void
    {
        self::assertSame(
            ['blockTypeLock' => ['enabled' => true, 'sectionTypePrefix' => 'section-']],
            (new BlockSettingsAdmin(true, 'section-'))->getConfig(),
        );
    }

    public function testConfigIsAlwaysSentSoTheAdminSeesTheDisabledState(): void
    {
        // Sulu's AdminController drops admins with an empty config
        self::assertNotEmpty((new BlockSettingsAdmin(false, 'content-'))->getConfig());
    }

    public function testRegistersNoViewsNavigationOrSecurityContexts(): void
    {
        self::assertSame([], (new BlockSettingsAdmin(true, 'content-'))->getSecurityContexts());
    }
}
