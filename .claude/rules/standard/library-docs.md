## Library Documentation with Context7

**Rule:** Use Context7 for library/framework documentation. Both tools require a descriptive `query` parameter for server-side reranking.

### Workflow

```
# Step 1: Get library ID
resolve-library-id(query="your question", libraryName="package-name")
→ Returns libraryId (e.g., "/npm/react")

# Step 2: Query docs
query-docs(libraryId="/npm/react", query="specific question")
→ Returns relevant documentation
```

### Query Tips

Use descriptive queries - they drive result relevance:
- ❌ `"fixtures"` → ✅ `"how to create and use fixtures in pytest"`
- ❌ `"hooks"` → ✅ `"useState and useEffect patterns in React"`

### When to Use

| Need | Tool |
|------|------|
| Library API reference | Context7 |
| Framework patterns | Context7 |
| Error message lookup | Firecrawl (broader search) |
| General web research | Firecrawl |
| Codebase patterns | Vexor |

### Troubleshooting

- **Library not found:** Try `@types/react` vs `react`, or `node:fs` for built-ins
- **Poor results:** Make query more specific, describe what you're trying to accomplish
- **Empty results:** Library may not be indexed - fall back to `firecrawl_scrape`
