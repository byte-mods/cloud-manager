use async_trait::async_trait;

use crate::error::CloudError;
use crate::models::{CloudResource, CreateBucketRequest, UploadObjectRequest};

pub type Result<T> = std::result::Result<T, CloudError>;

#[async_trait]
pub trait StorageProvider: Send + Sync {
    /// List all storage buckets in a region.
    async fn list_buckets(&self, region: &str) -> Result<Vec<CloudResource>>;

    /// Get a specific bucket by name.
    async fn get_bucket(&self, region: &str, name: &str) -> Result<CloudResource>;

    /// Create a new storage bucket.
    async fn create_bucket(
        &self,
        region: &str,
        config: CreateBucketRequest,
    ) -> Result<CloudResource>;

    /// Delete a storage bucket.
    async fn delete_bucket(&self, region: &str, name: &str) -> Result<()>;

    /// List objects in a bucket.
    async fn list_objects(
        &self,
        region: &str,
        bucket: &str,
        prefix: Option<&str>,
    ) -> Result<Vec<CloudResource>>;

    /// Upload an object to a bucket.
    async fn upload_object(
        &self,
        region: &str,
        bucket: &str,
        request: UploadObjectRequest,
        data: Vec<u8>,
    ) -> Result<CloudResource>;

    /// Delete an object from a bucket.
    async fn delete_object(
        &self,
        region: &str,
        bucket: &str,
        key: &str,
    ) -> Result<()>;

    /// Get the bucket policy as JSON.
    async fn get_bucket_policy(&self, region: &str, bucket: &str) -> Result<serde_json::Value>;

    /// Set or replace the bucket policy.
    async fn put_bucket_policy(&self, region: &str, bucket: &str, policy: &str) -> Result<()>;

    /// Delete the bucket policy.
    async fn delete_bucket_policy(&self, region: &str, bucket: &str) -> Result<()>;

    /// Get lifecycle rules for a bucket.
    async fn get_lifecycle_rules(&self, region: &str, bucket: &str) -> Result<Vec<serde_json::Value>>;

    /// Set lifecycle rules for a bucket.
    async fn put_lifecycle_rules(&self, region: &str, bucket: &str, rules: Vec<serde_json::Value>) -> Result<()>;

    /// Get bucket encryption configuration.
    async fn get_bucket_encryption(&self, region: &str, bucket: &str) -> Result<serde_json::Value>;

    /// Set bucket encryption configuration.
    async fn put_bucket_encryption(&self, region: &str, bucket: &str, enabled: bool) -> Result<()>;

    /// Get CORS rules for a bucket.
    async fn get_cors_rules(&self, region: &str, bucket: &str) -> Result<serde_json::Value>;

    /// Set CORS rules for a bucket.
    async fn put_cors_rules(&self, region: &str, bucket: &str, rules: serde_json::Value) -> Result<()>;
}
