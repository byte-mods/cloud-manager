use std::sync::Arc;
use cloud_common::CredentialManager;
use crate::error::CloudError;

/// Thin REST client for GCP APIs with automatic OAuth2 token injection.
pub struct GcpRestClient {
    http: reqwest::Client,
    credentials: Arc<CredentialManager>,
    project_id: String,
}

impl GcpRestClient {
    pub fn new(credentials: Arc<CredentialManager>, project_id: String) -> Self {
        Self {
            http: reqwest::Client::new(),
            credentials,
            project_id,
        }
    }

    pub fn project_id(&self) -> &str {
        &self.project_id
    }

    /// Make an authenticated GET request to a GCP API endpoint.
    pub async fn get(&self, url: &str) -> Result<serde_json::Value, CloudError> {
        let token = self
            .credentials
            .gcp_token(&["https://www.googleapis.com/auth/cloud-platform"])
            .await
            .map_err(|e| CloudError::ProviderError(e.to_string()))?;

        let resp = self
            .http
            .get(url)
            .bearer_auth(&token)
            .send()
            .await
            .map_err(|e| CloudError::ProviderError(format!("GCP HTTP error: {e}")))?;

        if !resp.status().is_success() {
            let status = resp.status();
            let body = resp.text().await.unwrap_or_default();
            if status.as_u16() == 404 {
                return Err(CloudError::NotFound(body));
            }
            return Err(CloudError::ProviderError(format!(
                "GCP API error {status}: {body}"
            )));
        }

        resp.json()
            .await
            .map_err(|e| CloudError::ProviderError(format!("GCP JSON parse error: {e}")))
    }

    /// Make an authenticated POST request to a GCP API endpoint.
    pub async fn post(
        &self,
        url: &str,
        body: &serde_json::Value,
    ) -> Result<serde_json::Value, CloudError> {
        let token = self
            .credentials
            .gcp_token(&["https://www.googleapis.com/auth/cloud-platform"])
            .await
            .map_err(|e| CloudError::ProviderError(e.to_string()))?;

        let resp = self
            .http
            .post(url)
            .bearer_auth(&token)
            .json(body)
            .send()
            .await
            .map_err(|e| CloudError::ProviderError(format!("GCP HTTP error: {e}")))?;

        if !resp.status().is_success() {
            let status = resp.status();
            let body = resp.text().await.unwrap_or_default();
            return Err(CloudError::ProviderError(format!(
                "GCP API error {status}: {body}"
            )));
        }

        resp.json()
            .await
            .map_err(|e| CloudError::ProviderError(format!("GCP JSON parse error: {e}")))
    }

    /// Make an authenticated DELETE request.
    pub async fn delete(&self, url: &str) -> Result<(), CloudError> {
        let token = self
            .credentials
            .gcp_token(&["https://www.googleapis.com/auth/cloud-platform"])
            .await
            .map_err(|e| CloudError::ProviderError(e.to_string()))?;

        let resp = self
            .http
            .delete(url)
            .bearer_auth(&token)
            .send()
            .await
            .map_err(|e| CloudError::ProviderError(format!("GCP HTTP error: {e}")))?;

        if !resp.status().is_success() {
            let status = resp.status();
            let body = resp.text().await.unwrap_or_default();
            return Err(CloudError::ProviderError(format!(
                "GCP API error {status}: {body}"
            )));
        }

        Ok(())
    }

    /// List all zones in a region (e.g., "us-central1" → ["us-central1-a", "us-central1-b", ...]).
    pub async fn zones_in_region(&self, region: &str) -> Result<Vec<String>, CloudError> {
        let url = format!(
            "https://compute.googleapis.com/compute/v1/projects/{}/zones",
            self.project_id
        );
        let data = self.get(&url).await?;
        let zones: Vec<String> = data["items"]
            .as_array()
            .unwrap_or(&vec![])
            .iter()
            .filter_map(|z| z["name"].as_str().map(|s| s.to_owned()))
            .filter(|z| z.starts_with(region))
            .collect();
        Ok(zones)
    }
}
