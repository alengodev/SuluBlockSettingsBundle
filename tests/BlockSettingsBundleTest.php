<?php

declare(strict_types=1);

namespace Alengo\SuluBlockSettingsBundle\Tests;

use Alengo\SuluBlockSettingsBundle\Admin\BlockSettingsAdmin;
use Alengo\SuluBlockSettingsBundle\Admin\FormMetadataVisitor\BlockSettingsFormMetadataVisitor;
use Alengo\SuluBlockSettingsBundle\BlockSettingsBundle;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;
use Symfony\Component\Config\Definition\Exception\InvalidConfigurationException;
use Symfony\Component\DependencyInjection\ContainerBuilder;
use Symfony\Component\DependencyInjection\Reference;

final class BlockSettingsBundleTest extends TestCase
{
    /**
     * @param list<array<string, mixed>> $configs
     */
    private function load(array $configs): ContainerBuilder
    {
        $container = new ContainerBuilder();
        $container->setParameter('kernel.environment', 'test');
        $container->setParameter('kernel.build_dir', \sys_get_temp_dir());

        $extension = (new BlockSettingsBundle())->getContainerExtension();
        self::assertNotNull($extension);
        self::assertSame('alengo_block_settings', $extension->getAlias());
        $extension->load($configs, $container);

        return $container;
    }

    /**
     * @param list<array<string, mixed>> $configs
     *
     * @return array<string, mixed>|null
     */
    private function adminConfig(array $configs): ?array
    {
        $arguments = $this->load($configs)->getDefinition(BlockSettingsAdmin::class)->getArguments();

        return (new BlockSettingsAdmin(...$arguments))->getConfig();
    }

    public function testDefaults(): void
    {
        $visitor = $this->load([[]])->getDefinition(BlockSettingsFormMetadataVisitor::class);

        self::assertEquals(
            [new Reference('sulu_admin.xml_form_metadata_loader'), [], 'content_block_settings'],
            $visitor->getArguments(),
        );
        self::assertSame([['priority' => -10]], $visitor->getTag('sulu_admin.form_metadata_visitor'));
        self::assertSame(
            ['blockTypeLock' => ['enabled' => false, 'sectionTypePrefix' => 'content-']],
            $this->adminConfig([[]]),
        );
    }

    public function testVisitorConfiguration(): void
    {
        $visitor = $this->load([[
            'form_key' => 'custom_block_settings',
            'priority' => 5,
            'sections' => ['theme', 'spacing'],
        ]])->getDefinition(BlockSettingsFormMetadataVisitor::class);

        self::assertSame(['theme', 'spacing'], $visitor->getArgument(1));
        self::assertSame('custom_block_settings', $visitor->getArgument(2));
        self::assertSame([['priority' => 5]], $visitor->getTag('sulu_admin.form_metadata_visitor'));
    }

    public function testAdminIsRegisteredForTheAdminContextOnly(): void
    {
        $admin = $this->load([[]])->getDefinition(BlockSettingsAdmin::class);

        self::assertTrue($admin->hasTag('sulu.admin'));
        self::assertSame([['context' => 'admin']], $admin->getTag('sulu.context'));
    }

    /**
     * @return iterable<string, array{array<string, mixed>, array{enabled: bool, sectionTypePrefix: string}}>
     */
    public static function blockTypeLockProvider(): iterable
    {
        yield 'shorthand true' => [['block_type_lock' => true], ['enabled' => true, 'sectionTypePrefix' => 'content-']];
        yield 'shorthand false' => [['block_type_lock' => false], ['enabled' => false, 'sectionTypePrefix' => 'content-']];
        yield 'explicit' => [
            ['block_type_lock' => ['enabled' => true, 'section_type_prefix' => 'section-']],
            ['enabled' => true, 'sectionTypePrefix' => 'section-'],
        ];
        yield 'explicitly disabled keeps prefix' => [
            ['block_type_lock' => ['enabled' => false, 'section_type_prefix' => 'section-']],
            ['enabled' => false, 'sectionTypePrefix' => 'section-'],
        ];
        yield 'prefix only enables (canBeEnabled)' => [
            ['block_type_lock' => ['section_type_prefix' => 'section-']],
            ['enabled' => true, 'sectionTypePrefix' => 'section-'],
        ];
    }

    /**
     * @param array<string, mixed> $config
     * @param array{enabled: bool, sectionTypePrefix: string} $expected
     */
    #[DataProvider('blockTypeLockProvider')]
    public function testBlockTypeLock(array $config, array $expected): void
    {
        self::assertSame(['blockTypeLock' => $expected], $this->adminConfig([$config]));
    }

    public function testLaterConfigsOverrideEarlierOnes(): void
    {
        self::assertSame(
            ['blockTypeLock' => ['enabled' => false, 'sectionTypePrefix' => 'section-']],
            $this->adminConfig([
                ['block_type_lock' => ['enabled' => true, 'section_type_prefix' => 'section-']],
                ['block_type_lock' => ['enabled' => false]],
            ]),
        );
    }

    /**
     * @return iterable<string, array{array<string, mixed>}>
     */
    public static function invalidConfigProvider(): iterable
    {
        yield 'empty form key' => [['form_key' => '']];
        yield 'non-integer priority' => [['priority' => 'high']];
        yield 'sections not a list' => [['sections' => 'theme']];
        yield 'empty section' => [['sections' => ['theme', '']]];
        yield 'blank section' => [['sections' => [' ']]];
        yield 'duplicate section' => [['sections' => ['theme', 'theme']]];
        yield 'enabled not a bool' => [['block_type_lock' => ['enabled' => 'yes']]];
        yield 'empty prefix' => [['block_type_lock' => ['enabled' => true, 'section_type_prefix' => '']]];
        yield 'blank prefix' => [['block_type_lock' => ['enabled' => true, 'section_type_prefix' => '  ']]];
        yield 'prefix not a string' => [['block_type_lock' => ['enabled' => true, 'section_type_prefix' => 5]]];
        yield 'unknown lock option' => [['block_type_lock' => ['enabled' => true, 'prefix' => 'x']]];
        yield 'unknown option' => [['unknown' => true]];
    }

    /**
     * @param array<string, mixed> $config
     */
    #[DataProvider('invalidConfigProvider')]
    public function testInvalidConfig(array $config): void
    {
        $this->expectException(InvalidConfigurationException::class);
        $this->load([$config]);
    }
}
