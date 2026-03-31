use async_trait::async_trait;

use crate::error::CloudError;
use crate::models::CloudResource;

pub type Result<T> = std::result::Result<T, CloudError>;

#[async_trait]
pub trait NoSqlProvider: Send + Sync {
    /// List all NoSQL tables in a region.
    async fn list_tables(&self, region: &str) -> Result<Vec<CloudResource>>;

    /// Get a specific NoSQL table by name.
    async fn get_table(&self, region: &str, name: &str) -> Result<CloudResource>;

    /// Create a new NoSQL table with the given key schema.
    async fn create_table(
        &self,
        region: &str,
        name: &str,
        key_schema: serde_json::Value,
    ) -> Result<CloudResource>;

    /// Delete a NoSQL table.
    async fn delete_table(&self, region: &str, name: &str) -> Result<()>;

    /// Describe a NoSQL table (returns full metadata).
    async fn describe_table(&self, region: &str, name: &str) -> Result<serde_json::Value>;
}
