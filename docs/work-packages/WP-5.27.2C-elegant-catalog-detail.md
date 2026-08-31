# WP 5.27.2C — كتالوج Elegant وصفحة تفاصيل المنتج

| الحقل | القيمة |
|---|---|
| المرحلة | Phase 5 — Launch storefront differentiation |
| الحزمة | WP 5.27.2C |
| الحالة | التنفيذ والاختبارات والبناء والاعتماد البصري مكتملة؛ Draft PR #85 مفتوح للمراجعة وCI |
| Base SHA | `be2842db7fa0f6c0d3cf1e8e5ad88d3f8776d7b3` |
| الفرع | `codex/wp5-27-2c-elegant-catalog` |
| Pull Request | [#85](https://github.com/sas-prog1/Eoshop/pull/85) — Draft، دون Merge |
| القالب | `themeStyle=elegant` فقط؛ قالب Tech دون تعديل |
| الاعتماديات | WP 5.27.1، WP 5.27.2A، WP 5.27.2B |

## الهدف

إكمال الهوية البصرية المعتمدة لقالب Elegant خارج الصفحة الرئيسية، بدءًا بصفحة جميع المنتجات وصفحة تفاصيل المنتج، مع إبقاء الكتالوج والأسعار والمخزون والسلة والشحن والدفع خاضعة للمصادر والمنطق الحاليين.

## المنجز

1. كتالوج تحريري مستقل لـElegant يتضمن مقدمة واضحة، بحثًا، تصنيفات أفقية وحالة فراغ قابلة للاستعادة.
2. بطاقات منتجات صورية بنسبة عمودية، مع التصنيف والاسم والسعر وزري التفاصيل والإضافة الحقيقيين.
3. صفحة تفاصيل بتركيب معرض كبير وكتلة قرار شراء، متجاوبة من الجوال إلى سطح المكتب.
4. عرض الوصف والسعر والمخزون والشحن ووسائل الدفع من `Product` و`StoreConfig` فقط.
5. منع الإضافة عند نفاد المخزون أو بلوغ كمية السلة المتاحة، مع الإبقاء على حسابات الطلب المشتركة.
6. إعادة استخدام `StorePreview` و`StorefrontProductDetail` دون مسار تجارة أو API خاص بالقالب.
7. بقاء Tech على الواجهة الحالية دون تغيير في التركيب أو السلوك.

## خارج النطاق

- لا تغيير API أو قاعدة بيانات أو عقد الحملات.
- لا تغيير checkout أو receipt أو سلطة السعر والمخزون.
- لا إضافة تقييمات أو مراجعات أو وعود شحن غير منشورة.
- لا تطوير قائمة أمنيات أو حساب عميل نهائي.
- لا Merge قبل اعتماد المالك للصور.

## الملفات الأساسية

- `src/features/storefront/elegant-stories/ElegantCatalog.tsx`
- `src/features/storefront/elegant-stories/ElegantCatalogProductCard.tsx`
- `src/features/storefront/elegant-stories/ElegantProductDetail.tsx`
- `src/features/storefront/elegant-stories/elegantStories.css`
- `src/components/StorePreview.tsx`
- `src/components/StorefrontProductDetail.tsx`
- `prototypes/elegant-catalog/preview.tsx`

## التحقق

- اختبارات مركزة: 4 ملفات و10 اختبارات ناجحة.
- تشغيل المجموعة الكاملة: 388 اختبارًا ناجحًا، واختبار تباين واحد كشف افتراض سطح قديم.
- بعد تصحيح افتراض السطح: ملف الوصول كاملًا 10/10 ناجح، وبذلك غُطيت الاختبارات الـ389 على الرأس الحالي.
- TypeScript: ناجح.
- Vite production build: ناجح؛ 2,178 module.
- JavaScript: 1,027.99 kB، ‏270.36 kB gzip.
- CSS: ‏147.13 kB، ‏22.65 kB gzip.
- `git diff --check`: ناجح.
- تحذير chunk أكبر من 500 kB ما زال دين أداء معروفًا ولم ينشأ في هذه الحزمة وحدها.

## الدليل البصري

- `reports/wp-5.27.2c/elegant-catalog-desktop.png`
- `reports/wp-5.27.2c/elegant-product-detail-desktop.png`
- `reports/wp-5.27.2c/elegant-catalog-mobile.png`
- `reports/wp-5.27.2c/elegant-product-detail-mobile.png`

نسخة المراجعة المحلية التفاعلية:

`http://127.0.0.1:4181/prototypes/elegant-catalog/`

## نقطة الإغلاق

اعتمد المالك صور سطح المكتب والجوال. أُنشئ Commit المنتج `24c435b`، ورُفع الفرع، وفُتح Draft PR #85. تبقى خطوات الإغلاق:

1. انتظار البوابات ومراجعة أي فشل على الرأس النهائي.
2. إبقاء PR بحالة Draft حتى اكتمال المراجعة النهائية.
3. عدم الدمج دون موافقة المالك.
