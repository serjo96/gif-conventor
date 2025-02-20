import {Request, Response, NextFunction} from 'express';
import multer from "multer";
import { ApiError } from '../types/api.types';
import { ErrorCode } from '../types/api.types';

export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  _: NextFunction
): void => {
  console.error(err);

  if (err instanceof ApiError) {
    res.status(err.statusCode).json({
      success: false,
      error: {
        message: err.message,
        code: err.code,
        statusCode: err.statusCode
      }
    });
    return;
  }

  if (err instanceof multer.MulterError) {
    res.status(400).json({
      success: false,
      error: {
        message: err.message,
        code: ErrorCode.MULTER_ERROR,
        statusCode: 400
      }
    });
    return;
  }

  // Default error
  res.status(500).json({
    success: false,
    error: {
      message: 'Internal server error',
      code: ErrorCode.INTERNAL_ERROR,
      statusCode: 500
    }
  });
};

export const notFoundHandler = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  next(new ApiError(404, `Route ${req.originalUrl} not found`, ErrorCode.ROUTE_NOT_FOUND));
};
