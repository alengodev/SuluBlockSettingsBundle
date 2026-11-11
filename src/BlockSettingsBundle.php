<?php

declare(strict_types=1);

namespace Alengo\SuluBlockSettingsBundle;

use Alengo\SuluBlockSettingsBundle\Admin\BlockSettingsAdmin;
use Alengo\SuluBlockSettingsBundle\Admin\FormMetadataVisitor\BlockSettingsFormMetadataVisitor;
use Symfony\Component\Config\Definition\Configurator\DefinitionConfigurator;
use Symfony\Component\DependencyInjection\ContainerBuilder;
use Symfony\Component\DependencyInjection\Definition;
use Symfony\Component\DependencyInjection\Loader\Configurator\ContainerConfigurator;
use Symfony\Component\DependencyInjection\Reference;
use Symfony\Component\HttpKernel\Bundle\AbstractBundle;

class BlockSettingsBundle extends AbstractBundle
{
    protected string $extensionAlias = 'alengo_block_settings';

    public function configure(DefinitionConfigurator $definition): void
    {
        $definition->rootNode()
            ->children()
                ->scalarNode('form_key')
                    ->defaultValue('content_block_settings')
                    ->info('The block settings form key to inject sections into')
                    ->cannotBeEmpty()
                ->end()
                ->integerNode('priority')
                    ->defaultValue(-10)
                    ->info('Service tag priority for the form metadata visitor')
                ->end()
                ->arrayNode('sections')
                    ->info('List of XML form keys to inject into the block settings form, in order')
                    ->scalarPrototype()
                        ->validate()
                            ->ifTrue(static fn (mixed $value): bool => !\is_string($value) || '' === \trim($value))
                            ->thenInvalid('Each section must be a non-empty form key, got %s.')
                        ->end()
                    ->end()
                    ->defaultValue([])
                    ->validate()
                        ->ifTrue(static fn (array $sections): bool => \count($sections) !== \count(\array_unique($sections)))
                        ->thenInvalid('Each section may only be listed once, got %s.')
                    ->end()
                ->end()
                ->arrayNode('block_type_lock')
                    ->info('Restricts the type select of section blocks to types allowing their inline blocks (requires the admin build integration, see README)')
                    ->canBeEnabled()
                    ->children()
                        ->scalarNode('section_type_prefix')
                            ->defaultValue('content-')
                            ->info('Block types starting with this prefix are section blocks')
                            ->validate()
                                ->ifTrue(static fn (mixed $value): bool => !\is_string($value) || '' === \trim($value))
                                ->thenInvalid('"section_type_prefix" must be a non-empty string.')
                            ->end()
                        ->end()
                    ->end()
                ->end()
            ->end()
        ;
    }

    /**
     * @param array{
     *     form_key: string,
     *     priority: int,
     *     sections: list<string>,
     *     block_type_lock: array{enabled: bool, section_type_prefix: string},
     * } $config
     */
    public function loadExtension(array $config, ContainerConfigurator $container, ContainerBuilder $builder): void
    {
        $definition = new Definition(BlockSettingsFormMetadataVisitor::class);
        $definition->addArgument(new Reference('sulu_admin.xml_form_metadata_loader'));
        $definition->addArgument($config['sections']);
        $definition->addArgument($config['form_key']);
        $definition->addTag('sulu_admin.form_metadata_visitor', ['priority' => $config['priority']]);

        $builder->setDefinition(BlockSettingsFormMetadataVisitor::class, $definition);

        $admin = new Definition(BlockSettingsAdmin::class);
        $admin->addArgument($config['block_type_lock']['enabled']);
        $admin->addArgument($config['block_type_lock']['section_type_prefix']);
        $admin->addTag('sulu.admin');
        $admin->addTag('sulu.context', ['context' => 'admin']);

        $builder->setDefinition(BlockSettingsAdmin::class, $admin);
    }
}
