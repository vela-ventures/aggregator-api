# 🔄 Swap Aggregator API Guide

A simplified, intuitive API for finding the best swap routes across multiple DEXes (Botega & Permaswap).

## 🚀 Quick Start

1. **Start the API:**
   ```bash
   npm run start:dev
   ```

2. **Open the test interface:**
   Open `test-api.html` in your browser to test all endpoints with dummy data.

3. **Access Swagger docs:**
   Visit `http://localhost:3000/api` for interactive API documentation.

## 📊 API Endpoints

### Health Check
- **GET `/`** - Check API status

### Pool Management
- **GET `/pools`** - Get all available pools
  - Query: `?refresh=true` to force refresh
- **GET `/pools/cache`** - Get cache status
- **POST `/pools/refresh`** - Force refresh pools cache

### Route Discovery
- **GET `/routes`** - Find all possible routes between tokens
  - Required: `fromToken`, `toToken` (process IDs)
  - Optional: `fromSymbol`, `toSymbol`

### Swap Quotes
- **GET `/quote`** - Get best swap route
  - Required: `fromToken`, `toToken`, `amount`
  - Optional: `userAddress`
  
- **GET `/quote/quick`** - Get fastest quote (best route only)
  - Same parameters as `/quote`
  
- **POST `/quote`** - Get detailed quote with all routes
  - Body: JSON with token details, amount, and optional user address

## 💡 Usage Examples

### Simple Quote Request
```bash
curl "http://localhost:3000/quote?fromToken=0syT13r0s0tgPmIed95bJnuSqaD29HQNN8D3ElLSrsc&toToken=xU9zFkq3X2ZQ6olwNVvr1vUWIjc3kXTWr7xKQD6dh10&amount=100"
```

### Detailed Quote Request
```bash
curl -X POST http://localhost:3000/quote \
  -H "Content-Type: application/json" \
  -d '{
    "fromToken": {
      "processId": "0syT13r0s0tgPmIed95bJnuSqaD29HQNN8D3ElLSrsc",
      "symbol": "AO",
      "denomination": 12
    },
    "toToken": {
      "processId": "xU9zFkq3X2ZQ6olwNVvr1vUWIjc3kXTWr7xKQD6dh10",
      "symbol": "wAR",
      "denomination": 12
    },
    "amount": 1000
  }'
```

### Get Available Pools
```bash
curl "http://localhost:3000/pools"
```

### Find Routes
```bash
curl "http://localhost:3000/routes?fromToken=0syT13r0s0tgPmIed95bJnuSqaD29HQNN8D3ElLSrsc&toToken=xU9zFkq3X2ZQ6olwNVvr1vUWIjc3kXTWr7xKQD6dh10"
```

## 🔧 Sample Token IDs

For testing, you can use these sample token process IDs:

- **AO Token**: `0syT13r0s0tgPmIed95bJnuSqaD29HQNN8D3ElLSrsc`
- **wAR Token**: `xU9zFkq3X2ZQ6olwNVvr1vUWIjc3kXTWr7xKQD6dh10`

## 📝 Response Format

All endpoints return JSON responses with consistent error handling:

```json
{
  "status": "success|error",
  "data": {...},
  "message": "Optional message"
}
```

## 🧪 Testing

Use the included `test-api.html` file for interactive testing:
1. Open the file in any modern browser
2. Adjust the API URL if needed (defaults to `http://localhost:3000`)
3. Click buttons to test each endpoint with pre-filled dummy data
4. View formatted responses with success/error indicators

## 🏗️ Architecture

- **Unified Controller**: Single controller handling all endpoints
- **Clean Separation**: Pools, routes, and quotes logically grouped
- **Error Handling**: Consistent error responses across all endpoints
- **Caching**: Built-in pool caching with manual refresh options
- **Swagger Integration**: Auto-generated API documentation

## 🔄 Changes Made

1. **Simplified Structure**: Consolidated multiple controllers into one intuitive API
2. **Fixed TypeScript Errors**: Resolved compilation issues
3. **Intuitive Endpoints**: Clear, RESTful endpoint naming
4. **Better Error Handling**: Consistent error responses
5. **Removed Complexity**: Eliminated unnecessary modules and dependencies
6. **Added Testing**: Interactive HTML test interface included 