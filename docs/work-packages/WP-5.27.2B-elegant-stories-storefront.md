# WP 5.27.2B — قالب Elegant Stories ومختارات المحرر

| الحقل | القيمة |
|---|---|
| المرحلة | Phase 5 — Launch storefront differentiation |
| الحزمة | WP 5.27.2B |
| الحالة | T1–T4 مكتملة وظيفيًا؛ T5 قيد إغلاق التوثيق وPR، ولا Merge قبل مراجعة المالك |
| الأساس المحلي | عقد WP 5.27.2A المدمج عند `b7ed06b4a5f67871216696ae1d1342192dd11370` |
| الفرع | `codex/wp5-27-2b-elegant-stories` |
| القالب | `themeStyle=elegant`؛ لا يضاف قالب ثالث |
| الاعتماديات | WP 5.15، WP 5.21، WP 5.27.1، وعقد WP 5.27.2A/T1 المدمج |
| القرار | [ADR 0040](../decisions/ADR-0040-elegant-editorial-stories-and-discovery.md) |
| المرجع البصري | [Elegant Stories approved reference](WP-5.27.2B-elegant-stories-reference.png) |

## 1. الرؤية التنفيذية

يُعاد بناء القالب الحالي `elegant` ليصبح **Elegant Stories**: واجهة تحريرية هادئة تجعل الحملة والقصة مدخلًا للتسوق، ثم تربط العميل بمنتجات حقيقية وأسعار ومخزون خادميين.

القالب ليس نسخة Tech بألوان دافئة. الفارق الجوهري:

| Tech Bento | Elegant Stories |
|---|---|
| اكتشاف سريع كثيف بالمربعات والتصنيفات | سرد بصري واسع وخمس قصص موسمية |
| ألوان نشطة ومساحات متعددة متزامنة | مساحة بيضاء وخط تحريري وصور عمودية |
| القرار يبدأ من القسم/المنتج | القرار يبدأ من القصة ثم المجموعة/المنتج |
| إعلانات جانبية وشريط استكشاف دائري | مسرح قصص متدرج ومربعات اكتشاف تحريرية |
| إيقاع dashboard/marketplace | إيقاع مجلة أزياء ومتجر فاخر |

يظل الكتالوج والسعر والمخزون والسلة والطلب والـcheckout والـreceipt مشتركًا. الاختلاف في composition والعرض فقط، وليس في سلطة التجارة.

## 2. الهدف القابل للتسليم

1. Header أنيق، خفيف، RTL، يعرض فقط الإمكانات الفعلية.
2. مقدمة تحريرية كبيرة تستخدم حقول Hero المحفوظة.
3. خمس قصص مستقلة قابلة للرفع والتحرير والترتيب والتعطيل والجدولة.
4. كل قصة تستطيع فتح منتج أو تصنيف أو كل المنتجات أو رابط راعٍ آمن.
5. «مختارات المحرر» تعرض صور اكتشاف تحريرية مستقلة بلا سعر أو زر سلة، وتفتح أهدافًا حقيقية.
6. هوية متماسكة لكل صفحات المتجر العامة، لا الصفحة الرئيسية وحدها.
7. إدارة كاملة من لوحة تخصيص التاجر، مع preview مطابق للرابط العام.
8. تجربة صالحة من 320px حتى 1440px فأكثر، بلا page overflow أو عناصر وهمية.

## 3. خارج النطاق

- تنفيذ Blog أو نظام مقالات أو محرر نصوص طويل.
- حساب عميل نهائي، قائمة أمنيات أو إشعارات ما لم تصبح تلك الخدمات موجودة فعليًا.
- page builder حر أو تحكم التاجر بإحداثيات/عرض/تداخل كل بطاقة.
- سوق إعلانات، حجز مساحات، فوترة معلنين، moderation أو analytics.
- نسخ المنتج أو السعر أو الكمية أو التقييم إلى story metadata.
- تعديل قالب Tech أو إعادة تنفيذ عقد الحملات ورفع الصور الذي يؤسسه WP 5.27.2A.
- تعديل onboarding لإدارة قصص متقدمة قبل وجود tenant جاهز.
- fork لمسار السلة أو checkout أو الطلب أو API بحسب القالب.

## 4. ترجمة المرجع إلى مكونات

الصورة اتجاه بصري، وليست asset يُستخدم كواجهة نهائية. كل منطقة تتحول إلى عنصر مستقل:

