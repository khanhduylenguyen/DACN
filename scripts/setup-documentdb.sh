#!/bin/bash
# ============================================
# Medi Path Ease - DocumentDB Setup Script
# ============================================
# Chạy trên macOS/Linux terminal hoặc Git Bash (Windows)
# Usage: ./setup-documentdb.sh

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# ============================================
# CONFIG
# ============================================
AWS_REGION="ap-southeast-1"
CLUSTER_ID="medi-path-docdb"
INSTANCE_CLASS="db.t3.medium"
MASTER_USERNAME="mediadmin"
MASTER_PASSWORD="ChangeMe123!"  # THAY ĐỔI PASSWORD NÀY!
VPC_CIDR="10.0.0.0/16"
DB_NAME="medi-path-ease"

# ============================================
# FUNCTIONS
# ============================================
log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }

# ============================================
# CHECK PREREQUISITES
# ============================================
check_aws_cli() {
    log_info "Kiểm tra AWS CLI..."
    if ! command -v aws &> /dev/null; then
        log_error "AWS CLI chưa được cài đặt"
    fi
    aws --version
    log_success "AWS CLI đã sẵn sàng"
}

# ============================================
# CREATE VPC
# ============================================
create_vpc() {
    log_info "Tạo VPC cho DocumentDB..."
    
    # Kiểm tra VPC đã tồn tại chưa
    VPC_ID=$(aws ec2 describe-vpcs \
        --filters "Name=tag:Name,Values=medi-path-vpc" \
        --query 'Vpcs[0].VpcId' \
        --output text 2>/dev/null)
    
    if [ -z "$VPC_ID" ] || [ "$VPC_ID" = "None" ]; then
        VPC_ID=$(aws ec2 create-vpc \
            --cidr-block "$VPC_CIDR" \
            --query 'Vpc.VpcId' \
            --output text)
        
        # Enable DNS hostname
        aws ec2 modify-vpc-attribute \
            --vpc-id "$VPC_ID" \
            --enable-dns-hostnames "{\"Value\":true}"
        
        # Tag
        aws ec2 create-tags \
            --resources "$VPC_ID" \
            --tags "Key=Name,Value=medi-path-vpc"
        
        log_success "Đã tạo VPC: $VPC_ID"
    else
        log_success "Sử dụng VPC: $VPC_ID"
    fi
    
    echo "$VPC_ID"
}

# ============================================
# CREATE SUBNETS
# ============================================
create_subnets() {
    local vpc_id=$1
    log_info "Tạo Subnets..."
    
    # Kiểm tra subnet đã tồn tại chưa
    SUBNET_ID_1=$(aws ec2 describe-subnets \
        --filters "Name=vpc-id,Values=$vpc_id" "Name=availability-zone,Values=${AWS_REGION}a" \
        --query 'Subnets[0].SubnetId' \
        --output text 2>/dev/null)
    
    if [ -z "$SUBNET_ID_1" ] || [ "$SUBNET_ID_1" = "None" ]; then
        # Tạo 3 subnets trong 3 AZ
        SUBNET_ID_1=$(aws ec2 create-subnet \
            --vpc-id "$vpc_id" \
            --cidr-block 10.0.1.0/24 \
            --availability-zone "${AWS_REGION}a" \
            --query 'Subnet.SubnetId' \
            --output text)
        
        SUBNET_ID_2=$(aws ec2 create-subnet \
            --vpc-id "$vpc_id" \
            --cidr-block 10.0.2.0/24 \
            --availability-zone "${AWS_REGION}b" \
            --query 'Subnet.SubnetId' \
            --output text)
        
        SUBNET_ID_3=$(aws ec2 create-subnet \
            --vpc-id "$vpc_id" \
            --cidr-block 10.0.3.0/24 \
            --availability-zone "${AWS_REGION}c" \
            --query 'Subnet.SubnetId' \
            --output text)
        
        # Enable auto-assign public IP
        aws ec2 modify-subnet-attribute \
            --subnet-id "$SUBNET_ID_1" \
            --map-public-ip-on-launch
            
        # Tags
        aws ec2 create-tags --resources "$SUBNET_ID_1" "$SUBNET_ID_2" "$SUBNET_ID_3" \
            --tags "Key=Name,Value=medi-path-docdb-subnet"
        
        log_success "Đã tạo 3 Subnets"
    else
        SUBNET_ID_2=$(aws ec2 describe-subnets \
            --filters "Name=vpc-id,Values=$vpc_id" "Name=availability-zone,Values=${AWS_REGION}b" \
            --query 'Subnets[0].SubnetId' \
            --output text)
        SUBNET_ID_3=$(aws ec2 describe-subnets \
            --filters "Name=vpc-id,Values=$vpc_id" "Name=availability-zone,Values=${AWS_REGION}c" \
            --query 'Subnets[0].SubnetId' \
            --output text)
        log_success "Sử dụng Subnets hiện có"
    fi
    
    echo "${SUBNET_ID_1},${SUBNET_ID_2},${SUBNET_ID_3}"
}

