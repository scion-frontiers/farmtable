import 'issue.dart';
import 'interaction.dart';

class AIAssistantContext {
  final List<Issue> issues;
  final HealthCheckResult healthCheck;
  final List<Interaction> interactions;

  AIAssistantContext({
    required this.issues,
    required this.healthCheck,
    required this.interactions,
  });

  /// Compiles the context package into a highly token-efficient, compact text representation.
  String toPromptString() {
    final sb = StringBuffer();

    sb.writeln('=== AI ASSISTANT CONTEXT ===');

    // 1. Issues (Compact Nodes)
    sb.writeln('Issues:');
    if (issues.isEmpty) {
      sb.writeln('  (No issues found)');
    } else {
      for (final issue in issues) {
        sb.writeln(
          '  - ${issue.id} [${issue.issueType}, ${issue.status}, P${issue.priority}]: ${issue.title}',
        );
      }
    }

    // 2. Dependencies (Compact Edges)
    sb.writeln('\nDependencies:');
    final allDeps = <String>[];
    for (final issue in issues) {
      final deps = issue.dependencies;
      if (deps != null) {
        for (final dep in deps) {
          allDeps.add('  - ${dep.issueId} ${dep.type} ${dep.dependsOnId}');
        }
      }
    }
    if (allDeps.isEmpty) {
      sb.writeln('  (No dependencies declared)');
    } else {
      sb.write(allDeps.join('\n'));
      sb.writeln();
    }

    // 3. Health Diagnostics
    sb.writeln('\nDiagnostics:');
    if (healthCheck.diagnostics.isEmpty) {
      sb.writeln('  (None)');
    } else {
      for (final diag in healthCheck.diagnostics) {
        sb.writeln('  - ${diag.type} on ${diag.issueId}: ${diag.message}');
      }
    }

    // 4. Recent Activity
    sb.writeln('\nRecent Activity:');
    if (interactions.isEmpty) {
      sb.writeln('  (No recent activity)');
    } else {
      for (final inter in interactions) {
        final timestampStr = inter.timestamp.toIso8601String().split('T').first;
        final extraText = _formatInteractionExtra(inter);
        sb.writeln(
          '  - [$timestampStr] ${inter.actor} ${inter.action} issue=${inter.issueId ?? 'N/A'}$extraText',
        );
      }
    }

    return sb.toString();
  }

  String _formatInteractionExtra(Interaction inter) {
    final parts = <String>[];
    if (inter.comment != null && inter.comment!.isNotEmpty) {
      parts.add('comment="${inter.comment}"');
    }
    if (inter.field != null && inter.field!.isNotEmpty) {
      parts.add('field=${inter.field}');
    }
    if (inter.oldValue != null && inter.oldValue!.isNotEmpty) {
      parts.add('old=${inter.oldValue}');
    }
    if (inter.newValue != null && inter.newValue!.isNotEmpty) {
      parts.add('new=${inter.newValue}');
    }
    return parts.isEmpty ? '' : ' (${parts.join(', ')})';
  }
}

class AIAssistantRecommendation {
  final String title;
  final String actionType;
  final Map<String, dynamic> payload;

  AIAssistantRecommendation({
    required this.title,
    required this.actionType,
    required this.payload,
  });

  factory AIAssistantRecommendation.fromJson(Map<String, dynamic> json) {
    return AIAssistantRecommendation(
      title: json['title'] as String? ?? '',
      actionType: json['action_type'] as String? ?? '',
      payload:
          (json['payload'] as Map<String, dynamic>?) ?? <String, dynamic>{},
    );
  }

  Map<String, dynamic> toJson() => {
    'title': title,
    'action_type': actionType,
    'payload': payload,
  };
}

class AIAssistantAssessment {
  final String narrative;
  final List<AIAssistantRecommendation> recommendations;

  AIAssistantAssessment({required this.narrative, required this.recommendations});

  factory AIAssistantAssessment.fromJson(Map<String, dynamic> json) {
    final list = json['recommendations'] as List<dynamic>? ?? [];
    final recommendations = list
        .map(
          (item) =>
              AIAssistantRecommendation.fromJson(item as Map<String, dynamic>),
        )
        .toList();
    return AIAssistantAssessment(
      narrative: json['narrative'] as String? ?? '',
      recommendations: recommendations,
    );
  }

  Map<String, dynamic> toJson() => {
    'narrative': narrative,
    'recommendations': recommendations.map((r) => r.toJson()).toList(),
  };
}
