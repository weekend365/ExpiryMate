#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
API_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
ROOT_DIR="$(cd "${API_DIR}/../.." && pwd)"
DUMP_FILE="${DUMP_FILE:-/tmp/product_master.dump}"
SOURCE_DATABASE_URL="${SOURCE_DATABASE_URL:-postgresql://postgres:postgres@localhost:5432/expirymate?schema=public}"
TARGET_DATABASE_URL="${TARGET_DATABASE_URL:-${RAILWAY_DATABASE_URL:-}}"

if [[ -z "${TARGET_DATABASE_URL}" ]]; then
  echo "TARGET_DATABASE_URL 또는 RAILWAY_DATABASE_URL이 필요합니다." >&2
  echo "Railway Postgres → Connect → Public Network URL을 사용하세요." >&2
  exit 1
fi

if [[ "${TARGET_DATABASE_URL}" == *"postgres.railway.internal"* ]]; then
  echo "내부 URL(postgres.railway.internal)은 사용할 수 없습니다. Public Network URL을 사용하세요." >&2
  exit 1
fi

if [[ ! -f "${DUMP_FILE}" ]]; then
  echo ">> 로컬 ProductMaster 덤프 생성: ${DUMP_FILE}"
  pg_dump "${SOURCE_DATABASE_URL}" \
    -t '"ProductMaster"' \
    --data-only \
    -Fc \
    -f "${DUMP_FILE}"
fi

echo ">> Railway migration 적용"
(
  cd "${API_DIR}"
  DATABASE_URL="${TARGET_DATABASE_URL}" pnpm exec prisma migrate deploy
)

echo ">> ProductMaster 데이터 적재"
pg_restore \
  --data-only \
  --no-owner \
  --no-privileges \
  --dbname="${TARGET_DATABASE_URL}" \
  "${DUMP_FILE}"

echo ">> 적재 완료"
