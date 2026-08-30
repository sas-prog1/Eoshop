# WP 5.27.2A — Tech Bento storefront

| الحقل | القيمة |
|---|---|
| المرحلة الحالية | T1 — عقد المساحات التسويقية |
| الحالة | T1 مكتملة والبوابات الأربع ناجحة على فرع الاسترداد؛ متوقفة قبل T2 وبدء التصميم |
| Baseline SHA | `a09ac954e60ba1277a7128975f266726a85a6675` |
| الفرع | `codex/wp5-27-2a-t1-recovery` |
| التاريخ | 2026-08-31 |

## 1. سبب فرع الاسترداد

أكمل المطور T1 محليًا على جهاز آخر، لكن الالتزام المبلغ عنه `1570750e250c75bc3959cb52604dc4542544176d` لم يصل إلى المستودع الفرعي أو GitHub. استُعيدت الملفات الخادمية الأربعة التي أرسلها المالك للمحادثة كما هي، ثم أُعيد بناء الأجزاء المفقودة من العقد الأمامي، ربط الأصول، الاختبارات والتوثيق على فرع مستقل من `main`.

لا يدّعي هذا الفرع أنه نسخة Git مطابقة لالتزام الجهاز الآخر؛ هو إعادة تأسيس قابلة للمراجعة والاختبار لنفس قرار T1، ولا يتضمن Tech Bento المرئي أو محرر التخصيص.

## 2. هدف T1

تأسيس عقد واحد مملوك للخادم للمساحات التسويقية التي يحتاجها القالب:

- خمسة مربعات داخل Hero.
- إعلانان جانبيان.
- عشرة عناصر اكتشاف تحت Hero.
- صورة Hero مستقلة للجوال ووجهة وفocal point.
- حفظ Revisioned، أصول تابعة للمتجر، إسقاط عام آمن وتوافق مع المتاجر القديمة.

## 3. العقد المنفذ

```text
StorefrontMarketingBlock
  id, placement, position, enabled
  contentType, title, subtitle?, badge?, ctaLabel
  imageUrl, mobileImageUrl?, altText
  backgroundColor?, textColor?, overlayOpacity?
  focalPointX?, focalPointY?
  targetType, targetValue?
  disclosure, sponsorName?
  startsAt?, endsAt?
```

الإضافات إلى `StoreConfig`:

- `marketingBlocks?`
- `heroBannerMobileImage?`
- `heroBannerTargetType?`
- `heroBannerTargetValue?`
- `heroBannerFocalPointX?`
- `heroBannerFocalPointY?`

لم تُضف `editorial_story` أو `featuredProductIds`، ولا Migration أو endpoint أو dependency أو جدول جديد.

## 4. قواعد الخادم

- placements: `hero_bento` بحد 5، و`side_ad` بحد 2، و`discovery` بحد 10؛ الإجمالي 17.
- المواضع تبدأ من 1 ومتتابعة وفريدة داخل كل placement.
- العنوان 2–80، النص المساعد حتى 180، الشارة حتى 40، الزر 2–40، alt ‏2–160 والراعي حتى 80 حرفًا.
- الألوان `#RRGGBB` والنسب/focal points أعداد صحيحة بين 0 و100.
- الجدولة RFC3339 بتوقيت UTC فقط، والنهاية بعد البداية.
- الصور managed paths لنفس tenant فقط.
- أهداف المنتج والتصنيف تُراجع مع كتالوج الخادم غير المؤرشف.
- الرابط الخارجي HTTPS آمن، للحملة فقط، ويتطلب إفصاحًا واسم راعٍ.
- الإسقاط العام يحذف المعطل والخارج عن الجدولة والهدف غير المنشور.
- legacy دون العقد يُقرأ `[]`، والعميل القديم لا يستطيع حذف عقد موجود بصمت.
- provisioning يبدأ `marketingBlocks=[]` بغض النظر عن المسودة المركزية.
- no-op لا يرفع revision.

أكواد الأخطاء الجديدة/المستخدمة:

- `workspace_marketing_blocks_required`
- `workspace_marketing_blocks_invalid`
- `workspace_asset_budget_exceeded`
- `workspace_asset_path_invalid`
- `workspace_asset_unavailable`
- `workspace_revision_conflict`
- `store_asset_quota_exceeded`

## 5. الأصول والميزانيات

| الموضع | Desktop | Mobile |
|---|---:|---:|
| Hero الأساسي | 2 MiB | 1 MiB |
| Hero Bento | 750 KiB | 500 KiB |
| Side ad | 1024 KiB | 600 KiB |
| Discovery | 350 KiB | 350 KiB |

