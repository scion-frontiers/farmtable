import 'package:json_annotation/json_annotation.dart';

part 'issue.g.dart';

@JsonSerializable(fieldRename: FieldRename.snake)
class Dependency {
  final String issueId;
  final String dependsOnId;
  final String type;

  Dependency({
    required this.issueId,
    required this.dependsOnId,
    required this.type,
  });

  factory Dependency.fromJson(Map<String, dynamic> json) =>
      _$DependencyFromJson(json);
  Map<String, dynamic> toJson() => _$DependencyToJson(this);
}

@JsonSerializable(fieldRename: FieldRename.snake)
class Issue {
  final String id;
  final String title;
  final String? description;
  final String status;
  final int priority;
  final String issueType;
  final String? owner;
  final String? assignee;

  // ── Content fields (bd canonical) ────────────────────────────────────────
  final String? notes;
  final String? design;
  final String? acceptanceCriteria;

  // ── Timestamps ────────────────────────────────────────────────────────────
  final DateTime createdAt;
  final String? createdBy;
  final DateTime updatedAt;
  final DateTime? startedAt;
  final DateTime? closedAt;
  final String? closeReason;

  // ── Labels ────────────────────────────────────────────────────────────────
  final List<String>? labels;

  // ── Relational counts / data ──────────────────────────────────────────────
  final int? dependencyCount;
  final int? dependentCount;
  final int? commentCount;
  final List<Dependency>? dependencies;

  Issue({
    required this.id,
    required this.title,
    this.description,
    required this.status,
    required this.priority,
    required this.issueType,
    this.owner,
    this.assignee,
    this.notes,
    this.design,
    this.acceptanceCriteria,
    required this.createdAt,
    this.createdBy,
    required this.updatedAt,
    this.startedAt,
    this.closedAt,
    this.closeReason,
    this.labels,
    this.dependencyCount,
    this.dependentCount,
    this.commentCount,
    this.dependencies,
  });

  factory Issue.fromJson(Map<String, dynamic> json) => _$IssueFromJson(json);
  Map<String, dynamic> toJson() => _$IssueToJson(this);
}

@JsonSerializable(fieldRename: FieldRename.pascal)
class GraphNode {
  final Issue root;
  final List<Issue>? issues;
  final List<Dependency>? dependencies;
  final Map<String, Issue>? issueMap;

  GraphNode({
    required this.root,
    this.issues,
    this.dependencies,
    this.issueMap,
  });

  factory GraphNode.fromJson(Map<String, dynamic> json) =>
      _$GraphNodeFromJson(json);
  Map<String, dynamic> toJson() => _$GraphNodeToJson(this);
}

@JsonSerializable(fieldRename: FieldRename.snake)
class Diagnostic {
  final String issueId;
  final String type;
  final String message;
  final String? fix;

  Diagnostic({
    required this.issueId,
    required this.type,
    required this.message,
    this.fix,
  });

  factory Diagnostic.fromJson(Map<String, dynamic> json) =>
      _$DiagnosticFromJson(json);
  Map<String, dynamic> toJson() => _$DiagnosticToJson(this);
}

@JsonSerializable(fieldRename: FieldRename.snake)
class HealthCheckResult {
  final String status;
  final List<Diagnostic> diagnostics;

  HealthCheckResult({required this.status, required this.diagnostics});

  factory HealthCheckResult.fromJson(Map<String, dynamic> json) =>
      _$HealthCheckResultFromJson(json);
  Map<String, dynamic> toJson() => _$HealthCheckResultToJson(this);
}

/// REL-03: O(1) lookup tables precomputed once per issue list.
///
/// The dependency/hierarchy helpers below used to run linear `List.where` scans
/// over the full issue list on every call — and were invoked per row on every
/// render and per drag-hover tick, giving O(N²) behavior that janks on large
/// repos (>500 issues). [IssueIndex] precomputes the maps once; the extension
/// methods resolve the index lazily and memoize it against the list instance
/// (see [_indexFor]), so all call sites within a render pass share one build
/// with **zero call-site changes**.
class IssueIndex {
  /// id → issue
  final Map<String, Issue> byId;

