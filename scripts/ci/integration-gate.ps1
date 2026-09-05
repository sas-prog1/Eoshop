param(
    [string]$ProjectName = 'eoshop-ci',
    [int]$Port = 18080
)

$ErrorActionPreference = 'Stop'
$repositoryRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..'))
$stackStarted = $false

function Invoke-Compose {
    param([Parameter(ValueFromRemainingArguments = $true)][string[]]$Arguments)

    & docker compose -p $ProjectName -f docker-compose.yml -f docker-compose.ci.yml @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "docker compose failed: $($Arguments -join ' ')"
    }
}

function Get-ComposeOutput {
    param([Parameter(ValueFromRemainingArguments = $true)][string[]]$Arguments)

    $output = & docker compose -p $ProjectName -f docker-compose.yml -f docker-compose.ci.yml @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "docker compose failed: $($Arguments -join ' ')"
    }

    return ($output -join "`n")
}

function Assert-HttpResponse {
    param(
        [System.Net.Http.HttpClient]$Client,
        [string]$Path,
        [int]$ExpectedStatus,
        [string]$ExpectedContentType,
        [string]$ExpectedBodyFragment = ''
    )

    $response = $Client.GetAsync($Path).GetAwaiter().GetResult()
    $body = $response.Content.ReadAsStringAsync().GetAwaiter().GetResult()
    $actualStatus = [int]$response.StatusCode
    $actualContentType = $response.Content.Headers.ContentType.MediaType

    if ($actualStatus -ne $ExpectedStatus) {
        throw "Expected HTTP $ExpectedStatus for $Path, received $actualStatus."
    }

    if ($actualContentType -ne $ExpectedContentType) {
        throw "Expected content type $ExpectedContentType for $Path, received $actualContentType."
    }

    if ($ExpectedBodyFragment -and -not $body.Contains($ExpectedBodyFragment)) {
        throw "Response body for $Path did not contain the expected marker."
    }
}

function Invoke-IdentityDatabaseTests {
    $networkName = "${ProjectName}_app"
    $qualityImage = if ($env:BACKEND_QUALITY_IMAGE) { $env:BACKEND_QUALITY_IMAGE } else { 'eoshop/backend-quality:ci' }
    $dockerArguments = @(
        'run', '--rm',
        '--network', $networkName,
        '--env', 'DB_CONNECTION=pgsql',
        '--env', 'DB_HOST=db',
        '--env', 'DB_PORT=5432',
        '--env', "DB_DATABASE=$($env:POSTGRES_DB)",
        '--env', "DB_USERNAME=$($env:POSTGRES_USER)",
        '--env', "DB_PASSWORD=$($env:POSTGRES_PASSWORD)",
        '--env', 'CACHE_STORE=database',
        '--env', 'DB_CACHE_CONNECTION=pgsql',
        '--env', 'DB_CACHE_LOCK_CONNECTION=pgsql',
        '--env', 'DB_QUEUE_CONNECTION=pgsql',
        '--env', 'QUEUE_CONNECTION=database',
        '--env', 'SESSION_DRIVER=database',
        '--env', 'SESSION_CONNECTION=pgsql',
        $qualityImage,
        'vendor/bin/phpunit', '--colors=always', '--group=database'
    )

    & docker @dockerArguments
    if ($LASTEXITCODE -ne 0) {
        throw 'Central identity database tests failed.'
    }
}

function Assert-AuthenticationBoundary {
    param([int]$Port)

    $jsonContentType = [System.Net.Http.Headers.MediaTypeHeaderValue]::new('application/json')

    $untrustedClient = [System.Net.Http.HttpClient]::new()
    $untrustedClient.BaseAddress = [Uri]"http://127.0.0.1:$Port"

    try {
        $body = [System.Net.Http.StringContent]::new('{"email":"nobody@example.com","password":"invalid-password"}')
        $body.Headers.ContentType = $jsonContentType
        $response = $untrustedClient.PostAsync('/api/auth/login', $body).GetAwaiter().GetResult()

        if ([int]$response.StatusCode -ne 419) {
            throw "Expected CSRF rejection HTTP 419 without a session token, received $([int]$response.StatusCode)."
        }
    }
    finally {
        $untrustedClient.Dispose()
    }

    $handler = [System.Net.Http.HttpClientHandler]::new()
    $handler.CookieContainer = [System.Net.CookieContainer]::new()
    $client = [System.Net.Http.HttpClient]::new($handler)
    $client.BaseAddress = [Uri]"http://127.0.0.1:$Port"

    try {
        $csrfResponse = $client.GetAsync('/api/auth/csrf').GetAwaiter().GetResult()
        $csrfPayload = $csrfResponse.Content.ReadAsStringAsync().GetAwaiter().GetResult() | ConvertFrom-Json

        if ([int]$csrfResponse.StatusCode -ne 200 -or -not $csrfPayload.csrf_token) {
            throw 'Failed to establish the authentication CSRF session.'
        }

        $anonymousCookie = @($handler.CookieContainer.GetCookies($client.BaseAddress))[0]

        if (-not $anonymousCookie) {
            throw 'CSRF bootstrap did not issue the opaque session cookie.'
        }

        $client.DefaultRequestHeaders.Add('X-CSRF-TOKEN', [string]$csrfPayload.csrf_token)
        $protectedBody = [System.Net.Http.StringContent]::new('{"description":"protected generator"}')
        $protectedBody.Headers.ContentType = $jsonContentType
        $protectedResponse = $client.PostAsync('/api/generate-store-ideas', $protectedBody).GetAwaiter().GetResult()
        if ([int]$protectedResponse.StatusCode -ne 401) {
            throw "Expected authenticated-only generator HTTP 401 for an anonymous CSRF session, received $([int]$protectedResponse.StatusCode)."
        }

        $body = [System.Net.Http.StringContent]::new('{"email":"nobody@example.com","password":"invalid-password"}')
        $body.Headers.ContentType = $jsonContentType
        $response = $client.PostAsync('/api/auth/login', $body).GetAwaiter().GetResult()

        if ([int]$response.StatusCode -ne 422) {
            throw "Expected authenticated CSRF boundary to reach credential validation HTTP 422, received $([int]$response.StatusCode)."
        }

        $registrationJson = '{"name":"WP 1.2 Live Gate","email":"wp12-live-gate@example.test","phone":"+967700000000","password":"not-a-secret","password_confirmation":"not-a-secret"}'
        $registrationBody = [System.Net.Http.StringContent]::new($registrationJson)
        $registrationBody.Headers.ContentType = $jsonContentType
        $registrationResponse = $client.PostAsync('/api/auth/register', $registrationBody).GetAwaiter().GetResult()

        if ([int]$registrationResponse.StatusCode -ne 201) {
            throw "Expected live registration HTTP 201, received $([int]$registrationResponse.StatusCode)."
        }

        $authenticatedCookie = $handler.CookieContainer.GetCookies($client.BaseAddress)[$anonymousCookie.Name]
        if (-not $authenticatedCookie -or $authenticatedCookie.Value -eq $anonymousCookie.Value) {
            throw 'Registration did not rotate the browser session identifier.'
        }

        $sessionResponse = $client.GetAsync('/api/auth/session').GetAwaiter().GetResult()
        $sessionPayload = $sessionResponse.Content.ReadAsStringAsync().GetAwaiter().GetResult()
        if ([int]$sessionResponse.StatusCode -ne 200 -or -not $sessionPayload.Contains('wp12-live-gate@example.test')) {
            throw 'The rotated live session did not restore the registered identity.'
        }

        $adminResponse = $client.GetAsync('/api/admin/stores').GetAwaiter().GetResult()
        if ([int]$adminResponse.StatusCode -ne 403) {
            throw "Expected authenticated merchant HTTP 403 at the platform boundary, received $([int]$adminResponse.StatusCode)."
        }
    }
    finally {
        $client.Dispose()
        $handler.Dispose()
    }
}

