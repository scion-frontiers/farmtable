package schema

import (
	"entgo.io/ent"
	"entgo.io/ent/schema/edge"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
	"github.com/google/uuid"
)

type Relationship struct {
	ent.Schema
}

func (Relationship) Fields() []ent.Field {
	return []ent.Field{
		field.UUID("id", uuid.UUID{}).Default(uuid.New),
		field.UUID("source_task_id", uuid.UUID{}),
		field.UUID("target_task_id", uuid.UUID{}),
		field.Enum("type").
			Values("blocks", "blocked_by", "relates_to", "duplicates", "duplicated_by"),
	}
}

func (Relationship) Edges() []ent.Edge {
	return []ent.Edge{
		edge.From("source_task", Task.Type).
			Ref("source_relationships").
			Field("source_task_id").
			Required().
			Unique(),
		edge.From("target_task", Task.Type).
			Ref("target_relationships").
			Field("target_task_id").
			Required().
			Unique(),
	}
}

func (Relationship) Indexes() []ent.Index {
	return []ent.Index{
		index.Fields("source_task_id"),
		index.Fields("target_task_id"),
	}
}
