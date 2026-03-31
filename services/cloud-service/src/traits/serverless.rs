use async_trait::async_trait;

use crate::error::CloudError;
use crate::models::{CloudResource, CreateFunctionRequest};

pub type Result<T> = std::result::Result<T, CloudError>;

#[async_trait]
pub trait ServerlessProvider: Send + Sync {
    /// List all serverless functions in a region.
    async fn list_functions(&self, region: &str) -> Result<Vec<CloudResource>>;

    /// Get a specific function by name.
    async fn get_function(&self, region: &str, name: &str) -> Result<CloudResource>;

    /// Create a new serverless function.
    async fn create_function(
        &self,
        region: &str,
        config: CreateFunctionRequest,
    ) -> Result<CloudResource>;

    /// Update function code with a new zip deployment package.
    async fn update_function_code(
        &self,
        region: &str,
        name: &str,
        zip_bytes: Vec<u8>,
    ) -> Result<CloudResource>;

    /// Delete a serverless function.
    async fn delete_function(&self, region: &str, name: &str) -> Result<()>;

    /// Invoke a serverless function synchronously.
    async fn invoke_function(
        &self,
        region: &str,
        name: &str,
        payload: serde_json::Value,
    ) -> Result<serde_json::Value>;

    /// List all published versions of a function.
    async fn list_function_versions(
        &self,
        region: &str,
        name: &str,
    ) -> Result<Vec<CloudResource>>;
}
