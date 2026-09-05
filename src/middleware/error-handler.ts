import type { FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import { ZodError } from 'zod';
import { AppError } from '../lib/errors.js';

type ErrorBody = {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
};

function send(reply: FastifyReply, statusCode: number, body: ErrorBody): void {
  void reply.status(statusCode).send(body);
}

export function errorHandler(
  error: FastifyError,
  request: FastifyRequest,
  reply: FastifyReply,
): void {
  if (error instanceof AppError) {
    send(reply, error.statusCode, {
      error: {
        code: error.code,
        message: error.message,
        ...(error.details !== undefined ? { details: error.details } : {}),
      },
    });
    return;
  }

  if (error instanceof ZodError) {
    send(reply, 400, {
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Request validation failed',
        details: error.flatten(),
      },
    });
    return;
  }

  if (error.statusCode === 429) {
    send(reply, 429, {
      error: {
        code: 'RATE_LIMITED',
        message: 'Too many requests, please try again later',
      },
    });
    return;
  }

  if (error.statusCode === 400 && error.validation) {
    send(reply, 400, {
      error: {
        code: 'VALIDATION_ERROR',
        message: error.message,
        details: error.validation,
      },
    });
    return;
  }

  request.log.error({ err: error }, 'unhandled error');

  send(reply, error.statusCode ?? 500, {
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
    },
  });
}
