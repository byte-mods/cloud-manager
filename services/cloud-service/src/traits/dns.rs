use async_trait::async_trait;

use crate::error::CloudError;
use crate::models::{CloudResource, DnsRecordInput};

pub type Result<T> = std::result::Result<T, CloudError>;

#[async_trait]
pub trait DnsProvider: Send + Sync {
    /// List all hosted zones / DNS zones.
    async fn list_hosted_zones(&self, region: &str) -> Result<Vec<CloudResource>>;

    /// List DNS records in a specific zone.
    async fn list_records(&self, region: &str, zone_id: &str) -> Result<Vec<CloudResource>>;

    /// Create a DNS record in a zone.
    async fn create_record(&self, region: &str, zone_id: &str, record: DnsRecordInput) -> Result<CloudResource>;

    /// Delete a DNS record from a zone.
    async fn delete_record(&self, region: &str, zone_id: &str, record: DnsRecordInput) -> Result<()>;
}
