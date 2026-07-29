import 'package:json_annotation/json_annotation.dart';

part 'interaction.g.dart';

@JsonSerializable()
class Interaction {
  @JsonKey(name: 'created_at')
  final DateTime timestamp;
  final String actor;

  // Beads uses 'kind', previously 'event_type'
  @JsonKey(name: 'kind', readValue: _readKindOrEventType)
  final String action;

  @JsonKey(name: 'issue_id')
  final String? issueId;

  // New properties are inside extra
  final Map<String, dynamic>? extra;

  // Compatibility getters for old properties
  String? get newValue => extra?['new_value']?.toString();
  String? get oldValue => extra?['old_value']?.toString();
  String? get comment => extra?['comment']?.toString();
  String? get field => extra?['field']?.toString();

  Interaction({
    required this.timestamp,
    required this.actor,
    required this.action,
    this.issueId,
    this.extra,
  });

  static String _readKindOrEventType(Map<dynamic, dynamic> json, String key) {
    return json['kind'] as String? ??
        json['event_type'] as String? ??
        'unknown';
  }

  factory Interaction.fromJson(Map<String, dynamic> json) =>
      _$InteractionFromJson(json);
  Map<String, dynamic> toJson() => _$InteractionToJson(this);
}