function Assert-PlatformSettingsMutationBoundary {
    param([int]$Port)

    $roleSql = @"
INSERT INTO role_user (user_id, role_id, role_scope, assigned_by, created_at, updated_at)
SELECT u.id, r.id, 'platform', u.id, now(), now()
FROM users u CROSS JOIN roles r
WHERE u.email = 'wp12-live-gate@example.test' AND r.key = 'platform_super_admin'
ON CONFLICT (user_id, role_id) DO NOTHING;
"@
    Invoke-Compose -Arguments @(
        'exec', '-T', 'db', 'psql', '-v', 'ON_ERROR_STOP=1',
        '-U', $env:POSTGRES_USER, '-d', $env:POSTGRES_DB, '-c', $roleSql
    )

    $handler = [System.Net.Http.HttpClientHandler]::new()
    $handler.CookieContainer = [System.Net.CookieContainer]::new()
    $client = [System.Net.Http.HttpClient]::new($handler)
    $client.BaseAddress = [Uri]"http://127.0.0.1:$Port"
    $jsonContentType = [System.Net.Http.Headers.MediaTypeHeaderValue]::new('application/json')

    try {
        $missingCsrf = [System.Net.Http.StringContent]::new('{}')
        $missingCsrf.Headers.ContentType = $jsonContentType
        $missingCsrfResponse = $client.PutAsync('/api/admin/platform-settings', $missingCsrf).GetAwaiter().GetResult()
        if ([int]$missingCsrfResponse.StatusCode -ne 419) {
            throw "Expected platform settings mutation HTTP 419 without CSRF, received $([int]$missingCsrfResponse.StatusCode)."
        }

        $csrfResponse = $client.GetAsync('/api/auth/csrf').GetAwaiter().GetResult()
        $csrfPayload = $csrfResponse.Content.ReadAsStringAsync().GetAwaiter().GetResult() | ConvertFrom-Json
        $client.DefaultRequestHeaders.Add('X-CSRF-TOKEN', [string]$csrfPayload.csrf_token)
        $login = [System.Net.Http.StringContent]::new('{"email":"wp12-live-gate@example.test","password":"not-a-secret"}')
        $login.Headers.ContentType = $jsonContentType
        $loginResponse = $client.PostAsync('/api/auth/login', $login).GetAwaiter().GetResult()
        if ([int]$loginResponse.StatusCode -ne 200) {
            throw "Expected platform settings gate login HTTP 200, received $([int]$loginResponse.StatusCode)."
        }

        $client.DefaultRequestHeaders.Remove('X-CSRF-TOKEN') | Out-Null
        $authenticatedCsrfResponse = $client.GetAsync('/api/auth/csrf').GetAwaiter().GetResult()
        $authenticatedCsrfPayload = $authenticatedCsrfResponse.Content.ReadAsStringAsync().GetAwaiter().GetResult() | ConvertFrom-Json
        $client.DefaultRequestHeaders.Add('X-CSRF-TOKEN', [string]$authenticatedCsrfPayload.csrf_token)

        for ($attempt = 1; $attempt -le 31; $attempt++) {
            $invalid = [System.Net.Http.StringContent]::new('{}')
            $invalid.Headers.ContentType = $jsonContentType
            $response = $client.PutAsync('/api/admin/platform-settings', $invalid).GetAwaiter().GetResult()
            $expected = if ($attempt -le 30) { 422 } else { 429 }
            if ([int]$response.StatusCode -ne $expected) {
                throw "Expected platform settings mutation HTTP $expected on attempt $attempt, received $([int]$response.StatusCode)."
            }
        }
    }
    finally {
        $client.Dispose()
        $handler.Dispose()
    }
}

