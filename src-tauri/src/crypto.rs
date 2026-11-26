use std::sync::Mutex;
use std::time::{Duration, Instant};

// ============================================================================
// PURE RUST CRYPTOGRAPHIC SHA-256 IMPLEMENTATION (FIPS 180-4)
// Zero external C linker dependencies. 100% portable on all Windows targets.
// ============================================================================

const K: [u32; 64] = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
];

pub fn sha256_hex(data: &[u8]) -> String {
    let mut h: [u32; 8] = [
        0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
        0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
    ];

    let bit_len = (data.len() as u64) * 8;
    let mut padded = data.to_vec();
    padded.push(0x80);
    while (padded.len() % 64) != 56 {
        padded.push(0x00);
    }
    padded.extend_from_slice(&bit_len.to_be_bytes());

    for chunk in padded.chunks(64) {
        let mut w = [0u32; 64];
        for i in 0..16 {
            w[i] = u32::from_be_bytes([
                chunk[i * 4],
                chunk[i * 4 + 1],
                chunk[i * 4 + 2],
                chunk[i * 4 + 3],
            ]);
        }
        for i in 16..64 {
            let s0 = w[i - 15].rotate_right(7) ^ w[i - 15].rotate_right(18) ^ (w[i - 15] >> 3);
            let s1 = w[i - 2].rotate_right(17) ^ w[i - 2].rotate_right(19) ^ (w[i - 2] >> 10);
            w[i] = w[i - 16].wrapping_add(s0).wrapping_add(w[i - 7]).wrapping_add(s1);
        }

        let mut a = h[0];
        let mut b = h[1];
        let mut c = h[2];
        let mut d = h[3];
        let mut e = h[4];
        let mut f = h[5];
        let mut g = h[6];
        let mut h_val = h[7];

        for i in 0..64 {
            let s1 = e.rotate_right(6) ^ e.rotate_right(11) ^ e.rotate_right(25);
            let ch = (e & f) ^ ((!e) & g);
            let temp1 = h_val.wrapping_add(s1).wrapping_add(ch).wrapping_add(K[i]).wrapping_add(w[i]);
            let s0 = a.rotate_right(2) ^ a.rotate_right(13) ^ a.rotate_right(22);
            let maj = (a & b) ^ (a & c) ^ (b & c);
            let temp2 = s0.wrapping_add(maj);

            h_val = g;
            g = f;
            f = e;
            e = d.wrapping_add(temp1);
            d = c;
            c = b;
            b = a;
            a = temp1.wrapping_add(temp2);
        }

        h[0] = h[0].wrapping_add(a);
        h[1] = h[1].wrapping_add(b);
        h[2] = h[2].wrapping_add(c);
        h[3] = h[3].wrapping_add(d);
        h[4] = h[4].wrapping_add(e);
        h[5] = h[5].wrapping_add(f);
        h[6] = h[6].wrapping_add(g);
        h[7] = h[7].wrapping_add(h_val);
    }

    format!(
        "{:08x}{:08x}{:08x}{:08x}{:08x}{:08x}{:08x}{:08x}",
        h[0], h[1], h[2], h[3], h[4], h[5], h[6], h[7]
    )
}

// Generate salted cryptographic PIN hash: salt$sha256(salt + pin)
pub fn generate_salted_pin_hash(pin: &str, salt: Option<&str>) -> String {
    let s = salt.map(|x| x.to_string()).unwrap_or_else(|| {
        let ts = chrono::Utc::now().timestamp_nanos_opt().unwrap_or(123456789);
        sha256_hex(format!("ameer_salt_{}", ts).as_bytes())[0..16].to_string()
    });
    let input = format!("{}:{}:ameer_pos_secret", s, pin);
    let hash = sha256_hex(input.as_bytes());
    format!("{}${}", s, hash)
}

pub fn verify_salted_pin(pin: &str, stored_hash: &str) -> bool {
    // 1. Support modern salt$hash
    if let Some((salt, expected_hash)) = stored_hash.split_once('$') {
        let input = format!("{}:{}:ameer_pos_secret", salt, pin);
        let computed = sha256_hex(input.as_bytes());
        return computed == expected_hash;
    }

    // 2. Backward compatibility migration check
    if stored_hash == format!("hash_pin_{}", pin) {
        return true;
    }

    false
}

// ============================================================================
// FAILED-ATTEMPT RATE LIMITING & TEMPORARY LOCKOUT
// Maximum 5 failed attempts within 60 seconds triggers a 60-second lockout.
// ============================================================================

struct RateLimiter {
    failed_attempts: usize,
    lockout_until: Option<Instant>,
    last_attempt: Instant,
}

static RATE_LIMITER: Mutex<Option<RateLimiter>> = Mutex::new(None);

pub fn check_rate_limit() -> Result<(), String> {
    let mut guard = RATE_LIMITER.lock().unwrap_or_else(|e| e.into_inner());
    if guard.is_none() {
        *guard = Some(RateLimiter {
            failed_attempts: 0,
            lockout_until: None,
            last_attempt: Instant::now(),
        });
    }

    let limiter = guard.as_mut().unwrap();
    let now = Instant::now();

    if let Some(until) = limiter.lockout_until {
        if now < until {
            let remaining = until.duration_since(now).as_secs() + 1;
            return Err(format!(
                "SECURITY LOCKOUT: Too many failed PIN attempts. Workstation locked for {} seconds.",
                remaining
            ));
        } else {
            // Lockout expired
            limiter.lockout_until = None;
            limiter.failed_attempts = 0;
        }
    }

    // Reset attempt counter if more than 60 seconds passed since last failed attempt
    if now.duration_since(limiter.last_attempt) > Duration::from_secs(60) {
        limiter.failed_attempts = 0;
    }

    Ok(())
}

pub fn record_auth_failure() -> usize {
    let mut guard = RATE_LIMITER.lock().unwrap_or_else(|e| e.into_inner());
    if guard.is_none() {
        *guard = Some(RateLimiter {
            failed_attempts: 0,
            lockout_until: None,
            last_attempt: Instant::now(),
        });
    }

    let limiter = guard.as_mut().unwrap();
    limiter.failed_attempts += 1;
    limiter.last_attempt = Instant::now();

    if limiter.failed_attempts >= 5 {
        limiter.lockout_until = Some(Instant::now() + Duration::from_secs(60));
    }

    limiter.failed_attempts
}

pub fn record_auth_success() {
    let mut guard = RATE_LIMITER.lock().unwrap_or_else(|e| e.into_inner());
    if let Some(limiter) = guard.as_mut() {
        limiter.failed_attempts = 0;
        limiter.lockout_until = None;
    }
}