  /// parent id → direct children (parent-child dep OR dotted-id convention)
  final Map<String, List<Issue>> childrenByParentId;

  /// blocked issue id → the issues it declares as `blocks` blockers
  /// (i.e. for X with dep {blocks, Y}: blockersById[X] contains Y)
  final Map<String, List<Issue>> blockersById;

  /// blocker id → issues that are waiting on it
  /// (reverse of the above: blockingById[Y] contains X)
  final Map<String, List<Issue>> blockingById;

  IssueIndex._(
    this.byId,
    this.childrenByParentId,
    this.blockersById,
    this.blockingById,
  );

  factory IssueIndex.build(List<Issue> all) {
    final byId = <String, Issue>{};
    for (final i in all) {
      byId[i.id] = i;
    }

    final children = <String, List<Issue>>{};
    final blockers = <String, List<Issue>>{};
    final blocking = <String, List<Issue>>{};

    void addChild(String parentId, Issue child) =>
        (children[parentId] ??= <Issue>[]).add(child);

    for (final issue in all) {
      // Children map must mirror Issue.isDirectChildOf, which treats an issue as
      // a direct child of BOTH its explicit parent-child target AND its
      // dotted-id prefix parent (when present). Record under each distinct
      // parent id so childrenOf(p) == {i : i.isDirectChildOf(p)}.
      final parentIds = <String>{};
      final deps = issue.dependencies;
      if (deps != null) {
        for (final d in deps) {
          if (d.type == 'parent-child') {
            parentIds.add(d.dependsOnId);
          } else if (d.type == 'blocks') {
            // issue is blocked-by d.dependsOnId
            final blocker = byId[d.dependsOnId];
            if (blocker != null) {
              (blockers[issue.id] ??= <Issue>[]).add(blocker);
              (blocking[blocker.id] ??= <Issue>[]).add(issue);
            }
          }
        }
      }
      final lastDot = issue.id.lastIndexOf('.');
      if (lastDot != -1) parentIds.add(issue.id.substring(0, lastDot));

      for (final pid in parentIds) {
        addChild(pid, issue);
      }
    }

    return IssueIndex._(byId, children, blockers, blocking);
  }

  List<Issue> childrenOf(String parentId) =>
      childrenByParentId[parentId] ?? const [];

  /// Open blockers of [issueId] (closed blockers no longer block).
  List<Issue> openBlockersOf(String issueId) =>
      (blockersById[issueId] ?? const [])
          .where((b) => b.status != 'closed')
          .toList();

  List<Issue> blockingOf(String issueId) => blockingById[issueId] ?? const [];
}

/// Memoizes one [IssueIndex] per issue-list instance. `AppState.currentIssues`
/// is reassigned to a fresh list on each refresh, so the index is rebuilt only
/// when the data actually changes and shared by every helper call in between.
final Expando<IssueIndex> _indexCache = Expando<IssueIndex>('IssueIndex');

IssueIndex _indexFor(List<Issue> all) =>
    _indexCache[all] ??= IssueIndex.build(all);

/// Readiness and blocking semantics for the 'blocks' dependency type.
///
/// Canonical direction (verified against `bd blocked` output):
///   A dependency {depends_on_id: Y, type: 'blocks'} stored on issue X
///   means "X is blocked by Y — Y must close before X is actionable."
///
/// Example from the read-aloud sister project:
///   ijo.3 carries depends_on=89j.3, type=blocks
///   → `bd blocked` reports "ijo.3: Blocked by [89j.3]"
///   → ijo.3.blockers([89j.3_open]) == [89j.3]
///   → ijo.3.isBlocked([...]) == true
extension IssueDependencies on Issue {
  /// Open issues that are blocking this one from being actionable.
  /// Computed from this issue's own [blocks] dependencies: the dep target
  /// must exist in [all] and must NOT be closed.
  List<Issue> blockers(List<Issue> all) => _indexFor(all).openBlockersOf(id);

