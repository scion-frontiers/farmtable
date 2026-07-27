package cli

import (
	"bufio"
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

type Config struct {
	Server            string
	Token             string
	DefaultCollection string
	Output            string
}

func defaultConfigPath() string {
	if p := os.Getenv("FARMTABLE_CONFIG"); p != "" {
		return p
	}
	home, _ := os.UserHomeDir()
	return filepath.Join(home, ".config", "farmtable", "config.toml")
}

func LoadConfig() Config {
	var cfg Config
	path := defaultConfigPath()
	f, err := os.Open(path)
	if err != nil {
		return cfg
	}
	defer f.Close()

	scanner := bufio.NewScanner(f)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		key, val, ok := parseConfigLine(line)
		if !ok {
			continue
		}
		switch key {
		case "server":
			cfg.Server = val
		case "token":
			cfg.Token = val
		case "default_collection":
			cfg.DefaultCollection = val
		case "output":
			cfg.Output = val
		}
	}
	return cfg
}

func parseConfigLine(line string) (key, val string, ok bool) {
	idx := strings.IndexByte(line, '=')
	if idx < 0 {
		return "", "", false
	}
	key = strings.TrimSpace(line[:idx])
	val = strings.TrimSpace(line[idx+1:])
	val = strings.Trim(val, `"'`)
	return key, val, true
}

func SaveConfigValue(key, value string) error {
	path := defaultConfigPath()

	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return err
	}

	lines, err := readLines(path)
	if err != nil && !os.IsNotExist(err) {
		return err
	}

	found := false
	for i, line := range lines {
		trimmed := strings.TrimSpace(line)
		if trimmed == "" || strings.HasPrefix(trimmed, "#") {
			continue
		}
		k, _, ok := parseConfigLine(trimmed)
		if ok && k == key {
			lines[i] = fmt.Sprintf("%s = %q", key, value)
			found = true
			break
		}
	}
	if !found {
		lines = append(lines, fmt.Sprintf("%s = %q", key, value))
	}

	if err := os.WriteFile(path, []byte(strings.Join(lines, "\n")+"\n"), 0o600); err != nil {
		return err
	}
	return os.Chmod(path, 0o600)
}

func readLines(path string) ([]string, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}
	return strings.Split(strings.TrimRight(string(data), "\n"), "\n"), nil
}
