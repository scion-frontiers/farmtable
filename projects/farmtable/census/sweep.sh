#!/bin/zsh
O=/tmp/rubs.vFtLN4/census; T=/tmp/rubs.vFtLN4/sweep
mkdir -p $T; : > $T/per-store.tsv; : > $T/errors.txt; : > $T/class-hits.txt
awk -F'\t' '$2=="STORE"{print $1}' $O/raw.tsv | sort > $T/stores-enumerated.txt
: > $T/stores-swept.txt
while IFS= read -r d; do
  ao=$(git -C "$d" cat-file --batch-all-objects --batch-check='%(objectname) %(objecttype)' 2>>$T/errors.txt)
  rc=$?
  if [[ $rc -ne 0 ]]; then
    printf '%s\tERROR\trc=%s\t-\t-\t-\n' "$d" "$rc" >> $T/per-store.tsv
    echo "$d rc=$rc" >> $T/errors.txt
    continue
  fi
  nobj=$(print -r -- "$ao" | grep -c . )
  trees=$(print -r -- "$ao" | awk '$2=="tree"{print $1}')
  ntree=$(print -r -- "$trees" | grep -c . )
  if [[ $ntree -eq 0 ]]; then
    printf '%s\tSWEPT\t%s\t0\t0\t0\n' "$d" "$nobj" >> $T/per-store.tsv
    echo "$d" >> $T/stores-swept.txt
    continue
  fi
  dump=$(print -r -- "$trees" | git -C "$d" cat-file --batch 2>>$T/errors.txt)
  names=$(print -r -- "$dump" | grep -aoE '[A-Za-z0-9._-]{2,}\.[A-Za-z0-9]{1,10}\b' | sort -u | grep -c .)
  hits=$(print -r -- "$dump" | grep -aoE '[A-Za-z0-9._-]+\.(db|sqlite|sqlite3)\b' | sort -u)
  nhits=$(print -r -- "$hits" | grep -c .)
  [[ $nhits -gt 0 ]] && print -r -- "$hits" | sed "s#^#$d\t#" >> $T/class-hits.txt
  printf '%s\tSWEPT\t%s\t%s\t%s\t%s\n' "$d" "$nobj" "$ntree" "$names" "$nhits" >> $T/per-store.tsv
  echo "$d" >> $T/stores-swept.txt
done < $T/stores-enumerated.txt
