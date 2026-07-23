package schema

import (
	"entgo.io/ent"
	"entgo.io/ent/schema/edge"
	"entgo.io/ent/schema/field"
	"github.com/google/uuid"
)

type LinkedAccount struct {
	ent.Schema
}

func (LinkedAccount) Fields() []ent.Field {
	return []ent.Field{
		field.UUID("id", uuid.UUID{}).Default(uuid.New),
		field.UUID("collection_id", uuid.UUID{}),
		field.Enum("platform").
			Values("github", "linear", "jira", "asana", "beads"),
		field.String("auth_token").Sensitive(),
		field.Enum("auth_method").
			Values("pat", "oauth", "github_app"),
		field.JSON("scopes", []string{}).Optional(),
		field.String("remote_user_id").Optional().Default(""),
		field.Enum("status").
			Values("active", "expired", "revoked").
			Default("active"),
		field.Time("created_at").Default(timeNow).Immutable(),
		field.Time("updated_at").Default(timeNow).UpdateDefault(timeNow),
		field.Time("expires_at").Optional().Nillable(),
		// Stage 6: OAuth credential fields
		field.String("refresh_token").Optional().Sensitive(),
		field.Time("token_expiry").Optional().Nillable(),
		field.JSON("scopes_granted", []string{}).Optional(),
		field.Time("last_validated_at").Optional().Nillable(),
	}
}

func (LinkedAccount) Edges() []ent.Edge {
	return []ent.Edge{
		edge.From("collection", Collection.Type).
			Ref("linked_accounts").
			Field("collection_id").
			Required().
			Unique(),
	}
}
