#!/bin/sh
# Starts the TeachWise demo: fresh SQLite database with demo data, then Apache.
set -e
cd /var/www/html

export PORT="${PORT:-10000}"
grep -q "Listen ${PORT}" /etc/apache2/ports.conf || echo "Listen ${PORT}" > /etc/apache2/ports.conf
export APP_URL="${APP_URL:-${RENDER_EXTERNAL_URL:-http://localhost:${PORT}}}"
if [ -z "${APP_KEY}" ]; then
    APP_KEY="$(php artisan key:generate --show --no-interaction)"
    export APP_KEY
fi

rm -f "$DB_DATABASE" && touch "$DB_DATABASE"
php artisan migrate --force --seed --no-interaction
php artisan teachwise:demo --force --no-interaction
php artisan config:cache --no-interaction
chown -R www-data:www-data storage bootstrap/cache database

exec apache2-foreground
