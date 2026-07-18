#!/bin/bash
# ============================================
# Medi Path Ease - S3 + CloudFront Frontend Setup
# ============================================
# Chạy trên macOS/Linux terminal hoặc Git Bash (Windows)
# Usage: ./setup-frontend-s3.sh

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
BUCKET_NAME_FRONTEND="medi-path-ease-frontend-$(date +%s)"
BUCKET_NAME_UPLOADS="medi-path-ease-uploads"
CLOUDFRONT_ORIGIN_ID="S3-frontend-origin"

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

check_node() {
    log_info "Kiểm tra Node.js..."
    if ! command -v node &> /dev/null; then
        log_error "Node.js chưa được cài đặt"
    fi
    node --version
    log_success "Node.js đã sẵn sàng"
}

# ============================================
# CREATE S3 BUCKET FOR FRONTEND
# ============================================
create_frontend_bucket() {
    log_info "Tạo S3 Bucket cho Frontend..."
    
    # Kiểm tra bucket đã tồn tại chưa
    if aws s3api head-bucket --bucket "$BUCKET_NAME_FRONTEND" 2>/dev/null; then
        log_info "Bucket '$BUCKET_NAME_FRONTEND' đã tồn tại"
    else
        aws s3api create-bucket \
            --bucket "$BUCKET_NAME_FRONTEND" \
            --region "$AWS_REGION" \
            --create-bucket-configuration LocationConstraint="$AWS_REGION"
        
        log_success "Đã tạo Bucket: $BUCKET_NAME_FRONTEND"
    fi
}

# ============================================
# CREATE S3 BUCKET FOR UPLOADS
# ============================================
create_uploads_bucket() {
    log_info "Tạo S3 Bucket cho Uploads..."
    
    if aws s3api head-bucket --bucket "$BUCKET_NAME_UPLOADS" 2>/dev/null; then
        log_info "Bucket '$BUCKET_NAME_UPLOADS' đã tồn tại"
    else
        aws s3api create-bucket \
            --bucket "$BUCKET_NAME_UPLOADS" \
            --region "$AWS_REGION" \
            --create-bucket-configuration LocationConstraint="$AWS_REGION"
        
        log_success "Đã tạo Bucket: $BUCKET_NAME_UPLOADS"
    fi
}

# ============================================
# CONFIGURE BUCKET POLICY (PUBLIC READ FOR FRONTEND)
# ============================================
configure_frontend_bucket() {
    log_info "Cấu hình Frontend Bucket Policy..."
    
    ACCOUNT_ID=$(aws sts get-caller-identity --query 'Account' --output text)
    
    # Public read policy
    cat > /tmp/frontend-policy.json << EOF
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "PublicReadGetObject",
            "Effect": "Allow",
            "Principal": "*",
            "Action": "s3:GetObject",
            "Resource": "arn:aws:s3:::${BUCKET_NAME_FRONTEND}/*"
        }
    ]
}
EOF
    
    aws s3api put-bucket-policy \
        --bucket "$BUCKET_NAME_FRONTEND" \
        --policy file:///tmp/frontend-policy.json
    
    # Enable website hosting
    aws s3 website "s3://${BUCKET_NAME_FRONTEND}/" \
        --index-document index.html \
        --error-document index.html
    
    log_success "Đã cấu hình Frontend Bucket"
}

# ============================================
# CONFIGURE UPLOADS BUCKET POLICY
# ============================================
configure_uploads_bucket() {
    log_info "Cấu hình Uploads Bucket Policy..."
    
    cat > /tmp/uploads-policy.json << EOF
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "AllowEC2ReadWrite",
            "Effect": "Allow",
            "Principal": "*",
            "Action": [
                "s3:GetObject",
                "s3:PutObject",
                "s3:DeleteObject"
            ],
            "Resource": "arn:aws:s3:::${BUCKET_NAME_UPLOADS}/*"
        }
    ]
}
EOF
    
    aws s3api put-bucket-policy \
        --bucket "$BUCKET_NAME_UPLOADS" \
        --policy file:///tmp/uploads-policy.json
    
    # Enable CORS
    cat > /tmp/cors.json << EOF
[
    {
        "AllowedHeaders": ["*"],
        "AllowedMethods": ["GET", "PUT", "POST", "DELETE"],
        "AllowedOrigins": ["*"],
        "ExposeHeaders": ["ETag"],
        "MaxAgeSeconds": 3600
    }
]
EOF
    
    aws s3api put-bucket-cors \
        --bucket "$BUCKET_NAME_UPLOADS" \
        --cors-configuration file:///tmp/cors.json
    
    log_success "Đã cấu hình Uploads Bucket"
}

