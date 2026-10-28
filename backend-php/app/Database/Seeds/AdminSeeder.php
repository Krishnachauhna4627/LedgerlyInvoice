<?php

namespace App\Database\Seeds;

use CodeIgniter\Database\Seeder;
use RuntimeException;

/**
 * The super user (php spark db:seed AdminSeeder). Safe to run more than once: an existing admin account
 * is left as it is. Change this password after the first login on any shared or production database.
 */
class AdminSeeder extends Seeder
{
    private const ADMIN = ['username' => 'admin', 'password' => 'admin123', 'name' => 'Administrator', 'company' => 'Ledgerly Admin'];

    public function run()
    {
        $existing = $this->db->table('users')->select('id, is_admin')->where('username', self::ADMIN['username'])->get()->getRowArray();
        if ($existing) {
            if (! $existing['is_admin']) {
                // Never promote someone's own "admin" signup to super user.
                throw new RuntimeException('A regular user named "' . self::ADMIN['username'] . '" already exists; rename it before seeding the admin.');
            }

            return;
        }

        $this->db->transException(true)->transStart();
        // Every user belongs to a company, so the admin gets an empty one of its own.
        $this->db->table('companies')->insert(['name' => self::ADMIN['company']]);
        $this->db->table('users')->insert([
            'company_id'    => $this->db->insertID(),
            'name'          => self::ADMIN['name'],
            'username'      => self::ADMIN['username'],
            'phone'         => '0000000000',
            'password_hash' => password_hash(self::ADMIN['password'], PASSWORD_BCRYPT, ['cost' => 12]),
            'is_admin'      => 1,
        ]);
        $this->db->transComplete();
    }
}
