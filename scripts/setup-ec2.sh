#!/bin/bash
# ============================================
# Medi Path Ease - EC2 Backend Setup Script
# ============================================
# Chạy trên macOS/Linux terminal hoặc Git Bash (Windows)
# Usage: ./setup-ec2.sh

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# ============================================
# CONFIG - CẬP NHẬT CÁC GIÁ TRỊ NÀY
# ============================================
AWS_REGION="ap-southeast-1"
INSTANCE_NAME="medi-path-backend"
INSTANCE_TYPE="t3.micro"
KEY_NAME="medi-path-key"  # Tên key pair - TẠO TRƯỚC TRONG AWS CONSOLE!
VPC_ID=""  # Sẽ tự động tìm hoặc tạo
SUBNET_ID=""  # Sẽ tự động tìm hoặc tạo
SECURITY_GROUP_NAME="medi-path-sg"
ALLOWED_IP="0.0.0.0/0"  # IP được phép truy cập (thay = IP của bạn để bảo mật hơn)

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
        log_error "AWS CLI chưa được cài đặt. Hướng dẫn: https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html"
    fi
    aws --version
    log_success "AWS CLI đã sẵn sàng"
}

check_ssh() {
    log_info "Kiểm tra SSH..."
    if ! command -v ssh &> /dev/null; then
        log_error "SSH chưa được cài đặt"
    fi
    log_success "SSH đã sẵn sàng"
}

# ============================================
# SETUP KEY PAIR
# ============================================
create_key_pair() {
    log_info "Kiểm tra Key Pair..."
    
    # Kiểm tra key đã tồn tại chưa
    if aws ec2 describe-key-pairs --key-names "$KEY_NAME" &> /dev/null; then
        log_info "Key Pair '$KEY_NAME' đã tồn tại"
    else
        log_info "Tạo Key Pair mới..."
        aws ec2 create-key-pair \
            --key-name "$KEY_NAME" \
            --key-format pem \
            --query 'KeyMaterial' \
            --output text > "${KEY_NAME}.pem"
        
        chmod 400 "${KEY_NAME}.pem"
        log_success "Đã tạo Key Pair và lưu vào ${KEY_NAME}.pem"
    fi
}

# ============================================
# SETUP VPC
# ============================================
setup_vpc() {
    log_info "Thiết lập VPC..."
    
    # Tìm VPC default
    VPC_ID=$(aws ec2 describe-vpcs \
        --filters "Name=is-default,Values=true" \
        --query 'Vpcs[0].VpcId' \
        --output text 2>/dev/null)
    
    if [ -z "$VPC_ID" ] || [ "$VPC_ID" = "None" ]; then
        log_info "Tạo VPC mới..."
        VPC_ID=$(aws ec2 create-vpc \
            --cidr-block 10.0.0.0/16 \
            --query 'Vpc.VpcId' \
            --output text)
        
        aws ec2 modify-vpc-attribute \
            --vpc-id "$VPC_ID" \
            --enable-dns-hostnames "{\"Value\":true}"
        
        log_success "Đã tạo VPC: $VPC_ID"
    else
        log_success "Sử dụng VPC: $VPC_ID"
    fi
    
    # Lấy subnet public đầu tiên
    SUBNET_ID=$(aws ec2 describe-subnets \
        --filters "Name=vpc-id,Values=$VPC_ID" "Name=tag:Name,Values=*public*" \
        --query 'Subnets[0].SubnetId' \
        --output text 2>/dev/null)
    
    if [ -z "$SUBNET_ID" ] || [ "$SUBNET_ID" = "None" ]; then
        SUBNET_ID=$(aws ec2 describe-subnets \
            --filters "Name=vpc-id,Values=$VPC_ID" \
            --query 'Subnets[0].SubnetId' \
            --output text)
    fi
    
    log_success "Sử dụng Subnet: $SUBNET_ID"
}

