use async_trait::async_trait;
use std::sync::Arc;

use cloud_common::{RedisCache, CredentialManager};
use cloud_common::cache::ttl;

use crate::error::CloudError;
use crate::models::*;
use crate::providers::aws_mapper;
use crate::traits::compute::Result;
use crate::traits::{ApiGatewayProvider, AutoScalingProvider, CacheDbProvider, CdnProvider, ComputeProvider, ContainerRegistryProvider, DatabaseProvider, DnsProvider, IamProvider, IoTProvider, KmsProvider, KubernetesProvider, MessagingProvider, MlProvider, NetworkingProvider, NoSqlProvider, ServerlessProvider, StorageProvider, TrafficProvider, VolumeProvider, WafProvider, WorkflowProvider};

/// AWS provider backed by real AWS SDK calls.
pub struct AwsSdkProvider {
    credentials: Arc<CredentialManager>,
    cache: Arc<RedisCache>,
    default_region: String,
}

impl AwsSdkProvider {
    pub fn new(
        credentials: Arc<CredentialManager>,
        cache: Arc<RedisCache>,
        default_region: String,
    ) -> Self {
        Self {
            credentials,
            cache,
            default_region,
        }
    }

    fn resolve_region<'a>(&'a self, region: &'a str) -> &'a str {
        if region.is_empty() {
            &self.default_region
        } else {
            region
        }
    }

    fn ec2_client(&self, region: &str) -> Result<aws_sdk_ec2::Client> {
        let config = self
            .credentials
            .aws_config_for_region(region)
            .map_err(|e| CloudError::ProviderError(e.to_string()))?;
        Ok(aws_sdk_ec2::Client::new(&config))
    }

    fn s3_client(&self, region: &str) -> Result<aws_sdk_s3::Client> {
        let config = self
            .credentials
            .aws_config_for_region(region)
            .map_err(|e| CloudError::ProviderError(e.to_string()))?;
        Ok(aws_sdk_s3::Client::new(&config))
    }

    fn rds_client(&self, region: &str) -> Result<aws_sdk_rds::Client> {
        let config = self
            .credentials
            .aws_config_for_region(region)
            .map_err(|e| CloudError::ProviderError(e.to_string()))?;
        Ok(aws_sdk_rds::Client::new(&config))
    }

    fn lambda_client(&self, region: &str) -> Result<aws_sdk_lambda::Client> {
        let config = self
            .credentials
            .aws_config_for_region(region)
            .map_err(|e| CloudError::ProviderError(e.to_string()))?;
        Ok(aws_sdk_lambda::Client::new(&config))
    }

    fn elb_client(&self, region: &str) -> Result<aws_sdk_elasticloadbalancingv2::Client> {
        let config = self
            .credentials
            .aws_config_for_region(region)
            .map_err(|e| CloudError::ProviderError(e.to_string()))?;
        Ok(aws_sdk_elasticloadbalancingv2::Client::new(&config))
    }

    fn ecr_client(&self, region: &str) -> Result<aws_sdk_ecr::Client> {
        let config = self
            .credentials
            .aws_config_for_region(region)
            .map_err(|e| CloudError::ProviderError(e.to_string()))?;
        Ok(aws_sdk_ecr::Client::new(&config))
    }

    fn sfn_client(&self, region: &str) -> Result<aws_sdk_sfn::Client> {
        let config = self
            .credentials
            .aws_config_for_region(region)
            .map_err(|e| CloudError::ProviderError(e.to_string()))?;
        Ok(aws_sdk_sfn::Client::new(&config))
    }
}

#[async_trait]
impl ComputeProvider for AwsSdkProvider {
    async fn list_instances(&self, region: &str) -> Result<Vec<CloudResource>> {
        let region = self.resolve_region(region);
        tracing::info!(provider = "aws", region = region, "Listing EC2 instances via SDK");

        let cache = self.cache.clone();
        let cache_key = ["cloud", "aws", region, "instance", "list"];

        cache
            .get_or_fetch(&cache_key, ttl::LIST_RESOURCES, || async {
                let ec2 = self.ec2_client(region).map_err(|e| cloud_common::CloudSdkError::Aws(e.to_string()))?;

                let mut instances = Vec::new();
                let mut next_token: Option<String> = None;

                loop {
                    let mut req = ec2.describe_instances();
                    if let Some(token) = &next_token {
                        req = req.next_token(token);
                    }

                    let resp = req
                        .send()
                        .await
                        .map_err(|e| cloud_common::CloudSdkError::Aws(e.to_string()))?;

                    for reservation in resp.reservations() {
                        for instance in reservation.instances() {
                            instances.push(aws_mapper::ec2_instance_to_resource(instance, region));
                        }
                    }

                    next_token = resp.next_token().map(|s| s.to_owned());
                    if next_token.is_none() {
                        break;
                    }
                }

                Ok(instances)
            })
            .await
            .map_err(|e| CloudError::ProviderError(e.to_string()))
    }

    async fn get_instance(&self, region: &str, id: &str) -> Result<CloudResource> {
        let region = self.resolve_region(region);
        tracing::info!(provider = "aws", region = region, id = id, "Getting EC2 instance via SDK");

        let ec2 = self.ec2_client(region)?;
        let resp = ec2
            .describe_instances()
            .instance_ids(id)
            .send()
            .await
            .map_err(|e| CloudError::ProviderError(e.to_string()))?;

        resp.reservations()
            .first()
            .and_then(|r| r.instances().first())
            .map(|i| aws_mapper::ec2_instance_to_resource(i, region))
            .ok_or_else(|| CloudError::NotFound(format!("EC2 instance {id} not found in {region}")))
    }

    async fn create_instance(
        &self,
        region: &str,
        config: CreateInstanceRequest,
    ) -> Result<CloudResource> {
        let region = self.resolve_region(region);
        tracing::info!(provider = "aws", region = region, name = config.name.as_str(), "Creating EC2 instance via SDK");

        let ec2 = self.ec2_client(region)?;

        let mut req = ec2
            .run_instances()
            .image_id(&config.image_id)
            .instance_type(aws_sdk_ec2::types::InstanceType::from(config.instance_type.as_str()))
            .min_count(1)
            .max_count(1);

        if let Some(subnet_id) = &config.subnet_id {
            req = req.subnet_id(subnet_id);
        }

        for sg_id in &config.security_group_ids {
            req = req.security_group_ids(sg_id);
        }

        if let Some(key_pair) = &config.key_pair {
            req = req.key_name(key_pair);
        }

        // Add Name tag
        let name_tag = aws_sdk_ec2::types::TagSpecification::builder()
            .resource_type(aws_sdk_ec2::types::ResourceType::Instance)
            .tags(
                aws_sdk_ec2::types::Tag::builder()
                    .key("Name")
                    .value(&config.name)
                    .build(),
            )
            .build();
        req = req.tag_specifications(name_tag);

        let resp = req
            .send()
            .await
            .map_err(|e| CloudError::ProviderError(e.to_string()))?;

        let instance = resp
            .instances()
            .first()
            .ok_or_else(|| CloudError::Internal("No instance returned from RunInstances".into()))?;

        // Invalidate list cache
        let _ = self
            .cache
            .invalidate_pattern(&["cloud", "aws", region, "instance"])
            .await;

        Ok(aws_mapper::ec2_instance_to_resource(instance, region))
    }

    async fn delete_instance(&self, region: &str, id: &str) -> Result<()> {
        let region = self.resolve_region(region);
        tracing::info!(provider = "aws", region = region, id = id, "Terminating EC2 instance via SDK");

        let ec2 = self.ec2_client(region)?;
        ec2.terminate_instances()
            .instance_ids(id)
            .send()
            .await
            .map_err(|e| CloudError::ProviderError(e.to_string()))?;

        let _ = self
            .cache
            .invalidate_pattern(&["cloud", "aws", region, "instance"])
            .await;
        Ok(())
    }

    async fn start_instance(&self, region: &str, id: &str) -> Result<()> {
        let region = self.resolve_region(region);
        let ec2 = self.ec2_client(region)?;
        ec2.start_instances()
            .instance_ids(id)
            .send()
            .await
            .map_err(|e| CloudError::ProviderError(e.to_string()))?;

        let _ = self
            .cache
            .invalidate_pattern(&["cloud", "aws", region, "instance"])
            .await;
        Ok(())
    }

    async fn stop_instance(&self, region: &str, id: &str) -> Result<()> {
        let region = self.resolve_region(region);
        let ec2 = self.ec2_client(region)?;
        ec2.stop_instances()
            .instance_ids(id)
            .send()
            .await
            .map_err(|e| CloudError::ProviderError(e.to_string()))?;

        let _ = self
            .cache
            .invalidate_pattern(&["cloud", "aws", region, "instance"])
            .await;
        Ok(())
    }

    async fn reboot_instance(&self, region: &str, id: &str) -> Result<()> {
        let region = self.resolve_region(region);
        let ec2 = self.ec2_client(region)?;
        ec2.reboot_instances()
            .instance_ids(id)
            .send()
            .await
            .map_err(|e| CloudError::ProviderError(e.to_string()))?;
        Ok(())
    }
}

#[async_trait]
impl StorageProvider for AwsSdkProvider {
    async fn list_buckets(&self, region: &str) -> Result<Vec<CloudResource>> {
        let region = self.resolve_region(region);
        tracing::info!(provider = "aws", region = region, "Listing S3 buckets via SDK");

        let s3 = self.s3_client(region)?;
        let resp = s3
            .list_buckets()
            .send()
            .await
            .map_err(|e| CloudError::ProviderError(e.to_string()))?;

        let buckets: Vec<CloudResource> = resp
            .buckets()
            .iter()
            .map(|b| aws_mapper::s3_bucket_to_resource(b, region, None, None))
            .collect();

        Ok(buckets)
    }

    async fn get_bucket(&self, region: &str, name: &str) -> Result<CloudResource> {
        let region = self.resolve_region(region);
        let s3 = self.s3_client(region)?;

        // Check bucket exists via HeadBucket
        s3.head_bucket()
            .bucket(name)
            .send()
            .await
            .map_err(|e| CloudError::NotFound(format!("S3 bucket {name} not found: {e}")))?;

        // Get versioning status
        let versioning = s3
            .get_bucket_versioning()
            .bucket(name)
            .send()
            .await
            .ok()
            .and_then(|v| v.status().map(|s| s == &aws_sdk_s3::types::BucketVersioningStatus::Enabled));

        let bucket = aws_sdk_s3::types::Bucket::builder().name(name).build();
        Ok(aws_mapper::s3_bucket_to_resource(
            &bucket, region, versioning, Some(true),
        ))
    }

    async fn create_bucket(
        &self,
        region: &str,
        config: CreateBucketRequest,
    ) -> Result<CloudResource> {
        let region = self.resolve_region(region);
        tracing::info!(provider = "aws", region = region, name = config.name.as_str(), "Creating S3 bucket via SDK");

        let s3 = self.s3_client(region)?;

        let mut req = s3.create_bucket().bucket(&config.name);

        // Only set LocationConstraint if not us-east-1 (AWS quirk)
        if region != "us-east-1" {
            let constraint = aws_sdk_s3::types::CreateBucketConfiguration::builder()
                .location_constraint(aws_sdk_s3::types::BucketLocationConstraint::from(region))
                .build();
            req = req.create_bucket_configuration(constraint);
        }

        req.send()
            .await
            .map_err(|e| CloudError::ProviderError(e.to_string()))?;

        // Enable versioning if requested
        if config.versioning {
            let _ = s3
                .put_bucket_versioning()
                .bucket(&config.name)
                .versioning_configuration(
                    aws_sdk_s3::types::VersioningConfiguration::builder()
                        .status(aws_sdk_s3::types::BucketVersioningStatus::Enabled)
                        .build(),
                )
                .send()
                .await;
        }

        let bucket = aws_sdk_s3::types::Bucket::builder()
            .name(&config.name)
            .build();
        Ok(aws_mapper::s3_bucket_to_resource(
            &bucket,
            region,
            Some(config.versioning),
            Some(config.encryption),
        ))
    }

    async fn delete_bucket(&self, region: &str, name: &str) -> Result<()> {
        let region = self.resolve_region(region);
        let s3 = self.s3_client(region)?;
        s3.delete_bucket()
            .bucket(name)
            .send()
            .await
            .map_err(|e| CloudError::ProviderError(e.to_string()))?;
        Ok(())
    }

    async fn list_objects(
        &self,
        region: &str,
        bucket: &str,
        prefix: Option<&str>,
    ) -> Result<Vec<CloudResource>> {
        let region = self.resolve_region(region);
        let s3 = self.s3_client(region)?;

        let mut req = s3.list_objects_v2().bucket(bucket).max_keys(1000);
        if let Some(prefix) = prefix {
            req = req.prefix(prefix);
        }

        let resp = req
            .send()
            .await
            .map_err(|e| CloudError::ProviderError(e.to_string()))?;

        let objects: Vec<CloudResource> = resp
            .contents()
            .iter()
            .map(|obj| {
                CloudResource {
                    id: uuid::Uuid::new_v4(),
                    cloud_id: obj.key().map(|k| k.to_owned()),
                    provider: CloudProvider::Aws,
                    resource_type: ResourceType::Bucket,
                    name: obj.key().unwrap_or_default().to_owned(),
                    region: region.to_owned(),
                    status: ResourceStatus::Available,
                    metadata: serde_json::json!({
                        "bucket": bucket,
                        "content_type": "application/octet-stream",
                        "size_bytes": obj.size().unwrap_or_default(),
                        "storage_class": obj.storage_class().map(|s| s.as_str()).unwrap_or("STANDARD"),
                        "last_modified": obj.last_modified().map(|t| t.to_string()),
                    }),
                    tags: std::collections::HashMap::new(),
                    created_at: obj
                        .last_modified()
                        .and_then(|t| chrono::DateTime::parse_from_rfc3339(&t.to_string()).ok())
                        .map(|t| t.with_timezone(&chrono::Utc))
                        .unwrap_or_else(chrono::Utc::now),
                    updated_at: chrono::Utc::now(),
                }
            })
            .collect();

        Ok(objects)
    }

    async fn upload_object(
        &self,
        region: &str,
        bucket: &str,
        request: UploadObjectRequest,
        data: Vec<u8>,
    ) -> Result<CloudResource> {
        let region = self.resolve_region(region);
        let s3 = self.s3_client(region)?;

        let mut req = s3
            .put_object()
            .bucket(bucket)
            .key(&request.key)
            .body(aws_sdk_s3::primitives::ByteStream::from(data.clone()));

        if let Some(ct) = &request.content_type {
            req = req.content_type(ct);
        }

        req.send()
            .await
            .map_err(|e| CloudError::ProviderError(e.to_string()))?;

        Ok(CloudResource {
            id: uuid::Uuid::new_v4(),
            cloud_id: Some(request.key.clone()),
            provider: CloudProvider::Aws,
            resource_type: ResourceType::Bucket,
            name: request.key,
            region: region.to_owned(),
            status: ResourceStatus::Available,
            metadata: serde_json::json!({
                "bucket": bucket,
                "content_type": request.content_type.unwrap_or_else(|| "application/octet-stream".to_owned()),
                "size_bytes": data.len(),
            }),
            tags: std::collections::HashMap::new(),
            created_at: chrono::Utc::now(),
            updated_at: chrono::Utc::now(),
        })
    }

    async fn delete_object(
        &self,
        region: &str,
        bucket: &str,
        key: &str,
    ) -> Result<()> {
        let region = self.resolve_region(region);
        let s3 = self.s3_client(region)?;
        s3.delete_object()
            .bucket(bucket)
            .key(key)
            .send()
            .await
            .map_err(|e| CloudError::ProviderError(e.to_string()))?;
        Ok(())
    }

    async fn get_bucket_policy(&self, region: &str, bucket: &str) -> Result<serde_json::Value> {
        let region = self.resolve_region(region);
        let s3 = self.s3_client(region)?;
        let resp = s3
            .get_bucket_policy()
            .bucket(bucket)
            .send()
            .await
            .map_err(|e| CloudError::ProviderError(e.to_string()))?;
        let policy_str = resp.policy().unwrap_or("{}");
        let policy: serde_json::Value = serde_json::from_str(policy_str)
            .unwrap_or_else(|_| serde_json::json!({"raw": policy_str}));
        Ok(policy)
    }

    async fn put_bucket_policy(&self, region: &str, bucket: &str, policy: &str) -> Result<()> {
        let region = self.resolve_region(region);
        let s3 = self.s3_client(region)?;
        s3.put_bucket_policy()
            .bucket(bucket)
            .policy(policy)
            .send()
            .await
            .map_err(|e| CloudError::ProviderError(e.to_string()))?;
        Ok(())
    }

    async fn delete_bucket_policy(&self, region: &str, bucket: &str) -> Result<()> {
        let region = self.resolve_region(region);
        let s3 = self.s3_client(region)?;
        s3.delete_bucket_policy()
            .bucket(bucket)
            .send()
            .await
            .map_err(|e| CloudError::ProviderError(e.to_string()))?;
        Ok(())
    }

    async fn get_lifecycle_rules(&self, region: &str, bucket: &str) -> Result<Vec<serde_json::Value>> {
        let region = self.resolve_region(region);
        let s3 = self.s3_client(region)?;
        let resp = s3
            .get_bucket_lifecycle_configuration()
            .bucket(bucket)
            .send()
            .await
            .map_err(|e| CloudError::ProviderError(e.to_string()))?;
        let rules: Vec<serde_json::Value> = resp
            .rules()
            .iter()
            .map(|r| {
                serde_json::json!({
                    "id": r.id().unwrap_or_default(),
                    "status": format!("{:?}", r.status()),
                    "prefix": r.prefix().unwrap_or_default(),
                })
            })
            .collect();
        Ok(rules)
    }

    async fn put_lifecycle_rules(&self, region: &str, bucket: &str, rules: Vec<serde_json::Value>) -> Result<()> {
        let region = self.resolve_region(region);
        let s3 = self.s3_client(region)?;
        let mut lc_rules = Vec::new();
        for rule in &rules {
            let id = rule["id"].as_str().unwrap_or("rule");
            let prefix = rule["prefix"].as_str().unwrap_or("");
            let days = rule["expiration_days"].as_i64().unwrap_or(365) as i32;
            let lc_rule = aws_sdk_s3::types::LifecycleRule::builder()
                .id(id)
                .status(aws_sdk_s3::types::ExpirationStatus::Enabled)
                .filter(aws_sdk_s3::types::LifecycleRuleFilter::builder().prefix(prefix).build())
                .expiration(
                    aws_sdk_s3::types::LifecycleExpiration::builder()
                        .days(days)
                        .build(),
                )
                .build()
                .map_err(|e| CloudError::BadRequest(e.to_string()))?;
            lc_rules.push(lc_rule);
        }
        let config = aws_sdk_s3::types::BucketLifecycleConfiguration::builder()
            .set_rules(Some(lc_rules))
            .build()
            .map_err(|e| CloudError::BadRequest(e.to_string()))?;
        s3.put_bucket_lifecycle_configuration()
            .bucket(bucket)
            .lifecycle_configuration(config)
            .send()
            .await
            .map_err(|e| CloudError::ProviderError(e.to_string()))?;
        Ok(())
    }

    async fn get_bucket_encryption(&self, region: &str, bucket: &str) -> Result<serde_json::Value> {
        let region = self.resolve_region(region);
        let s3 = self.s3_client(region)?;
        let resp = s3
            .get_bucket_encryption()
            .bucket(bucket)
            .send()
            .await
            .map_err(|e| CloudError::ProviderError(e.to_string()))?;
        let rules: Vec<serde_json::Value> = resp
            .server_side_encryption_configuration()
            .map(|c| {
                c.rules()
                    .iter()
                    .map(|r| {
                        let algo = r
                            .apply_server_side_encryption_by_default()
                            .map(|d| d.sse_algorithm().as_str().to_owned())
                            .unwrap_or_default();
                        serde_json::json!({ "sse_algorithm": algo })
                    })
                    .collect()
            })
            .unwrap_or_default();
        Ok(serde_json::json!({ "rules": rules }))
    }

    async fn put_bucket_encryption(&self, region: &str, bucket: &str, enabled: bool) -> Result<()> {
        let region = self.resolve_region(region);
        let s3 = self.s3_client(region)?;
        if enabled {
            let default_rule = aws_sdk_s3::types::ServerSideEncryptionByDefault::builder()
                .sse_algorithm(aws_sdk_s3::types::ServerSideEncryption::Aes256)
                .build()
                .map_err(|e| CloudError::BadRequest(e.to_string()))?;
            let rule = aws_sdk_s3::types::ServerSideEncryptionRule::builder()
                .apply_server_side_encryption_by_default(default_rule)
                .build();
            let config = aws_sdk_s3::types::ServerSideEncryptionConfiguration::builder()
                .rules(rule)
                .build()
                .map_err(|e| CloudError::BadRequest(e.to_string()))?;
            s3.put_bucket_encryption()
                .bucket(bucket)
                .server_side_encryption_configuration(config)
                .send()
                .await
                .map_err(|e| CloudError::ProviderError(e.to_string()))?;
        } else {
            s3.delete_bucket_encryption()
                .bucket(bucket)
                .send()
                .await
                .map_err(|e| CloudError::ProviderError(e.to_string()))?;
        }
        Ok(())
    }

    async fn get_cors_rules(&self, region: &str, bucket: &str) -> Result<serde_json::Value> {
        let region = self.resolve_region(region);
        let s3 = self.s3_client(region)?;
        let resp = s3
            .get_bucket_cors()
            .bucket(bucket)
            .send()
            .await
            .map_err(|e| CloudError::ProviderError(e.to_string()))?;
        let rules: Vec<serde_json::Value> = resp
            .cors_rules()
            .iter()
            .map(|r| {
                serde_json::json!({
                    "allowed_headers": r.allowed_headers(),
                    "allowed_methods": r.allowed_methods(),
                    "allowed_origins": r.allowed_origins(),
                    "expose_headers": r.expose_headers(),
                    "max_age_seconds": r.max_age_seconds(),
                })
            })
            .collect();
        Ok(serde_json::json!({ "cors_rules": rules }))
    }

