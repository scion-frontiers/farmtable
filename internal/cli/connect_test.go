package cli

import "testing"

func TestIsLocalhost(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name string
		addr string
		want bool
	}{
		{name: "empty address is embedded local", addr: "", want: true},
		{name: "localhost without port", addr: "localhost", want: true},
		{name: "localhost with port", addr: "localhost:50051", want: true},
		{name: "ipv4 loopback with port", addr: "127.0.0.1:50051", want: true},
		{name: "ipv6 loopback without port", addr: "::1", want: true},
		{name: "bracketed ipv6 loopback with port", addr: "[::1]:50051", want: true},
		{name: "remote host with port", addr: "farmtable.example.com:443", want: false},
		{name: "remote ipv4 with port", addr: "192.0.2.1:50051", want: false},
	}

	for _, tt := range tests {
		tt := tt
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			if got := isLocalhost(tt.addr); got != tt.want {
				t.Fatalf("isLocalhost(%q) = %v, want %v", tt.addr, got, tt.want)
			}
		})
	}
}
