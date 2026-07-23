package schema

import (
	"entgo.io/ent"
	"entgo.io/ent/schema/edge"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
	"github.com/google/uuid"
)

type ApiToken struct {
	ent.Schema
}

func (ApiToken) Fields() []ent.Field {
	return []ent.Field{
		field.UUID("id", uuid.UUID{}).Default(uuid.New),
		field.String("token_hash").Unique().NotEmpty(),
		field.String("name").NotEmpty(),
		field.UUID("user_id", uuid.UUID{}),
		field.Time("created_at").Default(timeNow).Immutable(),
		field.Time("expires_at").Optional().Nillable(),
		field.Time("last_used_at").Optional().Nillable(),
		field.JSON("scopes", []string{}).Optional(),
		field.JSON("collection_ids", []uuid.UUID{}).Optional(),
	}
}

func (ApiToken) Edges() []ent.Edge {
	return []ent.Edge{
		edge.From("user", User.Type).
			Ref("api_tokens").
			Field("user_id").
			Required().
			Unique(),
	}
}

func (ApiToken) Indexes() []ent.Index {
	return []ent.Index{
		index.Fields("token_hash").Unique(),
		index.Fields("user_id"),
	}
}
