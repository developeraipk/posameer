# Ameer Perfumes ERP — Hostinger Shared Business Hosting Cloud Setup Guide

This guide deploys your **Cloud MySQL Sync API** and **Live Owner Web Dashboard** on your **Hostinger Business Shared Hosting** plan with **100% isolation** from any existing website or system already running on your main domain.

---

## Why Your Existing Website / System Remains 100% Safe

1. **Separate Subdomain + Separate Folder**: e.g. `pos.yourdomain.com` pointing to `/domains/yourdomain.com/public_html/pos/` (or Hostinger's dedicated subdomain root) — never touches files of your existing main domain.
2. **Separate MySQL Database + Separate DB User**: You create a brand-new database exclusively for Ameer Perfumes (`mysql_schema.sql`), so existing tables/data are never read or modified.
3. **Isolated PHP Session Cookie**: The Owner Dashboard uses `session_name('AMEER_ERP_OWNER_SESS')` scoped only to that subdomain so logins never collide with sessions on your existing system.
4. **Offline-First POS Reliability**: Shop POS billing always saves locally first in SQLite (`ameer_pos.db`), then pushes over HTTPS to Hostinger automatically and on demand. Even if Hostinger or shop internet goes offline, billing at the shop never stops.

---

## Step 1: Create an Isolated Subdomain in Hostinger hPanel

1. Log in to **Hostinger hPanel** -> **Websites** -> **Manage** your domain.
2. Go to **Domains -> Subdomains**.
3. Create a subdomain such as `pos` (so URL becomes `https://pos.yourdomain.com` or `https://erp.yourdomain.com`).
4. Confirm SSL/HTTPS is automatically enabled in **Security -> SSL** (Hostinger issues free Let's Encrypt SSL automatically).

---

## Step 2: Create a Dedicated New MySQL Database

1. In Hostinger hPanel, open **Databases -> Management**.
2. Create a **new MySQL database** and user specifically for Ameer Perfumes (for example `u123456_ameer_cloud`).
3. Click **Enter phpMyAdmin** on that new database.
4. Go to the **Import** tab and upload `mysql_schema.sql` from the `hostinger-cloud/` folder.
5. Verify all `cloud_*` tables (15 tables total) were created cleanly.

---

## Step 3: Upload `hostinger-cloud/` Files & Create `config.php`

1. Open **Hostinger File Manager** -> navigate strictly to your **new subdomain folder** (do NOT upload into the main domain root!).
2. Upload these files from `hostinger-cloud/`:
   - `.htaccess`
   - `api.php`
   - `db.php`
   - `index.php`
   - `config.example.php`
   *(Do not keep `mysql_schema.sql` in web root after import; `.htaccess` also blocks `.sql` downloads.)*
3. Copy `config.example.php` -> rename the copy to `config.php`.
4. Edit `config.php`:
   - Set `'db_host'` (`'127.0.0.1'` or `'localhost'` — check Hostinger Database Management page)
   - Set `'db_name'`, `'db_user'`, `'db_pass'` to your new database credentials.
   - Set `'api_token'` to a strong random 32+ character secret string (e.g. from a password generator).
   - Set `'default_owner_password'` to a strong password before first login (or change it immediately inside the dashboard after signing in).

---

## Step 4: Verify Live Dashboard & API

1. Visit `https://pos.yourdomain.com/api/v1/health` in your browser.
   - You should see JSON: `{"status":"OK","database":"CONNECTED",...}`.
2. Visit `https://pos.yourdomain.com/` in your phone or laptop browser.
   - Sign in with your Owner username (`owner` by default) and password.
   - If you kept the default password, update it immediately in the **Owner Web Login Security** panel at the bottom of the dashboard.

---

## Step 5: Connect Your Desktop POS App (`Ameer Perfumes ERP`)

1. Open **Ameer Perfumes ERP** on your shop PC -> click **Sync Center** in the top navigation bar.
2. Under **Hostinger Cloud Sync & Backup Settings**:
   - **Cloud API Base URL**: `https://pos.yourdomain.com` *(base subdomain URL — do NOT add `/api/v1` unless custom)*
   - **Cloud API Bearer Token**: Paste the exact `'api_token'` from `config.php`.
   - Enable **Auto Cloud Sync** and set your preferred interval (default: every `5` minutes).
3. Click **Save & Test Connection**.
4. Click **Sync All Shop Data Now** to upload existing products, attars, invoices, online orders, wholesale balances, expenses, salaries, and cash shifts to Hostinger.
5. Optionally click **Upload .db Backup to Cloud** anytime to store a SHA-256 verified SQLite database backup on Hostinger.

---

**Support & Customization:** Global Tech • `0329 9969277`

