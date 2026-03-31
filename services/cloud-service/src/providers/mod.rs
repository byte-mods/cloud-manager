pub mod aws;
pub mod aws_mapper;
pub mod aws_sdk;
pub mod azure;
pub mod azure_mapper;
pub mod azure_rest_client;
pub mod azure_sdk;
pub mod gcp;
pub mod gcp_mapper;
pub mod gcp_rest_client;
pub mod gcp_sdk;
pub mod store;

pub use aws::AwsProvider;
pub use aws_sdk::AwsSdkProvider;
pub use azure::AzureProvider;
pub use azure_sdk::AzureSdkProvider;
pub use gcp::GcpProvider;
pub use gcp_sdk::GcpSdkProvider;
pub use store::InMemoryStore;

use std::sync::Arc;

use cloud_common::{CredentialManager, FeatureFlags, RedisCache};

use crate::models::CloudProvider;
use crate::traits::{ApiGatewayProvider, CacheDbProvider, CdnProvider, ComputeProvider, ContainerRegistryProvider, DatabaseProvider, IoTProvider, KubernetesProvider, MlProvider, NetworkingProvider, NoSqlProvider, ServerlessProvider, StorageProvider, TrafficProvider, WorkflowProvider};

/// Context passed to factory functions for creating providers.
pub struct ProviderContext {
    pub store: Arc<InMemoryStore>,
    pub credentials: Option<Arc<CredentialManager>>,
    pub cache: Option<Arc<RedisCache>>,
    pub flags: FeatureFlags,
}

fn gcp_project_id() -> String {
    std::env::var("GCP_PROJECT_ID").unwrap_or_default()
}

fn azure_subscription_id() -> String {
    std::env::var("AZURE_SUBSCRIPTION_ID").unwrap_or_default()
}

/// Factory function to get a compute provider for the given cloud provider.
/// Uses real SDK when `CLOUD_USE_MOCK_DATA=false` and credentials are available.
pub fn get_compute_provider(
    provider: CloudProvider,
    ctx: &ProviderContext,
) -> Box<dyn ComputeProvider> {
    if ctx.flags.use_real_sdk() {
        if let (Some(creds), Some(cache)) = (&ctx.credentials, &ctx.cache) {
            match provider {
                CloudProvider::Aws => {
                    return Box::new(AwsSdkProvider::new(creds.clone(), cache.clone(), "us-east-1".to_owned()));
                }
                CloudProvider::Gcp => {
                    return Box::new(GcpSdkProvider::new(creds.clone(), cache.clone(), gcp_project_id()));
                }
                CloudProvider::Azure => {
                    return Box::new(AzureSdkProvider::new(creds.clone(), cache.clone(), azure_subscription_id()));
                }
            }
        }
    }

    // Fallback to mock
    match provider {
        CloudProvider::Aws => Box::new(AwsProvider::new(provider, ctx.store.clone())),
        CloudProvider::Gcp => Box::new(GcpProvider::new(provider, ctx.store.clone())),
        CloudProvider::Azure => Box::new(AzureProvider::new(provider, ctx.store.clone())),
    }
}

/// Factory function to get a storage provider for the given cloud provider.
pub fn get_storage_provider(
    provider: CloudProvider,
    ctx: &ProviderContext,
) -> Box<dyn StorageProvider> {
    if ctx.flags.use_real_sdk() {
        if let (Some(creds), Some(cache)) = (&ctx.credentials, &ctx.cache) {
            match provider {
                CloudProvider::Aws => {
                    return Box::new(AwsSdkProvider::new(creds.clone(), cache.clone(), "us-east-1".to_owned()));
                }
                CloudProvider::Gcp => {
                    return Box::new(GcpSdkProvider::new(creds.clone(), cache.clone(), gcp_project_id()));
                }
                CloudProvider::Azure => {
                    return Box::new(AzureSdkProvider::new(creds.clone(), cache.clone(), azure_subscription_id()));
                }
            }
        }
    }

    match provider {
        CloudProvider::Aws => Box::new(AwsProvider::new(provider, ctx.store.clone())),
        CloudProvider::Gcp => Box::new(GcpProvider::new(provider, ctx.store.clone())),
        CloudProvider::Azure => Box::new(AzureProvider::new(provider, ctx.store.clone())),
    }
}

/// Factory function to get a networking provider for the given cloud provider.
pub fn get_networking_provider(
    provider: CloudProvider,
    ctx: &ProviderContext,
) -> Box<dyn NetworkingProvider> {
    if ctx.flags.use_real_sdk() {
        if let (Some(creds), Some(cache)) = (&ctx.credentials, &ctx.cache) {
            match provider {
                CloudProvider::Aws => {
                    return Box::new(AwsSdkProvider::new(creds.clone(), cache.clone(), "us-east-1".to_owned()));
                }
                CloudProvider::Gcp => {
                    return Box::new(GcpSdkProvider::new(creds.clone(), cache.clone(), gcp_project_id()));
                }
                CloudProvider::Azure => {
                    return Box::new(AzureSdkProvider::new(creds.clone(), cache.clone(), azure_subscription_id()));
                }
            }
        }
    }

    match provider {
        CloudProvider::Aws => Box::new(AwsProvider::new(provider, ctx.store.clone())),
        CloudProvider::Gcp => Box::new(GcpProvider::new(provider, ctx.store.clone())),
        CloudProvider::Azure => Box::new(AzureProvider::new(provider, ctx.store.clone())),
    }
}

