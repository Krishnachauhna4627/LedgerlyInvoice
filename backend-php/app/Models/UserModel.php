<?php

namespace App\Models;

use CodeIgniter\Model;

class UserModel extends Model
{
    protected $table         = 'users';
    protected $returnType    = 'array';
    protected $allowedFields = ['company_id', 'name', 'username', 'email', 'phone', 'password_hash'];

    /**
     * The user as the API returns it (never includes password_hash), or null.
     *
     * @return array<string, mixed>|null
     */
    public function findPublic(int $id): ?array
    {
        $row = $this->db->table('users')
            ->select('users.id, users.name, users.username, users.email, users.phone, users.is_admin, users.company_id')
            ->select('companies.name AS company_name')
            ->join('companies', 'companies.id = users.company_id')
            ->where('users.id', $id)
            ->get()->getRowArray();

        return $row ? self::toPublicUser($row) : null;
    }

    /**
     * @param array<string, mixed> $row
     *
     * @return array<string, mixed>
     */
    private static function toPublicUser(array $row): array
    {
        return [
            'id'       => (int) $row['id'],
            'name'     => $row['name'],
            'username' => $row['username'],
            'email'    => $row['email'],
            'phone'    => $row['phone'],
            'isAdmin'  => (bool) $row['is_admin'],
            'company'  => ['id' => (int) $row['company_id'], 'name' => $row['company_name']],
        ];
    }
}
