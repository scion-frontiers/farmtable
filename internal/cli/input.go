package cli

import (
	"fmt"
	"io"
	"os"
	"strings"
)

func readInputValue(val string) (string, error) {
	if val == "-" {
		data, err := io.ReadAll(os.Stdin)
		if err != nil {
			return "", fmt.Errorf("reading stdin: %w", err)
		}
		return string(data), nil
	}
	if strings.HasPrefix(val, "@") {
		data, err := os.ReadFile(val[1:])
		if err != nil {
			return "", fmt.Errorf("reading file %s: %w", val[1:], err)
		}
		return string(data), nil
	}
	return val, nil
}
