<?php

declare(strict_types=1);

namespace Alengo\SuluBlockSettingsBundle\Tests\Admin\FormMetadataVisitor;

use Alengo\SuluBlockSettingsBundle\Admin\FormMetadataVisitor\BlockSettingsFormMetadataVisitor;
use PHPUnit\Framework\TestCase;
use Sulu\Bundle\AdminBundle\Metadata\FormMetadata\FieldMetadata;
use Sulu\Bundle\AdminBundle\Metadata\FormMetadata\FormMetadata;
use Sulu\Bundle\AdminBundle\Metadata\FormMetadata\FormMetadataLoaderInterface;
use Sulu\Bundle\AdminBundle\Metadata\FormMetadata\ItemMetadata;
use Sulu\Bundle\AdminBundle\Metadata\FormMetadata\SectionMetadata;

final class BlockSettingsFormMetadataVisitorTest extends TestCase
{
    /** @var list<array{string, string, array<string, mixed>}> */
    private array $loaderCalls = [];

    /**
     * @param array<string, ItemMetadata[]|null> $forms sub form items by form key, null: form not found
     */
    private function createLoader(array $forms): FormMetadataLoaderInterface
    {
        $calls = &$this->loaderCalls;

        return new class($forms, $calls) implements FormMetadataLoaderInterface {
            /**
             * @param array<string, ItemMetadata[]|null> $forms
             * @param list<array{string, string, array<string, mixed>}> $calls
             */
            public function __construct(private array $forms, private array &$calls)
            {
            }

            public function getMetadata(string $key, string $locale, array $metadataOptions = []): ?FormMetadata
            {
                $this->calls[] = [$key, $locale, $metadataOptions];

                if (null === ($this->forms[$key] ?? null)) {
                    return null;
                }

                return BlockSettingsFormMetadataVisitorTest::form($key, ...$this->forms[$key]);
            }
        };
    }

    public static function form(string $key, ItemMetadata ...$items): FormMetadata
    {
        $form = new FormMetadata();
        $form->setKey($key);

        foreach ($items as $item) {
            $form->addItem($item);
        }

        return $form;
    }

    /**
     * @return list<string>
     */
    private static function itemNames(FormMetadata $form): array
    {
        return \array_values(\array_map(static fn (ItemMetadata $item): string => $item->getName(), $form->getItems()));
    }

    public function testIgnoresOtherForms(): void
    {
        $visitor = new BlockSettingsFormMetadataVisitor($this->createLoader(['theme' => [new SectionMetadata('theme')]]), ['theme']);
        $form = self::form('page_details', new FieldMetadata('title'));

        $visitor->visitFormMetadata($form, 'en');

        self::assertSame(['title'], self::itemNames($form));
        self::assertSame([], $this->loaderCalls);
    }

    public function testAppendsSectionsInConfiguredOrder(): void
    {
        $visitor = new BlockSettingsFormMetadataVisitor($this->createLoader([
            'spacing' => [new SectionMetadata('spacing')],
            'theme' => [new SectionMetadata('theme'), new FieldMetadata('theme_note')],
        ]), ['theme', 'spacing']);
        $form = self::form('content_block_settings', new FieldMetadata('hidden'));

        $visitor->visitFormMetadata($form, 'de', ['webspace' => 'example']);

        self::assertSame(['hidden', 'theme', 'theme_note', 'spacing'], self::itemNames($form));
        self::assertSame(
            [['theme', 'de', ['webspace' => 'example']], ['spacing', 'de', ['webspace' => 'example']]],
            $this->loaderCalls,
        );
    }

    public function testUsesTheConfiguredFormKey(): void
    {
        $visitor = new BlockSettingsFormMetadataVisitor(
            $this->createLoader(['theme' => [new SectionMetadata('theme')]]),
            ['theme'],
            'custom_block_settings',
        );
        $default = self::form('content_block_settings');
        $custom = self::form('custom_block_settings');

        $visitor->visitFormMetadata($default, 'en');
        $visitor->visitFormMetadata($custom, 'en');

        self::assertSame([], self::itemNames($default));
        self::assertSame(['theme'], self::itemNames($custom));
    }

    public function testSkipsMissingForms(): void
    {
        $visitor = new BlockSettingsFormMetadataVisitor($this->createLoader([
            'missing' => null,
            'theme' => [new SectionMetadata('theme')],
        ]), ['missing', 'theme']);
        $form = self::form('content_block_settings');

        $visitor->visitFormMetadata($form, 'en');

        self::assertSame(['theme'], self::itemNames($form));
    }

    public function testDoesNotAddSectionsTwice(): void
    {
        $visitor = new BlockSettingsFormMetadataVisitor($this->createLoader([
            'theme' => [new SectionMetadata('theme')],
            'theme_override' => [new SectionMetadata('theme'), new SectionMetadata('anchor')],
        ]), ['theme', 'theme_override']);
        $form = self::form('content_block_settings', new SectionMetadata('schedules'));

        $visitor->visitFormMetadata($form, 'en');
        // visiting the same (cached) form again must not duplicate anything
        $visitor->visitFormMetadata($form, 'en');

        self::assertSame(['schedules', 'theme', 'anchor'], self::itemNames($form));
    }

    public function testKeepsExistingSectionOfTheSameName(): void
    {
        $existing = new SectionMetadata('theme');
        $visitor = new BlockSettingsFormMetadataVisitor($this->createLoader(['theme' => [new SectionMetadata('theme')]]), ['theme']);
        $form = self::form('content_block_settings', $existing);

        $visitor->visitFormMetadata($form, 'en');

        self::assertSame([$existing], \array_values($form->getItems()));
    }

    public function testWithoutSectionsNothingIsLoaded(): void
    {
        $visitor = new BlockSettingsFormMetadataVisitor($this->createLoader([]), []);
        $form = self::form('content_block_settings', new FieldMetadata('hidden'));

        $visitor->visitFormMetadata($form, 'en');

        self::assertSame(['hidden'], self::itemNames($form));
        self::assertSame([], $this->loaderCalls);
    }
}
