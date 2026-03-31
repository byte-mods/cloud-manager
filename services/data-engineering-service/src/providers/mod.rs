pub mod aws_data_engineering;
pub mod mock;

use std::sync::Arc;

use cloud_common::{CredentialManager, Database, FeatureFlags, RedisCache};

use crate::traits::DataPipelineProvider;

/// Shared context for creating providers.
pub struct ProviderContext {
    pub db: Arc<Database>,
    pub credentials: Option<Arc<CredentialManager>>,
    pub cache: Option<Arc<RedisCache>>,
    pub flags: FeatureFlags,
}

/// Factory: return the appropriate `DataPipelineProvider` based on feature flags.
pub fn get_data_pipeline_provider(ctx: &ProviderContext) -> Arc<dyn DataPipelineProvider> {
    if ctx.flags.use_real_sdk() {
        if let Some(creds) = &ctx.credentials {
            let region = std::env::var("AWS_DEFAULT_REGION")
                .unwrap_or_else(|_| "us-east-1".to_owned());
            tracing::info!(region = %region, "Using AWS SDK data-engineering provider");
            return Arc::new(aws_data_engineering::AwsDataEngineeringProvider::new(
                creds.clone(),
                ctx.cache.clone(),
                region,
            ));
        }
        tracing::warn!("Real SDK requested but no credentials available — falling back to mock");
    }

    tracing::info!("Using mock data-engineering provider");
    Arc::new(mock::MockDataPipelineProvider::new(ctx.db.clone()))
}