# ============================================
# CREATE SECURITY GROUP
# ============================================
create_security_group() {
    local vpc_id=$1
    log_info "Tạo Security Group cho DocumentDB..."
    
    SG_NAME="medi-path-docdb-sg"
    SG_ID=$(aws ec2 describe-security-groups \
        --filters "Name=group-name,Values=$SG_NAME" \
        --query 'SecurityGroups[0].GroupId' \
        --output text 2>/dev/null)
    
    if [ -z "$SG_ID" ] || [ "$SG_ID" = "None" ]; then
        SG_ID=$(aws ec2 create-security-group \
            --group-name "$SG_NAME" \
            --description "Security group for Medi Path Ease DocumentDB" \
            --vpc-id "$vpc_id" \
            --query 'GroupId' \
            --output text)
        
        # Tag
        aws ec2 create-tags --resources "$SG_ID" \
            --tags "Key=Name,Value=$SG_NAME"
        
        log_success "Đã tạo Security Group: $SG_ID"
    else
        log_success "Sử dụng Security Group: $SG_ID"
    fi
    
    echo "$SG_ID"
}

# ============================================
# CREATE SUBNET GROUP
# ============================================
create_subnet_group() {
    local subnet_ids=$1
    log_info "Tạo DB Subnet Group..."
    
    SUBNET_GROUP_NAME="medi-path-docdb-subnet-group"
    
    # Tách subnet IDs
    IFS=',' read -ra SUBNETS <<< "$subnet_ids"
    
    # Kiểm tra subnet group đã tồn tại chưa
    if aws docdb describe-db-subnet-groups --db-subnet-group-name "$SUBNET_GROUP_NAME" &> /dev/null; then
        log_success "Subnet Group đã tồn tại"
    else
        aws docdb create-db-subnet-group \
            --db-subnet-group-name "$SUBNET_GROUP_NAME" \
            --db-subnet-group-description "Subnet group for Medi Path DocumentDB" \
            --subnet-ids "${SUBNETS[@]}" \
            --tags "Key=Name,Value=$SUBNET_GROUP_NAME"
        
        log_success "Đã tạo Subnet Group"
    fi
    
    echo "$SUBNET_GROUP_NAME"
}

# ============================================
# CREATE DOCUMENTDB CLUSTER
# ============================================
create_documentdb() {
    local sg_id=$1
    local subnet_group=$2
    local vpc_id=$3
    
    log_info "Tạo DocumentDB Cluster..."
    
    # Kiểm tra cluster đã tồn tại chưa
    if aws docdb describe-db-clusters --db-cluster-identifier "$CLUSTER_ID" &> /dev/null; then
        log_info "DocumentDB Cluster đã tồn tại"
        CLUSTER_ENDPOINT=$(aws docdb describe-db-clusters \
            --db-cluster-identifier "$CLUSTER_ID" \
            --query 'DBClusters[0].Endpoint' \
            --output text)
        log_success "Cluster Endpoint: $CLUSTER_ENDPOINT"
        return
    fi
    
    # Tạo cluster với serverless (tiết kiệm chi phí)
    aws docdb create-db-cluster \
        --db-cluster-identifier "$CLUSTER_ID" \
        --engine docdb \
        --engine-version 5.0.0 \
        --serverless-2-0-configuration '{
            "minCapacity": 0.5,
            "maxCapacity": 16,
            "timeoutAction": "RollbackTimeoutChange"
        }' \
        --master-username "$MASTER_USERNAME" \
        --master-user-password "$MASTER_PASSWORD" \
        --vpc-security-group-ids "$sg_id" \
        --db-subnet-group-name "$subnet_group" \
        --backup-retention-period 7 \
        --storage-encrypted \
        --tags "Key=Name,Value=$CLUSTER_ID"
    
    # Tạo instance
    INSTANCE_ID="${CLUSTER_ID}-instance"
    aws docdb create-db-instance \
        --db-instance-identifier "$INSTANCE_ID" \
        --db-cluster-identifier "$CLUSTER_ID" \
        --db-instance-class "$INSTANCE_CLASS" \
        --engine docdb \
        --tags "Key=Name,Value=$INSTANCE_ID"
    
    log_info "Đợi DocumentDB khởi tạo (3-5 phút)..."
    aws docdb wait db-cluster-available --db-cluster-identifier "$CLUSTER_ID"
    
    # Lấy endpoint
    CLUSTER_ENDPOINT=$(aws docdb describe-db-clusters \
        --db-cluster-identifier "$CLUSTER_ID" \
        --query 'DBClusters[0].Endpoint' \
        --output text)
    
    log_success "DocumentDB Cluster đã được tạo!"
    log_success "Cluster Endpoint: $CLUSTER_ENDPOINT"
}

