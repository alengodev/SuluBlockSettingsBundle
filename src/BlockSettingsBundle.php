<?php

declare(strict_types=1);

namespace Alengo\SuluBlockSettingsBundle;

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
                    ->scalarPrototype()->end()
                    ->defaultValue([])
                ->end()
            ->end()
        ;
    }

    public function loadExtension(array $config, ContainerConfigurator $container, ContainerBuilder $builder): void
    {
        $definition = new Definition(BlockSettingsFormMetadataVisitor::class);
        $definition->addArgument(new Reference('sulu_admin.xml_form_metadata_loader'));
        $definition->addArgument($config['sections']);
        $definition->addArgument($config['form_key']);
        $definition->addTag('sulu_admin.form_metadata_visitor', ['priority' => $config['priority']]);

        $builder->setDefinition(BlockSettingsFormMetadataVisitor::class, $definition);
    }
}
