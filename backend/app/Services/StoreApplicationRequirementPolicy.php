<?php

namespace App\Services;

use Illuminate\Support\Str;

class StoreApplicationRequirementPolicy
{
    /**
     * @return list<array{key: string, label: string, description: string, uploadRequired: bool, allowExemption: bool}>
     */
    public function requirementsFor(string $businessType): array
    {
        $regulated = $this->regulated($businessType);

        return [
            [
                'key' => 'owner_identity',
                'label' => 'إثبات هوية مالك النشاط',
                'description' => 'صورة واضحة من وثيقة هوية سارية لمالك الحساب.',
                'uploadRequired' => true,
                'allowExemption' => false,
            ],
            [
                'key' => 'commercial_registration',
                'label' => 'السجل أو الترخيص التجاري',
                'description' => $regulated
                    ? 'هذا النشاط يتطلب مستند تسجيل أو ترخيص قبل المراجعة.'
                    : 'ارفع المستند إن وجد، أو صرّح بوضوح أن النشاط الصغير غير مسجل حاليًا.',
                'uploadRequired' => $regulated,
                'allowExemption' => ! $regulated,
            ],
        ];
    }

    /** @return list<string> */
    public function correctionFields(): array
    {
        return [
            'business.store_name',
            'business.business_type',
            'design.appearance',
            'publication.handle',
            'subscription.plan',
            'documents.owner_identity',
            'documents.commercial_registration',
        ];
    }

    /** @return array<string, string> */
    public function correctionFieldLabels(): array
    {
        return [
            'business.store_name' => 'اسم المتجر',
            'business.business_type' => 'نوع النشاط',
            'design.appearance' => 'التصميم والمحتوى',
            'publication.handle' => 'عنوان المتجر',
            'subscription.plan' => 'الباقة',
            'documents.owner_identity' => 'إثبات هوية المالك',
            'documents.commercial_registration' => 'السجل أو الترخيص التجاري',
        ];
    }

    private function regulated(string $businessType): bool
    {
        $normalized = Str::lower(trim($businessType));

        return collect((array) config('store_application.regulated_business_patterns'))
            ->contains(fn (mixed $pattern): bool => is_string($pattern) && $pattern !== '' && str_contains($normalized, Str::lower($pattern)));
    }
}