- حد الملف الواحد يبقى 5 MiB عند الرفع.
- الافتراضي لكل متجر: 64 أصلًا و75 MiB.
- يمكن إعادة استخدام الأصل، ويطبق أشد حد لكل مواضع استخدامه.

## 6. الملفات الأساسية

- `backend/app/Support/StorefrontMarketingBlocks.php`
- `backend/app/Support/StoreAssetPath.php`
- `backend/app/Services/StoreWorkspaceService.php`
- `backend/app/Services/StoreAssetService.php`
- `backend/app/Http/Requests/UpdateStoreWorkspaceRequest.php`
- `src/contracts/storefrontMarketingBlocks.ts`
- `src/services/workspaceApi.ts`
- `src/types.ts`
- `backend/tests/Integration/StoreWorkspaceTest.php`
- `src/contracts/storefrontMarketingBlocks.test.ts`
- `src/services/workspaceApi.test.ts`

## 7. التحقق المنفذ في T1

نتائج الاسترداد المركزة:

- Frontend contract + adapter: **30 اختبارًا ناجحًا**.
- TypeScript (`tsc --noEmit`): **PASS**.
- Pint على الملفات الخادمية المتغيرة: **PASS**.
- PostgreSQL integration المركزة: **3 اختبارات / 41 assertion ناجحة**.
- ملفات PHP الأساسية الأربعة تطابق SHA-256 للمرفقات المرسلة من المالك.

النتائج الكاملة على الفرع نفسه:

| البوابة | النتيجة |
|---|---|
| Repository safety | **PASS** |
| Frontend quality + audit | **PASS** — 68 ملفًا / 369 اختبارًا، TypeScript وVite ناجحان، و0 ثغرات |
| Backend quality | **PASS** — Pint ‏296 ملفًا، Larastan ‏256/256، وPHPUnit ‏3/6 |
| Container integration | **PASS** — PostgreSQL ‏174 اختبارًا / 1,959 assertion، HTTP وworker وscheduler |
| `git diff --check` | **PASS** |

بناء Linux داخل Docker:

- JavaScript: `997,050` بايت تقريبًا، gzip `263.37 kB`.
- CSS: `124,660` بايت تقريبًا، gzip `18.61 kB`.
- الصورة الثابتة الموجودة مسبقًا: `819.42 kB`.
- تحذير chunk الأكبر من 500 kB ما زال دينًا سابقًا، ولم تُنفذ إعادة تقسيم واسعة في T1.

شغلت بوابة التكامل في مشروع معزول باسم `eoshop-t1-recovery` ثم حذفت الحاويات والشبكة والـvolumes تلقائيًا بعد النجاح.

## 8. حدود T2 التالية

بعد اعتماد T1 فقط:

1. بناء Tech Bento فوق renderer والشراء المشتركين، لا fork جديد للمتجر.
2. إظهار Hero والمربعات والإعلانات وعناصر الاكتشاف من العقد الخادمي فقط.
3. الحفاظ على الصفحة الأولى ضمن viewport المرجعي قدر الإمكان دون فراغات رأسية زائدة.
4. ربط كل CTA بالهدف الموثوق، مع إفصاح ظاهر للإعلانات والرعاية.
5. حالات loading/empty/error والجوال وRTL والتباين والحركة المخفّضة.
6. بناء محرر التخصيص كمرحلة مستقلة بعد إثبات العرض؛ لا تُخزن مسودات وهمية في المتصفح.

## 9. المخاطر والتراجع

- خطر كِبر payload محدود بحد 17 وبميزانيات الصور؛ تقاس الشبكة لاحقًا عند توفر بيئة مناسبة.
- خطر فقد عقد بواسطة عميل قديم مغلق برفض الحذف الضمني.
- خطر cross-tenant مغلق بمسار أصل مطابق لنفس tenant وفحص السجل قبل الربط.
- التراجع لا يحتاج Migration rollback؛ يعاد الالتزام السابق مع الحفاظ على حقول العقد المجهولة أو تنظيفها أولًا عبر الكاتب الحالي.

## 10. بوابة الانتقال

لا يبدأ T2 ولا يدمج T1 إلى `main` حتى تنجح:

- Repository safety.
- Frontend quality + audit.
- Backend quality.
- Container integration على PostgreSQL معزول.
- `git diff --check`.
- مراجعة PR وCI.