# ============================================
# SETUP SECURITY GROUP
# ============================================
create_security_group() {
    log_info "Thiết lập Security Group..."
    
    # Kiểm tra SG đã tồn tại chưa
    SG_ID=$(aws ec2 describe-security-groups \
        --filters "Name=group-name,Values=$SECURITY_GROUP_NAME" \
        --query 'SecurityGroups[0].GroupId' \
        --output text 2>/dev/null)
    
    if [ -z "$SG_ID" ] || [ "$SG_ID" = "None" ]; then
        log_info "Tạo Security Group mới..."
        SG_ID=$(aws ec2 create-security-group \
            --group-name "$SECURITY_GROUP_NAME" \
            --description "Security group for Medi Path Ease backend" \
            --vpc-id "$VPC_ID" \
            --query 'GroupId' \
            --output text)
        
        # SSH
        aws ec2 authorize-security-group-ingress \
            --group-id "$SG_ID" \
            --protocol tcp \
            --port 22 \
            --cidr "$ALLOWED_IP" \
            2>/dev/null || true
        
        # HTTP
        aws ec2 authorize-security-group-ingress \
            --group-id "$SG_ID" \
            --protocol tcp \
            --port 80 \
            --cidr 0.0.0.0/0
        
        # HTTPS
        aws ec2 authorize-security-group-ingress \
            --group-id "$SG_ID" \
            --protocol tcp \
            --port 443 \
            --cidr 0.0.0.0/0
        
        # Custom port 3001 (Backend API)
        aws ec2 authorize-security-group-ingress \
            --group-id "$SG_ID" \
            --protocol tcp \
            --port 3001 \
            --cidr 0.0.0.0/0
        
        # All outbound
        aws ec2 authorize-security-group-egress \
            --group-id "$SG_ID" \
            --protocol all \
            --cidr 0.0.0.0/0
        
        log_success "Đã tạo Security Group: $SG_ID"
    else
        log_success "Sử dụng Security Group: $SG_ID"
    fi
}

# ============================================
# CREATE EC2 INSTANCE
# ============================================
create_instance() {
    log_info "Tạo EC2 Instance..."
    
    # Kiểm tra instance đã tồn tại chưa
    INSTANCE_ID=$(aws ec2 describe-instances \
        --filters "Name=tag:Name,Values=$INSTANCE_NAME" "Name=instance-state-name,Values=running,stopped" \
        --query 'Reservations[0].Instances[0].InstanceId' \
        --output text 2>/dev/null)
    
    if [ -z "$INSTANCE_ID" ] || [ "$INSTANCE_ID" = "None" ]; then
        # Lấy Amazon Linux 2 AMI
        AMI_ID=$(aws ec2 describe-images \
            --filters "Name=name,Values=amzn2-ami-hvm-*-x86_64-gp2" \
            --query 'sort_by(Images,&CreationDate)[-1].ImageId' \
            --output text)
        
        log_info "Sử dụng AMI: $AMI_ID"
        
        # Tạo instance
        INSTANCE_ID=$(aws ec2 run-instances \
            --image-id "$AMI_ID" \
            --instance-type "$INSTANCE_TYPE" \
            --key-name "$KEY_NAME" \
            --security-group-ids "$SG_ID" \
            --subnet-id "$SUBNET_ID" \
            --enable-api-stop \
            --tag-specifications "ResourceType=instance,Tags=[{Key=Name,Value=$INSTANCE_NAME}]" \
            --query 'Instances[0].InstanceId' \
            --output text)
        
        # Đợi instance chạy
        log_info "Đợi instance khởi động..."
        aws ec2 wait instance-running --instance-ids "$INSTANCE_ID"
        
        log_success "Đã tạo Instance: $INSTANCE_ID"
    else
        log_info "Instance đã tồn tại: $INSTANCE_ID"
    fi
    
    # Lấy public IP
    PUBLIC_IP=$(aws ec2 describe-instances \
        --instance-ids "$INSTANCE_ID" \
        --query 'Reservations[0].Instances[0].PublicIpAddress' \
        --output text)
    
    log_success "Public IP: $PUBLIC_IP"
}

# ============================================
# CONFIGURE INSTANCE (SSH)
# ============================================
configure_instance() {
    log_info "Cấu hình instance qua SSH..."
    
    # Đợi SSH sẵn sàng
    log_info "Đợi SSH service..."
    sleep 10
    
    # Tạo script cấu hình
    CONFIG_SCRIPT='
        set -e
        
        # Update system
        echo "=== Updating system ==="
        sudo yum update -y
        
        # Install Node.js 20
        echo "=== Installing Node.js 20 ==="
        curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
        sudo yum install -y nodejs
        
        # Install PM2
        echo "=== Installing PM2 ==="
        sudo npm install -g pm2
        
        # Create app directory
        echo "=== Setting up app directory ==="
        sudo mkdir -p /var/www/medi-path
        sudo chown ec2-user:ec2-user /var/www/medi-path
        
        # Install Git
        sudo yum install -y git
        
        echo "=== Setup complete ==="
        node --version
        npm --version
        pm2 --version
    '
    
    # Chạy config script
    echo "$CONFIG_SCRIPT" | ssh -o StrictHostKeyChecking=no -i "${KEY_NAME}.pem" ec2-user@"$PUBLIC_IP" "cat | bash"
    
    log_success "Instance đã được cấu hình"
}

