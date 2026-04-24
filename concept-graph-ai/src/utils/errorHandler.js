export class ClientError extends Error {
  constructor(message, code = 'CLIENT_ERROR', statusCode = 400) {
    super(message);
    this.name = 'ClientError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

export class APIError extends Error {
  constructor(message, statusCode = 500, data = {}) {
    super(message);
    this.name = 'APIError';
    this.statusCode = statusCode;
    this.data = data;
  }
}

export const handleAPIError = (error) => {
  console.error('[API Error]', error);

  // Handle Axios errors
  if (error.response) {
    return {
      success: false,
      message: error.response.data?.message || error.message,
      statusCode: error.response.status,
      data: error.response.data,
    };
  }

  // Handle network errors
  if (error.request && !error.response) {
    return {
      success: false,
      message: 'Network error - unable to reach server',
      code: 'NETWORK_ERROR',
      statusCode: 0,
    };
  }

  // Handle client errors
  if (error instanceof ClientError) {
    return {
      success: false,
      message: error.message,
      code: error.code,
      statusCode: error.statusCode,
    };
  }

  // Handle generic errors
  return {
    success: false,
    message: error.message || 'An unexpected error occurred',
    code: 'UNKNOWN_ERROR',
    statusCode: 500,
  };
};

export const validateFileInput = (file) => {
  const errors = [];

  if (!file) {
    errors.push('No file selected');
    return { valid: false, errors };
  }

  const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png'];
  if (!allowedTypes.includes(file.type)) {
    errors.push('Invalid file type. Allowed: PDF, JPEG, PNG');
  }

  const maxSize = 10 * 1024 * 1024; // 10MB
  if (file.size > maxSize) {
    errors.push(`File too large. Maximum size: ${maxSize / (1024 * 1024)}MB`);
  }

  if (file.size === 0) {
    errors.push('File is empty');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
};

export const validateTextInput = (text) => {
  const errors = [];

  if (!text || typeof text !== 'string') {
    errors.push('Text must be a string');
  } else {
    if (text.trim().length === 0) {
      errors.push('Text cannot be empty');
    }
    if (text.length < 10) {
      errors.push('Text must be at least 10 characters');
    }
    if (text.length > 1000000) {
      errors.push('Text cannot exceed 1,000,000 characters');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
};

export const createUserFriendlyError = (error) => {
  const errorMap = {
    NETWORK_ERROR: 'Unable to connect to the server. Please check your connection.',
    TIMEOUT: 'The request took too long. Please try again.',
    FILE_NOT_FOUND: 'The file could not be found.',
    INVALID_FILE: 'The file format is not supported.',
    INSUFFICIENT_MEMORY: 'The file is too large to process.',
    EXTRACTION_FAILED: 'Could not extract text from the file. Please try another file.',
  };

  if (error.code && errorMap[error.code]) {
    return errorMap[error.code];
  }

  if (Array.isArray(error.errors)) {
    return error.errors.join('; ');
  }

  return error.message || 'An unexpected error occurred';
};

export const retryableRequest = async (fn, maxRetries = 3) => {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === maxRetries) {
        throw error;
      }

      // Only retry on network errors or 5xx status codes
      if (error.response?.status >= 500 || !error.response) {
        const delay = Math.pow(2, attempt) * 1000;
        await new Promise((resolve) => setTimeout(resolve, delay));
      } else {
        throw error;
      }
    }
  }
};
