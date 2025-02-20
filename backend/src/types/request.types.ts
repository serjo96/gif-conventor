import { Request } from 'express';

export interface FileRequest extends Request {
  file?: Express.Multer.File;
}

export interface StatusRequest extends Request {
  params: {
    jobId: string;
  };
}
