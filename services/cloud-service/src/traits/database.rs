use async_trait::async_trait;

use crate::error::CloudError;
use crate::models::{CloudResource, CreateDatabaseRequest};

pub type Result<T> = std::result::Result<T, CloudError>;

#[async_trait]
pub trait DatabaseProvider: Send + Sync {
    /// List all database instances in a region.
    async fn list_databases(&self, region: &str) -> Result<Vec<CloudResource>>;

    /// Get a specific database instance by ID.
    async fn get_database(&self, region: &str, id: &str) -> Result<CloudResource>;

    /// Create a new database instance.
    async fn create_database(
        &self,
        region: &str,
        config: CreateDatabaseRequest,
    ) -> Result<CloudResource>;

    /// Delete a database instance.
    async fn delete_database(&self, region: &str, id: &str) -> Result<()>;

    /// Restart a database instance.
    async fn restart_database(&self, region: &str, id: &str) -> Result<()>;

    /// Create a snapshot of a database.
    async fn create_snapshot(
        &self,
        region: &str,
        db_id: &str,
        snapshot_name: &str,
    ) -> Result<CloudResource>;

    /// Create a read replica of a database instance.
    async fn create_read_replica(
        &self,
        region: &str,
        source_db_id: &str,
        replica_name: &str,
    ) -> Result<CloudResource>;

    /// List database parameter groups.
    async fn list_parameter_groups(&self, region: &str) -> Result<Vec<CloudResource>>;

    /// Get a specific parameter group's details.
    async fn get_parameter_group(&self, region: &str, name: &str) -> Result<serde_json::Value>;

    /// Restore a database to a specific point in time.
    async fn restore_to_point_in_time(
        &self,
        region: &str,
        source_db_id: &str,
        target_name: &str,
        restore_time: &str,
    ) -> Result<CloudResource>;
}
