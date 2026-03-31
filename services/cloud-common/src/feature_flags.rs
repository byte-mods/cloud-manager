use std::env;

/// Feature flags for controlling cloud SDK behavior.
///
/// When `CLOUD_USE_MOCK_DATA=true`, services return in-memory seeded data
/// instead of calling real cloud APIs. This allows development without credentials.
#[derive(Debug, Clone)]
pub struct FeatureFlags {
    /// If true, use in-memory mock data instead of real cloud APIs.
    pub use_mock_data: bool,

    /// If true, enable Redis caching of cloud API responses.
    pub enable_cache: bool,

    /// If true, enable rate limiting for cloud API calls.
    pub enable_rate_limiting: bool,
}

impl FeatureFlags {
    /// Load feature flags from environment variables.
    pub fn from_env() -> Self {
        Self {
            use_mock_data: env::var("CLOUD_USE_MOCK_DATA")
                .map(|v| v == "true" || v == "1")
                .unwrap_or(true), // Default to mock mode for safety

            enable_cache: env::var("CLOUD_ENABLE_CACHE")
                .map(|v| v == "true" || v == "1")
                .unwrap_or(true),

            enable_rate_limiting: env::var("CLOUD_ENABLE_RATE_LIMITING")
                .map(|v| v == "true" || v == "1")
                .unwrap_or(true),
        }
    }

    /// Returns true if real cloud SDK calls should be made.
    pub fn use_real_sdk(&self) -> bool {
        !self.use_mock_data
    }
}

impl Default for FeatureFlags {
    fn default() -> Self {
        Self::from_env()
    }
}
