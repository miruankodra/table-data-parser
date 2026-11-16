#!/usr/bin/env bash
#
# Full setup of the Table Data Parser on Ubuntu 22.04 / 24.04.
#
#   ./scripts/setup-ubuntu.sh [/path/to/google-service-account.json]
#
# Optional environment variables:
#   PHP_VERSION (8.3)  NODE_MAJOR (22)  DB_NAME  DB_USER  APP_URL
#   SEED_ADMIN_EMAIL  SEED_ADMIN_PASSWORD  GOOGLE_KEY_FILE
#
# Safe to run more than once.

set -euo pipefail

PHP_VERSION="${PHP_VERSION:-8.3}"
NODE_MAJOR="${NODE_MAJOR:-22}"
DB_NAME="${DB_NAME:-table_data_parser}"
DB_USER="${DB_USER:-parser}"
APP_URL="${APP_URL:-http://localhost:8000}"
SEED_ADMIN_EMAIL="${SEED_ADMIN_EMAIL:-admin@example.com}"
SEED_ADMIN_PASSWORD="${SEED_ADMIN_PASSWORD:-password}"
KEY_FILE="${1:-${GOOGLE_KEY_FILE:-}}"

cd "$(dirname "${BASH_SOURCE[0]}")/.."
PROJECT_DIR="$(pwd)"

# ---------------------------------------------------------------- helpers
step() { printf '\n\033[1;34m==> %s\033[0m\n' "$*"; }
warn() { printf '\033[1;33m!!  %s\033[0m\n' "$*"; }
die()  { printf '\033[1;31mxx  %s\033[0m\n' "$*" >&2; exit 1; }

if [ "$(id -u)" -eq 0 ]; then
  SUDO=""
  export COMPOSER_ALLOW_SUPERUSER=1
  warn "Running as root. Fine in a container; on a normal server use a regular user with sudo."
else
  command -v sudo >/dev/null || die "sudo is required when not running as root."
  SUDO="sudo"
fi

apt_install() { $SUDO env DEBIAN_FRONTEND=noninteractive apt-get install -y "$@"; }

start_service() {
  if [ -d /run/systemd/system ]; then
    $SUDO systemctl enable --now "$1"
  else
    $SUDO service "$1" start          # containers without systemd
  fi
}

env_get() { grep -E "^$1=" .env | head -n1 | cut -d= -f2- || true; }

env_set() {
  local key="$1" value="$2"
  if grep -qE "^#?[[:space:]]*${key}=" .env; then
    sed -i -E "s|^#?[[:space:]]*${key}=.*|${key}=${value}|" .env
  else
    printf '%s=%s\n' "$key" "$value" >> .env
  fi
}

env_default() { [ -n "$(env_get "$1")" ] || env_set "$1" "$2"; }

# ---------------------------------------------------------------- checks
[ -f artisan ] || die "Run this from inside the Laravel project (artisan not found)."

. /etc/os-release
[ "${ID:-}" = "ubuntu" ] || warn "Built for Ubuntu; detected ${PRETTY_NAME:-unknown}. Continuing anyway."

# ---------------------------------------------------------------- system packages
step "System packages"
$SUDO apt-get update
apt_install ca-certificates curl git unzip gnupg openssl cron software-properties-common

# ---------------------------------------------------------------- PHP
step "PHP ${PHP_VERSION}"
if ! apt-cache show "php${PHP_VERSION}-cli" >/dev/null 2>&1; then
  warn "PHP ${PHP_VERSION} is not in the default repositories; adding ppa:ondrej/php"
  $SUDO add-apt-repository -y ppa:ondrej/php
  $SUDO apt-get update
fi
apt_install "php${PHP_VERSION}-cli" "php${PHP_VERSION}-mbstring" "php${PHP_VERSION}-xml" \
            "php${PHP_VERSION}-curl" "php${PHP_VERSION}-mysql" "php${PHP_VERSION}-zip" \
            "php${PHP_VERSION}-bcmath" "php${PHP_VERSION}-intl"
[ -x "/usr/bin/php${PHP_VERSION}" ] && $SUDO update-alternatives --set php "/usr/bin/php${PHP_VERSION}" >/dev/null 2>&1 || true
php -v | head -n1

# ---------------------------------------------------------------- Composer
step "Composer"
if ! command -v composer >/dev/null; then
  expected="$(curl -fsSL https://composer.github.io/installer.sig)"
  php -r "copy('https://getcomposer.org/installer', '/tmp/composer-setup.php');"
  actual="$(php -r "echo hash_file('sha384', '/tmp/composer-setup.php');")"
  [ "$expected" = "$actual" ] || { rm -f /tmp/composer-setup.php; die "Composer installer checksum mismatch."; }
  $SUDO php /tmp/composer-setup.php --install-dir=/usr/local/bin --filename=composer
  rm -f /tmp/composer-setup.php
fi
composer --version

