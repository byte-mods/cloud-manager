use async_trait::async_trait;

use crate::error::CloudError;
use crate::models::CloudResource;

pub type Result<T> = std::result::Result<T, CloudError>;

#[async_trait]
pub trait IamProvider: Send + Sync {
    /// List all IAM users.
    async fn list_users(&self, region: &str) -> Result<Vec<CloudResource>>;

    /// Create a new IAM user.
    async fn create_user(&self, region: &str, username: &str) -> Result<CloudResource>;

    /// Delete an IAM user.
    async fn delete_user(&self, region: &str, username: &str) -> Result<()>;

    /// List all IAM roles.
    async fn list_roles(&self, region: &str) -> Result<Vec<CloudResource>>;

    /// Create a new IAM role with a trust policy.
    async fn create_role(&self, region: &str, name: &str, trust_policy: &str) -> Result<CloudResource>;

    /// Delete an IAM role.
    async fn delete_role(&self, region: &str, name: &str) -> Result<()>;

    /// List all IAM policies.
    async fn list_policies(&self, region: &str) -> Result<Vec<CloudResource>>;

    /// Attach a policy to a target (user or role ARN).
    async fn attach_policy(&self, region: &str, target: &str, policy_arn: &str) -> Result<()>;

    /// Detach a policy from a target (user or role ARN).
    async fn detach_policy(&self, region: &str, target: &str, policy_arn: &str) -> Result<()>;
}