| المنطقة | المكوّن | المصدر | السلوك الصادق عند الغياب |
|---|---|---|---|
| الشعار والبحث والتنقل والسلة | `ElegantEditorialHeader` | الهوية + routes الحالية + التصنيفات المنشورة | يخفي الإجراء غير المدعوم بدل زر وهمي |
| «قصص تستحق الاكتشاف» | `ElegantEditorialIntro` | `heroBannerBadge` | يختفي إن كان فارغًا |
| «إطلاق الموسم» | `ElegantEditorialIntro` | `heroBannerTitle` | اسم المتجر |
| الوصف المختصر | `ElegantEditorialIntro` | `heroBannerSubtitle` | slogan ثم لا شيء |
| الزر الاختياري | `ElegantEditorialIntro` | Hero CTA والهدف المشترك | يختفي إذا لم يحدد نصًا صالحًا |
| خمس البطاقات العمودية | `ElegantStoryStage` + `ElegantStoryCard` | `marketingBlocks[placement=editorial_story]` | legacy Hero أو مساحة قصص مصغرة دون فراغات |
| «مختارات المحرر» | `ElegantDiscoveryRail` | `marketingBlocks[placement=discovery]` | يختفي القسم إن لم توجد مختارات منشورة |
| عرض الكل | هدف discovery/التصنيفات الحالي | handler مشترك | يبقى رابطًا حقيقيًا فقط |
| بقية الرئيسية | Elegant surfaces للأقسام الحالية | `homeSections` | الحالات الفارغة الحالية |

### تكوين مسرح القصص

- من قصة واحدة إلى قصتين: بطاقات مركزية واسعة دون أعمدة فارغة.
- ثلاث قصص: الوسطى تأخذ التركيز البصري.
- أربع إلى خمس: ترتيب تحريري متدرج، ويأخذ العنصر الأوسط المنطقي prominence أكبر على الشاشات الواسعة.
- prominence مشتق من الترتيب والعدد؛ لا يحفظ كتحديد CSS أو coordinates.
- ترتيب DOM مطابق للترتيب الإداري، حتى عندما يتغير التداخل البصري.
- الإفصاح `إعلان` أو `برعاية` يظهر دائمًا فوق القصة عند الحاجة، ولا يعتمد على نص داخل الصورة.

## 5. ملكية أقسام الرئيسية

تبقى الأقسام الخمسة نفسها دون enum أو مصدر ترتيب جديد:

- `hero`: المقدمة التحريرية + مسرح القصص. إخفاؤه يخفي الاثنين.
- `trust`: حقائق الخدمة أو `bannerText` الصادق، بتصميم شريط هادئ.
- `categories`: مربعات «مختارات المحرر» التحريرية؛ تنقل التصنيفات في Header يظل تنقلًا عامًا.
- `featured_products`: منتجات المتجر الحقيقية في قسم مستقل أدنى الصفحة، لا داخل مربعات الاكتشاف.
- `about`: قصة المتجر ومعلوماته الحالية.

إعادة ترتيب الأقسام وإظهارها تستمر عبر `homeSections`. لا ينقل القالب محتوى قسم مخفي إلى موضع آخر للتحايل على الإعداد.

## 6. ما هو جاهز لإعادة الاستخدام

| الأساس الحالي | الحالة | قرار Elegant Stories |
|---|---|---|
| `themeStyle: elegant \| tech` | جاهز ومملوك للخادم | إعادة تصميم `elegant` نفسه |
| `StorePreview` live/preview | جاهز | يبقى route/cart/checkout authority |
| `StorefrontHome` و`StorefrontHero` | مستخرجان | dispatcher بعد عقد Tech، مع fallback legacy |
| Product card/detail/footer | جاهزة ومختبرة | variants بصرية دون منطق تجارة مكرر |
| `homeSections` | revisioned وخادمي | يبقى ترتيب الأقسام الوحيد |
| Hero text/image/height/overlay | محفوظ | النص للمقدمة والصورة fallback فقط عند عدم القصص |
| ألوان وخطوط المتجر | محفوظة | تطبق مع readable foreground، دون فرض ألوان الصورة المرجعية |
| managed assets | tenant-owned | قصص desktop/mobile تستهلك العقد المشترك بعد WP 5.27.2A |
| محرر ملف المتجر | حفظ/dirty/409/preview | يتوسع ضمن تبويب الحملات المشترك |
| الكتالوج العام | published + server price/stock | مصدر أهداف المنتج وصفوف المنتجات الحقيقية الأدنى، لا مربعات الاكتشاف |
| السلة والطلب الخادمي | مكتمل في WP 5.27.1 | لا fork ولا fields تسويقية داخل الطلب |
| CI gates | أربع بوابات | مطلوبة على الرأس النهائي نفسه |

