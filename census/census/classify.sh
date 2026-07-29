#!/bin/zsh
# NOT-REACHED #9 classifier. Read-only: rev-parse only. No gc, no prune, no write.
OUT=/tmp/rubs.vFtLN4/census
: > $OUT/raw.tsv
: > $OUT/errors.txt

# Population: ALL top-level entries of /workspace, including dotfiles. No head, no maxdepth.
find /workspace -mindepth 1 -maxdepth 1 -print | sort > $OUT/entries.txt

while IFS= read -r d; do
  if [[ ! -d "$d" ]]; then
    printf '%s\tNOTDIR\t-\t-\t-\t-\n' "$d" >> $OUT/raw.tsv
    continue
  fi
  gd=$(git -C "$d" rev-parse --path-format=absolute --git-dir 2>>$OUT/errors.txt)
  rc=$?
  if [[ $rc -ne 0 ]]; then
    printf '%s\tNOTREPO\t-\t-\t-\t-\n' "$d" >> $OUT/raw.tsv
    continue
  fi
  cd_=$(git -C "$d" rev-parse --path-format=absolute --git-common-dir 2>>$OUT/errors.txt)
  top=$(git -C "$d" rev-parse --path-format=absolute --show-toplevel 2>>$OUT/errors.txt)
  bare=$(git -C "$d" rev-parse --is-bare-repository 2>>$OUT/errors.txt)
  # class by the AUTHORISED test: absolute-git-dir vs git-common-dir
  if [[ "$gd" == "$cd_" ]]; then cls=STORE; else cls=WORKTREE; fi
  printf '%s\t%s\t%s\t%s\t%s\t%s\n' "$d" "$cls" "$gd" "$cd_" "$top" "$bare" >> $OUT/raw.tsv
done < $OUT/entries.txt
