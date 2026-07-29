# CENSUS ARTEFACTS - reconcile-urlbindingscan (farmtable-reconcile-urlbinding)
Copied from /tmp/rubs.vFtLN4/ (PER-AGENT, would have been lost on reap) at 2026-07-29T09:35:41Z
Copy method: 51 paths named individually. No glob, no directory-wide capture.
Verification: sha256 source-vs-dest, pairwise. 51 MATCHED, 0 MISMATCHED. 4,377,764 bytes both sides.

## WARNING TO ANY AUDITOR: TWELVE FILES ARE ZERO BYTES ON PURPOSE.
## (This line first said EIGHT. I estimated instead of counting; the count is 12, MEASURED.
##  Struck in place rather than silently fixed - a correction is a measurement and inherits every
##  duty of one. Membership, not a count, is listed below so nobody has to trust the number.)
Their emptiness IS the measurement, not a failed copy. sha256 of an empty file is always
e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855 - seeing that repeated is CORRECT.
Most load-bearing: sweep/class-hits.txt (empty = the zero db/sqlite result across 535,189 objects)
and lsremote/stdout.txt (empty = zero refs returned by the farmtable-io ls-remote).
An empty artefact is the artefact of a negative result and is evidence. Do not delete them.

## KEY ARTEFACTS
  census/raw.tsv          host census at sweep time: 112 stores / 119 worktrees / 262 entries
  census/raw-0724.tsv     PRIOR census 07:24Z: 109 / 118 / 258. KEPT so the two compare, not merge.
  census/classify.sh      the predicate, published as a command: --absolute-git-dir == --git-common-dir
  sweep/stores-enumerated.txt / stores-swept.txt   the 112 == 112 equality, as membership
  sweep/per-store.tsv     per-store objects/trees/filenames/classhits. min filenames = 23, none zero.
  sweep/class-hits.txt    EMPTY. zero db/sqlite/sqlite3 basenames in any of 535,189 objects.
  lsremote/ctl-public.out POSITIVE CONTROL: 5,274 refs from github.com/git/git.git. Proves the
                          instrument was alive before its negative was believed.
  lsremote/ctl-absent.err NEGATIVE CONTROL: definitely-absent repo, same org.
  lsremote/stderr.txt     THE TARGET. Byte-identical to ctl-absent.err => private and absent are
                          NOT DISTINGUISHABLE. Verify with: diff lsremote/stderr.txt lsremote/ctl-absent.err
  refs-CONTROL-main.txt   the containment control (origin/main -> 7 remote refs)
  canon-treedump.bin      canonical tree objects, all-objects pool (6,850 obj / 3,608 trees)

