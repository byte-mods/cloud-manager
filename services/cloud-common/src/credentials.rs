use std::sync::Arc;
use tracing::{info, warn};

use crate::error::CloudSdkError;

/// Type alias for the GCP token provider.
pub type GcpTokenProvider = Arc<dyn gcp_auth::TokenProvider>;

/// Unified credential manager for AWS, GCP, and Azure.
///
/// Lazily initializes credentials for each provider on first access.
/// Supports environment-based configuration following each provider's standard patterns:
/// - AWS: AWS_ACCESS_KEY_ID/AWS_SECRET_ACCESS_KEY, ~/.aws/credentials, IAM roles
/// - GCP: GOOGLE_APPLICATION_CREDENTIALS, application default credentials
/// - Azure: AZURE_CLIENT_ID/AZURE_TENANT_ID/AZURE_CLIENT_SECRET, managed identity, Azure CLI
pub struct CredentialManager {
    aws_config: Option<aws_config::SdkConfig>,
    gcp_provider: Option<GcpTokenProvider>,
    azure_credential: Option<Arc<azure_identity::DefaultAzureCredential>>,
}

impl CredentialManager {
    /// Create a new credential manager, initializing all available providers.
    /// Providers that fail to initialize are logged as warnings but don't fail the entire init.
    pub async fn new() -> Self {
        let aws_config = match Self::init_aws().await {
            Ok(cfg) => {
                info!("AWS credentials initialized successfully");
                Some(cfg)
            }
            Err(e) => {
                warn!("AWS credentials not available: {e}");
                None
            }
        };

        let gcp_provider = match Self::init_gcp().await {
            Ok(provider) => {
                info!("GCP credentials initialized successfully");
                Some(provider)
            }
            Err(e) => {
                warn!("GCP credentials not available: {e}");
                None
            }
        };

        let azure_credential = match Self::init_azure() {
            Ok(cred) => {
                info!("Azure credentials initialized successfully");
                Some(cred)
            }
            Err(e) => {
                warn!("Azure credentials not available: {e}");
                None
            }
        };

        Self {
            aws_config,
            gcp_provider,
            azure_credential,
        }
    }

    async fn init_aws() -> Result<aws_config::SdkConfig, CloudSdkError> {
        let config = aws_config::from_env().load().await;

        // Validate credentials by calling STS GetCallerIdentity
        let sts_client = aws_sdk_sts::Client::new(&config);
        sts_client
            .get_caller_identity()
            .send()
            .await
            .map_err(|e| {
                CloudSdkError::AuthenticationFailed(format!("AWS STS validation failed: {e}"))
            })?;

        Ok(config)
    }

    async fn init_gcp() -> Result<GcpTokenProvider, CloudSdkError> {
        let provider = gcp_auth::provider().await.map_err(|e| {
            CloudSdkError::AuthenticationFailed(format!("GCP auth init failed: {e}"))
        })?;

        // Validate by fetching a token
        provider
            .token(&["https://www.googleapis.com/auth/cloud-platform"])
            .await
            .map_err(|e| {
                CloudSdkError::AuthenticationFailed(format!("GCP token fetch failed: {e}"))
            })?;

        Ok(provider)
    }

    fn init_azure() -> Result<Arc<azure_identity::DefaultAzureCredential>, CloudSdkError> {
        let credential =
            azure_identity::DefaultAzureCredential::new().map_err(|e| {
                CloudSdkError::AuthenticationFailed(format!(
                    "Azure credential init failed: {e}"
                ))
            })?;
        Ok(credential)
    }

    /// Get the AWS SDK configuration. Returns an error if AWS credentials are not available.
    pub fn aws_config(&self) -> Result<&aws_config::SdkConfig, CloudSdkError> {
        self.aws_config.as_ref().ok_or_else(|| {
            CloudSdkError::AuthenticationFailed("AWS credentials not configured".into())
        })
    }

    /// Get an AWS SDK config for a specific region.
    pub fn aws_config_for_region(
        &self,
        region: &str,
    ) -> Result<aws_config::SdkConfig, CloudSdkError> {
        let base = self.aws_config()?;
        let config = base
            .to_builder()
            .region(aws_types::region::Region::new(region.to_owned()))
            .build();
        Ok(config)
    }

    /// Get the GCP token provider.
    pub fn gcp_provider(&self) -> Result<&GcpTokenProvider, CloudSdkError> {
        self.gcp_provider.as_ref().ok_or_else(|| {
            CloudSdkError::AuthenticationFailed("GCP credentials not configured".into())
        })
    }

    /// Get a GCP OAuth2 bearer token for the given scopes.
    pub async fn gcp_token(&self, scopes: &[&str]) -> Result<String, CloudSdkError> {
        let provider = self.gcp_provider()?;
        let token = provider.token(scopes).await.map_err(|e| {
            CloudSdkError::Gcp(format!("Failed to get GCP token: {e}"))
        })?;
        Ok(token.as_str().to_owned())
    }

    /// Get the Azure default credential.
    pub fn azure_credential(
        &self,
    ) -> Result<Arc<azure_identity::DefaultAzureCredential>, CloudSdkError> {
        self.azure_credential.clone().ok_or_else(|| {
            CloudSdkError::AuthenticationFailed("Azure credentials not configured".into())
        })
    }

    /// Check which providers have valid credentials.
    pub fn available_providers(&self) -> Vec<&'static str> {
        let mut providers = Vec::new();
        if self.aws_config.is_some() {
            providers.push("aws");
        }
        if self.gcp_provider.is_some() {
            providers.push("gcp");
        }
        if self.azure_credential.is_some() {
            providers.push("azure");
        }
        providers
    }

    /// Assume an IAM role in another AWS account (cross-account access).
    /// Returns a new SdkConfig with temporary credentials from STS AssumeRole.
    pub async fn assume_role(
        &self,
        role_arn: &str,
        session_name: &str,
        region: Option<&str>,
    ) -> Result<aws_config::SdkConfig, CloudSdkError> {
        let base_config = self.aws_config()?;
        let sts_client = aws_sdk_sts::Client::new(base_config);

        let result = sts_client
            .assume_role()
            .role_arn(role_arn)
            .role_session_name(session_name)
            .duration_seconds(3600) // 1 hour
            .send()
            .await
            .map_err(|e| CloudSdkError::Aws(format!("AssumeRole failed for {role_arn}: {e}")))?;

        let creds = result.credentials().ok_or_else(|| {
            CloudSdkError::Aws("AssumeRole returned no credentials".into())
        })?;

        let access_key = creds.access_key_id().to_string();
        let secret_key = creds.secret_access_key().to_string();
        let session_token = creds.session_token().to_string();

        let assumed_creds = aws_credential_types::Credentials::new(
            access_key,
            secret_key,
            Some(session_token),
            Some(std::time::SystemTime::now() + std::time::Duration::from_secs(3600)),
            "cloud-manager-assume-role",
        );

        let region_str = region.unwrap_or("us-east-1");
        let config = aws_config::defaults(aws_config::BehaviorVersion::latest())
            .region(aws_types::region::Region::new(region_str.to_owned()))
            .credentials_provider(assumed_creds)
            .load()
            .await;

        info!("Assumed role {role_arn} in region {region_str}");
        Ok(config)
    }
}
