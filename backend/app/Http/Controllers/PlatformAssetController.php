<?php

namespace App\Http\Controllers;

use App\Services\PlatformAssetService;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\StreamedResponse;

class PlatformAssetController extends Controller
{
    public function show(Request $request, string $asset, PlatformAssetService $service): StreamedResponse
    {
        return $service->response($asset);
    }
}
