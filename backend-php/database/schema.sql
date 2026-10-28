-- Ledgerly Invoice database schema, for importing with phpMyAdmin on hosts without SSH.
-- Same result as `php spark migrate` (app/Database/Migrations); generated from those migrations.
-- Import into an EMPTY database. The `migrations` rows tell `php spark migrate` these are already applied.

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

CREATE TABLE IF NOT EXISTS `companies` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(150) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `address` text,
  `state_code` varchar(2) DEFAULT NULL,
  `gstin` varchar(15) DEFAULT NULL,
  `phone` varchar(20) DEFAULT NULL,
  `email` varchar(254) DEFAULT NULL,
  `bank_name` varchar(100) DEFAULT NULL,
  `account_no` varchar(34) DEFAULT NULL,
  `ifsc` varchar(11) DEFAULT NULL,
  `terms` text,
  `signature` mediumtext,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `users` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `company_id` int unsigned NOT NULL,
  `name` varchar(100) NOT NULL,
  `username` varchar(30) NOT NULL,
  `email` varchar(254) DEFAULT NULL,
  `phone` varchar(20) NOT NULL,
  `password_hash` varchar(255) NOT NULL,
  `is_admin` tinyint(1) NOT NULL DEFAULT '0',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `users_username_unique` (`username`),
  UNIQUE KEY `users_email_unique` (`email`),
  KEY `users_company_id_foreign` (`company_id`),
  CONSTRAINT `users_company_id_foreign` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `clients` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `company_id` int unsigned NOT NULL,
  `name` varchar(150) NOT NULL,
  `address` text,
  `state_code` varchar(2) NOT NULL,
  `gstin` varchar(15) DEFAULT NULL,
  `phone` varchar(20) DEFAULT NULL,
  `email` varchar(254) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `clients_company_id_name_index` (`company_id`,`name`),
  CONSTRAINT `clients_company_id_foreign` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `items` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `company_id` int unsigned NOT NULL,
  `name` varchar(200) NOT NULL,
  `hsn_sac` varchar(20) DEFAULT NULL,
  `unit` varchar(10) DEFAULT NULL,
  `unit_price` decimal(12,2) NOT NULL DEFAULT '0.00',
  `gst_rate` decimal(5,2) NOT NULL DEFAULT '18.00',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `items_company_id_name_index` (`company_id`,`name`),
  CONSTRAINT `items_company_id_foreign` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `invoices` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `company_id` int unsigned NOT NULL,
  `client_id` int unsigned DEFAULT NULL,
  `invoice_number` varchar(40) NOT NULL,
  `invoice_date` date NOT NULL,
  `due_date` date DEFAULT NULL,
  `status` enum('draft','unpaid','paid') NOT NULL DEFAULT 'unpaid',
  `paid_at` timestamp NULL DEFAULT NULL,
  `template` enum('classic','modern','minimal') NOT NULL DEFAULT 'classic',
  `reverse_charge` tinyint(1) NOT NULL DEFAULT '0',
  `irn` varchar(100) DEFAULT NULL,
  `place_of_supply_code` varchar(2) NOT NULL,
  `is_inter_state` tinyint(1) NOT NULL,
  `seller_name` varchar(150) NOT NULL,
  `seller_address` text,
  `seller_state_code` varchar(2) NOT NULL,
  `seller_gstin` varchar(15) DEFAULT NULL,
  `seller_phone` varchar(20) DEFAULT NULL,
  `seller_email` varchar(254) DEFAULT NULL,
  `seller_bank_name` varchar(100) DEFAULT NULL,
  `seller_account_no` varchar(34) DEFAULT NULL,
  `seller_ifsc` varchar(11) DEFAULT NULL,
  `seller_terms` text,
  `client_name` varchar(150) NOT NULL,
  `client_address` text,
  `client_state_code` varchar(2) NOT NULL,
  `client_gstin` varchar(15) DEFAULT NULL,
  `sub_total` decimal(14,2) NOT NULL,
  `total_cgst` decimal(14,2) NOT NULL,
  `total_sgst` decimal(14,2) NOT NULL,
  `total_igst` decimal(14,2) NOT NULL,
  `total_tax` decimal(14,2) NOT NULL,
  `grand_total` decimal(14,2) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `invoices_company_id_invoice_number_unique` (`company_id`,`invoice_number`),
  KEY `invoices_client_id_foreign` (`client_id`),
  KEY `invoices_company_id_invoice_date_index` (`company_id`,`invoice_date`),
  CONSTRAINT `invoices_client_id_foreign` FOREIGN KEY (`client_id`) REFERENCES `clients` (`id`) ON DELETE SET NULL,
  CONSTRAINT `invoices_company_id_foreign` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `invoice_items` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `invoice_id` int unsigned NOT NULL,
  `item_id` int unsigned DEFAULT NULL,
  `position` int unsigned NOT NULL,
  `description` varchar(200) NOT NULL,
  `narration` varchar(500) DEFAULT NULL,
  `hsn_sac` varchar(20) DEFAULT NULL,
  `quantity` decimal(12,3) NOT NULL,
  `unit` varchar(10) DEFAULT NULL,
  `unit_price` decimal(12,2) NOT NULL,
  `gst_rate` decimal(5,2) NOT NULL,
  `taxable_amount` decimal(14,2) NOT NULL,
  `cgst` decimal(14,2) NOT NULL,
  `sgst` decimal(14,2) NOT NULL,
  `igst` decimal(14,2) NOT NULL,
  `total_tax` decimal(14,2) NOT NULL,
  `line_total` decimal(14,2) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `invoice_items_invoice_id_foreign` (`invoice_id`),
  KEY `invoice_items_item_id_foreign` (`item_id`),
  CONSTRAINT `invoice_items_invoice_id_foreign` FOREIGN KEY (`invoice_id`) REFERENCES `invoices` (`id`) ON DELETE CASCADE,
  CONSTRAINT `invoice_items_item_id_foreign` FOREIGN KEY (`item_id`) REFERENCES `items` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `migrations` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `version` varchar(255) NOT NULL,
  `class` varchar(255) NOT NULL,
  `group` varchar(255) NOT NULL,
  `namespace` varchar(255) NOT NULL,
  `time` int NOT NULL,
  `batch` int unsigned NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `migrations` (`version`, `class`, `group`, `namespace`, `time`, `batch`) VALUES
