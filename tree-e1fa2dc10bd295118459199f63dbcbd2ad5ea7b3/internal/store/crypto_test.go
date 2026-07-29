package store

import (
	"encoding/base64"
	"strings"
	"testing"
)

// testKey returns a valid base64-encoded 32-byte key for testing.
func testKey() string {
	key := make([]byte, 32)
	for i := range key {
		key[i] = byte(i)
	}
	return base64.StdEncoding.EncodeToString(key)
}

// testKey2 returns a different valid 32-byte key for key-rotation tests.
func testKey2() string {
	key := make([]byte, 32)
	for i := range key {
		key[i] = byte(i + 100)
	}
	return base64.StdEncoding.EncodeToString(key)
}

func TestCredentialEncryptor_RoundTrip(t *testing.T) {
	enc, err := NewCredentialEncryptor(testKey())
	if err != nil {
		t.Fatalf("NewCredentialEncryptor: %v", err)
	}

	tests := []struct {
		name      string
		plaintext string
	}{
		{"simple token", "ghp_abc123def456"},
		{"long token", strings.Repeat("x", 1000)},
		{"unicode", "token-日本語-🎉"},
		{"empty", ""},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			encrypted, err := enc.Encrypt(tt.plaintext)
			if err != nil {
				t.Fatalf("Encrypt: %v", err)
			}

			if tt.plaintext != "" && !IsEncrypted(encrypted) {
				t.Error("expected encrypted prefix")
			}
			if tt.plaintext != "" && encrypted == tt.plaintext {
				t.Error("encrypted value should differ from plaintext")
			}

			decrypted, err := enc.Decrypt(encrypted)
			if err != nil {
				t.Fatalf("Decrypt: %v", err)
			}

			if decrypted != tt.plaintext {
				t.Errorf("round-trip mismatch: got %q, want %q", decrypted, tt.plaintext)
			}
		})
	}
}

func TestCredentialEncryptor_DoubleEncrypt(t *testing.T) {
	enc, err := NewCredentialEncryptor(testKey())
	if err != nil {
		t.Fatalf("NewCredentialEncryptor: %v", err)
	}

	plaintext := "secret-token"
	encrypted1, err := enc.Encrypt(plaintext)
	if err != nil {
		t.Fatalf("Encrypt: %v", err)
	}

	// Encrypting an already-encrypted value should return it unchanged.
	encrypted2, err := enc.Encrypt(encrypted1)
	if err != nil {
		t.Fatalf("Encrypt (second): %v", err)
	}

	if encrypted1 != encrypted2 {
		t.Error("double encryption should be a no-op")
	}
}

func TestCredentialEncryptor_DecryptPlaintext(t *testing.T) {
	enc, err := NewCredentialEncryptor(testKey())
	if err != nil {
		t.Fatalf("NewCredentialEncryptor: %v", err)
	}

	// Decrypting a plaintext value should return it as-is (backward compatibility).
	plaintext := "ghp_plaintext_token"
	decrypted, err := enc.Decrypt(plaintext)
	if err != nil {
		t.Fatalf("Decrypt: %v", err)
	}
	if decrypted != plaintext {
		t.Errorf("expected plaintext pass-through, got %q", decrypted)
	}
}

func TestCredentialEncryptor_WrongKey(t *testing.T) {
	enc1, err := NewCredentialEncryptor(testKey())
	if err != nil {
		t.Fatalf("NewCredentialEncryptor: %v", err)
	}

	enc2, err := NewCredentialEncryptor(testKey2())
	if err != nil {
		t.Fatalf("NewCredentialEncryptor (key2): %v", err)
	}

	encrypted, err := enc1.Encrypt("secret")
	if err != nil {
		t.Fatalf("Encrypt: %v", err)
	}

	_, err = enc2.Decrypt(encrypted)
	if err == nil {
		t.Error("expected decryption to fail with wrong key")
	}
	if err != ErrDecryptionFailed {
		t.Errorf("expected ErrDecryptionFailed, got: %v", err)
	}
}