## 7. نتيجة الالتقاء مع WP 5.27.2A

- دُمج عقد الحملات المستعاد في `main` عند `b7ed06b4a5f67871216696ae1d1342192dd11370`، ثم بُني Elegant فوقه دون عقد أو endpoint موازٍ.
- احتُفظ بجميع حقول T1 وأكواد أخطائه وحماية العملاء القدماء وملكية الأصول والـquota كما هي.
- التمديد الوحيد هو placement باسم `editorial_story` بحد خمس قصص؛ يصبح الحد الإجمالي 22 block بدل 17.
- يعيد Elegant استخدام `discovery` بحد عشرة عناصر لمختارات المحرر؛ لا يوجد `featuredProductIds` ولا وضع تلقائي منفصل.
- قالب Tech يتجاهل `editorial_story` في العرض، بينما يحتفظ به الحفظ revisioned ولا يحذفه عند تبديل القالب.
- لا Migration ولا جدول ولا endpoint ولا dependency جديدة.

## 8. التمديد الوحيد لعقد الحملات

بعد اعتماد عقد WP 5.27.2A، يضاف إلى allowlist:

```ts
type StorefrontMarketingPlacement =
  | ExistingWp5272APlacement
  | "editorial_story";
```

قواعد `editorial_story`:

- الحد الأقصى خمس قصص؛ يجوز 0–5.
- كل قصة تستخدم الحقول المشتركة نفسها دون object ثانٍ.
- `imageUrl` managed ومطلوبة للقصة النشطة؛ `mobileImageUrl` اختيارية.
- alt/title/CTA/target/schedule/disclosure تتبع الحدود المشتركة.
- لا حقول layout أو HTML أو classes أو price أو discount.
- `position` فريد ومتصل داخل placement.
- Elegant يعرضها، وTech يتجاهلها دون حذفها.

## 9. عقد مربعات الاكتشاف

لا يضاف حقل config جديد. يعيد Elegant استخدام `marketingBlocks[placement=discovery]` الذي ثبته T1:

- الحد الأقصى عشرة مربعات مرتبة، وتُعرض كصور مربعة مستقلة.
- لا سعر، مخزون، تقييم أو زر إضافة للسلة داخل هذه المربعات.
- `contentType` يصف الحملة، و`targetType` يحدد التنقل الحقيقي إلى المنتجات أو التصنيف أو المنتج أو الرابط الخارجي الآمن.
- الصورة ونسخة الجوال والـalt والجدولة والإفصاح والراعي والـfocal point تتبع عقد T1 دون امتداد جديد.
- target منتج لا يحول المربع إلى ProductCard ولا ينسخ سعر المنتج؛ إنه رابط تحريري فقط.
- public projection يخفي المعطل والمنتهي والهدف غير المنشور كما في T1.
- غياب `discovery` يخفي القسم كاملًا دون placeholders أو منتجات افتراضية.
- لا Migration أو API أو جدول أو config key جديد متوقع لهذا الصف.

## 10. معمارية الواجهة

بعد مزامنة dispatchers المشتركة:

```text
StorePreview (shared route/cart/checkout/order authority)
├── StorefrontHeaderDispatcher
│   ├── ElegantEditorialHeader
│   └── TechStorefrontHeader
├── StorefrontHomeDispatcher
│   ├── ElegantStoriesHome
│   │   ├── ElegantEditorialIntro
│   │   ├── ElegantStoryStage
│   │   │   └── ElegantStoryCard
│   │   ├── ElegantTrustStrip
│   │   ├── ElegantDiscoveryRail
│   │   ├── SharedFeaturedProducts (lower section)
│   │   └── ElegantAboutSurface
│   └── TechBentoHome
├── Shared products/list/detail handlers
├── Shared cart/checkout/receipt handlers
└── StorefrontFooter (theme variant, shared navigation/data)
```

القواعد:

