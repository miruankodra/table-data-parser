<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class AdminUserSeeder extends Seeder
{
    public function run(): void
    {
        $email    = env('SEED_ADMIN_EMAIL', 'admin@example.com');
        $password = env('SEED_ADMIN_PASSWORD', 'password');

        $user = User::firstOrNew(['email' => $email]);

        // forceFill: email_verified_at isn't mass-assignable, and strict mode would throw
        $user->forceFill([
            'name'              => 'Admin',
            'password'          => Hash::make($password),
            'email_verified_at' => now(),   // the `verified` middleware would otherwise redirect away
        ])->save();
    }
}