/// Factory function to get a database provider for the given cloud provider.
pub fn get_database_provider(
    provider: CloudProvider,
    ctx: &ProviderContext,
) -> Box<dyn DatabaseProvider> {
    if ctx.flags.use_real_sdk() {
        if let (Some(creds), Some(cache)) = (&ctx.credentials, &ctx.cache) {
            match provider {
                CloudProvider::Aws => {
                    return Box::new(AwsSdkProvider::new(creds.clone(), cache.clone(), "us-east-1".to_owned()));
                }
                CloudProvider::Gcp => {
                    return Box::new(GcpSdkProvider::new(creds.clone(), cache.clone(), gcp_project_id()));
                }
                CloudProvider::Azure => {
                    return Box::new(AzureSdkProvider::new(creds.clone(), cache.clone(), azure_subscription_id()));
                }
            }
        }
    }

    match provider {
        CloudProvider::Aws => Box::new(AwsProvider::new(provider, ctx.store.clone())),
        CloudProvider::Gcp => Box::new(GcpProvider::new(provider, ctx.store.clone())),
        CloudProvider::Azure => Box::new(AzureProvider::new(provider, ctx.store.clone())),
    }
}

/// Factory function to get a serverless provider for the given cloud provider.
pub fn get_serverless_provider(
    provider: CloudProvider,
    ctx: &ProviderContext,
) -> Box<dyn ServerlessProvider> {
    if ctx.flags.use_real_sdk() {
        if let (Some(creds), Some(cache)) = (&ctx.credentials, &ctx.cache) {
            match provider {
                CloudProvider::Aws => {
                    return Box::new(AwsSdkProvider::new(creds.clone(), cache.clone(), "us-east-1".to_owned()));
                }
                CloudProvider::Gcp => {
                    return Box::new(GcpSdkProvider::new(creds.clone(), cache.clone(), gcp_project_id()));
                }
                CloudProvider::Azure => {
                    return Box::new(AzureSdkProvider::new(creds.clone(), cache.clone(), azure_subscription_id()));
                }
            }
        }
    }

    match provider {
        CloudProvider::Aws => Box::new(AwsProvider::new(provider, ctx.store.clone())),
        CloudProvider::Gcp => Box::new(GcpProvider::new(provider, ctx.store.clone())),
        CloudProvider::Azure => Box::new(AzureProvider::new(provider, ctx.store.clone())),
    }
}

/// Factory function to get an API Gateway provider for the given cloud provider.
pub fn get_api_gateway_provider(
    provider: CloudProvider,
    ctx: &ProviderContext,
) -> Box<dyn ApiGatewayProvider> {
    if ctx.flags.use_real_sdk() {
        if let (Some(creds), Some(cache)) = (&ctx.credentials, &ctx.cache) {
            if provider == CloudProvider::Aws {
                return Box::new(AwsSdkProvider::new(creds.clone(), cache.clone(), "us-east-1".to_owned()));
            }
        }
    }

    match provider {
        CloudProvider::Aws => Box::new(AwsProvider::new(provider, ctx.store.clone())),
        CloudProvider::Gcp => Box::new(GcpProvider::new(provider, ctx.store.clone())),
        CloudProvider::Azure => Box::new(AzureProvider::new(provider, ctx.store.clone())),
    }
}

/// Factory function to get a CDN provider for the given cloud provider.
pub fn get_cdn_provider(
    provider: CloudProvider,
    ctx: &ProviderContext,
) -> Box<dyn CdnProvider> {
    if ctx.flags.use_real_sdk() {
        if let (Some(creds), Some(cache)) = (&ctx.credentials, &ctx.cache) {
            if provider == CloudProvider::Aws {
                return Box::new(AwsSdkProvider::new(creds.clone(), cache.clone(), "us-east-1".to_owned()));
            }
        }
    }

    match provider {
        CloudProvider::Aws => Box::new(AwsProvider::new(provider, ctx.store.clone())),
        CloudProvider::Gcp => Box::new(GcpProvider::new(provider, ctx.store.clone())),
        CloudProvider::Azure => Box::new(AzureProvider::new(provider, ctx.store.clone())),
    }
}

/// Factory function to get a traffic provider for the given cloud provider.
pub fn get_traffic_provider(
    provider: CloudProvider,
    ctx: &ProviderContext,
) -> Box<dyn TrafficProvider> {
    match provider {
        CloudProvider::Aws => Box::new(AwsProvider::new(provider, ctx.store.clone())),
        CloudProvider::Gcp => Box::new(GcpProvider::new(provider, ctx.store.clone())),
        CloudProvider::Azure => Box::new(AzureProvider::new(provider, ctx.store.clone())),
    }
}