function Assert-TenancyBoundary {
    param([int]$Port)

    $tenantId = 'wp21-live'
    $tenantDomain = 'wp23-live.example.test'
    $internalDomain = 'store-wp21-live.example.test'
    $hashAlgorithm = [System.Security.Cryptography.SHA256]::Create()
    try {
        $hashBytes = $hashAlgorithm.ComputeHash([System.Text.Encoding]::UTF8.GetBytes($tenantId))
    }
    finally {
        $hashAlgorithm.Dispose()
    }
    $hash = -join ($hashBytes | ForEach-Object { $_.ToString('x2') })
    $schema = "tenant_wp21_live_$($hash.Substring(0, 16))"

    $tenantSql = @"
INSERT INTO tenants (id, store_name, owner_name, owner_email, business_type, verification_status, provisioning_status, publication_status, active_at, theme_style, created_at, updated_at)
VALUES ('$tenantId', 'WP 2.3 Live Store', 'Live Owner', 'live-owner@example.test', 'retail', 'approved', 'active', 'requested', now(), 'elegant', now(), now());
INSERT INTO domains (domain, kind, tenant_id, created_at, updated_at)
VALUES ('$internalDomain', 'internal', '$tenantId', now(), now());
CREATE SCHEMA "$schema";
INSERT INTO provisioning_runs (
    id, tenant_id, status, run_number, schema_name, schema_origin, schema_created_at,
    queued_at, started_at, completed_at, created_at, updated_at
)
VALUES (
    '00000000-0000-0000-0000-000000000022', '$tenantId', 'active', 1, '$schema', 'platform_created', now(),
    now(), now(), now(), now(), now()
);
INSERT INTO tenant_subscriptions (
    id, tenant_id, plan_key, status, activation_source, starts_at, created_at, updated_at
)
VALUES (
    '00000000-0000-0000-0000-000000000023', '$tenantId', 'starter', 'active', 'automatic_free', now(), now(), now()
);
INSERT INTO domain_reservations (
    id, tenant_id, domain, handle, status, origin, reserved_at, activated_at, created_at, updated_at
)
VALUES (
    '00000000-0000-0000-0000-000000000024', '$tenantId', '$tenantDomain', 'wp23-live', 'active', 'user_selected', now(), now(), now(), now()
);
INSERT INTO publication_requests (
    id, tenant_id, domain_reservation_id, tenant_subscription_id, status, origin,
    requested_at, decided_at, published_at, created_at, updated_at
)
VALUES (
    '00000000-0000-0000-0000-000000000025', '$tenantId',
    '00000000-0000-0000-0000-000000000024', '00000000-0000-0000-0000-000000000023',
    'published', 'user_selected', now(), now(), now(), now(), now()
);
INSERT INTO domains (domain, kind, tenant_id, created_at, updated_at)
VALUES ('$tenantDomain', 'public_subdomain', '$tenantId', now(), now());
UPDATE tenants
SET publication_status = 'published', publication_requested_at = now(), published_at = now(),
    publication_request_id = '00000000-0000-0000-0000-000000000025',
    published_domain_id = (SELECT id FROM domains WHERE domain = '$tenantDomain'),
    publication_subscription_id = '00000000-0000-0000-0000-000000000023'
WHERE id = '$tenantId';
"@
    Invoke-Compose -Arguments @(
        'exec', '-T', 'db', 'psql',
        '-v', 'ON_ERROR_STOP=1',
        '-U', $env:POSTGRES_USER,
        '-d', $env:POSTGRES_DB,
        '-c', $tenantSql
    )
    Invoke-Compose exec -T backend php artisan tenants:migrate --tenants=$tenantId --force --no-interaction

    $configSql = @"
SET search_path TO "$schema";
INSERT INTO store_configs (id, config_json, products_materialized, is_current, created_at, updated_at)
VALUES (
    '00000000-0000-0000-0000-000000000021',
    json_build_object(
        'marker', 'wp21-live',
        'enableCashOnDelivery', true,
        'cashOnDeliveryFee', 0,
        'shippingFee', 0,
        'freeShippingThreshold', 0,
        'taxRate', 0,
        'minOrderAmount', 0,
        'enableCoupons', false,
        'requireEmail', false,
        'requireAddressDetails', true,
        'enableCustomerNotes', true
    ),
    true,
    true,
    now(),
    now()
);
SET session_replication_role = replica;
INSERT INTO products (
    id, name, price, base_price_minor, description, category, image_keyword, image_urls,
    stock_quantity, reserved_quantity, manage_stock, sku, low_stock_threshold, position,
    status, revision, inventory_revision, published_at, created_at, updated_at
) VALUES (
    '00000000-0000-0000-0000-000000000038', 'Scheduler fixture', 1.00, 100,
    'Scheduler expiration fixture', 'CI', 'fixture', '[]'::json, 1, 1, true,
    'SCHEDULER-1', 1, 0, 'published', 1, 2, now(), now(), now()
);
INSERT INTO inventory_operations (
    id, kind, idempotency_scope, idempotency_key, request_fingerprint, actor_type,
    source, reason_code, created_at
) VALUES
    ('00000000-0000-0000-0000-000000000031', 'opening', 'system:ci-opening',
     '00000000-0000-0000-0000-000000000031', repeat('a', 64), 'system', 'integration_gate', 'ci_opening', now() - interval '3 minutes'),
    ('00000000-0000-0000-0000-000000000032', 'reservation_create', 'system:ci-reservation',
     '00000000-0000-0000-0000-000000000032', repeat('b', 64), 'system', 'integration_gate', 'ci_reserve', now() - interval '2 minutes');
INSERT INTO inventory_reservations (
    id, status, reference_type, reference_id, expires_at, created_by_operation_id, created_at, updated_at
) VALUES (
    '00000000-0000-0000-0000-000000000037', 'active', 'ci_scheduler', 'due-fixture',
    now() - interval '30 seconds', '00000000-0000-0000-0000-000000000032',
    now() - interval '90 seconds', now() - interval '90 seconds'
);
INSERT INTO inventory_reservation_items (reservation_id, product_id, quantity)
VALUES ('00000000-0000-0000-0000-000000000037', '00000000-0000-0000-0000-000000000038', 1);
INSERT INTO inventory_movements (
    id, operation_id, product_id, reservation_id, kind, before_on_hand, before_reserved,
    on_hand_delta, reserved_delta, after_on_hand, after_reserved,
    before_inventory_revision, after_inventory_revision, created_at
) VALUES
    ('00000000-0000-0000-0000-000000000033', '00000000-0000-0000-0000-000000000031',
     '00000000-0000-0000-0000-000000000038', NULL, 'opening', 0, 0, 1, 0, 1, 0, 1, 1, now() - interval '3 minutes'),
    ('00000000-0000-0000-0000-000000000034', '00000000-0000-0000-0000-000000000032',
     '00000000-0000-0000-0000-000000000038', '00000000-0000-0000-0000-000000000037',
     'reserve', 1, 0, 0, 1, 1, 1, 1, 2, now() - interval '90 seconds');
INSERT INTO inventory_application_receipts (id, operation_id, product_id, movement_id, created_at) VALUES
    ('00000000-0000-0000-0000-000000000035', '00000000-0000-0000-0000-000000000031',
     '00000000-0000-0000-0000-000000000038', '00000000-0000-0000-0000-000000000033', now() - interval '3 minutes'),
    ('00000000-0000-0000-0000-000000000036', '00000000-0000-0000-0000-000000000032',
     '00000000-0000-0000-0000-000000000038', '00000000-0000-0000-0000-000000000034', now() - interval '90 seconds');
SET session_replication_role = origin;
"@
    Invoke-Compose -Arguments @(
        'exec', '-T', 'db', 'psql',
        '-v', 'ON_ERROR_STOP=1',
        '-U', $env:POSTGRES_USER,
        '-d', $env:POSTGRES_DB,
        '-c', $configSql
    )

    $client = [System.Net.Http.HttpClient]::new()
    $client.BaseAddress = [Uri]"http://127.0.0.1:$Port"
    $client.DefaultRequestHeaders.Host = $tenantDomain

    try {
        $configResponse = $client.GetAsync('/api/store/config').GetAwaiter().GetResult()
        $configBody = $configResponse.Content.ReadAsStringAsync().GetAwaiter().GetResult()
        if ([int]$configResponse.StatusCode -ne 200 -or -not $configBody.Contains('wp21-live')) {
            throw "Tenant Host did not resolve its isolated store configuration. Status: $([int]$configResponse.StatusCode)."
        }

        $platformSettingsResponse = $client.GetAsync('/api/platform-settings').GetAwaiter().GetResult()
        $platformSettingsBody = $platformSettingsResponse.Content.ReadAsStringAsync().GetAwaiter().GetResult()
        if ([int]$platformSettingsResponse.StatusCode -ne 200 -or -not $platformSettingsBody.Contains('platformName')) {
            throw "Published tenant Host did not receive the central safe platform settings projection. Status: $([int]$platformSettingsResponse.StatusCode)."
        }

        $adminResponse = $client.GetAsync('/api/admin/stores').GetAwaiter().GetResult()
        if ([int]$adminResponse.StatusCode -ne 404) {
            throw "Expected platform administration HTTP 404 on a tenant Host, received $([int]$adminResponse.StatusCode)."
        }

        $client.DefaultRequestHeaders.Host = 'unknown.example.test'
        $unknownResponse = $client.GetAsync('/api/auth/csrf').GetAwaiter().GetResult()
        if ([int]$unknownResponse.StatusCode -ne 404) {
            throw "Expected unknown Host authentication HTTP 404, received $([int]$unknownResponse.StatusCode)."
        }
        $unknownSettingsResponse = $client.GetAsync('/api/platform-settings').GetAwaiter().GetResult()
        if ([int]$unknownSettingsResponse.StatusCode -ne 404) {
            throw "Expected unknown Host platform settings HTTP 404, received $([int]$unknownSettingsResponse.StatusCode)."
        }
    }
    finally {
        $client.Dispose()
    }
}