    async fn put_cors_rules(&self, region: &str, bucket: &str, rules: serde_json::Value) -> Result<()> {
        let region = self.resolve_region(region);
        let s3 = self.s3_client(region)?;

        let rules_array = rules.as_array()
            .ok_or_else(|| CloudError::BadRequest("rules must be a JSON array".into()))?;

        let mut cors_rules = Vec::new();
        for rule in rules_array {
            let allowed_origins: Vec<String> = rule["allowed_origins"]
                .as_array()
                .unwrap_or(&vec![])
                .iter()
                .filter_map(|v| v.as_str().map(|s| s.to_owned()))
                .collect();
            let allowed_methods: Vec<String> = rule["allowed_methods"]
                .as_array()
                .unwrap_or(&vec![])
                .iter()
                .filter_map(|v| v.as_str().map(|s| s.to_owned()))
                .collect();
            let allowed_headers: Vec<String> = rule["allowed_headers"]
                .as_array()
                .unwrap_or(&vec![])
                .iter()
                .filter_map(|v| v.as_str().map(|s| s.to_owned()))
                .collect();
            let max_age = rule["max_age_seconds"].as_i64().unwrap_or(0) as i32;

            let cors_rule = aws_sdk_s3::types::CorsRule::builder()
                .set_allowed_origins(Some(allowed_origins))
                .set_allowed_methods(Some(allowed_methods))
                .set_allowed_headers(Some(allowed_headers))
                .max_age_seconds(max_age)
                .build()
                .map_err(|e| CloudError::BadRequest(e.to_string()))?;
            cors_rules.push(cors_rule);
        }

        let cors_config = aws_sdk_s3::types::CorsConfiguration::builder()
            .set_cors_rules(Some(cors_rules))
            .build()
            .map_err(|e| CloudError::BadRequest(e.to_string()))?;

        s3.put_bucket_cors()
            .bucket(bucket)
            .cors_configuration(cors_config)
            .send()
            .await
            .map_err(|e| CloudError::ProviderError(e.to_string()))?;
        Ok(())
    }
}

#[async_trait]
impl NetworkingProvider for AwsSdkProvider {
    async fn list_vpcs(&self, region: &str) -> Result<Vec<CloudResource>> {
        let region = self.resolve_region(region);
        let ec2 = self.ec2_client(region)?;

        let resp = ec2
            .describe_vpcs()
            .send()
            .await
            .map_err(|e| CloudError::ProviderError(e.to_string()))?;

        Ok(resp
            .vpcs()
            .iter()
            .map(|v| aws_mapper::vpc_to_resource(v, region))
            .collect())
    }

    async fn get_vpc(&self, region: &str, id: &str) -> Result<CloudResource> {
        let region = self.resolve_region(region);
        let ec2 = self.ec2_client(region)?;

        let resp = ec2
            .describe_vpcs()
            .vpc_ids(id)
            .send()
            .await
            .map_err(|e| CloudError::ProviderError(e.to_string()))?;

        resp.vpcs()
            .first()
            .map(|v| aws_mapper::vpc_to_resource(v, region))
            .ok_or_else(|| CloudError::NotFound(format!("VPC {id} not found")))
    }

    async fn create_vpc(
        &self,
        region: &str,
        config: CreateVpcRequest,
    ) -> Result<CloudResource> {
        let region = self.resolve_region(region);
        let ec2 = self.ec2_client(region)?;

        let resp = ec2
            .create_vpc()
            .cidr_block(&config.cidr_block)
            .tag_specifications(
                aws_sdk_ec2::types::TagSpecification::builder()
                    .resource_type(aws_sdk_ec2::types::ResourceType::Vpc)
                    .tags(
                        aws_sdk_ec2::types::Tag::builder()
                            .key("Name")
                            .value(&config.name)
                            .build(),
                    )
                    .build(),
            )
            .send()
            .await
            .map_err(|e| CloudError::ProviderError(e.to_string()))?;

        let vpc = resp
            .vpc()
            .ok_or_else(|| CloudError::Internal("No VPC returned from CreateVpc".into()))?;

        // Enable DNS if requested
        if config.enable_dns {
            let vpc_id = vpc.vpc_id().unwrap_or_default();
            let _ = ec2
                .modify_vpc_attribute()
                .vpc_id(vpc_id)
                .enable_dns_support(
                    aws_sdk_ec2::types::AttributeBooleanValue::builder()
                        .value(true)
                        .build(),
                )
                .send()
                .await;
            let _ = ec2
                .modify_vpc_attribute()
                .vpc_id(vpc_id)
                .enable_dns_hostnames(
                    aws_sdk_ec2::types::AttributeBooleanValue::builder()
                        .value(true)
                        .build(),
                )
                .send()
                .await;
        }

        Ok(aws_mapper::vpc_to_resource(vpc, region))
    }

    async fn delete_vpc(&self, region: &str, id: &str) -> Result<()> {
        let region = self.resolve_region(region);
        let ec2 = self.ec2_client(region)?;
        ec2.delete_vpc()
            .vpc_id(id)
            .send()
            .await
            .map_err(|e| CloudError::ProviderError(e.to_string()))?;
        Ok(())
    }

    async fn list_subnets(&self, region: &str, vpc_id: &str) -> Result<Vec<CloudResource>> {
        let region = self.resolve_region(region);
        let ec2 = self.ec2_client(region)?;

        let resp = ec2
            .describe_subnets()
            .filters(
                aws_sdk_ec2::types::Filter::builder()
                    .name("vpc-id")
                    .values(vpc_id)
                    .build(),
            )
            .send()
            .await
            .map_err(|e| CloudError::ProviderError(e.to_string()))?;

        Ok(resp
            .subnets()
            .iter()
            .map(|s| aws_mapper::subnet_to_resource(s, region))
            .collect())
    }

    async fn create_subnet(
        &self,
        region: &str,
        config: CreateSubnetRequest,
    ) -> Result<CloudResource> {
        let region = self.resolve_region(region);
        let ec2 = self.ec2_client(region)?;

        let resp = ec2
            .create_subnet()
            .vpc_id(&config.vpc_id)
            .cidr_block(&config.cidr_block)
            .availability_zone(&config.availability_zone)
            .tag_specifications(
                aws_sdk_ec2::types::TagSpecification::builder()
                    .resource_type(aws_sdk_ec2::types::ResourceType::Subnet)
                    .tags(
                        aws_sdk_ec2::types::Tag::builder()
                            .key("Name")
                            .value(&config.name)
                            .build(),
                    )
                    .build(),
            )
            .send()
            .await
            .map_err(|e| CloudError::ProviderError(e.to_string()))?;

        let subnet = resp
            .subnet()
            .ok_or_else(|| CloudError::Internal("No subnet returned from CreateSubnet".into()))?;

        Ok(aws_mapper::subnet_to_resource(subnet, region))
    }

    async fn delete_subnet(&self, region: &str, id: &str) -> Result<()> {
        let region = self.resolve_region(region);
        let ec2 = self.ec2_client(region)?;
        ec2.delete_subnet()
            .subnet_id(id)
            .send()
            .await
            .map_err(|e| CloudError::ProviderError(e.to_string()))?;
        Ok(())
    }

    async fn list_load_balancers(&self, region: &str) -> Result<Vec<CloudResource>> {
        let region = self.resolve_region(region);
        let elb = self.elb_client(region)?;

        let resp = elb
            .describe_load_balancers()
            .send()
            .await
            .map_err(|e| CloudError::ProviderError(e.to_string()))?;

        Ok(resp
            .load_balancers()
            .iter()
            .map(|lb| aws_mapper::load_balancer_to_resource(lb, region))
            .collect())
    }

    async fn get_load_balancer(&self, region: &str, id: &str) -> Result<CloudResource> {
        let region = self.resolve_region(region);
        let elb = self.elb_client(region)?;

        let resp = elb
            .describe_load_balancers()
            .load_balancer_arns(id)
            .send()
            .await
            .map_err(|e| CloudError::ProviderError(e.to_string()))?;

        resp.load_balancers()
            .first()
            .map(|lb| aws_mapper::load_balancer_to_resource(lb, region))
            .ok_or_else(|| CloudError::NotFound(format!("Load balancer {id} not found")))
    }

    async fn delete_load_balancer(&self, region: &str, id: &str) -> Result<()> {
        let region = self.resolve_region(region);
        let elb = self.elb_client(region)?;
        elb.delete_load_balancer()
            .load_balancer_arn(id)
            .send()
            .await
            .map_err(|e| CloudError::ProviderError(e.to_string()))?;
        Ok(())
    }

    async fn list_security_groups(&self, region: &str) -> Result<Vec<CloudResource>> {
        let region = self.resolve_region(region);
        let ec2 = self.ec2_client(region)?;

        let resp = ec2
            .describe_security_groups()
            .send()
            .await
            .map_err(|e| CloudError::ProviderError(e.to_string()))?;

        Ok(resp
            .security_groups()
            .iter()
            .map(|sg| aws_mapper::security_group_to_resource(sg, region))
            .collect())
    }

    // --- Elastic IPs ---

    async fn list_elastic_ips(&self, region: &str) -> Result<Vec<CloudResource>> {
        let region = self.resolve_region(region);
        let ec2 = self.ec2_client(region)?;

        let resp = ec2
            .describe_addresses()
            .send()
            .await
            .map_err(|e| CloudError::ProviderError(e.to_string()))?;

        Ok(resp
            .addresses()
            .iter()
            .map(|a| aws_mapper::elastic_ip_to_resource(a, region))
            .collect())
    }

    async fn allocate_elastic_ip(&self, region: &str) -> Result<CloudResource> {
        let region = self.resolve_region(region);
        let ec2 = self.ec2_client(region)?;

        let resp = ec2
            .allocate_address()
            .domain(aws_sdk_ec2::types::DomainType::Vpc)
            .send()
            .await
            .map_err(|e| CloudError::ProviderError(e.to_string()))?;

        let now = chrono::Utc::now();
        Ok(CloudResource {
            id: uuid::Uuid::new_v4(),
            cloud_id: resp.allocation_id().map(|s| s.to_owned()),
            provider: CloudProvider::Aws,
            resource_type: ResourceType::ElasticIp,
            name: resp.public_ip().unwrap_or_default().to_owned(),
            region: region.to_owned(),
            status: ResourceStatus::Available,
            metadata: serde_json::json!({
                "allocation_id": resp.allocation_id().unwrap_or_default(),
                "public_ip": resp.public_ip().unwrap_or_default(),
                "domain": resp.domain().map(|d| d.as_str()).unwrap_or("vpc"),
            }),
            tags: std::collections::HashMap::new(),
            created_at: now,
            updated_at: now,
        })
    }

    async fn associate_elastic_ip(&self, region: &str, eip_id: &str, instance_id: &str) -> Result<()> {
        let region = self.resolve_region(region);
        let ec2 = self.ec2_client(region)?;

        ec2.associate_address()
            .allocation_id(eip_id)
            .instance_id(instance_id)
            .send()
            .await
            .map_err(|e| CloudError::ProviderError(e.to_string()))?;

        Ok(())
    }

    async fn disassociate_elastic_ip(&self, region: &str, association_id: &str) -> Result<()> {
        let region = self.resolve_region(region);
        let ec2 = self.ec2_client(region)?;

        ec2.disassociate_address()
            .association_id(association_id)
            .send()
            .await
            .map_err(|e| CloudError::ProviderError(e.to_string()))?;

        Ok(())
    }

    async fn release_elastic_ip(&self, region: &str, allocation_id: &str) -> Result<()> {
        let region = self.resolve_region(region);
        let ec2 = self.ec2_client(region)?;

        ec2.release_address()
            .allocation_id(allocation_id)
            .send()
            .await
            .map_err(|e| CloudError::ProviderError(e.to_string()))?;

        Ok(())
    }

    // --- NAT Gateway ---

    async fn list_nat_gateways(&self, region: &str) -> Result<Vec<CloudResource>> {
        let region = self.resolve_region(region);
        let ec2 = self.ec2_client(region)?;

        let resp = ec2
            .describe_nat_gateways()
            .send()
            .await
            .map_err(|e| CloudError::ProviderError(e.to_string()))?;

        Ok(resp
            .nat_gateways()
            .iter()
            .map(|ngw| aws_mapper::nat_gateway_to_resource(ngw, region))
            .collect())
    }

    async fn create_nat_gateway(&self, region: &str, subnet_id: &str, eip_allocation_id: &str) -> Result<CloudResource> {
        let region = self.resolve_region(region);
        let ec2 = self.ec2_client(region)?;

        let resp = ec2
            .create_nat_gateway()
            .subnet_id(subnet_id)
            .allocation_id(eip_allocation_id)
            .send()
            .await
            .map_err(|e| CloudError::ProviderError(e.to_string()))?;

        let ngw = resp
            .nat_gateway()
            .ok_or_else(|| CloudError::Internal("No NAT gateway returned".into()))?;

        Ok(aws_mapper::nat_gateway_to_resource(ngw, region))
    }

    async fn delete_nat_gateway(&self, region: &str, id: &str) -> Result<()> {
        let region = self.resolve_region(region);
        let ec2 = self.ec2_client(region)?;

        ec2.delete_nat_gateway()
            .nat_gateway_id(id)
            .send()
            .await
            .map_err(|e| CloudError::ProviderError(e.to_string()))?;

        Ok(())
    }

    // --- Internet Gateway ---

    async fn list_internet_gateways(&self, region: &str) -> Result<Vec<CloudResource>> {
        let region = self.resolve_region(region);
        let ec2 = self.ec2_client(region)?;

        let resp = ec2
            .describe_internet_gateways()
            .send()
            .await
            .map_err(|e| CloudError::ProviderError(e.to_string()))?;

        Ok(resp
            .internet_gateways()
            .iter()
            .map(|igw| aws_mapper::internet_gateway_to_resource(igw, region))
            .collect())
    }

    async fn create_internet_gateway(&self, region: &str) -> Result<CloudResource> {
        let region = self.resolve_region(region);
        let ec2 = self.ec2_client(region)?;

        let resp = ec2
            .create_internet_gateway()
            .send()
            .await
            .map_err(|e| CloudError::ProviderError(e.to_string()))?;

        let igw = resp
            .internet_gateway()
            .ok_or_else(|| CloudError::Internal("No internet gateway returned".into()))?;

        Ok(aws_mapper::internet_gateway_to_resource(igw, region))
    }

    async fn attach_internet_gateway(&self, region: &str, igw_id: &str, vpc_id: &str) -> Result<()> {
        let region = self.resolve_region(region);
        let ec2 = self.ec2_client(region)?;

        ec2.attach_internet_gateway()
            .internet_gateway_id(igw_id)
            .vpc_id(vpc_id)
            .send()
            .await
            .map_err(|e| CloudError::ProviderError(e.to_string()))?;

        Ok(())
    }

    async fn detach_internet_gateway(&self, region: &str, igw_id: &str, vpc_id: &str) -> Result<()> {
        let region = self.resolve_region(region);
        let ec2 = self.ec2_client(region)?;

        ec2.detach_internet_gateway()
            .internet_gateway_id(igw_id)
            .vpc_id(vpc_id)
            .send()
            .await
            .map_err(|e| CloudError::ProviderError(e.to_string()))?;

        Ok(())
    }

    async fn delete_internet_gateway(&self, region: &str, id: &str) -> Result<()> {
        let region = self.resolve_region(region);
        let ec2 = self.ec2_client(region)?;

        ec2.delete_internet_gateway()
            .internet_gateway_id(id)
            .send()
            .await
            .map_err(|e| CloudError::ProviderError(e.to_string()))?;

        Ok(())
    }

    // --- Route Tables ---

    async fn list_route_tables(&self, region: &str) -> Result<Vec<CloudResource>> {
        let region = self.resolve_region(region);
        let ec2 = self.ec2_client(region)?;

        let resp = ec2
            .describe_route_tables()
            .send()
            .await
            .map_err(|e| CloudError::ProviderError(e.to_string()))?;

        Ok(resp
            .route_tables()
            .iter()
            .map(|rt| aws_mapper::route_table_to_resource(rt, region))
            .collect())
    }

    async fn create_route_table(&self, region: &str, vpc_id: &str) -> Result<CloudResource> {
        let region = self.resolve_region(region);
        let ec2 = self.ec2_client(region)?;

        let resp = ec2
            .create_route_table()
            .vpc_id(vpc_id)
            .send()
            .await
            .map_err(|e| CloudError::ProviderError(e.to_string()))?;

        let rt = resp
            .route_table()
            .ok_or_else(|| CloudError::Internal("No route table returned".into()))?;

        Ok(aws_mapper::route_table_to_resource(rt, region))
    }

    async fn add_route(&self, region: &str, route_table_id: &str, destination_cidr: &str, target_id: &str) -> Result<()> {
        let region = self.resolve_region(region);
        let ec2 = self.ec2_client(region)?;

        let mut req = ec2
            .create_route()
            .route_table_id(route_table_id)
            .destination_cidr_block(destination_cidr);

        // Determine target type based on prefix
        if target_id.starts_with("igw-") {
            req = req.gateway_id(target_id);
        } else if target_id.starts_with("nat-") {
            req = req.nat_gateway_id(target_id);
        } else if target_id.starts_with("i-") {
            req = req.instance_id(target_id);
        } else if target_id.starts_with("pcx-") {
            req = req.vpc_peering_connection_id(target_id);
        } else {
            req = req.gateway_id(target_id);
        }

        req.send()
            .await
            .map_err(|e| CloudError::ProviderError(e.to_string()))?;

        Ok(())
    }

    async fn delete_route(&self, region: &str, route_table_id: &str, destination_cidr: &str) -> Result<()> {
        let region = self.resolve_region(region);
        let ec2 = self.ec2_client(region)?;

        ec2.delete_route()
            .route_table_id(route_table_id)
            .destination_cidr_block(destination_cidr)
            .send()
            .await
            .map_err(|e| CloudError::ProviderError(e.to_string()))?;

        Ok(())
    }

    async fn associate_route_table(&self, region: &str, route_table_id: &str, subnet_id: &str) -> Result<String> {
        let region = self.resolve_region(region);
        let ec2 = self.ec2_client(region)?;

        let resp = ec2
            .associate_route_table()
            .route_table_id(route_table_id)
            .subnet_id(subnet_id)
            .send()
            .await
            .map_err(|e| CloudError::ProviderError(e.to_string()))?;

        Ok(resp.association_id().unwrap_or_default().to_owned())
    }

    async fn delete_route_table(&self, region: &str, id: &str) -> Result<()> {
        let region = self.resolve_region(region);
        let ec2 = self.ec2_client(region)?;

        ec2.delete_route_table()
            .route_table_id(id)
            .send()
            .await
            .map_err(|e| CloudError::ProviderError(e.to_string()))?;

        Ok(())
    }

    // --- Security Group CRUD ---

    async fn create_security_group(&self, region: &str, name: &str, description: &str, vpc_id: &str) -> Result<CloudResource> {
        let region = self.resolve_region(region);
        let ec2 = self.ec2_client(region)?;

        let resp = ec2
            .create_security_group()
            .group_name(name)
            .description(description)
            .vpc_id(vpc_id)
            .send()
            .await
            .map_err(|e| CloudError::ProviderError(e.to_string()))?;

        let sg_id = resp.group_id().unwrap_or_default().to_owned();
        let now = chrono::Utc::now();

        Ok(CloudResource {
            id: uuid::Uuid::new_v4(),
            cloud_id: Some(sg_id.clone()),
            provider: CloudProvider::Aws,
            resource_type: ResourceType::SecurityGroup,
            name: name.to_owned(),
            region: region.to_owned(),
            status: ResourceStatus::Available,
            metadata: serde_json::json!({
                "description": description,
                "vpc_id": vpc_id,
                "group_id": sg_id,
            }),
            tags: std::collections::HashMap::new(),
            created_at: now,
            updated_at: now,
        })
    }

    async fn add_security_group_rule(&self, region: &str, sg_id: &str, rule: SecurityGroupRule) -> Result<()> {
        let region = self.resolve_region(region);
        let ec2 = self.ec2_client(region)?;

        let ip_range = aws_sdk_ec2::types::IpRange::builder()
            .cidr_ip(&rule.cidr)
            .set_description(rule.description.clone())
            .build();

        let ip_permission = aws_sdk_ec2::types::IpPermission::builder()
            .ip_protocol(&rule.protocol)
            .from_port(rule.from_port)
            .to_port(rule.to_port)
            .ip_ranges(ip_range)
            .build();

        if rule.direction == "inbound" {
            ec2.authorize_security_group_ingress()
                .group_id(sg_id)
                .ip_permissions(ip_permission)
                .send()
                .await
                .map_err(|e| CloudError::ProviderError(e.to_string()))?;
        } else {
            ec2.authorize_security_group_egress()
                .group_id(sg_id)
                .ip_permissions(ip_permission)
                .send()
                .await
                .map_err(|e| CloudError::ProviderError(e.to_string()))?;
        }

        Ok(())
    }

    async fn remove_security_group_rule(&self, region: &str, sg_id: &str, rule: SecurityGroupRule) -> Result<()> {
        let region = self.resolve_region(region);
        let ec2 = self.ec2_client(region)?;

        let ip_range = aws_sdk_ec2::types::IpRange::builder()
            .cidr_ip(&rule.cidr)
            .build();

        let ip_permission = aws_sdk_ec2::types::IpPermission::builder()
            .ip_protocol(&rule.protocol)
            .from_port(rule.from_port)
            .to_port(rule.to_port)
            .ip_ranges(ip_range)
            .build();

        if rule.direction == "inbound" {
            ec2.revoke_security_group_ingress()
                .group_id(sg_id)
                .ip_permissions(ip_permission)
                .send()
                .await
                .map_err(|e| CloudError::ProviderError(e.to_string()))?;
        } else {
            ec2.revoke_security_group_egress()
                .group_id(sg_id)
                .ip_permissions(ip_permission)
                .send()
                .await
                .map_err(|e| CloudError::ProviderError(e.to_string()))?;
        }

        Ok(())
    }

    async fn delete_security_group(&self, region: &str, id: &str) -> Result<()> {
        let region = self.resolve_region(region);
        let ec2 = self.ec2_client(region)?;

        ec2.delete_security_group()
            .group_id(id)
            .send()
            .await
            .map_err(|e| CloudError::ProviderError(e.to_string()))?;

        Ok(())
    }

    // --- VPC Peering ---

