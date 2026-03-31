use actix_cors::Cors;
use actix_web::{middleware, web, App, HttpServer};
use std::sync::Arc;
use tracing_subscriber::EnvFilter;

mod config;
mod error;
mod handlers;
mod models;
mod providers;
mod traits;

use config::AppConfig;
use providers::store;
use providers::ProviderContext;

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    dotenv::dotenv().ok();

    tracing_subscriber::fmt()
        .with_env_filter(EnvFilter::from_default_env().add_directive("info".parse().unwrap()))
        .init();

    let config = AppConfig::from_env();
    let bind_addr = format!("{}:{}", config.server.host, config.server.port);
    let flags = cloud_common::FeatureFlags::from_env();

    // Create and seed the in-memory resource store (used as fallback in mock mode)
    let cloud_store = Arc::new(store::create_seeded_store());
    tracing::info!("In-memory cloud resource store seeded successfully");

    // Initialize real cloud credentials and cache if not in mock mode
    let (credentials, cache) = if flags.use_real_sdk() {
        tracing::info!("Real SDK mode enabled — initializing cloud credentials and Redis cache");

        let creds = Arc::new(cloud_common::CredentialManager::new().await);
        let available = creds.available_providers();
        tracing::info!(providers = ?available, "Cloud credentials loaded");

        let redis_url =
            std::env::var("REDIS_URL").unwrap_or_else(|_| "redis://127.0.0.1:6379".to_owned());
        let cache = cloud_common::RedisCache::new(&redis_url, "cloud-service")
            .await
            .map(Arc::new)
            .ok();

        if cache.is_none() {
            tracing::warn!("Redis not available — caching disabled");
        }

        (Some(creds), cache)
    } else {
        tracing::info!("Mock mode enabled (CLOUD_USE_MOCK_DATA=true) — using in-memory data");
        (None, None)
    };

    let provider_ctx = Arc::new(ProviderContext {
        store: cloud_store,
        credentials,
        cache,
        flags,
    });

    // Initialize embedded SurrealDB for persistent CRUD storage
    let db = cloud_common::Database::new("./data/cloud").await.unwrap();
    db.init_schema().await.ok();
    tracing::info!("SurrealDB initialized for cloud-service");

    let db_data = web::Data::new(db);

    tracing::info!("Starting cloud service on {}", bind_addr);

    HttpServer::new(move || {
        let cors = Cors::default()
            .allow_any_origin()
            .allow_any_method()
            .allow_any_header()
            .max_age(3600);

        App::new()
            .wrap(cors)
            .wrap(middleware::Logger::default())
            .app_data(web::Data::new(provider_ctx.clone()))
            .app_data(db_data.clone())
            // Health check
            .route("/health", web::get().to(health_check))
            // Credentials management routes
            .service(
                web::scope("/api/v1/cloud/credentials")
                    .route("/status", web::get().to(handlers::credentials::get_credentials_status))
                    .route("", web::post().to(handlers::credentials::save_credentials))
                    .route("/{provider}", web::delete().to(handlers::credentials::delete_credentials)),
            )
            // Compute routes
            .service(
                web::scope("/api/v1/cloud/{provider}/compute")
                    .route("/instances", web::get().to(handlers::compute::list_instances))
                    .route("/instances", web::post().to(handlers::compute::create_instance))
                    .route("/instances/{id}", web::get().to(handlers::compute::get_instance))
                    .route(
                        "/instances/{id}",
                        web::delete().to(handlers::compute::delete_instance),
                    )
                    .route(
                        "/instances/{id}/actions/{action}",
                        web::post().to(handlers::compute::instance_action),
                    ),
            )
            // Storage routes
            .service(
                web::scope("/api/v1/cloud/{provider}/storage")
                    .route("/buckets", web::get().to(handlers::storage::list_buckets))
                    .route("/buckets", web::post().to(handlers::storage::create_bucket))
                    .route("/buckets/{id}", web::get().to(handlers::storage::get_bucket))
                    .route(
                        "/buckets/{id}",
                        web::delete().to(handlers::storage::delete_bucket),
                    )
                    .route(
                        "/buckets/{id}/objects",
                        web::get().to(handlers::storage::list_objects),
                    )
                    .route(
                        "/buckets/{id}/objects",
                        web::post().to(handlers::storage::upload_object),
                    )
                    .route(
                        "/buckets/{bucket}/objects/{key}",
                        web::delete().to(handlers::storage::delete_object),
                    )
                    // Bucket policy
                    .route(
                        "/buckets/{id}/policy",
                        web::get().to(handlers::storage::get_bucket_policy),
                    )
                    .route(
                        "/buckets/{id}/policy",
                        web::put().to(handlers::storage::put_bucket_policy),
                    )
                    .route(
                        "/buckets/{id}/policy",
                        web::delete().to(handlers::storage::delete_bucket_policy),
                    )
                    // Bucket lifecycle
                    .route(
                        "/buckets/{id}/lifecycle",
                        web::get().to(handlers::storage::get_lifecycle_rules),
                    )
                    .route(
                        "/buckets/{id}/lifecycle",
                        web::put().to(handlers::storage::put_lifecycle_rules),
                    )
                    // Bucket encryption
                    .route(
                        "/buckets/{id}/encryption",
                        web::get().to(handlers::storage::get_bucket_encryption),
                    )
                    .route(
                        "/buckets/{id}/encryption",
                        web::put().to(handlers::storage::put_bucket_encryption),
                    )
                    // Bucket CORS
                    .route(
                        "/buckets/{id}/cors",
                        web::get().to(handlers::storage::get_cors_rules),
                    )
                    .route(
                        "/buckets/{id}/cors",
                        web::put().to(handlers::storage::put_cors_rules),
                    ),
            )
            // Networking routes
            .service(
                web::scope("/api/v1/cloud/{provider}/networking")
                    .route("/vpcs", web::get().to(handlers::networking::list_vpcs))
                    .route("/vpcs", web::post().to(handlers::networking::create_vpc))
                    .route("/vpcs/{id}", web::get().to(handlers::networking::get_vpc))
                    .route(
                        "/vpcs/{id}",
                        web::delete().to(handlers::networking::delete_vpc),
                    )
                    .route(
                        "/vpcs/{vpc_id}/subnets",
                        web::get().to(handlers::networking::list_subnets),
                    )
                    .route("/subnets", web::post().to(handlers::networking::create_subnet))
                    .route(
                        "/subnets/{id}",
                        web::delete().to(handlers::networking::delete_subnet),
                    )
                    .route(
                        "/load-balancers",
                        web::get().to(handlers::networking::list_load_balancers),
                    )
                    .route(
                        "/load-balancers/{id}",
                        web::get().to(handlers::networking::get_load_balancer),
                    )
                    .route(
                        "/load-balancers/{id}",
                        web::delete().to(handlers::networking::delete_load_balancer),
                    )
                    .route(
                        "/security-groups",
                        web::get().to(handlers::networking::list_security_groups),
                    )
                    .route(
                        "/security-groups",
                        web::post().to(handlers::networking::create_security_group),
                    )
                    .route(
                        "/security-groups/{id}",
                        web::delete().to(handlers::networking::delete_security_group),
                    )
                    .route(
                        "/security-groups/{id}/rules",
                        web::post().to(handlers::networking::add_security_group_rule),
                    )
                    .route(
                        "/security-groups/{id}/rules/delete",
                        web::post().to(handlers::networking::remove_security_group_rule),
                    )
                    // Elastic IPs
                    .route(
                        "/elastic-ips",
                        web::get().to(handlers::networking::list_elastic_ips),
                    )
                    .route(
                        "/elastic-ips",
                        web::post().to(handlers::networking::allocate_elastic_ip),
                    )
                    .route(
                        "/elastic-ips/{id}",
                        web::delete().to(handlers::networking::release_elastic_ip),
                    )
                    .route(
                        "/elastic-ips/{id}/associate",
                        web::post().to(handlers::networking::associate_elastic_ip),
                    )
                    .route(
                        "/elastic-ips/{association_id}/disassociate",
                        web::post().to(handlers::networking::disassociate_elastic_ip),
                    )
                    // NAT Gateways
                    .route(
                        "/nat-gateways",
                        web::get().to(handlers::networking::list_nat_gateways),
                    )
                    .route(
                        "/nat-gateways",
                        web::post().to(handlers::networking::create_nat_gateway),
                    )
                    .route(
                        "/nat-gateways/{id}",
                        web::delete().to(handlers::networking::delete_nat_gateway),
                    )
                    // Internet Gateways
                    .route(
                        "/internet-gateways",
                        web::get().to(handlers::networking::list_internet_gateways),
                    )
                    .route(
                        "/internet-gateways",
                        web::post().to(handlers::networking::create_internet_gateway),
                    )
                    .route(
                        "/internet-gateways/{id}",
                        web::delete().to(handlers::networking::delete_internet_gateway),
                    )
                    .route(
                        "/internet-gateways/{id}/attach",
                        web::post().to(handlers::networking::attach_internet_gateway),
                    )
                    .route(
                        "/internet-gateways/{id}/detach",
                        web::post().to(handlers::networking::detach_internet_gateway),
                    )
                    // Route Tables
                    .route(
                        "/route-tables",
                        web::get().to(handlers::networking::list_route_tables),
                    )
                    .route(
                        "/route-tables",
                        web::post().to(handlers::networking::create_route_table),
                    )
                    .route(
                        "/route-tables/{id}",
                        web::delete().to(handlers::networking::delete_route_table),
                    )
                    .route(
                        "/route-tables/{id}/routes",
                        web::post().to(handlers::networking::add_route),
                    )
                    .route(
                        "/route-tables/{id}/routes/delete",
                        web::post().to(handlers::networking::delete_route),
                    )
                    .route(
                        "/route-tables/{id}/associate",
                        web::post().to(handlers::networking::associate_route_table),
                    )
                    // VPC Peering
                    .route(
                        "/vpc-peerings",
                        web::get().to(handlers::networking::list_vpc_peering_connections),
                    )
                    .route(
                        "/vpc-peerings",
                        web::post().to(handlers::networking::create_vpc_peering),
                    )
                    .route(
                        "/vpc-peerings/{id}",
                        web::delete().to(handlers::networking::delete_vpc_peering),
                    )
                    .route(
                        "/vpc-peerings/{id}/accept",
                        web::post().to(handlers::networking::accept_vpc_peering),
                    )
                    .route("/transit-gateways", web::get().to(handlers::networking::list_transit_gateways))
                    .route("/direct-connects", web::get().to(handlers::networking::list_direct_connects))
                    .route("/vpc-endpoints", web::get().to(handlers::networking::list_vpc_endpoints)),
            )
            // Database routes
            .service(
                web::scope("/api/v1/cloud/{provider}/database")
                    .route(
                        "/instances",
                        web::get().to(handlers::database::list_databases),
                    )
                    .route(
                        "/instances",
                        web::post().to(handlers::database::create_database),
                    )
                    .route(
                        "/instances/{id}",
                        web::get().to(handlers::database::get_database),
                    )
                    .route(
                        "/instances/{id}",
                        web::delete().to(handlers::database::delete_database),
                    )
                    .route(
                        "/instances/{id}/actions/{action}",
                        web::post().to(handlers::database::database_action),
                    )
                    // Parameter groups
                    .route(
                        "/parameter-groups",
                        web::get().to(handlers::database::list_parameter_groups),
                    )
                    .route(
                        "/parameter-groups/{name}",
                        web::get().to(handlers::database::get_parameter_group),
                    ),
            )
            // Container Registry routes
            .service(
                web::scope("/api/v1/cloud/{provider}/container-registries")
                    .route(
                        "",
                        web::get().to(handlers::container_registry::list_registries),
                    )
                    .route(
                        "",
                        web::post().to(handlers::container_registry::create_registry),
                    )
                    .route(
                        "/{id}",
                        web::get().to(handlers::container_registry::get_registry),
                    )
                    .route(
                        "/{id}",
                        web::delete().to(handlers::container_registry::delete_registry),
                    )
                    .route(
                        "/{id}/images",
                        web::get().to(handlers::container_registry::list_images),
                    )
                    // Image scanning
                    .route(
                        "/{id}/images/{tag}/scan",
                        web::get().to(handlers::container_registry::get_image_scan_results),
                    )
                    .route(
                        "/{id}/images/{tag}/scan",
                        web::post().to(handlers::container_registry::start_image_scan),
                    ),
            )
            // Autoscaling routes
            .service(
                web::scope("/api/v1/cloud/{provider}/autoscaling")
                    .route(
                        "/groups",
                        web::get().to(handlers::autoscaling::list_groups),
                    )
                    .route(
                        "/groups",
                        web::post().to(handlers::autoscaling::create_group),
                    )
                    .route(
                        "/groups/{id}",
                        web::get().to(handlers::autoscaling::get_group),
                    )
                    .route(
                        "/groups/{id}",
                        web::delete().to(handlers::autoscaling::delete_group),
                    )
                    .route(
                        "/groups/{id}/capacity",
                        web::post().to(handlers::autoscaling::set_capacity),
                    ),
            )
            // WAF routes
            .service(
                web::scope("/api/v1/cloud/{provider}/waf")
                    .route("/acls", web::get().to(handlers::waf::list_web_acls))
                    .route("/acls", web::post().to(handlers::waf::create_web_acl))
                    .route("/acls/{id}", web::get().to(handlers::waf::get_web_acl))
                    .route(
                        "/acls/{id}",
                        web::delete().to(handlers::waf::delete_web_acl),
                    )
                    .route(
                        "/acls/{id}/rules",
                        web::get().to(handlers::waf::list_rules),
                    ),
            )
            // KMS routes
            .service(
                web::scope("/api/v1/cloud/{provider}/kms")
                    .route("/keys", web::get().to(handlers::kms::list_keys))
                    .route("/keys", web::post().to(handlers::kms::create_key))
                    .route("/keys/{id}", web::get().to(handlers::kms::get_key))
                    .route(
                        "/keys/{id}",
                        web::delete().to(handlers::kms::schedule_deletion),
                    )
                    .route(
                        "/keys/{id}/enabled",
                        web::post().to(handlers::kms::set_enabled),
                    ),
            )
            // IAM routes
            .service(
                web::scope("/api/v1/cloud/{provider}/iam")
                    .route("/users", web::get().to(handlers::iam::list_users))
                    .route("/users", web::post().to(handlers::iam::create_user))
                    .route(
                        "/users/{name}",
                        web::delete().to(handlers::iam::delete_user),
                    )
                    .route("/roles", web::get().to(handlers::iam::list_roles))
                    .route("/roles", web::post().to(handlers::iam::create_role))
                    .route(
                        "/roles/{name}",
                        web::delete().to(handlers::iam::delete_role),
                    )
                    .route("/policies", web::get().to(handlers::iam::list_policies))
                    .route(
                        "/attach-policy",
                        web::post().to(handlers::iam::attach_policy),
                    )
                    .route(
                        "/detach-policy",
                        web::post().to(handlers::iam::detach_policy),
                    ),
            )
            // DNS routes
            .service(
                web::scope("/api/v1/cloud/{provider}/dns")
                    .route("/zones", web::get().to(handlers::dns::list_zones))
                    .route(
                        "/zones/{zone_id}/records",
                        web::get().to(handlers::dns::list_records),
                    )
                    .route(
                        "/zones/{zone_id}/records",
                        web::post().to(handlers::dns::create_record),
                    )
                    .route(
                        "/zones/{zone_id}/records",
                        web::delete().to(handlers::dns::delete_record),
                    ),
            )
            // Volume routes
            .service(
                web::scope("/api/v1/cloud/{provider}/volumes")
                    .route("", web::get().to(handlers::volume::list_volumes))
                    .route("", web::post().to(handlers::volume::create_volume))
                    .route("/{id}", web::delete().to(handlers::volume::delete_volume))
                    .route(
                        "/{id}/attach",
                        web::post().to(handlers::volume::attach_volume),
                    )
                    .route(
                        "/{id}/detach",
                        web::post().to(handlers::volume::detach_volume),
                    )
                    .route(
                        "/{id}/snapshot",
                        web::post().to(handlers::volume::create_snapshot),
                    ),
            )
            // API Gateway routes
            .service(
                web::scope("/api/v1/cloud/{provider}/api-gateway")
                    .route("/apis", web::get().to(handlers::api_gateway::list_apis))
                    .route("/apis", web::post().to(handlers::api_gateway::create_api))
                    .route("/apis/{id}", web::get().to(handlers::api_gateway::get_api))
                    .route(
                        "/apis/{id}",
                        web::delete().to(handlers::api_gateway::delete_api),
                    )
                    .route(
                        "/apis/{id}/routes",
                        web::get().to(handlers::api_gateway::list_routes),
                    )
                    .route(
                        "/apis/{id}/routes",
                        web::post().to(handlers::api_gateway::create_route),
                    )
                    .route(
                        "/apis/{id}/stages",
                        web::get().to(handlers::api_gateway::list_stages),
                    )
                    .route(
                        "/apis/{id}/stages",
                        web::post().to(handlers::api_gateway::create_stage),
                    ),
            )
            // CDN / CloudFront routes
            .service(
                web::scope("/api/v1/cloud/{provider}/cdn")
                    .route(
                        "/distributions",
                        web::get().to(handlers::cdn::list_distributions),
                    )
                    .route(
                        "/distributions",
                        web::post().to(handlers::cdn::create_distribution),
                    )
                    .route(
                        "/distributions/{id}",
                        web::get().to(handlers::cdn::get_distribution),
                    )
                    .route(
                        "/distributions/{id}",
                        web::delete().to(handlers::cdn::delete_distribution),
                    )
                    .route(
                        "/distributions/{id}/invalidate",
                        web::post().to(handlers::cdn::invalidate_cache),
                    ),
            )
            // Serverless routes
            .service(
                web::scope("/api/v1/cloud/{provider}/serverless")
                    .route(
                        "/functions",
                        web::get().to(handlers::serverless::list_functions),
                    )
                    .route(
                        "/functions",
                        web::post().to(handlers::serverless::create_function),
                    )
                    .route(
                        "/functions/{name}",
                        web::get().to(handlers::serverless::get_function),
                    )
                    .route(
                        "/functions/{name}",
                        web::delete().to(handlers::serverless::delete_function),
                    )
                    .route(
                        "/functions/{name}/invoke",
                        web::post().to(handlers::serverless::invoke_function),
                    )
                    .route(
                        "/functions/{name}/code",
                        web::put().to(handlers::serverless::update_code),
                    )
                    .route(
                        "/functions/{name}/versions",
                        web::get().to(handlers::serverless::list_versions),
                    ),
            )
            // Traffic / Flow Log routes
            .service(
                web::scope("/api/v1/cloud/{provider}/traffic")
                    .route(
                        "/flow-logs",
                        web::get().to(handlers::traffic::list_flow_logs),
                    )
                    .route(
                        "/summary",
                        web::get().to(handlers::traffic::get_traffic_summary),
                    ),
            )
            // Terraform routes
            .service(
                web::scope("/api/v1/cloud/terraform")
                    .route("/validate", web::post().to(handlers::terraform::validate))
                    .route("/plan", web::post().to(handlers::terraform::plan))
                    .route("/apply", web::post().to(handlers::terraform::apply)),
            )
            // DevOps routes
            .service(
                web::scope("/api/v1/cloud/devops")
                    .route("/overview", web::get().to(handlers::devops::overview))
                    .route("/pipelines", web::get().to(handlers::devops::list_pipelines))
                    .route("/pipelines/{id}", web::get().to(handlers::devops::get_pipeline))
                    .route("/pipelines/{id}/run", web::post().to(handlers::devops::trigger_pipeline))
                    .route("/deployments", web::get().to(handlers::devops::list_deployments))
                    .route("/deployments", web::post().to(handlers::devops::create_deployment))
                    .route("/gitops", web::get().to(handlers::devops::list_gitops))
                    .route("/iac", web::get().to(handlers::devops::list_iac_workspaces))
                    .route("/iac/{id}", web::get().to(handlers::devops::get_iac_workspace))
                    .route("/config", web::get().to(handlers::devops::list_config))
                    .route("/config", web::post().to(handlers::devops::create_config))
                    .route("/runbooks", web::get().to(handlers::devops::list_runbooks))
                    .route("/runbooks", web::post().to(handlers::devops::create_runbook))
                    .route("/runbooks/{id}/execute", web::post().to(handlers::devops::execute_runbook))
                    .route("/maintenance-windows", web::get().to(handlers::devops::list_maintenance_windows))
                    .route("/maintenance-windows", web::post().to(handlers::devops::create_maintenance_window)),
            )
            // Kubernetes routes
            .service(
                web::scope("/api/v1/cloud/{provider}/kubernetes")
                    .route(
                        "/clusters",
                        web::get().to(handlers::kubernetes::list_clusters),
                    )
                    .route(
                        "/clusters",
                        web::post().to(handlers::kubernetes::create_cluster),
                    )
                    .route(
                        "/clusters/{id}",
                        web::get().to(handlers::kubernetes::get_cluster),
                    )
                    .route(
                        "/clusters/{id}",
                        web::delete().to(handlers::kubernetes::delete_cluster),
                    )
                    .route(
                        "/clusters/{id}/node-groups",
                        web::get().to(handlers::kubernetes::list_node_groups),
                    )
                    .route(
                        "/clusters/{id}/node-groups",
                        web::post().to(handlers::kubernetes::create_node_group),
                    )
                    .route(
                        "/clusters/{cluster}/node-groups/{name}",
                        web::delete().to(handlers::kubernetes::delete_node_group),
                    )
                    .route(
                        "/clusters/{cluster}/node-groups/{name}/scale",
                        web::post().to(handlers::kubernetes::scale_node_group),
                    ),
            )
            // Chaos Engineering routes
            .service(
                web::scope("/api/v1/cloud/{provider}/chaos")
                    .route(
                        "/experiments/{id}/run",
                        web::post().to(handlers::chaos::run_experiment),
                    ),
            )
            // IoT routes
            .service(
                web::scope("/api/v1/cloud/{provider}/iot")
                    .route("/things", web::get().to(handlers::iot::list_things))
                    .route("/things", web::post().to(handlers::iot::create_thing))
                    .route(
                        "/things/{name}",
                        web::get().to(handlers::iot::get_thing),
                    )
                    .route(
                        "/things/{name}",
                        web::delete().to(handlers::iot::delete_thing),
                    )
                    .route(
                        "/thing-groups",
                        web::get().to(handlers::iot::list_thing_groups),
                    )
                    .route("/edge", web::get().to(handlers::iot::list_edge_devices))
                    .route("/rules", web::get().to(handlers::iot::list_rules))
                    .route("/twins", web::get().to(handlers::iot::list_twins)),
            )
            // ML / SageMaker routes
            .service(
                web::scope("/api/v1/cloud/{provider}/ml")
                    .route("/models", web::get().to(handlers::ml::list_models))
                    .route(
                        "/endpoints",
                        web::get().to(handlers::ml::list_endpoints),
                    )
                    .route(
                        "/endpoints",
                        web::post().to(handlers::ml::create_endpoint),
                    )
                    .route(
                        "/endpoints/{name}",
                        web::delete().to(handlers::ml::delete_endpoint),
                    )
                    .route(
                        "/training-jobs",
                        web::get().to(handlers::ml::list_training_jobs),
                    ),
            )
            // NoSQL (DynamoDB / Firestore / CosmosDB) routes
            .service(
                web::scope("/api/v1/cloud/{provider}/nosql")
                    .route(
                        "/tables",
                        web::get().to(handlers::nosql::list_tables),
                    )
                    .route(
                        "/tables",
                        web::post().to(handlers::nosql::create_table),
                    )
                    .route(
                        "/tables/{name}",
                        web::get().to(handlers::nosql::get_table),
                    )
                    .route(
                        "/tables/{name}",
                        web::delete().to(handlers::nosql::delete_table),
                    )
                    .route(
                        "/tables/{name}/describe",
                        web::get().to(handlers::nosql::describe_table),
                    ),
            )
            // Cache (ElastiCache / Memorystore / Azure Cache) routes
            .service(
                web::scope("/api/v1/cloud/{provider}/cache")
                    .route(
                        "/clusters",
                        web::get().to(handlers::cache_db::list_clusters),
                    )
                    .route(
                        "/clusters",
                        web::post().to(handlers::cache_db::create_cluster),
                    )
                    .route(
                        "/clusters/{id}",
                        web::get().to(handlers::cache_db::get_cluster),
                    )
                    .route(
                        "/clusters/{id}",
                        web::delete().to(handlers::cache_db::delete_cluster),
                    ),
            )
            // Workflows (Step Functions / Logic Apps / GCP Workflows) routes
            .service(
                web::scope("/api/v1/cloud/{provider}/workflows")
                    .route(
                        "/state-machines",
                        web::get().to(handlers::workflows::list_state_machines),
                    )
                    .route(
                        "/state-machines/{id}",
                        web::get().to(handlers::workflows::get_state_machine),
                    )
                    .route(
                        "/state-machines/{id}/executions",
                        web::post().to(handlers::workflows::start_execution),
                    )
                    .route(
                        "/state-machines/{id}/executions",
                        web::get().to(handlers::workflows::list_executions),
                    ),
            )
            // Drift Detection routes (SurrealDB-backed)
            .service(
                web::scope("/api/v1/cloud/drift")
                    .route("/resources", web::get().to(handlers::drift::list_drift_resources))
                    .route("/resources/{id}", web::get().to(handlers::drift::get_drift_resource))
                    .route("/scan", web::post().to(handlers::drift::trigger_drift_scan))
                    .route("/resources/{id}/accept", web::post().to(handlers::drift::accept_drift))
                    .route("/resources/{id}/remediate", web::post().to(handlers::drift::remediate_drift)),
            )
            // Infrastructure Design routes (SurrealDB-backed)
            .service(
                web::scope("/api/v1/cloud/designs")
                    .route("", web::get().to(handlers::designs::list_designs))
                    .route("", web::post().to(handlers::designs::create_design))
                    .route("/service-catalog", web::get().to(handlers::designs::get_service_catalog))
                    .route("/{id}", web::get().to(handlers::designs::get_design))
                    .route("/{id}", web::put().to(handlers::designs::update_design))
                    .route("/{id}", web::delete().to(handlers::designs::delete_design)),
            )
            // Cloud Connections routes (SurrealDB-backed)
            .service(
                web::scope("/api/v1/cloud/connections")
                    .route("", web::get().to(handlers::connections::list_connections))
                    .route("/{provider}/connect", web::post().to(handlers::connections::connect_provider))
                    .route("/{provider}/disconnect", web::post().to(handlers::connections::disconnect_provider))
                    .route("/{provider}/services", web::get().to(handlers::connections::list_provider_services))
                    .route("/{provider}/sync", web::post().to(handlers::connections::sync_provider)),
            )
    })
    .bind(&bind_addr)?
    .run()
    .await
}

async fn health_check() -> actix_web::HttpResponse {
    actix_web::HttpResponse::Ok().json(serde_json::json!({
        "status": "healthy",
        "service": "cloud-service",
        "version": env!("CARGO_PKG_VERSION"),
    }))
}