# ============================================
# UPDATE SECURITY GROUP (Allow access from EC2)
# ============================================
update_security_group() {
    local sg_id=$1
    log_info "Cập nhật Security Group..."
    
    # Get EC2 security group (default)
    EC2_SG=$(aws ec2 describe-security-groups \
        --filters "Name=group-name,Values=default" "Name=vpc-id,Values=$(aws ec2 describe-vpcs --filters 'Name=tag:Name,Values=medi-path-vpc' --query 'Vpcs[0].VpcId' --output text)" \
        --query 'SecurityGroups[0].GroupId' \
        --output text 2>/dev/null)
    
    if [ -n "$EC2_SG" ] && [ "$EC2_SG" != "None" ]; then
        aws ec2 authorize-security-group-ingress \
            --group-id "$sg_id" \
            --protocol tcp \
            --port 27017 \
            --source-group "$EC2_SG" \
            2>/dev/null && log_info "Đã cho phép truy cập từ EC2 SG" || log_info "Rule đã tồn tại"
    fi
}

# ============================================
# STORE SECRETS
# ============================================
store_secrets() {
    local cluster_endpoint=$1
    log_info "Lưu secrets vào Secrets Manager..."
    
    SECRET_NAME="medi-path/docdb-credentials"
    
    # Kiểm tra secret đã tồn tại chưa
    if aws secretsmanager describe-secret --secret-id "$SECRET_NAME" &> /dev/null; then
        log_info "Secret đã tồn tại, cập nhật..."
        aws secretsmanager put-secret-value \
            --secret-id "$SECRET_NAME" \
            --secret-string "{\"username\":\"$MASTER_USERNAME\",\"password\":\"$MASTER_PASSWORD\",\"endpoint\":\"$cluster_endpoint\"}"
    else
        aws secretsmanager create-secret \
            --name "$SECRET_NAME" \
            --secret-string "{\"username\":\"$MASTER_USERNAME\",\"password\":\"$MASTER_PASSWORD\",\"endpoint\":\"$cluster_endpoint\"}" \
            --tags "Key=Name,Value=medi-path-docdb"
    fi
    
    log_success "Secrets đã được lưu"
}

# ============================================
# TEST CONNECTION
# ============================================
test_connection() {
    local endpoint=$1
    log_info "Kiểm tra kết nối DocumentDB..."
    
    # Test bằng cách check cluster status
    CLUSTER_STATUS=$(aws docdb describe-db-clusters \
        --db-cluster-identifier "$CLUSTER_ID" \
        --query 'DBClusters[0].Status' \
        --output text)
    
    log_success "Cluster Status: $CLUSTER_STATUS"
}

# ============================================
# PRINT SUMMARY
# ============================================
print_summary() {
    local cluster_endpoint=$1
    
    echo ""
    echo "============================================"
    echo -e "${GREEN}DOCUMENTDB SETUP HOÀN TẤT!${NC}"
    echo "============================================"
    echo ""
    echo -e "${BLUE}Thông tin kết nối:${NC}"
    echo "  - Cluster ID: $CLUSTER_ID"
    echo "  - Endpoint: $cluster_endpoint"
    echo "  - Port: 27017"
    echo "  - Database: $DB_NAME"
    echo "  - Username: $MASTER_USERNAME"
    echo "  - Password: $MASTER_PASSWORD"
    echo ""
    echo -e "${BLUE}Connection String:${NC}"
    echo "  mongodb://$MASTER_USERNAME:$MASTER_PASSWORD@$cluster_endpoint:27017/$DB_NAME?replicaSet=rs0&readPreference=secondaryPreferred&retryWrites=false"
    echo ""
    echo -e "${YELLOW}Lưu ý:${NC}"
    echo "  1. Cập nhật MONGODB_URI trong backend/.env"
    echo "  2. Đợi 3-5 phút để DocumentDB khởi tạo hoàn tất"
    echo "  3. Chi phí serverless: pay-per-use (~0.01/RCU, ~0.12/ACU-hour)"
    echo ""
    echo "============================================"
}

# ============================================
# MAIN
# ============================================
main() {
    echo ""
    echo "============================================"
    echo "  Medi Path Ease - DocumentDB Setup"
    echo "============================================"
    echo ""
    
    check_aws_cli
    
    VPC_ID=$(create_vpc)
    SUBNET_IDS=$(create_subnets "$VPC_ID")
    SG_ID=$(create_security_group "$VPC_ID")
    SUBNET_GROUP=$(create_subnet_group "$SUBNET_IDS")
    create_documentdb "$SG_ID" "$SUBNET_GROUP" "$VPC_ID"
    
    # Lấy lại endpoint sau khi tạo
    CLUSTER_ENDPOINT=$(aws docdb describe-db-clusters \
        --db-cluster-identifier "$CLUSTER_ID" \
        --query 'DBClusters[0].Endpoint' \
        --output text)
    
    update_security_group "$SG_ID"
    store_secrets "$CLUSTER_ENDPOINT"
    test_connection "$CLUSTER_ENDPOINT"
    print_summary "$CLUSTER_ENDPOINT"
}

main "$@"
