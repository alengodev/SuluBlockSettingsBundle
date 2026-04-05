<?php

declare(strict_types=1);

namespace Alengo\SuluBlockSettingsBundle\DependencyInjection;

use Alengo\SuluBlockSettingsBundle\Admin\FormMetadataVisitor\BlockSettingsFormMetadataVisitor;
use Symfony\Component\DependencyInjection\ContainerBuilder;
use Symfony\Component\DependencyInjection\Definition;
use Symfony\Component\DependencyInjection\Extension\Extension;
use Symfony\Component\DependencyInjection\Reference;

class BlockSettingsExtension extends Extension
{
    public function load(array $configs, ContainerBuilder $container): void
    {
        $configuration = new Configuration();
        $config = $this->processConfiguration($configuration, $configs);

        $definition = new Definition(BlockSettingsFormMetadataVisitor::class);
        $definition->addArgument(new Reference('sulu_admin.xml_form_metadata_loader'));
        $definition->addArgument($config['sections']);
        $definition->addArgument($config['form_key']);
        $definition->addTag('sulu_admin.form_metadata_visitor', ['priority' => $config['priority']]);

        $container->setDefinition(BlockSettingsFormMetadataVisitor::class, $definition);
    }

    public function getAlias(): string
    {
        return 'alengo_block_settings';
    }
}
