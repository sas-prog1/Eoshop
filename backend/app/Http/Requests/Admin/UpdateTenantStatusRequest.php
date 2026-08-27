<?php

namespace App\Http\Requests\Admin;

use App\Enums\TenantVerificationStatus;
use App\Services\StoreApplicationRequirementPolicy;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateTenantStatusRequest extends FormRequest
{
    /**
     * @return array<string, list<mixed>>
     */
    public function rules(): array
    {
        return [
            'status' => ['required', Rule::enum(TenantVerificationStatus::class)],
            'reason' => [
                Rule::requiredIf(fn (): bool => TenantVerificationStatus::tryFrom((string) $this->input('status'))?->requiresReason() === true),
                'nullable',
                'string',
                'max:1000',
            ],
            'requestedFields' => [
                Rule::requiredIf(fn (): bool => $this->input('status') === TenantVerificationStatus::ChangesRequested->value),
                Rule::prohibitedIf(fn (): bool => $this->input('status') !== TenantVerificationStatus::ChangesRequested->value),
                'array',
                'min:1',
                'max:7',
            ],
            'requestedFields.*' => [
                'string',
                'distinct',
                Rule::in(app(StoreApplicationRequirementPolicy::class)->correctionFields()),
            ],
        ];
    }
}
