package decomposer

import (
<<<<<<< HEAD
	"context"
	"fmt"
	"sync"

	"google.golang.org/genai"
=======
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
>>>>>>> a65ebf7 (feat: add decomposer binary for LLM-driven task DAG creation)
)

// Inferencer is the thin LLM inference interface. The engine knows nothing
// about providers — it constructs []Message and gets text back.
type Inferencer interface {
	Complete(ctx context.Context, messages []Message) (string, error)
}

// Message represents a chat message for the LLM API.
type Message struct {
	Role    string // "system", "user", "assistant"
	Content string
}

<<<<<<< HEAD
=======
// AnthropicClient implements Inferencer using the Anthropic Messages API.
type AnthropicClient struct {
	APIKey string
	Model  string
}

const (
	defaultAnthropicModel    = "claude-sonnet-4-20250514"
	anthropicMessagesURL     = "https://api.anthropic.com/v1/messages"
	anthropicAPIVersion      = "2023-06-01"
	defaultAnthropicMaxToks  = 8192
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
		return "", fmt.Errorf("anthropic API key not set")
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

>>>>>>> a65ebf7 (feat: add decomposer binary for LLM-driven task DAG creation)
// LLMError represents an HTTP-level error from an LLM API.
type LLMError struct {
	StatusCode int
	Body       string
}

func (e *LLMError) Error() string {
	return fmt.Sprintf("LLM API error (HTTP %d): %s", e.StatusCode, e.Body)
}

// IsTransient returns true if the error is likely transient (429, 5xx, timeout).
func (e *LLMError) IsTransient() bool {
	return e.StatusCode == 429 || e.StatusCode >= 500
}
<<<<<<< HEAD

// GenAIClient implements Inferencer using Google's GenAI SDK (Vertex AI).
// Auth uses Application Default Credentials (ADC) — no explicit API key needed.
// The underlying genai.Client is created once on first use and reused for all
// subsequent calls, avoiding repeated ADC resolution and TLS setup.
type GenAIClient struct {
	Project  string
	Location string
	Model    string

	once    sync.Once
	client  *genai.Client
	initErr error
}

const (
	defaultGenAIModel    = "gemini-3.6-flash"
	defaultGenAILocation = "us-central1"
	defaultGenAIMaxToks  = 8192
)

// NewGenAIClient creates a GenAIClient with defaults.
// Project and location fall back to GOOGLE_CLOUD_PROJECT and
// GOOGLE_CLOUD_LOCATION env vars.
func NewGenAIClient(project, location, model string) *GenAIClient {
	if model == "" {
		model = defaultGenAIModel
	}
	if location == "" {
		location = defaultGenAILocation
	}
	return &GenAIClient{Project: project, Location: location, Model: model}
}

// getClient returns the shared genai.Client, initializing it on first call.
func (c *GenAIClient) getClient(ctx context.Context) (*genai.Client, error) {
	c.once.Do(func() {
		c.client, c.initErr = genai.NewClient(ctx, &genai.ClientConfig{
			Project:  c.Project,
			Location: c.Location,
			Backend:  genai.BackendVertexAI,
		})
	})
	return c.client, c.initErr
}

// Complete sends a GenerateContent request via the Google GenAI SDK.
func (c *GenAIClient) Complete(ctx context.Context, messages []Message) (string, error) {
	client, err := c.getClient(ctx)
	if err != nil {
		return "", fmt.Errorf("creating GenAI client: %w", err)
	}

	// Separate system message from conversation messages.
	var systemContent *genai.Content
	var contents []*genai.Content
	for _, m := range messages {
		if m.Role == "system" {
			systemContent = genai.NewContentFromText(m.Content, "user")
			continue
		}
		role := m.Role
		if role == "assistant" {
			role = "model"
		}
		contents = append(contents, genai.NewContentFromText(m.Content, genai.Role(role)))
	}

	maxToks := int32(defaultGenAIMaxToks)
	config := &genai.GenerateContentConfig{
		SystemInstruction: systemContent,
		MaxOutputTokens:   maxToks,
	}

	resp, err := client.Models.GenerateContent(ctx, c.Model, contents, config)
	if err != nil {
		return "", fmt.Errorf("GenAI GenerateContent: %w", err)
	}

	text := resp.Text()
	if text == "" {
		return "", fmt.Errorf("empty response from GenAI")
	}

	return text, nil
}
=======
>>>>>>> a65ebf7 (feat: add decomposer binary for LLM-driven task DAG creation)
