<?php

return [
    'disk' => env('STORE_APPLICATION_DISK', 'local'),
    'max_document_bytes' => 5 * 1024 * 1024,
    'allowed_mime_types' => [
        'application/pdf' => 'pdf',
        'image/jpeg' => 'jpg',
        'image/png' => 'png',
    ],
    'regulated_business_patterns' => [
        'food', 'restaurant', 'cafe', 'pharmacy', 'medical', 'health',
        'غذ', 'مطعم', 'مقهى', 'صيدل', 'طب', 'صح',
    ],
];
