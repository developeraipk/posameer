use crate::config::ConfigManager;
use crate::db::DatabaseManager;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;

static CLOUD_SYNC_MUTEX: Mutex<()> = Mutex::new(());
static REALTIME_IN_FLIGHT: AtomicBool = AtomicBool::new(false);

pub fn spawn_realtime_push() {
    let cfg = ConfigManager::new().load_or_create();
    if !cfg.cloud_sync_enabled
        || cfg.cloud_api_url.trim().is_empty()
        || cfg.cloud_api_token.trim().is_empty()
    {
        return;
    }
    if REALTIME_IN_FLIGHT.swap(true, Ordering::SeqCst) {
        return;
    }
    std::thread::spawn(|| {
        std::thread::sleep(std::time::Duration::from_millis(250));
        REALTIME_IN_FLIGHT.store(false, Ordering::SeqCst);
        let client = CloudSyncClient::from_config();
        if let Err(e) = client.push_events("REALTIME_AUTO_PUSH") {
            eprintln!("Realtime cloud push notice: {}", e);
        }
    });
}

pub const DEFAULT_CLOUD_ENDPOINT: &str = "";
pub const CLOUD_AUTH_TOKEN: &str = "";

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct CloudSyncEventPayload {
    pub event_id: String,
    pub origin_terminal_id: String,
    pub origin_sequence_number: i64,
    pub entity_type: String,
    pub entity_id: String,
    pub operation_type: String,
    pub payload_json: String,
    pub created_at: String,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct CloudSyncPushPayload {
    pub terminal_id: String,
    #[serde(default)]
    pub branch_name: String,
    #[serde(default)]
    pub station_role: String,
    pub app_version: String,
    pub watermark_sequence: i64,
    pub sync_trigger_reason: String,
    pub events: Vec<CloudSyncEventPayload>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct CloudSyncPushResponse {
    pub success: bool,
    pub terminal_id: String,
    pub processed_events_count: usize,
    pub acknowledged_watermark: i64,
    pub server_timestamp: String,
    pub message: String,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct CloudSyncStatusResponse {
    pub cloud_service: String,
    pub database: String,
    pub total_events_archived: i64,
    pub sync_cadence: String,
    pub is_online: bool,
    pub message: String,
    pub server_timestamp: String,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct CloudSyncSettingsDto {
    pub cloud_sync_enabled: bool,
    pub cloud_api_url: String,
    pub cloud_api_token: String,
    pub cloud_auto_sync_minutes: u32,
    pub cloud_last_synced_at: Option<String>,
    pub station_id: String,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct CloudBackupUploadResponse {
    pub success: bool,
    pub backup_id: String,
    pub filename: String,
    pub file_size_bytes: usize,
    pub sha256_checksum: String,
    pub server_timestamp: String,
    pub message: String,
}

#[derive(Debug, Clone)]
struct ParsedUrl {
    is_https: bool,
    host: String,
    port: u16,
    base_path: String,
}

fn parse_cloud_url(raw: &str) -> Result<ParsedUrl, String> {
    let mut trimmed = raw.trim().trim_end_matches('/').to_string();
    if trimmed.is_empty() {
        return Err("Hostinger Cloud API URL is not configured yet. Open Sync Center to set your subdomain URL.".to_string());
    }

    // Strip accidental /api/v1 suffix if user pasted the full API path
    if trimmed.to_lowercase().ends_with("/api/v1") {
        let new_len = trimmed.len() - "/api/v1".len();
        trimmed.truncate(new_len);
    }

    let (is_https, rest) = if let Some(r) = trimmed.strip_prefix("https://") {
        (true, r)
    } else if let Some(r) = trimmed.strip_prefix("http://") {
        (false, r)
    } else {
        // Default to HTTPS for Hostinger domains
        (true, trimmed.as_str())
    };

    let (host_port, base_path) = match rest.find('/') {
        Some(idx) => (&rest[..idx], rest[idx..].trim_end_matches('/').to_string()),
        None => (rest, String::new()),
    };

    if host_port.is_empty() {
        return Err("Invalid Cloud API URL: missing hostname.".to_string());
    }

    let (host, port) = if let Some(colon) = host_port.rfind(':') {
        let p_str = &host_port[colon + 1..];
        let p = p_str
            .parse::<u16>()
            .map_err(|_| format!("Invalid port '{}' in Cloud API URL.", p_str))?;
        (host_port[..colon].to_string(), p)
    } else {
        (host_port.to_string(), if is_https { 443 } else { 80 })
    };

    Ok(ParsedUrl {
        is_https,
        host,
        port,
        base_path,
    })
}

pub struct CloudSyncClient {
    pub base_url: String,
    pub terminal_id: String,
    pub auth_token: String,
    pub enabled: bool,
}

impl CloudSyncClient {
    pub fn from_config() -> Self {
        let cfg = ConfigManager::new().load_or_create();
        Self {
            base_url: cfg.cloud_api_url,
            terminal_id: cfg.station_id,
            auth_token: cfg.cloud_api_token,
            enabled: cfg.cloud_sync_enabled,
        }
    }

    pub fn new(endpoint: &str, terminal_id: &str) -> Self {
        let cfg = ConfigManager::new().load_or_create();
        let url = if endpoint.trim().is_empty() {
            cfg.cloud_api_url
        } else {
            endpoint.trim().to_string()
        };
        let tid = if terminal_id.trim().is_empty() {
            cfg.station_id
        } else {
            terminal_id.trim().to_string()
        };
        Self {
            base_url: url,
            terminal_id: tid,
            auth_token: cfg.cloud_api_token,
            enabled: cfg.cloud_sync_enabled,
        }
    }

    fn ensure_ready(&self) -> Result<ParsedUrl, String> {
        if !self.enabled {
            return Err("Cloud sync is currently disabled in Sync Center settings.".to_string());
        }
        if self.auth_token.trim().is_empty() {
            return Err("Cloud API Bearer Token is empty. Paste the api_token from config.php into Sync Center.".to_string());
        }
        parse_cloud_url(&self.base_url)
    }

    fn build_object_path(&self, parsed: &ParsedUrl, route: &str) -> String {
        let clean_route = route.trim_start_matches('/');
        if parsed.base_path.is_empty() {
            format!("/api/v1/{}", clean_route)
        } else {
            format!("{}/api/v1/{}", parsed.base_path, clean_route)
        }
    }

    pub fn test_connection(&self) -> Result<CloudSyncStatusResponse, String> {
        if self.auth_token.trim().is_empty() {
            return Err("Cloud API Bearer Token is required before testing connection.".to_string());
        }
        let parsed = parse_cloud_url(&self.base_url)?;
        let path = self.build_object_path(&parsed, "sync/status");

        let (status, body) = http_request(
            &parsed,
            "GET",
            &path,
            &self.auth_token,
            "application/json",
            &[],
            &[],
        )?;

        let body_str = String::from_utf8_lossy(&body).to_string();
        if status == 401 {
            return Err("Authentication failed (HTTP 401). Confirm Cloud API Token matches config.php exactly.".to_string());
        }
        if status < 200 || status >= 300 {
            return Err(format!("Cloud server returned HTTP {}: {}", status, body_str));
        }

        let v: serde_json::Value = serde_json::from_str(&body_str)
            .map_err(|e| format!("Invalid JSON from cloud server: {} (Body: {})", e, body_str))?;

        Ok(CloudSyncStatusResponse {
            cloud_service: v["cloudServer"]
                .as_str()
                .unwrap_or("Hostinger Shared MySQL + PHP")
                .to_string(),
            database: "MySQL (Connected)".to_string(),
            total_events_archived: v["totalSyncedEvents"].as_i64().unwrap_or(0),
            sync_cadence: "Auto + Real-Time On-Demand".to_string(),
            is_online: true,
            message: format!(
                "Connected to Hostinger Cloud ({} events archived, {} backups stored).",
                v["totalSyncedEvents"].as_i64().unwrap_or(0),
                v["totalCloudBackups"].as_i64().unwrap_or(0)
            ),
            server_timestamp: v["serverTimestamp"]
                .as_str()
                .unwrap_or("")
                .to_string(),
        })
    }

    pub fn push_events(&self, trigger_reason: &str) -> Result<CloudSyncPushResponse, String> {
        let _sync_guard = CLOUD_SYNC_MUTEX
            .lock()
            .map_err(|_| "Cloud sync lock error".to_string())?;
        let parsed = self.ensure_ready()?;
        let db = DatabaseManager::new();
        let conn = db.get_connection().map_err(|e| e.to_string())?;

        let mut total_processed = 0usize;
        let mut latest_ack_watermark: i64 = 0;
        let mut last_server_ts = chrono::Utc::now().to_rfc3339();
        let mut batches_sent = 0usize;

        loop {
            if batches_sent >= 100 {
                break;
            }

            let mut stmt = conn
                .prepare(
                    "SELECT event_id, device_id, local_sequence_number, entity_type, entity_id,
                            operation_type, payload_json, created_at
                     FROM sync_outbox
                     WHERE is_synced = 0
                     ORDER BY local_sequence_number ASC
                     LIMIT 100;",
                )
                .map_err(|e| e.to_string())?;

            let rows = stmt
                .query_map([], |r| {
                    Ok(CloudSyncEventPayload {
                        event_id: r.get(0)?,
                        origin_terminal_id: r.get(1)?,
                        origin_sequence_number: r.get(2)?,
                        entity_type: r.get(3)?,
                        entity_id: r.get(4)?,
                        operation_type: r.get(5)?,
                        payload_json: r.get(6)?,
                        created_at: r.get(7)?,
                    })
                })
                .map_err(|e| e.to_string())?;

            let mut events: Vec<CloudSyncEventPayload> = Vec::new();
            let mut max_seq: i64 = 0;
            for r in rows {
                if let Ok(ev) = r {
                    if ev.origin_sequence_number > max_seq {
                        max_seq = ev.origin_sequence_number;
                    }
                    events.push(ev);
                }
            }

            if events.is_empty() {
                break;
            }

            let cfg_snap = ConfigManager::new().load_or_create();
            let branch_label = format!("{} ({})", cfg_snap.store_name.trim(), cfg_snap.city.trim())
                .trim_end_matches(" ()")
                .to_string();
            let role_label = if cfg_snap.is_primary_server {
                "PRIMARY_SERVER"
            } else {
                "CLIENT_PEER"
            }
            .to_string();

            let push_payload = CloudSyncPushPayload {
                terminal_id: self.terminal_id.clone(),
                branch_name: branch_label,
                station_role: role_label,
                app_version: env!("CARGO_PKG_VERSION").to_string(),
                watermark_sequence: max_seq,
                sync_trigger_reason: trigger_reason.to_string(),
                events: events.clone(),
            };

            let json_body = serde_json::to_vec(&push_payload).map_err(|e| e.to_string())?;
            let path = self.build_object_path(&parsed, "sync/push");
            let (status, resp_bytes) = http_request(
                &parsed,
                "POST",
                &path,
                &self.auth_token,
                "application/json",
                &[],
                &json_body,
            )?;

            let resp_str = String::from_utf8_lossy(&resp_bytes).to_string();
            if status == 401 {
                return Err("Cloud push rejected (HTTP 401 Unauthorized). Check your Cloud API Bearer Token.".to_string());
            }
            if status < 200 || status >= 300 {
                return Err(format!("Cloud push HTTP {} error: {}", status, resp_str));
            }

            let resp_val: serde_json::Value = serde_json::from_str(&resp_str)
                .map_err(|e| format!("Invalid cloud push JSON response: {} ({})", e, resp_str))?;

            let accepted = resp_val["acceptedCount"].as_u64().unwrap_or(0) as usize;
            let duplicates = resp_val["duplicateCount"].as_u64().unwrap_or(0) as usize;
            let ack_wm = resp_val["latestCloudWatermark"]
                .as_i64()
                .unwrap_or(max_seq);
            if ack_wm > latest_ack_watermark {
                latest_ack_watermark = ack_wm;
            }
            if let Some(ts) = resp_val["serverTimestamp"].as_str() {
                last_server_ts = ts.to_string();
            }

            // Mark pushed events as synced locally
            for ev in &events {
                conn.execute(
                    "UPDATE sync_outbox SET is_synced = 1 WHERE event_id = ?;",
                    [&ev.event_id],
                )
                .map_err(|e| e.to_string())?;
            }

            let now = chrono::Utc::now().to_rfc3339();
            conn.execute(
                "INSERT INTO sync_watermarks (source_device_id, target_device_id, last_replicated_sequence, last_sync_timestamp)
                 VALUES (?, 'HOSTINGER_CLOUD', ?, ?)
                 ON CONFLICT(source_device_id, target_device_id) DO UPDATE SET
                     last_replicated_sequence = MAX(last_replicated_sequence, excluded.last_replicated_sequence),
                     last_sync_timestamp = excluded.last_sync_timestamp;",
                rusqlite::params![&self.terminal_id, latest_ack_watermark, &now],
            )
            .map_err(|e| e.to_string())?;

            total_processed += accepted + duplicates;
            batches_sent += 1;

            if events.len() < 100 {
                break;
            }
        }

        // Record latest cloud sync time in AppConfig
        let now_str = chrono::Utc::now().to_rfc3339();
        let cfg_mgr = ConfigManager::new();
        let mut cfg = cfg_mgr.load_or_create();
        cfg.cloud_last_synced_at = Some(now_str);
        let _ = cfg_mgr.save(&cfg);

        let message = if total_processed == 0 {
            "Hostinger Cloud is up to date. No pending local changes to upload.".to_string()
        } else {
            format!(
                "Successfully uploaded {} local record(s) to Hostinger Cloud ({} batch(es)).",
                total_processed, batches_sent
            )
        };

        Ok(CloudSyncPushResponse {
            success: true,
            terminal_id: self.terminal_id.clone(),
            processed_events_count: total_processed,
            acknowledged_watermark: latest_ack_watermark,
            server_timestamp: last_server_ts,
            message,
        })
    }

    pub fn pull_events(&self) -> Result<(usize, String), String> {
        let parsed = self.ensure_ready()?;
        let db = DatabaseManager::new();
        let conn = db.get_connection().map_err(|e| e.to_string())?;

        let last_cursor: i64 = conn
            .query_row(
                "SELECT last_replicated_sequence FROM sync_watermarks
                 WHERE source_device_id = 'HOSTINGER_CLOUD' AND target_device_id = ?;",
                [&self.terminal_id],
                |r| r.get(0),
            )
            .unwrap_or(0);

        let route = format!(
            "sync/pull?terminal_id={}&since_id={}&limit=200",
            self.terminal_id, last_cursor
        );
        let path = self.build_object_path(&parsed, &route);
        let (status, resp_bytes) = http_request(
            &parsed,
            "GET",
            &path,
            &self.auth_token,
            "application/json",
            &[],
            &[],
        )?;

        let resp_str = String::from_utf8_lossy(&resp_bytes).to_string();
        if status < 200 || status >= 300 {
            return Err(format!("Cloud pull HTTP {}: {}", status, resp_str));
        }

        let val: serde_json::Value = serde_json::from_str(&resp_str)
            .map_err(|e| format!("Invalid cloud pull JSON: {}", e))?;

        let events = val["events"].as_array().cloned().unwrap_or_default();
        let mut received_count = 0usize;
        let now = chrono::Utc::now().to_rfc3339();

        for ev in &events {
            let origin_dev = ev["originTerminalId"].as_str().unwrap_or("POS-02");
            let origin_seq = ev["originSequenceNumber"].as_i64().unwrap_or(0);
            let entity_type = ev["entityType"].as_str().unwrap_or("UNKNOWN");
            let entity_id = ev["entityId"].as_str().unwrap_or("");
            let op_type = ev["operationType"].as_str().unwrap_or("UPDATE");
            let payload_json = ev["payloadJson"].as_str().unwrap_or("{}");
            let inbox_id = format!(
                "inb_{}",
                ev["eventId"].as_str().unwrap_or(&uuid::Uuid::new_v4().to_string())
            );

            let changed = conn
                .execute(
                    "INSERT OR IGNORE INTO sync_inbox_journal
                     (inbox_id, origin_device_id, origin_sequence_number, entity_type, entity_id,
                      operation_type, payload_json, received_at, is_applied, applied_at)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?);",
                    rusqlite::params![
                        inbox_id,
                        origin_dev,
                        origin_seq,
                        entity_type,
                        entity_id,
                        op_type,
                        payload_json,
                        now,
                        now
                    ],
                )
                .unwrap_or(0);
            received_count += changed;
        }

        let next_cursor = val["nextCursor"].as_i64().unwrap_or(last_cursor);
        if next_cursor > last_cursor {
            let _ = conn.execute(
                "INSERT INTO sync_watermarks (source_device_id, target_device_id, last_replicated_sequence, last_sync_timestamp)
                 VALUES ('HOSTINGER_CLOUD', ?, ?, ?)
                 ON CONFLICT(source_device_id, target_device_id) DO UPDATE SET
                     last_replicated_sequence = MAX(last_replicated_sequence, excluded.last_replicated_sequence),
                     last_sync_timestamp = excluded.last_sync_timestamp;",
                rusqlite::params![&self.terminal_id, next_cursor, &now],
            );
        }

        Ok((
            received_count,
            format!("Pulled {} remote terminal event(s).", received_count),
        ))
    }

    pub fn sync_bidirectional(&self, trigger_reason: &str) -> Result<CloudSyncPushResponse, String> {
        let mut push_res = self.push_events(trigger_reason)?;
        if let Ok((pulled_count, _)) = self.pull_events() {
            if pulled_count > 0 {
                push_res.message = format!(
                    "{} Also pulled {} peer event(s) into inbox journal.",
                    push_res.message, pulled_count
                );
            }
        }
        Ok(push_res)
    }

    pub fn send_heartbeat(&self) -> Result<(), String> {
        let parsed = self.ensure_ready()?;
        let cfg = ConfigManager::new().load_or_create();
        let lan_ip = std::net::UdpSocket::bind("0.0.0.0:0")
            .and_then(|s| {
                s.connect("8.8.8.8:80")?;
                s.local_addr()
            })
            .map(|a| a.ip().to_string())
            .unwrap_or_default();
        let branch_label = format!("{} ({})", cfg.store_name.trim(), cfg.city.trim())
            .trim_end_matches(" ()")
            .to_string();
        let station_role = if cfg.is_primary_server {
            "PRIMARY_SERVER"
        } else {
            "CLIENT_PEER"
        };

        let body_val = serde_json::json!({
            "terminalId": self.terminal_id,
            "branchName": branch_label,
            "stationRole": station_role,
            "lanIp": lan_ip,
            "appVersion": env!("CARGO_PKG_VERSION"),
        });
        let json_body = serde_json::to_vec(&body_val).map_err(|e| e.to_string())?;
        let path = self.build_object_path(&parsed, "sync/heartbeat");
        let (status, _) = http_request(
            &parsed,
            "POST",
            &path,
            &self.auth_token,
            "application/json",
            &[],
            &json_body,
        )?;
        if status >= 200 && status < 300 {
            Ok(())
        } else {
            Err(format!("Heartbeat HTTP {}", status))
        }
    }

    pub fn upload_backup_file(
        &self,
        backup_path: &str,
        sha256_checksum: &str,
    ) -> Result<CloudBackupUploadResponse, String> {
        let parsed = self.ensure_ready()?;
        let p = Path::new(backup_path);
        let bytes = fs::read(p)
            .map_err(|e| format!("Failed to read local backup file '{}': {}", backup_path, e))?;

        let filename = p
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("ameer_backup.db")
            .to_string();

        let path = self.build_object_path(&parsed, "backup/upload");
        let extra_headers = [
            format!("X-Terminal-Id: {}", self.terminal_id),
            format!("X-Backup-Filename: {}", filename),
            format!("X-Backup-Sha256: {}", sha256_checksum),
        ];

        let (status, resp_bytes) = http_request(
            &parsed,
            "POST",
            &path,
            &self.auth_token,
            "application/octet-stream",
            &extra_headers,
            &bytes,
        )?;

        let resp_str = String::from_utf8_lossy(&resp_bytes).to_string();
        if status < 200 || status >= 300 {
            return Err(format!("Cloud backup upload HTTP {}: {}", status, resp_str));
        }

        let v: serde_json::Value = serde_json::from_str(&resp_str)
            .map_err(|e| format!("Invalid backup upload JSON: {} ({})", e, resp_str))?;

        Ok(CloudBackupUploadResponse {
            success: true,
            backup_id: v["backupId"].as_str().unwrap_or("").to_string(),
            filename: v["filename"].as_str().unwrap_or(&filename).to_string(),
            file_size_bytes: v["fileSizeBytes"].as_u64().unwrap_or(bytes.len() as u64) as usize,
            sha256_checksum: v["sha256Checksum"]
                .as_str()
                .unwrap_or(sha256_checksum)
                .to_string(),
            server_timestamp: v["serverTimestamp"].as_str().unwrap_or("").to_string(),
            message: v["message"]
                .as_str()
                .unwrap_or("Cloud SQLite backup uploaded and verified.")
                .to_string(),
        })
    }
}

// ============================================================================
// NATIVE WINDOWS WINHTTP CLIENT (TLS 1.2 / 1.3 HTTPS WITHOUT EXTRA CRATES)
// ============================================================================

#[cfg(windows)]
fn to_wide_null(s: &str) -> Vec<u16> {
    use std::os::windows::ffi::OsStrExt;
    std::ffi::OsStr::new(s)
        .encode_wide()
        .chain(std::iter::once(0))
        .collect()
}

#[cfg(windows)]
fn http_request(
    parsed: &ParsedUrl,
    method: &str,
    object_path: &str,
    bearer_token: &str,
    content_type: &str,
    extra_headers: &[String],
    body: &[u8],
) -> Result<(u16, Vec<u8>), String> {
    use std::ffi::c_void;
    use std::ptr::{null, null_mut};

    type HINTERNET = *mut c_void;

    #[link(name = "kernel32")]
    extern "system" {
        fn LoadLibraryA(lpLibFileName: *const i8) -> isize;
        fn GetProcAddress(hModule: isize, lpProcName: *const i8) -> usize;
        fn GetLastError() -> u32;
    }

    type FnWinHttpOpen = unsafe extern "system" fn(*const u16, u32, *const u16, *const u16, u32) -> HINTERNET;
    type FnWinHttpSetTimeouts = unsafe extern "system" fn(HINTERNET, i32, i32, i32, i32) -> i32;
    type FnWinHttpConnect = unsafe extern "system" fn(HINTERNET, *const u16, u16, u32) -> HINTERNET;
    type FnWinHttpOpenRequest = unsafe extern "system" fn(
        HINTERNET,
        *const u16,
        *const u16,
        *const u16,
        *const u16,
        *const *const u16,
        u32,
    ) -> HINTERNET;
    type FnWinHttpAddRequestHeaders = unsafe extern "system" fn(HINTERNET, *const u16, u32, u32) -> i32;
    type FnWinHttpSendRequest = unsafe extern "system" fn(
        HINTERNET,
        *const u16,
        u32,
        *const c_void,
        u32,
        u32,
        usize,
    ) -> i32;
    type FnWinHttpReceiveResponse = unsafe extern "system" fn(HINTERNET, *mut c_void) -> i32;
    type FnWinHttpQueryHeaders = unsafe extern "system" fn(
        HINTERNET,
        u32,
        *const u16,
        *mut c_void,
        *mut u32,
        *mut u32,
    ) -> i32;
    type FnWinHttpQueryDataAvailable = unsafe extern "system" fn(HINTERNET, *mut u32) -> i32;
    type FnWinHttpReadData = unsafe extern "system" fn(HINTERNET, *mut c_void, u32, *mut u32) -> i32;
    type FnWinHttpCloseHandle = unsafe extern "system" fn(HINTERNET) -> i32;

    const WINHTTP_ACCESS_TYPE_DEFAULT_PROXY: u32 = 0;
    const WINHTTP_ACCESS_TYPE_AUTOMATIC_PROXY: u32 = 4;
    const WINHTTP_FLAG_REFRESH: u32 = 0x00000100;
    const WINHTTP_FLAG_SECURE: u32 = 0x00800000;
    const WINHTTP_ADDREQ_FLAG_ADD: u32 = 0x20000000;
    const WINHTTP_ADDREQ_FLAG_REPLACE: u32 = 0x80000000;
    const WINHTTP_QUERY_STATUS_CODE_NUMBER: u32 = 0x20000013;

    unsafe {
        let h_mod = LoadLibraryA(b"winhttp.dll\0".as_ptr() as *const i8);
        if h_mod == 0 {
            return Err("Failed to load Windows winhttp.dll for HTTPS communication.".to_string());
        }

        macro_rules! load_fn {
            ($name:expr, $ty:ty) => {{
                let ptr = GetProcAddress(h_mod, concat!($name, "\0").as_ptr() as *const i8);
                if ptr == 0 {
                    return Err(concat!("winhttp.dll missing symbol ", $name).to_string());
                }
                std::mem::transmute::<usize, $ty>(ptr)
            }};
        }

        let win_open = load_fn!("WinHttpOpen", FnWinHttpOpen);
        let win_timeouts = load_fn!("WinHttpSetTimeouts", FnWinHttpSetTimeouts);
        let win_connect = load_fn!("WinHttpConnect", FnWinHttpConnect);
        let win_open_req = load_fn!("WinHttpOpenRequest", FnWinHttpOpenRequest);
        let win_add_hdr = load_fn!("WinHttpAddRequestHeaders", FnWinHttpAddRequestHeaders);
        let win_send = load_fn!("WinHttpSendRequest", FnWinHttpSendRequest);
        let win_recv = load_fn!("WinHttpReceiveResponse", FnWinHttpReceiveResponse);
        let win_query_hdr = load_fn!("WinHttpQueryHeaders", FnWinHttpQueryHeaders);
        let win_avail = load_fn!("WinHttpQueryDataAvailable", FnWinHttpQueryDataAvailable);
        let win_read = load_fn!("WinHttpReadData", FnWinHttpReadData);
        let win_close = load_fn!("WinHttpCloseHandle", FnWinHttpCloseHandle);

        let agent = to_wide_null("AmeerPerfumesERP/4.4.8");
        let mut h_session = win_open(agent.as_ptr(), WINHTTP_ACCESS_TYPE_AUTOMATIC_PROXY, null(), null(), 0);
        if h_session.is_null() {
            h_session = win_open(agent.as_ptr(), WINHTTP_ACCESS_TYPE_DEFAULT_PROXY, null(), null(), 0);
        }
        if h_session.is_null() {
            return Err(format!("WinHttpOpen failed (err {})", GetLastError()));
        }

        let _ = win_timeouts(h_session, 8000, 12000, 30000, 60000);

        let host_w = to_wide_null(&parsed.host);
        let h_connect = win_connect(h_session, host_w.as_ptr(), parsed.port, 0);
        if h_connect.is_null() {
            let err = GetLastError();
            let _ = win_close(h_session);
            return Err(format!("Could not connect to {} (WinHTTP err {})", parsed.host, err));
        }

        let method_w = to_wide_null(method);
        let path_w = to_wide_null(object_path);
        let flags = if parsed.is_https {
            WINHTTP_FLAG_SECURE | WINHTTP_FLAG_REFRESH
        } else {
            WINHTTP_FLAG_REFRESH
        };
        let h_req = win_open_req(
            h_connect,
            method_w.as_ptr(),
            path_w.as_ptr(),
            null(),
            null(),
            null(),
            flags,
        );
        if h_req.is_null() {
            let err = GetLastError();
            let _ = win_close(h_connect);
            let _ = win_close(h_session);
            return Err(format!("WinHttpOpenRequest failed (err {})", err));
        }

        let mut hdr_lines = vec![
            format!("Authorization: Bearer {}", bearer_token.trim()),
            format!("X-Ameer-Cloud-Token: {}", bearer_token.trim()),
            format!("Content-Type: {}", content_type),
            "Accept: application/json".to_string(),
        ];
        for h in extra_headers {
            hdr_lines.push(h.clone());
        }
        let combined_headers = hdr_lines.join("\r\n") + "\r\n";
        let headers_w = to_wide_null(&combined_headers);
        let _ = win_add_hdr(
            h_req,
            headers_w.as_ptr(),
            u32::MAX,
            WINHTTP_ADDREQ_FLAG_ADD | WINHTTP_ADDREQ_FLAG_REPLACE,
        );

        let body_ptr = if body.is_empty() {
            null()
        } else {
            body.as_ptr() as *const c_void
        };
        let body_len = body.len() as u32;

        let sent = win_send(h_req, null(), 0, body_ptr, body_len, body_len, 0);
        if sent == 0 {
            let err = GetLastError();
            let _ = win_close(h_req);
            let _ = win_close(h_connect);
            let _ = win_close(h_session);
            return Err(format!(
                "HTTPS request send failed to {}{} (WinHTTP err {}). Check domain/internet/SSL.",
                parsed.host, object_path, err
            ));
        }

        if win_recv(h_req, null_mut()) == 0 {
            let err = GetLastError();
            let _ = win_close(h_req);
            let _ = win_close(h_connect);
            let _ = win_close(h_session);
            return Err(format!("HTTPS response failed (WinHTTP err {})", err));
        }

        let mut status_code: u32 = 0;
        let mut status_size: u32 = std::mem::size_of::<u32>() as u32;
        let _ = win_query_hdr(
            h_req,
            WINHTTP_QUERY_STATUS_CODE_NUMBER,
            null(),
            &mut status_code as *mut u32 as *mut c_void,
            &mut status_size,
            null_mut(),
        );

        let mut response_data: Vec<u8> = Vec::new();
        loop {
            let mut avail: u32 = 0;
            if win_avail(h_req, &mut avail) == 0 || avail == 0 {
                break;
            }
            let mut buf = vec![0u8; avail as usize];
            let mut read: u32 = 0;
            if win_read(h_req, buf.as_mut_ptr() as *mut c_void, avail, &mut read) == 0 || read == 0 {
                break;
            }
            buf.truncate(read as usize);
            response_data.extend_from_slice(&buf);
        }

        let _ = win_close(h_req);
        let _ = win_close(h_connect);
        let _ = win_close(h_session);

        Ok((status_code as u16, response_data))
    }
}

#[cfg(not(windows))]
fn http_request(
    _parsed: &ParsedUrl,
    _method: &str,
    _object_path: &str,
    _bearer_token: &str,
    _content_type: &str,
    _extra_headers: &[String],
    _body: &[u8],
) -> Result<(u16, Vec<u8>), String> {
    Err("Cloud WinHTTP transport is supported on Windows POS builds.".to_string())
}