# ---------------------------------------------------------------- Node
step "Node.js"
need_node=1
if command -v node >/dev/null; then
  major="$(node -p "process.versions.node.split('.')[0]")"
  [ "$major" -ge 20 ] && need_node=0
fi
if [ "$need_node" -eq 1 ]; then
  curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | $SUDO -E bash -
  apt_install nodejs
fi
node -v

# ---------------------------------------------------------------- .env
step "Environment file"
[ -f .env ] || cp .env.example .env

DB_PASS="$(env_get DB_PASSWORD)"
[ -n "$DB_PASS" ] || DB_PASS="$(openssl rand -hex 16)"

env_set DB_CONNECTION mysql
env_set DB_HOST 127.0.0.1
env_set DB_PORT 3306
env_set DB_DATABASE "$DB_NAME"
env_set DB_USERNAME "$DB_USER"
env_set DB_PASSWORD "$DB_PASS"
env_set APP_URL "$APP_URL"
env_set GOOGLE_APPLICATION_CREDENTIALS storage/app/google/service-account.json
env_default SHEETS_DATE_FORMAT 'd/m/Y'

# ---------------------------------------------------------------- MySQL
step "MySQL"
apt_install mysql-server
start_service mysql

for _ in $(seq 1 30); do
  $SUDO mysqladmin ping --silent 2>/dev/null && break
  sleep 1
done
$SUDO mysqladmin ping --silent || die "MySQL did not start."

# The app runs CREATE TABLE / ALTER TABLE at runtime, so it needs full rights on its own database
$SUDO mysql <<SQL
CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS '${DB_USER}'@'localhost' IDENTIFIED BY '${DB_PASS}';
ALTER USER '${DB_USER}'@'localhost' IDENTIFIED BY '${DB_PASS}';
GRANT ALL PRIVILEGES ON \`${DB_NAME}\`.* TO '${DB_USER}'@'localhost';
FLUSH PRIVILEGES;
SQL

# ---------------------------------------------------------------- Google key
step "Google service account key"
mkdir -p storage/app/google
KEY_DEST="storage/app/google/service-account.json"

if [ -n "$KEY_FILE" ]; then
  [ -f "$KEY_FILE" ] || die "Key file not found: $KEY_FILE"
  php -r '$j = json_decode(file_get_contents($argv[1]), true); exit(isset($j["client_email"], $j["private_key"]) ? 0 : 1);' "$KEY_FILE" \
    || die "That file does not look like a service account JSON key."
  if [ "$(realpath "$KEY_FILE")" != "$(realpath "$KEY_DEST" 2>/dev/null || true)" ]; then
    cp "$KEY_FILE" "$KEY_DEST"
  fi
  chmod 600 "$KEY_DEST"
  echo "Key installed at ${KEY_DEST}"
elif [ -f "$KEY_DEST" ]; then
  echo "Using the existing ${KEY_DEST}"
else
  warn "No key provided. Follow GOOGLE_SETUP.md, then re-run with the key path or copy it to ${KEY_DEST}."
fi

# ---------------------------------------------------------------- application
step "PHP dependencies"
composer install --no-interaction --prefer-dist
grep -qE '^APP_KEY=.+' .env || php artisan key:generate --force
php artisan config:clear

step "Frontend build"
if [ -f package-lock.json ]; then npm ci; else npm install; fi
npm run build

step "Database migrations and admin user"
php artisan migrate --force
SEED_ADMIN_EMAIL="$SEED_ADMIN_EMAIL" SEED_ADMIN_PASSWORD="$SEED_ADMIN_PASSWORD" \
  php artisan db:seed --class=AdminUserSeeder --force

chmod -R ug+rwX storage bootstrap/cache

# ---------------------------------------------------------------- scheduler
step "Scheduler (daily import)"
start_service cron || warn "Could not start cron; start it manually."
CRON_LINE="* * * * * cd ${PROJECT_DIR} && php artisan schedule:run >> /dev/null 2>&1"
( crontab -l 2>/dev/null | grep -vF "cd ${PROJECT_DIR} && php artisan schedule:run" || true; echo "$CRON_LINE" ) | crontab -
php artisan schedule:list || true

# ---------------------------------------------------------------- summary
SA_EMAIL="$(php artisan tinker --execute='echo app(App\Services\GoogleSheetsService::class)->serviceAccountEmail();' 2>/dev/null | tail -n1 || true)"

step "Done"
cat <<EOF

  Start the app:   php artisan serve --host=0.0.0.0 --port=8000
  Open:            ${APP_URL}

  Login:           ${SEED_ADMIN_EMAIL}
  Password:        ${SEED_ADMIN_PASSWORD}   (testing credentials; change them for real use)

  Database:        ${DB_NAME}  (user: ${DB_USER}, password saved in .env)
  Service account: ${SA_EMAIL:-not configured yet, see GOOGLE_SETUP.md}
                   Share each Google Sheet with this email as Viewer.

  The daily import runs at 02:00 through cron. Run it now with: php artisan sheets:import

EOF