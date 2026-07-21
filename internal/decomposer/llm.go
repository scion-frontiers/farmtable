package decomposer

import (
	"context"
	"fmt"
	"sync"

	"google.golang.org/genai"
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
