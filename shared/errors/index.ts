export class ApiError extends Error {
  constructor(
    public statusCode: number,
    public message: string,
    public code: string = 'INTERNAL_ERROR',
    public details?: unknown
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export class ValidationError extends ApiError {
  constructor(message: string, details?: unknown) {
    super(400, message, 'VALIDATION_ERROR', details);
    this.name = 'ValidationError';
  }
}

export class UnauthorizedError extends ApiError {
  constructor(message = 'Unauthorized') {
    super(401, message, 'UNAUTHORIZED');
    this.name = 'UnauthorizedError';
  }
}

export class ForbiddenError extends ApiError {
  constructor(message = 'Forbidden') {
    super(403, message, 'FORBIDDEN');
    this.name = 'ForbiddenError';
  }
}

export class NotFoundError extends ApiError {
  constructor(message = 'Not Found') {
    super(404, message, 'NOT_FOUND');
    this.name = 'NotFoundError';
  }
}

export function formatSuccessResponse<T>(data: T, message?: string) {
  return Response.json({
    success: true,
    message,
    data,
  });
}

export function formatErrorResponse(error: unknown) {
  if (error instanceof ApiError) {
    return Response.json(
      {
        success: false,
        error: {
          code: error.code,
          message: error.message,
          details: error.details,
        },
      },
      { status: error.statusCode }
    );
  }

  console.error('Unhandled API Error:', error);

  return Response.json(
    {
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred.',
      },
    },
    { status: 500 }
  );
}
