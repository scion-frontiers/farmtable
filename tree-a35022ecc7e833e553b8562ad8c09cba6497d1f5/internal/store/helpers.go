package store

import (
	"github.com/farmtable-io/farmtable/internal/store/ent/collection"
)

func collectionPlatform(s string) collection.Platform {
	switch s {
	case "farmtable":
		return collection.PlatformFarmtable
	case "github":
		return collection.PlatformGithub
	case "linear":
		return collection.PlatformLinear
	case "jira":
		return collection.PlatformJira
	case "asana":
		return collection.PlatformAsana
	case "beads":
		return collection.PlatformBeads
	default:
		return collection.PlatformFarmtable
	}
}
