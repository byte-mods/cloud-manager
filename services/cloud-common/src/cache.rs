/// In-memory cache that replaces Redis.
/// Backward-compatible API surface for all provider files.

use std::collections::HashMap;
use std::sync::Mutex;

use crate::error::CloudSdkError;

pub mod ttl {
    pub const SHORT: u64 = 60;
    pub const MEDIUM: u64 = 300;
    pub const LONG: u64 = 900;
    pub const VERY_LONG: u64 = 3600;
    pub const LIST_RESOURCES: u64 = 300;
    pub const GET_RESOURCE: u64 = 120;
    pub const SECURITY_FINDINGS: u64 = 600;
    pub const COST_DATA: u64 = 900;
    pub const MONITORING_METRICS: u64 = 60;
}

struct CacheEntry {
    value: String,
    expires_at: u64,
}

fn now_secs() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs()
}

pub struct RedisCache {
    data: Mutex<HashMap<String, CacheEntry>>,
    prefix: String,
}

impl RedisCache {
    pub async fn new(_url: &str, prefix: &str) -> Result<Self, CloudSdkError> {
        Ok(Self {
            data: Mutex::new(HashMap::new()),
            prefix: prefix.to_string(),
        })
    }

    /// Cache lookup with fetch-on-miss. Key is a slice of strings joined with ":".
    pub async fn get_or_fetch<T, F, Fut>(
        &self,
        key_parts: &[&str],
        ttl_secs: u64,
        fetch: F,
    ) -> Result<T, CloudSdkError>
    where
        T: serde::de::DeserializeOwned + serde::Serialize,
        F: FnOnce() -> Fut,
        Fut: std::future::Future<Output = Result<T, CloudSdkError>>,
    {
        let full_key = format!("{}:{}", self.prefix, key_parts.join(":"));

        if let Ok(data) = self.data.lock() {
            if let Some(entry) = data.get(&full_key) {
                if entry.expires_at > now_secs() {
                    if let Ok(val) = serde_json::from_str::<T>(&entry.value) {
                        return Ok(val);
                    }
                }
            }
        }

        let result = fetch().await?;

        if let Ok(json) = serde_json::to_string(&result) {
            if let Ok(mut data) = self.data.lock() {
                data.insert(full_key, CacheEntry {
                    value: json,
                    expires_at: now_secs() + ttl_secs,
                });
            }
        }

        Ok(result)
    }

    pub async fn invalidate_pattern(&self, pattern: &[&str]) -> Result<u64, CloudSdkError> {
        let search = format!("{}:{}", self.prefix, pattern.join(":"));
        let mut count = 0u64;
        if let Ok(mut data) = self.data.lock() {
            let keys: Vec<String> = data.keys().filter(|k| k.contains(&search)).cloned().collect();
            for k in &keys { data.remove(k); count += 1; }
        }
        Ok(count)
    }
}