- مكونات Elegant presentational ولا تستدعي API مباشرة.
- handlers المنتج والتصنيف والمنتجات والسلة تُمرر من renderer نفسه.
- لا `ElegantStorePreview` كامل ولا نسخة من checkout.
- ProductCard/ProductDetail قد يقبلان `variant="editorial"` أو composition wrapper، لكن لا ينسخان حساب السعر/التوفر/الإضافة.
- الأسطح والألوان تعرف عبر design tokens/CSS variables، لا عشرات قيم Tailwind متفرقة.

## 11. الهوية عبر صفحات المتجر كاملة

### Header

- شعار/اسم، بحث فعلي، الرئيسية، المنتجات، التصنيفات المنشورة، عن المتجر، السلة.
- «المدونة»، الحساب، المفضلة والعدادات لا تظهر حتى توجد وظائفها الحقيقية.
- الجوال: زر menu واضح وsearch expandable دون overflow أو حبس focus.

### صفحة المنتجات

- عنوان تحريري خفيف، بحث وتصنيف حقيقيان، شبكة هادئة ومسافات أوسع.
- السعر والتوفر والزر من المكونات المشتركة.
- لا badges موسمية إلا من بيانات موثوقة أو block صريح.

### تفاصيل المنتج

- gallery واضحة، اسم/وصف/سعر/مخزون خادمي، ثم CTA السلة.
- story target إلى منتج يستخدم route نفسها ولا modal خاص بالقالب.
- بيانات الشحن والدفع لا تظهر إلا من checkout policy العامة.

### السلة وCheckout وReceipt

- تبقى العمليات والحقول والأخطاء والidempotency نفسها.
- يسمح بتغيير tokens/layout presentation فقط؛ لا إخفاء السعر النهائي أو حالة الطلب.

### About/Contact/Footer

- محتوى المتجر الحالي وصورته واتصاله وساعات عمله وسياساته الحقيقية.
- social links لا تظهر ما لم تكن محفوظة بعقد موثوق؛ لا روابط زخرفية.

## 12. لوحة تخصيص التاجر

تُبنى فوق تبويب **الحملات والمساحات** الذي يؤسسه WP 5.27.2A، لا صفحة أو حفظ جديدين.

عند اختيار `elegant` تظهر مجموعتان:

### قصص الموسم

1. خريطة ثابتة للمسرح وخمس خانات مرقمة.
2. إضافة/تحرير/تعطيل/حذف/نسخ/ترتيب داخل الحد.
3. الصورة وصورة الجوال، alt، العنوان والوصف والشارة والزر والهدف.
4. focal point والتعتيم والألوان مع contrast preview.
5. الإفصاح والراعي والرابط الخارجي والجدولة من العقد المشترك.
6. الحالة: نشطة، مجدولة، منتهية، معطلة أو هدف غير منشور.
7. لا width/overlap controls؛ يشرح المحرر أن البطاقة الوسطى تأخذ التركيز تلقائيًا.

### مختارات المحرر

1. حتى عشرة blocks يدوية مستقلة من placement المشترك `discovery`؛ لا وضع تلقائي في هذا الإصدار.
2. لكل مربع صورة كمبيوتر وصورة جوال اختيارية، alt، نص، CTA وهدف typed إلى المنتجات أو تصنيف أو منتج أو حملة خارجية آمنة.
3. إضافة ونسخ وحذف وتعطيل وترتيب، مع قائمة أهداف المنتج والتصنيف من الكتالوج المنشور.
4. لا سعر أو مخزون أو زر سلة داخل المربع، حتى عندما يكون الهدف منتجًا.
5. المعاينة العامة تستخدم renderer نفسه، وتبديل القالب يحتفظ بالمحتوى المخفي.

### الحفظ والحماية

- عملية workspace واحدة مع revision واحد.
- dirty guard و401/403/409/422/network/store-switch/logout كما في المحرر الحالي.
- لا autosave منفصل للقصص، ولا asset visible قبل workspace save الناجح.
- الانتقال إلى Tech يخفي حقول Elegant بصريًا مع رسالة أن المحتوى محفوظ، ولا يمسحه.

## 13. الصور والأداء

