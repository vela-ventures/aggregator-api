# 🔄 Swap Aggregator API Guide - Modular Controllers

A well-structured, modular API for finding the best swap routes across multiple DEXes (Botega & Permaswap). Each module handles specific functionality with dedicated controllers.

## 🚀 Quick Start

1. **Start the API:**
   ```bash
   npm run start:dev
   ```

2. **Open the test interface:**
   Open `test-api.html` in your browser to test all endpoints with dummy data.

3. **Access Swagger docs:**
   Visit `http://localhost:3000/api` for interactive API documentation.

## 📊 API Modules & Endpoints

### 🏠 Main API
- **GET `/`** - Main API health check

### 📊 Pools Module (`/pools`)
- **GET `/pools`** - Get all available pools
  - Query: `?refresh=true` to force refresh
- **GET `/pools/status`** - Get pools cache status

### 🛣️ Routes Module (`/routes`)
- **GET `/routes`** - Find all possible routes between tokens
  - Required: `fromToken`, `toToken` (process IDs)
  - Optional: `fromSymbol`, `toSymbol`, `fromDenomination`, `toDenomination`

### 📈 Estimates Module (`/estimates`)
- **GET `/estimates/best`** - Get best swap route with estimate
  - Required: `fromToken`, `toToken`, `amount`
  - Optional: `fromSymbol`, `toSymbol`, `fromDenomination`, `toDenomination`, `userAddress`
- **GET `/estimates/all`** - Get all routes with estimates
  - Same parameters as `/estimates/best`

### 💱 Swap Module (`/swap`)
- **POST `/swap/quote`** - Get comprehensive swap quote with all routes
  - Body: JSON with full token objects, amount, and optional user address
- **GET `/swap/quote/quick`** - Get quick quote (fastest response)
  - Required: `fromTokenId`, `toTokenId`, `amount`
  - Optional: `userAddress`
- **GET `/swap/pools`** - Get all available pools (swap module)
  - Query: `?refresh=true` to force refresh
- **GET `/swap/cache/status`** - Get cache status (swap module)
- **POST `/swap/cache/invalidate`** - Invalidate cache (swap module)
- **GET `/swap/health`** - Health check (swap module)

## 💡 Usage Examples

### Pools Module
```bash
# Get all pools
curl "http://localhost:3000/pools"

# Get pools with forced refresh
curl "http://localhost:3000/pools?refresh=true"

# Get cache status
curl "http://localhost:3000/pools/status"
```

### Routes Module
```bash
# Find routes between tokens
curl "http://localhost:3000/routes?fromToken=0syT13r0s0tgPmIed95bJnuSqaD29HQNN8D3ElLSrsc&toToken=xU9zFkq3X2ZQ6olwNVvr1vUWIjc3kXTWr7xKQD6dh10"

# With optional parameters
curl "http://localhost:3000/routes?fromToken=0syT13r0s0tgPmIed95bJnuSqaD29HQNN8D3ElLSrsc&toToken=xU9zFkq3X2ZQ6olwNVvr1vUWIjc3kXTWr7xKQD6dh10&fromSymbol=AO&toSymbol=wAR&fromDenomination=12&toDenomination=12"
```

### Estimates Module
```bash
# Get best route estimate
curl "http://localhost:3000/estimates/best?fromToken=0syT13r0s0tgPmIed95bJnuSqaD29HQNN8D3ElLSrsc&toToken=xU9zFkq3X2ZQ6olwNVvr1vUWIjc3kXTWr7xKQD6dh10&amount=100"

# Get all routes with estimates
curl "http://localhost:3000/estimates/all?fromToken=0syT13r0s0tgPmIed95bJnuSqaD29HQNN8D3ElLSrsc&toToken=xU9zFkq3X2ZQ6olwNVvr1vUWIjc3kXTWr7xKQD6dh10&amount=100&userAddress=OxQoZQVQMq4ZkscGkUfLMy1XE0fY6Ljn0Z8EfI4Cn78"
```

### Swap Module
```bash
# Quick quote (GET)
curl "http://localhost:3000/swap/quote/quick?fromTokenId=0syT13r0s0tgPmIed95bJnuSqaD29HQNN8D3ElLSrsc&toTokenId=xU9zFkq3X2ZQ6olwNVvr1vUWIjc3kXTWr7xKQD6dh10&amount=100"

# Comprehensive quote (POST)
curl -X POST http://localhost:3000/swap/quote \
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

# Swap module health
curl "http://localhost:3000/swap/health"

# Invalidate cache
curl -X POST "http://localhost:3000/swap/cache/invalidate"
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
3. Each module is clearly separated with module badges
4. Click buttons to test each endpoint with pre-filled dummy data
5. View formatted responses with success/error indicators

## 🏗️ Architecture

### Modular Design
- **Pools Module**: Pool data management and caching
- **Routes Module**: Route discovery between tokens  
- **Estimates Module**: Best route selection and pricing estimates
- **Swap Module**: Comprehensive quote generation and additional utilities

### Key Features
- **Clean Separation**: Each module handles specific functionality
- **Consistent APIs**: Similar parameter patterns across modules
- **Multiple Interfaces**: Both GET (query params) and POST (JSON body) options
- **Error Handling**: Consistent error responses across all modules
- **Caching**: Built-in pool caching with manual refresh options
- **Swagger Integration**: Auto-generated API documentation

## 🔄 Key Differences Between Modules

### Parameter Styles
- **Routes & Estimates**: Use query parameters for simple requests
- **Swap**: Offers both query params (quick) and JSON body (comprehensive)

### Token Representation
- **Simple**: Just `fromToken` and `toToken` process IDs
- **Enhanced**: Additional `fromSymbol`, `toSymbol`, `fromDenomination`, `toDenomination`
- **Full Objects**: Complete token objects with all metadata

### Response Complexity
- **Routes**: Basic route information
- **Estimates**: Routes + pricing estimates
- **Swap**: Full quotes with execution metrics

## 🚀 Best Practices

1. **Use Routes Module** for discovering possible paths
2. **Use Estimates Module** for quick pricing with minimal data
3. **Use Swap Module** for comprehensive quotes with full token metadata
4. **Monitor cache status** to optimize performance
5. **Use appropriate endpoints** based on required response detail level 