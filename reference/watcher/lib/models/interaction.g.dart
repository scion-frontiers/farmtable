// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'interaction.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

Interaction _$InteractionFromJson(Map<String, dynamic> json) => Interaction(
  timestamp: DateTime.parse(json['created_at'] as String),
  actor: json['actor'] as String,
  action: Interaction._readKindOrEventType(json, 'kind') as String,
  issueId: json['issue_id'] as String?,
  extra: json['extra'] as Map<String, dynamic>?,
);

Map<String, dynamic> _$InteractionToJson(Interaction instance) =>
    <String, dynamic>{
      'created_at': instance.timestamp.toIso8601String(),
      'actor': instance.actor,
      'kind': instance.action,
      'issue_id': instance.issueId,
      'extra': instance.extra,
    };
