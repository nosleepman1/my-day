#!/usr/bin/env bash
# Tests de fumée post-déploiement, en lecture seule (INFRASTRUCTURE.md §8.6).
#   smoke.sh <staging|production> [--api-version <sha>] [--front-version <sha>]
# Lit API_PUBLIC_URL et APP_ORIGIN dans /etc/orbit/<env>/compose.env ; un échec renvoie un code non nul.
set -Eeuo pipefail

ENV_NAME="${1:?usage: smoke.sh <staging|production> [--api-version <sha>] [--front-version <sha>]}"
shift
API_VERSION=""
FRONT_VERSION=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --api-version) API_VERSION="$2"; shift 2 ;;
    --front-version) FRONT_VERSION="$2"; shift 2 ;;
    *) echo "smoke.sh: unknown argument $1" >&2; exit 2 ;;
  esac
done

# Lecture du fichier env de Compose sans l'interpréter comme du shell (revue PHASE-03, LOW).
env_value() {
  sed -n "s/^$1=//p" "${ORBIT_ENV_FILE:-/etc/orbit/${ENV_NAME}/compose.env}" | tail -n 1
}
API_PUBLIC_URL=$(env_value API_PUBLIC_URL)
APP_ORIGIN=$(env_value APP_ORIGIN)
[[ -n "$API_PUBLIC_URL" && -n "$APP_ORIGIN" ]] || { echo "smoke.sh: API_PUBLIC_URL or APP_ORIGIN missing" >&2; exit 2; }

failures=0
check() {
  local label="$1"
  shift
  if "$@"; then echo "ok   ${label}"; else
    echo "FAIL ${label}" >&2
    failures=$((failures + 1))
  fi
}

status_is() {
  local expected="$1" url="$2" status
  status=$(curl -sS -o /dev/null -m 10 --retry 5 --retry-delay 3 --retry-all-errors -w '%{http_code}' "$url" || true)
  [[ "$status" == "$expected" ]]
}

# Réponses lues entièrement avant le filtrage : pas de `curl | grep -q` sous pipefail (revue M2).
headers_of() { curl -sS -m 10 -o /dev/null -D - -H "Origin: ${APP_ORIGIN}" "$1" || true; }
has_header() { grep -qi "^$1:" <<<"$(headers_of "$2")"; }
has_no_header() { ! grep -qi "^$1:" <<<"$(headers_of "$2")"; }
body_contains() {
  local body
  body=$(curl -sS -m 10 "$1" || true)
  [[ "$body" == *"$2"* ]]
}

check "api live" status_is 200 "${API_PUBLIC_URL}/api/v1/health/live"
check "api ready" status_is 200 "${API_PUBLIC_URL}/api/v1/health/ready"
check "api outside /api is 404" status_is 404 "${API_PUBLIC_URL}/"
check "front rewrite reaches the api" status_is 200 "${APP_ORIGIN}/api/v1/health/ready"
check "/me without cookie is 401 through the front" status_is 401 "${APP_ORIGIN}/api/v1/me"
check "api HSTS" has_header Strict-Transport-Security "${API_PUBLIC_URL}/api/v1/health/live"
check "api CSP" has_header Content-Security-Policy "${API_PUBLIC_URL}/api/v1/health/live"
check "api nosniff" has_header X-Content-Type-Options "${API_PUBLIC_URL}/api/v1/health/live"
check "no CORS header" has_no_header Access-Control-Allow-Origin "${API_PUBLIC_URL}/api/v1/health/live"
check "front HSTS" has_header Strict-Transport-Security "${APP_ORIGIN}/"
check "front CSP" has_header Content-Security-Policy "${APP_ORIGIN}/"

# La bonne API répond bien sur ce domaine : version et environnement journalisés par le conteneur
# (aucune version n'est exposée par HTTP).
if [[ -n "$API_VERSION" ]]; then
  # shellcheck disable=SC2016 # guillemets simples voulus : valeurs passées en paramètres ($0, $1), pas interpolées
  check "running api is ${API_VERSION} (${ENV_NAME})" bash -c '
    logs=$(docker logs "orbit-$0-api-1" 2>&1 | grep "\"msg\":\"api.started\"" | tail -n 1)
    [[ "$logs" == *"\"appVersion\":\"$1\""* && "$logs" == *"\"appEnv\":\"$0\""* ]]' "$ENV_NAME" "$API_VERSION"
fi
if [[ -n "$FRONT_VERSION" ]]; then
  check "front serves version ${FRONT_VERSION}" body_contains "${APP_ORIGIN}/" "content=\"${FRONT_VERSION}\""
fi

if ((failures > 0)); then
  echo "smoke: ${failures} check(s) failed" >&2
  exit 1
fi
echo "smoke: all checks passed"
