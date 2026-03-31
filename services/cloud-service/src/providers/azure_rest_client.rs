use std::sync::Arc;
use azure_core::credentials::TokenCredential;
use cloud_common::CredentialManager;
use crate::error::CloudError;

/// Thin REST client for Azure Management API with automatic Bearer token injection.
pub struct AzureRestClient {
    http: reqwest::Client,
    credentials: Arc<CredentialManager>,
    subscription_id: String,
}

impl AzureRestClient {
    pub fn new(credentials: Arc<CredentialManager>, subscription_id: String) -> Self {
        Self {
            http: reqwest::Client::new(),
            credentials,
            subscription_id,
        }
    }

    pub fn subscription_id(&self) -> &str {
        &self.subscription_id
    }

    async fn token(&self) -> Result<String, CloudError> {
        let cred = self
            .credentials
            .azure_credential()
            .map_err(|e| CloudError::ProviderError(e.to_string()))?;

        let token = cred
            .get_token(&["https://management.azure.com/.default"])
            .await
            .map_err(|e| CloudError::ProviderError(format!("Azure token error: {e}")))?;

        Ok(token.token.secret().to_string())
    }

    pub async fn get(&self, path: &str, api_version: &str) -> Result<serde_json::Value, CloudError> {
        let url = format!(
            "https://management.azure.com/subscriptions/{}{path}?api-version={api_version}",
            self.subscription_id
        );
        let token = self.token().await?;

        let resp = self.http.get(&url).bearer_auth(&token).send().await
            .map_err(|e| CloudError::ProviderError(format!("Azure HTTP error: {e}")))?;

        if !resp.status().is_success() {
            let status = resp.status();
            let body = resp.text().await.unwrap_or_default();
            if status.as_u16() == 404 {
                return Err(CloudError::NotFound(body));
            }
            return Err(CloudError::ProviderError(format!("Azure API error {status}: {body}")));
        }

        resp.json().await.map_err(|e| CloudError::ProviderError(format!("Azure JSON error: {e}")))
    }

    pub async fn put(&self, path: &str, api_version: &str, body: &serde_json::Value) -> Result<serde_json::Value, CloudError> {
        let url = format!(
            "https://management.azure.com/subscriptions/{}{path}?api-version={api_version}",
            self.subscription_id
        );
        let token = self.token().await?;

        let resp = self.http.put(&url).bearer_auth(&token).json(body).send().await
            .map_err(|e| CloudError::ProviderError(format!("Azure HTTP error: {e}")))?;

        if !resp.status().is_success() {
            let status = resp.status();
            let body = resp.text().await.unwrap_or_default();
            return Err(CloudError::ProviderError(format!("Azure API error {status}: {body}")));
        }

        resp.json().await.map_err(|e| CloudError::ProviderError(format!("Azure JSON error: {e}")))
    }

    pub async fn delete(&self, path: &str, api_version: &str) -> Result<(), CloudError> {
        let url = format!(
            "https://management.azure.com/subscriptions/{}{path}?api-version={api_version}",
            self.subscription_id
        );
        let token = self.token().await?;

        let resp = self.http.delete(&url).bearer_auth(&token).send().await
            .map_err(|e| CloudError::ProviderError(format!("Azure HTTP error: {e}")))?;

        if !resp.status().is_success() {
            let status = resp.status();
            let body = resp.text().await.unwrap_or_default();
            return Err(CloudError::ProviderError(format!("Azure API error {status}: {body}")));
        }

        Ok(())
    }

    pub async fn post(&self, path: &str, api_version: &str, body: &serde_json::Value) -> Result<serde_json::Value, CloudError> {
        let url = format!(
            "https://management.azure.com/subscriptions/{}{path}?api-version={api_version}",
            self.subscription_id
        );
        let token = self.token().await?;

        let resp = self.http.post(&url).bearer_auth(&token).json(body).send().await
            .map_err(|e| CloudError::ProviderError(format!("Azure HTTP error: {e}")))?;

        if !resp.status().is_success() {
            let status = resp.status();
            let body = resp.text().await.unwrap_or_default();
            return Err(CloudError::ProviderError(format!("Azure API error {status}: {body}")));
        }

        // Some POST endpoints return 202 with no body
        if resp.status().as_u16() == 202 || resp.content_length() == Some(0) {
            return Ok(serde_json::json!({"status": "accepted"}));
        }

        resp.json().await.map_err(|e| CloudError::ProviderError(format!("Azure JSON error: {e}")))
    }
}
