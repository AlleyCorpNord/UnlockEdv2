# Canvas LMS Setup Guide

This guide documents how to set up Canvas LMS alongside UnlockEd for OAuth integration testing and development.

## Prerequisites

- Docker and Docker Compose installed
- Git installed
- At least 4GB of free disk space
- The UnlockEd project already set up and running

## Quick Start

### 1. Clone Canvas LMS

```bash
# From the UnlockEd root directory
git clone https://github.com/instructure/canvas-lms.git canvas-lms
cd canvas-lms
```

### 2. Set Up Canvas Environment

```bash
# Copy the database configuration from the docker-compose template
cp docker-compose/config/database.yml config/database.yml

# Copy the docker-compose override file
cp config/docker-compose.override.yml.example docker-compose.override.yml

# Create a blank .env file (Canvas will use environment variables)
touch .env
```

### 3. Build Docker Images

```bash
# Build the Canvas images
docker compose build --pull
```

This will build:
- `canvas-lms-web` - Rails application server (Passenger + Nginx)
- `canvas-lms-jobs` - Delayed job worker
- `canvas-lms-postgres` - PostgreSQL database
- `canvas-lms-webpack` - Asset compiler
- `canvas-lms-githook_installer` - Git hook setup

### 4. Initialize Assets and Database

```bash
# Prepare the web service without starting it
docker compose up --no-start web

# Install JavaScript assets and compile CSS/JS
docker compose run --rm web ./script/install_assets.sh

# Create databases and run initial setup
docker compose run --rm web bundle exec rake db:create db:initial_setup

# Migrate test database
docker compose run --rm web bundle exec rake db:migrate RAILS_ENV=test
```

Note: The `install_assets.sh` script can take 10-15 minutes as it compiles all Canvas stylesheets and assets with multiple theme variants.

### 5. Start Canvas Services

```bash
# Start all Canvas services in detached mode
docker compose up -d

# Wait for services to initialize (first boot takes ~30 seconds)
sleep 30

# Verify Canvas is running and responding
curl -I http://127.0.0.1:3000/
# Should return: HTTP/1.1 302 Found (redirect to login)
```

## Connecting Canvas to UnlockEd

### Network Configuration

Canvas runs in its own Docker Compose project with its own network (`canvas-lms_default`). To allow UnlockEd to reach Canvas, connect the Canvas web service to UnlockEd's network **with the `canvas.docker` alias**:

```bash
docker network connect --alias canvas.docker unlockedv2_intranet canvas-lms-web-1
```

The `--alias canvas.docker` is required because:
- Canvas is configured to serve requests at `canvas.docker` (see `config/domain.yml`)
- Canvas's Rails Host Authorization middleware rejects requests with unknown `Host` headers
- Using the alias means the UnlockEd backend resolves `canvas.docker` directly to the Canvas container, so requests arrive with the correct host

> **After every Canvas restart** you must reconnect with the alias — it does not persist:
> ```bash
> docker network connect --alias canvas.docker unlockedv2_intranet canvas-lms-web-1
> ```

Verify the connection:
```bash
# Should show canvas.docker resolving inside the UnlockEd server container
docker compose exec server getent hosts canvas.docker

# Should return user JSON (not an error)
docker compose exec server curl -s \
  -H "Authorization: Bearer <your-api-token>" \
  "http://canvas.docker/api/v1/users/self"
```

### Nginx Proxy Configuration

The UnlockEd nginx proxy (in `config/dev.nginx.conf`) routes requests to Canvas:

```nginx
location /canvas/ {
  proxy_pass http://canvas-lms-web-1/;
  proxy_http_version 1.1;
  proxy_set_header Upgrade $http_upgrade;
  proxy_set_header Connection 'upgrade';
  proxy_set_header Host $host;
  proxy_cache_bypass $http_upgrade;
  proxy_set_header X-Forwarded-Host $host;
  proxy_set_header X-Forwarded-Proto $scheme;
  proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
}
```

Access Canvas through UnlockEd:
```
http://127.0.0.1/canvas/
```

## Configuration Details

### Database Configuration

The Canvas database configuration in `config/database.yml` uses environment variables:

| Environment Variable | Default | Purpose |
|---|---|---|
| `CANVAS_DATABASE_HOST` | `postgres` | Database hostname |
| `CANVAS_DATABASE_USERNAME` | `postgres` | Database user |
| `POSTGRES_PASSWORD` | `your_password` | Database password |
| `CANVAS_DATABASE_DEVELOPMENT` | `canvas_development` | Development database name |
| `CANVAS_DATABASE_TEST` | `canvas_test` | Test database name |

