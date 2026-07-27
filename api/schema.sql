CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  password VARCHAR(255) NULL,
  name VARCHAR(255) NOT NULL,
  avatar TEXT NULL,
  google_id VARCHAR(255) NULL UNIQUE,
  plan VARCHAR(32) NOT NULL DEFAULT 'free',
  pro_until DATETIME NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS friends (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  name VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_friend_user_name (user_id, name),
  INDEX idx_friends_user_id (user_id),
  CONSTRAINT fk_friends_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `groups` (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  name VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_groups_user_id (user_id),
  CONSTRAINT fk_groups_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS group_members (
  group_id INT NOT NULL,
  friend_name VARCHAR(255) NOT NULL,
  PRIMARY KEY (group_id, friend_name),
  CONSTRAINT fk_group_members_group FOREIGN KEY (group_id) REFERENCES `groups`(id) ON DELETE CASCADE
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS rounds (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  name VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  closed_at DATETIME NULL,
  INDEX idx_rounds_user_created (user_id, created_at),
  CONSTRAINT fk_rounds_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS round_members (
  round_id INT NOT NULL,
  friend_name VARCHAR(255) NOT NULL,
  PRIMARY KEY (round_id, friend_name),
  CONSTRAINT fk_round_members_round FOREIGN KEY (round_id) REFERENCES rounds(id) ON DELETE CASCADE
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  round_id INT NOT NULL,
  name VARCHAR(255) NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_items_round_id (round_id),
  CONSTRAINT fk_items_round FOREIGN KEY (round_id) REFERENCES rounds(id) ON DELETE CASCADE
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS item_splits (
  item_id INT NOT NULL,
  friend_name VARCHAR(255) NOT NULL,
  PRIMARY KEY (item_id, friend_name),
  CONSTRAINT fk_item_splits_item FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS payment_info (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  friend_name VARCHAR(255) NOT NULL,
  bank_name VARCHAR(255) NULL,
  account_number VARCHAR(255) NULL,
  promptpay VARCHAR(255) NULL,
  display_name VARCHAR(255) NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_payment_user_friend (user_id, friend_name),
  CONSTRAINT fk_payment_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS dues (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  created_by_user_id INT NULL,
  debtor_user_id INT NULL,
  created_by_telegram_id VARCHAR(64) NULL,
  created_by_name VARCHAR(255) NULL,
  person_name VARCHAR(255) NOT NULL,
  creditor_name VARCHAR(255) NULL,
  title VARCHAR(255) NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  due_month CHAR(7) NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'unpaid',
  note TEXT NULL,
  source VARCHAR(32) NOT NULL DEFAULT 'web',
  approval_status VARCHAR(32) NOT NULL DEFAULT 'approved',
  telegram_chat_id VARCHAR(64) NULL,
  telegram_message_id VARCHAR(64) NULL,
  telegram_slip_chat_id VARCHAR(64) NULL,
  telegram_slip_message_id VARCHAR(64) NULL,
  batch_token VARCHAR(64) NULL,
  due_slip_id INT NULL,
  slip_name VARCHAR(255) NULL,
  slip_type VARCHAR(128) NULL,
  slip_uploaded_at DATETIME NULL,
  slip_uploaded_by_user_id INT NULL,
  paid_at DATETIME NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_dues_user_month (user_id, due_month),
  INDEX idx_dues_user_status (user_id, status),
  INDEX idx_dues_creator_user (created_by_user_id),
  INDEX idx_dues_debtor_user (debtor_user_id),
  INDEX idx_dues_telegram_chat (telegram_chat_id),
  INDEX idx_dues_batch_token (batch_token),
  CONSTRAINT fk_dues_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_dues_debtor_user FOREIGN KEY (debtor_user_id) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT fk_dues_slip_uploader FOREIGN KEY (slip_uploaded_by_user_id) REFERENCES users(id) ON DELETE SET NULL
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS telegram_chats (
  chat_id VARCHAR(64) PRIMARY KEY,
  user_id INT NOT NULL,
  title VARCHAR(255) NULL,
  type VARCHAR(32) NULL,
  enabled TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_telegram_chats_user_id (user_id),
  CONSTRAINT fk_telegram_chats_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS telegram_members (
  chat_id VARCHAR(64) NOT NULL,
  telegram_user_id VARCHAR(64) NOT NULL,
  user_id INT NULL,
  friend_name VARCHAR(255) NULL,
  role VARCHAR(32) NOT NULL DEFAULT 'member',
  username VARCHAR(255) NULL,
  display_name VARCHAR(255) NULL,
  onboarding_message_id VARCHAR(64) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (chat_id, telegram_user_id),
  INDEX idx_telegram_members_user_id (user_id),
  INDEX idx_telegram_members_username (chat_id, username),
  CONSTRAINT fk_telegram_members_chat FOREIGN KEY (chat_id) REFERENCES telegram_chats(chat_id) ON DELETE CASCADE,
  CONSTRAINT fk_telegram_members_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS telegram_connect_tokens (
  token VARCHAR(64) PRIMARY KEY,
  user_id INT NOT NULL,
  expires_at DATETIME NOT NULL,
  used_at DATETIME NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_telegram_connect_tokens_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS telegram_due_drafts (
  token CHAR(32) PRIMARY KEY,
  chat_id VARCHAR(64) NOT NULL,
  telegram_user_id VARCHAR(64) NOT NULL,
  owner_user_id INT NOT NULL,
  payload JSON NOT NULL,
  expires_at DATETIME NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_telegram_due_drafts_lookup (chat_id, telegram_user_id),
  INDEX idx_telegram_due_drafts_expires (expires_at),
  CONSTRAINT fk_telegram_due_drafts_chat FOREIGN KEY (chat_id) REFERENCES telegram_chats(chat_id) ON DELETE CASCADE,
  CONSTRAINT fk_telegram_due_drafts_user FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE CASCADE
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS due_slips (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  payment_token VARCHAR(64) NULL,
  person_name VARCHAR(255) NOT NULL,
  due_month CHAR(7) NOT NULL,
  amount_paid DECIMAL(10,2) NULL,
  file_name VARCHAR(255) NOT NULL,
  file_type VARCHAR(128) NOT NULL,
  file_data MEDIUMBLOB NOT NULL,
  file_hash CHAR(64) NULL,
  check_status VARCHAR(32) NOT NULL DEFAULT 'needs_review',
  check_note TEXT NULL,
  check_payload JSON NULL,
  uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_due_slips_user_month (user_id, due_month),
  INDEX idx_due_slips_token (payment_token),
  INDEX idx_due_slips_hash (user_id, file_hash),
  CONSTRAINT fk_due_slips_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS due_payment_links (
  token VARCHAR(64) PRIMARY KEY,
  user_id INT NOT NULL,
  debtor_user_id INT NULL,
  person_name VARCHAR(255) NOT NULL,
  due_month CHAR(7) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME NULL,
  INDEX idx_due_payment_links_user_month (user_id, due_month),
  INDEX idx_due_payment_links_debtor (debtor_user_id),
  CONSTRAINT fk_due_payment_links_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_due_payment_links_debtor FOREIGN KEY (debtor_user_id) REFERENCES users(id) ON DELETE SET NULL
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ai_scan_usage (
  user_id INT NOT NULL,
  usage_date DATE NOT NULL,
  scans INT NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, usage_date),
  CONSTRAINT fk_ai_scan_usage_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS scan_credit_balances (
  user_id INT PRIMARY KEY,
  credits INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_scan_credit_balances_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS scan_credit_transactions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  credits INT NOT NULL,
  kind VARCHAR(32) NOT NULL,
  reference VARCHAR(255) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_scan_credit_reference (reference),
  INDEX idx_scan_credit_transactions_user_id (user_id),
  CONSTRAINT fk_scan_credit_transactions_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS pro_payment_requests (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  days INT NOT NULL,
  reference VARCHAR(255) NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'pending',
  notification_sent TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_pro_payment_requests_user_created (user_id, created_at),
  INDEX idx_pro_payment_requests_status_created (status, created_at),
  CONSTRAINT fk_pro_payment_requests_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS site_visits_daily (
  visit_date DATE NOT NULL,
  visitor_key VARCHAR(128) NOT NULL,
  user_id INT NULL,
  hostname VARCHAR(255) NULL,
  entry_path VARCHAR(255) NULL,
  sessions INT NOT NULL DEFAULT 1,
  first_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (visit_date, visitor_key),
  INDEX idx_site_visits_daily_date (visit_date),
  INDEX idx_site_visits_daily_host_date (hostname, visit_date),
  CONSTRAINT fk_site_visits_daily_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
