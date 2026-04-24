const { validateJSON, parseJSONSafely } = require('./jsonValidator');
const { handleAIError, createErrorResponse } = require('./errorHandler');

const validateRequestJSON = (schema) => {
  return (req, res, next) => {
    if (!req.body || Object.keys(req.body).length === 0) {
      return res.status(400).json(
        createErrorResponse(400, 'Request body is empty')
      );
    }

    const validation = validateJSON(req.body, schema);

    if (!validation.valid) {
      return res.status(400).json(
        createErrorResponse(400, 'Validation failed', {
          errors: validation.errors,
        })
      );
    }

    next();
  };
};

const errorHandlingMiddleware = (err, req, res, next) => {
  console.error('Global error handler:', err);

  if (err.name === 'SyntaxError' && err instanceof SyntaxError) {
    return res.status(400).json(
      createErrorResponse(400, 'Invalid JSON in request body')
    );
  }

  if (err.name === 'ValidationError') {
    return res.status(400).json(
      createErrorResponse(400, err.message, {
        errors: err.errors,
      })
    );
  }

  const errorResponse = handleAIError(err, req.path);
  const statusCode = errorResponse.statusCode || 500;

  res.status(statusCode).json(
    createErrorResponse(
      statusCode,
      errorResponse.error,
      errorResponse
    )
  );
};

const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

module.exports = {
  validateRequestJSON,
  errorHandlingMiddleware,
  asyncHandler,
};