  /// Issues that are waiting on this one to close before they become actionable.
  /// Reverse lookup: issues in [all] whose own [blocks] dep points at this id.
  List<Issue> blocking(List<Issue> all) => _indexFor(all).blockingOf(id);

  /// True if this issue has at least one open blocker.
  bool isBlocked(List<Issue> all) => blockers(all).isNotEmpty;

  /// The direct parent of this issue, or null if it is a root.
  /// Checks explicit [parent-child] dependencies first, then falls back to
  /// the dotted-ID convention (e.g. "proj-1.2" → parent is "proj-1").
  Issue? parent(List<Issue> all) {
    final byId = _indexFor(all).byId;
    final explicitParentId = dependencies
        ?.where((d) => d.type == 'parent-child')
        .map((d) => d.dependsOnId)
        .firstOrNull;
    if (explicitParentId != null) {
      return byId[explicitParentId];
    }
    final lastDot = id.lastIndexOf('.');
    if (lastDot != -1) {
      return byId[id.substring(0, lastDot)];
    }
    return null;
  }

  /// Direct children of this issue in the parent-child hierarchy.
  List<Issue> children(List<Issue> all) => _indexFor(all).childrenOf(id);

  /// Issues with [related] or [discovered-from] dependency links.
  List<MapEntry<String, Issue>> relatedLinks(List<Issue> all) {
    final byId = _indexFor(all).byId;
    final links = <MapEntry<String, Issue>>[];
    for (final dep in dependencies ?? []) {
      if (dep.type == 'related' || dep.type == 'discovered-from') {
        final target = byId[dep.dependsOnId];
        if (target != null) links.add(MapEntry(dep.type, target));
      }
    }
    return links;
  }
}

extension IssueHierarchy on Issue {
  bool isDirectChildOf(Issue parent) {
    final explicit =
        dependencies?.any(
          (d) => d.type == 'parent-child' && d.dependsOnId == parent.id,
        ) ??
        false;
    final lastDotIndex = id.lastIndexOf('.');
    final implicit =
        lastDotIndex != -1 && id.substring(0, lastDotIndex) == parent.id;
    return explicit || implicit;
  }

  bool hasParentIn(List<Issue> issues) {
    final hasExplicit =
        dependencies?.any((d) => d.type == 'parent-child') ?? false;
    if (hasExplicit) return true;

    final lastDotIndex = id.lastIndexOf('.');
    if (lastDotIndex != -1) {
      final implicitParentId = id.substring(0, lastDotIndex);
      // REL-03: O(1) map lookup instead of a linear scan.
      return _indexFor(issues).byId.containsKey(implicitParentId);
    }
    return false;
  }

  /// REL-03: descends via the precomputed children map (O(subtree)) instead of
  /// re-scanning the whole list at every level (O(N·depth)).
  bool hasOpenDescendant(List<Issue> issues) {
    final index = _indexFor(issues);
    final visited = <String>{id};
    bool recurse(Issue node) {
      for (final child in index.childrenOf(node.id)) {
        if (!visited.add(child.id)) continue; // guard against cycles
        if (child.status != 'closed') return true;
        if (recurse(child)) return true;
      }
      return false;
    }

    return recurse(this);
  }

  /// REL-03: walk the parent chain via the id map (O(depth)) instead of an
  /// indexWhere linear scan per hop.
  bool isDescendantOf(Issue ancestor, List<Issue> allIssues) {
    final byId = _indexFor(allIssues).byId;
    Issue? current = this;
    final visited = <String>{id};

    while (current != null) {
      if (current.isDirectChildOf(ancestor)) return true;

      String? parentId;
      final hasExplicit =
          current.dependencies?.any((d) => d.type == 'parent-child') ?? false;
      if (hasExplicit) {
        parentId = current.dependencies!
            .firstWhere((d) => d.type == 'parent-child')
            .dependsOnId;
      } else {
        final lastDotIndex = current.id.lastIndexOf('.');
        if (lastDotIndex != -1) {
          parentId = current.id.substring(0, lastDotIndex);
        }
      }

      if (parentId == null || visited.contains(parentId)) return false;

      visited.add(parentId);
      current = byId[parentId];
    }
    return false;
  }
}