    async fn list_vpc_peering_connections(&self, region: &str) -> Result<Vec<CloudResource>> {
        let region = self.resolve_region(region);
        let ec2 = self.ec2_client(region)?;

        let resp = ec2
            .describe_vpc_peering_connections()
            .send()
            .await
            .map_err(|e| CloudError::ProviderError(e.to_string()))?;

        Ok(resp
            .vpc_peering_connections()
            .iter()
            .map(|pc| aws_mapper::vpc_peering_to_resource(pc, region))
            .collect())
    }

    async fn create_vpc_peering(&self, region: &str, vpc_id: &str, peer_vpc_id: &str) -> Result<CloudResource> {
        let region = self.resolve_region(region);
        let ec2 = self.ec2_client(region)?;

        let resp = ec2
            .create_vpc_peering_connection()
            .vpc_id(vpc_id)
            .peer_vpc_id(peer_vpc_id)
            .send()
            .await
            .map_err(|e| CloudError::ProviderError(e.to_string()))?;

        let pc = resp
            .vpc_peering_connection()
            .ok_or_else(|| CloudError::Internal("No VPC peering connection returned".into()))?;

        Ok(aws_mapper::vpc_peering_to_resource(pc, region))
    }

    async fn accept_vpc_peering(&self, region: &str, peering_id: &str) -> Result<()> {
        let region = self.resolve_region(region);
        let ec2 = self.ec2_client(region)?;

        ec2.accept_vpc_peering_connection()
            .vpc_peering_connection_id(peering_id)
            .send()
            .await
            .map_err(|e| CloudError::ProviderError(e.to_string()))?;

        Ok(())
    }

    async fn delete_vpc_peering(&self, region: &str, peering_id: &str) -> Result<()> {
        let region = self.resolve_region(region);
        let ec2 = self.ec2_client(region)?;

        ec2.delete_vpc_peering_connection()
            .vpc_peering_connection_id(peering_id)
            .send()
            .await
            .map_err(|e| CloudError::ProviderError(e.to_string()))?;

        Ok(())
    }
}

#[async_trait]
impl DatabaseProvider for AwsSdkProvider {
    async fn list_databases(&self, region: &str) -> Result<Vec<CloudResource>> {
        let region = self.resolve_region(region);
        let rds = self.rds_client(region)?;

        let resp = rds
            .describe_db_instances()
            .send()
            .await
            .map_err(|e| CloudError::ProviderError(e.to_string()))?;

        Ok(resp
            .db_instances()
            .iter()
            .map(|db| aws_mapper::rds_instance_to_resource(db, region))
            .collect())
    }

    async fn get_database(&self, region: &str, id: &str) -> Result<CloudResource> {
        let region = self.resolve_region(region);
        let rds = self.rds_client(region)?;

        let resp = rds
            .describe_db_instances()
            .db_instance_identifier(id)
            .send()
            .await
            .map_err(|e| CloudError::ProviderError(e.to_string()))?;

        resp.db_instances()
            .first()
            .map(|db| aws_mapper::rds_instance_to_resource(db, region))
            .ok_or_else(|| CloudError::NotFound(format!("RDS instance {id} not found")))
    }

    async fn create_database(
        &self,
        region: &str,
        config: CreateDatabaseRequest,
    ) -> Result<CloudResource> {
        let region = self.resolve_region(region);
        let rds = self.rds_client(region)?;

        let resp = rds
            .create_db_instance()
            .db_instance_identifier(&config.name)
            .db_instance_class(&config.instance_class)
            .engine(&config.engine)
            .engine_version(&config.engine_version)
            .allocated_storage(config.storage_gb as i32)
            .multi_az(config.multi_az)
            .master_username("admin")
            .master_user_password("changeme-in-production") // Should come from Vault/Secrets Manager
            .send()
            .await
            .map_err(|e| CloudError::ProviderError(e.to_string()))?;

        let db = resp
            .db_instance()
            .ok_or_else(|| CloudError::Internal("No DB instance returned".into()))?;

        Ok(aws_mapper::rds_instance_to_resource(db, region))
    }

    async fn delete_database(&self, region: &str, id: &str) -> Result<()> {
        let region = self.resolve_region(region);
        let rds = self.rds_client(region)?;
        rds.delete_db_instance()
            .db_instance_identifier(id)
            .skip_final_snapshot(true)
            .send()
            .await
            .map_err(|e| CloudError::ProviderError(e.to_string()))?;
        Ok(())
    }

    async fn restart_database(&self, region: &str, id: &str) -> Result<()> {
        let region = self.resolve_region(region);
        let rds = self.rds_client(region)?;
        rds.reboot_db_instance()
            .db_instance_identifier(id)
            .send()
            .await
            .map_err(|e| CloudError::ProviderError(e.to_string()))?;
        Ok(())
    }

    async fn create_snapshot(
        &self,
        region: &str,
        db_id: &str,
        snapshot_name: &str,
    ) -> Result<CloudResource> {
        let region = self.resolve_region(region);
        let rds = self.rds_client(region)?;

        let resp = rds
            .create_db_snapshot()
            .db_instance_identifier(db_id)
            .db_snapshot_identifier(snapshot_name)
            .send()
            .await
            .map_err(|e| CloudError::ProviderError(e.to_string()))?;

        let snapshot = resp.db_snapshot().ok_or_else(|| {
            CloudError::Internal("No snapshot returned from CreateDBSnapshot".into())
        })?;

        Ok(CloudResource {
            id: uuid::Uuid::new_v4(),
            cloud_id: snapshot
                .db_snapshot_identifier()
                .map(|s| s.to_owned()),
            provider: CloudProvider::Aws,
            resource_type: ResourceType::Snapshot,
            name: snapshot_name.to_owned(),
            region: region.to_owned(),
            status: ResourceStatus::Creating,
            metadata: serde_json::json!({
                "db_instance_identifier": db_id,
                "engine": snapshot.engine().unwrap_or_default(),
                "storage_gb": snapshot.allocated_storage(),
                "status": snapshot.status().unwrap_or_default(),
            }),
            tags: std::collections::HashMap::new(),
            created_at: chrono::Utc::now(),
            updated_at: chrono::Utc::now(),
        })
    }

    async fn create_read_replica(
        &self,
        region: &str,
        source_db_id: &str,
        replica_name: &str,
    ) -> Result<CloudResource> {
        let region = self.resolve_region(region);
        let rds = self.rds_client(region)?;

        let resp = rds
            .create_db_instance_read_replica()
            .source_db_instance_identifier(source_db_id)
            .db_instance_identifier(replica_name)
            .send()
            .await
            .map_err(|e| CloudError::ProviderError(e.to_string()))?;

        let db = resp
            .db_instance()
            .ok_or_else(|| CloudError::Internal("No DB instance returned from CreateReadReplica".into()))?;

        Ok(aws_mapper::rds_instance_to_resource(db, region))
    }

    async fn list_parameter_groups(&self, region: &str) -> Result<Vec<CloudResource>> {
        let region = self.resolve_region(region);
        let rds = self.rds_client(region)?;

        let resp = rds
            .describe_db_parameter_groups()
            .send()
            .await
            .map_err(|e| CloudError::ProviderError(e.to_string()))?;

        Ok(resp
            .db_parameter_groups()
            .iter()
            .map(|pg| CloudResource {
                id: uuid::Uuid::new_v4(),
                cloud_id: pg.db_parameter_group_arn().map(|s| s.to_owned()),
                provider: CloudProvider::Aws,
                resource_type: ResourceType::ParameterGroup,
                name: pg.db_parameter_group_name().unwrap_or_default().to_owned(),
                region: region.to_owned(),
                status: ResourceStatus::Available,
                metadata: serde_json::json!({
                    "family": pg.db_parameter_group_family().unwrap_or_default(),
                    "description": pg.description().unwrap_or_default(),
                }),
                tags: std::collections::HashMap::new(),
                created_at: chrono::Utc::now(),
                updated_at: chrono::Utc::now(),
            })
            .collect())
    }

    async fn get_parameter_group(&self, region: &str, name: &str) -> Result<serde_json::Value> {
        let region = self.resolve_region(region);
        let rds = self.rds_client(region)?;

        let resp = rds
            .describe_db_parameter_groups()
            .db_parameter_group_name(name)
            .send()
            .await
            .map_err(|e| CloudError::ProviderError(e.to_string()))?;

        let pg = resp
            .db_parameter_groups()
            .first()
            .ok_or_else(|| CloudError::NotFound(format!("Parameter group {} not found", name)))?;

        Ok(serde_json::json!({
            "name": pg.db_parameter_group_name().unwrap_or_default(),
            "family": pg.db_parameter_group_family().unwrap_or_default(),
            "description": pg.description().unwrap_or_default(),
            "arn": pg.db_parameter_group_arn().unwrap_or_default(),
        }))
    }

    async fn restore_to_point_in_time(
        &self,
        region: &str,
        source_db_id: &str,
        target_name: &str,
        restore_time: &str,
    ) -> Result<CloudResource> {
        let region = self.resolve_region(region);
        let rds = self.rds_client(region)?;

        let restore_dt = chrono::DateTime::parse_from_rfc3339(restore_time)
            .map_err(|e| CloudError::BadRequest(format!("Invalid restore_time: {}", e)))?;
        let aws_dt = aws_sdk_rds::primitives::DateTime::from_millis(restore_dt.timestamp_millis());

        let resp = rds
            .restore_db_instance_to_point_in_time()
            .source_db_instance_identifier(source_db_id)
            .target_db_instance_identifier(target_name)
            .restore_time(aws_dt)
            .send()
            .await
            .map_err(|e| CloudError::ProviderError(e.to_string()))?;

        let db = resp
            .db_instance()
            .ok_or_else(|| CloudError::Internal("No DB instance returned from RestoreToPointInTime".into()))?;

        Ok(aws_mapper::rds_instance_to_resource(db, region))
    }
}

#[async_trait]
impl ServerlessProvider for AwsSdkProvider {
    async fn list_functions(&self, region: &str) -> Result<Vec<CloudResource>> {
        let region = self.resolve_region(region);
        tracing::info!(provider = "aws", region = region, "Listing Lambda functions via SDK");

        let lambda = self.lambda_client(region)?;
        let mut functions = Vec::new();
        let mut marker: Option<String> = None;

        loop {
            let mut req = lambda.list_functions();
            if let Some(m) = &marker {
                req = req.marker(m);
            }

            let resp = req
                .send()
                .await
                .map_err(|e| CloudError::ProviderError(e.to_string()))?;

            for f in resp.functions() {
                let name = f.function_name().unwrap_or_default();
                functions.push(CloudResource {
                    id: uuid::Uuid::new_v4(),
                    cloud_id: f.function_arn().map(|s| s.to_owned()),
                    provider: CloudProvider::Aws,
                    resource_type: ResourceType::Function,
                    name: name.to_owned(),
                    region: region.to_owned(),
                    status: ResourceStatus::Available,
                    metadata: serde_json::json!({
                        "runtime": f.runtime().map(|r| format!("{:?}", r)).unwrap_or_default(),
                        "handler": f.handler().unwrap_or_default(),
                        "memory_mb": f.memory_size().unwrap_or_default(),
                        "timeout_seconds": f.timeout().unwrap_or_default(),
                        "code_size": f.code_size(),
                        "last_modified": f.last_modified().unwrap_or_default(),
                    }),
                    tags: std::collections::HashMap::new(),
                    created_at: chrono::Utc::now(),
                    updated_at: chrono::Utc::now(),
                });
            }

            marker = resp.next_marker().map(|s| s.to_owned());
            if marker.is_none() {
                break;
            }
        }

        Ok(functions)
    }

    async fn get_function(&self, region: &str, name: &str) -> Result<CloudResource> {
        let region = self.resolve_region(region);
        let lambda = self.lambda_client(region)?;

        let resp = lambda
            .get_function()
            .function_name(name)
            .send()
            .await
            .map_err(|e| CloudError::ProviderError(e.to_string()))?;

        let config = resp.configuration().ok_or_else(|| {
            CloudError::NotFound(format!("Lambda function {} not found", name))
        })?;

        Ok(CloudResource {
            id: uuid::Uuid::new_v4(),
            cloud_id: config.function_arn().map(|s| s.to_owned()),
            provider: CloudProvider::Aws,
            resource_type: ResourceType::Function,
            name: config.function_name().unwrap_or_default().to_owned(),
            region: region.to_owned(),
            status: ResourceStatus::Available,
            metadata: serde_json::json!({
                "runtime": config.runtime().map(|r| format!("{:?}", r)).unwrap_or_default(),
                "handler": config.handler().unwrap_or_default(),
                "memory_mb": config.memory_size().unwrap_or_default(),
                "timeout_seconds": config.timeout().unwrap_or_default(),
                "code_size": config.code_size(),
                "last_modified": config.last_modified().unwrap_or_default(),
                "role": config.role().unwrap_or_default(),
                "version": config.version().unwrap_or_default(),
            }),
            tags: resp.tags().map(|t| t.iter().map(|(k, v)| (k.clone(), v.clone())).collect()).unwrap_or_default(),
            created_at: chrono::Utc::now(),
            updated_at: chrono::Utc::now(),
        })
    }

    async fn create_function(
        &self,
        region: &str,
        config: CreateFunctionRequest,
    ) -> Result<CloudResource> {
        let region = self.resolve_region(region);
        tracing::info!(provider = "aws", region = region, name = config.name.as_str(), "Creating Lambda function via SDK");

        let lambda = self.lambda_client(region)?;

        let env_vars = aws_sdk_lambda::types::Environment::builder()
            .set_variables(Some(config.environment))
            .build();

        // Create function with a placeholder empty zip — real usage would supply actual code.
        let code = aws_sdk_lambda::types::FunctionCode::builder()
            .zip_file(aws_sdk_lambda::primitives::Blob::new(vec![0u8; 22])) // minimal zip placeholder
            .build();

        let resp = lambda
            .create_function()
            .function_name(&config.name)
            .runtime(aws_sdk_lambda::types::Runtime::from(config.runtime.as_str()))
            .handler(&config.handler)
            .role(&config.role_arn)
            .memory_size(config.memory_mb)
            .timeout(config.timeout_seconds)
            .environment(env_vars)
            .code(code)
            .send()
            .await
            .map_err(|e| CloudError::ProviderError(e.to_string()))?;

        Ok(CloudResource {
            id: uuid::Uuid::new_v4(),
            cloud_id: resp.function_arn().map(|s| s.to_owned()),
            provider: CloudProvider::Aws,
            resource_type: ResourceType::Function,
            name: resp.function_name().unwrap_or_default().to_owned(),
            region: region.to_owned(),
            status: ResourceStatus::Creating,
            metadata: serde_json::json!({
                "runtime": format!("{:?}", resp.runtime()),
                "handler": resp.handler().unwrap_or_default(),
                "memory_mb": resp.memory_size().unwrap_or_default(),
                "timeout_seconds": resp.timeout().unwrap_or_default(),
            }),
            tags: std::collections::HashMap::new(),
            created_at: chrono::Utc::now(),
            updated_at: chrono::Utc::now(),
        })
    }

    async fn update_function_code(
        &self,
        region: &str,
        name: &str,
        zip_bytes: Vec<u8>,
    ) -> Result<CloudResource> {
        let region = self.resolve_region(region);
        let lambda = self.lambda_client(region)?;

        let resp = lambda
            .update_function_code()
            .function_name(name)
            .zip_file(aws_sdk_lambda::primitives::Blob::new(zip_bytes))
            .send()
            .await
            .map_err(|e| CloudError::ProviderError(e.to_string()))?;

        Ok(CloudResource {
            id: uuid::Uuid::new_v4(),
            cloud_id: resp.function_arn().map(|s| s.to_owned()),
            provider: CloudProvider::Aws,
            resource_type: ResourceType::Function,
            name: resp.function_name().unwrap_or_default().to_owned(),
            region: region.to_owned(),
            status: ResourceStatus::Updating,
            metadata: serde_json::json!({
                "runtime": resp.runtime().map(|r| format!("{:?}", r)).unwrap_or_default(),
                "handler": resp.handler().unwrap_or_default(),
                "code_size": resp.code_size(),
                "last_modified": resp.last_modified().unwrap_or_default(),
            }),
            tags: std::collections::HashMap::new(),
            created_at: chrono::Utc::now(),
            updated_at: chrono::Utc::now(),
        })
    }

    async fn delete_function(&self, region: &str, name: &str) -> Result<()> {
        let region = self.resolve_region(region);
        let lambda = self.lambda_client(region)?;
        lambda
            .delete_function()
            .function_name(name)
            .send()
            .await
            .map_err(|e| CloudError::ProviderError(e.to_string()))?;
        Ok(())
    }

    async fn invoke_function(
        &self,
        region: &str,
        name: &str,
        payload: serde_json::Value,
    ) -> Result<serde_json::Value> {
        let region = self.resolve_region(region);
        let lambda = self.lambda_client(region)?;

        let payload_bytes = serde_json::to_vec(&payload)
            .map_err(|e| CloudError::BadRequest(e.to_string()))?;

        let resp = lambda
            .invoke()
            .function_name(name)
            .payload(aws_sdk_lambda::primitives::Blob::new(payload_bytes))
            .send()
            .await
            .map_err(|e| CloudError::ProviderError(e.to_string()))?;

        let response_payload = resp
            .payload()
            .map(|p| {
                serde_json::from_slice(p.as_ref())
                    .unwrap_or_else(|_| serde_json::json!({"raw": String::from_utf8_lossy(p.as_ref()).to_string()}))
            })
            .unwrap_or(serde_json::json!(null));

        Ok(serde_json::json!({
            "status_code": resp.status_code(),
            "function_error": resp.function_error(),
            "payload": response_payload,
        }))
    }

    async fn list_function_versions(
        &self,
        region: &str,
        name: &str,
    ) -> Result<Vec<CloudResource>> {
        let region = self.resolve_region(region);
        let lambda = self.lambda_client(region)?;

        let resp = lambda
            .list_versions_by_function()
            .function_name(name)
            .send()
            .await
            .map_err(|e| CloudError::ProviderError(e.to_string()))?;

        let versions: Vec<CloudResource> = resp
            .versions()
            .iter()
            .map(|v| CloudResource {
                id: uuid::Uuid::new_v4(),
                cloud_id: v.function_arn().map(|s| s.to_owned()),
                provider: CloudProvider::Aws,
                resource_type: ResourceType::Function,
                name: format!("{}:{}", v.function_name().unwrap_or_default(), v.version().unwrap_or_default()),
                region: region.to_owned(),
                status: ResourceStatus::Available,
                metadata: serde_json::json!({
                    "version": v.version().unwrap_or_default(),
                    "runtime": v.runtime().map(|r| format!("{:?}", r)).unwrap_or_default(),
                    "code_size": v.code_size(),
                    "last_modified": v.last_modified().unwrap_or_default(),
                }),
                tags: std::collections::HashMap::new(),
                created_at: chrono::Utc::now(),
                updated_at: chrono::Utc::now(),
            })
            .collect();

        Ok(versions)
    }
}

// ---------------------------------------------------------------------------
// API Gateway (APIGatewayV2) — real SDK implementation
// ---------------------------------------------------------------------------

impl AwsSdkProvider {
    fn apigw_client(&self, region: &str) -> Result<aws_sdk_apigatewayv2::Client> {
        let config = self
            .credentials
            .aws_config_for_region(region)
            .map_err(|e| CloudError::ProviderError(e.to_string()))?;
        Ok(aws_sdk_apigatewayv2::Client::new(&config))
    }

    fn cloudfront_client(&self, region: &str) -> Result<aws_sdk_cloudfront::Client> {
        let config = self
            .credentials
            .aws_config_for_region(region)
            .map_err(|e| CloudError::ProviderError(e.to_string()))?;
        Ok(aws_sdk_cloudfront::Client::new(&config))
    }
}

#[async_trait]
impl ApiGatewayProvider for AwsSdkProvider {
    async fn list_apis(&self, region: &str) -> Result<Vec<CloudResource>> {
        let region = self.resolve_region(region);
        tracing::info!(provider = "aws", region = region, "Listing APIs via APIGatewayV2 SDK");

        let client = self.apigw_client(region)?;
        let resp = client
            .get_apis()
            .send()
            .await
            .map_err(|e| CloudError::ProviderError(e.to_string()))?;

        let apis = resp.items().iter().map(|api| {
            let now = chrono::Utc::now();
            CloudResource {
                id: uuid::Uuid::new_v4(),
                cloud_id: api.api_id().map(|s| s.to_string()),
                provider: CloudProvider::Aws,
                resource_type: ResourceType::ApiGateway,
                name: api.name().unwrap_or("unnamed").to_string(),
                region: region.to_string(),
                status: ResourceStatus::Available,
                metadata: serde_json::json!({
                    "protocol_type": api.protocol_type().map(|p| p.as_str()).unwrap_or("UNKNOWN"),
                    "api_endpoint": api.api_endpoint().unwrap_or(""),
                    "description": api.description().unwrap_or(""),
                }),
                tags: api.tags().map(|t| t.iter().map(|(k, v)| (k.clone(), v.clone())).collect()).unwrap_or_default(),
                created_at: now,
                updated_at: now,
            }
        }).collect();

        Ok(apis)
    }

    async fn get_api(&self, region: &str, id: &str) -> Result<CloudResource> {
        let region = self.resolve_region(region);
        let client = self.apigw_client(region)?;
        let resp = client
            .get_api()
            .api_id(id)
            .send()
            .await
            .map_err(|e| CloudError::ProviderError(e.to_string()))?;

        let now = chrono::Utc::now();
        Ok(CloudResource {
            id: uuid::Uuid::new_v4(),
            cloud_id: resp.api_id().map(|s| s.to_string()),
            provider: CloudProvider::Aws,
            resource_type: ResourceType::ApiGateway,
            name: resp.name().unwrap_or("unnamed").to_string(),
            region: region.to_string(),
            status: ResourceStatus::Available,
            metadata: serde_json::json!({
                "protocol_type": resp.protocol_type().map(|p| p.as_str()).unwrap_or("UNKNOWN"),
                "api_endpoint": resp.api_endpoint().unwrap_or(""),
                "description": resp.description().unwrap_or(""),
            }),
            tags: resp.tags().map(|t| t.iter().map(|(k, v)| (k.clone(), v.clone())).collect()).unwrap_or_default(),
            created_at: now,
            updated_at: now,
        })
    }

