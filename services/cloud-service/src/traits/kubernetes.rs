use async_trait::async_trait;

use crate::error::CloudError;
use crate::models::{CloudResource, CreateClusterRequest, CreateNodeGroupRequest};

pub type Result<T> = std::result::Result<T, CloudError>;

#[async_trait]
pub trait KubernetesProvider: Send + Sync {
    /// List all Kubernetes clusters in a region.
    async fn list_clusters(&self, region: &str) -> Result<Vec<CloudResource>>;

    /// Get details of a specific Kubernetes cluster.
    async fn get_cluster(&self, region: &str, name: &str) -> Result<CloudResource>;

    /// Create a new Kubernetes cluster.
    async fn create_cluster(
        &self,
        region: &str,
        config: CreateClusterRequest,
    ) -> Result<CloudResource>;

    /// Delete a Kubernetes cluster.
    async fn delete_cluster(&self, region: &str, name: &str) -> Result<()>;

    /// List node groups for a cluster.
    async fn list_node_groups(
        &self,
        region: &str,
        cluster_name: &str,
    ) -> Result<Vec<CloudResource>>;

    /// Create a node group in a cluster.
    async fn create_node_group(
        &self,
        region: &str,
        cluster_name: &str,
        config: CreateNodeGroupRequest,
    ) -> Result<CloudResource>;

    /// Delete a node group.
    async fn delete_node_group(
        &self,
        region: &str,
        cluster_name: &str,
        node_group_name: &str,
    ) -> Result<()>;

    /// Scale a node group to a desired size.
    async fn scale_node_group(
        &self,
        region: &str,
        cluster_name: &str,
        node_group_name: &str,
        desired: i32,
    ) -> Result<()>;
}
