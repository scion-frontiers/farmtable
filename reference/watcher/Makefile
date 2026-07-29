.PHONY: help build install clean run update-bd prune

APP_NAME = Watcher.app
# Use absolute path for the build directory so the symlink resolves correctly from anywhere
BUILD_DIR = $(CURDIR)/build/macos/Build/Products/Release
INSTALL_DIR = /Applications

.DEFAULT_GOAL := help

help: ## Show this help message
	@echo "Usage: make [target]"
	@echo ""
	@echo "Targets:"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  %-10s %s\n", $$1, $$2}'

build: build-daemon ## Build the macOS release app and embed the daemon
	@echo "Building $(APP_NAME) for macOS..."
	flutter build macos --release
	@echo "Embedding watcher-daemon into app bundle..."
	@mkdir -p $(BUILD_DIR)/$(APP_NAME)/Contents/Resources
	@cp daemon/watcher-daemon $(BUILD_DIR)/$(APP_NAME)/Contents/Resources/watcher-daemon
	@echo "Re-signing the app bundle..."
	codesign --force --deep --sign - $(BUILD_DIR)/$(APP_NAME)
	@$(MAKE) prune

prune: ## Prune intermediate build files to save space
	@echo "Pruning intermediate build artifacts..."
	@rm -rf build/macos/Build/Intermediates.noindex
	@rm -rf build/macos/ModuleCache.noindex
	@rm -rf build/macos/Build/Products/Release/FlutterMacOS.framework.dSYM
	@find build/macos/Build/Products/Release -maxdepth 1 -not -name "Watcher.app" -not -name "Release" -exec rm -rf {} + 2>/dev/null || true

build-daemon: ## Build the Go daemon
	@echo "Building watcher-daemon..."
	cd daemon && CGO_CFLAGS="-I$$(brew --prefix icu4c)/include" CGO_LDFLAGS="-L$$(brew --prefix icu4c)/lib" CGO_CXXFLAGS="-std=c++17 -I$$(brew --prefix icu4c)/include" go build -o watcher-daemon

update-bd: ## Update the embedded beads dependency to the latest upstream release
	@echo "Updating github.com/steveyegge/beads to @latest..."
	@cd daemon && go get github.com/steveyegge/beads@latest && go mod tidy
	@LATEST=$$(cd daemon && go list -m github.com/steveyegge/beads | awk '{print $$2}'); \
	echo "Successfully updated to version $$LATEST."; \
	echo "Run 'make install' to rebuild Watcher."

install: build ## Build and install a symlink to /Applications
	@echo "Installing $(APP_NAME) alias to $(INSTALL_DIR)..."
	@rm -rf $(INSTALL_DIR)/$(APP_NAME)
	@ln -s $(BUILD_DIR)/$(APP_NAME) $(INSTALL_DIR)/$(APP_NAME)
	@echo "Installed successfully! You can now open $(APP_NAME) from your Applications folder or Spotlight."

run: ## Run the app in debug mode
	flutter run -d macos

clean: ## Clean the Flutter build cache
	flutter clean