/// Factory function to get a kubernetes provider for the given cloud provider.
pub fn get_kubernetes_provider(
    provider: CloudProvider,
    ctx: &ProviderContext,
) -> Box<dyn KubernetesProvider> {
    match provider {
        CloudProvider::Aws => Box::new(AwsProvider::new(provider, ctx.store.clone())),
        CloudProvider::Gcp => Box::new(GcpProvider::new(provider, ctx.store.clone())),
        CloudProvider::Azure => Box::new(AzureProvider::new(provider, ctx.store.clone())),
    }
}

/// Factory function to get a NoSQL provider for the given cloud provider.
pub fn get_nosql_provider(
    provider: CloudProvider,
    ctx: &ProviderContext,
) -> Box<dyn NoSqlProvider> {
    if ctx.flags.use_real_sdk() {
        if let (Some(creds), Some(cache)) = (&ctx.credentials, &ctx.cache) {
            if provider == CloudProvider::Aws {
                return Box::new(AwsSdkProvider::new(creds.clone(), cache.clone(), "us-east-1".to_owned()));
            }
        }
    }

    match provider {
        CloudProvider::Aws => Box::new(AwsProvider::new(provider, ctx.store.clone())),
        CloudProvider::Gcp => Box::new(GcpProvider::new(provider, ctx.store.clone())),
        CloudProvider::Azure => Box::new(AzureProvider::new(provider, ctx.store.clone())),
    }
}

/// Factory function to get a cache DB provider for the given cloud provider.
pub fn get_cache_db_provider(
    provider: CloudProvider,
    ctx: &ProviderContext,
) -> Box<dyn CacheDbProvider> {
    if ctx.flags.use_real_sdk() {
        if let (Some(creds), Some(cache)) = (&ctx.credentials, &ctx.cache) {
            if provider == CloudProvider::Aws {
                return Box::new(AwsSdkProvider::new(creds.clone(), cache.clone(), "us-east-1".to_owned()));
            }
        }
    }

    match provider {
        CloudProvider::Aws => Box::new(AwsProvider::new(provider, ctx.store.clone())),
        CloudProvider::Gcp => Box::new(GcpProvider::new(provider, ctx.store.clone())),
        CloudProvider::Azure => Box::new(AzureProvider::new(provider, ctx.store.clone())),
    }
}

/// Factory function to get an IoT provider for the given cloud provider.
pub fn get_iot_provider(
    provider: CloudProvider,
    ctx: &ProviderContext,
) -> Box<dyn IoTProvider> {
    match provider {
        CloudProvider::Aws => Box::new(AwsProvider::new(provider, ctx.store.clone())),
        CloudProvider::Gcp => Box::new(GcpProvider::new(provider, ctx.store.clone())),
        CloudProvider::Azure => Box::new(AzureProvider::new(provider, ctx.store.clone())),
    }
}

/// Factory function to get an ML provider for the given cloud provider.
pub fn get_ml_provider(
    provider: CloudProvider,
    ctx: &ProviderContext,
) -> Box<dyn MlProvider> {
    match provider {
        CloudProvider::Aws => Box::new(AwsProvider::new(provider, ctx.store.clone())),
        CloudProvider::Gcp => Box::new(GcpProvider::new(provider, ctx.store.clone())),
        CloudProvider::Azure => Box::new(AzureProvider::new(provider, ctx.store.clone())),
    }
}

/// Factory function to get a container registry provider for the given cloud provider.
pub fn get_container_registry_provider(
    provider: CloudProvider,
    ctx: &ProviderContext,
) -> Box<dyn ContainerRegistryProvider> {
    if ctx.flags.use_real_sdk() {
        if let (Some(creds), Some(cache)) = (&ctx.credentials, &ctx.cache) {
            if provider == CloudProvider::Aws {
                return Box::new(AwsSdkProvider::new(creds.clone(), cache.clone(), "us-east-1".to_owned()));
            }
        }
    }

    match provider {
        CloudProvider::Aws => Box::new(AwsProvider::new(provider, ctx.store.clone())),
        CloudProvider::Gcp => Box::new(GcpProvider::new(provider, ctx.store.clone())),
        CloudProvider::Azure => Box::new(AzureProvider::new(provider, ctx.store.clone())),
    }
}

/// Factory function to get a workflow provider for the given cloud provider.
pub fn get_workflow_provider(
    provider: CloudProvider,
    ctx: &ProviderContext,
) -> Box<dyn WorkflowProvider> {
    if ctx.flags.use_real_sdk() {
        if let (Some(creds), Some(cache)) = (&ctx.credentials, &ctx.cache) {
            if provider == CloudProvider::Aws {
                return Box::new(AwsSdkProvider::new(creds.clone(), cache.clone(), "us-east-1".to_owned()));
            }
        }
    }

    match provider {
        CloudProvider::Aws => Box::new(AwsProvider::new(provider, ctx.store.clone())),
        CloudProvider::Gcp => Box::new(GcpProvider::new(provider, ctx.store.clone())),
        CloudProvider::Azure => Box::new(AzureProvider::new(provider, ctx.store.clone())),
    }
}
