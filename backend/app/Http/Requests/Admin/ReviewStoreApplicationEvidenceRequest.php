<?php

namespace App\Http\Requests\Admin;

use App\Enums\ApplicationEvidenceReviewStatus;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class ReviewStoreApplicationEvidenceRequest extends FormRequest
{
    /** @return array<string, list<mixed>> */
    public function rules(): array
    {
        return [
            'status' => [
                'required',
                Rule::in([
                    ApplicationEvidenceReviewStatus::Accepted->value,
                    ApplicationEvidenceReviewStatus::Rejected->value,
                ]),
            ],
            'note' => [
                Rule::requiredIf(fn (): bool => $this->input('status') === ApplicationEvidenceReviewStatus::Rejected->value),
                'nullable',
                'string',
                'max:1000',
            ],
        ];
    }
}
