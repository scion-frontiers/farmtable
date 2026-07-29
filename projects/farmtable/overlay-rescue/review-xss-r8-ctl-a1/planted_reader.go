package p

func readsIt(c *ent.Collection) bool {
	if w, ok := c.RemoteData["writable"].(bool); ok {
		return w
	}
	return false
}