function Assert-ProvisioningWorker {
    $runId = '00000000-0000-0000-0000-000000000022'
    $dispatchCode = "App\Jobs\ProvisionTenant::dispatch('$runId');"
    Invoke-Compose -Arguments @(
        'exec', '-T', 'backend', 'php', 'artisan', 'tinker', "--execute=$dispatchCode"
    )

    $queued = (Get-ComposeOutput -Arguments @(
        'exec', '-T', 'db', 'psql', '-U', $env:POSTGRES_USER, '-d', $env:POSTGRES_DB,
        '-tAc', 'SELECT count(*) FROM jobs;'
    )).Trim()
    if ($queued -ne '1') {
        throw "Expected one live provisioning job before worker startup, received $queued."
    }

    Invoke-Compose -Arguments @('up', '-d', '--no-build', 'worker')
    $deadline = [DateTime]::UtcNow.AddSeconds(45)
    do {
        Start-Sleep -Seconds 1
        $remaining = (Get-ComposeOutput -Arguments @(
            'exec', '-T', 'db', 'psql', '-U', $env:POSTGRES_USER, '-d', $env:POSTGRES_DB,
            '-tAc', 'SELECT count(*) FROM jobs;'
        )).Trim()
    } while ($remaining -ne '0' -and [DateTime]::UtcNow -lt $deadline)

    if ($remaining -ne '0') {
        Invoke-Compose logs --no-color --tail=100 worker
        throw 'The Compose provisioning worker did not consume the live database job.'
    }

    $failed = (Get-ComposeOutput -Arguments @(
        'exec', '-T', 'db', 'psql', '-U', $env:POSTGRES_USER, '-d', $env:POSTGRES_DB,
        '-tAc', 'SELECT count(*) FROM failed_jobs;'
    )).Trim()
    if ($failed -ne '0') {
        throw "The live Compose worker produced $failed failed job records."
    }
}

function Assert-InventoryHttpBoundary {
    param([int]$Port)

    $handler = [System.Net.Http.HttpClientHandler]::new()
    $handler.CookieContainer = [System.Net.CookieContainer]::new()
    $client = [System.Net.Http.HttpClient]::new($handler)
    $client.BaseAddress = [Uri]"http://127.0.0.1:$Port"
    $jsonContentType = [System.Net.Http.Headers.MediaTypeHeaderValue]::new('application/json')

    try {
        $csrfResponse = $client.GetAsync('/api/auth/csrf').GetAwaiter().GetResult()
        $csrfPayload = $csrfResponse.Content.ReadAsStringAsync().GetAwaiter().GetResult() | ConvertFrom-Json
        if ([int]$csrfResponse.StatusCode -ne 200 -or -not $csrfPayload.csrf_token) {
            throw 'Failed to establish the inventory boundary CSRF session.'
        }
        $client.DefaultRequestHeaders.Add('X-CSRF-TOKEN', [string]$csrfPayload.csrf_token)
        $registration = [System.Net.Http.StringContent]::new('{"name":"WP 4.2 Inventory Gate","email":"wp42-inventory-gate@example.test","phone":"+967700000042","password":"inventory-gate-password","password_confirmation":"inventory-gate-password"}')
        $registration.Headers.ContentType = $jsonContentType
        $registrationResponse = $client.PostAsync('/api/auth/register', $registration).GetAwaiter().GetResult()
        if ([int]$registrationResponse.StatusCode -ne 201) {
            throw "Expected WP 4.2 gate registration HTTP 201, received $([int]$registrationResponse.StatusCode)."
        }

        $client.DefaultRequestHeaders.Remove('X-CSRF-TOKEN') | Out-Null
        $authenticatedCsrfResponse = $client.GetAsync('/api/auth/csrf').GetAwaiter().GetResult()
        $authenticatedCsrfPayload = $authenticatedCsrfResponse.Content.ReadAsStringAsync().GetAwaiter().GetResult() | ConvertFrom-Json
        if ([int]$authenticatedCsrfResponse.StatusCode -ne 200 -or -not $authenticatedCsrfPayload.csrf_token) {
            throw 'Failed to refresh the inventory boundary CSRF token after session rotation.'
        }

        $membershipSql = @"
INSERT INTO tenant_user (tenant_id, user_id, role_id, role_scope, status, invited_by, joined_at, created_at, updated_at)
SELECT 'wp21-live', u.id, r.id, 'tenant', 'active', u.id, now(), now(), now()
FROM users u CROSS JOIN roles r
WHERE u.email = 'wp42-inventory-gate@example.test' AND r.key = 'merchant_owner';
"@
        Invoke-Compose -Arguments @(
            'exec', '-T', 'db', 'psql', '-v', 'ON_ERROR_STOP=1',
            '-U', $env:POSTGRES_USER, '-d', $env:POSTGRES_DB, '-c', $membershipSql
        )

        $client.DefaultRequestHeaders.Remove('X-CSRF-TOKEN') | Out-Null
        $missingCsrf = [System.Net.Http.StringContent]::new('{}')
        $missingCsrf.Headers.ContentType = $jsonContentType
        $missingCsrfResponse = $client.PostAsync('/api/merchant/stores/wp21-live/inventory/adjustments', $missingCsrf).GetAwaiter().GetResult()
        if ([int]$missingCsrfResponse.StatusCode -ne 419) {
            throw "Expected inventory mutation HTTP 419 without CSRF, received $([int]$missingCsrfResponse.StatusCode)."
        }

        $client.DefaultRequestHeaders.Add('X-CSRF-TOKEN', [string]$authenticatedCsrfPayload.csrf_token)
        for ($attempt = 1; $attempt -le 31; $attempt++) {
            $invalid = [System.Net.Http.StringContent]::new('{"reasonCode":"invalid"}')
            $invalid.Headers.ContentType = $jsonContentType
            $response = $client.PostAsync('/api/merchant/stores/wp21-live/inventory/adjustments', $invalid).GetAwaiter().GetResult()
            $expected = if ($attempt -le 30) { 422 } else { 429 }
            if ([int]$response.StatusCode -ne $expected) {
                throw "Expected inventory mutation HTTP $expected on attempt $attempt, received $([int]$response.StatusCode)."
            }
        }
    }
    finally {
        $client.Dispose()
        $handler.Dispose()
    }
}

