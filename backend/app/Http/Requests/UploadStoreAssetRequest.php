<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class UploadStoreAssetRequest extends FormRequest
{
    protected function prepareForValidation(): void
    {
        $this->merge(['idempotencyKey' => $this->header('Idempotency-Key')]);
    }

    /** @return array<string, list<mixed>> */
    public function rules(): array
    {
        return [
            'idempotencyKey' => ['required', 'uuid'],
            'image' => ['required', 'file', 'max:5120'],
        ];
    }
}
