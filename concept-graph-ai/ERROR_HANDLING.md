# Error Handling & JSON Validation

This document describes the error handling and JSON validation systems implemented across the application.

## Backend Error Handling

### Error Classes

#### `AIError`
General AI processing error
```javascript
new AIError(message, code, statusCode)
```

#### `ValidationError`  
Data validation failed
```javascript
new ValidationError(message, errors)
```

#### `ExtractionError`
Text/document extraction failed
```javascript
new ExtractionError(message, type)
```

### Error Handler Functions

#### `handleAIError(error, context)`
Converts errors to standardized response format. Handles:
- File not found (404)
- Permission denied (403)
- Timeout errors (408)
- Memory errors (500)

```javascript
const result = handleAIError(error, 'extractFromFile');
// Returns: { success: false, error: message, code, statusCode }
```

#### `retryWithBackoff(fn, maxRetries, delayMs)`
Automatically retries failed async operations with exponential backoff
```javascript
const result = await retryWithBackoff(async () => {
  return await someFailableOperation();
}, 3, 1000);
```

#### `isRetryableError(error)`
Determines if an error should trigger a retry

### Middleware

#### `validateRequestJSON(schema)`
Validates incoming request body against schema
```javascript
router.post('/api/topics', 
  validateRequestJSON({ text: 'string' }),
  extractTopics
);
```

#### `errorHandlingMiddleware(err, req, res, next)`
Global error handler - catches and formats all errors
Must be registered last in middleware chain

#### `asyncHandler(fn)`
Wraps async route handlers to catch errors
```javascript
router.post('/route', asyncHandler(async (req, res) => {
  // errors automatically caught and passed to errorHandlingMiddleware
}));
```

## JSON Validation

### `validateJSON(data, schema)`
Validates object against schema

**Schema format:**
```javascript
const schema = {
  text: 'string',           // Required string field
  count: { type: 'number', minLength: 1 },
  tags: { type: 'array', items: 'string' },
};

const result = validateJSON(data, schema);
// Returns: { valid: boolean, error: string, errors: [] }
```

### `parseJSONSafely(jsonString)`
Safe JSON parsing with error handling
```javascript
const result = parseJSONSafely(someString);
// Returns: { success: boolean, data: object, error?: string }
```

### `stringifyJSONSafely(data)`
Safe JSON stringification
```javascript
const result = stringifyJSONSafely(data);
// Returns: { success: boolean, data: string, error?: string }
```

## Frontend Error Handling

### ErrorHandler Utilities

#### `handleAPIError(error)`
Converts API errors to user-friendly format
- Handles Axios errors
- Network errors
- Generic errors

#### `createUserFriendlyError(error)`
Converts technical errors to human-readable messages
```javascript
const message = createUserFriendlyError(apiError);
// "The file is too large to process."
```

#### `validateFileInput(file)`
Validates file before upload
```javascript
const validation = validateFileInput(file);
if (!validation.valid) {
  console.log(validation.errors); // ['File too large...']
}
```

#### `validateTextInput(text)`
Validates text input
```javascript
const validation = validateTextInput(extractedText);
// Checks: not empty, length 10-1000000 chars
```

#### `retryableRequest(fn, maxRetries)`
Retries failed API requests on network errors and 5xx status codes
```javascript
const result = await retryableRequest(async () => {
  return await apiClient.post('/endpoint', data);
}, 3);
```

### React Hooks

#### `useErrorHandler()`
Complete error management hook
```javascript
const {
  error,              // Current error object
  isLoading,          // Request in progress
  retryCount,         // Number of retries attempted
  handleError,        // Manually handle error
  clearError,         // Clear current error
  executeWithErrorHandling, // Execute fn with error handling
} = useErrorHandler();
```

**Example usage:**
```javascript
function MyComponent() {
  const { error, clearError, executeWithErrorHandling } = useErrorHandler();

  const handleUpload = async (file) => {
    await executeWithErrorHandling(async () => {
      return await uploadFile(file);
    });
  };

  return (
    <>
      <button onClick={() => handleUpload(file)}>Upload</button>
      {error && <ErrorDisplay error={error} onDismiss={clearError} />}
    </>
  );
}
```

### Error Display Component

#### `<ErrorDisplay />`
UI component for displaying errors
```jsx
<ErrorDisplay 
  error={error}
  onDismiss={() => setError(null)}
  onRetry={handleRetry}
/>
```

**Features:**
- Dismissable with animation
- Shows detailed errors in development mode
- Displays error arrays
- Retry button
- Friendly error messages

## Error Response Format

### Backend Standard Error Response
```json
{
  "success": false,
  "statusCode": 400,
  "message": "Error message",
  "timestamp": "2026-04-09T12:00:00Z"
}
```

### Validation Error Response
```json
{
  "success": false,
  "statusCode": 400,
  "message": "Validation failed",
  "errors": ["Field 1 error", "Field 2 error"]
}
```

## Best Practices

1. **Always validate input** - Use schema validation for API endpoints
2. **Use asyncHandler** - Wrap all route handlers
3. **Specific error codes** - Use error codes for client-side handling
4. **Log errors** - Errors are logged server-side
5. **User-friendly messages** - Don't expose technical details to users
6. **Retry on transient failures** - Network errors, timeouts, 5xx statuses
7. **Clear error state** - Clear errors after user dismisses
8. **Show loading state** - Let users know requests are processing

## Testing

```javascript
// Test error handling
test('handleAPIError converts axios errors', () => {
  const error = new Error('Network error');
  const result = handleAIError(error);
  expect(result.success).toBe(false);
  expect(result.error).toBeDefined();
});

// Test validation
test('validateJSON catches missing fields', () => {
  const result = validateJSON(
    { text: 'hello' },
    { text: 'string', count: 'number' }
  );
  expect(result.valid).toBe(false);
});
```
