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

// OpenAIClient implements Inferencer using the OpenAI Chat Completions API.
type OpenAIClient struct {
	APIKey string
	Model  string
}

const (
	defaultOpenAIModel      = "gpt-4o"
	openAIChatCompletionURL = "https://api.openai.com/v1/chat/completions"
	defaultOpenAIMaxToks    = 8192
)

// NewOpenAIClient creates an OpenAIClient with defaults.
func NewOpenAIClient(apiKey, model string) *OpenAIClient {
	if apiKey == "" {
		apiKey = os.Getenv("OPENAI_API_KEY")
	}
	if model == "" {
		model = defaultOpenAIModel
	}
	return &OpenAIClient{APIKey: apiKey, Model: model}
}

// openAIRequest is the request body for the OpenAI Chat Completions API.
type openAIRequest struct {
	Model     string          `json:"model"`
	Messages  []openAIMessage `json:"messages"`
	MaxTokens int             `json:"max_tokens,omitempty"`
}

type openAIMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

// openAIResponse is the response from the OpenAI Chat Completions API.
type openAIResponse struct {
	Choices []struct {
		Message struct {
			Content string `json:"content"`
		} `json:"message"`
	} `json:"choices"`
	Error *struct {
		Message string `json:"message"`
		Type    string `json:"type"`
	} `json:"error"`
}

// Complete sends a chat completion request to the OpenAI API.
func (c *OpenAIClient) Complete(ctx context.Context, messages []Message) (string, error) {
	if c.APIKey == "" {
		return "", fmt.Errorf("OpenAI API key not set")
	}

	var msgs []openAIMessage
	for _, m := range messages {
		msgs = append(msgs, openAIMessage{Role: m.Role, Content: m.Content})
	}

	reqBody := openAIRequest{
		Model:     c.Model,
		Messages:  msgs,
		MaxTokens: defaultOpenAIMaxToks,
	}

	body, err := json.Marshal(reqBody)
	if err != nil {
		return "", fmt.Errorf("marshaling request: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, openAIChatCompletionURL, bytes.NewReader(body))
	if err != nil {
		return "", fmt.Errorf("creating request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+c.APIKey)

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

	var apiResp openAIResponse
	if err := json.Unmarshal(respBody, &apiResp); err != nil {
		return "", fmt.Errorf("unmarshaling response: %w", err)
	}

	if apiResp.Error != nil {
		return "", fmt.Errorf("API error: %s: %s", apiResp.Error.Type, apiResp.Error.Message)
	}

	if len(apiResp.Choices) == 0 || apiResp.Choices[0].Message.Content == "" {
		return "", fmt.Errorf("empty response from OpenAI API")
	}

	return apiResp.Choices[0].Message.Content, nil
}
