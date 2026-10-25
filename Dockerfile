# TeachWise public demo: the Laravel API and the web app in one container.
# Built and run by Render (see render.yaml and docker/README.md). Data lives in SQLite inside the
# container and is rebuilt with fresh demo data every time it starts.

# ---- 1. Web app (Expo, exported as a static site) ----------------------------
FROM node:22-bookworm-slim AS web
WORKDIR /app
COPY app/package.json app/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY app/ ./
# The web app calls the API on its own address (/api), and shows one-click demo accounts.
ENV EXPO_PUBLIC_API_URL=/api \
    EXPO_PUBLIC_DEMO=1
RUN npx expo export -p web --output-dir dist

# ---- 2. PHP packages ----------------------------------------------------------
FROM composer:2 AS vendor
WORKDIR /app
COPY backend/composer.json ./
# Pick package versions for the PHP the server runs (8.3), not the newer PHP in this build image.
RUN composer config platform.php 8.3.30 \
    && composer install --no-dev --no-interaction --prefer-dist --no-progress --no-scripts --no-autoloader --ignore-platform-req=ext-*
COPY backend/ ./
RUN composer config platform.php 8.3.30 && composer dump-autoload --optimize --no-dev --no-scripts

# ---- 3. Runtime: PHP 8.3 + Apache --------------------------------------------
FROM php:8.3-apache
RUN apt-get update \
    && apt-get install -y --no-install-recommends libicu-dev \
    && docker-php-ext-install bcmath intl \
    && rm -rf /var/lib/apt/lists/* \
    && a2enmod rewrite headers \
    && mv "$PHP_INI_DIR/php.ini-production" "$PHP_INI_DIR/php.ini"

WORKDIR /var/www/html
COPY --from=vendor /app ./
COPY --from=web /app/dist ./public/
COPY docker/apache.conf /etc/apache2/sites-available/000-default.conf
COPY docker/public.htaccess ./public/.htaccess
COPY docker/start.sh /usr/local/bin/teachwise-start

ENV APP_ENV=production \
    APP_DEBUG=false \
    LOG_CHANNEL=stderr \
    DB_CONNECTION=sqlite \
    DB_DATABASE=/var/www/html/database/database.sqlite \
    SESSION_DRIVER=file \
    CACHE_STORE=file \
    QUEUE_CONNECTION=sync \
    MAIL_MAILER=log \
    TEACHWISE_PUBLIC_DEMO=true \
    PORT=10000

RUN chmod +x /usr/local/bin/teachwise-start \
    && php artisan package:discover --ansi \
    && chown -R www-data:www-data storage bootstrap/cache database

EXPOSE 10000
CMD ["teachwise-start"]
