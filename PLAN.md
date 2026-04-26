# Cross-Cloud Wiring Execution Plan

Sequential tasks. Each must compile (`cargo check`) before moving to next.

---

## Task 1: Wire serverless.rs handler to existing factory [C8]
- **File**: `services/cloud-service/src/handlers/serverless.rs`
- **Action**: Replace one-liner stubs with calls to `providers::get_serverless_provider()`
- **Pattern**: Copy from compute.rs handler style
- **Factory**: `get_serverless_provider()` already exists with full 3-cloud routing
- **Status**: [x] DONE

## Task 2: Wire kubernetes.rs handler to existing factory [C9]
- **File**: `services/cloud-service/src/handlers/kubernetes.rs`
- **Action**: Replace one-liner stubs with calls to `providers::get_kubernetes_provider()`
- **Factory**: `get_kubernetes_provider()` already exists (mock-only, but wiring is correct)
- **Status**: [x] DONE

## Task 3: Create 7 missing factory functions [C10]
- **File**: `services/cloud-service/src/providers/mod.rs`
- **Action**: Add factory functions for IAM, DNS, WAF, Messaging, KMS, AutoScaling, Volume
- **Constraint**: Mock providers (AwsProvider, GcpProvider, AzureProvider) do NOT implement these 7 traits. GCP/Azure SDK providers DO. AWS SDK does NOT.
- **Strategy**: Create factories that route GCP→GcpSdkProvider, Azure→AzureSdkProvider when SDK mode. For AWS and for mock fallback, need to add mock impls to the 3 mock providers first.
- **Sub-tasks**:
  - 3a. Add 7 trait impls to AwsProvider (mock) in aws.rs
  - 3b. Add 7 trait impls to GcpProvider (mock) in gcp.rs
  - 3c. Add 7 trait impls to AzureProvider (mock) in azure.rs
  - 3d. Add 7 factory functions to mod.rs with full 3-cloud routing
- **Status**: [x] DONE

## Task 4: Wire 7 remaining stub handlers [C1-C7]
- **Files**: iam.rs, dns.rs, waf.rs, messaging.rs, kms.rs, autoscaling.rs, volume.rs
- **Action**: Replace `vec![]` stubs with calls to new factory functions from Task 3
- **Depends on**: Task 3
- **Status**: [x] DONE

## Task 5: Add GCP/Azure SDK routing to 6 AWS-only factories [C11]
- **File**: `services/cloud-service/src/providers/mod.rs`
- **Action**: Change `if provider == CloudProvider::Aws` to full match for api_gateway, cdn, nosql, cache_db, container_registry, workflow factories
- **Status**: [x] DONE

## Task 6: Enable SDK routing in 4 mock-only factories [C12]
- **File**: `services/cloud-service/src/providers/mod.rs`
- **Action**: Add `use_real_sdk()` check to traffic, kubernetes, iot, ml factories
- **Status**: [x] DONE

## Task 7: Validate — cargo check + cargo test
- **Action**: Full build and test suite pass
- **Result**: `cargo check` — 0 errors. `cargo test` — 27 passed, 3 failed (pre-existing cost-service budget tests, tracked as H15).
- **Status**: [x] DONE

---

## Task 8: Implement 9 missing AWS SDK trait implementations [H4]
- **File**: `services/cloud-service/src/providers/aws_sdk.rs`
- **Action**: Add 9 trait impls (51 methods) for IAM, DNS, WAF, Messaging, KMS, AutoScaling, Volume, ML, IoT using real AWS SDK crates (all already in Cargo.toml)
- **Details**:
  - Added 9 client helper methods (iam_client, route53_client, wafv2_client, sqs_client, sns_client, kms_real_client, autoscaling_client, iot_client, sagemaker_client)
  - IAM → aws-sdk-iam (9 methods: users, roles, policies, attach/detach)
  - DNS → aws-sdk-route53 (4 methods: hosted zones, records, create/delete via ChangeBatch)
  - WAF → aws-sdk-wafv2 (5 methods: web ACLs with Regional scope, rules, create with VisibilityConfig)
  - Messaging → aws-sdk-sqs + aws-sdk-sns (7 methods: queues with FIFO support, topics)
  - KMS → aws-sdk-kms (5 methods: keys with describe, create with key spec, enable/disable, schedule deletion)
  - AutoScaling → aws-sdk-autoscaling (5 methods: groups, create, delete with force, set desired capacity)
  - Volume → aws-sdk-ec2 (6 methods: EBS volumes, attach/detach, snapshots)
  - ML → aws-sdk-sagemaker (5 methods: models, endpoints with config, training jobs)
  - IoT → aws-sdk-iot (5 methods: things with attributes, thing groups)
