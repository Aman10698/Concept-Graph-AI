class AIError extends Error {
  constructor(message, code = 'AI_ERROR', statusCode = 500) {
    super(message);
    this.name = 'AIError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

class ValidationError extends Error {
  constructor(message, errors = []) {
    super(message);
    this.name = 'ValidationError';
    this.errors = errors;
    this.statusCode = 400;
  }
}

class ExtractionError extends Error {
  constructor(message, type = 'EXTRACTION_FAILED') {
    super(message);
    this.name = 'ExtractionError';
    this.type = type;
    this.statusCode = 422;
  }
}

const handleAIError = (error, context = '') => {
  console.error(`[AI Error${context ? ` - ${context}` : ''}]`, error);

  if (error instanceof AIError) {
    return {
      success: false,
      error: error.message,
      code: error.code,
      statusCode: error.statusCode,
    };
  }

  if (error instanceof ValidationError) {
    return {
      success: false,
      error: error.message,
      errors: error.errors,
      statusCode: error.statusCode,
    };
  }

  if (error instanceof ExtractionError) {
    return {
      success: false,
      error: error.message,
      type: error.type,
      statusCode: error.statusCode,
    };
  }

  // Handle common errors
  if (error.message.includes('ENOENT')) {
    return {
      success: false,
      error: 'File not found',
      code: 'FILE_NOT_FOUND',
      statusCode: 404,
    };
  }

  if (error.message.includes('EACCES')) {
    return {
      success: false,
      error: 'Permission denied',
      code: 'PERMISSION_DENIED',
      statusCode: 403,
    };
  }

  if (error.message.includes('timeout')) {
    return {
      success: false,
      error: 'Operation timeout',
      code: 'TIMEOUT',
      statusCode: 408,
    };
  }

  if (error.message.includes('Memory')) {
    return {
      success: false,
      error: 'Insufficient memory for processing',
      code: 'MEMORY_ERROR',
      statusCode: 500,
    };
  }

  // Default error response
  return {
    success: false,
    error: process.env.NODE_ENV === 'development'
      ? error.message
      : 'An error occurred during processing',
    code: 'UNKNOWN_ERROR',
    statusCode: 500,
  };
};

const createErrorResponse = (statusCode, message, details = {}) => {
  return {
    success: false,
    statusCode,
    message,
    ...details,
    timestamp: new Date().toISOString(),
  };
};

const isRetryableError = (error) => {
  const retryableErrors = [
    'ECONNRESET',
    'ETIMEDOUT',
    'ENOTFOUND',
    'EHOST_UNREACHABLE',
  ];

  return retryableErrors.some((err) => error.message.includes(err));
};

const retryWithBackoff = async (fn, maxRetries = 3, delayMs = 1000) => {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === maxRetries || !isRetryableError(error)) {
        throw error;
      }

      const delay = delayMs * Math.pow(2, attempt - 1);
      console.log(
        `Retry attempt ${attempt}/${maxRetries} after ${delay}ms...`
      );
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
};

module.exports = {
  AIError,
  ValidationError,
  ExtractionError,
  handleAIError,
  createErrorResponse,
  isRetryableError,
  retryWithBackoff,
};
