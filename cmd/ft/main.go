package main

import "github.com/farmtable-io/farmtable/internal/cli"

var version = "0.2.0"

func main() {
	cli.Execute(version)
}
