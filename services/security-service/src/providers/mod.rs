pub mod aws_security;
pub mod azure_security;
pub mod gcp_security;
pub mod mock_security;

pub use aws_security::AwsSecurityProvider;
pub use azure_security::AzureSecurityProvider;
pub use gcp_security::GcpSecurityProvider;
pub use mock_security::MockSecurityProvider;

use std::sync::Arc;

use cloud_common::{CredentialManager, Database, FeatureFlags, RedisCache};

use crate::traits::SecurityProvider;

/// Context shared across the security service, holding credentials, cache,
/// feature flags, and the SurrealDB database.
pub struct SecurityContext {
    pub db: Arc<Database>,
    pub credentials: Option<Arc<CredentialManager>>,
    pub cache: Option<Arc<RedisCache>>,
    pub flags: FeatureFlags,
}

/// Factory: return the appropriate security provider based on feature flags.
///
/// When `CLOUD_USE_MOCK_DATA=false` and AWS credentials are available, the real
/// AWS Security Hub / GuardDuty / Inspector provider is returned.  Otherwise the
/// mock provider backed by the SurrealDB store is used.
pub fn get_security_provider(ctx: &SecurityContext) -> Box<dyn SecurityProvider> {
    if ctx.flags.use_real_sdk() {
        if let Some(creds) = &ctx.credentials {
            let cache = ctx.cache.clone();
            // Default to AWS provider when real SDK is enabled.
            // GCP and Azure can be selected via additional configuration.
            return Box::new(AwsSecurityProvider::new(creds.clone(), cache));
        }
    }

    // Fallback: mock provider backed by the SurrealDB store
    Box::new(MockSecurityProvider::new(ctx.db.clone()))
}

/// Get a provider for a specific cloud platform.
pub fn get_provider_for_cloud(
    cloud: &str,
    ctx: &SecurityContext,
) -> Box<dyn SecurityProvider> {
    if ctx.flags.use_real_sdk() {
        if let Some(creds) = &ctx.credentials {
            let cache = ctx.cache.clone();
            match cloud.to_lowercase().as_str() {
                "aws" => return Box::new(AwsSecurityProvider::new(creds.clone(), cache)),
                "gcp" => {
                    let project_id = std::env::var("GCP_PROJECT_ID").unwrap_or_default();
                    return Box::new(GcpSecurityProvider::new(creds.clone(), project_id));
                }
                "azure" => {
                    let subscription_id =
                        std::env::var("AZURE_SUBSCRIPTION_ID").unwrap_or_default();
                    return Box::new(AzureSecurityProvider::new(
                        creds.clone(),
                        subscription_id,
                    ));
                }
                _ => {}
            }
        }
    }

    // Fallback to mock
    Box::new(MockSecurityProvider::new(ctx.db.clone()))
}