- صور القصص managed-only وتخضع لعزل tenant وlifecycle المشترك.
- desktop story budget المستهدف 600KiB والمتشدد 900KiB؛ mobile المستهدف 300KiB والمتشدد 500KiB.
- يوصى بنسبة عمودية 4:5 أو 3:4 وبحد أدنى عملي 640×800، مع focal point بدل اشتراط قص يدوي واحد.
- الصورة الأولى المرئية فقط يمكن أن تكون eager؛ ما بعد viewport lazy و`decoding=async`.
- `<picture>` يمنع تنزيل نسخة الكمبيوتر والجوال معًا.
- container ثابت النسبة لتجنب CLS.
- أول viewport: هدف أقل من 3.8MiB صور على 1440px وأقل من 1.8MiB على 390px؛ القياس الفعلي مطلوب في Pilot.
- لا carousel تلقائي. `prefers-reduced-motion` يلغي transition غير الضروري.
- JavaScript لا يزيد أكثر من 3% وCSS لا يزيد أكثر من 8% عن baseline العقد المدمج الذي سيعاد قياسه بعد WP 5.27.2A.
- لا مكتبة carousel أو animation جديدة قبل إثبات الحاجة ومراجعة الحجم.

## 14. الاستجابة والوصول

### 1280px فأعلى

- عنوان موسمي مركزي ومساحة بيضاء واضحة.
- خمس قصص في مسرح تحريري، مع prominence مشتق للوسط وتداخل بصري مضبوط دون إخفاء CTA.
- مربعات صور الاكتشاف صف واضح أسفلها، بلا سعر أو زر سلة.

### 768–1279px

- ثلاث قصص ظاهرة والباقي scroll-snap أفقي.
- التداخل يُخفض، والنص يبقى داخل حدود البطاقة.
- مربعات الاكتشاف تتحول إلى rail دون قص أفقي للصفحة.

### 320–767px

- المقدمة أولًا، ثم قصة واحدة كاملة مع peek للقصة التالية.
- التمرير أفقي داخل stage فقط، مع تسمية وصولية وبدون autoplay.
- Product rail ببطاقات قابلة للمس و44px targets.
- لا نص فوق وجه/منتج خارج focal point؛ التعتيم/foreground يحافظان على `>=4.5:1`.
- ترتيب keyboard/reader مطابق لترتيب الإدارة، والأسهم مسماة بالعربية والتركيز مرئي.

## 15. الحالات الناقصة والصادقة

- لا قصص نشطة: يعرض Legacy Elegant Hero الحالي أو مقدمة نصية مع زر المنتجات؛ لا خمس placeholders وهمية.
- قصة واحدة/قصتان: يتمركز المحتوى ويختفي الفراغ.
- قصة منتهية/مجدولة/معطلة: لا تظهر للعامة وتبقى قابلة للتحرير.
- هدف منتج draft/archived: القصة لا تظهر للعامة حتى يصبح الهدف صالحًا.
- رابط خارجي: لا يظهر دون HTTPS وإفصاح وراعٍ وفق العقد المشترك.
- صورة مفقودة: تخفى القصة أو تستخدم surface آمنًا؛ لا broken image.
- لا مختارات يدوية: العنوان «مختارات المتجر» مع ترتيب تلقائي صادق.
- مختارات يدوية كلها غير منشورة: حالة فارغة وقسم مختصر، دون ملئه بمنتجات غير مختارة.
- «إطلاق الموسم» و«مختارات المحرر» نصوص قابلة للتغيير وليست ادعاءات تحليلية.
- لا عداد إعجاب أو سلة أو مستخدم أو شعبية إلا من state حقيقي.

## 16. مراحل العمل ونقاط التوقف

### T0 — الرؤية والعزل — مكتمل في هذه الحزمة

- Worktree/branch مستقلان من `a09ac954...`.
- الصورة المرجعية منسوخة داخل docs.
- mapping بصري، حدود السلطة، dependency matrix، ADR 0040، الاختبارات والمراحل موثقة.
- لم يبدأ في T0 أي كود منتج أو ربط، ولا commit أو push أو PR.
- **نقطة توقف:** انتظار تقرير WP 5.27.2A/T1 والعقد النهائي قبل أي ملف مشترك.

### T0P — طبقة العرض المتوازية المعزولة — مكتملة محليًا

