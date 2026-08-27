<?php

namespace App\Http\Requests;

use App\Support\PublicStoreHandle;
use App\Support\StoreWorkspaceContract;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;
use InvalidArgumentException;

class StoreSubmissionRequest extends FormRequest
{
    protected function prepareForValidation(): void
    {
        $this->merge([
            'idempotencyKey' => $this->header('Idempotency-Key'),
        ]);
    }

    /** @return array<string, list<mixed>> */
    public function rules(): array
    {
        return [
            'idempotencyKey' => ['required', 'uuid'],
            'draftId' => ['required', 'uuid'],
            'expectedDraftRevision' => ['required', 'integer', 'min:1'],
            'storeName' => ['required', 'string', 'max:255'],
            'businessType' => ['required', 'string', 'max:100'],
            'themeStyle' => ['required', Rule::in(['elegant', 'tech'])],
            'handle' => [
                'required',
                'string',
                function (string $attribute, mixed $value, \Closure $fail): void {
                    try {
                        PublicStoreHandle::normalize((string) $value);
                    } catch (InvalidArgumentException $exception) {
                        $fail($exception->getMessage());
                    }
                },
            ],
            'planKey' => ['required', 'string', Rule::exists('plans', 'key')->where('is_active', true)],
            'config' => ['required', 'array'],
        ];
    }

    /** @return list<callable(Validator): void> */
    public function after(): array
    {
        return [function (Validator $validator): void {
            $workspaceConfig = $this->input('config');
            $workspaceValidator = StoreWorkspaceContract::validator(
                is_array($workspaceConfig) ? $workspaceConfig : [],
                null,
            );
            foreach ($workspaceValidator->errors()->toArray() as $field => $messages) {
                foreach ($messages as $message) {
                    $validator->errors()->add($field, $message);
                }
            }

        }];
    }
}
