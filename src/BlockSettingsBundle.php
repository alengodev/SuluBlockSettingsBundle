<?php

declare(strict_types=1);

namespace Alengo\SuluBlockSettingsBundle;

use Alengo\SuluBlockSettingsBundle\DependencyInjection\BlockSettingsExtension;
use Symfony\Component\DependencyInjection\Extension\ExtensionInterface;
use Symfony\Component\HttpKernel\Bundle\Bundle;

class BlockSettingsBundle extends Bundle
{
    public function getContainerExtension(): ?ExtensionInterface
    {
        if (null === $this->extension) {
            $this->extension = new BlockSettingsExtension();
        }

        return $this->extension;
    }
}
