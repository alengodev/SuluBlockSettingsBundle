<?php

declare(strict_types=1);

namespace Alengo\SuluBlockSettingsBundle\DependencyInjection;

use Symfony\Component\Config\Definition\Builder\TreeBuilder;
use Symfony\Component\Config\Definition\ConfigurationInterface;

class Configuration implements ConfigurationInterface
{
    public function getConfigTreeBuilder(): TreeBuilder
    {
        $treeBuilder = new TreeBuilder('alengo_block_settings');

        $treeBuilder->getRootNode()
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

        return $treeBuilder;
    }
}
