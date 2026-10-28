<?php

namespace App\Database;

use CodeIgniter\Database\RawSql;

/**
 * Column definitions shared by the migrations, matching what the Node (knex) migrations created,
 * so both produce the same schema.
 */
trait MigrationHelpers
{
    /**
     * @return array<string, mixed>
     */
    private static function id(): array
    {
        return ['type' => 'INT', 'unsigned' => true, 'auto_increment' => true];
    }

    /**
     * @return array<string, mixed>
     */
    private static function foreignId(bool $null = false): array
    {
        return ['type' => 'INT', 'unsigned' => true, 'null' => $null];
    }

    /**
     * @return array<string, mixed>
     */
    private static function string(int $length, bool $null = false): array
    {
        return ['type' => 'VARCHAR', 'constraint' => $length, 'null' => $null];
    }

    /**
     * @return array<string, mixed>
     */
    private static function decimal(string $precision, ?float $default = null): array
    {
        return ['type' => 'DECIMAL', 'constraint' => $precision, 'null' => false] + ($default === null ? [] : ['default' => $default]);
    }

    /**
     * @return array<string, mixed>
     */
    private static function boolean(?bool $default = null): array
    {
        return ['type' => 'TINYINT', 'constraint' => 1, 'null' => false] + ($default === null ? [] : ['default' => (int) $default]);
    }

    /**
     * created_at / updated_at, filled in by MySQL.
     *
     * @return array<int|string, mixed>
     */
    private static function timestamps(): array
    {
        return [
            'created_at' => ['type' => 'TIMESTAMP', 'default' => new RawSql('CURRENT_TIMESTAMP')],
            'updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP',
        ];
    }
}
