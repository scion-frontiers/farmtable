package decomposer

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
)

// AnthropicClient implements Inferencer using the Anthropic Messages API.
type AnthropicClient struct {
	APIKey string
	Model  string
}

const (
	defaultAnthropicModel   = "claude-sonnet-4-20250514"
	anthropicMessagesURL    = "https://api.anthropic.com/v1/messages"
	anthropicAPIVersion     = "2023-06-01"
	defaultAnthropicMaxToks = 8192
)

// NewAnthropicClient creates an AnthropicClient with defaults.
func NewAnthropicClient(apiKey, model string) *AnthropicClient {
	if apiKey == "" {
		apiKey = os.Getenv("ANTHROPIC_API_KEY")
	}
	if model == "" {
		model = defaultAnthropicModel
	}
	return &AnthropicClient{APIKey: apiKey, Model: model}
}

// anthropicRequest is the request body for the Anthropic Messages API.
type anthropicRequest struct {
	Model     string             `json:"model"`
	MaxTokens int                `json:"max_tokens"`
	System    string             `json:"system,omitempty"`
	Messages  []anthropicMessage `json:"messages"`
}

type anthropicMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

// anthropicResponse is the response from the Anthropic Messages API.
type anthropicResponse struct {
	Content []struct {
		Type string `json:"type"`
		Text string `json:"text"`
	} `json:"content"`
	Error *struct {
		Type    string `json:"type"`
		Message string `json:"message"`
	} `json:"error"`
}

// Complete sends a chat completion request to the Anthropic API.
func (c *AnthropicClient) Complete(ctx context.Context, messages []Message) (string, error) {
	if c.APIKey == "" {
		return "", fmt.Errorf("anthropic API key not set (set --api-key or ANTHROPIC_API_KEY)")
	}

	// Separate system message from conversation messages.
	var system string
	var msgs []anthropicMessage
	for _, m := range messages {
		if m.Role == "system" {
			system = m.Content
			continue
		}
		msgs = append(msgs, anthropicMessage{Role: m.Role, Content: m.Content})
	}

	reqBody := anthropicRequest{
		Model:     c.Model,
		MaxTokens: defaultAnthropicMaxToks,
		System:    system,
		Messages:  msgs,
	}

	body, err := json.Marshal(reqBody)
	if err != nil {
		return "", fmt.Errorf("marshaling request: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, anthropicMessagesURL, bytes.NewReader(body))
	if err != nil {
		return "", fmt.Errorf("creating request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("x-api-key", c.APIKey)
	req.Header.Set("anthropic-version", anthropicAPIVersion)

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("sending request: %w", err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", fmt.Errorf("reading response: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		return "", &LLMError{
			StatusCode: resp.StatusCode,
			Body:       string(respBody),
		}
	}

	var apiResp anthropicResponse
	if err := json.Unmarshal(respBody, &apiResp); err != nil {
		return "", fmt.Errorf("unmarshaling response: %w", err)
	}

	if apiResp.Error != nil {
		return "", fmt.Errorf("API error: %s: %s", apiResp.Error.Type, apiResp.Error.Message)
	}

	var text string
	for _, block := range apiResp.Content {
		if block.Type == "text" {
			text += block.Text
		}
	}

	if text == "" {
		return "", fmt.Errorf("empty response from Anthropic API")
	}

	return text, nil
}
