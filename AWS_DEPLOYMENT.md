# Deploy SquadNav on one AWS EC2 server

This is the recommended setup for the five-user TestFlight pilot. One EC2 instance runs the Node API, PostgreSQL, Redis, and Caddy in Docker. Caddy provides automatic HTTPS and secure WebSocket support.

## Before opening AWS

You need:

- A domain name you control
- This GitHub repository
- Access to the Expo project that owns the TestFlight build

Use `us-east-2` unless you already use another AWS Region.

## 1. Create the EC2 instance

In **AWS Console > EC2 > Instances > Launch instances**:

1. Name it `blockwatch`.
2. Select **Ubuntu Server 24.04 LTS**.
3. Select the **64-bit Arm** image when using `t4g.small`, or the x86 image when using `t3.small`.
4. Select `t4g.small` (recommended) or `t3.small`.
5. Create or select an SSH key pair. Download the private key once and store it safely.
6. Use the default VPC and a public subnet.
7. Create a security group with:
   - SSH TCP 22 from **My IP**, not from everywhere
   - HTTP TCP 80 from anywhere
   - HTTPS TCP 443 from anywhere
8. Do not open ports 5432, 6379, or 8787.
9. Configure 30–40 GB of encrypted gp3 storage.
10. Launch the instance.

## 2. Assign a permanent address

1. Open **EC2 > Elastic IP addresses**.
2. Allocate an Elastic IP.
3. Associate it with the `blockwatch` instance.
4. At your DNS provider, create an `A` record such as:

```text
api.example.com -> EC2_ELASTIC_IP
```

Wait until the hostname resolves to the Elastic IP. Caddy cannot obtain the TLS certificate until ports 80 and 443 are reachable and DNS is correct.

## 3. Connect to the server

Select the instance and click **Connect**. The browser-based EC2 Instance Connect option is easiest. If it is unavailable, use the SSH command AWS displays.

Every remaining server command is entered in that EC2 terminal.

## 4. Install Docker and Git

```bash
sudo apt-get update
sudo apt-get install -y docker.io docker-compose-v2 git
sudo usermod -aG docker ubuntu
```

Sign out of the EC2 terminal and reconnect so the Docker group takes effect. Confirm:

```bash
docker version
docker compose version
```

## 5. Download SquadNav

```bash
git clone https://github.com/dallgood92/PoliceNav.git
cd PoliceNav
```

If the repository is private, use a GitHub deploy key or short-lived personal access token. Do not paste a long-lived GitHub password into the server.

## 6. Create production secrets

Create the production environment file:

```bash
cp deploy/.env.example deploy/.env
nano deploy/.env
```

In a second terminal, generate three different values:

```bash
openssl rand -hex 32
openssl rand -hex 32
openssl rand -hex 32
```

Fill in `deploy/.env`:

```text
DOMAIN=api.example.com
POSTGRES_PASSWORD=first-generated-value
REDIS_PASSWORD=second-generated-value
LOCATION_API_TOKEN=third-generated-value
DEPARTMENT_JOIN_CODE=replace-with-a-private-department-code
MOVEMENT_ALERT_METERS=152.4
ALERT_COOLDOWN_MS=60000
```

Use only generated hexadecimal passwords here. Do not commit `deploy/.env`; Git ignores it.

Protect it:

```bash
chmod 600 deploy/.env
```

Save the `LOCATION_API_TOKEN` in a password manager because the matching value is required in Expo.

## 7. Start the production stack

Validate the configuration:

```bash
docker compose --env-file deploy/.env -f compose.production.yaml config --quiet
```

Build and start it:

```bash
docker compose --env-file deploy/.env -f compose.production.yaml up -d --build
```

Check container status:

```bash
docker compose --env-file deploy/.env -f compose.production.yaml ps
```

All four services should be running. The API container automatically creates or updates the database schema before starting.

Review startup logs if anything is unhealthy:

```bash
docker compose --env-file deploy/.env -f compose.production.yaml logs --tail 100
```

## 8. Verify HTTPS

From your Mac, replace the example hostname and run:

```bash
curl https://api.example.com/health
```

Expected shape:

```json
{"ok":true,"departments":0,"partners":0,"watches":0}
```

Do not continue until the endpoint uses HTTPS without a certificate warning.

## 9. Configure the production TestFlight build

In the Expo dashboard for SquadNav, open **Project settings > Environment variables**. Add these to the **production** environment:

```text
EXPO_PUBLIC_LOCATION_API_URL=https://api.example.com
EXPO_PUBLIC_LOCATION_API_TOKEN=the LOCATION_API_TOKEN from deploy/.env
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=your iOS Google OAuth client ID
EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID=your Android Google OAuth client ID
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=your Web Google OAuth client ID
```

The API URL and OAuth client IDs are public configuration. The shared location token is also embedded in the app and is only appropriate for this controlled pilot.

Build and submit a new binary from your Mac:

```bash
cd ~/Desktop/Learning/PoliceNav/app
npx eas-cli build --platform ios --profile production
npx eas-cli submit --platform ios --latest
```

The existing TestFlight binary cannot acquire the server address after it was compiled. Install the newly processed build.

## 10. Add backups

First test a database backup on EC2:

```bash
sudo mkdir -p /var/backups/blockwatch
sudo chown ubuntu:ubuntu /var/backups/blockwatch
chmod +x deploy/backup.sh
./deploy/backup.sh
```

Then schedule it:

```bash
crontab -e
```

Add this line, replacing the path if the repository is elsewhere:

```text
15 3 * * * cd /home/ubuntu/PoliceNav && ./deploy/backup.sh >> /home/ubuntu/blockwatch-backup.log 2>&1
```

This retains 14 days of PostgreSQL dumps. Also use **AWS Data Lifecycle Manager** to create daily EBS snapshots; snapshots protect the entire server if the instance or volume is lost.

## 11. Install updates later

After repository changes are pushed, run on EC2:

```bash
cd ~/PoliceNav
git pull --ff-only
docker compose --env-file deploy/.env -f compose.production.yaml up -d --build
```

Check health again after every deployment.

## 12. Test with the five phones

1. Install the new TestFlight build on two phones first.
2. Sign in using different Google accounts.
3. Create a department on one phone.
4. Request and approve membership from the second phone.
5. Assign both users to the same squad.
6. Enter each officer's real unit and call sign.
7. Grant precise and Always location access.
8. Confirm that partner movement updates on the other phone.
9. Test one- and two-person units.
10. Test traffic-stop and cover-request notifications.
11. Lock one phone and verify that background sharing continues.
12. Repeat for the remaining three users.

## Recovery and limitations

The Docker volumes survive container restarts and normal deployments. Never run `docker compose down -v`; the `-v` option deletes PostgreSQL and Redis volumes.

This single server is a single point of failure. It is appropriate for a five-user pilot but not an emergency-service availability guarantee. Keep dispatch procedures as the authoritative fallback.

The current shared bearer token is also only a pilot mechanism. Before operational use, the backend must validate identities and enforce department/squad visibility server-side rather than relying on filtering in the mobile client.