function Assert-InventoryScheduler {
    $tenantId = 'wp21-live'
    $hashAlgorithm = [System.Security.Cryptography.SHA256]::Create()
    try {
        $hashBytes = $hashAlgorithm.ComputeHash([System.Text.Encoding]::UTF8.GetBytes($tenantId))
    }
    finally {
        $hashAlgorithm.Dispose()
    }
    $hash = -join ($hashBytes | ForEach-Object { $_.ToString('x2') })
    $schema = "tenant_wp21_live_$($hash.Substring(0, 16))"
    $stateQuery = "SELECT r.status || ':' || p.reserved_quantity FROM `"$schema`".inventory_reservations r JOIN `"$schema`".inventory_reservation_items i ON i.reservation_id = r.id JOIN `"$schema`".products p ON p.id = i.product_id WHERE r.id = '00000000-0000-0000-0000-000000000037';"

    $initial = (Get-ComposeOutput -Arguments @(
        'exec', '-T', 'db', 'psql', '-U', $env:POSTGRES_USER, '-d', $env:POSTGRES_DB,
        '-tAc', $stateQuery
    )).Trim()
    if ($initial -ne 'active:1') {
        throw "Expected a due active scheduler fixture with one held unit, received $initial."
    }

    $schedule = Get-ComposeOutput exec -T backend php artisan schedule:list --no-interaction
    if (-not $schedule.Contains('inventory:expire-reservations')) {
        throw 'The inventory expiration command is absent from Laravel schedule:list.'
    }

    Invoke-Compose -Arguments @('up', '-d', '--no-build', 'scheduler')
    $running = Get-ComposeOutput ps --status running --services
    if (-not ($running -split "`n").Contains('scheduler')) {
        throw 'The Compose scheduler service did not remain running.'
    }

    $deadline = [DateTime]::UtcNow.AddSeconds(80)
    do {
        Start-Sleep -Seconds 2
        $state = (Get-ComposeOutput -Arguments @(
            'exec', '-T', 'db', 'psql', '-U', $env:POSTGRES_USER, '-d', $env:POSTGRES_DB,
            '-tAc', $stateQuery
        )).Trim()
    } while ($state -ne 'expired:0' -and [DateTime]::UtcNow -lt $deadline)

    if ($state -ne 'expired:0') {
        Invoke-Compose logs --no-color --tail=100 scheduler
        throw "The live scheduler did not release the due reservation; final state was $state."
    }

    $systemExpiry = (Get-ComposeOutput -Arguments @(
        'exec', '-T', 'db', 'psql', '-U', $env:POSTGRES_USER, '-d', $env:POSTGRES_DB,
        '-tAc', "SELECT count(*) FROM `"$schema`".inventory_operations WHERE kind = 'reservation_expire' AND actor_type = 'system' AND actor_user_id IS NULL AND source = 'inventory_expiry';"
    )).Trim()
    if ($systemExpiry -ne '1') {
        throw "Expected one system-attributed expiry operation, received $systemExpiry."
    }
}

function Assert-OrderHttpBoundary {
    param([int]$Port)

    $tenantDomain = 'wp23-live.example.test'
    $untrustedHandler = [System.Net.Http.HttpClientHandler]::new()
    $untrustedClient = [System.Net.Http.HttpClient]::new($untrustedHandler)
    $untrustedClient.BaseAddress = [Uri]"http://127.0.0.1:$Port"
    $untrustedClient.DefaultRequestHeaders.Host = $tenantDomain
    $untrustedContent = [System.Net.Http.StringContent]::new('{}')
    $untrustedContent.Headers.ContentType = [System.Net.Http.Headers.MediaTypeHeaderValue]::new('application/json')
    try {
        $untrustedResponse = $untrustedClient.PostAsync('/api/store/orders', $untrustedContent).GetAwaiter().GetResult()
        if ([int]$untrustedResponse.StatusCode -ne 419) {
            throw "Expected public order HTTP 419 without CSRF, received $([int]$untrustedResponse.StatusCode)."
        }
    }
    finally {
        $untrustedClient.Dispose()
        $untrustedHandler.Dispose()
    }

    $handler = [System.Net.Http.HttpClientHandler]::new()
    $handler.CookieContainer = [System.Net.CookieContainer]::new()
    $client = [System.Net.Http.HttpClient]::new($handler)
    $client.BaseAddress = [Uri]"http://127.0.0.1:$Port"
    $client.DefaultRequestHeaders.Host = $tenantDomain
    $jsonContentType = [System.Net.Http.Headers.MediaTypeHeaderValue]::new('application/json')

    try {
        $csrfResponse = $client.GetAsync('/api/auth/csrf').GetAwaiter().GetResult()
        $csrfPayload = $csrfResponse.Content.ReadAsStringAsync().GetAwaiter().GetResult() | ConvertFrom-Json
        if ([int]$csrfResponse.StatusCode -ne 200 -or -not $csrfPayload.csrf_token) {
            throw 'Failed to establish the public order CSRF session on the published tenant Host.'
        }

        $configResponse = $client.GetAsync('/api/store/config').GetAwaiter().GetResult()
        $configPayload = $configResponse.Content.ReadAsStringAsync().GetAwaiter().GetResult() | ConvertFrom-Json
        if ([int]$configResponse.StatusCode -ne 200) {
            throw "Expected published storefront HTTP 200 before checkout, received $([int]$configResponse.StatusCode)."
        }

        $idempotencyKey = '00000000-0000-4000-8000-000000000043'
        $requestId = '00000000-0000-4000-8000-000000000044'
        $orderBody = @{
            workspaceRevision = [int]$configPayload.data.workspaceRevision
            catalogRevision = [int]$configPayload.data.catalogRevision
            lines = @(@{ productId = '00000000-0000-0000-0000-000000000038'; quantity = 1 })
            payment = @{ method = 'cod'; channelId = $null; reference = $null }
            customer = @{ name = 'WP 4.3 Live Shopper'; phone = '+967700000043'; email = $null; notes = $null }
            address = @{ city = 'Sanaa'; area = 'Old City'; street = $null; details = 'Integration gate address' }
        } | ConvertTo-Json -Depth 6 -Compress

        $client.DefaultRequestHeaders.Add('X-CSRF-TOKEN', [string]$csrfPayload.csrf_token)
        $client.DefaultRequestHeaders.Add('Idempotency-Key', $idempotencyKey)
        $client.DefaultRequestHeaders.Add('X-Request-ID', $requestId)

        $createContent = [System.Net.Http.StringContent]::new($orderBody)
        $createContent.Headers.ContentType = $jsonContentType
        $createResponse = $client.PostAsync('/api/store/orders', $createContent).GetAwaiter().GetResult()
        $createPayload = $createResponse.Content.ReadAsStringAsync().GetAwaiter().GetResult() | ConvertFrom-Json
        if ([int]$createResponse.StatusCode -ne 201 -or $createPayload.data.replayed -ne $false -or [int]$createPayload.data.order.totals.grandTotalMinor -ne 100) {
            throw "The live authoritative order was not created with server totals. Status: $([int]$createResponse.StatusCode)."
        }

        $replayContent = [System.Net.Http.StringContent]::new($orderBody)
        $replayContent.Headers.ContentType = $jsonContentType
        $replayResponse = $client.PostAsync('/api/store/orders', $replayContent).GetAwaiter().GetResult()
        $replayPayload = $replayResponse.Content.ReadAsStringAsync().GetAwaiter().GetResult() | ConvertFrom-Json
        if ([int]$replayResponse.StatusCode -ne 201 -or $replayPayload.data.replayed -ne $true -or $replayPayload.data.order.id -ne $createPayload.data.order.id) {
            throw "The live order idempotency replay did not return the original receipt. Status: $([int]$replayResponse.StatusCode)."
        }

        for ($attempt = 1; $attempt -le 9; $attempt++) {
            $invalidContent = [System.Net.Http.StringContent]::new('{}')
            $invalidContent.Headers.ContentType = $jsonContentType
            $invalidResponse = $client.PostAsync('/api/store/orders', $invalidContent).GetAwaiter().GetResult()
            $expected = if ($attempt -le 8) { 422 } else { 429 }
            if ([int]$invalidResponse.StatusCode -ne $expected) {
                throw "Expected public order throttle attempt $attempt to return HTTP $expected, received $([int]$invalidResponse.StatusCode)."
            }
        }

        $tenantId = 'wp21-live'
        $hashAlgorithm = [System.Security.Cryptography.SHA256]::Create()
        try {
            $hashBytes = $hashAlgorithm.ComputeHash([System.Text.Encoding]::UTF8.GetBytes($tenantId))
        }
        finally {
            $hashAlgorithm.Dispose()
        }
        $hash = -join ($hashBytes | ForEach-Object { $_.ToString('x2') })
        $schema = "tenant_wp21_live_$($hash.Substring(0, 16))"
        $persisted = (Get-ComposeOutput -Arguments @(
            'exec', '-T', 'db', 'psql', '-U', $env:POSTGRES_USER, '-d', $env:POSTGRES_DB,
            '-tAc', "SELECT (SELECT count(*) FROM `"$schema`".orders)::text || ':' || (SELECT reserved_quantity FROM `"$schema`".products WHERE id = '00000000-0000-0000-0000-000000000038')::text;"
        )).Trim()
        if ($persisted -ne '1:1') {
            throw "Expected one durable order with one reserved unit after replay, received $persisted."
        }
    }
    finally {
        $client.Dispose()
        $handler.Dispose()
    }
}

