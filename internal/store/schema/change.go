package schema

import (
	"entgo.io/ent"
	"entgo.io/ent/schema/edge"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
	"github.com/google/uuid"
)

type Change struct {
	ent.Schema
}

func (Change) Fields() []ent.Field {
	return []ent.Field{
		field.UUID("id", uuid.UUID{}).Default(uuid.New),
		field.UUID("task_id", uuid.UUID{}),
		field.UUID("author_id", uuid.UUID{}),
		field.String("field_name").NotEmpty(),
		field.String("old_value").Optional().Default(""),
		field.String("new_value").Optional().Default(""),
		field.Time("created_at").Default(timeNow).Immutable(),
	}
}

func (Change) Edges() []ent.Edge {
	return []ent.Edge{
		edge.From("task", Task.Type).
			Ref("changes").
			Field("task_id").
			Required().
			Unique(),
	}
}

func (Change) Indexes() []ent.Index {
	return []ent.Index{
		index.Fields("task_id"),
	}
}
