use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fmt;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CloudResource {
    pub id: Uuid,
    /// Provider-native resource identifier (e.g., "i-0abc123def456" for EC2, "vpc-xyz" for VPC).
    /// When populated, this is used for cloud API lookups. When None, the UUID `id` is used.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub cloud_id: Option<String>,
    pub provider: CloudProvider,
    pub resource_type: ResourceType,
    pub name: String,
    pub region: String,
    pub status: ResourceStatus,
    pub metadata: serde_json::Value,
    pub tags: HashMap<String, String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum CloudProvider {
    Aws,
    Gcp,
    Azure,
}

impl fmt::Display for CloudProvider {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            CloudProvider::Aws => write!(f, "aws"),
            CloudProvider::Gcp => write!(f, "gcp"),
            CloudProvider::Azure => write!(f, "azure"),
        }
    }
}

impl CloudProvider {
    pub fn from_str(s: &str) -> Option<Self> {
        match s.to_lowercase().as_str() {
            "aws" => Some(CloudProvider::Aws),
            "gcp" => Some(CloudProvider::Gcp),
            "azure" => Some(CloudProvider::Azure),
            _ => None,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ResourceType {
    Instance,
    Bucket,
    Vpc,
    Subnet,
    Database,
    Function,
    Cluster,
    LoadBalancer,
    SecurityGroup,
    ElasticIp,
    NatGateway,
    InternetGateway,
    RouteTable,
    VpcPeering,
    Volume,
    Snapshot,
    Image,
    Queue,
    Topic,
    ContainerRegistry,
    AutoScalingGroup,
    WafRule,
    KmsKey,
    IamUser,
    IamRole,
    IamPolicy,
    DnsZone,
    DnsRecord,
    EksCluster,
    EksNodeGroup,
    FlowLog,
    ApiGateway,
    ApiRoute,
    ApiStage,
    CdnDistribution,
    NoSqlTable,
    CacheCluster,
    StateMachine,
    WorkflowExecution,
    ParameterGroup,
    IoTThing,
    IoTThingGroup,
    MlModel,
    MlEndpoint,
    MlTrainingJob,
}

impl fmt::Display for ResourceType {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            ResourceType::Instance => write!(f, "instance"),
            ResourceType::Bucket => write!(f, "bucket"),
            ResourceType::Vpc => write!(f, "vpc"),
            ResourceType::Subnet => write!(f, "subnet"),
            ResourceType::Database => write!(f, "database"),
            ResourceType::Function => write!(f, "function"),
            ResourceType::Cluster => write!(f, "cluster"),
            ResourceType::LoadBalancer => write!(f, "load_balancer"),
            ResourceType::SecurityGroup => write!(f, "security_group"),
            ResourceType::ElasticIp => write!(f, "elastic_ip"),
            ResourceType::NatGateway => write!(f, "nat_gateway"),
            ResourceType::InternetGateway => write!(f, "internet_gateway"),
            ResourceType::RouteTable => write!(f, "route_table"),
            ResourceType::VpcPeering => write!(f, "vpc_peering"),
            ResourceType::Volume => write!(f, "volume"),
            ResourceType::Snapshot => write!(f, "snapshot"),
            ResourceType::Image => write!(f, "image"),
            ResourceType::Queue => write!(f, "queue"),
            ResourceType::Topic => write!(f, "topic"),
            ResourceType::ContainerRegistry => write!(f, "container_registry"),
            ResourceType::AutoScalingGroup => write!(f, "auto_scaling_group"),
            ResourceType::WafRule => write!(f, "waf_rule"),
            ResourceType::KmsKey => write!(f, "kms_key"),
            ResourceType::IamUser => write!(f, "iam_user"),
            ResourceType::IamRole => write!(f, "iam_role"),
            ResourceType::IamPolicy => write!(f, "iam_policy"),
            ResourceType::DnsZone => write!(f, "dns_zone"),
            ResourceType::DnsRecord => write!(f, "dns_record"),
            ResourceType::EksCluster => write!(f, "eks_cluster"),
            ResourceType::EksNodeGroup => write!(f, "eks_node_group"),
            ResourceType::FlowLog => write!(f, "flow_log"),
            ResourceType::ApiGateway => write!(f, "api_gateway"),
            ResourceType::ApiRoute => write!(f, "api_route"),
            ResourceType::ApiStage => write!(f, "api_stage"),
            ResourceType::CdnDistribution => write!(f, "cdn_distribution"),
            ResourceType::NoSqlTable => write!(f, "nosql_table"),
            ResourceType::CacheCluster => write!(f, "cache_cluster"),
            ResourceType::StateMachine => write!(f, "state_machine"),
            ResourceType::WorkflowExecution => write!(f, "workflow_execution"),
            ResourceType::ParameterGroup => write!(f, "parameter_group"),
            ResourceType::IoTThing => write!(f, "iot_thing"),
            ResourceType::IoTThingGroup => write!(f, "iot_thing_group"),
            ResourceType::MlModel => write!(f, "ml_model"),
            ResourceType::MlEndpoint => write!(f, "ml_endpoint"),
            ResourceType::MlTrainingJob => write!(f, "ml_training_job"),
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ResourceStatus {
    Running,
    Stopped,
    Terminated,
    Creating,
    Deleting,
    Error,
    Available,
    Pending,
    Updating,
}

impl fmt::Display for ResourceStatus {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            ResourceStatus::Running => write!(f, "running"),
            ResourceStatus::Stopped => write!(f, "stopped"),
            ResourceStatus::Terminated => write!(f, "terminated"),
            ResourceStatus::Creating => write!(f, "creating"),
            ResourceStatus::Deleting => write!(f, "deleting"),
            ResourceStatus::Error => write!(f, "error"),
            ResourceStatus::Available => write!(f, "available"),
            ResourceStatus::Pending => write!(f, "pending"),
            ResourceStatus::Updating => write!(f, "updating"),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateInstanceRequest {
    pub name: String,
    pub instance_type: String,
    pub image_id: String,
    pub region: String,
    pub subnet_id: Option<String>,
    pub security_group_ids: Vec<String>,
    pub key_pair: Option<String>,
    pub tags: HashMap<String, String>,
    pub user_data: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateBucketRequest {
    pub name: String,
    pub region: String,
    pub versioning: bool,
    pub encryption: bool,
    pub public_access: bool,
    pub tags: HashMap<String, String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateVpcRequest {
    pub name: String,
    pub cidr_block: String,
    pub region: String,
    pub enable_dns: bool,
    pub tags: HashMap<String, String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateSubnetRequest {
    pub name: String,
    pub vpc_id: String,
    pub cidr_block: String,
    pub availability_zone: String,
    pub is_public: bool,
    pub tags: HashMap<String, String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateDatabaseRequest {
    pub name: String,
    pub engine: String,
    pub engine_version: String,
    pub instance_class: String,
    pub storage_gb: u32,
    pub region: String,
    pub multi_az: bool,
    pub tags: HashMap<String, String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UploadObjectRequest {
    pub key: String,
    pub content_type: Option<String>,
    pub metadata: HashMap<String, String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DnsRecordInput {
    pub name: String,
    pub record_type: String, // A, AAAA, CNAME, MX, TXT, NS, SOA
    pub ttl: u64,
    pub values: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResourceActionRequest {
    pub parameters: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResourceListResponse {
    pub resources: Vec<CloudResource>,
    pub total: usize,
    pub next_token: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SecurityGroupRule {
    pub direction: String,
    pub protocol: String,
    pub from_port: i32,
    pub to_port: i32,
    pub cidr: String,
    pub description: Option<String>,
}

// ---------------------------------------------------------------------------
// Serverless (Lambda / Cloud Functions / Azure Functions) request structs
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateFunctionRequest {
    pub name: String,
    pub runtime: String,
    pub handler: String,
    pub role_arn: String,
    pub memory_mb: i32,
    pub timeout_seconds: i32,
    #[serde(default)]
    pub environment: HashMap<String, String>,
}

// ---------------------------------------------------------------------------
// API Gateway request structs
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateApiRequest {
    pub name: String,
    pub protocol: String, // HTTP, WEBSOCKET
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateApiRouteRequest {
    pub method: String,
    pub path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateApiStageRequest {
    pub name: String,
}

// ---------------------------------------------------------------------------
// CDN / CloudFront request structs
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateDistributionRequest {
    pub origin_domain: String,
    pub enabled: bool,
    pub default_root_object: Option<String>,
    pub price_class: Option<String>,
    pub comment: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InvalidateCacheRequest {
    pub paths: Vec<String>,
}

// ---------------------------------------------------------------------------
// Kubernetes (EKS/GKE/AKS) request structs
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateClusterRequest {
    pub name: String,
    pub version: Option<String>,
    pub role_arn: String,
    pub subnet_ids: Vec<String>,
    pub security_group_ids: Vec<String>,
    pub tags: HashMap<String, String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateNodeGroupRequest {
    pub name: String,
    pub node_role_arn: String,
    pub subnet_ids: Vec<String>,
    pub instance_types: Vec<String>,
    pub desired_size: i32,
    pub min_size: i32,
    pub max_size: i32,
    pub disk_size: Option<i32>,
    pub labels: HashMap<String, String>,
    pub tags: HashMap<String, String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScaleNodeGroupRequest {
    pub desired: i32,
}

// ---------------------------------------------------------------------------
// Traffic / Flow Log response structs
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FlowLogEntry {
    pub src_addr: String,
    pub dst_addr: String,
    pub total_bytes: u64,
    pub total_packets: u64,
    pub timestamp: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FlowLogResponse {
    pub entries: Vec<FlowLogEntry>,
    pub query_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TrafficSummary {
    pub total_bytes_in: u64,
    pub total_bytes_out: u64,
    pub total_requests: u64,
    pub total_errors: u64,
    pub top_talkers: Vec<TopTalker>,
    pub per_service: Vec<ServiceTraffic>,
    pub timestamp: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TopTalker {
    pub ip: String,
    pub bytes: u64,
    pub packets: u64,
    pub direction: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServiceTraffic {
    pub service_id: String,
    pub service_name: String,
    pub bytes_in: u64,
    pub bytes_out: u64,
    pub requests: u64,
    pub errors: u64,
}

// ---------------------------------------------------------------------------
// NoSQL (DynamoDB / Firestore / CosmosDB) request structs
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateNoSqlTableRequest {
    pub name: String,
    pub region: String,
    pub key_schema: serde_json::Value,
}

// ---------------------------------------------------------------------------
// Cache (ElastiCache / Memorystore) request structs
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateCacheClusterRequest {
    pub name: String,
    pub region: String,
    pub engine: String,
    pub node_type: String,
}
