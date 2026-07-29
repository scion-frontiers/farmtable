import os, re, sys
ROOT = "/workspace/farmtable-xss-r8"

# (citing file, citing line, cited target path, cited line, what the citing sentence attributes to it)
CITES = [
 ("internal/server/convert.go",539,"internal/platform/github/graphql_queries.go",480,None),
 ("internal/server/convert.go",551,"web/src/components/inspector/ft-inspector-meta.ts",628,None),
 ("internal/server/convert.go",755,"internal/store/entstore.go",408,None),
 ("internal/server/convert.go",755,"internal/store/entstore.go",898,None),
 ("internal/server/convert.go",760,"internal/store/entstore.go",1366,None),
 ("internal/server/convert.go",761,"internal/store/entstore.go",1399,None),
 ("internal/server/convert.go",761,"internal/store/entstore.go",2117,None),
 ("internal/server/convert.go",771,"internal/server/server.go",1057,None),
 ("internal/server/convert.go",771,"internal/server/server.go",1085,None),
 ("internal/server/convert.go",772,"internal/server/graph_routing.go",83,None),
 ("internal/server/convert.go",778,"internal/server/export_import.go",332,"builds importParams RemoteData from uploaded doc"),
 ("internal/server/convert.go",779,"internal/server/export_import.go",412,"reaches the store"),
 ("internal/server/convert.go",804,"internal/platform/github/passthrough.go",645,None),
 ("internal/server/convert.go",807,"internal/platform/github/passthrough.go",630,None),
 ("internal/server/convert.go",807,"internal/platform/github/passthrough.go",638,None),
 ("internal/server/convert.go",808,"internal/platform/github/passthrough.go",642,None),
 ("internal/server/convert.go",858,"internal/server/server.go",1035,None),
 ("internal/server/convert.go",859,"internal/server/server.go",2144,None),
 ("internal/server/convert.go",859,"internal/store/entstore.go",1359,None),
 ("internal/server/convert.go",860,"internal/server/server.go",1053,None),
 ("internal/server/convert.go",864,"internal/store/entstore.go",2112,None),
 ("internal/server/convert.go",867,"internal/server/export_import.go",306,"refuses a non-farmtable document"),
 ("internal/server/convert.go",868,"internal/server/export_import.go",331,"hardcodes farmtable into the params"),
 ("internal/server/convert.go",876,"internal/server/export_import.go",331,"Hardcoded farmtable"),
 ("internal/server/convert.go",877,"internal/server/beads_import.go",393,None),
 ("internal/server/convert.go",877,"internal/server/graph_routing.go",85,None),
 ("internal/server/convert.go",882,"internal/store/entstore.go",2112,None),
 ("internal/server/convert.go",887,"internal/server/export_import.go",306,"line holding the gate shut"),
 ("internal/server/convert.go",887,"internal/server/export_import.go",331,"line holding the gate shut"),
 ("internal/server/convert.go",890,"internal/server/export_import.go",332,"remote_data wired from uploaded document"),
 ("internal/server/convert.go",891,"internal/server/urlvalidate.go",250,None),
 ("internal/server/convert.go",898,"internal/store/entstore.go",1366,None),
 ("internal/server/export_import.go",310,"internal/server/export_import.go",332,"copies remote_data with NO KEY VALIDATION"),
 ("internal/server/export_import.go",311,"internal/store/entstore.go",2117,None),
 ("internal/server/export_import.go",323,"internal/server/export_import.go",331,"hardcodes PlatformFarmtable"),
 ("internal/server/export_import.go",325,"web/src/capabilities.ts",94,"FARMTABLE branch returns ALL_ENABLED"),
 ("internal/server/export_import.go",360,"internal/server/export_import.go",306,"conjunct A (comment)"),
 ("internal/server/export_import.go",361,"internal/server/export_import.go",306,"the :306 CHECK"),
 ("internal/server/export_import.go",366,"internal/server/export_import.go",306,"conjuncts A and B"),
 ("web/src/capabilities.ts",95,"internal/server/export_import.go",306,"counterpart comment which names this one"),
 ("internal/webguard/doc.go",64,"assets.go",5,None),
]

def read(p, n):
    fp = os.path.join(ROOT, p)
    if not os.path.exists(fp):
        return None, "FILE-NOT-FOUND"
    lines = open(fp, encoding="utf-8", errors="replace").read().splitlines()
    if n < 1 or n > len(lines):
        return None, "LINE-OUT-OF-RANGE (file has %d lines)" % len(lines)
    return lines[n-1].strip(), None

for citer, cline, tgt, tnum, attrib in CITES:
    text, err = read(tgt, tnum)
    tag = "COMMENT" if (text and (text.startswith("//") or text.startswith("*") or text.startswith("/*"))) else "CODE"
    print("%-34s L%-4d -> %-42s :%-5d [%s]" % (citer.split('/')[-1], cline, tgt, tnum, err or tag))
    print("        attributed: %s" % (attrib if attrib else "(positional ref, no explicit noun)"))
    print("        actual    : %s" % (text if text is not None else "<<%s>>" % err))
    print()
