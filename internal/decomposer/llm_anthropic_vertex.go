package decomposer

import (
	"context"
	"errors"
	"fmt"
	"sync"

	"github.com/anthropics/anthropic-sdk-go"
	"github.com/anthropics/anthropic-sdk-go/vertex"
)

// AnthropicVertexClient implements Inferencer using the Anthropic Go SDK
// configured for Vertex AI (Claude on Vertex / Model Garden). Auth uses
// Application Default Credentials (ADC) — no Anthropic API key needed.
//
// The underlying anthropic.Client is created once on first use and reused
// for all subsequent calls, mirroring the GenAIClient pattern.
type AnthropicVertexClient struct {
	Project  string
	Location string
	Model    string

	once    sync.Once
	client  *anthropic.Client
	initErr error
}

const (
	defaultAnthropicVertexModel    = "claude-sonnet-4-20250514"
	defaultAnthropicVertexLocation = "us-east5"
	defaultAnthropicVertexMaxToks  = 8192
)

// NewAnthropicVertexClient creates an AnthropicVertexClient with defaults.
// Project and location fall back to the caller-provided values; the CLI
// resolves GOOGLE_CLOUD_PROJECT and GOOGLE_CLOUD_LOCATION before calling this.
func NewAnthropicVertexClient(project, location, model string) *AnthropicVertexClient {
	if model == "" {
		model = defaultAnthropicVertexModel
	}
	if location == "" {
		location = defaultAnthropicVertexLocation
	}
	return &AnthropicVertexClient{Project: project, Location: location, Model: model}
}

// getClient returns the shared anthropic.Client, initializing it on first call.
// Initialization uses vertex.WithGoogleAuth which loads ADC and configures
// the client to route requests through Vertex AI endpoints.
func (c *AnthropicVertexClient) getClient(ctx context.Context) (*anthropic.Client, error) {
	c.once.Do(func() {
		client := anthropic.NewClient(
			vertex.WithGoogleAuth(ctx, c.Location, c.Project),
		)
		c.client = &client
	})
	return c.client, c.initErr
}

// Complete sends a message completion request to an Anthropic model via
// Vertex AI. It maps the decomposer's []Message into the Anthropic SDK
// types, separating system instructions from conversation messages.
func (c *AnthropicVertexClient) Complete(ctx context.Context, messages []Message) (string, error) {
	client, err := c.getClient(ctx)
	if err != nil {
		return "", fmt.Errorf("creating Anthropic Vertex client: %w", err)
	}

	// Separate system message from conversation messages.
	var system []anthropic.TextBlockParam
	var msgs []anthropic.MessageParam
	for _, m := range messages {
		switch m.Role {
		case "system":
			system = append(system, anthropic.TextBlockParam{Text: m.Content})
		case "user":
			msgs = append(msgs, anthropic.NewUserMessage(anthropic.NewTextBlock(m.Content)))
		case "assistant":
			msgs = append(msgs, anthropic.NewAssistantMessage(anthropic.NewTextBlock(m.Content)))
		}
	}

	params := anthropic.MessageNewParams{
		Model:     c.Model,
		MaxTokens: defaultAnthropicVertexMaxToks,
		Messages:  msgs,
	}
	if len(system) > 0 {
		params.System = system
	}

	resp, err := client.Messages.New(ctx, params)
	if err != nil {
		// Try to extract HTTP status for the engine's retry logic.
		if statusCode := extractAnthropicHTTPStatus(err); statusCode > 0 {
			return "", &LLMError{StatusCode: statusCode, Body: err.Error()}
		}
		return "", fmt.Errorf("Anthropic Vertex Messages.New: %w", err)
	}

	var text string
	for _, block := range resp.Content {
		if block.Type == "text" {
			text += block.Text
		}
	}

	if text == "" {
		return "", fmt.Errorf("empty response from Anthropic Vertex API")
	}

	return text, nil
}

// extractAnthropicHTTPStatus tries to derive an HTTP status code from an
// Anthropic SDK error. The SDK returns *anthropic.Error for API-level errors.
func extractAnthropicHTTPStatus(err error) int {
	var apiErr *anthropic.Error
	if errors.As(err, &apiErr) {
		return apiErr.StatusCode
	}
	return 0
}