- **Also updated**: `services/cloud-service/src/providers/mod.rs` — all 9 factory functions now route AWS→AwsSdkProvider (+ IoT and ML factories updated too)
- **Result**: `cargo check` — 0 errors. `cargo test` — 27 passed, 3 pre-existing failures. AWS now implements all 22 traits, matching GCP/Azure parity.
- **Status**: [x] DONE

---

## Task 9: Implement GCP networking stubs (H1) — 21 methods
- **File**: `services/cloud-service/src/providers/gcp_sdk.rs` (lines 430-507 replaced)
- **Mapper file**: `services/cloud-service/src/providers/gcp_mapper.rs` (5 new mapper functions added)
- **Action**: Replaced 21 stub methods with real GCP REST API implementations
- **Details**:
  - **Elastic IPs → Compute Addresses** (5 methods): list/allocate/associate/disassociate/release regional static external IPs via `compute/v1/projects/{project}/regions/{region}/addresses`
  - **NAT Gateways → Cloud NAT** (3 methods): list/create/delete Cloud NAT configs within Cloud Routers via `compute/v1/projects/{project}/regions/{region}/routers`
  - **Internet Gateways → Default Routes** (5 methods): GCP has implicit internet via `default-internet-gateway`. List routes with nextHopGateway containing "default-internet-gateway". Create/delete are route operations. Attach/detach are no-ops (routes are VPC-level).
  - **Route Tables → VPC Routes** (6 methods): GCP has no route table entity. Routes are VPC-level at `compute/v1/projects/{project}/global/routes`. create_route_table creates a placeholder route. associate_route_table returns synthetic ID (routes auto-associate via network/tags).
  - **Security Group CRUD → Firewall Rules** (4 methods): create/add_rule/remove_rule/delete via `compute/v1/projects/{project}/global/firewalls`
  - **VPC Peering → Network Peering** (3 methods): list from networks' peerings array, create via `addPeering`, delete via `removePeering`. accept_vpc_peering is no-op (GCP auto-activates mutual peering).
- **New mapper functions**: `address_to_resource`, `cloud_nat_to_resource`, `route_to_resource`, `internet_gw_route_to_resource`, `network_peering_to_resource`
- **Status**: [x] DONE

## Task 10: Implement Azure networking stubs (H2) — 21 methods
- **File**: `services/cloud-service/src/providers/azure_sdk.rs` (lines 524-601 replaced)
- **Mapper file**: `services/cloud-service/src/providers/azure_mapper.rs` (4 new mapper functions added)
- **Action**: Replaced 21 stub methods with real Azure REST API implementations
- **Details**:
  - **Elastic IPs → Public IP Addresses** (5 methods): list/allocate/associate/disassociate/release via `Microsoft.Network/publicIPAddresses`. Associate updates VM's NIC ipConfiguration.
  - **NAT Gateways → Azure NAT Gateway** (3 methods): list/create/delete via `Microsoft.Network/natGateways` (first-class resource with Standard SKU)
  - **Internet Gateways → Route Tables with Internet next hop** (5 methods): Azure has no IGW. Maps to route tables containing `0.0.0.0/0 → Internet` routes. Attach/detach update subnet's routeTable property.
  - **Route Tables → Azure Route Tables** (6 methods): First-class resources via `Microsoft.Network/routeTables`. Routes are sub-resources. Associate updates subnet.
  - **Security Group CRUD → NSGs** (4 methods): create/add_rule/remove_rule/delete via `Microsoft.Network/networkSecurityGroups`. Rules are sub-resources with priority, direction, protocol.
  - **VPC Peering → VNet Peering** (4 methods): list by iterating VNets' peerings, create via `virtualNetworkPeerings` sub-resource. accept_vpc_peering is no-op (Azure auto-accepts mutual peering).
- **New mapper functions**: `public_ip_to_resource`, `nat_gateway_to_resource`, `route_table_to_resource`, `vnet_peering_to_resource`
- **Result**: `cargo check` — 0 errors. `cargo test` — 27 passed, 3 pre-existing failures. Same baseline.
- **Status**: [x] DONE
