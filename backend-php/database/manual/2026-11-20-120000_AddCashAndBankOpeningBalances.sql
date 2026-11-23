-- Plain-SQL version of app/Database/Migrations/2026-11-20-120000_AddCashAndBankOpeningBalances.php
-- for servers without SSH: run it once in phpMyAdmin (SQL tab) on the app's database.
-- Do NOT run it if 'php spark migrate' already applied this migration (check the migrations table).

-- Cash in hand before using the app (cash book opening balance).
ALTER TABLE `companies`
  ADD COLUMN `cash_opening_balance` DECIMAL(14,2) NOT NULL DEFAULT 0 AFTER `ifsc`;

-- Money in each bank account before using the app (bank book opening balance).
ALTER TABLE `company_bank_accounts`
  ADD COLUMN `opening_balance` DECIMAL(14,2) NOT NULL DEFAULT 0 AFTER `ifsc`;

-- Record it as applied, so 'php spark migrate' won't try to run it again later.
INSERT INTO `migrations` (`version`, `class`, `group`, `namespace`, `time`, `batch`)
SELECT '2026-11-20-120000', 'App\\Database\\Migrations\\AddCashAndBankOpeningBalances', 'default', 'App',
       UNIX_TIMESTAMP(), COALESCE(MAX(`batch`), 0) + 1
FROM `migrations`
WHERE NOT EXISTS (SELECT 1 FROM `migrations` WHERE `version` = '2026-11-20-120000');
