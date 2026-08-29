<?php

namespace App\Http\Requests\Admin;

use App\Enums\PermissionKey;
use App\Support\PlatformLogoUrl;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class UpdatePlatformSettingsRequest extends FormRequest
{
    private const FIELDS = [
        'expectedRevision', 'platformName', 'tagline', 'logoUrl', 'primaryColor',
        'brandPrimaryColor', 'brandAccentColor', 'brandSurfaceColor', 'brandFontFamily',
        'landingHeroImageUrl', 'authImageUrl',
        'landingHeadline', 'landingDescription', 'announcementEnabled', 'announcementText',
        'supportEmail', 'supportPhone', 'supportWhatsapp', 'showHowItWorks', 'showPricing',
        'storefrontAttributionEnabled', 'storefrontAttributionText', 'navigationItems',
    ];

    public function authorize(): bool
    {
        return $this->user()?->hasPlatformPermission(PermissionKey::PlatformSettingsManage) === true;
    }

    protected function prepareForValidation(): void
    {
        $values = [];
        foreach (['platformName', 'tagline', 'logoUrl', 'brandFontFamily', 'landingHeroImageUrl', 'authImageUrl', 'landingHeadline', 'landingDescription', 'announcementText', 'supportEmail', 'supportPhone', 'supportWhatsapp', 'storefrontAttributionText'] as $field) {
            $value = $this->input($field);
            if (is_string($value)) {
                $value = trim($value);
                $values[$field] = $value === '' && ! in_array($field, ['platformName', 'landingHeadline', 'landingDescription'], true) ? null : $value;
            }
        }
        foreach (['primaryColor', 'brandPrimaryColor', 'brandAccentColor', 'brandSurfaceColor'] as $field) {
            if (is_string($this->input($field))) {
                $values[$field] = mb_strtoupper(trim((string) $this->input($field)));
            }
        }
        if (is_string($values['supportEmail'] ?? null)) {
            $values['supportEmail'] = mb_strtolower($values['supportEmail']);
        }
        $items = $this->input('navigationItems');
        if (is_array($items)) {
            $values['navigationItems'] = array_map(static function (mixed $item): mixed {
                if (is_array($item) && is_string($item['label'] ?? null)) {
                    $item['label'] = trim($item['label']);
                }

                return $item;
            }, $items);
        }
        $this->merge($values);
    }

    /** @return array<string, list<mixed>> */
    public function rules(): array
    {
        return [
            'expectedRevision' => ['required', 'integer', 'min:1'],
            'platformName' => ['required', 'string', 'min:2', 'max:80'],
            'tagline' => ['nullable', 'string', 'min:2', 'max:160'],
            'logoUrl' => ['nullable', 'string', 'max:2048'],
            'primaryColor' => ['required', 'string', 'regex:/^#[0-9A-F]{6}$/'],
            'brandPrimaryColor' => ['required', 'string', 'regex:/^#[0-9A-F]{6}$/'],
            'brandAccentColor' => ['required', 'string', 'regex:/^#[0-9A-F]{6}$/'],
            'brandSurfaceColor' => ['required', 'string', 'regex:/^#[0-9A-F]{6}$/'],
            'brandFontFamily' => ['required', 'string', Rule::in(['Cairo', 'Tajawal', 'IBM Plex Sans Arabic'])],
            'landingHeroImageUrl' => ['nullable', 'string', 'max:2048'],
            'authImageUrl' => ['nullable', 'string', 'max:2048'],
            'landingHeadline' => ['required', 'string', 'min:10', 'max:160'],
            'landingDescription' => ['required', 'string', 'min:20', 'max:500'],
            'announcementEnabled' => ['required', 'boolean'],
            'announcementText' => ['nullable', 'string', 'min:2', 'max:240', 'required_if:announcementEnabled,true'],
            'supportEmail' => ['nullable', 'string', 'email:rfc', 'max:254'],
            'supportPhone' => ['nullable', 'string', 'regex:/^\\+[0-9]{8,15}$/'],
            'supportWhatsapp' => ['nullable', 'string', 'regex:/^\\+[0-9]{8,15}$/'],
            'showHowItWorks' => ['required', 'boolean'],
            'showPricing' => ['required', 'boolean'],
            'storefrontAttributionEnabled' => ['required', 'boolean'],
            'storefrontAttributionText' => ['nullable', 'string', 'min:2', 'max:180', 'required_if:storefrontAttributionEnabled,true'],
            'navigationItems' => ['required', 'array', 'size:3'],
            'navigationItems.*.key' => ['required', 'string', 'distinct:strict', Rule::in(['templates', 'how_it_works', 'pricing'])],
            'navigationItems.*.label' => ['required', 'string', 'min:2', 'max:40'],
            'navigationItems.*.isVisible' => ['required', 'boolean'],
            'navigationItems.*.position' => ['required', 'integer', 'between:1,3', 'distinct:strict'],
        ];
    }

    /** @return list<callable(Validator): void> */
    public function after(): array
    {
        return [function (Validator $validator): void {
            if (array_diff(array_keys($this->all()), self::FIELDS) !== []) {
                $validator->errors()->add('body', 'The platform settings update contains unsupported fields.');
            }
            foreach ((array) $this->input('navigationItems', []) as $index => $item) {
                if (! is_array($item) || array_diff(array_keys($item), ['key', 'label', 'isVisible', 'position']) !== []) {
                    $validator->errors()->add("navigationItems.{$index}", 'The navigation item contains unsupported fields.');
                }
            }
            foreach (['logoUrl', 'landingHeroImageUrl', 'authImageUrl'] as $field) {
                $url = $this->input($field);
                if (($url === null || is_string($url)) && ! PlatformLogoUrl::accepts($url)) {
                    $validator->errors()->add($field, 'The platform image URL must be a safe external HTTPS URL.');
                }
            }
            $items = collect((array) $this->input('navigationItems', []))->keyBy('key');
            if ($this->boolean('showHowItWorks') === false && data_get($items->get('how_it_works'), 'isVisible') === true) {
                $validator->errors()->add('navigationItems', 'A hidden how-it-works section cannot have a visible navigation item.');
            }
            if ($this->boolean('showPricing') === false && data_get($items->get('pricing'), 'isVisible') === true) {
                $validator->errors()->add('navigationItems', 'A hidden pricing section cannot have a visible navigation item.');
            }
        }];
    }
}
