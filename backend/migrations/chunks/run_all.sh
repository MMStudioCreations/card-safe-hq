#!/bin/bash
# Run all D1 migration chunks in order
# Usage: bash run_all.sh <CLOUDFLARE_API_TOKEN>

TOKEN="${1:-$CLOUDFLARE_API_TOKEN}"
if [ -z "$TOKEN" ]; then echo "Usage: bash run_all.sh <TOKEN>"; exit 1; fi

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR/../.."

echo "Running 0000_sets.sql..."
CLOUDFLARE_API_TOKEN="$TOKEN" npx wrangler d1 execute card-vault-db --remote --file="migrations/chunks/0000_sets.sql" --yes
if [ $? -ne 0 ]; then echo "FAILED on {fname}"; exit 1; fi

echo "Running 0001_cards.sql..."
CLOUDFLARE_API_TOKEN="$TOKEN" npx wrangler d1 execute card-vault-db --remote --file="migrations/chunks/0001_cards.sql" --yes
if [ $? -ne 0 ]; then echo "FAILED on {fname}"; exit 1; fi

echo "Running 0002_cards.sql..."
CLOUDFLARE_API_TOKEN="$TOKEN" npx wrangler d1 execute card-vault-db --remote --file="migrations/chunks/0002_cards.sql" --yes
if [ $? -ne 0 ]; then echo "FAILED on {fname}"; exit 1; fi

echo "Running 0003_cards.sql..."
CLOUDFLARE_API_TOKEN="$TOKEN" npx wrangler d1 execute card-vault-db --remote --file="migrations/chunks/0003_cards.sql" --yes
if [ $? -ne 0 ]; then echo "FAILED on {fname}"; exit 1; fi

echo "Running 0004_cards.sql..."
CLOUDFLARE_API_TOKEN="$TOKEN" npx wrangler d1 execute card-vault-db --remote --file="migrations/chunks/0004_cards.sql" --yes
if [ $? -ne 0 ]; then echo "FAILED on {fname}"; exit 1; fi

echo "Running 0005_cards.sql..."
CLOUDFLARE_API_TOKEN="$TOKEN" npx wrangler d1 execute card-vault-db --remote --file="migrations/chunks/0005_cards.sql" --yes
if [ $? -ne 0 ]; then echo "FAILED on {fname}"; exit 1; fi

echo "Running 0006_cards.sql..."
CLOUDFLARE_API_TOKEN="$TOKEN" npx wrangler d1 execute card-vault-db --remote --file="migrations/chunks/0006_cards.sql" --yes
if [ $? -ne 0 ]; then echo "FAILED on {fname}"; exit 1; fi

echo "Running 0007_cards.sql..."
CLOUDFLARE_API_TOKEN="$TOKEN" npx wrangler d1 execute card-vault-db --remote --file="migrations/chunks/0007_cards.sql" --yes
if [ $? -ne 0 ]; then echo "FAILED on {fname}"; exit 1; fi

echo "Running 0008_cards.sql..."
CLOUDFLARE_API_TOKEN="$TOKEN" npx wrangler d1 execute card-vault-db --remote --file="migrations/chunks/0008_cards.sql" --yes
if [ $? -ne 0 ]; then echo "FAILED on {fname}"; exit 1; fi

echo "Running 0009_cards.sql..."
CLOUDFLARE_API_TOKEN="$TOKEN" npx wrangler d1 execute card-vault-db --remote --file="migrations/chunks/0009_cards.sql" --yes
if [ $? -ne 0 ]; then echo "FAILED on {fname}"; exit 1; fi

echo "Running 0010_cards.sql..."
CLOUDFLARE_API_TOKEN="$TOKEN" npx wrangler d1 execute card-vault-db --remote --file="migrations/chunks/0010_cards.sql" --yes
if [ $? -ne 0 ]; then echo "FAILED on {fname}"; exit 1; fi

echo "Running 0011_cards.sql..."
CLOUDFLARE_API_TOKEN="$TOKEN" npx wrangler d1 execute card-vault-db --remote --file="migrations/chunks/0011_cards.sql" --yes
if [ $? -ne 0 ]; then echo "FAILED on {fname}"; exit 1; fi

echo "Running 0012_cards.sql..."
CLOUDFLARE_API_TOKEN="$TOKEN" npx wrangler d1 execute card-vault-db --remote --file="migrations/chunks/0012_cards.sql" --yes
if [ $? -ne 0 ]; then echo "FAILED on {fname}"; exit 1; fi

echo "Running 0013_cards.sql..."
CLOUDFLARE_API_TOKEN="$TOKEN" npx wrangler d1 execute card-vault-db --remote --file="migrations/chunks/0013_cards.sql" --yes
if [ $? -ne 0 ]; then echo "FAILED on {fname}"; exit 1; fi

echo "Running 0014_cards.sql..."
CLOUDFLARE_API_TOKEN="$TOKEN" npx wrangler d1 execute card-vault-db --remote --file="migrations/chunks/0014_cards.sql" --yes
if [ $? -ne 0 ]; then echo "FAILED on {fname}"; exit 1; fi

echo "Running 0015_cards.sql..."
CLOUDFLARE_API_TOKEN="$TOKEN" npx wrangler d1 execute card-vault-db --remote --file="migrations/chunks/0015_cards.sql" --yes
if [ $? -ne 0 ]; then echo "FAILED on {fname}"; exit 1; fi

echo "Running 0016_cards.sql..."
CLOUDFLARE_API_TOKEN="$TOKEN" npx wrangler d1 execute card-vault-db --remote --file="migrations/chunks/0016_cards.sql" --yes
if [ $? -ne 0 ]; then echo "FAILED on {fname}"; exit 1; fi

echo "Running 0017_cards.sql..."
CLOUDFLARE_API_TOKEN="$TOKEN" npx wrangler d1 execute card-vault-db --remote --file="migrations/chunks/0017_cards.sql" --yes
if [ $? -ne 0 ]; then echo "FAILED on {fname}"; exit 1; fi

echo "Running 0018_cards.sql..."
CLOUDFLARE_API_TOKEN="$TOKEN" npx wrangler d1 execute card-vault-db --remote --file="migrations/chunks/0018_cards.sql" --yes
if [ $? -ne 0 ]; then echo "FAILED on {fname}"; exit 1; fi

echo "Running 0019_cards.sql..."
CLOUDFLARE_API_TOKEN="$TOKEN" npx wrangler d1 execute card-vault-db --remote --file="migrations/chunks/0019_cards.sql" --yes
if [ $? -ne 0 ]; then echo "FAILED on {fname}"; exit 1; fi

echo "Running 0020_cards.sql..."
CLOUDFLARE_API_TOKEN="$TOKEN" npx wrangler d1 execute card-vault-db --remote --file="migrations/chunks/0020_cards.sql" --yes
if [ $? -ne 0 ]; then echo "FAILED on {fname}"; exit 1; fi

echo "Running 0021_cards.sql..."
CLOUDFLARE_API_TOKEN="$TOKEN" npx wrangler d1 execute card-vault-db --remote --file="migrations/chunks/0021_cards.sql" --yes
if [ $? -ne 0 ]; then echo "FAILED on {fname}"; exit 1; fi

echo "All chunks complete!"
