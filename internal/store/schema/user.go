package schema

import (
	"entgo.io/ent"
	"entgo.io/ent/schema/field"
	"github.com/google/uuid"
)

type User struct {
	ent.Schema
}

func (User) Fields() []ent.Field {
	return []ent.Field{
		field.UUID("id", uuid.UUID{}).Default(uuid.New),
		field.String("email").NotEmpty(),
		field.String("display_name").NotEmpty(),
		field.String("platform_id").Optional().Default(""),
		field.Time("created_at").Default(timeNow).Immutable(),
	}
}
