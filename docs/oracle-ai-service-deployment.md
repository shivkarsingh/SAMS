# Oracle Always Free AI Service Deployment

This deploys only `ai-service` to Oracle Cloud Always Free Ampere A1 while keeping the frontend/backend wherever they already run.

## 1. Create The VM

In Oracle Cloud Console:

- Create a Compute instance.
- Image: Ubuntu 24.04 or Ubuntu 22.04, `aarch64`.
- Shape: `VM.Standard.A1.Flex`.
- OCPU/RAM: use `4 OCPU / 24 GB RAM` if available, or at least `2 OCPU / 12 GB RAM`.
- Boot volume: 100 GB or more.
- Add your SSH public key.
- Make sure the instance has a public IPv4 address.

Open ingress rules in the VCN security list or network security group:

- TCP `22` from your IP.
- TCP `8000` from the internet, or from your backend host if you can restrict it.

## 2. Install Docker On The VM

SSH into the VM:

```bash
ssh ubuntu@YOUR_ORACLE_PUBLIC_IP
```

Install Docker:

```bash
sudo apt update
sudo apt install -y ca-certificates curl git
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo usermod -aG docker ubuntu
exit
```

SSH back in so the Docker group applies:

```bash
ssh ubuntu@YOUR_ORACLE_PUBLIC_IP
```

## 3. Clone And Configure

```bash
git clone https://github.com/YOUR_GITHUB_USERNAME/YOUR_REPO_NAME.git SAMS
cd SAMS
```

Create a shared secret for backend-to-AI calls:

```bash
openssl rand -hex 32
```

Create `.env` next to `docker-compose.oracle-ai.yml`:

```bash
AI_SERVICE_API_KEY=paste_the_generated_value_here
```

## 4. Start The AI Service

```bash
docker compose -f docker-compose.oracle-ai.yml up -d --build
```

Watch startup logs:

```bash
docker logs -f sams-ai-service
```

The first start may take time while InsightFace downloads `antelopev2` into the persistent `sams_ai_data` Docker volume.

## 5. Verify

Process health:

```bash
curl http://YOUR_ORACLE_PUBLIC_IP:8000/health
```

Model readiness:

```bash
curl http://YOUR_ORACLE_PUBLIC_IP:8000/ready
```

Expected ready state:

```json
{
  "status": "ok",
  "ready": true
}
```

Confirm the active model:

```bash
curl -H "X-AI-Service-Key: paste_the_generated_value_here" \
  http://YOUR_ORACLE_PUBLIC_IP:8000/api/v1/models
```

You want:

```json
{
  "modelPack": "antelopev2",
  "fallbackUsed": false
}
```

## 6. Point Backend To Oracle

In your hosted backend environment variables:

```bash
AI_SERVICE_URL=http://YOUR_ORACLE_PUBLIC_IP:8000
AI_SERVICE_API_KEY=paste_the_same_generated_value_here
AI_HEALTH_TIMEOUT_MS=10000
AI_REQUEST_TIMEOUT_MS=120000
AI_FACE_RECOGNITION_MODEL=ArcFace ResNet100@Glint360K (InsightFace antelopev2)
AI_EXECUTION_MODE=production
```

Redeploy the backend.

Then verify:

```bash
curl https://YOUR_BACKEND_URL/api/v1/health
```

The AI service should no longer be offline. If `/health` is ok but `/ready` is degraded, check:

```bash
docker logs sams-ai-service
docker exec -it sams-ai-service du -sh /app/data/model_assets
```

## 7. Updating Later

```bash
cd ~/SAMS
git pull
docker compose -f docker-compose.oracle-ai.yml up -d --build
```

The Docker volume keeps model assets, enrolled profiles, and attendance sessions across container rebuilds.
