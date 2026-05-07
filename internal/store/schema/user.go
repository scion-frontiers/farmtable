package schema

import (
	"entgo.io/ent"
	"entgo.io/ent/schema/edge"
	"entgo.io/ent/schema/field"
	"github.com/google/uuid"
)

type User struct {
	ent.Schema
}

func (User) Fields() []ent.Field {
	return []ent.Field{
		field.UUID("id", uuid.UUID{}).Default(uuid.New),
		field.String("email").Optional().Nillable(),
		field.String("display_name").NotEmpty(),
		field.String("type").Default("agent"),
		field.String("status").Default("active"),
		field.String("platform_id").Optional().Default(""),
		field.Time("created_at").Default(timeNow).Immutable(),
		field.Time("updated_at").Default(timeNow).UpdateDefault(timeNow),
	}
}

func (User) Edges() []ent.Edge {
	return []ent.Edge{
		edge.To("api_tokens", ApiToken.Type),
	}
}
