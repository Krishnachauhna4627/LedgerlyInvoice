-- Plain-SQL version of app/Database/Migrations/2026-11-23-120000_LinkOldPurchasesAndPaymentsToParties.php
-- for servers without SSH: run it once in phpMyAdmin (SQL tab) on the app's database.
-- Do NOT run it if 'php spark migrate' already applied this migration (check the migrations table).
-- Data only (no table changes). Running it twice does no harm: the second run finds nothing to link.
-- Names are compared with COLLATE utf8mb4_unicode_ci because clients.name and vendor_name can have different
-- collations on older databases (MySQL then refuses to compare them).

-- Purchases and payments saved before the vendor had to be picked from the parties list have only a typed
-- vendor_name and no client_id, so they show in no party ledger.

-- 1. Vendors with no party of the same name (ignoring case and surrounding spaces): add them as new parties,
--    with GSTIN / state from their latest purchase, else the business's state.
INSERT INTO `clients` (`company_id`, `name`, `gstin`, `state_code`, `opening_balance`)
SELECT u.`company_id`,
       u.`name`,
       (SELECT p.`vendor_gstin` FROM `purchases` p
         WHERE p.`company_id` = u.`company_id` AND LOWER(TRIM(p.`vendor_name`)) = LOWER(u.`name`)
         ORDER BY p.`purchase_date` DESC, p.`id` DESC LIMIT 1),
       COALESCE(
         (SELECT p.`vendor_state_code` FROM `purchases` p
           WHERE p.`company_id` = u.`company_id` AND LOWER(TRIM(p.`vendor_name`)) = LOWER(u.`name`)
           ORDER BY p.`purchase_date` DESC, p.`id` DESC LIMIT 1),
         co.`state_code`, ''),
       0
FROM (
  SELECT `company_id`, MIN(`name`) AS `name`
  FROM (
    SELECT `company_id`, TRIM(`vendor_name`) AS `name` FROM `purchases`
     WHERE `client_id` IS NULL AND TRIM(COALESCE(`vendor_name`, '')) <> ''
    UNION
    SELECT `company_id`, TRIM(`vendor_name`) AS `name` FROM `vendor_payments`
     WHERE `client_id` IS NULL AND TRIM(COALESCE(`vendor_name`, '')) <> ''
  ) AS v
  GROUP BY `company_id`, LOWER(`name`)
) AS u
JOIN `companies` co ON co.`id` = u.`company_id`
WHERE NOT EXISTS (
  SELECT 1 FROM `clients` c
   WHERE c.`company_id` = u.`company_id` AND LOWER(TRIM(c.`name`)) COLLATE utf8mb4_unicode_ci = LOWER(u.`name`)
);

-- 2. Link each unlinked purchase / payment to the party with the same name, when there is exactly one.
--    (Several parties with that name: can't tell which one, so it is left for the user to re-save.)
UPDATE `purchases` p
JOIN (
  SELECT `company_id`, LOWER(TRIM(`name`)) COLLATE utf8mb4_unicode_ci AS `lname`, MIN(`id`) AS `id`
  FROM `clients`
  GROUP BY `company_id`, `lname`
  HAVING COUNT(*) = 1
) AS c ON c.`company_id` = p.`company_id` AND c.`lname` = LOWER(TRIM(p.`vendor_name`))
SET p.`client_id` = c.`id`
WHERE p.`client_id` IS NULL;

UPDATE `vendor_payments` vp
JOIN (
  SELECT `company_id`, LOWER(TRIM(`name`)) COLLATE utf8mb4_unicode_ci AS `lname`, MIN(`id`) AS `id`
  FROM `clients`
  GROUP BY `company_id`, `lname`
  HAVING COUNT(*) = 1
) AS c ON c.`company_id` = vp.`company_id` AND c.`lname` = LOWER(TRIM(vp.`vendor_name`))
SET vp.`client_id` = c.`id`
WHERE vp.`client_id` IS NULL;

-- Record it as applied, so 'php spark migrate' won't try to run it again later.
INSERT INTO `migrations` (`version`, `class`, `group`, `namespace`, `time`, `batch`)
SELECT '2026-11-23-120000', 'App\\Database\\Migrations\\LinkOldPurchasesAndPaymentsToParties', 'default', 'App',
       UNIX_TIMESTAMP(), m.`next_batch`
FROM (SELECT COALESCE(MAX(`batch`), 0) + 1 AS `next_batch` FROM `migrations`) AS m
WHERE NOT EXISTS (SELECT 1 FROM `migrations` WHERE `version` = '2026-11-23-120000');
