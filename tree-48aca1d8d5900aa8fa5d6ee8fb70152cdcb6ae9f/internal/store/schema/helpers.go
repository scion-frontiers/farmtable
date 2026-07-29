package schema

import "time"

func timeNow() time.Time {
	return time.Now().UTC()
}