('2026-10-20-120000', 'App\\Database\\Migrations\\CreateCompaniesTable', 'default', 'App', 1793208903, 1),
('2026-10-20-120100', 'App\\Database\\Migrations\\CreateUsersTable', 'default', 'App', 1793208903, 1),
('2026-10-20-170000', 'App\\Database\\Migrations\\AddSellerDetailsToCompanies', 'default', 'App', 1793208904, 1),
('2026-10-20-170100', 'App\\Database\\Migrations\\CreateClientsTable', 'default', 'App', 1793208904, 1),
('2026-10-20-170200', 'App\\Database\\Migrations\\CreateItemsTable', 'default', 'App', 1793208904, 1),
('2026-10-20-170300', 'App\\Database\\Migrations\\CreateInvoicesTable', 'default', 'App', 1793208904, 1),
('2026-10-20-170400', 'App\\Database\\Migrations\\CreateInvoiceItemsTable', 'default', 'App', 1793208904, 1),
('2026-10-21-162737', 'App\\Database\\Migrations\\AddEmailToUsers', 'default', 'App', 1793208904, 1),
('2026-10-21-163648', 'App\\Database\\Migrations\\AddIsAdminToUsers', 'default', 'App', 1793208904, 1),
('2026-10-23-172722', 'App\\Database\\Migrations\\AddPhoneAndEmailToClients', 'default', 'App', 1793208904, 1),
('2026-10-23-173639', 'App\\Database\\Migrations\\AddUnitToItems', 'default', 'App', 1793208904, 1),
('2026-10-23-173640', 'App\\Database\\Migrations\\AddUnitAndNarrationToInvoiceItems', 'default', 'App', 1793208904, 1),
('2026-10-23-174445', 'App\\Database\\Migrations\\AddContactAndSignatureToCompanies', 'default', 'App', 1793208904, 1),
('2026-10-23-174447', 'App\\Database\\Migrations\\AddSellerContactToInvoices', 'default', 'App', 1793208904, 1);

SET FOREIGN_KEY_CHECKS = 1;
