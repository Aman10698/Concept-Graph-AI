const validateJSON = (data, schema) => {
  if (!data || typeof data !== 'object') {
    return {
      valid: false,
      error: 'Data must be an object',
    };
  }

  if (!schema || typeof schema !== 'object') {
    return {
      valid: false,
      error: 'Schema must be provided',
    };
  }

  const errors = [];

  for (const [key, type] of Object.entries(schema)) {
    if (!(key in data)) {
      errors.push(`Missing required field: ${key}`);
      continue;
    }

    const value = data[key];
    const expectedType = typeof type === 'string' ? type : type.type;
    const actualType = Array.isArray(value) ? 'array' : typeof value;

    if (actualType !== expectedType) {
      errors.push(
        `Field "${key}" has type ${actualType}, expected ${expectedType}`
      );
    }

    // Validate nested requirements
    if (typeof type === 'object' && type.required && !value) {
      errors.push(`Field "${key}" is required`);
    }

    if (typeof type === 'object' && type.minLength && value.length < type.minLength) {
      errors.push(
        `Field "${key}" must be at least ${type.minLength} characters`
      );
    }

    if (typeof type === 'object' && type.maxLength && value.length > type.maxLength) {
      errors.push(
        `Field "${key}" must not exceed ${type.maxLength} characters`
      );
    }

    if (typeof type === 'object' && type.items && Array.isArray(value)) {
      value.forEach((item, index) => {
        if (typeof item !== type.items) {
          errors.push(
            `Field "${key}[${index}]" has type ${typeof item}, expected ${type.items}`
          );
        }
      });
    }
  }

  return {
    valid: errors.length === 0,
    error: errors.length > 0 ? errors.join('; ') : null,
    errors,
  };
};

const parseJSONSafely = (jsonString) => {
  try {
    return {
      success: true,
      data: JSON.parse(jsonString),
    };
  } catch (error) {
    return {
      success: false,
      error: `Invalid JSON: ${error.message}`,
    };
  }
};

const stringifyJSONSafely = (data) => {
  try {
    return {
      success: true,
      data: JSON.stringify(data),
    };
  } catch (error) {
    return {
      success: false,
      error: `Failed to stringify: ${error.message}`,
    };
  }
};

module.exports = {
  validateJSON,
  parseJSONSafely,
  stringifyJSONSafely,
};
