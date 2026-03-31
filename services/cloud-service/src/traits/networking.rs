use async_trait::async_trait;

use crate::error::CloudError;
use crate::models::{CloudResource, CreateSubnetRequest, CreateVpcRequest, SecurityGroupRule};

pub type Result<T> = std::result::Result<T, CloudError>;

#[async_trait]
pub trait NetworkingProvider: Send + Sync {
    /// List all VPCs in a region.
    async fn list_vpcs(&self, region: &str) -> Result<Vec<CloudResource>>;

    /// Get a specific VPC by ID.
    async fn get_vpc(&self, region: &str, id: &str) -> Result<CloudResource>;

    /// Create a new VPC.
    async fn create_vpc(
        &self,
        region: &str,
        config: CreateVpcRequest,
    ) -> Result<CloudResource>;

    /// Delete a VPC.
    async fn delete_vpc(&self, region: &str, id: &str) -> Result<()>;

    /// List subnets in a VPC.
    async fn list_subnets(
        &self,
        region: &str,
        vpc_id: &str,
    ) -> Result<Vec<CloudResource>>;

    /// Create a subnet within a VPC.
    async fn create_subnet(
        &self,
        region: &str,
        config: CreateSubnetRequest,
    ) -> Result<CloudResource>;

    /// Delete a subnet.
    async fn delete_subnet(&self, region: &str, id: &str) -> Result<()>;

    /// List load balancers in a region.
    async fn list_load_balancers(&self, region: &str) -> Result<Vec<CloudResource>>;

    /// Get a specific load balancer.
    async fn get_load_balancer(&self, region: &str, id: &str) -> Result<CloudResource>;

    /// Delete a load balancer.
    async fn delete_load_balancer(&self, region: &str, id: &str) -> Result<()>;

    /// List security groups in a region.
    async fn list_security_groups(&self, region: &str) -> Result<Vec<CloudResource>>;

    // --- Elastic IPs ---

    /// List all Elastic IPs in a region.
    async fn list_elastic_ips(&self, region: &str) -> Result<Vec<CloudResource>>;

    /// Allocate a new Elastic IP.
    async fn allocate_elastic_ip(&self, region: &str) -> Result<CloudResource>;

    /// Associate an Elastic IP with an instance.
    async fn associate_elastic_ip(&self, region: &str, eip_id: &str, instance_id: &str) -> Result<()>;

    /// Disassociate an Elastic IP.
    async fn disassociate_elastic_ip(&self, region: &str, association_id: &str) -> Result<()>;

    /// Release an Elastic IP.
    async fn release_elastic_ip(&self, region: &str, allocation_id: &str) -> Result<()>;

    // --- NAT Gateway ---

    /// List NAT gateways in a region.
    async fn list_nat_gateways(&self, region: &str) -> Result<Vec<CloudResource>>;

    /// Create a NAT gateway.
    async fn create_nat_gateway(&self, region: &str, subnet_id: &str, eip_allocation_id: &str) -> Result<CloudResource>;

    /// Delete a NAT gateway.
    async fn delete_nat_gateway(&self, region: &str, id: &str) -> Result<()>;

    // --- Internet Gateway ---

    /// List Internet gateways in a region.
    async fn list_internet_gateways(&self, region: &str) -> Result<Vec<CloudResource>>;

    /// Create an Internet gateway.
    async fn create_internet_gateway(&self, region: &str) -> Result<CloudResource>;

    /// Attach an Internet gateway to a VPC.
    async fn attach_internet_gateway(&self, region: &str, igw_id: &str, vpc_id: &str) -> Result<()>;

    /// Detach an Internet gateway from a VPC.
    async fn detach_internet_gateway(&self, region: &str, igw_id: &str, vpc_id: &str) -> Result<()>;

    /// Delete an Internet gateway.
    async fn delete_internet_gateway(&self, region: &str, id: &str) -> Result<()>;

    // --- Route Tables ---

    /// List route tables in a region.
    async fn list_route_tables(&self, region: &str) -> Result<Vec<CloudResource>>;

    /// Create a route table in a VPC.
    async fn create_route_table(&self, region: &str, vpc_id: &str) -> Result<CloudResource>;

    /// Add a route to a route table.
    async fn add_route(&self, region: &str, route_table_id: &str, destination_cidr: &str, target_id: &str) -> Result<()>;

    /// Delete a route from a route table.
    async fn delete_route(&self, region: &str, route_table_id: &str, destination_cidr: &str) -> Result<()>;

    /// Associate a route table with a subnet. Returns the association ID.
    async fn associate_route_table(&self, region: &str, route_table_id: &str, subnet_id: &str) -> Result<String>;

    /// Delete a route table.
    async fn delete_route_table(&self, region: &str, id: &str) -> Result<()>;

    // --- Security Group CRUD ---

    /// Create a security group.
    async fn create_security_group(&self, region: &str, name: &str, description: &str, vpc_id: &str) -> Result<CloudResource>;

    /// Add a rule to a security group.
    async fn add_security_group_rule(&self, region: &str, sg_id: &str, rule: SecurityGroupRule) -> Result<()>;

    /// Remove a rule from a security group.
    async fn remove_security_group_rule(&self, region: &str, sg_id: &str, rule: SecurityGroupRule) -> Result<()>;

    /// Delete a security group.
    async fn delete_security_group(&self, region: &str, id: &str) -> Result<()>;

    // --- VPC Peering ---

    /// List VPC peering connections in a region.
    async fn list_vpc_peering_connections(&self, region: &str) -> Result<Vec<CloudResource>>;

    /// Create a VPC peering connection.
    async fn create_vpc_peering(&self, region: &str, vpc_id: &str, peer_vpc_id: &str) -> Result<CloudResource>;

    /// Accept a VPC peering connection.
    async fn accept_vpc_peering(&self, region: &str, peering_id: &str) -> Result<()>;

    /// Delete a VPC peering connection.
    async fn delete_vpc_peering(&self, region: &str, peering_id: &str) -> Result<()>;
}
