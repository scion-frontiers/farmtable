package schema

import (
	"entgo.io/ent"
	"entgo.io/ent/dialect/entsql"
	"entgo.io/ent/schema/edge"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
	"github.com/google/uuid"
)

type Task struct {
	ent.Schema
}

func (Task) Fields() []ent.Field {
	return []ent.Field{
		field.UUID("id", uuid.UUID{}).Default(uuid.New),
		field.String("title").NotEmpty(),
		field.String("description").Optional().Default(""),
		field.Enum("phase").
			Values("open", "in_progress", "on_hold", "closed").
			Default("open"),
		field.Enum("stage").
			Values(
				"triage", "backlog", "ready",
				"working", "in_review", "in_qa", "deploying",
				"blocked", "waiting_for_input", "deferred", "scheduled",
				"completed", "wont_fix", "duplicate", "cancelled",
			).
			Default("triage"),
		field.String("native_label").Optional().Default(""),
		field.String("type").Optional().Default(""),
		field.Enum("priority").
			Values("urgent", "high", "normal", "low").
			Optional().
			Nillable(),
		field.UUID("assignee_id", uuid.UUID{}).Optional().Nillable(),
		field.UUID("collection_id", uuid.UUID{}),
		field.UUID("parent_task_id", uuid.UUID{}).Optional().Nillable(),
		field.Time("start_date").Optional().Nillable(),
		field.Time("due_date").Optional().Nillable(),
		field.Time("closed_at").Optional().Nillable(),
		field.Time("created_at").Default(timeNow).Immutable(),
		field.Time("updated_at").Default(timeNow).UpdateDefault(timeNow),
		field.String("acceptance_criteria").Optional().Nillable(),
		field.JSON("remote_data", map[string]any{}).Optional(),
		field.String("version").Default("1"),
	}
}

func (Task) Edges() []ent.Edge {
	return []ent.Edge{
		edge.From("collection", Collection.Type).
			Ref("tasks").
			Field("collection_id").
			Required().
			Unique(),
		edge.To("children", Task.Type).
			From("parent").
			Field("parent_task_id").
			Unique(),
		edge.To("comments", Comment.Type),
		edge.To("changes", Change.Type),
		edge.To("source_relationships", Relationship.Type).
			Annotations(entsql.OnDelete(entsql.Cascade)),
		edge.To("target_relationships", Relationship.Type).
			Annotations(entsql.OnDelete(entsql.Cascade)),
	}
}

func (Task) Indexes() []ent.Index {
	return []ent.Index{
		index.Fields("id", "version"),
		index.Fields("collection_id"),
		index.Fields("phase"),
		index.Fields("assignee_id"),
	}
}
