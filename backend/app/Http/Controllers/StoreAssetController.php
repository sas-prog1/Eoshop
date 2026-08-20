<?php

namespace App\Http\Controllers;

use App\Models\Tenant;
use App\Services\StoreAssetService;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\StreamedResponse;

class StoreAssetController extends Controller
{
    public function show(Request $request, Tenant $tenant, string $asset, StoreAssetService $service): StreamedResponse
    {
        return $service->response($tenant, $asset, $request);
    }
}