These are defined in `docker-compose.yml` and the docker-compose PostgreSQL service.

### Rails Environment

Canvas runs in `development` mode by default (see `docker-compose.override.yml`):

```yaml
environment:
  ENCRYPTION_KEY: facdd3a131ddd8988b14f6e4e01039c93cfa0160
  RAILS_ENV: development
  INCLUDE_INTERNAL_API_DOCS: 'true'
```

## Docker Compose Services

### Canvas Services

When `docker compose up` is run in the `canvas-lms` directory:

| Service | Image | Purpose |
|---|---|---|
| `web` | `canvas-lms-web` | Rails application server (Passenger + Nginx) |
| `jobs` | `canvas-lms-jobs` | Delayed job background worker |
| `postgres` | Custom PostgreSQL | Database with pgvector extension |
| `redis` | `redis:alpine` | Cache and message queue |
| `webpack` | `canvas-lms-webpack` | Asset compiler (watches for changes) |
| `githook_installer` | `canvas-lms-githook_installer` | Sets up git hooks |

### Key Details

- **Web Service Port**: Internally port 80 (Nginx), exposed as port 3000 on host
- **PostgreSQL Port**: 5432 (internal to Canvas network)
- **Redis Port**: 6379 (internal to Canvas network)
- **Asset Compilation**: Happens automatically in background via webpack service
- **Database Persistence**: Uses named volume `pg_data` for Canvas PostgreSQL

## Useful Commands

### View Logs

```bash
# View all Canvas service logs
docker compose logs -f

# View specific service logs (e.g., web)
docker compose logs -f web

# View recent logs only
docker compose logs web --tail=50
```

### Access Rails Console

```bash
# Open a Rails console in the web service
docker compose run --rm web rails c
```

### Run Database Commands

```bash
# Create fresh databases
docker compose run --rm web bundle exec rake db:create db:initial_setup

# Run migrations
docker compose run --rm web bundle exec rake db:migrate

# Seed with sample data
docker compose run --rm web bundle exec rake db:seed
```

### Restart Services

```bash
# Restart a specific service
docker compose restart web

# Restart all services
docker compose restart

# Stop and remove all services (keeps volumes)
docker compose down

# Stop and remove everything including data
docker compose down -v
```

## Troubleshooting

### Canvas Returns 502 Bad Gateway

This usually means Canvas didn't start properly. Check logs:

```bash
docker compose logs web | tail -50
```

Common causes:
- **Passenger timeout**: Rails app taking too long to boot. Wait longer or check for database issues.
- **Database not ready**: Ensure postgres is healthy: `docker compose ps postgres`
- **Missing config files**: Verify `config/database.yml` exists

### Passenger Spawn Timeout

Canvas rails app takes ~30-60 seconds to boot on first startup. This is normal. Subsequent requests should be faster.

### Port Already in Use

If port 3000 is already in use:

```bash
# Find what's using port 3000
lsof -i :3000

# Or change the port mapping in docker-compose.override.yml:
# Change: - "3000:80"
# To: - "3001:80"  (or another free port)
```

### Database Migration Errors

If migrations fail, check if database exists:

```bash
# Verify databases were created
docker compose exec postgres psql -U postgres -l

# If not, create them manually
docker compose run --rm web bundle exec rake db:create
```

### Network Connection Issues

If UnlockEd can't reach Canvas:

```bash
# Verify Canvas is on the UnlockEd network
docker network inspect unlockedv2_intranet | grep canvas-lms-web-1

# If not connected, reconnect:
docker network connect unlockedv2_intranet canvas-lms-web-1

# Verify nginx can reach Canvas
docker compose exec rev_proxy curl -I http://canvas-lms-web-1/
```

## API Key Integration with UnlockEd

UnlockEd connects to Canvas using long-lived API access tokens (not OAuth). No redirects or client credentials are needed.

### Backend Implementation

- **Handler**: `backend/src/handlers/canvas_handler.go`
- **Database methods**: `backend/src/database/canvas.go`
- **Models**: `backend/src/models/canvas.go`
- **API client**: `backend/src/handlers/canvas_client.go`

### Frontend Implementation

- **Integration page**: `frontend/src/Pages/CanvasIntegration.tsx`
- **Connection modal**: `frontend/src/Components/modals/ConnectCanvasModal.tsx`
- **Canvas components**: `frontend/src/Components/Canvas/`