func TestCredentialEncryptor_KeyRotation(t *testing.T) {
	enc1, err := NewCredentialEncryptor(testKey())
	if err != nil {
		t.Fatalf("NewCredentialEncryptor: %v", err)
	}

	enc2, err := NewCredentialEncryptor(testKey2())
	if err != nil {
		t.Fatalf("NewCredentialEncryptor (key2): %v", err)
	}

	plaintext := "my-secret-token"

	// Encrypt with key1.
	encrypted1, err := enc1.Encrypt(plaintext)
	if err != nil {
		t.Fatalf("Encrypt: %v", err)
	}

	// Decrypt with key1.
	decrypted, err := enc1.Decrypt(encrypted1)
	if err != nil {
		t.Fatalf("Decrypt: %v", err)
	}
	if decrypted != plaintext {
		t.Fatal("round-trip with key1 failed")
	}

	// Re-encrypt with key2 (simulating key rotation).
	encrypted2, err := enc2.Encrypt(plaintext)
	if err != nil {
		t.Fatalf("Encrypt (key2): %v", err)
	}

	// Decrypt with key2.
	decrypted2, err := enc2.Decrypt(encrypted2)
	if err != nil {
		t.Fatalf("Decrypt (key2): %v", err)
	}
	if decrypted2 != plaintext {
		t.Fatal("round-trip with key2 failed")
	}
}

func TestCredentialEncryptor_PlaintextMigration(t *testing.T) {
	enc, err := NewCredentialEncryptor(testKey())
	if err != nil {
		t.Fatalf("NewCredentialEncryptor: %v", err)
	}

	plaintext := "legacy_plain_token"

	// EncryptIfNeeded should encrypt plaintext.
	encrypted, didEncrypt, err := enc.EncryptIfNeeded(plaintext)
	if err != nil {
		t.Fatalf("EncryptIfNeeded: %v", err)
	}
	if !didEncrypt {
		t.Error("expected didEncrypt=true for plaintext")
	}
	if !IsEncrypted(encrypted) {
		t.Error("expected encrypted result")
	}

	// EncryptIfNeeded should be a no-op for already-encrypted values.
	encrypted2, didEncrypt2, err := enc.EncryptIfNeeded(encrypted)
	if err != nil {
		t.Fatalf("EncryptIfNeeded (second): %v", err)
	}
	if didEncrypt2 {
		t.Error("expected didEncrypt=false for already-encrypted value")
	}
	if encrypted != encrypted2 {
		t.Error("expected unchanged value for already-encrypted input")
	}

	// Verify we can decrypt the migrated token.
	decrypted, err := enc.Decrypt(encrypted)
	if err != nil {
		t.Fatalf("Decrypt: %v", err)
	}
	if decrypted != plaintext {
		t.Errorf("expected %q, got %q", plaintext, decrypted)
	}
}

func TestCredentialEncryptor_EmptyValues(t *testing.T) {
	enc, err := NewCredentialEncryptor(testKey())
	if err != nil {
		t.Fatalf("NewCredentialEncryptor: %v", err)
	}

	// EncryptIfNeeded with empty string.
	result, didEncrypt, err := enc.EncryptIfNeeded("")
	if err != nil {
		t.Fatalf("EncryptIfNeeded: %v", err)
	}
	if didEncrypt {
		t.Error("expected didEncrypt=false for empty string")
	}
	if result != "" {
		t.Error("expected empty result")
	}
}

func TestNewCredentialEncryptor_InvalidKey(t *testing.T) {
	tests := []struct {
		name    string
		key     string
		wantErr bool
	}{
		{"valid key", testKey(), false},
		{"too short", base64.StdEncoding.EncodeToString([]byte("short")), true},
		{"too long", base64.StdEncoding.EncodeToString(make([]byte, 64)), true},
		{"invalid base64", "not-valid-base64!!!", true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := NewCredentialEncryptor(tt.key)
			if (err != nil) != tt.wantErr {
				t.Errorf("NewCredentialEncryptor() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}

func TestIsEncrypted(t *testing.T) {
	tests := []struct {
		value    string
		expected bool
	}{
		{"enc:v1:abc123", true},
		{"ghp_plaintext", false},
		{"", false},
		{"enc:", false},
		{"enc:v1:", true},
	}

	for _, tt := range tests {
		if got := IsEncrypted(tt.value); got != tt.expected {
			t.Errorf("IsEncrypted(%q) = %v, want %v", tt.value, got, tt.expected)
		}
	}
}

func TestCredentialEncryptor_UniqueNonces(t *testing.T) {
	enc, err := NewCredentialEncryptor(testKey())
	if err != nil {
		t.Fatalf("NewCredentialEncryptor: %v", err)
	}

	// Encrypt the same plaintext multiple times — each should produce a
	// different ciphertext due to random nonces.
	plaintext := "same-token"
	seen := make(map[string]bool)
	for i := 0; i < 10; i++ {
		encrypted, err := enc.Encrypt(plaintext)
		if err != nil {
			t.Fatalf("Encrypt: %v", err)
		}
		if seen[encrypted] {
			t.Fatal("duplicate ciphertext detected — nonce reuse")
		}
		seen[encrypted] = true
	}
}
