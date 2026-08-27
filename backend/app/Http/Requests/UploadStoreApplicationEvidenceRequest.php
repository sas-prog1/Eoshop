<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class UploadStoreApplicationEvidenceRequest extends FormRequest
{
    protected function prepareForValidation(): void
    {
        $this->merge(['idempotencyKey' => $this->header('Idempotency-Key')]);
    }

    /** @return array<string, list<mixed>> */
    public function rules(): array
    {
        return [
            'expectedRevision' => ['required', 'integer', 'min:1'],
            'idempotencyKey' => ['required', 'uuid'],
            'document' => ['required', 'file', 'max:5120', 'mimetypes:application/pdf,image/jpeg,image/png'],
        ];
    }
}