Push-Location $repositoryRoot

try {
    $env:POSTGRES_DB = 'eoshop_ci'
    $env:POSTGRES_USER = 'eoshop_ci'
    $env:POSTGRES_PASSWORD = 'ci-only-not-a-production-secret'
    $env:APP_KEY = 'base64:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA='
    $env:APP_PORT = $Port.ToString()
    if (-not $env:BACKEND_IMAGE) { $env:BACKEND_IMAGE = 'eoshop/backend:ci' }
    if (-not $env:WEB_IMAGE) { $env:WEB_IMAGE = 'eoshop/web:ci' }

    Invoke-Compose config --quiet
    # Mark the project for cleanup before starting so partially-created stacks
    # are removed as well when `up --wait` fails.
    $stackStarted = $true
    # Keep the provisioning worker stopped while schema lifecycle and queue
    # assertions run; otherwise it can consume test jobs and make the gate flaky.
    Invoke-Compose up -d --no-build --wait --wait-timeout 240 db backend web

    Invoke-Compose exec -T backend php artisan migrate --path=database/migrations/system --force --no-interaction
    Invoke-Compose exec -T backend php artisan db:seed --class=Database\Seeders\IdentitySeeder --force --no-interaction
    Invoke-IdentityDatabaseTests

    $adoptionTenantId = 'wp21-adopt'
    $adoptionHashAlgorithm = [System.Security.Cryptography.SHA256]::Create()
    try {
        $adoptionHashBytes = $adoptionHashAlgorithm.ComputeHash([System.Text.Encoding]::UTF8.GetBytes($adoptionTenantId))
    }
    finally {
        $adoptionHashAlgorithm.Dispose()
    }
    $adoptionHash = -join ($adoptionHashBytes | ForEach-Object { $_.ToString('x2') })
    $adoptionSchema = "tenant_wp21_adopt_$($adoptionHash.Substring(0, 16))"
    $adoptionSql = @"
INSERT INTO tenants (id, store_name, owner_name, owner_email, business_type, verification_status, provisioning_status, theme_style, created_at, updated_at)
VALUES ('$adoptionTenantId', 'WP 2.1 Adoption Store', 'Adoption Owner', 'adoption-owner@example.test', 'retail', 'approved', 'not_started', 'elegant', now(), now());
INSERT INTO domains (domain, tenant_id, created_at, updated_at)
VALUES ('wp21-adopt.example.test', '$adoptionTenantId', now(), now());
CREATE SCHEMA "$adoptionSchema";
"@
    Invoke-Compose -Arguments @(
        'exec', '-T', 'db', 'psql', '-v', 'ON_ERROR_STOP=1',
        '-U', $env:POSTGRES_USER, '-d', $env:POSTGRES_DB, '-c', $adoptionSql
    )
    Invoke-Compose exec -T backend php artisan tenants:migrate --tenants=$adoptionTenantId --force --no-interaction
    $adoptionConfigSql = @"
SET search_path TO "$adoptionSchema";
INSERT INTO store_configs (id, config_json, products_materialized, is_current, created_at, updated_at)
VALUES ('00000000-0000-0000-0000-000000000020', json_build_object('marker', 'wp21-adopted'), true, true, now(), now());
"@
    Invoke-Compose -Arguments @(
        'exec', '-T', 'db', 'psql', '-v', 'ON_ERROR_STOP=1',
        '-U', $env:POSTGRES_USER, '-d', $env:POSTGRES_DB, '-c', $adoptionConfigSql
    )

    $incompleteTenantId = 'wp21-incomplete'
    $incompleteHashAlgorithm = [System.Security.Cryptography.SHA256]::Create()
    try {
        $incompleteHashBytes = $incompleteHashAlgorithm.ComputeHash([System.Text.Encoding]::UTF8.GetBytes($incompleteTenantId))
    }
    finally {
        $incompleteHashAlgorithm.Dispose()
    }
    $incompleteHash = -join ($incompleteHashBytes | ForEach-Object { $_.ToString('x2') })
    $incompleteSchema = "tenant_wp21_incomplete_$($incompleteHash.Substring(0, 16))"
    $longLegacyLabel = 'l' * 55
    $incompleteSql = @"
INSERT INTO tenants (id, store_name, owner_name, owner_email, business_type, verification_status, provisioning_status, theme_style, created_at, updated_at)
VALUES ('$incompleteTenantId', 'Incomplete WP 2.1 Store', 'Incomplete Owner', 'incomplete-owner@example.test', 'retail', 'approved', 'not_started', 'elegant', now(), now());
INSERT INTO domains (domain, tenant_id, created_at, updated_at)
VALUES ('wp21-incomplete.example.test', '$incompleteTenantId', now(), now());
CREATE SCHEMA "$incompleteSchema";
INSERT INTO tenants (id, store_name, owner_name, owner_email, business_type, verification_status, provisioning_status, theme_style, created_at, updated_at)
VALUES ('wp21-rejected', 'Rejected WP 2.1 Store', 'Rejected Owner', 'rejected-owner@example.test', 'retail', 'rejected', 'not_started', 'elegant', now(), now());
INSERT INTO domains (domain, tenant_id, created_at, updated_at)
VALUES ('x.example.test', 'wp21-rejected', now(), now());
INSERT INTO tenants (id, store_name, owner_name, owner_email, business_type, verification_status, provisioning_status, theme_style, created_at, updated_at)
VALUES ('wp21-long-label', 'Long Label WP 2.1 Store', 'Long Label Owner', 'long-label-owner@example.test', 'retail', 'pending', 'not_started', 'elegant', now(), now());
INSERT INTO domains (domain, tenant_id, created_at, updated_at)
VALUES ('$longLegacyLabel.example.test', 'wp21-long-label', now(), now());
"@
    Invoke-Compose -Arguments @(
        'exec', '-T', 'db', 'psql', '-v', 'ON_ERROR_STOP=1',
        '-U', $env:POSTGRES_USER, '-d', $env:POSTGRES_DB, '-c', $incompleteSql
    )

    $authMigration = 'database/migrations/system/2026_08_12_000004_create_authentication_state_tables.php'
    $identityMigration = 'database/migrations/system/2026_08_12_000003_create_central_identity_tables.php'
    $authorizationMigration = 'database/migrations/system/2026_08_13_000005_harden_tenant_verification_status.php'
    $tenancyMigration = 'database/migrations/system/2026_08_14_000006_enforce_canonical_tenant_domains.php'
    $provisioningMigration = 'database/migrations/system/2026_08_14_000007_create_tenant_provisioning_lifecycle.php'
    $publicationMigration = 'database/migrations/system/2026_08_15_000008_create_domain_subscription_publication_lifecycle.php'
    $inventoryPermissionsMigration = 'database/migrations/system/2026_08_16_000009_add_inventory_permissions.php'
    $draftLifecycleMigration = 'database/migrations/system/2026_08_19_000010_create_store_drafts_and_merchant_publication.php'
    $sessionGenerationMigration = 'database/migrations/system/2026_08_21_000011_add_session_generation_to_users.php'
    $platformSettingsMigration = 'database/migrations/system/2026_08_22_000012_create_platform_settings.php'
    $guidedOnboardingMigration = 'database/migrations/system/2026_08_23_000013_add_guided_account_and_onboarding.php'
    $applicationDossierMigration = 'database/migrations/system/2026_08_27_000014_create_store_application_dossiers.php'
    $platformVisualIdentityMigration = 'database/migrations/system/2026_08_28_000015_add_platform_visual_identity.php'
    $platformAssetsMigration = 'database/migrations/system/2026_09_02_000016_create_platform_assets.php'
    Invoke-Compose exec -T backend php artisan migrate:rollback --path=$platformAssetsMigration --force --no-interaction
    Invoke-Compose exec -T backend php artisan migrate:rollback --path=$platformVisualIdentityMigration --force --no-interaction
    Invoke-Compose exec -T backend php artisan migrate:rollback --path=$applicationDossierMigration --force --no-interaction
    Invoke-Compose exec -T backend php artisan migrate:rollback --path=$guidedOnboardingMigration --force --no-interaction
    Invoke-Compose exec -T backend php artisan migrate:rollback --path=$platformSettingsMigration --force --no-interaction
    Invoke-Compose exec -T backend php artisan migrate:rollback --path=$sessionGenerationMigration --force --no-interaction
    Invoke-Compose exec -T backend php artisan migrate:rollback --path=$draftLifecycleMigration --force --no-interaction
    Invoke-Compose exec -T backend php artisan migrate:rollback --path=$inventoryPermissionsMigration --force --no-interaction
    Invoke-Compose exec -T backend php artisan migrate:rollback --path=$publicationMigration --force --no-interaction
    Invoke-Compose exec -T backend php artisan migrate:rollback --path=$provisioningMigration --force --no-interaction
    Invoke-Compose exec -T backend php artisan migrate:rollback --path=$tenancyMigration --force --no-interaction
    Invoke-Compose exec -T backend php artisan migrate:rollback --path=$authorizationMigration --force --no-interaction
    Invoke-Compose exec -T backend php artisan migrate:rollback --path=$authMigration --force --no-interaction
    Invoke-Compose exec -T backend php artisan migrate:rollback --path=$identityMigration --force --no-interaction
    Invoke-Compose exec -T backend php artisan migrate --path=$identityMigration --force --no-interaction
    Invoke-Compose exec -T backend php artisan migrate --path=$authMigration --force --no-interaction
    Invoke-Compose exec -T backend php artisan migrate --path=$authorizationMigration --force --no-interaction
    Invoke-Compose exec -T backend php artisan migrate --path=$tenancyMigration --force --no-interaction
    Invoke-Compose exec -T backend php artisan migrate --path=$provisioningMigration --force --no-interaction
    Invoke-Compose exec -T backend php artisan migrate --path=$publicationMigration --force --no-interaction
    Invoke-Compose exec -T backend php artisan migrate --path=$inventoryPermissionsMigration --force --no-interaction
    Invoke-Compose exec -T backend php artisan db:seed --class=Database\Seeders\IdentitySeeder --force --no-interaction
    $draftAdoptionUserId = '01J00000000000000000000055'
    $draftAdoptionSql = @"
INSERT INTO users (id, name, email, password, status, created_at, updated_at)
VALUES ('$draftAdoptionUserId', 'WP 5.5 Adoption Owner', 'wp55-adoption-owner@example.test', NULL, 'active', now(), now());
INSERT INTO store_submissions (tenant_id, submitted_by_user_id, idempotency_key, request_fingerprint, payload_snapshot, initial_config_id, submitted_at)
VALUES (
  '$adoptionTenantId',
  '$draftAdoptionUserId',
  '00000000-0000-4000-8000-000000000055',
  repeat('a', 64),
  json_build_object(
    'storeName', 'WP 5.5 Adopted Draft',
    'businessType', 'retail',
    'themeStyle', 'elegant',
    'handle', 'wp21-adopt',
    'planKey', 'starter',
    'config', json_build_object('storeName', 'WP 5.5 Adopted Draft', 'products', json_build_array())
  ),
  '00000000-0000-4000-8000-000000000056',
  now()
);
"@
    Invoke-Compose -Arguments @(
        'exec', '-T', 'db', 'psql', '-v', 'ON_ERROR_STOP=1',
        '-U', $env:POSTGRES_USER, '-d', $env:POSTGRES_DB, '-c', $draftAdoptionSql
    )
    Invoke-Compose exec -T backend php artisan migrate --path=$draftLifecycleMigration --force --no-interaction
    Invoke-Compose exec -T backend php artisan migrate --path=$sessionGenerationMigration --force --no-interaction
    Invoke-Compose exec -T backend php artisan migrate --path=$platformSettingsMigration --force --no-interaction
    Invoke-Compose -Arguments @(
        'exec', '-T', 'db', 'psql', '-v', 'ON_ERROR_STOP=1',
        '-U', $env:POSTGRES_USER, '-d', $env:POSTGRES_DB,
        '-c', "UPDATE plans SET features = to_json(to_json(features::text)::text) WHERE key = 'starter';"
    )
    Invoke-Compose exec -T backend php artisan migrate --path=$guidedOnboardingMigration --force --no-interaction
    Invoke-Compose exec -T backend php artisan db:seed --class=Database\Seeders\IdentitySeeder --force --no-interaction
    $draftAdoptionResult = (Get-ComposeOutput -Arguments @(
        'exec', '-T', 'db', 'psql', '-U', $env:POSTGRES_USER, '-d', $env:POSTGRES_DB,
        '-tAc', "SELECT d.status || ':' || d.revision::text || ':' || s.revision::text || ':' || d.store_name FROM store_submissions s JOIN store_drafts d ON d.id = s.store_draft_id WHERE s.tenant_id = '$adoptionTenantId';"
    )).Trim()
    if ($draftAdoptionResult -ne 'submitted:1:1:WP 5.5 Adopted Draft') {
        throw "WP 5.5 server-draft adoption failed. Received: $draftAdoptionResult"
    }
    $guidedAdoptionResult = (Get-ComposeOutput -Arguments @(
        'exec', '-T', 'db', 'psql', '-U', $env:POSTGRES_USER, '-d', $env:POSTGRES_DB,
        '-tAc', "SELECT d.onboarding_stage || ':' || d.onboarding_stage_baseline || ':' || u.profile_revision::text || ':' || json_typeof(p.features) FROM store_submissions s JOIN store_drafts d ON d.id = s.store_draft_id JOIN users u ON u.id = s.submitted_by_user_id JOIN plans p ON p.key = 'starter' WHERE s.tenant_id = '$adoptionTenantId';"
    )).Trim()
    if ($guidedAdoptionResult -ne 'review:review:1:array') {
        throw "WP 5.13 onboarding/profile/plan adoption failed. Received: $guidedAdoptionResult"
    }
    Invoke-Compose -Arguments @(
        'exec', '-T', 'db', 'psql', '-v', 'ON_ERROR_STOP=1',
        '-U', $env:POSTGRES_USER, '-d', $env:POSTGRES_DB,
        '-c', "UPDATE users SET profile_revision = 2 WHERE id = '$draftAdoptionUserId';"
    )
    $guidedRollbackRefused = $false
    try {
        Invoke-Compose exec -T backend php artisan migrate:rollback --path=$guidedOnboardingMigration --force --no-interaction
    }
    catch {
        $guidedRollbackRefused = $true
    }
    if (-not $guidedRollbackRefused) {
        throw 'WP 5.13 destructive rollback was not refused after profile progress.'
    }
    Invoke-Compose -Arguments @(
        'exec', '-T', 'db', 'psql', '-v', 'ON_ERROR_STOP=1',
        '-U', $env:POSTGRES_USER, '-d', $env:POSTGRES_DB,
        '-c', "UPDATE users SET profile_revision = 1 WHERE id = '$draftAdoptionUserId';"
    )
    Invoke-Compose exec -T backend php artisan migrate --path=$applicationDossierMigration --force --no-interaction
    Invoke-Compose exec -T backend php artisan migrate --path=$platformVisualIdentityMigration --force --no-interaction
    Invoke-Compose exec -T backend php artisan migrate --path=$platformAssetsMigration --force --no-interaction
    $adoptionResult = (Get-ComposeOutput -Arguments @(
        'exec', '-T', 'db', 'psql', '-U', $env:POSTGRES_USER, '-d', $env:POSTGRES_DB,
        '-tAc', "SELECT t.provisioning_status || ':' || r.schema_origin FROM tenants t JOIN provisioning_runs r ON r.tenant_id = t.id WHERE t.id = '$adoptionTenantId';"
    )).Trim()
    if ($adoptionResult -ne 'active:wp21_adopted') {
        throw "WP 2.1 schema adoption failed. Received: $adoptionResult"
    }
    $publicationAdoptionResult = (Get-ComposeOutput -Arguments @(
        'exec', '-T', 'db', 'psql', '-U', $env:POSTGRES_USER, '-d', $env:POSTGRES_DB,
        '-tAc', "SELECT publication_status || ':' || count(publication_request_id)::text FROM tenants WHERE id = '$adoptionTenantId' GROUP BY publication_status;"
    )).Trim()
    if ($publicationAdoptionResult -ne 'published:1') {
        throw "WP 2.3 publication adoption failed. Received: $publicationAdoptionResult"
    }
    $incompleteResult = (Get-ComposeOutput -Arguments @(
        'exec', '-T', 'db', 'psql', '-U', $env:POSTGRES_USER, '-d', $env:POSTGRES_DB,
        '-tAc', "SELECT t.provisioning_status || ':' || count(r.id)::text FROM tenants t LEFT JOIN provisioning_runs r ON r.tenant_id = t.id WHERE t.id = '$incompleteTenantId' GROUP BY t.provisioning_status;"
    )).Trim()
    if ($incompleteResult -ne 'not_started:0') {
        throw "Incomplete WP 2.1 schema did not remain fail-closed. Received: $incompleteResult"
    }
    $legacyDomainAdoptionResult = (Get-ComposeOutput -Arguments @(
        'exec', '-T', 'db', 'psql', '-U', $env:POSTGRES_USER, '-d', $env:POSTGRES_DB,
        '-tAc', "SELECT string_agg(tenant_id || ':' || char_length(handle)::text, ',' ORDER BY tenant_id) FROM domain_reservations WHERE tenant_id IN ('wp21-long-label', 'wp21-rejected');"
    )).Trim()
    if ($legacyDomainAdoptionResult -ne 'wp21-long-label:55,wp21-rejected:1') {
        throw "WP 2.3 did not preserve legacy DNS-label lengths. Received: $legacyDomainAdoptionResult"
    }
    $rejectedAdoptionResult = (Get-ComposeOutput -Arguments @(
        'exec', '-T', 'db', 'psql', '-U', $env:POSTGRES_USER, '-d', $env:POSTGRES_DB,
        '-tAc', "SELECT t.publication_status || ':' || p.status || ':' || count(*) FILTER (WHERE open_request.status = 'requested')::text FROM tenants t JOIN publication_requests p ON p.id = t.publication_request_id LEFT JOIN publication_requests open_request ON open_request.tenant_id = t.id WHERE t.id = 'wp21-rejected' GROUP BY t.publication_status, p.status;"
    )).Trim()
    if ($rejectedAdoptionResult -ne 'rejected:rejected:0') {
        throw "Rejected WP 2.1 tenant adoption left an open publication request. Received: $rejectedAdoptionResult"
    }
    Invoke-Compose exec -T backend php artisan migrate:status --path=database/migrations/system --no-interaction
    Invoke-Compose exec -T backend php artisan route:cache --no-interaction
    $tenantRoutes = Get-ComposeOutput exec -T backend php artisan route:list --path=api/store/config --json --no-interaction | ConvertFrom-Json
    if (@($tenantRoutes).Count -ne 1) {
        throw "Expected exactly one read-only cached tenant store-config route, received $(@($tenantRoutes).Count)."
    }
    Invoke-Compose exec -T backend php artisan route:clear --no-interaction

    Add-Type -AssemblyName System.Net.Http
    $client = [System.Net.Http.HttpClient]::new()
    $client.BaseAddress = [Uri]"http://127.0.0.1:$Port"
    $client.Timeout = [TimeSpan]::FromSeconds(30)

    try {
        Assert-HttpResponse $client '/' 200 'text/html' 'id="root"'
        Assert-HttpResponse $client '/up' 200 'text/html'
        Assert-HttpResponse $client '/api/does-not-exist' 404 'application/json'
        Assert-HttpResponse $client '/api/auth/session' 200 'application/json' '"data":null'
        Assert-HttpResponse $client '/api/admin/stores' 401 'application/json'
        Assert-AuthenticationBoundary -Port $Port
        Assert-PlatformSettingsMutationBoundary -Port $Port
        Assert-TenancyBoundary -Port $Port
        Assert-InventoryHttpBoundary -Port $Port
        Assert-InventoryScheduler
        Assert-OrderHttpBoundary -Port $Port
        Assert-ProvisioningWorker
    }
    finally {
        $client.Dispose()
    }

    Write-Output 'Container integration gate passed.'
}
finally {
    if ($stackStarted) {
        & docker compose -p $ProjectName -f docker-compose.yml -f docker-compose.ci.yml down --volumes --remove-orphans
    }
    Pop-Location
}