## SHA256 PAIRS (identical source and dest; one hash therefore covers both)
e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855  C2-double.err
b94b882e91614b6e1fc04ffc9fa9dcf16f8db9713a44717d7e0cb1a3e215e8b3  C2-double.txt
a990f83701d666aae0a67f4be549e06acabd69c6d871ff41a463f85c0bd03ce3  C2-fleet-single.txt
e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855  C2-fleet-union.err
8c14981dc9c5bfc868fbd027e2deb98debe4975e51257143b755b8e29dc5bdfe  C2-fleet-union.txt
e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855  C2-single.err
c47086141e5a4d1a591b9d90abd06e74552331f00d36ebb2976eab2e61e9fcae  C2-single.txt
617bd2af189a79dc03a5636e3c45637dab48dc3a2b7a009a0cb456288aeaf3a3  allobj.txt
c6ca64341d8092d3ec93f65cc39d1b23d91a7cdbfd68021d35b652e725712b28  anc-633f8f2.txt
8f6b4842bc4070f4e95c533af9f5b90f1ccdc047b87b09fa7a9780c6c3c9b01b  anc-7cee4a6.txt
ced82002b0bcff09b350f9f70f5e3fee0a54167f0f36ebae2de13f1660d2a7d8  anc-b330096.txt
1191ebdca4c28a8bd361b1bf54acce4e5d237b32dc5ff08de77d7915a2ff8d4f  canon-allobj.txt
7b53dc38b16e5868682bc361dc556a5dd074e43ef81169e3fc029082c1ca8548  canon-treedump.bin
e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855  canon-treedump.err
e609a2d1155b37885336edfa7b397c9208c401b11c663abb3f9f92a3ed5a21ba  canon-trees.txt
0daa62090a3efa77f9bee046e36f6ae3ba73397e395b2381fc8c3fa49d70ca4e  census/classify.sh
e1eb112646013da0fb295c8d1c7f8fbeefdf56c089b24fddfc8583a2814738b2  census/deep-gits.txt
e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855  census/deep.err
e7cbb5e0ac9564043f11338c089adaadb6b59c4c0f314d03ba2a6369f609b36c  census/entries.txt
1130648d008cbed96cf24729b5ad57ec9563d34ee8545f7a442bf615161df964  census/errors.txt
aea31a3a35fc898941c6ccdd655ae9128d5406465610e9c5e380094f561e15a4  census/git-says.txt
a2a59b2a6dcb787e39352f529cb74fc26374e6b9c6ca4b00d4c2a0bd2ec3e501  census/i-found.txt
e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855  census/notroot.txt
92bbd56c8b32022855d88548dd914351567a21d6139c09831cb4aaa890ba3796  census/raw-0724.tsv
624e019ff37466f2d6c5421a49bd900215b51de9dd61e3ec90b7a373c8b0bdfa  census/raw.tsv
77561f5b9b6edb03067e315bdc2e78f4b955efdd3439e4b8a9d6374ff5b8fa33  census/wt-by-store.tsv
e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855  dbobj.txt
bd206a976e7fc07245e1e67018563087ed867575a32d972c553d5cb32698f0fb  lsremote/ctl-absent.err
e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855  lsremote/ctl-absent.out
e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855  lsremote/ctl-public.err
66e9163d1cf502eb1bcd2dd97cc33499ec99fec591a747a9bed951d40189057e  lsremote/ctl-public.out
bd206a976e7fc07245e1e67018563087ed867575a32d972c553d5cb32698f0fb  lsremote/stderr.txt
e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855  lsremote/stdout.txt
165b8e6fd6b5d460c3f9f0c958cd698f8a2f3fe29e96a0e78b6c3450238d6288  pres-auth.txt
c01c43621c951ece585dc521fd18878045cb722fec1c4b21021fe410a30f8acd  pres-loose.txt
e7ef7579cb73fe609dade1626d061476ecc471616b2ccf27f8db99fd93357632  pres-packed.txt
5838175f4aa6ee0091479bd054518e84b7d91b8cd195cb19a572873fc8049c31  refs-42d62a4.txt
5838175f4aa6ee0091479bd054518e84b7d91b8cd195cb19a572873fc8049c31  refs-457886d.txt
5838175f4aa6ee0091479bd054518e84b7d91b8cd195cb19a572873fc8049c31  refs-859a54d.txt
8c14981dc9c5bfc868fbd027e2deb98debe4975e51257143b755b8e29dc5bdfe  refs-CONTROL-main.txt
6814cf3be0f87b43b31f4372a61d2e164e0c988d0465e58390c84cbbdf8ac855  refs-d12f572.txt
5838175f4aa6ee0091479bd054518e84b7d91b8cd195cb19a572873fc8049c31  refs-d92ae5e.txt
a990f83701d666aae0a67f4be549e06acabd69c6d871ff41a463f85c0bd03ce3  refs-f0ab53f.txt
316b5f98c7da39cb4f208c01d177f839c1e46f6b8cd79fea2bf4818195fa02ce  stash-untracked-files.txt
fbf78d642b00f13a9c92382d468ff9fa87e389a9e8e0c5a6b4d2bf9e165fa4b1  sweep.sh
e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855  sweep/class-hits.txt
e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855  sweep/errors.txt
0fbdefce784db056000340bc0a836afa5d92a3f4a500057abb90b3e76f34521e  sweep/per-store.tsv
a11aa1cd8633a8ea858e7332f339f5b11ec56e5e5705ffc68c268eeba934c302  sweep/stores-enumerated.txt
a11aa1cd8633a8ea858e7332f339f5b11ec56e5e5705ffc68c268eeba934c302  sweep/stores-swept.txt
24fe781c1698a2425964228934d7ae44c5a35c40506293f5252cf141455991a5  wui-refs.txt

### THE TWELVE ZERO-BYTE ARTEFACTS, BY NAME (MEASURED, find -size 0)
  C2-double.err
  C2-fleet-union.err
  C2-single.err
  canon-treedump.err
  census/deep.err
  census/notroot.txt
  dbobj.txt
  lsremote/ctl-absent.out
  lsremote/ctl-public.err
  lsremote/stdout.txt
  sweep/class-hits.txt
  sweep/errors.txt
  -- each is the artefact of a negative result. Emptiness is the finding.