# ============================================
# CREATE CLOUDFRONT DISTRIBUTION
# ============================================
create_cloudfront() {
    log_info "Tạo CloudFront Distribution..."
    
    # Kiểm tra distribution đã tồn tại chưa
    DISTRIBUTION_ID=$(aws cloudfront list-distributions \
        --query "DistributionList.Items[?Comment=='${BUCKET_NAME_FRONTEND}'].Id" \
        --output text 2>/dev/null)
    
    if [ -n "$DISTRIBUTION_ID" ] && [ "$DISTRIBUTION_ID" != "None" ]; then
        log_info "CloudFront Distribution đã tồn tại: $DISTRIBUTION_ID"
    else
        # Tạo distribution mới
        cat > /tmp/cloudfront-config.json << EOF
{
    "CallerReference": "medi-path-frontend-$(date +%s)",
    "Comment": "${BUCKET_NAME_FRONTEND}",
    "Enabled": true,
    "Origins": {
        "Quantity": 1,
        "Items": [
            {
                "Id": "${CLOUDFRONT_ORIGIN_ID}",
                "DomainName": "${BUCKET_NAME_FRONTEND}.s3.${AWS_REGION}.amazonaws.com",
                "OriginPath": "",
                "CustomHeaders": {
                    "Quantity": 0
                },
                "S3OriginConfig": {
                    "OriginAccessIdentity": ""
                },
                "ConnectionAttempts": 3,
                "ConnectionTimeout": 10,
                "OriginShield": {
                    "Enabled": false
                }
            }
        ]
    },
    "DefaultCacheBehavior": {
        "ViewerProtocolPolicy": "redirect-http-to-https",
        "AllowedMethods": {
            "Quantity": 2,
            "Items": ["GET", "HEAD"],
            "CachedMethods": {
                "Quantity": 2,
                "Items": ["GET", "HEAD"]
            }
        },
        "TargetOriginId": "${CLOUDFRONT_ORIGIN_ID}",
        "Compress": true,
        "CachePolicyId": "658327ea-f89d-4fab-a63d-7e88639e58f6",
        "SmoothStreaming": false,
        "DefaultTTL": 86400,
        "MinTTL": 0,
        "MaxTTL": 31536000
    },
    "PriceClass": "PriceClass_100",
    "ViewerCertificate": {
        "CloudFrontDefaultCertificate": true
    },
    "HttpVersion": "http2and3",
    "IsIPV6Enabled": true
}
EOF
        
        RESULT=$(aws cloudfront create-distribution \
            --distribution-config file:///tmp/cloudfront-config.json \
            --query 'Distribution.Id' \
            --output text)
        
        log_success "Đã tạo CloudFront Distribution: $RESULT"
    fi
    
    # Lấy domain
    CLOUDFRONT_DOMAIN=$(aws cloudfront list-distributions \
        --query "DistributionList.Items[?Comment=='${BUCKET_NAME_FRONTEND}'].DomainName" \
        --output text)
    
    echo "$CLOUDFRONT_DOMAIN"
}

# ============================================
# BUILD AND DEPLOY FRONTEND
# ============================================
build_and_deploy() {
    log_info "Build và Deploy Frontend..."
    
    # Di chuyển vào frontend folder
    if [ -d "../frontend" ]; then
        cd ../frontend
    elif [ -d "../../frontend" ]; then
        cd ../../frontend
    fi
    
    # Kiểm tra package.json
    if [ ! -f "package.json" ]; then
        log_warn "Không tìm thấy frontend folder. Bỏ qua build."
        return
    fi
    
    # Cài dependencies
    log_info "Cài dependencies..."
    npm install
    
    # Build
    log_info "Build frontend..."
    npm run build
    
    # Upload lên S3
    log_info "Upload lên S3..."
    aws s3 sync ./dist "s3://${BUCKET_NAME_FRONTEND}/" \
        --delete \
        --cache-control "public,max-age=31536000,immutable" \
        --exclude "index.html" \
        --exclude "*.css"
    
    # Upload index.html với cache control khác
    aws s3 cp ./dist/index.html "s3://${BUCKET_NAME_FRONTEND}/index.html" \
        --cache-control "public,max-age=0,must-revalidate" \
        --content-type "text/html"
    
    # Upload CSS files
    if [ -d "./dist/assets" ]; then
        aws s3 sync ./dist/assets "s3://${BUCKET_NAME_FRONTEND}/assets/" \
            --delete \
            --cache-control "public,max-age=31536000,immutable" \
            --content-type "text/css"
    fi
    
    log_success "Đã deploy frontend lên S3"
}

# ============================================
# PRINT SUMMARY
# ============================================
print_summary() {
    local cf_domain=$1
    
    echo ""
    echo "============================================"
    echo -e "${GREEN}FRONTEND SETUP HOÀN TẤT!${NC}"
    echo "============================================"
    echo ""
    echo -e "${BLUE}S3 Buckets:${NC}"
    echo "  - Frontend: $BUCKET_NAME_FRONTEND"
    echo "  - Uploads: $BUCKET_NAME_UPLOADS"
    echo ""
    echo -e "${BLUE}CloudFront Domain:${NC}"
    echo "  https://$cf_domain"
    echo ""
    echo -e "${BLUE}Cách truy cập:${NC}"
    echo "  - Trực tiếp: https://$cf_domain"
    echo "  - Qua S3: http://${BUCKET_NAME_FRONTEND}.s3-website.${AWS_REGION}.amazonaws.com"
    echo ""
    echo -e "${BLUE}Cập nhật Backend .env:${NC}"
    echo "  FRONTEND_URL=https://$cf_domain"
    echo "  AWS_S3_BUCKET=$BUCKET_NAME_UPLOADS"
    echo ""
    echo -e "${YELLOW}Lưu ý:${NC}"
    echo "  1. CloudFront cần 5-10 phút để propagate"
    echo "  2. Cập nhật VITE_API_URL trong frontend trước khi build"
    echo "  3. Deploy lại sau khi cập nhật code"
    echo ""
    echo "============================================"
}

# ============================================
# MAIN
# ============================================
main() {
    echo ""
    echo "============================================"
    echo "  Medi Path Ease - Frontend S3 + CloudFront"
    echo "============================================"
    echo ""
    
    check_aws_cli
    check_node
    
    create_frontend_bucket
    create_uploads_bucket
    configure_frontend_bucket
    configure_uploads_bucket
    
    CLOUDFRONT_DOMAIN=$(create_cloudfront)
    
    # Hỏi có build và deploy không
    read -p "Build và deploy frontend ngay? (y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        build_and_deploy
    fi
    
    print_summary "$CLOUDFRONT_DOMAIN"
}

main "$@"