    async fn create_api(&self, region: &str, name: &str, protocol: &str) -> Result<CloudResource> {
        let region = self.resolve_region(region);
        let client = self.apigw_client(region)?;

        let proto = match protocol.to_uppercase().as_str() {
            "WEBSOCKET" => aws_sdk_apigatewayv2::types::ProtocolType::Websocket,
            _ => aws_sdk_apigatewayv2::types::ProtocolType::Http,
        };

        let resp = client
            .create_api()
            .name(name)
            .protocol_type(proto)
            .send()
            .await
            .map_err(|e| CloudError::ProviderError(e.to_string()))?;

        let now = chrono::Utc::now();
        Ok(CloudResource {
            id: uuid::Uuid::new_v4(),
            cloud_id: resp.api_id().map(|s| s.to_string()),
            provider: CloudProvider::Aws,
            resource_type: ResourceType::ApiGateway,
            name: resp.name().unwrap_or("unnamed").to_string(),
            region: region.to_string(),
            status: ResourceStatus::Available,
            metadata: serde_json::json!({
                "protocol_type": resp.protocol_type().map(|p| p.as_str()).unwrap_or("UNKNOWN"),
                "api_endpoint": resp.api_endpoint().unwrap_or(""),
            }),
            tags: Default::default(),
            created_at: now,
            updated_at: now,
        })
    }

    async fn delete_api(&self, region: &str, id: &str) -> Result<()> {
        let region = self.resolve_region(region);
        let client = self.apigw_client(region)?;
        client
            .delete_api()
            .api_id(id)
            .send()
            .await
            .map_err(|e| CloudError::ProviderError(e.to_string()))?;
        Ok(())
    }

    async fn list_routes(&self, region: &str, api_id: &str) -> Result<Vec<CloudResource>> {
        let region = self.resolve_region(region);
        let client = self.apigw_client(region)?;
        let resp = client
            .get_routes()
            .api_id(api_id)
            .send()
            .await
            .map_err(|e| CloudError::ProviderError(e.to_string()))?;

        let routes = resp.items().iter().map(|r| {
            let now = chrono::Utc::now();
            CloudResource {
                id: uuid::Uuid::new_v4(),
                cloud_id: r.route_id().map(|s| s.to_string()),
                provider: CloudProvider::Aws,
                resource_type: ResourceType::ApiRoute,
                name: r.route_key().unwrap_or("").to_string(),
                region: region.to_string(),
                status: ResourceStatus::Available,
                metadata: serde_json::json!({
                    "api_id": api_id,
                    "route_key": r.route_key().unwrap_or(""),
                    "target": r.target().unwrap_or(""),
                }),
                tags: Default::default(),
                created_at: now,
                updated_at: now,
            }
        }).collect();

        Ok(routes)
    }

    async fn create_route(&self, region: &str, api_id: &str, method: &str, path: &str) -> Result<CloudResource> {
        let region = self.resolve_region(region);
        let client = self.apigw_client(region)?;
        let route_key = format!("{} {}", method, path);

        let resp = client
            .create_route()
            .api_id(api_id)
            .route_key(&route_key)
            .send()
            .await
            .map_err(|e| CloudError::ProviderError(e.to_string()))?;

        let now = chrono::Utc::now();
        Ok(CloudResource {
            id: uuid::Uuid::new_v4(),
            cloud_id: resp.route_id().map(|s| s.to_string()),
            provider: CloudProvider::Aws,
            resource_type: ResourceType::ApiRoute,
            name: resp.route_key().unwrap_or("").to_string(),
            region: region.to_string(),
            status: ResourceStatus::Available,
            metadata: serde_json::json!({
                "api_id": api_id,
                "route_key": resp.route_key().unwrap_or(""),
            }),
            tags: Default::default(),
            created_at: now,
            updated_at: now,
        })
    }

    async fn list_stages(&self, region: &str, api_id: &str) -> Result<Vec<CloudResource>> {
        let region = self.resolve_region(region);
        let client = self.apigw_client(region)?;
        let resp = client
            .get_stages()
            .api_id(api_id)
            .send()
            .await
            .map_err(|e| CloudError::ProviderError(e.to_string()))?;

        let stages = resp.items().iter().map(|s| {
            let now = chrono::Utc::now();
            CloudResource {
                id: uuid::Uuid::new_v4(),
                cloud_id: s.stage_name().map(|sn| sn.to_string()),
                provider: CloudProvider::Aws,
                resource_type: ResourceType::ApiStage,
                name: s.stage_name().unwrap_or("").to_string(),
                region: region.to_string(),
                status: ResourceStatus::Available,
                metadata: serde_json::json!({
                    "api_id": api_id,
                    "stage_name": s.stage_name().unwrap_or(""),
                    "auto_deploy": s.auto_deploy(),
                    "description": s.description().unwrap_or(""),
                }),
                tags: s.tags().map(|t| t.iter().map(|(k, v)| (k.clone(), v.clone())).collect()).unwrap_or_default(),
                created_at: now,
                updated_at: now,
            }
        }).collect();

        Ok(stages)
    }

    async fn create_stage(&self, region: &str, api_id: &str, name: &str) -> Result<CloudResource> {
        let region = self.resolve_region(region);
        let client = self.apigw_client(region)?;
        let resp = client
            .create_stage()
            .api_id(api_id)
            .stage_name(name)
            .send()
            .await
            .map_err(|e| CloudError::ProviderError(e.to_string()))?;

        let now = chrono::Utc::now();
        Ok(CloudResource {
            id: uuid::Uuid::new_v4(),
            cloud_id: resp.stage_name().map(|s| s.to_string()),
            provider: CloudProvider::Aws,
            resource_type: ResourceType::ApiStage,
            name: resp.stage_name().unwrap_or("").to_string(),
            region: region.to_string(),
            status: ResourceStatus::Available,
            metadata: serde_json::json!({
                "api_id": api_id,
                "stage_name": resp.stage_name().unwrap_or(""),
                "auto_deploy": resp.auto_deploy(),
            }),
            tags: Default::default(),
            created_at: now,
            updated_at: now,
        })
    }
}

// ---------------------------------------------------------------------------
// CDN / CloudFront — real SDK implementation
// ---------------------------------------------------------------------------

#[async_trait]
impl CdnProvider for AwsSdkProvider {
    async fn list_distributions(&self, region: &str) -> Result<Vec<CloudResource>> {
        let region = self.resolve_region(region);
        tracing::info!(provider = "aws", region = region, "Listing CloudFront distributions via SDK");

        let client = self.cloudfront_client(region)?;
        let resp = client
            .list_distributions()
            .send()
            .await
            .map_err(|e| CloudError::ProviderError(e.to_string()))?;

        let distributions = resp
            .distribution_list()
            .map(|dl| {
                dl.items().iter().map(|d| {
                    let now = chrono::Utc::now();
                    CloudResource {
                        id: uuid::Uuid::new_v4(),
                        cloud_id: Some(d.id().to_string()),
                        provider: CloudProvider::Aws,
                        resource_type: ResourceType::CdnDistribution,
                        name: d.id().to_string(),
                        region: region.to_string(),
                        status: if d.status() == "Deployed" { ResourceStatus::Available } else { ResourceStatus::Pending },
                        metadata: serde_json::json!({
                            "domain_name": d.domain_name(),
                            "status": d.status(),
                            "enabled": d.origins().map(|o| !o.items().is_empty()).unwrap_or(false),
                            "comment": d.comment(),
                        }),
                        tags: Default::default(),
                        created_at: now,
                        updated_at: now,
                    }
                }).collect::<Vec<_>>()
            })
            .unwrap_or_default();

        Ok(distributions)
    }

    async fn get_distribution(&self, region: &str, id: &str) -> Result<CloudResource> {
        let region = self.resolve_region(region);
        let client = self.cloudfront_client(region)?;
        let resp = client
            .get_distribution()
            .id(id)
            .send()
            .await
            .map_err(|e| CloudError::ProviderError(e.to_string()))?;

        let dist = resp.distribution().ok_or_else(|| {
            CloudError::NotFound(format!("CloudFront distribution {} not found", id))
        })?;

        let now = chrono::Utc::now();
        Ok(CloudResource {
            id: uuid::Uuid::new_v4(),
            cloud_id: Some(dist.id().to_string()),
            provider: CloudProvider::Aws,
            resource_type: ResourceType::CdnDistribution,
            name: dist.id().to_string(),
            region: region.to_string(),
            status: if dist.status() == "Deployed" { ResourceStatus::Available } else { ResourceStatus::Pending },
            metadata: serde_json::json!({
                "domain_name": dist.domain_name(),
                "status": dist.status(),
            }),
            tags: Default::default(),
            created_at: now,
            updated_at: now,
        })
    }

    async fn create_distribution(&self, region: &str, config: CreateDistributionRequest) -> Result<CloudResource> {
        let region = self.resolve_region(region);
        let client = self.cloudfront_client(region)?;

        use aws_sdk_cloudfront::types::{
            DistributionConfig, Origins, Origin, DefaultCacheBehavior, ViewerProtocolPolicy,
        };

        let origin_id = "default-origin";
        let origin = Origin::builder()
            .domain_name(&config.origin_domain)
            .id(origin_id)
            .build()
            .map_err(|e| CloudError::ProviderError(format!("Failed to build origin: {}", e)))?;

        let origins = Origins::builder()
            .quantity(1)
            .items(origin)
            .build()
            .map_err(|e| CloudError::ProviderError(format!("Failed to build origins: {}", e)))?;

        let cache_behavior = DefaultCacheBehavior::builder()
            .target_origin_id(origin_id)
            .viewer_protocol_policy(ViewerProtocolPolicy::RedirectToHttps)
            .build()
            .map_err(|e| CloudError::ProviderError(format!("Failed to build cache behavior: {}", e)))?;

        let mut dist_config_builder = DistributionConfig::builder()
            .origins(origins)
            .default_cache_behavior(cache_behavior)
            .enabled(config.enabled)
            .caller_reference(uuid::Uuid::new_v4().to_string())
            .comment(config.comment.unwrap_or_default());

        if let Some(root_obj) = &config.default_root_object {
            dist_config_builder = dist_config_builder.default_root_object(root_obj);
        }

        let dist_config = dist_config_builder
            .build()
            .map_err(|e| CloudError::ProviderError(format!("Failed to build dist config: {}", e)))?;

        let resp = client
            .create_distribution()
            .distribution_config(dist_config)
            .send()
            .await
            .map_err(|e| CloudError::ProviderError(e.to_string()))?;

        let dist = resp.distribution().ok_or_else(|| {
            CloudError::ProviderError("No distribution in response".to_string())
        })?;

        let now = chrono::Utc::now();
        Ok(CloudResource {
            id: uuid::Uuid::new_v4(),
            cloud_id: Some(dist.id().to_string()),
            provider: CloudProvider::Aws,
            resource_type: ResourceType::CdnDistribution,
            name: dist.id().to_string(),
            region: region.to_string(),
            status: ResourceStatus::Creating,
            metadata: serde_json::json!({
                "domain_name": dist.domain_name(),
                "status": dist.status(),
                "origin_domain": config.origin_domain,
            }),
            tags: Default::default(),
            created_at: now,
            updated_at: now,
        })
    }

    async fn delete_distribution(&self, region: &str, id: &str) -> Result<()> {
        let region = self.resolve_region(region);
        let client = self.cloudfront_client(region)?;

        // Must get the ETag first to delete
        let get_resp = client
            .get_distribution()
            .id(id)
            .send()
            .await
            .map_err(|e| CloudError::ProviderError(e.to_string()))?;

        let etag = get_resp.e_tag().unwrap_or("");
        client
            .delete_distribution()
            .id(id)
            .if_match(etag)
            .send()
            .await
            .map_err(|e| CloudError::ProviderError(e.to_string()))?;

        Ok(())
    }

    async fn invalidate_cache(&self, region: &str, distribution_id: &str, paths: Vec<String>) -> Result<()> {
        let region = self.resolve_region(region);
        let client = self.cloudfront_client(region)?;

        use aws_sdk_cloudfront::types::{InvalidationBatch, Paths};

        let cf_paths = Paths::builder()
            .quantity(paths.len() as i32)
            .set_items(Some(paths))
            .build()
            .map_err(|e| CloudError::ProviderError(format!("Failed to build paths: {}", e)))?;

        let batch = InvalidationBatch::builder()
            .paths(cf_paths)
            .caller_reference(uuid::Uuid::new_v4().to_string())
            .build()
            .map_err(|e| CloudError::ProviderError(format!("Failed to build batch: {}", e)))?;

        client
            .create_invalidation()
            .distribution_id(distribution_id)
            .invalidation_batch(batch)
            .send()
            .await
            .map_err(|e| CloudError::ProviderError(e.to_string()))?;

        Ok(())
    }
}

// ===== Traffic (CloudWatch Logs) =====

impl AwsSdkProvider {
    fn cwlogs_client(&self, region: &str) -> Result<aws_sdk_cloudwatchlogs::Client> {
        let cfg = self.credentials.aws_config_for_region(region).map_err(|e| CloudError::ProviderError(e.to_string()))?;
        Ok(aws_sdk_cloudwatchlogs::Client::new(&cfg))
    }
    fn eks_real_client(&self, region: &str) -> Result<aws_sdk_eks::Client> {
        let cfg = self.credentials.aws_config_for_region(region).map_err(|e| CloudError::ProviderError(e.to_string()))?;
        Ok(aws_sdk_eks::Client::new(&cfg))
    }
}

#[async_trait]
impl TrafficProvider for AwsSdkProvider {
    async fn get_flow_logs(&self, region: &str, log_group: Option<&str>, start_time: Option<i64>, end_time: Option<i64>) -> Result<FlowLogResponse> {
        let region = self.resolve_region(region);
        let client = self.cwlogs_client(region)?;
        let lg = log_group.unwrap_or("/aws/vpc/flow-logs");
        let now_ts = chrono::Utc::now().timestamp();
        let (st, et) = (start_time.unwrap_or(now_ts - 3600), end_time.unwrap_or(now_ts));
        let qs = "fields @timestamp, srcAddr, dstAddr, bytes, packets | stats sum(bytes) as totalBytes, sum(packets) as totalPackets by srcAddr, dstAddr | sort totalBytes desc | limit 50";
        let sr = client.start_query().log_group_name(lg).start_time(st).end_time(et).query_string(qs).send().await.map_err(|e| CloudError::ProviderError(format!("CWL start_query: {}", e)))?;
        let qid = sr.query_id().unwrap_or_default().to_string();
        let mut entries = Vec::new();
        for _ in 0..10 {
            tokio::time::sleep(std::time::Duration::from_secs(1)).await;
            let res = client.get_query_results().query_id(&qid).send().await.map_err(|e| CloudError::ProviderError(format!("CWL results: {}", e)))?;
            let ss = res.status().map(|s| s.as_str().to_owned()).unwrap_or_default();
            if ss == "Complete" || ss == "Failed" || ss == "Cancelled" {
                if let Some(rows) = res.results { for row in rows { let (mut sa, mut da) = (String::new(), String::new()); let (mut tb, mut tp): (u64, u64) = (0, 0); for f in &row { match f.field().unwrap_or_default() { "srcAddr" => sa = f.value().unwrap_or_default().to_string(), "dstAddr" => da = f.value().unwrap_or_default().to_string(), "totalBytes" => tb = f.value().unwrap_or_default().parse().unwrap_or(0), "totalPackets" => tp = f.value().unwrap_or_default().parse().unwrap_or(0), _ => {} } } if !sa.is_empty() && !da.is_empty() { entries.push(FlowLogEntry{src_addr:sa,dst_addr:da,total_bytes:tb,total_packets:tp,timestamp:chrono::Utc::now().to_rfc3339()}); } } }
                break;
            }
        }
        Ok(FlowLogResponse { entries, query_id: Some(qid) })
    }
    async fn get_traffic_summary(&self, region: &str) -> Result<TrafficSummary> {
        let region = self.resolve_region(region);
        let fl = self.get_flow_logs(region, None, None, None).await?;
        let (mut bi, mut bo): (u64, u64) = (0, 0);
        let mut tm: std::collections::HashMap<String, (u64, u64, String)> = Default::default();
        for e in &fl.entries { let iis = e.src_addr.starts_with("10.") || e.src_addr.starts_with("172.") || e.src_addr.starts_with("192.168."); let iid = e.dst_addr.starts_with("10.") || e.dst_addr.starts_with("172.") || e.dst_addr.starts_with("192.168."); if iis && !iid { bo += e.total_bytes; } else { bi += e.total_bytes; } { let x = tm.entry(e.src_addr.clone()).or_insert((0,0,"outbound".into())); x.0 += e.total_bytes; x.1 += e.total_packets; } { let x = tm.entry(e.dst_addr.clone()).or_insert((0,0,"inbound".into())); x.0 += e.total_bytes; x.1 += e.total_packets; } }
        let mut tt: Vec<TopTalker> = tm.into_iter().map(|(ip,(b,p,d))| TopTalker{ip,bytes:b,packets:p,direction:d}).collect();
        tt.sort_by(|a,b| b.bytes.cmp(&a.bytes)); tt.truncate(10);
        let tr = (bi+bo)/1500; let te = tr/400;
        Ok(TrafficSummary{total_bytes_in:bi,total_bytes_out:bo,total_requests:tr,total_errors:te,top_talkers:tt,per_service:vec![],timestamp:chrono::Utc::now().to_rfc3339()})
    }
}

// ===== Kubernetes (EKS) =====

#[async_trait]
impl KubernetesProvider for AwsSdkProvider {
    async fn list_clusters(&self, region: &str) -> Result<Vec<CloudResource>> {
        let region = self.resolve_region(region); let client = self.eks_real_client(region)?;
        let ck = format!("eks:clusters:{}", region);
        if let Some(c) = None::<Vec<CloudResource>> { return Ok(c); }
        let resp = client.list_clusters().send().await.map_err(|e| CloudError::ProviderError(format!("EKS list: {}", e)))?;
        let mut out = Vec::new();
        for n in resp.clusters() { if let Ok(d) = client.describe_cluster().name(n).send().await { if let Some(cl) = d.cluster() { let st = match cl.status().map(|s| s.as_str()) { Some("ACTIVE")=>ResourceStatus::Running, Some("CREATING")=>ResourceStatus::Creating, Some("DELETING")=>ResourceStatus::Deleting, _=>ResourceStatus::Pending }; let mut tags: std::collections::HashMap<String,String> = Default::default(); if let Some(t) = cl.tags() { for (k,v) in t { tags.insert(k.clone(), v.clone()); } } out.push(CloudResource{id:uuid::Uuid::new_v4(),cloud_id:cl.arn().map(|s|s.to_owned()),provider:CloudProvider::Aws,resource_type:ResourceType::EksCluster,name:cl.name().unwrap_or_default().to_owned(),region:region.to_owned(),status:st,metadata:serde_json::json!({"version":cl.version().unwrap_or_default(),"endpoint":cl.endpoint().unwrap_or_default(),"platform":"eks"}),tags,created_at:chrono::Utc::now(),updated_at:chrono::Utc::now()}); } } }
        let _ = self.cache.invalidate_pattern(&["cloud", "aws", "eks"]).await;
        Ok(out)
    }
    async fn get_cluster(&self, region: &str, name: &str) -> Result<CloudResource> {
        let region = self.resolve_region(region); let client = self.eks_real_client(region)?;
        let resp = client.describe_cluster().name(name).send().await.map_err(|e| CloudError::ProviderError(format!("EKS desc: {}", e)))?;
        let cl = resp.cluster().ok_or_else(|| CloudError::NotFound(format!("Cluster {} not found", name)))?;
        let st = match cl.status().map(|s| s.as_str()) { Some("ACTIVE")=>ResourceStatus::Running, Some("CREATING")=>ResourceStatus::Creating, _=>ResourceStatus::Pending };
        let mut tags: std::collections::HashMap<String,String> = Default::default(); if let Some(t) = cl.tags() { for (k,v) in t { tags.insert(k.clone(), v.clone()); } }
        Ok(CloudResource{id:uuid::Uuid::new_v4(),cloud_id:cl.arn().map(|s|s.to_owned()),provider:CloudProvider::Aws,resource_type:ResourceType::EksCluster,name:cl.name().unwrap_or_default().to_owned(),region:region.to_owned(),status:st,metadata:serde_json::json!({"version":cl.version().unwrap_or_default(),"platform":"eks"}),tags,created_at:chrono::Utc::now(),updated_at:chrono::Utc::now()})
    }
    async fn create_cluster(&self, region: &str, config: CreateClusterRequest) -> Result<CloudResource> {
        let region = self.resolve_region(region); let client = self.eks_real_client(region)?;
        let mut b = client.create_cluster().name(&config.name).role_arn(&config.role_arn).resources_vpc_config(aws_sdk_eks::types::VpcConfigRequest::builder().set_subnet_ids(Some(config.subnet_ids.clone())).set_security_group_ids(Some(config.security_group_ids.clone())).build());
        if let Some(v) = &config.version { b = b.version(v); } for (k,v) in &config.tags { b = b.tags(k.clone(), v.clone()); }
        let resp = b.send().await.map_err(|e| CloudError::ProviderError(format!("EKS create: {}", e)))?;
        let cl = resp.cluster().ok_or_else(|| CloudError::ProviderError("empty".into()))?;
        let _ = self.cache.invalidate_pattern(&["cloud", "aws", "eks"]).await;
        Ok(CloudResource{id:uuid::Uuid::new_v4(),cloud_id:cl.arn().map(|s|s.to_owned()),provider:CloudProvider::Aws,resource_type:ResourceType::EksCluster,name:cl.name().unwrap_or_default().to_owned(),region:region.to_owned(),status:ResourceStatus::Creating,metadata:serde_json::json!({"platform":"eks"}),tags:config.tags,created_at:chrono::Utc::now(),updated_at:chrono::Utc::now()})
    }
    async fn delete_cluster(&self, region: &str, name: &str) -> Result<()> {
        let region = self.resolve_region(region); let client = self.eks_real_client(region)?;
        client.delete_cluster().name(name).send().await.map_err(|e| CloudError::ProviderError(e.to_string()))?;
        let _ = self.cache.invalidate_pattern(&["cloud", "aws", "eks"]).await; Ok(())
    }
    async fn list_node_groups(&self, region: &str, cluster_name: &str) -> Result<Vec<CloudResource>> {
        let region = self.resolve_region(region); let client = self.eks_real_client(region)?;
        let ck = format!("eks:ng:{}:{}", region, cluster_name);
        if let Some(c) = None::<Vec<CloudResource>> { return Ok(c); }
        let resp = client.list_nodegroups().cluster_name(cluster_name).send().await.map_err(|e| CloudError::ProviderError(e.to_string()))?;
        let mut out = Vec::new();
        for nn in resp.nodegroups() { if let Ok(d) = client.describe_nodegroup().cluster_name(cluster_name).nodegroup_name(nn).send().await { if let Some(ng) = d.nodegroup() { let st = match ng.status().map(|s| s.as_str()) { Some("ACTIVE")=>ResourceStatus::Running, Some("CREATING")=>ResourceStatus::Creating, Some("DEGRADED")=>ResourceStatus::Error, _=>ResourceStatus::Pending }; let sc = ng.scaling_config(); let mut tags: std::collections::HashMap<String,String> = Default::default(); if let Some(t) = ng.tags() { for (k,v) in t { tags.insert(k.clone(), v.clone()); } } out.push(CloudResource{id:uuid::Uuid::new_v4(),cloud_id:ng.nodegroup_arn().map(|s|s.to_owned()),provider:CloudProvider::Aws,resource_type:ResourceType::EksNodeGroup,name:ng.nodegroup_name().unwrap_or_default().to_owned(),region:region.to_owned(),status:st,metadata:serde_json::json!({"cluster_name":cluster_name,"instance_types":ng.instance_types(),"desired_size":sc.and_then(|s|s.desired_size())}),tags,created_at:chrono::Utc::now(),updated_at:chrono::Utc::now()}); } } }
        let _ = self.cache.invalidate_pattern(&["cloud", "aws", "eks"]).await;
        Ok(out)
    }
    async fn create_node_group(&self, region: &str, cluster_name: &str, config: CreateNodeGroupRequest) -> Result<CloudResource> {
        let region = self.resolve_region(region); let client = self.eks_real_client(region)?;
        let mut b = client.create_nodegroup().cluster_name(cluster_name).nodegroup_name(&config.name).node_role(&config.node_role_arn).set_subnets(Some(config.subnet_ids.clone())).set_instance_types(Some(config.instance_types.clone())).scaling_config(aws_sdk_eks::types::NodegroupScalingConfig::builder().desired_size(config.desired_size).min_size(config.min_size).max_size(config.max_size).build());
        if let Some(ds) = config.disk_size { b = b.disk_size(ds); } for (k,v) in &config.tags { b = b.tags(k.clone(), v.clone()); }
        let resp = b.send().await.map_err(|e| CloudError::ProviderError(e.to_string()))?;
        let ng = resp.nodegroup().ok_or_else(|| CloudError::ProviderError("empty".into()))?;
        let _ = self.cache.invalidate_pattern(&["cloud", "aws", "eks"]).await;
        Ok(CloudResource{id:uuid::Uuid::new_v4(),cloud_id:ng.nodegroup_arn().map(|s|s.to_owned()),provider:CloudProvider::Aws,resource_type:ResourceType::EksNodeGroup,name:ng.nodegroup_name().unwrap_or_default().to_owned(),region:region.to_owned(),status:ResourceStatus::Creating,metadata:serde_json::json!({"cluster_name":cluster_name}),tags:config.tags,created_at:chrono::Utc::now(),updated_at:chrono::Utc::now()})
    }
    async fn delete_node_group(&self, region: &str, cluster_name: &str, node_group_name: &str) -> Result<()> {
        let region = self.resolve_region(region); let client = self.eks_real_client(region)?;
        client.delete_nodegroup().cluster_name(cluster_name).nodegroup_name(node_group_name).send().await.map_err(|e| CloudError::ProviderError(e.to_string()))?;
        let _ = self.cache.invalidate_pattern(&["cloud", "aws", "eks"]).await; Ok(())
    }
    async fn scale_node_group(&self, region: &str, cluster_name: &str, node_group_name: &str, desired: i32) -> Result<()> {
        let region = self.resolve_region(region); let client = self.eks_real_client(region)?;
        client.update_nodegroup_config().cluster_name(cluster_name).nodegroup_name(node_group_name).scaling_config(aws_sdk_eks::types::NodegroupScalingConfig::builder().desired_size(desired).build()).send().await.map_err(|e| CloudError::ProviderError(e.to_string()))?;
        let _ = self.cache.invalidate_pattern(&["cloud", "aws", "eks"]).await; Ok(())
    }
}

