# source this. mut <label> <file> <<'ANCHOR' ... marker ... <<'REPL'
# Usage: mut LABEL FILE ANCHOR_HEREDOC_FILE REPL_HEREDOC_FILE
set -u
mut() {
  local label="$1" file="$2" a="$3" r="$4"
  node /tmp/mut/mutate.mjs "$file" "$a" "$r" "$label"
  local rc=$?
  if [ $rc -eq 3 ]; then echo "!!! ABORT (not scored) for $label"; fi
  return 0
}
