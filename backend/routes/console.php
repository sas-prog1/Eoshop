<?php

use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment('Mobtaker E-Commerce Platform Ready.');
})->purpose('Display inspiration quote');

Schedule::command('catalog:prune-media')
    ->dailyAt('02:30')
    ->withoutOverlapping();

Schedule::command('store-assets:prune')
    ->dailyAt('02:45')
    ->withoutOverlapping();

Schedule::command('inventory:expire-reservations')
    ->everyMinute()
    ->withoutOverlapping();

Schedule::command('orders:expire')
    ->everyMinute()
    ->withoutOverlapping();
