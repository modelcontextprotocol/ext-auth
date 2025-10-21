# MCP Authorization Extensions - Reference Implementations

This directory contains reference implementations for the MCP Authorization Extensions specifications.

## Available Implementations

### TypeScript

- **[Cross-App Access Middleware](./typescript/cross-app-access-middleware/)** - A TypeScript fetch middleware that implements Enterprise-Managed Authorization for MCP, enabling seamless cross-app access in enterprise environments.

## Language Support

We welcome reference implementations in other languages. If you'd like to contribute an implementation, please:

1. Create a new directory under the appropriate language folder (e.g., `python/`, `go/`, `rust/`)
2. Follow the patterns established in existing implementations
3. Include comprehensive documentation and examples
4. Ensure your implementation strictly follows the specifications

## Implementation Guidelines

Reference implementations should:

- **Be production-ready**: Include proper error handling, security considerations, and edge cases
- **Follow best practices**: Use idiomatic code for the target language/framework
- **Include tests**: Provide unit tests and integration tests where applicable
- **Provide examples**: Include realistic usage examples and documentation
- **Stay up-to-date**: Track the latest specification versions

## Contributing

Please see the [contributing guidelines](../CONTRIBUTING.md) for information on how to contribute implementations.

## License

All reference implementations are released under the MIT License. See individual implementation directories for their LICENSE files.