- أضيف ViewModel داخلي لا يدعي أنه عقد الخادم النهائي.
- أضيف `ElegantEditorialHeader` ببحث وتصنيفات ومنتجات وAbout وسلة فعلية فقط؛ لا account/favorites/blog وهمية.
- أضيف `ElegantStoriesHome`, `ElegantStoryStage`, `ElegantStoryCard` و`ElegantDiscoveryRail` في مسار feature جديد.
- حالات 0–5 قصص، prominence مشتق، desktop/mobile images، disclosure، focal point، lazy loading وdiscovery callbacks موثقة ومختبرة؛ لا price/cart semantics في صف المختارات.
- CSS مستقل يغطي Desktop/Tablet/Mobile وscroll-snap و44px targets وreduced motion.
- لا import لهذه الطبقة من `StorePreview`، ولا تعديل `StoreConfig` أو workspace API أو Laravel أو الأصول أو المحرر المشترك.
- TypeScript ناجح، والاختبار المركز 9/9، وVite build ناجح عند 2,163 module.
- انحدار Frontend الكامل سجل 356/357 في التشغيل المتوازي؛ اختبار `StorefrontVerticalSlice` غير المعدل تعثر زمنيًا ثم نجح منفردًا 2/2. يعاد الانحدار الكامل بعد rebase/T1 ولا يسجل PASS كامل من هذا التشغيل.
- ضُبط First Fold المعزول ليعرض القصص الخمس كاملة وبداية صور «مختارات المحرر» دون تمرير على `1920×920`، ويعرض بداية الصور على `1366×768` دون overflow أفقي. بقي مسار `390×844` أفقيًا ولم يتأثر بضغط سطح المكتب.
- أدلة المراجعة المحلية بعد التصحيح: `reports/wp5272b-elegant-stories-discovery-first-fold-1920.png` و`reports/wp5272b-elegant-stories-discovery-first-fold-1366.png`؛ وتثبتان ظهور القصص وصف الصور التحريرية معًا في الشاشة الأولى دون أسعار أو أزرار سلة.
- **نقطة توقف:** يمنع الآن أي Adapter أو integration أو تعديل ملف مشترك حتى اعتماد عقد WP 5.27.2A/T1.

### T1 — مزامنة العقد وتثبيت delta — مكتمل

- وصل تقرير T1 من فرع Tech عند Head `1570750e250c75bc3959cb52604dc4542544176d`، وتمت مراجعة ملفات PHP المرفقة. يطابق العقد أساس هذه الحزمة، بما في ذلك managed assets والعزل والجدولة والإفصاح والأهداف الخادمية والمزج مع العملاء القدماء.
- الاعتماد التشغيلي مشروط بإتاحة Head نفسه على فرع المستودع الفرعي؛ لا rebase على ملف مرفق أو SHA محلي غير متاح عن بعد.
- rebase على Head المعتمد من WP 5.27.2A/T1.
- مراجعة schema/error codes/assets/editor seams الفعلية.
- تعديل الوثيقة/ADR عند الحاجة قبل الكود.
- إضافة `editorial_story` فقط؛ صف المختارات يعيد استخدام `discovery` المعتمد في T1.
- اختبارات contract/backend/mixed-version/tenant isolation المركزة.
- **نقطة توقف:** تقرير contract diff، الملفات، الاختبارات وMigration المتوقع «لا يوجد». لا يبدأ UI قبل الاعتماد.

### T2 — الصفحة الرئيسية Elegant Stories — مكتمل

- تنفيذ Header/Intro/StoryStage/StoryCard/DiscoveryRail والمكونات في القسم 10.
- fallbacks الصادقة وhomeSections والروابط الفعلية.
- fixtures اختبارية فقط؛ لا محتوى وهمي في public projection.
- Characterization لقالب Tech بعد rebase.
- **نقطة توقف:** صور 1440px و390px إن توفرت أداة مناسبة، نتائج component tests، وتقرير عدم تغير Tech.

### T3 — محرر القصص والمختارات — مكتمل

- توسيع تبويب الحملات المشترك بحسب القسم 12.
- managed uploads، targets، order، schedule، disclosure وpreview؛ لا product picker خاص بهذا الصف.
- save/reload/conflict/dirty/session/store-switch acceptance.
- **نقطة توقف:** دليل كل حقل مستقل، save/reload parity، وحالات الخطأ.

### T4 — بقية المسار والجوال والأداء — مكتمل وظيفيًا

- توحيد presentation المنتجات والتفاصيل والسلة والcheckout والreceipt وAbout/footer.
- مصفوفة 320/390/768/1024/1440، keyboard، reduced motion، contrast.
- رحلة story → target → product → cart → checkout → server receipt.
- قياسات build والصور وrequests في Pilot إن توفرت الأدوات؛ عدم توفر التصوير لا يبرر إيقاف الاختبارات غير البصرية.
- **نقطة توقف:** تقرير قبل/بعد والديون؛ لا PR قبل اعتماد المالك.

### T5 — البوابات والتسليم — قيد الإغلاق