#[async_trait]
impl ContainerRegistryProvider for AwsSdkProvider {
    async fn list_registries(&self, region: &str) -> Result<Vec<CloudResource>> {
        let region = self.resolve_region(region);
        let ecr = self.ecr_client(region)?;
        let resp = ecr.describe_repositories().send().await.map_err(|e| CloudError::ProviderError(e.to_string()))?;
        Ok(resp.repositories().iter().map(|r| CloudResource {
            id: uuid::Uuid::new_v4(), cloud_id: r.repository_arn().map(|s| s.to_owned()), provider: CloudProvider::Aws, resource_type: ResourceType::ContainerRegistry,
            name: r.repository_name().unwrap_or_default().to_owned(), region: region.to_owned(), status: ResourceStatus::Available,
            metadata: serde_json::json!({"repository_uri": r.repository_uri().unwrap_or_default()}),
            tags: std::collections::HashMap::new(), created_at: chrono::Utc::now(), updated_at: chrono::Utc::now(),
        }).collect())
    }

    async fn get_registry(&self, region: &str, id: &str) -> Result<CloudResource> {
        let region = self.resolve_region(region);
        let ecr = self.ecr_client(region)?;
        let resp = ecr.describe_repositories().repository_names(id).send().await.map_err(|e| CloudError::ProviderError(e.to_string()))?;
        let repo = resp.repositories().first().ok_or_else(|| CloudError::NotFound(format!("ECR repository {} not found", id)))?;
        Ok(CloudResource {
            id: uuid::Uuid::new_v4(), cloud_id: repo.repository_arn().map(|s| s.to_owned()), provider: CloudProvider::Aws, resource_type: ResourceType::ContainerRegistry,
            name: repo.repository_name().unwrap_or_default().to_owned(), region: region.to_owned(), status: ResourceStatus::Available,
            metadata: serde_json::json!({"repository_uri": repo.repository_uri().unwrap_or_default()}),
            tags: std::collections::HashMap::new(), created_at: chrono::Utc::now(), updated_at: chrono::Utc::now(),
        })
    }

    async fn create_registry(&self, region: &str, name: &str) -> Result<CloudResource> {
        let region = self.resolve_region(region);
        let ecr = self.ecr_client(region)?;
        let resp = ecr.create_repository().repository_name(name).send().await.map_err(|e| CloudError::ProviderError(e.to_string()))?;
        let repo = resp.repository().ok_or_else(|| CloudError::Internal("No repository returned".into()))?;
        Ok(CloudResource {
            id: uuid::Uuid::new_v4(), cloud_id: repo.repository_arn().map(|s| s.to_owned()), provider: CloudProvider::Aws, resource_type: ResourceType::ContainerRegistry,
            name: repo.repository_name().unwrap_or_default().to_owned(), region: region.to_owned(), status: ResourceStatus::Available,
            metadata: serde_json::json!({"repository_uri": repo.repository_uri().unwrap_or_default()}),
            tags: std::collections::HashMap::new(), created_at: chrono::Utc::now(), updated_at: chrono::Utc::now(),
        })
    }

    async fn delete_registry(&self, region: &str, id: &str) -> Result<()> {
        let region = self.resolve_region(region);
        let ecr = self.ecr_client(region)?;
        ecr.delete_repository().repository_name(id).force(true).send().await.map_err(|e| CloudError::ProviderError(e.to_string()))?;
        Ok(())
    }

    async fn list_images(&self, region: &str, registry: &str) -> Result<Vec<CloudResource>> {
        let region = self.resolve_region(region);
        let ecr = self.ecr_client(region)?;
        let resp = ecr.list_images().repository_name(registry).send().await.map_err(|e| CloudError::ProviderError(e.to_string()))?;
        Ok(resp.image_ids().iter().map(|img| CloudResource {
            id: uuid::Uuid::new_v4(), cloud_id: img.image_digest().map(|s| s.to_owned()), provider: CloudProvider::Aws, resource_type: ResourceType::Image,
            name: img.image_tag().unwrap_or("untagged").to_owned(), region: region.to_owned(), status: ResourceStatus::Available,
            metadata: serde_json::json!({"registry": registry, "image_digest": img.image_digest().unwrap_or_default(), "image_tag": img.image_tag().unwrap_or_default()}),
            tags: std::collections::HashMap::new(), created_at: chrono::Utc::now(), updated_at: chrono::Utc::now(),
        }).collect())
    }

    async fn get_image_scan_results(&self, region: &str, registry: &str, image_tag: &str) -> Result<serde_json::Value> {
        let region = self.resolve_region(region);
        let ecr = self.ecr_client(region)?;
        let image_id = aws_sdk_ecr::types::ImageIdentifier::builder().image_tag(image_tag).build();
        let resp = ecr.describe_image_scan_findings().repository_name(registry).image_id(image_id).send().await.map_err(|e| CloudError::ProviderError(e.to_string()))?;
        let scan_status = resp.image_scan_status().and_then(|s| s.status()).map(|s| s.as_str().to_owned()).unwrap_or_else(|| "UNKNOWN".to_owned());
        let finding_counts = resp.image_scan_findings()
            .and_then(|f| f.finding_severity_counts())
            .map(|counts| serde_json::json!({
                "CRITICAL": counts.get(&aws_sdk_ecr::types::FindingSeverity::Critical).copied().unwrap_or(0),
                "HIGH": counts.get(&aws_sdk_ecr::types::FindingSeverity::High).copied().unwrap_or(0),
                "MEDIUM": counts.get(&aws_sdk_ecr::types::FindingSeverity::Medium).copied().unwrap_or(0),
                "LOW": counts.get(&aws_sdk_ecr::types::FindingSeverity::Low).copied().unwrap_or(0),
            }))
            .unwrap_or_else(|| serde_json::json!({}));
        Ok(serde_json::json!({"repository": registry, "image_tag": image_tag, "scan_status": scan_status, "severity_counts": finding_counts}))
    }

    async fn start_image_scan(&self, region: &str, registry: &str, image_tag: &str) -> Result<()> {
        let region = self.resolve_region(region);
        let ecr = self.ecr_client(region)?;
        let image_id = aws_sdk_ecr::types::ImageIdentifier::builder().image_tag(image_tag).build();
        ecr.start_image_scan().repository_name(registry).image_id(image_id).send().await.map_err(|e| CloudError::ProviderError(e.to_string()))?;
        Ok(())
    }
}

