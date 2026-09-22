# Boohee Health MCP

A minimal stdio MCP server that records weight and food in the Boohee Open APIs.

It exposes only two tools:

- `search_food` → `GET /v1/food/search`
- `search_food_by_code` → `/v1/food/detail`

## Configuration

Set exactly one credential in `.env` before starting the server:

```bash
export BOOHEE_API_KEY="your_api_key"
# Or:
export BOOHEE_ACCESS_TOKEN="your_access_token"
```

## Install and run

```bash
npm install
npm run build
npm start
npm run test
```

For an MCP platform that starts a stdio process:

```json
{
  "command": "node",
  "args": [ "/absolute/path/to/boohee-health-MCP/dist/index.js" ],
  "env": {
    "BOOHEE_API_KEY": "your_api_key"
  }
}
```

## References

- [Boohee API Doc](https://ai.boohee.com/docs/)
- [boohee Console](https://ai.boohee.com/console/)
