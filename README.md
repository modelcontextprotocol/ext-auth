# MCP Authorization Extensions

The Model Context Protocol (MCP) specification is defined in the [main specification repository](https://github.com/modelcontextprotocol/modelcontextprotocol/tree/main/docs/specification). This repository contains **extensions** to the core protocol that define additional authorization mechanisms.

These extensions are:

- **Optional** - Implementations can choose to adopt these extensions
- **Additive** - Extensions do not modify or break core protocol functionality; they add new capabilities while preserving core protocol behavior
- **Composable** - Extensions are modular and designed to work together without conflicts, allowing implementations to adopt multiple extensions simultaneously
- **Versioned with the core protocol** - A Stable extension is published as revisions keyed to core protocol revisions, and proposed changes collect in its `draft/` directory

## Extensions

The directory that holds an extension's specification shows its stage: `specification/experimental/`, `specification/beta/` or `specification/stable/`. [SEP-3392](https://github.com/modelcontextprotocol/modelcontextprotocol/pull/3392) defines the stages.

### Stable

- [Enterprise-Managed Authorization](./specification/stable/enterprise-managed-authorization/2026-07-28/enterprise-managed-authorization.mdx) ([draft](./specification/stable/enterprise-managed-authorization/draft/enterprise-managed-authorization.mdx))
- [OAuth Client Credentials](./specification/stable/oauth-client-credentials/2026-07-28/oauth-client-credentials.mdx) ([draft](./specification/stable/oauth-client-credentials/draft/oauth-client-credentials.mdx))

### Experimental

Experimental extensions may change or be withdrawn at any time, without notice.

- [DPoP Profile for MCP](./specification/experimental/dpop.mdx)

## Governance

This repository follows the [Model Context Protocol Governance](https://modelcontextprotocol.io/community/governance) process, with a dedicated set of Extension Maintainers for authorization extensions, listed in [MAINTAINERS.md](./MAINTAINERS.md). The extensions are associated with the [Authorization Interest Group](https://modelcontextprotocol.io/community/interest-groups/auth).

All decisions regarding authorization extensions follow the same governance model as the core specification, including:

- Specification Enhancement Proposals (SEPs)
- Community discussion and consensus building
- Maintainer review and approval
- Transparent decision-making

## Policies

This repository follows the Model Context Protocol project policies:

- [Code of Conduct](https://github.com/modelcontextprotocol/modelcontextprotocol/blob/main/CODE_OF_CONDUCT.md)
- [Contributing Guidelines](https://github.com/modelcontextprotocol/modelcontextprotocol/blob/main/CONTRIBUTING.md)
- [Security Policy](https://github.com/modelcontextprotocol/modelcontextprotocol/blob/main/SECURITY.md)
- [Antitrust Policy](https://github.com/modelcontextprotocol/modelcontextprotocol/blob/main/ANTITRUST.md)
