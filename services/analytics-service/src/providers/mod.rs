pub mod aws_analytics;
pub mod mock;

use std::sync::Arc;

use cloud_common::{CredentialManager, Database, FeatureFlags, RedisCache};

use crate::traits::QueryEngineProvider;

/// Shared context for creating providers.
pub struct ProviderContext {
    pub db: Arc<Database>,
    pub credentials: Option<Arc<CredentialManager>>,
    pub cache: Option<Arc<RedisCache>>,
    pub flags: FeatureFlags,
}

/// Factory: return the appropriate `QueryEngineProvider` based on feature flags.
pub fn get_query_engine_provider(ctx: &ProviderContext) -> Arc<dyn QueryEngineProvider> {
    if ctx.flags.use_real_sdk() {
        if let Some(creds) = &ctx.credentials {
            let region = std::env::var("AWS_DEFAULT_REGION")
                .unwrap_or_else(|_| "us-east-1".to_owned());
            let output_location = std::env::var("ATHENA_OUTPUT_LOCATION")
                .unwrap_or_else(|_| "s3://aws-athena-query-results/".to_owned());
            tracing::info!(region = %region, "Using AWS SDK analytics provider (Athena)");
            return Arc::new(aws_analytics::AwsAnalyticsProvider::new(
                creds.clone(),
                ctx.cache.clone(),
                region,
                output_location,
            ));
        }
        tracing::warn!("Real SDK requested but no credentials available — falling back to mock");
    }

    tracing::info!("Using mock analytics provider");
    Arc::new(mock::MockQueryEngineProvider::new(ctx.db.clone()))
}