# ============================================
# DEPLOY APPLICATION
# ============================================
deploy_app() {
    log_info "Deploy ứng dụng..."
    
    DEPLOY_SCRIPT='
        set -e
        cd /var/www/medi-path
        
        # Clone hoặc pull code
        if [ -d ".git" ]; then
            echo "=== Pulling latest code ==="
            git pull origin main
        else
            echo "=== Cloning repository ==="
            # THAY ĐỔI URL NÀY THÀNH REPO CỦA BẠN
            git clone https://github.com/YOUR_USERNAME/medi-path-ease.git .
        fi
        
        # Install dependencies
        echo "=== Installing dependencies ==="
        npm install
        
        # Copy environment file
        echo "=== Setting up environment ==="
        if [ ! -f .env ]; then
            cat > .env << '\''EOF'\''
NODE_ENV=production
PORT=3001
MONGODB_URI=mongodb://YOUR_DOCDB_ENDPOINT:27017/medi-path-ease
JWT_SECRET=your-super-secret-jwt-key-change-this
JWT_EXPIRES_IN=7d
AWS_REGION=ap-southeast-1
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
AWS_S3_BUCKET=medi-path-ease-uploads
FRONTEND_URL=https://your-domain.com
EOF
        fi
        
        # Start with PM2
        echo "=== Starting application with PM2 ==="
        pm2 delete medi-path-backend 2>/dev/null || true
        pm2 start server/index.js --name medi-path-backend --exp-backoff-restart-delay=100
        
        # Setup PM2 startup
        pm2 startup
        pm2 save
        
        # Configure firewall
        sudo systemctl start firewalld 2>/dev/null || sudo systemctl start ufw 2>/dev/null || true
        sudo firewall-cmd --permanent --add-port=3001/tcp 2>/dev/null || true
        
        echo "=== Deployment complete ==="
        pm2 status
    '
    
    echo "$DEPLOY_SCRIPT" | ssh -o StrictHostKeyChecking=no -i "${KEY_NAME}.pem" ec2-user@"$PUBLIC_IP" "cat | bash"
    
    log_success "Ứng dụng đã được deploy"
}

# ============================================
# TEST DEPLOYMENT
# ============================================
test_deployment() {
    log_info "Kiểm tra deployment..."
    
    # Đợi một chút
    sleep 5
    
    # Test health endpoint
    RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" "http://$PUBLIC_IP:3001/api/health" 2>/dev/null || echo "000")
    
    if [ "$RESPONSE" = "200" ]; then
        log_success "API đang chạy tại: http://$PUBLIC_IP:3001/api/health"
    else
        log_warn "API có thể chưa sẵn sàng. Kiểm tra: ssh -i ${KEY_NAME}.pem ec2-user@$PUBLIC_IP"
        log_warn "Sau đó chạy: pm2 logs medi-path-backend"
    fi
}

# ============================================
# PRINT SUMMARY
# ============================================
print_summary() {
    echo ""
    echo "============================================"
    echo -e "${GREEN}SETUP HOÀN TẤT!${NC}"
    echo "============================================"
    echo ""
    echo -e "${BLUE}Thông tin quan trọng:${NC}"
    echo "  - Instance ID: $INSTANCE_ID"
    echo "  - Public IP: $PUBLIC_IP"
    echo "  - SSH Key: ${KEY_NAME}.pem"
    echo ""
    echo -e "${BLUE}Cách kết nối:${NC}"
    echo "  ssh -i ${KEY_NAME}.pem ec2-user@$PUBLIC_IP"
    echo ""
    echo -e "${BLUE}API Endpoint:${NC}"
    echo "  http://$PUBLIC_IP:3001/api/health"
    echo ""
    echo -e "${BLUE}Quản lý PM2:${NC}"
    echo "  pm2 status           - Xem trạng thái"
    echo "  pm2 logs            - Xem logs"
    echo "  pm2 restart all     - Khởi động lại"
    echo ""
    echo -e "${YELLOW}Lưu ý:${NC}"
    echo "  1. Cập nhật .env với DocumentDB endpoint"
    echo "  2. Mở port 3001 trong Security Group nếu cần"
    echo "  3. Thiết lập CI/CD với GitHub Actions"
    echo ""
    echo "============================================"
}

# ============================================
# MAIN
# ============================================
main() {
    echo ""
    echo "============================================"
    echo "  Medi Path Ease - EC2 Backend Setup"
    echo "============================================"
    echo ""
    
    check_aws_cli
    check_ssh
    create_key_pair
    setup_vpc
    create_security_group
    create_instance
    configure_instance
    deploy_app
    test_deployment
    print_summary
}

main "$@"
