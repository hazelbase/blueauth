import type { Response } from 'express';
import type { NextApiResponse } from './nextjs';

export type MockExpressResponse = Response & {
  body: string;
  headers: { [key: string]: string | number | readonly string[] };
};

export type MockNextResponse = NextApiResponse & {
  body: any;
  headers: { [key: string]: string | number | readonly string[] };
};
