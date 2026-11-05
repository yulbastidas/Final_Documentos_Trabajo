#!/bin/sh
set -eu

if [ -n "${DB_PASSWORD_FILE:-}" ]; then
  if [ ! -r "$DB_PASSWORD_FILE" ]; then
    echo "DB_PASSWORD_FILE is not readable" >&2
    exit 1
  fi
  DB_PASSWORD="$(cat "$DB_PASSWORD_FILE")"
  export DB_PASSWORD
fi

exec "$@"
