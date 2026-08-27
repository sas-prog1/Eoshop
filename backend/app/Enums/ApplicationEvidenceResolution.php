<?php

namespace App\Enums;

enum ApplicationEvidenceResolution: string
{
    case Uploaded = 'uploaded';
    case Exempted = 'exempted';
}
