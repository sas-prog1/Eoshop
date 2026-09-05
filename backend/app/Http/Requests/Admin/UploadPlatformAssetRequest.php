<?php

namespace App\Http\Requests\Admin;

use App\Enums\PermissionKey;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class UploadPlatformAssetRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->hasPlatformPermission(PermissionKey::PlatformSettingsManage) === true;
    }

    protected function prepareForValidation(): void
    {
        $this->merge(['idempotencyKey' => $this->header('Idempotency-Key')]);
    }

    /** @return array<string, list<mixed>> */
    public function rules(): array
    {
        return [
            'idempotencyKey' => ['required', 'uuid'],
            'purpose' => ['required', 'string', Rule::in(['landing_hero', 'authentication'])],
            'image' => ['required', 'file', 'max:5120'],
        ];
    }

    /** @return list<callable(Validator): void> */
    public function after(): array
    {
        return [function (Validator $validator): void {
            if (array_diff(array_keys($this->all()), ['idempotencyKey', 'purpose', 'image']) !== []) {
                $validator->errors()->add('body', 'The platform asset upload contains unsupported fields.');
            }
        }];
    }
}
