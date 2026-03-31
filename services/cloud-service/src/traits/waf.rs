use async_trait::async_trait;
use crate::error::CloudError;
use crate::models::CloudResource;

pub type Result<T> = std::result::Result<T, CloudError>;

#[async_trait]
pub trait WafProvider: Send + Sync {
    /// List all WAF web ACLs (AWS WAFv2, Cloud Armor, Azure WAF).
    async fn list_web_acls(&self, region: &str) -> Result<Vec<CloudResource>>;

    /// Get a specific web ACL.
    async fn get_web_acl(&self, region: &str, id: &str) -> Result<CloudResource>;

    /// List rules in a web ACL.
    async fn list_rules(&self, region: &str, acl_id: &str) -> Result<Vec<CloudResource>>;

    /// Create a new web ACL.
    async fn create_web_acl(&self, region: &str, name: &str) -> Result<CloudResource>;

    /// Delete a web ACL.
    async fn delete_web_acl(&self, region: &str, id: &str) -> Result<()>;
}
