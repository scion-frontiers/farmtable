package store

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"encoding/base64"
	"errors"
	"fmt"
	"io"
	"os"
	"strings"
)

const (
	// encryptedPrefix marks ciphertext so we can distinguish it from plaintext tokens.
	encryptedPrefix = "enc:v1:"
	// encryptionKeyEnv is the env var holding the base64-encoded 32-byte AES key.
	encryptionKeyEnv = "FARMTABLE_ENCRYPTION_KEY"
)

var (
	ErrEncryptionKeyNotSet = errors.New("FARMTABLE_ENCRYPTION_KEY not set")
	ErrEncryptionKeySize   = errors.New("encryption key must be 32 bytes (base64-encoded)")
	ErrDecryptionFailed    = errors.New("decryption failed: ciphertext is invalid or key is wrong")
)

// CredentialEncryptor provides AES-256-GCM encryption and decryption for
// auth_token (and refresh_token) fields stored in LinkedAccounts.
type CredentialEncryptor struct {
	key []byte // 32 bytes for AES-256
}

// NewCredentialEncryptor creates an encryptor from a base64-encoded 32-byte key.
func NewCredentialEncryptor(base64Key string) (*CredentialEncryptor, error) {
	key, err := base64.StdEncoding.DecodeString(base64Key)
	if err != nil {
		return nil, fmt.Errorf("decoding encryption key: %w", err)
	}
	if len(key) != 32 {
		return nil, ErrEncryptionKeySize
	}
	return &CredentialEncryptor{key: key}, nil
}

// NewCredentialEncryptorFromEnv creates an encryptor using the
// FARMTABLE_ENCRYPTION_KEY environment variable.
func NewCredentialEncryptorFromEnv() (*CredentialEncryptor, error) {
	keyStr := os.Getenv(encryptionKeyEnv)
	if keyStr == "" {
		return nil, ErrEncryptionKeyNotSet
	}
	return NewCredentialEncryptor(keyStr)
}

// Encrypt encrypts plaintext using AES-256-GCM and returns the ciphertext
// with the "enc:v1:" prefix. If the value is already encrypted, it is returned
// unchanged.
func (e *CredentialEncryptor) Encrypt(plaintext string) (string, error) {
	if plaintext == "" {
		return plaintext, nil
	}
	if IsEncrypted(plaintext) {
		return plaintext, nil
	}

	block, err := aes.NewCipher(e.key)
	if err != nil {
		return "", fmt.Errorf("creating cipher: %w", err)
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", fmt.Errorf("creating GCM: %w", err)
	}

	nonce := make([]byte, gcm.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return "", fmt.Errorf("generating nonce: %w", err)
	}

	ciphertext := gcm.Seal(nonce, nonce, []byte(plaintext), nil)
	encoded := base64.StdEncoding.EncodeToString(ciphertext)
	return encryptedPrefix + encoded, nil
}

// Decrypt decrypts a value that was encrypted with Encrypt. If the value does
// not have the encrypted prefix (i.e. it is plaintext), it is returned as-is.
func (e *CredentialEncryptor) Decrypt(ciphertext string) (string, error) {
	if ciphertext == "" {
		return ciphertext, nil
	}
	if !IsEncrypted(ciphertext) {
		// Plaintext token — return as-is for backward compatibility.
		return ciphertext, nil
	}

	encoded := strings.TrimPrefix(ciphertext, encryptedPrefix)
	data, err := base64.StdEncoding.DecodeString(encoded)
	if err != nil {
		return "", fmt.Errorf("decoding ciphertext: %w", err)
	}

	block, err := aes.NewCipher(e.key)
	if err != nil {
		return "", fmt.Errorf("creating cipher: %w", err)
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", fmt.Errorf("creating GCM: %w", err)
	}

	nonceSize := gcm.NonceSize()
	if len(data) < nonceSize {
		return "", ErrDecryptionFailed
	}

	nonce, sealed := data[:nonceSize], data[nonceSize:]
	plaintext, err := gcm.Open(nil, nonce, sealed, nil)
	if err != nil {
		return "", ErrDecryptionFailed
	}
	return string(plaintext), nil
}

// IsEncrypted returns true if the value starts with the encrypted prefix.
func IsEncrypted(value string) bool {
	return strings.HasPrefix(value, encryptedPrefix)
}

// EncryptIfNeeded encrypts the value only if it is currently plaintext.
// Returns the (possibly newly encrypted) value and whether encryption was applied.
func (e *CredentialEncryptor) EncryptIfNeeded(value string) (string, bool, error) {
	if value == "" || IsEncrypted(value) {
		return value, false, nil
	}
	encrypted, err := e.Encrypt(value)
	if err != nil {
		return "", false, err
	}
	return encrypted, true, nil
}