- Repository safety، Frontend quality/audit، Backend quality، Container integration.
- تحديث WP/ADR/evidence/docs index.
- commits صغيرة، push إلى فرع fork المحدد فقط بعد الإذن.
- PR إلى `sas-prog1/Eoshop:main` بعد الإذن؛ لا Merge من المطور.

### نتيجة التنفيذ الحالية

- أضيف `editorial_story` إلى عقد TypeScript وLaravel بحد خمسة، وأصبح الإجمالي 22 block.
- ينشئ mapper واحد نموذج Elegant من الإسقاط العام بعد التصفية والجدولة والترتيب، دون اتصال API من المكونات العرضية.
- استُبدل Header القديم في `elegant` بهيدر تحريري يدعم البحث والتنقل والسلة الفعلية، ولا يعرض حسابًا أو مفضلة أو مدونة وهمية.
- تعرض الرئيسية مقدمة الموسم وخمس قصص مستقلة ثم صور «مختارات المحرر» دون أسعار أو أزرار سلة، وتستمر بقية الأقسام والمنتجات والشراء عبر renderer المشترك.
- أضيف تبويب «القصص والمختارات» في لوحة التاجر مع الرفع المُدار للكمبيوتر والجوال، targets، الإفصاح، الراعي، الجدولة، التعتيم، focal point، النسخ والحذف والترتيب والتعطيل.
- يحافظ تبديل القالب على blocks القالب الآخر. الحفظ يبقى ضمن workspace revision واحد، مع حماية 401/403/409/422 والعزل والحصص الخادمية القائمة.
- أدلة First Fold المعزولة: `reports/wp5272b-elegant-stories-discovery-first-fold-1920.png` و`reports/wp5272b-elegant-stories-discovery-first-fold-1366.png`.
- بناء Linux النهائي: JavaScript ‏`1,018.56 kB` (gzip ‏`268.64 kB`) وCSS ‏`135.98 kB` (gzip ‏`20.95 kB`). JavaScript ضمن سقف +3%؛ CSS قرابة +9.1% مقابل هدف +8%، انحراف موثق قدره نحو 1.35 kB بسبب الهوية البنيوية الجديدة.
- دين chunk الأكبر من 500 kB سابق وما زال مؤجلًا إلى حزمة تقسيم مستقلة؛ لا توجد dependency جديدة ولا تراجع في checkout أو API.
- Backend quality: Composer/Pint ‏296/Larastan ‏256/256/PHPUnit ‏3 اختبارات و6 assertions ناجحة.
- Container integration: PostgreSQL ‏170 اختبارًا و1,910 assertions، وفحوص HTTP/worker/scheduler ناجحة، مع حذف المشروع المعزول وvolumes بعد النجاح.
- Frontend quality + audit: PASS — ‏71 ملفًا و385 اختبارًا، وTypeScript وVite ناجحان، و0 ثغرات npm. ثُبّتت مهلات اختبارين غير متزامنين ظهرا متذبذبين تحت ضغط التشغيل الكامل، من دون تغيير سلوك المنتج.

## 17. الاختبارات المطلوبة

### Frontend/contract

- mapper يقبل `editorial_story` الصحيح ويرفض placement/field/color/schedule/target غير الصحيح.
- حد خمس قصص والترتيب والحالة والجدولة والإفصاح.
- story count 0/1/2/3/4/5 بلا فراغات أو overflow.
- CTA product/category/products/external يستخدم handlers المشتركة في live وpreview.
- discovery order/max/empty/schedule/disclosure/target handling دون price أو cart controls.
- public filtering للهدف غير المنشور دون product snapshots.
- Hero fallback وعدم فقد الصورة/النص عند تبديل القالب.
- Header لا يعرض account/favorite/blog وهمية.
- Editor upload/reorder/disable/delete/copy/save/reload/409/401/403/late response.
- Tech characterization بعد كل extraction مشترك.
- 320–390 keyboard/focus/contrast/reduced-motion/no page overflow.
- products/detail/cart/checkout/receipt parity.

### Backend/PostgreSQL

- closed validation للplacement والعدد والمواضع.
- list UUID/unique/max/existing catalog والـlegacy/mixed-version omission.
- merchant/public projection وحالات المنتج والجدولة.
- tenant A لا يشير إلى صورة/منتج tenant B.
- managed asset ready/reuse/quota/orphan lifecycle عبر العقد المشترك.
- no-op revision، stale 409، invalid 422 بلا mutation.
- provisioning injects empty values ولا يجعل draft سلطة قصص.
- theme switch يحفظ محتوى placement غير المعروض.