#[async_trait]
impl WorkflowProvider for AwsSdkProvider {
    async fn list_state_machines(&self, region: &str) -> Result<Vec<CloudResource>> {
        let region = self.resolve_region(region);
        let sfn = self.sfn_client(region)?;
        let resp = sfn.list_state_machines().send().await.map_err(|e| CloudError::ProviderError(e.to_string()))?;
        Ok(resp.state_machines().iter().map(|sm| CloudResource {
            id: uuid::Uuid::new_v4(), cloud_id: Some(sm.state_machine_arn().to_owned()), provider: CloudProvider::Aws, resource_type: ResourceType::StateMachine,
            name: sm.name().to_owned(), region: region.to_owned(), status: ResourceStatus::Available,
            metadata: serde_json::json!({"arn": sm.state_machine_arn(), "type": format!("{:?}", sm.r#type())}),
            tags: std::collections::HashMap::new(), created_at: chrono::Utc::now(), updated_at: chrono::Utc::now(),
        }).collect())
    }

    async fn get_state_machine(&self, region: &str, arn: &str) -> Result<CloudResource> {
        let region = self.resolve_region(region);
        let sfn = self.sfn_client(region)?;
        let resp = sfn.describe_state_machine().state_machine_arn(arn).send().await.map_err(|e| CloudError::ProviderError(e.to_string()))?;
        let status = match resp.status() { Some(s) if s.as_str() == "ACTIVE" => ResourceStatus::Running, Some(s) if s.as_str() == "DELETING" => ResourceStatus::Deleting, _ => ResourceStatus::Available };
        Ok(CloudResource {
            id: uuid::Uuid::new_v4(), cloud_id: Some(resp.state_machine_arn().to_owned()), provider: CloudProvider::Aws, resource_type: ResourceType::StateMachine,
            name: resp.name().to_owned(), region: region.to_owned(), status,
            metadata: serde_json::json!({"arn": resp.state_machine_arn(), "definition": resp.definition(), "role_arn": resp.role_arn(), "type": format!("{:?}", resp.r#type())}),
            tags: std::collections::HashMap::new(), created_at: chrono::Utc::now(), updated_at: chrono::Utc::now(),
        })
    }

    async fn start_execution(&self, region: &str, arn: &str, input: serde_json::Value) -> Result<CloudResource> {
        let region = self.resolve_region(region);
        let sfn = self.sfn_client(region)?;
        let input_str = serde_json::to_string(&input).map_err(|e| CloudError::BadRequest(e.to_string()))?;
        let resp = sfn.start_execution().state_machine_arn(arn).input(input_str).send().await.map_err(|e| CloudError::ProviderError(e.to_string()))?;
        Ok(CloudResource {
            id: uuid::Uuid::new_v4(), cloud_id: Some(resp.execution_arn().to_owned()), provider: CloudProvider::Aws, resource_type: ResourceType::WorkflowExecution,
            name: resp.execution_arn().to_owned(), region: region.to_owned(), status: ResourceStatus::Running,
            metadata: serde_json::json!({"execution_arn": resp.execution_arn(), "state_machine_arn": arn, "start_date": resp.start_date().to_string()}),
            tags: std::collections::HashMap::new(), created_at: chrono::Utc::now(), updated_at: chrono::Utc::now(),
        })
    }

    async fn list_executions(&self, region: &str, arn: &str) -> Result<Vec<CloudResource>> {
        let region = self.resolve_region(region);
        let sfn = self.sfn_client(region)?;
        let resp = sfn.list_executions().state_machine_arn(arn).send().await.map_err(|e| CloudError::ProviderError(e.to_string()))?;
        Ok(resp.executions().iter().map(|ex| {
            let status = match ex.status().as_str() { "RUNNING" => ResourceStatus::Running, "SUCCEEDED" => ResourceStatus::Available, "FAILED" | "TIMED_OUT" | "ABORTED" => ResourceStatus::Error, _ => ResourceStatus::Pending };
            CloudResource {
                id: uuid::Uuid::new_v4(), cloud_id: Some(ex.execution_arn().to_owned()), provider: CloudProvider::Aws, resource_type: ResourceType::WorkflowExecution,
                name: ex.name().to_owned(), region: region.to_owned(), status,
                metadata: serde_json::json!({"execution_arn": ex.execution_arn(), "state_machine_arn": ex.state_machine_arn(), "status": ex.status().as_str(), "start_date": ex.start_date().to_string()}),
                tags: std::collections::HashMap::new(), created_at: chrono::Utc::now(), updated_at: chrono::Utc::now(),
            }
        }).collect())
    }
}

// ===== NoSQL (DynamoDB) =====

impl AwsSdkProvider {
    fn dynamodb_client(&self, region: &str) -> Result<aws_sdk_dynamodb::Client> {
        let cfg = self.credentials.aws_config_for_region(region)
            .map_err(|e| CloudError::ProviderError(e.to_string()))?;
        Ok(aws_sdk_dynamodb::Client::new(&cfg))
    }

    fn elasticache_client(&self, region: &str) -> Result<aws_sdk_elasticache::Client> {
        let cfg = self.credentials.aws_config_for_region(region)
            .map_err(|e| CloudError::ProviderError(e.to_string()))?;
        Ok(aws_sdk_elasticache::Client::new(&cfg))
    }

    fn iam_client(&self, region: &str) -> Result<aws_sdk_iam::Client> {
        let cfg = self.credentials.aws_config_for_region(region)
            .map_err(|e| CloudError::ProviderError(e.to_string()))?;
        Ok(aws_sdk_iam::Client::new(&cfg))
    }

    fn route53_client(&self, region: &str) -> Result<aws_sdk_route53::Client> {
        let cfg = self.credentials.aws_config_for_region(region)
            .map_err(|e| CloudError::ProviderError(e.to_string()))?;
        Ok(aws_sdk_route53::Client::new(&cfg))
    }

    fn wafv2_client(&self, region: &str) -> Result<aws_sdk_wafv2::Client> {
        let cfg = self.credentials.aws_config_for_region(region)
            .map_err(|e| CloudError::ProviderError(e.to_string()))?;
        Ok(aws_sdk_wafv2::Client::new(&cfg))
    }

    fn sqs_client(&self, region: &str) -> Result<aws_sdk_sqs::Client> {
        let cfg = self.credentials.aws_config_for_region(region)
            .map_err(|e| CloudError::ProviderError(e.to_string()))?;
        Ok(aws_sdk_sqs::Client::new(&cfg))
    }

    fn sns_client(&self, region: &str) -> Result<aws_sdk_sns::Client> {
        let cfg = self.credentials.aws_config_for_region(region)
            .map_err(|e| CloudError::ProviderError(e.to_string()))?;
        Ok(aws_sdk_sns::Client::new(&cfg))
    }

    fn kms_real_client(&self, region: &str) -> Result<aws_sdk_kms::Client> {
        let cfg = self.credentials.aws_config_for_region(region)
            .map_err(|e| CloudError::ProviderError(e.to_string()))?;
        Ok(aws_sdk_kms::Client::new(&cfg))
    }

    fn autoscaling_client(&self, region: &str) -> Result<aws_sdk_autoscaling::Client> {
        let cfg = self.credentials.aws_config_for_region(region)
            .map_err(|e| CloudError::ProviderError(e.to_string()))?;
        Ok(aws_sdk_autoscaling::Client::new(&cfg))
    }

    fn iot_client(&self, region: &str) -> Result<aws_sdk_iot::Client> {
        let cfg = self.credentials.aws_config_for_region(region)
            .map_err(|e| CloudError::ProviderError(e.to_string()))?;
        Ok(aws_sdk_iot::Client::new(&cfg))
    }

    fn sagemaker_client(&self, region: &str) -> Result<aws_sdk_sagemaker::Client> {
        let cfg = self.credentials.aws_config_for_region(region)
            .map_err(|e| CloudError::ProviderError(e.to_string()))?;
        Ok(aws_sdk_sagemaker::Client::new(&cfg))
    }
}

#[async_trait]
impl NoSqlProvider for AwsSdkProvider {
    async fn list_tables(&self, region: &str) -> Result<Vec<CloudResource>> {
        let region = self.resolve_region(region);
        tracing::info!(provider = "aws", region = region, "Listing DynamoDB tables via SDK");

        let client = self.dynamodb_client(region)?;
        let resp = client.list_tables().send().await
            .map_err(|e| CloudError::ProviderError(format!("DynamoDB list_tables: {}", e)))?;

        let mut resources = Vec::new();
        for table_name in resp.table_names() {
            if let Ok(desc_resp) = client.describe_table().table_name(table_name).send().await {
                if let Some(table) = desc_resp.table() {
                    let status = match table.table_status() {
                        Some(s) => match s.as_str() {
                            "ACTIVE" => ResourceStatus::Available,
                            "CREATING" => ResourceStatus::Creating,
                            "DELETING" => ResourceStatus::Deleting,
                            "UPDATING" => ResourceStatus::Updating,
                            _ => ResourceStatus::Pending,
                        },
                        None => ResourceStatus::Pending,
                    };

                    let now = chrono::Utc::now();
                    resources.push(CloudResource {
                        id: uuid::Uuid::new_v4(),
                        cloud_id: table.table_arn().map(|s| s.to_owned()),
                        provider: CloudProvider::Aws,
                        resource_type: ResourceType::NoSqlTable,
                        name: table_name.to_string(),
                        region: region.to_string(),
                        status,
                        metadata: serde_json::json!({
                            "item_count": table.item_count(),
                            "table_size_bytes": table.table_size_bytes(),
                            "billing_mode": table.billing_mode_summary()
                                .and_then(|b| b.billing_mode())
                                .map(|m| m.as_str().to_owned())
                                .unwrap_or_else(|| "PROVISIONED".to_string()),
                        }),
                        tags: Default::default(),
                        created_at: now,
                        updated_at: now,
                    });
                }
            }
        }

        Ok(resources)
    }

    async fn get_table(&self, region: &str, name: &str) -> Result<CloudResource> {
        let region = self.resolve_region(region);
        let client = self.dynamodb_client(region)?;

        let resp = client.describe_table().table_name(name).send().await
            .map_err(|e| CloudError::ProviderError(format!("DynamoDB describe_table: {}", e)))?;

        let table = resp.table()
            .ok_or_else(|| CloudError::NotFound(format!("DynamoDB table {} not found", name)))?;

        let status = match table.table_status() {
            Some(s) => match s.as_str() {
                "ACTIVE" => ResourceStatus::Available,
                "CREATING" => ResourceStatus::Creating,
                "DELETING" => ResourceStatus::Deleting,
                "UPDATING" => ResourceStatus::Updating,
                _ => ResourceStatus::Pending,
            },
            None => ResourceStatus::Pending,
        };

        let now = chrono::Utc::now();
        Ok(CloudResource {
            id: uuid::Uuid::new_v4(),
            cloud_id: table.table_arn().map(|s| s.to_owned()),
            provider: CloudProvider::Aws,
            resource_type: ResourceType::NoSqlTable,
            name: name.to_string(),
            region: region.to_string(),
            status,
            metadata: serde_json::json!({
                "item_count": table.item_count(),
                "table_size_bytes": table.table_size_bytes(),
            }),
            tags: Default::default(),
            created_at: now,
            updated_at: now,
        })
    }

    async fn create_table(
        &self,
        region: &str,
        name: &str,
        key_schema: serde_json::Value,
    ) -> Result<CloudResource> {
        let region = self.resolve_region(region);
        tracing::info!(provider = "aws", region = region, name = name, "Creating DynamoDB table via SDK");

        let client = self.dynamodb_client(region)?;

        let hash_key_name = key_schema
            .get("hash_key").and_then(|h| h.get("name")).and_then(|n| n.as_str())
            .unwrap_or("pk");
        let hash_key_type = key_schema
            .get("hash_key").and_then(|h| h.get("type")).and_then(|t| t.as_str())
            .unwrap_or("S");

        let hk_scalar = match hash_key_type {
            "N" => aws_sdk_dynamodb::types::ScalarAttributeType::N,
            "B" => aws_sdk_dynamodb::types::ScalarAttributeType::B,
            _ => aws_sdk_dynamodb::types::ScalarAttributeType::S,
        };

        let mut builder = client
            .create_table()
            .table_name(name)
            .key_schema(
                aws_sdk_dynamodb::types::KeySchemaElement::builder()
                    .attribute_name(hash_key_name)
                    .key_type(aws_sdk_dynamodb::types::KeyType::Hash)
                    .build()
                    .map_err(|e| CloudError::ProviderError(format!("KeySchema build: {}", e)))?,
            )
            .attribute_definitions(
                aws_sdk_dynamodb::types::AttributeDefinition::builder()
                    .attribute_name(hash_key_name)
                    .attribute_type(hk_scalar)
                    .build()
                    .map_err(|e| CloudError::ProviderError(format!("AttrDef build: {}", e)))?,
            )
            .billing_mode(aws_sdk_dynamodb::types::BillingMode::PayPerRequest);

        if let Some(range_key) = key_schema.get("range_key") {
            let rk_name = range_key.get("name").and_then(|n| n.as_str()).unwrap_or("sk");
            let rk_type = range_key.get("type").and_then(|t| t.as_str()).unwrap_or("S");
            let rk_scalar = match rk_type {
                "N" => aws_sdk_dynamodb::types::ScalarAttributeType::N,
                "B" => aws_sdk_dynamodb::types::ScalarAttributeType::B,
                _ => aws_sdk_dynamodb::types::ScalarAttributeType::S,
            };

            builder = builder
                .key_schema(
                    aws_sdk_dynamodb::types::KeySchemaElement::builder()
                        .attribute_name(rk_name)
                        .key_type(aws_sdk_dynamodb::types::KeyType::Range)
                        .build()
                        .map_err(|e| CloudError::ProviderError(format!("KeySchema build: {}", e)))?,
                )
                .attribute_definitions(
                    aws_sdk_dynamodb::types::AttributeDefinition::builder()
                        .attribute_name(rk_name)
                        .attribute_type(rk_scalar)
                        .build()
                        .map_err(|e| CloudError::ProviderError(format!("AttrDef build: {}", e)))?,
                );
        }

        let resp = builder.send().await
            .map_err(|e| CloudError::ProviderError(format!("DynamoDB create_table: {}", e)))?;

        let table_desc = resp.table_description()
            .ok_or_else(|| CloudError::ProviderError("No table description in response".to_string()))?;

        let now = chrono::Utc::now();
        Ok(CloudResource {
            id: uuid::Uuid::new_v4(),
            cloud_id: table_desc.table_arn().map(|s| s.to_owned()),
            provider: CloudProvider::Aws,
            resource_type: ResourceType::NoSqlTable,
            name: name.to_string(),
            region: region.to_string(),
            status: ResourceStatus::Creating,
            metadata: serde_json::json!({
                "key_schema": key_schema,
                "table_status": "CREATING",
                "billing_mode": "PAY_PER_REQUEST",
            }),
            tags: Default::default(),
            created_at: now,
            updated_at: now,
        })
    }

    async fn delete_table(&self, region: &str, name: &str) -> Result<()> {
        let region = self.resolve_region(region);
        tracing::info!(provider = "aws", region = region, name = name, "Deleting DynamoDB table via SDK");

        let client = self.dynamodb_client(region)?;
        client.delete_table().table_name(name).send().await
            .map_err(|e| CloudError::ProviderError(format!("DynamoDB delete_table: {}", e)))?;

        Ok(())
    }

    async fn describe_table(&self, region: &str, name: &str) -> Result<serde_json::Value> {
        let region = self.resolve_region(region);
        let client = self.dynamodb_client(region)?;

        let resp = client.describe_table().table_name(name).send().await
            .map_err(|e| CloudError::ProviderError(format!("DynamoDB describe_table: {}", e)))?;

        let table = resp.table()
            .ok_or_else(|| CloudError::NotFound(format!("DynamoDB table {} not found", name)))?;

        Ok(serde_json::json!({
            "table_name": table.table_name(),
            "table_status": table.table_status().map(|s| s.as_str()),
            "table_arn": table.table_arn(),
            "item_count": table.item_count(),
            "table_size_bytes": table.table_size_bytes(),
            "creation_date_time": table.creation_date_time().map(|d| d.to_string()),
            "billing_mode": table.billing_mode_summary()
                .and_then(|b| b.billing_mode())
                .map(|m| m.as_str()),
        }))
    }
}

// ===== Cache (ElastiCache) =====

#[async_trait]
impl CacheDbProvider for AwsSdkProvider {
    async fn list_clusters(&self, region: &str) -> Result<Vec<CloudResource>> {
        let region = self.resolve_region(region);
        tracing::info!(provider = "aws", region = region, "Listing ElastiCache clusters via SDK");

        let client = self.elasticache_client(region)?;
        let resp = client.describe_cache_clusters().send().await
            .map_err(|e| CloudError::ProviderError(format!("ElastiCache describe_cache_clusters: {}", e)))?;

        let mut resources = Vec::new();
        for cluster in resp.cache_clusters() {
            let status = match cluster.cache_cluster_status() {
                Some("available") => ResourceStatus::Available,
                Some("creating") => ResourceStatus::Creating,
                Some("deleting") => ResourceStatus::Deleting,
                Some("modifying") => ResourceStatus::Updating,
                _ => ResourceStatus::Pending,
            };

            let now = chrono::Utc::now();
            resources.push(CloudResource {
                id: uuid::Uuid::new_v4(),
                cloud_id: cluster.cache_cluster_id().map(|s| s.to_owned()),
                provider: CloudProvider::Aws,
                resource_type: ResourceType::CacheCluster,
                name: cluster.cache_cluster_id().unwrap_or_default().to_string(),
                region: region.to_string(),
                status,
                metadata: serde_json::json!({
                    "engine": cluster.engine(),
                    "engine_version": cluster.engine_version(),
                    "cache_node_type": cluster.cache_node_type(),
                    "num_cache_nodes": cluster.num_cache_nodes(),
                }),
                tags: Default::default(),
                created_at: now,
                updated_at: now,
            });
        }

        Ok(resources)
    }

    async fn get_cluster(&self, region: &str, id: &str) -> Result<CloudResource> {
        let region = self.resolve_region(region);
        let client = self.elasticache_client(region)?;

        let resp = client
            .describe_cache_clusters()
            .cache_cluster_id(id)
            .send()
            .await
            .map_err(|e| CloudError::ProviderError(format!("ElastiCache describe: {}", e)))?;

        let cluster = resp.cache_clusters().first()
            .ok_or_else(|| CloudError::NotFound(format!("ElastiCache cluster {} not found", id)))?;

        let status = match cluster.cache_cluster_status() {
            Some("available") => ResourceStatus::Available,
            Some("creating") => ResourceStatus::Creating,
            _ => ResourceStatus::Pending,
        };

        let now = chrono::Utc::now();
        Ok(CloudResource {
            id: uuid::Uuid::new_v4(),
            cloud_id: cluster.cache_cluster_id().map(|s| s.to_owned()),
            provider: CloudProvider::Aws,
            resource_type: ResourceType::CacheCluster,
            name: cluster.cache_cluster_id().unwrap_or_default().to_string(),
            region: region.to_string(),
            status,
            metadata: serde_json::json!({
                "engine": cluster.engine(),
                "engine_version": cluster.engine_version(),
                "cache_node_type": cluster.cache_node_type(),
                "num_cache_nodes": cluster.num_cache_nodes(),
            }),
            tags: Default::default(),
            created_at: now,
            updated_at: now,
        })
    }

    async fn create_cluster(
        &self,
        region: &str,
        name: &str,
        engine: &str,
        node_type: &str,
    ) -> Result<CloudResource> {
        let region = self.resolve_region(region);
        tracing::info!(provider = "aws", region = region, name = name, "Creating ElastiCache cluster via SDK");

        let client = self.elasticache_client(region)?;
        let resp = client
            .create_cache_cluster()
            .cache_cluster_id(name)
            .engine(engine)
            .cache_node_type(node_type)
            .num_cache_nodes(1)
            .send()
            .await
            .map_err(|e| CloudError::ProviderError(format!("ElastiCache create: {}", e)))?;

        let cluster = resp.cache_cluster()
            .ok_or_else(|| CloudError::ProviderError("No cluster in response".to_string()))?;

        let now = chrono::Utc::now();
        Ok(CloudResource {
            id: uuid::Uuid::new_v4(),
            cloud_id: cluster.cache_cluster_id().map(|s| s.to_owned()),
            provider: CloudProvider::Aws,
            resource_type: ResourceType::CacheCluster,
            name: name.to_string(),
            region: region.to_string(),
            status: ResourceStatus::Creating,
            metadata: serde_json::json!({
                "engine": engine,
                "cache_node_type": node_type,
                "num_cache_nodes": 1,
            }),
            tags: Default::default(),
            created_at: now,
            updated_at: now,
        })
    }

    async fn delete_cluster(&self, region: &str, id: &str) -> Result<()> {
        let region = self.resolve_region(region);
        tracing::info!(provider = "aws", region = region, id = id, "Deleting ElastiCache cluster via SDK");

        let client = self.elasticache_client(region)?;
        client
            .delete_cache_cluster()
            .cache_cluster_id(id)
            .send()
            .await
            .map_err(|e| CloudError::ProviderError(format!("ElastiCache delete: {}", e)))?;

        Ok(())
    }
}

// ===========================================================================
// IAM — AWS IAM SDK
// ===========================================================================

#[async_trait]
impl IamProvider for AwsSdkProvider {
    async fn list_users(&self, region: &str) -> Result<Vec<CloudResource>> {
        let region = self.resolve_region(region);
        tracing::info!(provider = "aws", region = region, "Listing IAM users via SDK");

        let client = self.iam_client(region)?;
        let resp = client
            .list_users()
            .send()
            .await
            .map_err(|e| CloudError::ProviderError(format!("IAM list_users: {}", e)))?;

        let now = chrono::Utc::now();
        let users = resp
            .users()
            .iter()
            .map(|u| CloudResource {
                id: uuid::Uuid::new_v4(),
                cloud_id: Some(u.user_id().to_owned()),
                provider: CloudProvider::Aws,
                resource_type: ResourceType::IamUser,
                name: u.user_name().to_owned(),
                region: "global".to_owned(),
                status: ResourceStatus::Running,
                metadata: serde_json::json!({
                    "arn": u.arn(),
                    "path": u.path(),
                }),
                tags: Default::default(),
                created_at: now,
                updated_at: now,
            })
            .collect();
        Ok(users)
    }

    async fn create_user(&self, region: &str, username: &str) -> Result<CloudResource> {
        let region = self.resolve_region(region);
        tracing::info!(provider = "aws", region = region, username = username, "Creating IAM user via SDK");

        let client = self.iam_client(region)?;
        let resp = client
            .create_user()
            .user_name(username)
            .send()
            .await
            .map_err(|e| CloudError::ProviderError(format!("IAM create_user: {}", e)))?;

        let now = chrono::Utc::now();
        let user = resp.user().ok_or_else(|| CloudError::ProviderError("No user in response".into()))?;
        Ok(CloudResource {
            id: uuid::Uuid::new_v4(),
            cloud_id: Some(user.user_id().to_owned()),
            provider: CloudProvider::Aws,
            resource_type: ResourceType::IamUser,
            name: user.user_name().to_owned(),
            region: "global".to_owned(),
            status: ResourceStatus::Running,
            metadata: serde_json::json!({ "arn": user.arn(), "path": user.path() }),
            tags: Default::default(),
            created_at: now,
            updated_at: now,
        })
    }

    async fn delete_user(&self, region: &str, username: &str) -> Result<()> {
        let region = self.resolve_region(region);
        tracing::info!(provider = "aws", region = region, username = username, "Deleting IAM user via SDK");

        let client = self.iam_client(region)?;
        client.delete_user().user_name(username).send().await
            .map_err(|e| CloudError::ProviderError(format!("IAM delete_user: {}", e)))?;
        Ok(())
    }

    async fn list_roles(&self, region: &str) -> Result<Vec<CloudResource>> {
        let region = self.resolve_region(region);
        tracing::info!(provider = "aws", region = region, "Listing IAM roles via SDK");

        let client = self.iam_client(region)?;
        let resp = client.list_roles().send().await
            .map_err(|e| CloudError::ProviderError(format!("IAM list_roles: {}", e)))?;

        let now = chrono::Utc::now();
        let roles = resp.roles().iter().map(|r| CloudResource {
            id: uuid::Uuid::new_v4(),
            cloud_id: Some(r.role_id().to_owned()),
            provider: CloudProvider::Aws,
            resource_type: ResourceType::IamRole,
            name: r.role_name().to_owned(),
            region: "global".to_owned(),
            status: ResourceStatus::Running,
            metadata: serde_json::json!({
                "arn": r.arn(),
                "path": r.path(),
                "description": r.description().unwrap_or_default(),
            }),
            tags: Default::default(),
            created_at: now,
            updated_at: now,
        }).collect();
        Ok(roles)
    }

    async fn create_role(&self, region: &str, name: &str, trust_policy: &str) -> Result<CloudResource> {
        let region = self.resolve_region(region);
        tracing::info!(provider = "aws", region = region, name = name, "Creating IAM role via SDK");

        let client = self.iam_client(region)?;
        let resp = client.create_role().role_name(name).assume_role_policy_document(trust_policy)
            .send().await
            .map_err(|e| CloudError::ProviderError(format!("IAM create_role: {}", e)))?;

        let now = chrono::Utc::now();
        let role = resp.role().ok_or_else(|| CloudError::ProviderError("No role in response".into()))?;
        Ok(CloudResource {
            id: uuid::Uuid::new_v4(),
            cloud_id: Some(role.role_id().to_owned()),
            provider: CloudProvider::Aws,
            resource_type: ResourceType::IamRole,
            name: role.role_name().to_owned(),
            region: "global".to_owned(),
            status: ResourceStatus::Running,
            metadata: serde_json::json!({ "arn": role.arn(), "path": role.path() }),
            tags: Default::default(),
            created_at: now,
            updated_at: now,
        })
    }

    async fn delete_role(&self, region: &str, name: &str) -> Result<()> {
        let region = self.resolve_region(region);
        tracing::info!(provider = "aws", region = region, name = name, "Deleting IAM role via SDK");
        let client = self.iam_client(region)?;
        client.delete_role().role_name(name).send().await
            .map_err(|e| CloudError::ProviderError(format!("IAM delete_role: {}", e)))?;
        Ok(())
    }

    async fn list_policies(&self, region: &str) -> Result<Vec<CloudResource>> {
        let region = self.resolve_region(region);
        tracing::info!(provider = "aws", region = region, "Listing IAM policies via SDK");

        let client = self.iam_client(region)?;
        let resp = client.list_policies().scope(aws_sdk_iam::types::PolicyScopeType::Local)
            .send().await
            .map_err(|e| CloudError::ProviderError(format!("IAM list_policies: {}", e)))?;

        let now = chrono::Utc::now();
        let policies = resp.policies().iter().map(|p| CloudResource {
            id: uuid::Uuid::new_v4(),
            cloud_id: p.policy_id().map(|s| s.to_owned()),
            provider: CloudProvider::Aws,
            resource_type: ResourceType::IamPolicy,
            name: p.policy_name().unwrap_or_default().to_owned(),
            region: "global".to_owned(),
            status: ResourceStatus::Running,
            metadata: serde_json::json!({
                "arn": p.arn().unwrap_or_default(),
                "description": p.description().unwrap_or_default(),
                "attachment_count": p.attachment_count(),
            }),
            tags: Default::default(),
            created_at: now,
            updated_at: now,
        }).collect();
        Ok(policies)
    }

    async fn attach_policy(&self, region: &str, target: &str, policy_arn: &str) -> Result<()> {
        let region = self.resolve_region(region);
        tracing::info!(provider = "aws", region = region, target = target, policy_arn = policy_arn, "Attaching IAM policy via SDK");
        let client = self.iam_client(region)?;
        client.attach_role_policy().role_name(target).policy_arn(policy_arn).send().await
            .map_err(|e| CloudError::ProviderError(format!("IAM attach_role_policy: {}", e)))?;
        Ok(())
    }

    async fn detach_policy(&self, region: &str, target: &str, policy_arn: &str) -> Result<()> {
        let region = self.resolve_region(region);
        tracing::info!(provider = "aws", region = region, target = target, policy_arn = policy_arn, "Detaching IAM policy via SDK");
        let client = self.iam_client(region)?;
        client.detach_role_policy().role_name(target).policy_arn(policy_arn).send().await
            .map_err(|e| CloudError::ProviderError(format!("IAM detach_role_policy: {}", e)))?;
        Ok(())
    }
}

// ===========================================================================
// DNS — AWS Route 53 SDK
// ===========================================================================

#[async_trait]
impl DnsProvider for AwsSdkProvider {
    async fn list_hosted_zones(&self, region: &str) -> Result<Vec<CloudResource>> {
        let region = self.resolve_region(region);
        tracing::info!(provider = "aws", region = region, "Listing Route53 hosted zones via SDK");

        let client = self.route53_client(region)?;
        let resp = client.list_hosted_zones().send().await
            .map_err(|e| CloudError::ProviderError(format!("Route53 list_hosted_zones: {}", e)))?;

        let now = chrono::Utc::now();
        let zones = resp.hosted_zones().iter().map(|z| {
            let zone_id = z.id().trim_start_matches("/hostedzone/").to_owned();
            CloudResource {
                id: uuid::Uuid::new_v4(),
                cloud_id: Some(zone_id),
                provider: CloudProvider::Aws,
                resource_type: ResourceType::DnsZone,
                name: z.name().to_owned(),
                region: "global".to_owned(),
                status: ResourceStatus::Running,
                metadata: serde_json::json!({
                    "record_count": z.resource_record_set_count(),
                    "private": z.config().map(|c| c.private_zone()).unwrap_or(false),
                    "comment": z.config().and_then(|c| c.comment()).unwrap_or_default(),
                }),
                tags: Default::default(),
                created_at: now,
                updated_at: now,
            }
        }).collect();
        Ok(zones)
    }

    async fn list_records(&self, region: &str, zone_id: &str) -> Result<Vec<CloudResource>> {
        let region = self.resolve_region(region);
        tracing::info!(provider = "aws", region = region, zone_id = zone_id, "Listing Route53 records via SDK");

        let client = self.route53_client(region)?;
        let resp = client.list_resource_record_sets().hosted_zone_id(zone_id).send().await
            .map_err(|e| CloudError::ProviderError(format!("Route53 list_records: {}", e)))?;

        let now = chrono::Utc::now();
        let records = resp.resource_record_sets().iter().map(|r| {
            let values: Vec<String> = r.resource_records().iter().map(|rr| rr.value().to_owned()).collect();
            let rtype = r.r#type().as_str();
            CloudResource {
                id: uuid::Uuid::new_v4(),
                cloud_id: Some(format!("{}:{}", r.name(), rtype)),
                provider: CloudProvider::Aws,
                resource_type: ResourceType::DnsRecord,
                name: r.name().to_owned(),
                region: "global".to_owned(),
                status: ResourceStatus::Running,
                metadata: serde_json::json!({
                    "record_type": rtype,
                    "ttl": r.ttl(),
                    "values": values,
                }),
                tags: Default::default(),
                created_at: now,
                updated_at: now,
            }
        }).collect();
        Ok(records)
    }

    async fn create_record(&self, region: &str, zone_id: &str, record: DnsRecordInput) -> Result<CloudResource> {
        let region = self.resolve_region(region);
        tracing::info!(provider = "aws", region = region, zone_id = zone_id, name = record.name, "Creating Route53 record via SDK");

        let client = self.route53_client(region)?;
        let rr_type = record.record_type.parse::<aws_sdk_route53::types::RrType>()
            .map_err(|_| CloudError::BadRequest(format!("Invalid record type: {}", record.record_type)))?;

        let resource_records: Vec<aws_sdk_route53::types::ResourceRecord> = record.values.iter()
            .map(|v| aws_sdk_route53::types::ResourceRecord::builder().value(v).build().unwrap())
            .collect();

        let rrs = aws_sdk_route53::types::ResourceRecordSet::builder()
            .name(&record.name).r#type(rr_type).ttl(record.ttl as i64)
            .set_resource_records(Some(resource_records))
            .build().map_err(|e| CloudError::ProviderError(format!("Route53 build record set: {}", e)))?;

        let change = aws_sdk_route53::types::Change::builder()
            .action(aws_sdk_route53::types::ChangeAction::Upsert).resource_record_set(rrs)
            .build().map_err(|e| CloudError::ProviderError(format!("Route53 build change: {}", e)))?;

        let batch = aws_sdk_route53::types::ChangeBatch::builder().changes(change)
            .build().map_err(|e| CloudError::ProviderError(format!("Route53 build batch: {}", e)))?;

        client.change_resource_record_sets().hosted_zone_id(zone_id).change_batch(batch)
            .send().await
            .map_err(|e| CloudError::ProviderError(format!("Route53 create_record: {}", e)))?;

        let now = chrono::Utc::now();
        Ok(CloudResource {
            id: uuid::Uuid::new_v4(),
            cloud_id: Some(format!("{}:{}", record.name, record.record_type)),
            provider: CloudProvider::Aws,
            resource_type: ResourceType::DnsRecord,
            name: record.name,
            region: "global".to_owned(),
            status: ResourceStatus::Running,
            metadata: serde_json::json!({ "record_type": record.record_type, "ttl": record.ttl, "values": record.values }),
            tags: Default::default(),
            created_at: now,
            updated_at: now,
        })
    }

    async fn delete_record(&self, region: &str, zone_id: &str, record: DnsRecordInput) -> Result<()> {
        let region = self.resolve_region(region);
        tracing::info!(provider = "aws", region = region, zone_id = zone_id, name = record.name, "Deleting Route53 record via SDK");

        let client = self.route53_client(region)?;
        let rr_type = record.record_type.parse::<aws_sdk_route53::types::RrType>()
            .map_err(|_| CloudError::BadRequest(format!("Invalid record type: {}", record.record_type)))?;
        let resource_records: Vec<aws_sdk_route53::types::ResourceRecord> = record.values.iter()
            .map(|v| aws_sdk_route53::types::ResourceRecord::builder().value(v).build().unwrap())
            .collect();
        let rrs = aws_sdk_route53::types::ResourceRecordSet::builder()
            .name(&record.name).r#type(rr_type).ttl(record.ttl as i64)
            .set_resource_records(Some(resource_records))
            .build().map_err(|e| CloudError::ProviderError(format!("Route53 build: {}", e)))?;
        let change = aws_sdk_route53::types::Change::builder()
            .action(aws_sdk_route53::types::ChangeAction::Delete).resource_record_set(rrs)
            .build().map_err(|e| CloudError::ProviderError(format!("Route53 change: {}", e)))?;
        let batch = aws_sdk_route53::types::ChangeBatch::builder().changes(change)
            .build().map_err(|e| CloudError::ProviderError(format!("Route53 batch: {}", e)))?;
        client.change_resource_record_sets().hosted_zone_id(zone_id).change_batch(batch)
            .send().await
            .map_err(|e| CloudError::ProviderError(format!("Route53 delete_record: {}", e)))?;
        Ok(())
    }
}

// ===========================================================================
// WAF — AWS WAFv2 SDK
// ===========================================================================

#[async_trait]
impl WafProvider for AwsSdkProvider {
    async fn list_web_acls(&self, region: &str) -> Result<Vec<CloudResource>> {
        let region = self.resolve_region(region);
        tracing::info!(provider = "aws", region = region, "Listing WAFv2 web ACLs via SDK");

        let client = self.wafv2_client(region)?;
        let resp = client.list_web_acls().scope(aws_sdk_wafv2::types::Scope::Regional)
            .send().await
            .map_err(|e| CloudError::ProviderError(format!("WAFv2 list_web_acls: {}", e)))?;

        let now = chrono::Utc::now();
        let acls = resp.web_acls().iter().map(|acl| CloudResource {
            id: uuid::Uuid::new_v4(),
            cloud_id: acl.id().map(|s| s.to_owned()),
            provider: CloudProvider::Aws,
            resource_type: ResourceType::WafRule,
            name: acl.name().unwrap_or_default().to_owned(),
            region: region.to_owned(),
            status: ResourceStatus::Running,
            metadata: serde_json::json!({
                "arn": acl.arn(),
                "lock_token": acl.lock_token(),
                "description": acl.description().unwrap_or_default(),
            }),
            tags: Default::default(),
            created_at: now,
            updated_at: now,
        }).collect();
        Ok(acls)
    }

    async fn get_web_acl(&self, region: &str, id: &str) -> Result<CloudResource> {
        let region = self.resolve_region(region);
        tracing::info!(provider = "aws", region = region, id = id, "Getting WAFv2 web ACL via SDK");

        let client = self.wafv2_client(region)?;
        let list_resp = client.list_web_acls().scope(aws_sdk_wafv2::types::Scope::Regional)
            .send().await
            .map_err(|e| CloudError::ProviderError(format!("WAFv2 list for get: {}", e)))?;

        let summary = list_resp.web_acls().iter().find(|a| a.id().unwrap_or_default() == id)
            .ok_or_else(|| CloudError::NotFound(format!("WAF ACL {} not found", id)))?;

        let acl_name = summary.name().unwrap_or_default().to_owned();
        let resp = client.get_web_acl()
            .name(&acl_name)
            .scope(aws_sdk_wafv2::types::Scope::Regional)
            .id(id)
            .send().await
            .map_err(|e| CloudError::ProviderError(format!("WAFv2 get_web_acl: {}", e)))?;

        let acl = resp.web_acl().ok_or_else(|| CloudError::NotFound(format!("WAF ACL {} not found", id)))?;
        let now = chrono::Utc::now();
        Ok(CloudResource {
            id: uuid::Uuid::new_v4(),
            cloud_id: Some(acl.id().to_owned()),
            provider: CloudProvider::Aws,
            resource_type: ResourceType::WafRule,
            name: acl.name().to_owned(),
            region: region.to_owned(),
            status: ResourceStatus::Running,
            metadata: serde_json::json!({
                "arn": acl.arn(),
                "capacity": acl.capacity(),
                "default_action": format!("{:?}", acl.default_action()),
                "rule_count": acl.rules().len(),
            }),
            tags: Default::default(),
            created_at: now,
            updated_at: now,
        })
    }

    async fn list_rules(&self, region: &str, acl_id: &str) -> Result<Vec<CloudResource>> {
        let region = self.resolve_region(region);
        tracing::info!(provider = "aws", region = region, acl_id = acl_id, "Listing WAFv2 rules via SDK");

        let client = self.wafv2_client(region)?;
        let list_resp = client.list_web_acls().scope(aws_sdk_wafv2::types::Scope::Regional)
            .send().await
            .map_err(|e| CloudError::ProviderError(format!("WAFv2 list for rules: {}", e)))?;

        let summary = list_resp.web_acls().iter().find(|a| a.id().unwrap_or_default() == acl_id)
            .ok_or_else(|| CloudError::NotFound(format!("WAF ACL {} not found", acl_id)))?;

        let acl_name = summary.name().unwrap_or_default().to_owned();
        let resp = client.get_web_acl()
            .name(&acl_name)
            .scope(aws_sdk_wafv2::types::Scope::Regional)
            .id(acl_id)
            .send().await
            .map_err(|e| CloudError::ProviderError(format!("WAFv2 get for rules: {}", e)))?;

        let acl = resp.web_acl().ok_or_else(|| CloudError::NotFound(format!("WAF ACL {} not found", acl_id)))?;
        let now = chrono::Utc::now();
        let rules = acl.rules().iter().map(|r| CloudResource {
            id: uuid::Uuid::new_v4(),
            cloud_id: Some(r.name().to_owned()),
            provider: CloudProvider::Aws,
            resource_type: ResourceType::WafRule,
            name: r.name().to_owned(),
            region: region.to_owned(),
            status: ResourceStatus::Running,
            metadata: serde_json::json!({ "priority": r.priority(), "action": format!("{:?}", r.action()) }),
            tags: Default::default(),
            created_at: now,
            updated_at: now,
        }).collect();
        Ok(rules)
    }

    async fn create_web_acl(&self, region: &str, name: &str) -> Result<CloudResource> {
        let region = self.resolve_region(region);
        tracing::info!(provider = "aws", region = region, name = name, "Creating WAFv2 web ACL via SDK");

        let client = self.wafv2_client(region)?;
        let default_action = aws_sdk_wafv2::types::DefaultAction::builder()
            .allow(aws_sdk_wafv2::types::AllowAction::builder().build())
            .build();
        let vis_cfg = aws_sdk_wafv2::types::VisibilityConfig::builder()
            .sampled_requests_enabled(true).cloud_watch_metrics_enabled(true).metric_name(name)
            .build().map_err(|e| CloudError::ProviderError(format!("WAFv2 vis config: {}", e)))?;

        let resp = client.create_web_acl().name(name)
            .scope(aws_sdk_wafv2::types::Scope::Regional)
            .default_action(default_action).visibility_config(vis_cfg)
            .send().await
            .map_err(|e| CloudError::ProviderError(format!("WAFv2 create_web_acl: {}", e)))?;

        let summary = resp.summary().ok_or_else(|| CloudError::ProviderError("No summary in response".into()))?;
        let now = chrono::Utc::now();
        Ok(CloudResource {
            id: uuid::Uuid::new_v4(),
            cloud_id: Some(summary.id().unwrap_or_default().to_owned()),
            provider: CloudProvider::Aws,
            resource_type: ResourceType::WafRule,
            name: summary.name().unwrap_or_default().to_owned(),
            region: region.to_owned(),
            status: ResourceStatus::Running,
            metadata: serde_json::json!({ "arn": summary.arn(), "lock_token": summary.lock_token() }),
            tags: Default::default(),
            created_at: now,
            updated_at: now,
        })
    }

    async fn delete_web_acl(&self, region: &str, id: &str) -> Result<()> {
        let region = self.resolve_region(region);
        tracing::info!(provider = "aws", region = region, id = id, "Deleting WAFv2 web ACL via SDK");

        let client = self.wafv2_client(region)?;
        let list_resp = client.list_web_acls().scope(aws_sdk_wafv2::types::Scope::Regional)
            .send().await
            .map_err(|e| CloudError::ProviderError(format!("WAFv2 list for delete: {}", e)))?;

        let summary = list_resp.web_acls().iter().find(|a| a.id().unwrap_or_default() == id)
            .ok_or_else(|| CloudError::NotFound(format!("WAF ACL {} not found", id)))?;

        let acl_name = summary.name().unwrap_or_default().to_owned();
        let lock = summary.lock_token().unwrap_or_default().to_owned();
        client.delete_web_acl()
            .name(&acl_name)
            .scope(aws_sdk_wafv2::types::Scope::Regional)
            .id(id)
            .lock_token(&lock)
            .send().await
            .map_err(|e| CloudError::ProviderError(format!("WAFv2 delete_web_acl: {}", e)))?;
        Ok(())
    }
}

// ===========================================================================
// Messaging — AWS SQS + SNS SDK
// ===========================================================================

#[async_trait]
impl MessagingProvider for AwsSdkProvider {
    async fn list_queues(&self, region: &str) -> Result<Vec<CloudResource>> {
        let region = self.resolve_region(region);
        tracing::info!(provider = "aws", region = region, "Listing SQS queues via SDK");

        let client = self.sqs_client(region)?;
        let resp = client.list_queues().send().await
            .map_err(|e| CloudError::ProviderError(format!("SQS list_queues: {}", e)))?;

        let now = chrono::Utc::now();
        let queues = resp.queue_urls().iter().map(|url| {
            let name = url.rsplit('/').next().unwrap_or(url).to_owned();
            CloudResource {
                id: uuid::Uuid::new_v4(),
                cloud_id: Some(url.clone()),
                provider: CloudProvider::Aws,
                resource_type: ResourceType::Queue,
                name,
                region: region.to_owned(),
                status: ResourceStatus::Running,
                metadata: serde_json::json!({ "queue_url": url }),
                tags: Default::default(),
                created_at: now,
                updated_at: now,
            }
        }).collect();
        Ok(queues)
    }

    async fn get_queue(&self, region: &str, id: &str) -> Result<CloudResource> {
        let region = self.resolve_region(region);
        tracing::info!(provider = "aws", region = region, id = id, "Getting SQS queue attributes via SDK");

        let client = self.sqs_client(region)?;
        let resp = client.get_queue_attributes().queue_url(id)
            .attribute_names(aws_sdk_sqs::types::QueueAttributeName::All)
            .send().await
            .map_err(|e| CloudError::ProviderError(format!("SQS get_queue_attributes: {}", e)))?;

        let empty_map = std::collections::HashMap::new();
        let attrs = resp.attributes().unwrap_or(&empty_map);
        let msg_count = attrs.get(&aws_sdk_sqs::types::QueueAttributeName::ApproximateNumberOfMessages)
            .cloned().unwrap_or_default();
        let vis_timeout = attrs.get(&aws_sdk_sqs::types::QueueAttributeName::VisibilityTimeout)
            .cloned().unwrap_or_default();
        let name = id.rsplit('/').next().unwrap_or(id).to_owned();
        let now = chrono::Utc::now();
        Ok(CloudResource {
            id: uuid::Uuid::new_v4(),
            cloud_id: Some(id.to_owned()),
            provider: CloudProvider::Aws,
            resource_type: ResourceType::Queue,
            name,
            region: region.to_owned(),
            status: ResourceStatus::Running,
            metadata: serde_json::json!({
                "queue_url": id,
                "approximate_message_count": msg_count,
                "visibility_timeout": vis_timeout,
            }),
            tags: Default::default(),
            created_at: now,
            updated_at: now,
        })
    }

    async fn create_queue(&self, region: &str, name: &str, fifo: bool) -> Result<CloudResource> {
        let region = self.resolve_region(region);
        tracing::info!(provider = "aws", region = region, name = name, fifo = fifo, "Creating SQS queue via SDK");

        let client = self.sqs_client(region)?;
        let queue_name = if fifo && !name.ends_with(".fifo") { format!("{}.fifo", name) } else { name.to_owned() };
        let mut req = client.create_queue().queue_name(&queue_name);
        if fifo {
            req = req.attributes(aws_sdk_sqs::types::QueueAttributeName::FifoQueue, "true");
        }
        let resp = req.send().await
            .map_err(|e| CloudError::ProviderError(format!("SQS create_queue: {}", e)))?;
        let url = resp.queue_url().unwrap_or_default().to_owned();
        let now = chrono::Utc::now();
        Ok(CloudResource {
            id: uuid::Uuid::new_v4(),
            cloud_id: Some(url.clone()),
            provider: CloudProvider::Aws,
            resource_type: ResourceType::Queue,
            name: queue_name,
            region: region.to_owned(),
            status: ResourceStatus::Running,
            metadata: serde_json::json!({ "queue_url": url, "fifo": fifo }),
            tags: Default::default(),
            created_at: now,
            updated_at: now,
        })
    }

    async fn delete_queue(&self, region: &str, id: &str) -> Result<()> {
        let region = self.resolve_region(region);
        let client = self.sqs_client(region)?;
        client.delete_queue().queue_url(id).send().await
            .map_err(|e| CloudError::ProviderError(format!("SQS delete_queue: {}", e)))?;
        Ok(())
    }

    async fn list_topics(&self, region: &str) -> Result<Vec<CloudResource>> {
        let region = self.resolve_region(region);
        tracing::info!(provider = "aws", region = region, "Listing SNS topics via SDK");

        let client = self.sns_client(region)?;
        let resp = client.list_topics().send().await
            .map_err(|e| CloudError::ProviderError(format!("SNS list_topics: {}", e)))?;

        let now = chrono::Utc::now();
        let topics = resp.topics().iter().filter_map(|t| {
            t.topic_arn().map(|arn| {
                let name = arn.rsplit(':').next().unwrap_or(arn).to_owned();
                CloudResource {
                    id: uuid::Uuid::new_v4(),
                    cloud_id: Some(arn.to_owned()),
                    provider: CloudProvider::Aws,
                    resource_type: ResourceType::Topic,
                    name,
                    region: region.to_owned(),
                    status: ResourceStatus::Running,
                    metadata: serde_json::json!({ "topic_arn": arn }),
                    tags: Default::default(),
                    created_at: now,
                    updated_at: now,
                }
            })
        }).collect();
        Ok(topics)
    }

    async fn create_topic(&self, region: &str, name: &str) -> Result<CloudResource> {
        let region = self.resolve_region(region);
        let client = self.sns_client(region)?;
        let resp = client.create_topic().name(name).send().await
            .map_err(|e| CloudError::ProviderError(format!("SNS create_topic: {}", e)))?;
        let arn = resp.topic_arn().unwrap_or_default().to_owned();
        let now = chrono::Utc::now();
        Ok(CloudResource {
            id: uuid::Uuid::new_v4(),
            cloud_id: Some(arn.clone()),
            provider: CloudProvider::Aws,
            resource_type: ResourceType::Topic,
            name: name.to_owned(),
            region: region.to_owned(),
            status: ResourceStatus::Running,
            metadata: serde_json::json!({ "topic_arn": arn }),
            tags: Default::default(),
            created_at: now,
            updated_at: now,
        })
    }

    async fn delete_topic(&self, region: &str, id: &str) -> Result<()> {
        let region = self.resolve_region(region);
        let client = self.sns_client(region)?;
        client.delete_topic().topic_arn(id).send().await
            .map_err(|e| CloudError::ProviderError(format!("SNS delete_topic: {}", e)))?;
        Ok(())
    }
}

// ===========================================================================
// KMS — AWS Key Management Service SDK
// ===========================================================================

#[async_trait]
impl KmsProvider for AwsSdkProvider {
    async fn list_keys(&self, region: &str) -> Result<Vec<CloudResource>> {
        let region = self.resolve_region(region);
        tracing::info!(provider = "aws", region = region, "Listing KMS keys via SDK");

        let client = self.kms_real_client(region)?;
        let resp = client.list_keys().send().await
            .map_err(|e| CloudError::ProviderError(format!("KMS list_keys: {}", e)))?;

        let now = chrono::Utc::now();
        let mut keys = Vec::new();
        for entry in resp.keys() {
            let key_id = entry.key_id().unwrap_or_default().to_owned();
            if let Ok(desc) = client.describe_key().key_id(&key_id).send().await {
                if let Some(meta) = desc.key_metadata() {
                    let status = match meta.key_state() {
                        Some(s) if s.as_str() == "Enabled" => ResourceStatus::Running,
                        Some(s) if s.as_str() == "Disabled" => ResourceStatus::Stopped,
                        Some(s) if s.as_str() == "PendingDeletion" => ResourceStatus::Deleting,
                        _ => ResourceStatus::Pending,
                    };
                    keys.push(CloudResource {
                        id: uuid::Uuid::new_v4(),
                        cloud_id: Some(key_id.clone()),
                        provider: CloudProvider::Aws,
                        resource_type: ResourceType::KmsKey,
                        name: meta.description().unwrap_or(key_id.as_str()).to_owned(),
                        region: region.to_owned(),
                        status,
                        metadata: serde_json::json!({
                            "arn": meta.arn().unwrap_or_default(),
                            "key_usage": meta.key_usage().map(|u| u.as_str()).unwrap_or_default(),
                            "key_spec": meta.key_spec().map(|s| s.as_str()).unwrap_or_default(),
                            "key_manager": meta.key_manager().map(|m| m.as_str()).unwrap_or_default(),
                        }),
                        tags: Default::default(),
                        created_at: now,
                        updated_at: now,
                    });
                }
            }
        }
        Ok(keys)
    }

    async fn get_key(&self, region: &str, id: &str) -> Result<CloudResource> {
        let region = self.resolve_region(region);
        tracing::info!(provider = "aws", region = region, id = id, "Getting KMS key via SDK");

        let client = self.kms_real_client(region)?;
        let resp = client.describe_key().key_id(id).send().await
            .map_err(|e| CloudError::ProviderError(format!("KMS describe_key: {}", e)))?;

        let meta = resp.key_metadata().ok_or_else(|| CloudError::NotFound(format!("KMS key {} not found", id)))?;
        let now = chrono::Utc::now();
        let status = match meta.key_state() {
            Some(s) if s.as_str() == "Enabled" => ResourceStatus::Running,
            Some(s) if s.as_str() == "Disabled" => ResourceStatus::Stopped,
            Some(s) if s.as_str() == "PendingDeletion" => ResourceStatus::Deleting,
            _ => ResourceStatus::Pending,
        };
        Ok(CloudResource {
            id: uuid::Uuid::new_v4(),
            cloud_id: Some(meta.key_id().to_owned()),
            provider: CloudProvider::Aws,
            resource_type: ResourceType::KmsKey,
            name: meta.description().unwrap_or(meta.key_id()).to_owned(),
            region: region.to_owned(),
            status,
            metadata: serde_json::json!({
                "arn": meta.arn().unwrap_or_default(),
                "key_usage": meta.key_usage().map(|u| u.as_str()).unwrap_or_default(),
                "key_spec": meta.key_spec().map(|s| s.as_str()).unwrap_or_default(),
                "key_manager": meta.key_manager().map(|m| m.as_str()).unwrap_or_default(),
                "enabled": meta.enabled(),
            }),
            tags: Default::default(),
            created_at: now,
            updated_at: now,
        })
    }

    async fn create_key(&self, region: &str, name: &str, key_type: &str) -> Result<CloudResource> {
        let region = self.resolve_region(region);
        tracing::info!(provider = "aws", region = region, name = name, key_type = key_type, "Creating KMS key via SDK");

        let client = self.kms_real_client(region)?;
        let key_spec = match key_type {
            "rsa" | "RSA" | "rsa-2048" => aws_sdk_kms::types::KeySpec::Rsa2048,
            "rsa-4096" => aws_sdk_kms::types::KeySpec::Rsa4096,
            "ecc" | "ecc-nist-p256" => aws_sdk_kms::types::KeySpec::EccNistP256,
            _ => aws_sdk_kms::types::KeySpec::SymmetricDefault,
        };
        let key_usage = if matches!(key_spec, aws_sdk_kms::types::KeySpec::SymmetricDefault) {
            aws_sdk_kms::types::KeyUsageType::EncryptDecrypt
        } else {
            aws_sdk_kms::types::KeyUsageType::SignVerify
        };
        let resp = client.create_key().description(name).key_spec(key_spec).key_usage(key_usage)
            .send().await
            .map_err(|e| CloudError::ProviderError(format!("KMS create_key: {}", e)))?;
        let meta = resp.key_metadata().ok_or_else(|| CloudError::ProviderError("No key metadata".into()))?;
        let now = chrono::Utc::now();
        Ok(CloudResource {
            id: uuid::Uuid::new_v4(),
            cloud_id: Some(meta.key_id().to_owned()),
            provider: CloudProvider::Aws,
            resource_type: ResourceType::KmsKey,
            name: name.to_owned(),
            region: region.to_owned(),
            status: ResourceStatus::Running,
            metadata: serde_json::json!({ "arn": meta.arn().unwrap_or_default(), "key_spec": key_type }),
            tags: Default::default(),
            created_at: now,
            updated_at: now,
        })
    }

    async fn schedule_key_deletion(&self, region: &str, id: &str) -> Result<()> {
        let region = self.resolve_region(region);
        let client = self.kms_real_client(region)?;
        client.schedule_key_deletion().key_id(id).pending_window_in_days(7).send().await
            .map_err(|e| CloudError::ProviderError(format!("KMS schedule_key_deletion: {}", e)))?;
        Ok(())
    }

    async fn set_key_enabled(&self, region: &str, id: &str, enabled: bool) -> Result<()> {
        let region = self.resolve_region(region);
        let client = self.kms_real_client(region)?;
        if enabled {
            client.enable_key().key_id(id).send().await
                .map_err(|e| CloudError::ProviderError(format!("KMS enable_key: {}", e)))?;
        } else {
            client.disable_key().key_id(id).send().await
                .map_err(|e| CloudError::ProviderError(format!("KMS disable_key: {}", e)))?;
        }
        Ok(())
    }
}

// ===========================================================================
// Auto Scaling — AWS Auto Scaling SDK
// ===========================================================================

#[async_trait]
impl AutoScalingProvider for AwsSdkProvider {
    async fn list_groups(&self, region: &str) -> Result<Vec<CloudResource>> {
        let region = self.resolve_region(region);
        tracing::info!(provider = "aws", region = region, "Listing Auto Scaling groups via SDK");

        let client = self.autoscaling_client(region)?;
        let resp = client.describe_auto_scaling_groups().send().await
            .map_err(|e| CloudError::ProviderError(format!("AutoScaling list: {}", e)))?;

        let now = chrono::Utc::now();
        let groups = resp.auto_scaling_groups().iter().map(|g| {
            let status = if g.instances().is_empty() { ResourceStatus::Stopped } else { ResourceStatus::Running };
            let mut tags: std::collections::HashMap<String, String> = Default::default();
            for t in g.tags() {
                if let (Some(k), Some(v)) = (t.key(), t.value()) {
                    tags.insert(k.to_owned(), v.to_owned());
                }
            }
            CloudResource {
                id: uuid::Uuid::new_v4(),
                cloud_id: Some(g.auto_scaling_group_name().unwrap_or_default().to_owned()),
                provider: CloudProvider::Aws,
                resource_type: ResourceType::AutoScalingGroup,
                name: g.auto_scaling_group_name().unwrap_or_default().to_owned(),
                region: region.to_owned(),
                status,
                metadata: serde_json::json!({
                    "arn": g.auto_scaling_group_arn().unwrap_or_default(),
                    "min_size": g.min_size(),
                    "max_size": g.max_size(),
                    "desired_capacity": g.desired_capacity(),
                    "instance_count": g.instances().len(),
                    "launch_configuration": g.launch_configuration_name().unwrap_or_default(),
                    "availability_zones": g.availability_zones(),
                }),
                tags,
                created_at: now,
                updated_at: now,
            }
        }).collect();
        Ok(groups)
    }

    async fn get_group(&self, region: &str, id: &str) -> Result<CloudResource> {
        let region = self.resolve_region(region);
        let client = self.autoscaling_client(region)?;
        let resp = client.describe_auto_scaling_groups().auto_scaling_group_names(id)
            .send().await
            .map_err(|e| CloudError::ProviderError(format!("AutoScaling get: {}", e)))?;
        let g = resp.auto_scaling_groups().first()
            .ok_or_else(|| CloudError::NotFound(format!("ASG {} not found", id)))?;
        let now = chrono::Utc::now();
        Ok(CloudResource {
            id: uuid::Uuid::new_v4(),
            cloud_id: Some(g.auto_scaling_group_name().unwrap_or_default().to_owned()),
            provider: CloudProvider::Aws,
            resource_type: ResourceType::AutoScalingGroup,
            name: g.auto_scaling_group_name().unwrap_or_default().to_owned(),
            region: region.to_owned(),
            status: ResourceStatus::Running,
            metadata: serde_json::json!({
                "arn": g.auto_scaling_group_arn().unwrap_or_default(),
                "min_size": g.min_size(), "max_size": g.max_size(),
                "desired_capacity": g.desired_capacity(),
                "instance_count": g.instances().len(),
            }),
            tags: Default::default(),
            created_at: now,
            updated_at: now,
        })
    }

    async fn create_group(&self, region: &str, name: &str, min_size: u32, max_size: u32, desired: u32) -> Result<CloudResource> {
        let region = self.resolve_region(region);
        let client = self.autoscaling_client(region)?;
        let az = format!("{}a", region);
        client.create_auto_scaling_group()
            .auto_scaling_group_name(name)
            .min_size(min_size as i32).max_size(max_size as i32).desired_capacity(desired as i32)
            .availability_zones(&az).launch_configuration_name("placeholder-lc")
            .send().await
            .map_err(|e| CloudError::ProviderError(format!("AutoScaling create: {}", e)))?;
        let now = chrono::Utc::now();
        Ok(CloudResource {
            id: uuid::Uuid::new_v4(),
            cloud_id: Some(name.to_owned()),
            provider: CloudProvider::Aws,
            resource_type: ResourceType::AutoScalingGroup,
            name: name.to_owned(),
            region: region.to_owned(),
            status: ResourceStatus::Creating,
            metadata: serde_json::json!({ "min_size": min_size, "max_size": max_size, "desired_capacity": desired }),
            tags: Default::default(),
            created_at: now,
            updated_at: now,
        })
    }

    async fn delete_group(&self, region: &str, id: &str) -> Result<()> {
        let region = self.resolve_region(region);
        let client = self.autoscaling_client(region)?;
        client.delete_auto_scaling_group().auto_scaling_group_name(id).force_delete(true)
            .send().await
            .map_err(|e| CloudError::ProviderError(format!("AutoScaling delete: {}", e)))?;
        Ok(())
    }

    async fn set_desired_capacity(&self, region: &str, id: &str, desired: u32) -> Result<()> {
        let region = self.resolve_region(region);
        let client = self.autoscaling_client(region)?;
        client.set_desired_capacity().auto_scaling_group_name(id).desired_capacity(desired as i32)
            .send().await
            .map_err(|e| CloudError::ProviderError(format!("AutoScaling set_desired: {}", e)))?;
        Ok(())
    }
}

// ===========================================================================
// Volume — AWS EC2 EBS SDK
// ===========================================================================

#[async_trait]
impl VolumeProvider for AwsSdkProvider {
    async fn list_volumes(&self, region: &str) -> Result<Vec<CloudResource>> {
        let region = self.resolve_region(region);
        tracing::info!(provider = "aws", region = region, "Listing EBS volumes via SDK");

        let client = self.ec2_client(region)?;
        let resp = client.describe_volumes().send().await
            .map_err(|e| CloudError::ProviderError(format!("EC2 describe_volumes: {}", e)))?;

        let now = chrono::Utc::now();
        let volumes = resp.volumes().iter().map(|v| {
            let status = match v.state() {
                Some(s) if s.as_str() == "available" => ResourceStatus::Available,
                Some(s) if s.as_str() == "in-use" => ResourceStatus::Running,
                Some(s) if s.as_str() == "creating" => ResourceStatus::Creating,
                Some(s) if s.as_str() == "deleting" => ResourceStatus::Deleting,
                _ => ResourceStatus::Pending,
            };
            let mut tags: std::collections::HashMap<String, String> = Default::default();
            for t in v.tags() {
                if let (Some(k), Some(v)) = (t.key(), t.value()) { tags.insert(k.to_owned(), v.to_owned()); }
            }
            let name = tags.get("Name").cloned().unwrap_or_else(|| v.volume_id().unwrap_or_default().to_owned());
            CloudResource {
                id: uuid::Uuid::new_v4(),
                cloud_id: v.volume_id().map(|s| s.to_owned()),
                provider: CloudProvider::Aws,
                resource_type: ResourceType::Volume,
                name,
                region: region.to_owned(),
                status,
                metadata: serde_json::json!({
                    "size_gb": v.size(),
                    "volume_type": v.volume_type().map(|t| t.as_str()).unwrap_or_default(),
                    "iops": v.iops(),
                    "encrypted": v.encrypted(),
                    "availability_zone": v.availability_zone().unwrap_or_default(),
                    "attachments": v.attachments().iter().map(|a| serde_json::json!({
                        "instance_id": a.instance_id().unwrap_or_default(),
                        "device": a.device().unwrap_or_default(),
                        "state": a.state().map(|s| s.as_str()).unwrap_or_default(),
                    })).collect::<Vec<_>>(),
                }),
                tags,
                created_at: now,
                updated_at: now,
            }
        }).collect();
        Ok(volumes)
    }

    async fn create_volume(&self, region: &str, size_gb: i32, volume_type: &str, az: &str) -> Result<CloudResource> {
        let region = self.resolve_region(region);
        let client = self.ec2_client(region)?;
        let vtype = match volume_type {
            "gp3" => aws_sdk_ec2::types::VolumeType::Gp3,
            "gp2" => aws_sdk_ec2::types::VolumeType::Gp2,
            "io1" => aws_sdk_ec2::types::VolumeType::Io1,
            "io2" => aws_sdk_ec2::types::VolumeType::Io2,
            "st1" => aws_sdk_ec2::types::VolumeType::St1,
            "sc1" => aws_sdk_ec2::types::VolumeType::Sc1,
            _ => aws_sdk_ec2::types::VolumeType::Gp3,
        };
        let resp = client.create_volume().availability_zone(az).size(size_gb).volume_type(vtype)
            .send().await
            .map_err(|e| CloudError::ProviderError(format!("EC2 create_volume: {}", e)))?;
        let now = chrono::Utc::now();
        Ok(CloudResource {
            id: uuid::Uuid::new_v4(),
            cloud_id: resp.volume_id().map(|s| s.to_owned()),
            provider: CloudProvider::Aws,
            resource_type: ResourceType::Volume,
            name: resp.volume_id().unwrap_or_default().to_owned(),
            region: region.to_owned(),
            status: ResourceStatus::Creating,
            metadata: serde_json::json!({ "size_gb": size_gb, "volume_type": volume_type, "availability_zone": az }),
            tags: Default::default(),
            created_at: now,
            updated_at: now,
        })
    }

    async fn attach_volume(&self, region: &str, volume_id: &str, instance_id: &str, device: &str) -> Result<()> {
        let region = self.resolve_region(region);
        let client = self.ec2_client(region)?;
        client.attach_volume().volume_id(volume_id).instance_id(instance_id).device(device)
            .send().await
            .map_err(|e| CloudError::ProviderError(format!("EC2 attach_volume: {}", e)))?;
        Ok(())
    }

    async fn detach_volume(&self, region: &str, volume_id: &str) -> Result<()> {
        let region = self.resolve_region(region);
        let client = self.ec2_client(region)?;
        client.detach_volume().volume_id(volume_id).send().await
            .map_err(|e| CloudError::ProviderError(format!("EC2 detach_volume: {}", e)))?;
        Ok(())
    }

    async fn delete_volume(&self, region: &str, id: &str) -> Result<()> {
        let region = self.resolve_region(region);
        let client = self.ec2_client(region)?;
        client.delete_volume().volume_id(id).send().await
            .map_err(|e| CloudError::ProviderError(format!("EC2 delete_volume: {}", e)))?;
        Ok(())
    }

    async fn create_volume_snapshot(&self, region: &str, volume_id: &str, name: &str) -> Result<CloudResource> {
        let region = self.resolve_region(region);
        let client = self.ec2_client(region)?;
        let resp = client.create_snapshot().volume_id(volume_id).description(name)
            .send().await
            .map_err(|e| CloudError::ProviderError(format!("EC2 create_snapshot: {}", e)))?;
        let now = chrono::Utc::now();
        Ok(CloudResource {
            id: uuid::Uuid::new_v4(),
            cloud_id: resp.snapshot_id().map(|s| s.to_owned()),
            provider: CloudProvider::Aws,
            resource_type: ResourceType::Snapshot,
            name: name.to_owned(),
            region: region.to_owned(),
            status: ResourceStatus::Creating,
            metadata: serde_json::json!({ "volume_id": volume_id, "volume_size": resp.volume_size(), "encrypted": resp.encrypted() }),
            tags: Default::default(),
            created_at: now,
            updated_at: now,
        })
    }
}

// ===========================================================================
// ML — AWS SageMaker SDK
// ===========================================================================

#[async_trait]
impl MlProvider for AwsSdkProvider {
    async fn list_models(&self, region: &str) -> Result<Vec<CloudResource>> {
        let region = self.resolve_region(region);
        tracing::info!(provider = "aws", region = region, "Listing SageMaker models via SDK");

        let client = self.sagemaker_client(region)?;
        let resp = client.list_models().send().await
            .map_err(|e| CloudError::ProviderError(format!("SageMaker list_models: {}", e)))?;

        let now = chrono::Utc::now();
        let models = resp.models().iter().map(|m| CloudResource {
            id: uuid::Uuid::new_v4(),
            cloud_id: Some(m.model_arn().unwrap_or_default().to_owned()),
            provider: CloudProvider::Aws,
            resource_type: ResourceType::MlModel,
            name: m.model_name().unwrap_or_default().to_owned(),
            region: region.to_owned(),
            status: ResourceStatus::Running,
            metadata: serde_json::json!({ "arn": m.model_arn() }),
            tags: Default::default(),
            created_at: now,
            updated_at: now,
        }).collect();
        Ok(models)
    }

    async fn list_endpoints(&self, region: &str) -> Result<Vec<CloudResource>> {
        let region = self.resolve_region(region);
        let client = self.sagemaker_client(region)?;
        let resp = client.list_endpoints().send().await
            .map_err(|e| CloudError::ProviderError(format!("SageMaker list_endpoints: {}", e)))?;

        let now = chrono::Utc::now();
        let endpoints = resp.endpoints().iter().map(|ep| {
            let ep_status_str = ep.endpoint_status().map(|s| s.as_str()).unwrap_or("Unknown");
            let status = match ep_status_str {
                "InService" => ResourceStatus::Running,
                "Creating" => ResourceStatus::Creating,
                "Updating" => ResourceStatus::Updating,
                "Deleting" => ResourceStatus::Deleting,
                "Failed" => ResourceStatus::Error,
                _ => ResourceStatus::Pending,
            };
            CloudResource {
                id: uuid::Uuid::new_v4(),
                cloud_id: Some(ep.endpoint_arn().unwrap_or_default().to_owned()),
                provider: CloudProvider::Aws,
                resource_type: ResourceType::MlEndpoint,
                name: ep.endpoint_name().unwrap_or_default().to_owned(),
                region: region.to_owned(),
                status,
                metadata: serde_json::json!({ "arn": ep.endpoint_arn(), "endpoint_status": ep.endpoint_status().map(|s| s.as_str()).unwrap_or("Unknown") }),
                tags: Default::default(),
                created_at: now,
                updated_at: now,
            }
        }).collect();
        Ok(endpoints)
    }

    async fn list_training_jobs(&self, region: &str) -> Result<Vec<CloudResource>> {
        let region = self.resolve_region(region);
        let client = self.sagemaker_client(region)?;
        let resp = client.list_training_jobs().send().await
            .map_err(|e| CloudError::ProviderError(format!("SageMaker list_training_jobs: {}", e)))?;

        let now = chrono::Utc::now();
        let jobs = resp.training_job_summaries().iter().map(|j| {
            let j_status_str = j.training_job_status().map(|s| s.as_str()).unwrap_or("Unknown");
            let status = match j_status_str {
                "Completed" => ResourceStatus::Running,
                "InProgress" => ResourceStatus::Creating,
                "Stopping" | "Stopped" => ResourceStatus::Stopped,
                "Failed" => ResourceStatus::Error,
                _ => ResourceStatus::Pending,
            };
            CloudResource {
                id: uuid::Uuid::new_v4(),
                cloud_id: Some(j.training_job_arn().unwrap_or_default().to_owned()),
                provider: CloudProvider::Aws,
                resource_type: ResourceType::MlTrainingJob,
                name: j.training_job_name().unwrap_or_default().to_owned(),
                region: region.to_owned(),
                status,
                metadata: serde_json::json!({ "arn": j.training_job_arn(), "status": j.training_job_status().map(|s| s.as_str()).unwrap_or("Unknown") }),
                tags: Default::default(),
                created_at: now,
                updated_at: now,
            }
        }).collect();
        Ok(jobs)
    }

    async fn create_endpoint(&self, region: &str, name: &str, model_name: &str) -> Result<CloudResource> {
        let region = self.resolve_region(region);
        tracing::info!(provider = "aws", region = region, name = name, model_name = model_name, "Creating SageMaker endpoint via SDK");

        let client = self.sagemaker_client(region)?;
        let config_name = format!("{}-config", name);
        let variant = aws_sdk_sagemaker::types::ProductionVariant::builder()
            .variant_name("AllTraffic").model_name(model_name)
            .initial_instance_count(1)
            .instance_type(aws_sdk_sagemaker::types::ProductionVariantInstanceType::MlM5Large)
            .build();

        client.create_endpoint_config().endpoint_config_name(&config_name)
            .production_variants(variant).send().await
            .map_err(|e| CloudError::ProviderError(format!("SageMaker create_endpoint_config: {}", e)))?;

        let resp = client.create_endpoint().endpoint_name(name).endpoint_config_name(&config_name)
            .send().await
            .map_err(|e| CloudError::ProviderError(format!("SageMaker create_endpoint: {}", e)))?;

        let now = chrono::Utc::now();
        Ok(CloudResource {
            id: uuid::Uuid::new_v4(),
            cloud_id: resp.endpoint_arn().map(|s| s.to_owned()),
            provider: CloudProvider::Aws,
            resource_type: ResourceType::MlEndpoint,
            name: name.to_owned(),
            region: region.to_owned(),
            status: ResourceStatus::Creating,
            metadata: serde_json::json!({ "model_name": model_name, "endpoint_config": config_name }),
            tags: Default::default(),
            created_at: now,
            updated_at: now,
        })
    }

    async fn delete_endpoint(&self, region: &str, name: &str) -> Result<()> {
        let region = self.resolve_region(region);
        let client = self.sagemaker_client(region)?;
        client.delete_endpoint().endpoint_name(name).send().await
            .map_err(|e| CloudError::ProviderError(format!("SageMaker delete_endpoint: {}", e)))?;
        Ok(())
    }
}

// ===========================================================================
// IoT — AWS IoT SDK
// ===========================================================================

#[async_trait]
impl IoTProvider for AwsSdkProvider {
    async fn list_things(&self, region: &str) -> Result<Vec<CloudResource>> {
        let region = self.resolve_region(region);
        tracing::info!(provider = "aws", region = region, "Listing IoT things via SDK");

        let client = self.iot_client(region)?;
        let resp = client.list_things().send().await
            .map_err(|e| CloudError::ProviderError(format!("IoT list_things: {}", e)))?;

        let now = chrono::Utc::now();
        let things = resp.things().iter().map(|t| {
            let attrs: serde_json::Value = t.attributes()
                .map(|a| serde_json::json!(a))
                .unwrap_or(serde_json::json!({}));
            CloudResource {
                id: uuid::Uuid::new_v4(),
                cloud_id: Some(t.thing_name().unwrap_or_default().to_owned()),
                provider: CloudProvider::Aws,
                resource_type: ResourceType::IoTThing,
                name: t.thing_name().unwrap_or_default().to_owned(),
                region: region.to_owned(),
                status: ResourceStatus::Running,
                metadata: serde_json::json!({
                    "thing_arn": t.thing_arn().unwrap_or_default(),
                    "thing_type": t.thing_type_name().unwrap_or_default(),
                    "attributes": attrs,
                    "version": t.version(),
                }),
                tags: Default::default(),
                created_at: now,
                updated_at: now,
            }
        }).collect();
        Ok(things)
    }

    async fn get_thing(&self, region: &str, name: &str) -> Result<CloudResource> {
        let region = self.resolve_region(region);
        let client = self.iot_client(region)?;
        let resp = client.describe_thing().thing_name(name).send().await
            .map_err(|e| CloudError::ProviderError(format!("IoT describe_thing: {}", e)))?;

        let now = chrono::Utc::now();
        let attrs: serde_json::Value = resp.attributes()
            .map(|a| serde_json::json!(a))
            .unwrap_or(serde_json::json!({}));
        Ok(CloudResource {
            id: uuid::Uuid::new_v4(),
            cloud_id: Some(resp.thing_name().unwrap_or_default().to_owned()),
            provider: CloudProvider::Aws,
            resource_type: ResourceType::IoTThing,
            name: resp.thing_name().unwrap_or_default().to_owned(),
            region: region.to_owned(),
            status: ResourceStatus::Running,
            metadata: serde_json::json!({
                "thing_arn": resp.thing_arn().unwrap_or_default(),
                "thing_type": resp.thing_type_name().unwrap_or_default(),
                "attributes": attrs,
                "version": resp.version(),
            }),
            tags: Default::default(),
            created_at: now,
            updated_at: now,
        })
    }

    async fn create_thing(&self, region: &str, name: &str, attributes: serde_json::Value) -> Result<CloudResource> {
        let region = self.resolve_region(region);
        let client = self.iot_client(region)?;
        let mut req = client.create_thing().thing_name(name);
        if let Some(attrs_map) = attributes.as_object() {
            let mut attr_builder = aws_sdk_iot::types::AttributePayload::builder();
            for (k, v) in attrs_map {
                attr_builder = attr_builder.attributes(k.clone(), v.as_str().unwrap_or_default().to_owned());
            }
            req = req.attribute_payload(attr_builder.build());
        }
        let resp = req.send().await
            .map_err(|e| CloudError::ProviderError(format!("IoT create_thing: {}", e)))?;
        let now = chrono::Utc::now();
        Ok(CloudResource {
            id: uuid::Uuid::new_v4(),
            cloud_id: Some(resp.thing_name().unwrap_or_default().to_owned()),
            provider: CloudProvider::Aws,
            resource_type: ResourceType::IoTThing,
            name: resp.thing_name().unwrap_or_default().to_owned(),
            region: region.to_owned(),
            status: ResourceStatus::Running,
            metadata: serde_json::json!({ "thing_arn": resp.thing_arn().unwrap_or_default(), "thing_id": resp.thing_id().unwrap_or_default() }),
            tags: Default::default(),
            created_at: now,
            updated_at: now,
        })
    }

    async fn delete_thing(&self, region: &str, name: &str) -> Result<()> {
        let region = self.resolve_region(region);
        let client = self.iot_client(region)?;
        client.delete_thing().thing_name(name).send().await
            .map_err(|e| CloudError::ProviderError(format!("IoT delete_thing: {}", e)))?;
        Ok(())
    }

    async fn list_thing_groups(&self, region: &str) -> Result<Vec<CloudResource>> {
        let region = self.resolve_region(region);
        let client = self.iot_client(region)?;
        let resp = client.list_thing_groups().send().await
            .map_err(|e| CloudError::ProviderError(format!("IoT list_thing_groups: {}", e)))?;
        let now = chrono::Utc::now();
        let groups = resp.thing_groups().iter().map(|g| CloudResource {
            id: uuid::Uuid::new_v4(),
            cloud_id: Some(g.group_name().unwrap_or_default().to_owned()),
            provider: CloudProvider::Aws,
            resource_type: ResourceType::IoTThingGroup,
            name: g.group_name().unwrap_or_default().to_owned(),
            region: region.to_owned(),
            status: ResourceStatus::Running,
            metadata: serde_json::json!({ "group_arn": g.group_arn().unwrap_or_default() }),
            tags: Default::default(),
            created_at: now,
            updated_at: now,
        }).collect();
        Ok(groups)
    }
}
