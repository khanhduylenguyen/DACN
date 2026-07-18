# AWS Deployment Guide - Medi Path Ease

Hướng dẫn deploy Medi Path Ease lên AWS với ECS Fargate + DocumentDB + CloudFront.

**Chi phí ước tính:** $75-100/tháng
**Thời gian setup:** 2-3 giờ

---

## Mục Lục

1. [Tổng Quan Kiến Trúc](#1-tổng-quan-kiến-trúc)
2. [Bước 1: Chuẩn Bị AWS Account](#2-bước-1--chuẩn-bị-aws-account)
3. [Bước 2: Tạo VPC](#3-bước-2--tạo-vpc)
4. [Bước 3: Tạo DocumentDB](#4-bước-3--tạo-documentdb)
5. [Bước 4: Tạo S3 Bucket](#5-bước-4--tạo-s3-bucket)
6. [Bước 5: Push Docker Image lên ECR](#6-bước-5--push-docker-image-lên-ecr)
7. [Bước 6: Tạo ECS Cluster](#7-bước-6--tạo-ecs-cluster)
8. [Bước 7: Deploy Backend lên ECS](#8-bước-7--deploy-backend-lên-ecs)
9. [Bước 8: Deploy Frontend lên S3 + CloudFront](#9-bước-8--deploy-frontend-lên-s3--cloudfront)
10. [Bước 9: Cấu Hình Domain & SSL](#10-bước-9--cấu-hình-domain--ssl)
11. [Bước 10: CI/CD với GitHub Actions](#11-bước-10--cicd-với-github-actions)
12. [Tối Ưu Chi Phí](#12-tối-ưu-chi-phí)
13. [Monitoring & Alerts](#13-monitoring--alerts)

---

## 1. Tổng Quan Kiến Trúc

```
Internet
    │
    ▼
┌─────────────────────────────────────────────────────────────────┐
│                        AWS Cloud                                 │
│                                                                 │
│  ┌──────────────┐                                               │
│  │  Route 53    │  ← DNS + Health Checks                        │
│  └──────┬───────┘                                               │
│         │                                                       │
│         ▼                                                       │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                    CloudFront CDN                          │  │
│  │               (Edge Locations VN/SG)                       │  │
│  └──────┬──────────────────────────────────────┬──────────────┘  │
│         │                                      │                 │
│         ▼                                      ▼                 │
│  ┌──────────────┐                    ┌───────────────────────┐   │
│  │  S3 Bucket   │                    │   Application Load    │   │
│  │  (Frontend)  │                    │       Balancer        │   │
│  └──────────────┘                    └───────────┬───────────┘   │
│                                                  │               │
│                                                  ▼               │
│                                        ┌───────────────────────┐ │
│                                        │    ECS Fargate        │ │
│                                        │   (Express.js API)    │ │
│                                        └───────────┬───────────┘ │
│                                                    │               │
│                              ┌─────────────────────┼─────────────┐│
│                              │                     │             ││
│                              ▼                     ▼             ││
│                       ┌────────────┐        ┌───────────┐      ││
│                       │ DocumentDB │        │    S3     │      ││
│                       │ (MongoDB)  │        │ (Uploads) │      ││
│                       └────────────┘        └───────────┘      ││
│                                                                 │
│  VPC (10.0.0.0/16)                                             │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. Bước 1 — Chuẩn Bị AWS Account

### 2.1 Tạo AWS Account (Nếu Chưa Có)

1. Truy cập [aws.amazon.com](https://aws.amazon.com)
2. Click **Create an AWS Account**
3. Chọn **Personal account** → Điền thông tin
4. Thêm Credit Card (AWS yêu cầu, nhưng Free Tier miễn phí)
5. Verify qua SMS

### 2.2 Bật Free Tier Alerts

1. AWS Console → **Billing** → **Billing preferences**
2. Bật **Alert me when my estimated charges exceed**
3. Set alert ở $50, $100, $150

### 2.3 Cài Đặt AWS CLI

```bash
# Windows (PowerShell)
msiexec.exe /i https://awscli.amazonaws.com/AWSCLIV2.msi

# Kiểm tra
aws --version
# Output: aws-cli/2.x.x Python/3.x.x

# Configure credentials
aws configure
# AWS Access Key ID: <your-key>
# AWS Secret Access Key: <your-secret>
# Default region name: ap-southeast-1
# Default output format: json
```

### 2.4 Cài Đặt Các Công Cụ Cần Thiết

```bash
# Docker Desktop (cho build image)
# Download: https://www.docker.com/products/docker-desktop/

# GitHub CLI (cho CI/CD)
gh auth login

# Terraform (optional, cho infrastructure as code)
# Download: https://developer.hashicorp.com/terraform/downloads
```

---

## 3. Bước 2 — Tạo VPC

### 3.1 Tạo VPC qua Console

1. AWS Console → **VPC** → **Your VPCs** → **Create VPC**
2. Cấu hình:

```
Name tag: medi-path-vpc
IPv4 CIDR: 10.0.0.0/16
Tenancy: Default
```

3. **Enable DNS hostnames** (checkbox)

### 3.2 Tạo Subnets

Tạo 3 public subnets (cho ALB) và 3 private subnets (cho DocumentDB):

| Subnet Name | Availability Zone | IPv4 CIDR |
|-------------|-------------------|-----------|
| `medi-path-public-1a` | ap-southeast-1a | 10.0.1.0/24 |
| `medi-path-public-1b` | ap-southeast-1b | 10.0.2.0/24 |
| `medi-path-public-1c` | ap-southeast-1c | 10.0.3.0/24 |
| `medi-path-private-1a` | ap-southeast-1a | 10.0.101.0/24 |
| `medi-path-private-1b` | ap-southeast-1b | 10.0.102.0/24 |
| `medi-path-private-1c` | ap-southeast-1c | 10.0.103.0/24 |

### 3.3 Tạo Internet Gateway

```bash
# Create Internet Gateway
aws ec2 create-internet-gateway --tag-specifications 'ResourceType=internet-gateway,Tags=[{Key=Name,Value=medi-path-igw}]'

# Attach to VPC
aws ec2 attach-internet-gateway --internet-gateway-id <igw-id> --vpc-id <vpc-id>
```

### 3.4 Tạo NAT Gateway

1. **NAT Gateway** → **Create NAT Gateway**
2. Connectivity type: **Public**
3. Subnet: chọn `medi-path-public-1a`
4. Click **Allocate Elastic IP**
5. **Create**

### 3.5 Tạo Route Tables

**Public Route Table:**
```
Destination: 0.0.0.0/0  →  Target: medi-path-igw
```

**Private Route Table:**
```
Destination: 0.0.0.0/0  →  Target: NAT Gateway
```

Associate subnets:
- Public subnets → Public Route Table
- Private subnets → Private Route Table

---

## 4. Bước 3 — Tạo DocumentDB

### 4.1 Tạo DocumentDB Cluster

1. AWS Console → **DocumentDB** → **Clusters** → **Create**
2. Cấu hình:

```
Engine version: 7.0 (latest MongoDB 7.0 compatible)
Instance class: db.t3.medium (2 vCPU, 4GB RAM)
Instances: 1 (Multi-AZ sau)
Cluster identifier: medi-path-docdb
Master username: mediadmin
Master password: <strong-password>
Port: 27017

VPC: medi-path-vpc
Subnet group: <create new>
VPC security groups: <create new>
  - Rule: Allow 27017 from ECS security group

Storage: 20GB (gp3)
Auto-scaling: Enable, min 1, max 2
Backup: Enable, retention 7 days
Encryption: Enable (default)
```

### 4.2 Kiểm Tra Kết Nối

```bash
# Sau khi tạo xong, lấy endpoint
aws docdb describe-db-instances --query 'DBInstances[*].[Endpoint.Address, InstanceCreateTime]'

# Endpoint sẽ có dạng: medi-path-docdb.cluster-xxx.ap-southeast-1.docdb.amazonaws.com
```

### 4.3 Cập Nhật Security Group

1. DocumentDB Security Group → **Edit inbound rules**
2. Thêm rule:

```
Type: Custom TCP
Port: 27017
Source: <ECS Security Group ID>
```

---

## 5. Bước 4 — Tạo S3 Bucket

### 5.1 Tạo Bucket Cho Uploads

```bash
aws s3api create-bucket \
  --bucket medi-path-ease-uploads-<random-id> \
  --region ap-southeast-1 \
  --create-bucket-configuration LocationConstraint=ap-southeast-1
```

### 5.2 Tạo Bucket Cho Frontend

```bash
aws s3api create-bucket \
  --bucket medi-path-ease-frontend \
  --region ap-southeast-1 \
  --create-bucket-configuration LocationConstraint=ap-southeast-1
```

### 5.3 Cấu Hình Bucket Policies

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PublicReadGetObject",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::medi-path-ease-frontend/*"
    },
    {
      "Sid": "ECSReadWrite",
      "Effect": "Allow",
      "Principal": {
        "AWS": "arn:aws:iam::<account-id>:role/ecsTaskRole"
      },
      "Action": [
        "s3:GetObject",
        "s3:PutObject",
        "s3:DeleteObject"
      ],
      "Resource": "arn:aws:s3:::medi-path-ease-uploads-*/*"
    }
  ]
}
```

### 5.4 Enable CORS

```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET", "PUT", "POST", "DELETE"],
    "AllowedOrigins": ["https://medipathease.com", "https://www.medipathease.com"],
    "ExposeHeaders": ["ETag"]
  }
]
```

---

## 6. Bước 5 — Push Docker Image lên ECR

### 6.1 Tạo ECR Repository

```bash
# Tạo repository cho backend
aws ecr create-repository \
  --repository-name medi-path-ease/backend \
  --image-scanning-configuration scanOnPush=true \
  --encryption-configuration encryptionType=AES256

# Lấy URI để push
aws ecr describe-repositories --query 'repositories[0].repositoryUri'
```

### 6.2 Build và Push Docker Image

```bash
# Login to ECR
aws ecr get-login-password --region ap-southeast-1 | docker login --username AWS --password-stdin <account-id>.dkr.ecr.ap-southeast-1.amazonaws.com

# Build image
docker build -t medi-path-ease/backend ./server

# Tag
docker tag medi-path-ease/backend:latest <account-id>.dkr.ecr.ap-southeast-1.amazonaws.com/medi-path-ease/backend:latest

# Push
docker push <account-id>.dkr.ecr.ap-southeast-1.amazonaws.com/medi-path-ease/backend:latest
```

### 6.3 Lấy Image URI

```bash
# Để sử dụng ở bước tiếp theo
aws ecr describe-images --repository-name medi-path-ease/backend --query 'sort_by(imageDetails,& imagePushedAt)[-1].imageUri' --output text
```

---

## 7. Bước 6 — Tạo ECS Cluster

### 7.1 Tạo ECS Cluster

```bash
aws ecs create-cluster \
  --cluster-name medi-path-ease-cluster \
  --setting name=containerInsights,value=enabled
```

### 7.2 Tạo IAM Roles Cho ECS

```bash
# ECS Task Execution Role (bắt buộc)
aws iam create-role \
  --role-name ecsTaskExecutionRole \
  --assume-role-policy-document '{
    "Version": "2012-10-17",
    "Statement": [{
      "Effect": "Allow",
      "Principal": {"Service": "ecs-tasks.amazonaws.com"},
      "Action": "sts:AssumeRole"
    }]
  }'

# Attach policy
aws iam attach-role-policy \
  --role-name ecsTaskExecutionRole \
  --policy-arn arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy

# ECS Task Role (cho S3, DocumentDB access)
aws iam create-role \
  --role-name ecsTaskRole \
  --assume-role-policy-document '{
    "Version": "2012-10-17",
    "Statement": [{
      "Effect": "Allow",
      "Principal": {"Service": "ecs-tasks.amazonaws.com"},
      "Action": "sts:AssumeRole"
    }]
  }'

# Attach S3 and DocumentDB access policies
aws iam attach-role-policy \
  --role-name ecsTaskRole \
  --policy-arn arn:aws:iam::aws:policy/AmazonS3FullAccess
```

### 7.3 Tạo Security Group Cho ECS

1. EC2 → **Security Groups** → **Create security group**
2. Cấu hình:

```
Name: medi-path-ecs-sg
VPC: medi-path-vpc
Inbound rules:
  - Type: HTTP, Port: 80, Source: 0.0.0.0/0 (cho ALB health check)
  - Type: Custom TCP, Port: 3001, Source: <ALB Security Group>
Outbound rules:
  - All traffic (default)
```

---

## 8. Bước 7 — Deploy Backend lên ECS

### 8.1 Tạo Task Definition

Tạo file `task-definition.json`:

```json
{
  "family": "medi-path-ease-backend",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "512",
  "memory": "1024",
  "executionRoleArn": "arn:aws:iam::<account-id>:role/ecsTaskExecutionRole",
  "taskRoleArn": "arn:aws:iam::<account-id>:role/ecsTaskRole",
  "containerDefinitions": [
    {
      "name": "backend",
      "image": "<account-id>.dkr.ecr.ap-southeast-1.amazonaws.com/medi-path-ease/backend:latest",
      "essential": true,
      "portMappings": [
        {
          "containerPort": 3001,
          "protocol": "tcp"
        }
      ],
      "environment": [
        {
          "name": "NODE_ENV",
          "value": "production"
        },
        {
          "name": "PORT",
          "value": "3001"
        }
      ],
      "secrets": [
        {
          "name": "MONGODB_URI",
          "valueFrom": "arn:aws:secretsmanager:ap-southeast-1:<account-id>:secret:medi-path/mongodb-uri"
        },
        {
          "name": "JWT_SECRET",
          "valueFrom": "arn:aws:secretsmanager:ap-southeast-1:<account-id>:secret:medi-path/jwt-secret"
        },
        {
          "name": "AWS_S3_BUCKET",
          "valueFrom": "arn:aws:secretsmanager:ap-southeast-1:<account-id>:secret:medi-path/s3-bucket"
        },
        {
          "name": "AWS_ACCESS_KEY_ID",
          "valueFrom": "arn:aws:secretsmanager:ap-southeast-1:<account-id>:secret:medi-path/aws-access-key"
        },
        {
          "name": "AWS_SECRET_ACCESS_KEY",
          "valueFrom": "arn:aws:secretsmanager:ap-southeast-1:<account-id>:secret:medi-path/aws-secret-key"
        }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/medi-path-ease",
          "awslogs-region": "ap-southeast-1",
          "awslogs-stream-prefix": "backend"
        }
      }
    }
  ]
}
```

### 8.2 Register Task Definition

```bash
aws ecs register-task-definition --cli-input-json file://task-definition.json
```

### 8.3 Tạo Target Group

```bash
aws elbv2 create-target-group \
  --name medi-path-ease-tg \
  --protocol HTTP \
  --port 3001 \
  --target-type ip \
  --vpc-id <vpc-id> \
  --health-check-path /api/health \
  --health-check-interval-seconds 30 \
  --health-check-timeout-seconds 5 \
  --healthy-threshold-count 2 \
  --unhealthy-threshold-count 3
```

### 8.4 Tạo Application Load Balancer

```bash
# Create ALB
aws elbv2 create-load-balancer \
  --name medi-path-ease-alb \
  --scheme internet-facing \
  --subnets <public-subnet-ids> \
  --security-groups <ecs-sg-id>

# Create listener (HTTP - sẽ redirect sang HTTPS sau)
aws elbv2 create-listener \
  --load-balancer-arn <alb-arn> \
  --protocol HTTP \
  --port 80 \
  --default-actions Type=forward,TargetGroupArn=<tg-arn>
```

### 8.5 Tạo Service

```bash
aws ecs create-service \
  --cluster medi-path-ease-cluster \
  --service-name medi-path-ease-backend \
  --task-definition medi-path-ease-backend \
  --desired-count 1 \
  --launch-type FARGATE \
  --network-configuration '{
    "awsvpcConfiguration": {
      "subnets": ["<private-subnet-ids>"],
      "securityGroups": ["<ecs-sg-id>"],
      "assignPublicIp": "DISABLED"
    }
  }' \
  --load-balancers '{
    "targetGroupArn": "<tg-arn>",
    "containerName": "backend",
    "containerPort": 3001
  }'
```

### 8.6 Kiểm Tra Deployment

```bash
# Xem trạng thái service
aws ecs describe-services \
  --cluster medi-path-ease-cluster \
  --services medi-path-ease-backend

# Xem logs
aws logs tail /ecs/medi-path-ease --follow
```

---

## 9. Bước 8 — Deploy Frontend lên S3 + CloudFront

### 9.1 Build Frontend

```bash
# Cập nhật API URL
# src/lib/api.ts
VITE_API_URL=https://api.medipathease.com

# Build
cd frontend
npm install
npm run build
```

### 9.2 Upload lên S3

```bash
# Sync frontend build lên S3
aws s3 sync ./dist s3://medi-path-ease-frontend --delete

# Set content type cho index.html
aws s3 cp ./dist/index.html s3://medi-path-ease-frontend/index.html \
  --cache-control "max-age=0,no-cache" \
  --metadata-directive REPLACE
```

### 9.3 Tạo CloudFront Distribution

```bash
aws cloudfront create-distribution \
  --origin-domain-name medi-path-ease-frontend.s3.ap-southeast-1.amazonaws.com \
  --default-root-object index.html \
  --price-class PriceClass_100 \
  --viewer-protocol-policy redirect-http-to-https \
  --allowed-methods GET,HEAD,OPTIONS \
  --cached-methods GET,HEAD
```

### 9.4 Cấu Hình Cache Behavior

```json
{
  "ViewerProtocolPolicy": "redirect-http-to-https",
  "Compress": true,
  "CachePolicyId": "658327ea-f89d-4fab-a63d-7e88639e58f6",
  "OriginRequestPolicyId": "88a5eaf4-2fd4-4709-b370-b4c650ea3fcf"
}
```

### 9.5 Custom Error Pages

```bash
# Configure 404 to return index.html (SPA routing)
aws cloudfront update-distribution \
  --id <distribution-id> \
  --default-root-object index.html
```

---

## 10. Bước 9 — Cấu Hình Domain & SSL

### 10.1 Mua Domain (Nếu Chưa Có)

Mua qua:
- **Route 53**: $12/năm cho .com
- **Namecheap/Porkbun**: ~$8-10/năm (rẻ hơn)

### 10.2 Tạo Hosted Zone

```bash
aws route53 create-hosted-zone \
  --name medipathease.com \
  --caller-reference $(date +%s)
```

### 10.3 Cấu Hình SSL Certificate

1. AWS Console → **ACM** → **Request certificate**
2. Domain names:
   - `mediathease.com`
   - `*.mediathease.com`
3. Validation: **DNS validation**
4. Sau khi tạo, click **Create records in Route 53**

### 10.4 Update CloudFront SSL

```bash
# Update distribution với certificate
aws cloudfront update-distribution \
  --id <distribution-id> \
  --viewer-certificate '{
    "ACMCertificateArn": "<cert-arn>",
    "SSLSupportMethod": "sni-only",
    "MinimumProtocolVersion": "TLSv1.2_2021"
  }'
```

### 10.5 Cập Nhật DNS Records

```bash
# Frontend CloudFront
aws route53 change-resource-record-sets \
  --hosted-zone-id <zone-id> \
  --change-batch '{
    "Changes": [{
      "Action": "CREATE",
      "ResourceRecordSet": {
        "Name": "mediathease.com",
        "Type": "A",
        "AliasTarget": {
          "DNSName": "<cloudfront-domain>",
          "HostedZoneId": "Z2FDTNDATAQYW2",
          "EvaluateTargetHealth": true
        }
      }
    }]
  }'

# API ALB
aws route53 change-resource-record-sets \
  --hosted-zone-id <zone-id> \
  --change-batch '{
    "Changes": [{
      "Action": "CREATE",
      "ResourceRecordSet": {
        "Name": "api.mediathease.com",
        "Type": "A",
        "AliasTarget": {
          "DNSName": "<alb-dns-name>",
          "HostedZoneId": "<alb-hosted-zone>",
          "EvaluateTargetHealth": true
        }
      }
    }]
  }'
```

---

## 11. Bước 10 — CI/CD với GitHub Actions

### 11.1 Tạo GitHub Secrets

GitHub → Settings → Secrets and variables → Actions:

| Secret Name | Giá Trị |
|-------------|---------|
| `AWS_ACCESS_KEY_ID` | Từ IAM user |
| `AWS_SECRET_ACCESS_KEY` | Từ IAM user |
| `AWS_REGION` | ap-southeast-1 |
| `ECR_REGISTRY` | <account-id>.dkr.ecr.ap-southeast-1.amazonaws.com |
| `S3_BUCKET_FRONTEND` | medi-path-ease-frontend |
| `ECS_CLUSTER` | medi-path-ease-cluster |
| `ECS_SERVICE` | medi-path-ease-backend |
| `ECS_TASK_DEFINITION` | medi-path-ease-backend |

### 11.2 Tạo IAM User Cho GitHub Actions

```bash
aws iam create-user --user-name github-actions

# Attach policies
aws iam attach-user-policy \
  --user-name github-actions \
  --policy-arn arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryFullAccess

aws iam attach-user-policy \
  --user-name github-actions \
  --policy-arn arn:aws:iam::aws:policy/AmazonS3FullAccess

aws iam attach-user-policy \
  --user-name github-actions \
  --policy-arn arn:aws:iam::aws:policy/AmazonECSFullAccess
```

### 11.3 Tạo GitHub Actions Workflow

Tạo file `.github/workflows/deploy.yml`:

```yaml
name: Deploy to AWS ECS

on:
  push:
    branches: [main]

env:
  AWS_REGION: ap-southeast-1
  ECR_REPOSITORY: medi-path-ease/backend
  ECS_SERVICE: medi-path-ease-backend
  ECS_CLUSTER: medi-path-ease-cluster
  ECS_TASK_DEFINITION: task-definition.json
  CONTAINER_NAME: backend

jobs:
  deploy-backend:
    name: Deploy Backend
    runs-on: ubuntu-latest

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: ${{ env.AWS_REGION }}

      - name: Login to Amazon ECR
        id: login-ecr
        uses: aws-actions/amazon-ecr-login@v2

      - name: Build Docker image
        run: |
          docker build -t ${{ env.ECR_REPOSITORY }}:latest ./server

      - name: Tag image
        run: |
          docker tag ${{ env.ECR_REPOSITORY }}:latest ${{ steps.login-ecr.outputs.registry }}/${{ env.ECR_REPOSITORY }}:latest

      - name: Push to ECR
        run: |
          docker push ${{ steps.login-ecr.outputs.registry }}/${{ env.ECR_REPOSITORY }}:latest

      - name: Update ECS task definition
        id: task-def
        uses: aws-actions/amazon-ecs-render-task-definition@v1
        with:
          task-definition: ${{ env.ECS_TASK_DEFINITION }}
          container-name: ${{ env.CONTAINER_NAME }}
          image: ${{ steps.login-ecr.outputs.registry }}/${{ env.ECR_REPOSITORY }}:latest

      - name: Deploy to ECS
        uses: aws-actions/amazon-ecs-deploy-task-definition@v2
        with:
          task-definition: ${{ steps.task-def.outputs.task-definition }}
          service: ${{ env.ECS_SERVICE }}
          cluster: ${{ env.ECS_CLUSTER }}
          wait-for-service-stability: true

  deploy-frontend:
    name: Deploy Frontend
    runs-on: ubuntu-latest
    needs: deploy-backend

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Build
        run: npm run build
        env:
          VITE_API_URL: https://api.medipathease.com

      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: ${{ env.AWS_REGION }}

      - name: Upload to S3
        run: |
          aws s3 sync ./dist s3://${{ secrets.S3_BUCKET_FRONTEND }} --delete

      - name: Invalidate CloudFront
        run: |
          aws cloudfront create-invalidation \
            --distribution-id ${{ secrets.CF_DISTRIBUTION_ID }} \
            --paths "/*"
```

---

## 12. Tối Ưu Chi Phí

### 12.1 DocumentDB Serverless (Khuyến Nghị)

Thay vì luôn chạy instance, dùng **DocumentDB Serverless**:

```json
{
  "serverlessConfiguration": {
    "minCapacity": 0.5,
    "maxCapacity": 16
  }
}
```

**Tiết kiệm:** ~40-60% khi traffic thấp ban đêm.

### 12.2 ECS Fargate Spot

Dùng Spot instances cho môi trường dev/staging:

```yaml
# Trong task definition
capacityProviderStrategy:
  - base: 1
    weight: 1
    capacityProvider: FARGATE
  - base: 0
    weight: 100
    capacityProvider: FARGATE_SPOT
```

**Tiết kiệm:** 50-70% cho compute.

### 12.3 CloudFront Cache Optimization

```javascript
// Set long cache cho static assets
// package.json build script
"build": "vite build && aws s3 cp dist/index.html s3://bucket --cache-control max-age=31536000"
```

### 12.4 S3 Intelligent-Tiering

```bash
# Tự động chuyển sang storage class rẻ hơn
aws s3api put-bucket-lifecycle-configuration \
  --bucket medi-path-ease-uploads \
  --lifecycle-configuration '{
    "Rules": [{
      "ID": "archive-old-files",
      "Status": "Enabled",
      "Transitions": [{
        "Days": 90,
        "StorageClass": "INTELLIGENT_TIERING"
      }]
    }]
  }'
```

### 12.5 Chi Phí Hàng Tháng Mục Tiêu

| Phase | Services | Chi Phí |
|-------|----------|---------|
| **Startup** | DocumentDB Serverless + ECS Fargate Spot | $35-50 |
| **Growth** | DocumentDB t3.small + ECS Fargate | $60-80 |
| **Production** | Full architecture | $100-150 |

---

## 13. Monitoring & Alerts

### 13.1 CloudWatch Alarms

```bash
# CPU utilization > 80%
aws cloudwatch put-metric-alarm \
  --alarm-name medi-path-cpu-high \
  --alarm-description "CPU > 80% for 5 minutes" \
  --metric-name CPUUtilization \
  --namespace AWS/ECS \
  --statistic Average \
  --period 300 \
  --threshold 80 \
  --comparison-operator GreaterThanThreshold \
  --dimensions Name=ClusterName,Value=medi-path-ease-cluster Name=ServiceName,Value=medi-path-ease-backend \
  --evaluation-periods 1
```

### 13.2 Billing Alert

AWS Console → Billing → Budgets → Create budget:
- Monthly cost budget: $150
- Alert at 50%, 80%, 100%

### 13.3 Log Insights Query

```sql
fields @timestamp, @message
| filter @message like /error/i
| sort @timestamp desc
| limit 20
```

---

## Checklist Trước Khi Production

- [ ] DocumentDB encryption at rest enabled
- [ ] VPC endpoints cho S3 và Secrets Manager
- [ ] IAM roles với least privilege
- [ ] CloudWatch Logs enabled
- [ ] Backup strategy configured
- [ ] SSL certificate validation complete
- [ ] Health check endpoint `/api/health` implemented
- [ ] Error handling in backend
- [ ] Rate limiting enabled
- [ ] CORS configured correctly

---

## Troubleshooting

### Không Kết Nối Được DocumentDB

```bash
# Kiểm tra security group
aws ec2 describe-security-groups --group-ids <sg-id>

# Test connection từ ECS
aws ecs execute-command \
  --cluster medi-path-ease-cluster \
  --task <task-arn> \
  --container backend \
  --command "mongosh <docdb-endpoint>"
```

### ECS Task Không Start

```bash
# Xem logs
aws logs tail /ecs/medi-path-ease --follow

# Kiểm tra task definition
aws ecs describe-task-definition --task-definition medi-path-ease-backend

# Check service events
aws ecs describe-services \
  --cluster medi-path-ease-cluster \
  --services medi-path-ease-backend \
  --query 'services[0].events'
```

### CloudFront Cache Not Updating

```bash
# Force invalidation
aws cloudfront create-invalidation \
  --distribution-id <id> \
  --paths "/*"
```

---

## Liên Hệ & Hỗ Trợ

- AWS Documentation: https://docs.aws.amazon.com
- ECS Developer Guide: https://docs.aws.amazon.com/ecs
- AWS Support: https://aws.amazon.com/support