### Integration

- متجر Elegant ومتجر Tech منشوران بمحتوى مختلف دون تسريب.
- host المنشور 200، غير المنشور/المفقود 404.
- story asset لا يخدم خارج tenant الصحيح.
- الرحلة الكاملة تنتهي بطلب خادمي مع `ORDER_CHECKOUT_ENABLED=true` في stack الاختبار.

## 18. بوابات الجودة

على Head SHA واحد:

```powershell
./scripts/ci/repository-gate.ps1
npm.cmd run check
npm.cmd run audit
docker build --target quality --tag eoshop/backend-quality:wp5272b --file docker/php/Dockerfile .
docker run --rm eoshop/backend-quality:wp5272b sh -lc "composer validate --strict --no-check-publish && composer audit --locked && composer check"
./scripts/ci/integration-gate.ps1 -ProjectName "eoshop-wp5272b-<unique>"
git diff --check
```

لا يعاد استخدام PASS من SHA آخر أو من قبل rebase العقد المشترك.

## 19. معايير القبول

- `elegant` يظهر Elegant Stories و`tech` يظهر Tech Bento، بفارق بنيوي واضح.
- كل قصة مستقلة وقابلة للتغيير من الجهاز دون صورة صفحة مسطحة.
- خمس قصص كحد أقصى، و0–5 تنكمش بأناقة.
- مختارات المحرر منتجات حقيقية مرتبة ولا تحمل سعرًا/مخزونًا من config.
- المعاينة والرابط العام متطابقان بعد save/reload.
- تبديل القالب لا يمسح محتوى القالب الآخر.
- لا روابط أو أيقونات أو عدادات لميزات غير موجودة.
- كل الصفحات العامة تحمل هوية Elegant مع بقاء منطق التجارة مشتركًا.
- الجوال والوصول والتباين والحركة المخفّضة والأداء ضمن الحدود أو الانحراف معتمد وموثق.
- العزل والمراجعات وتعارض الحفظ والأصول تنجح عبر الخادم.
- البوابات الأربع خضراء ولا Merge دون اعتماد المالك.

## 20. صيغة التقرير عند كل نقطة توقف

```text
WP: 5.27.2B / T<n>
Base SHA:
Shared-contract SHA:
Head SHA:
Branch/Worktree/Fork:
Files changed:
Behavior completed:
Contract delta from WP 5.27.2A:
API/DB/Migration changes:
Tests run + exact results:
Build/image/network measurements:
Screenshots/evidence paths:
Tech regression status:
Known debt or deviations:
Git status:
Commit/push/PR/merge state:
Decision requested from owner:
```

## 21. مخاطر الدمج والضوابط

| الخطر | الضابط |
|---|---|
| تنفيذ عقد موازٍ قبل Tech T1 | hard stop قبل shared files ثم rebase ومقارنة contract |
| تضخم StorePreview | dispatchers ومكونات presentational؛ لا renderer كامل جديد |
| تكرار منطق التجارة | handlers/API/state مشتركة واختبارات parity |
| تصميم جميل لكنه غير قابل للإدارة | كل قصة block مستقل ولوحة موحدة |
| صور خمس قصص تبطئ الصفحة | managed assets، budgets، responsive source، lazy بعد المرئي |
| تقليد ميزات غير موجودة في المرجع | capability-driven header وحذف account/favorites/blog |
| ضياع بيانات عند تبديل القالب | retain hidden placements + mixed-version protection |
| كسر Tech أثناء استخراج المشترك | characterization واختبارات القالبين بعد rebase |
| ادعاءات تسويقية أو سعر قديم | لا commerce facts داخل blocks؛ public catalog هو المصدر |

## 22. Rollback

- لا Migration متوقعة؛ backend المتوافق ينشر قبل frontend.
- يمكن تعطيل composition Elegant والعودة إلى Legacy Elegant Hero دون حذف القصص أو مربعات الاكتشاف.
- frontend القديم لا ينشر إلا مع backend يحمي الحقول الممتلئة من old-client omission.
- لا تُحذف منتجات أو أصول أو طلبات عند rollback.
- rollback الكامل إلى backend غير واعٍ بالعقد يحتاج تصدير/قرارًا موثقًا، وليس downgrade صامتًا.
