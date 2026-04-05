<?php

declare(strict_types=1);

namespace Alengo\SuluBlockSettingsBundle\Admin\FormMetadataVisitor;

use Sulu\Bundle\AdminBundle\Metadata\FormMetadata\FormMetadata;
use Sulu\Bundle\AdminBundle\Metadata\FormMetadata\FormMetadataVisitorInterface;
use Sulu\Bundle\AdminBundle\Metadata\FormMetadata\SectionMetadata;
use Sulu\Bundle\AdminBundle\Metadata\FormMetadata\XmlFormMetadataLoader;

/**
 * Injects configured section forms into Sulu's block settings form.
 *
 * Replaces multiple single-purpose FormMetadataVisitor classes with one
 * configurable visitor driven by the alengo_block_settings configuration.
 */
final class BlockSettingsFormMetadataVisitor implements FormMetadataVisitorInterface
{
    /**
     * @param string[] $sections XML form keys to inject, in order
     */
    public function __construct(
        private readonly XmlFormMetadataLoader $xmlFormMetadataLoader,
        private readonly array $sections,
        private readonly string $formKey = 'content_block_settings',
    ) {
    }

    public function visitFormMetadata(FormMetadata $formMetadata, string $locale, array $metadataOptions = []): void
    {
        if ($this->formKey !== $formMetadata->getKey()) {
            return;
        }

        $existingSectionNames = $this->getExistingSectionNames($formMetadata);

        foreach ($this->sections as $sectionKey) {
            $subForm = $this->xmlFormMetadataLoader->getMetadata($sectionKey, $locale, $metadataOptions);

            if (!$subForm instanceof FormMetadata) {
                continue;
            }

            foreach ($subForm->getItems() as $item) {
                if ($item instanceof SectionMetadata && \in_array($item->getName(), $existingSectionNames, true)) {
                    continue;
                }

                $formMetadata->addItem($item);

                if ($item instanceof SectionMetadata) {
                    $existingSectionNames[] = $item->getName();
                }
            }
        }
    }

    /**
     * @return string[]
     */
    private function getExistingSectionNames(FormMetadata $formMetadata): array
    {
        $names = [];
        foreach ($formMetadata->getItems() as $item) {
            if ($item instanceof SectionMetadata) {
                $names[] = $item->getName();
            }
        }

        return $names;
    }
}