### API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/canvas/api-keys` | Save a Canvas API key |
| `GET` | `/api/canvas/api-keys` | List all Canvas API keys for a facility |
| `DELETE` | `/api/canvas/api-keys/{keyID}` | Remove a Canvas API key |
| `POST` | `/api/canvas/test-connection` | Test if a Canvas URL and API key are valid |

## Canvas Admin Access

### Initial Setup

Canvas doesn't require initial admin setup when using the development database seed. Default credentials should be available or you can create an admin user:

```bash
docker compose run --rm web rails c
```

In the Rails console:
```ruby
user = User.create!(
  name: "Admin User",
  short_name: "Admin",
  email: "admin@example.com",
  password: "password123"
)
user.account_users.create!(account_id: Account.default, role: Role.find_by(name: "AccountAdmin"))
exit
```

Then login to Canvas at `http://127.0.0.1:3000/` with these credentials.

### Generating a Canvas API Token

UnlockEd uses personal access tokens from Canvas (not OAuth Developer Keys).

1. Login to Canvas as an admin at `http://127.0.0.1:3000/`
2. Click your profile icon (top right) → **Settings**
3. Click **Approved Integrations** in the left sidebar
4. Click **+ New Access Token**
   - **Purpose**: `UnlockEd`
   - **Expires**: Leave blank for no expiration
5. Click **Generate Token** and **copy it immediately** — it is only shown once

Verify the token works before adding it to UnlockEd:
```bash
curl -H "Authorization: Bearer <your-token>" \
  "http://localhost:3000/api/v1/users/self"
# Should return user JSON
```

### Connecting Canvas to UnlockEd

1. Visit `http://127.0.0.1/canvas-integration` in UnlockEd
2. Click **Connect Canvas Instance**
3. **Canvas URL**: `http://canvas.docker` ← must use this, not `localhost`
4. **Canvas API Key**: paste your access token
5. Click submit — UnlockEd tests the connection before saving

## File Structure

```
canvas-lms/                          # Canvas LMS repository (cloned)
├── docker-compose.yml               # Main docker-compose file
├── docker-compose.override.yml      # Override for development (symlinked from example)
├── config/
│   ├── database.yml                 # Database configuration (from docker-compose/config)
│   ├── docker-compose.override.yml.example
│   └── ...
├── docker-compose/
│   ├── config/
│   │   └── database.yml.example    # Template used for config/database.yml
│   ├── postgres/                   # Custom PostgreSQL Docker image
│   └── ...
└── ... (Canvas source code)
```

## Key Configuration Files

### docker-compose.override.yml

Defines development-specific overrides:
- Volume mounts for live code reloading
- `ENCRYPTION_KEY` for development
- `ADDITIONAL_ALLOWED_HOSTS` — allows the Canvas Rails app to accept requests from Docker hostnames. Required for UnlockEd's backend to call the Canvas API:
  ```yaml
  ADDITIONAL_ALLOWED_HOSTS: "canvas-lms-web-1,canvas.docker,localhost,127.0.0.1"
  ```
- Webpack service for asset compilation
- Database volume configuration

### config/database.yml

Database connection configuration using environment variables. Supports:
- Multiple databases (development, test, production)
- Replica configuration for test sharding
- PostgreSQL-specific settings

## Performance Notes

### First-Time Build and Setup

- Docker image build: 2-5 minutes
- Asset compilation: 10-15 minutes
- Database initialization: 2-5 minutes
- **Total initial setup: 15-25 minutes**

### First Boot After Restart

- Rails application boot: 30-60 seconds
- Subsequent requests: < 5 seconds

### Memory Requirements

Canvas LMS requires:
- Minimum: 2GB RAM free
- Recommended: 4GB+ RAM free
- Each process (web, jobs) uses ~300-500MB

## Additional Resources

- [Canvas LMS GitHub](https://github.com/instructure/canvas-lms)
- [Canvas Development Documentation](https://github.com/instructure/canvas-lms/tree/master/doc/docker)
- [Canvas API Documentation](https://canvas.instructure.com/doc/api/)
- [UnlockEd Canvas Integration Files](./backend/src/handlers/canvas_handler.go)

## Support and Debugging

For Canvas-specific issues:
1. Check Canvas logs: `docker compose logs web`
2. Check UnlockEd backend logs for Canvas API errors
3. Review Canvas development docs: `canvas-lms/doc/docker/`
4. Check UnlockEd's Canvas handler for implementation details

For network/Docker issues:
1. Verify all containers are running: `docker compose ps`
2. Verify networks are connected: `docker network inspect unlockedv2_intranet`
3. Test connectivity between services
4. Check port mappings and firewall rules
