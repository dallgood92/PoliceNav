# AWS deployment checklist

This checklist deploys the BlockWatch API as an ECS Fargate service behind an HTTPS Application Load Balancer. PostgreSQL runs in RDS and live location state runs in ElastiCache for Valkey/Redis.

Use one AWS Region for every resource. `us-east-2` is a reasonable default for a Denton County pilot.

## Values to record

Keep these values in a password manager while working through the checklist:

```text
AWS_REGION=
AWS_ACCOUNT_ID=
ECR_IMAGE_URI=
DATABASE_URL=
REDIS_URL=
LOCATION_API_TOKEN=
API_URL=
```

Do not commit their real values to Git.

## 1. Create the network

1. In **VPC > Create VPC**, choose **VPC and more**.
2. Create two public and two private subnets across two Availability Zones.
3. Put the load balancer in the public subnets.
4. Put RDS and ElastiCache in the private subnets.
5. For the least expensive pilot, run the ECS task in the public subnets with **Assign public IP** enabled. Its security group will still accept inbound traffic only from the load balancer. A production private-subnet deployment needs NAT or appropriate VPC endpoints plus outbound access for Expo push delivery.

Create these security groups:

| Security group | Inbound rule |
| --- | --- |
| `blockwatch-alb` | TCP 443 from the internet; TCP 80 only for HTTPS redirect |
| `blockwatch-api` | TCP 8787 from `blockwatch-alb` only |
| `blockwatch-postgres` | TCP 5432 from `blockwatch-api` only |
| `blockwatch-redis` | TCP 6379 from `blockwatch-api` only |

Never expose PostgreSQL or Redis directly to the internet.

## 2. Create PostgreSQL

1. In **RDS > Databases > Create database**, select PostgreSQL.
2. Use database name `blockwatch`.
3. Select the VPC and private database subnet group.
4. Set **Public access** to **No**.
5. Attach `blockwatch-postgres`.
6. Enable storage encryption and automated backups.
7. Save the generated database password.

Build the connection value from the endpoint shown by RDS:

```text
postgresql://USERNAME:PASSWORD@RDS_ENDPOINT:5432/blockwatch?sslmode=require
```

Percent-encode special characters in the username or password when placing them in a URL.

## 3. Create Redis/Valkey

1. In **ElastiCache**, create a Valkey or Redis OSS cache in the same VPC.
2. Select private subnets and attach `blockwatch-redis`.
3. Enable encryption in transit.
4. Enable authentication and save the authentication token.

Build the connection value from its primary endpoint:

```text
rediss://default:AUTH_TOKEN@PRIMARY_ENDPOINT:6379
```

Use `rediss`, not `redis`, when in-transit encryption is enabled.

## 4. Create backend secrets

Generate a temporary pilot API token locally:

```bash
openssl rand -hex 32
```

In **Secrets Manager**, create three secrets:

```text
blockwatch/DATABASE_URL
blockwatch/REDIS_URL
blockwatch/LOCATION_API_TOKEN
```

Paste each complete value into its matching secret. The ECS task execution role must have `secretsmanager:GetSecretValue` permission for these three secrets.

## 5. Upload the backend container

1. In **ECR > Repositories**, create `blockwatch-backend`.
2. Open the repository and select **View push commands**.
3. Run its Docker login command.
4. From the app repository, build and push for Fargate ARM64:

```bash
docker buildx build --platform linux/arm64 --tag ACCOUNT.dkr.ecr.REGION.amazonaws.com/blockwatch-backend:latest --push ./backend
```

Use the exact ECR URI displayed in the AWS console. If the ECS task is configured for X86_64, substitute `linux/amd64`.

## 6. Create the ECS task and service

1. Create an ECS cluster using AWS Fargate.
2. Create a Fargate task definition named `blockwatch-api`.
3. Match the task CPU architecture to the container image.
4. Start with 0.25 vCPU and 0.5–1 GB memory for a small pilot.
5. Add the ECR image and expose container port `8787`.
6. Map the three Secrets Manager values to `DATABASE_URL`, `REDIS_URL`, and `LOCATION_API_TOKEN`.
7. Add these normal environment variables:

```text
PORT=8787
MOVEMENT_ALERT_METERS=152.4
ALERT_COOLDOWN_MS=60000
```

8. Send container logs to CloudWatch Logs.
9. Create a service with one desired task and attach `blockwatch-api`.

The container runs the idempotent `db/schema.sql` migration before starting the server. It is safe for restarts and repeated deployments. For future schema changes, use a dedicated one-time migration task before increasing the service beyond one task.

## 7. Create HTTPS and WebSocket access

1. Create an internet-facing Application Load Balancer in the public subnets using `blockwatch-alb`.
2. Create an IP target group on port `8787` with health path `/health`.
3. Attach the target group to the ECS service.
4. Request an ACM certificate for a hostname such as `api.example.com`.
5. Add an HTTPS listener on 443 using that certificate and forward it to the target group.
6. Add an HTTP listener on 80 that redirects to HTTPS.
7. Point the hostname's DNS record at the load balancer.

The same endpoint handles HTTPS API calls and the `/partners` WebSocket upgrade. Do not add sticky sessions; Redis pub/sub distributes partner updates between API tasks.

Confirm that this returns JSON showing healthy PostgreSQL and Redis connections:

```bash
curl https://api.example.com/health
```

## 8. Connect the TestFlight app

In the Expo project dashboard, open **Environment variables**, select **production**, and add:

```text
EXPO_PUBLIC_LOCATION_API_URL=https://api.example.com
EXPO_PUBLIC_LOCATION_API_TOKEN=the-same-pilot-token-used-by-the-server
```

The URL can be plain text. Mark the token sensitive to reduce accidental display, but remember that any `EXPO_PUBLIC_` value is embedded in the app and is not a true secret.

Create and submit the new binary:

```bash
npx eas-cli build --platform ios --profile production
npx eas-cli submit --platform ios --latest
```

The existing TestFlight build cannot discover these values after it was built. Install the newly processed TestFlight build.

## 9. Acceptance test

1. Confirm `/health` returns HTTP 200.
2. Install the new build on two physical iPhones.
3. Sign in with separate users.
4. Create a department, request membership, approve it, and put both users in the same squad.
5. Grant precise and Always location access.
6. Confirm that movement on one phone changes its marker on the other.
7. Lock one phone and confirm background updates continue.
8. Test traffic-stop and cover-request states and the notification tap-through.
9. Restart the ECS task and confirm department data remains.
10. Review CloudWatch logs and configure billing and service-health alarms.

## Pilot limitation

The current shared bearer token is suitable only for a small controlled demonstration. Before operational use, the server must validate user identity and enforce department and squad access itself. Client-side filtering is not an authorization boundary. Cover notifications must also be restricted server-side to the appropriate squad or department.
