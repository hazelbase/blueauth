import type {
  MockExpressResponse,
  MockNextResponse,
} from '../src/types/mocks';
import '../src/types/test.d';
import { makeConfig } from '../src/lib/core';
// import {MockExpressResponse} from '../src/types/test.d';

const users = [
  { id: '123', email: '123@example.com' },
  { id: '124', email: '124@example.com' },
  { id: '125', email: '125@example.com' },
];

const configPassed = {
  secret: 'someAwesomeSecret2',
  authEndpoint: `${process.env.BASE_URL}/api/auth`,
  smtpURL: `${process.env.SMTP_URL}`,
  smtpFromAddress: `${process.env.SMTP_FROM_ADDRESS}`,
  cookieOptions: {
    domain: 'test.com',
    httpOnly: true,
    sameSite: 'lax' as 'lax',
    maxAge: 60 * 60 * 24 * 7,
    path: '/',
  },
  findUniqueIdentity: async (identityPayload: any): Promise<any | undefined> => {
    const { email, id } = identityPayload;
    return users.find((user) => user.email === email || user.id === id);
  },
  createIdentity: async (identityPayload: any): Promise<any> => {
    const newUser = { ...identityPayload, ...{ id: 'aaaa' } };
    users.push(newUser);
    return newUser;
  },
};

const config = makeConfig(configPassed);

// TODO: replace with this mocker?
// npm i --save-dev @jest-mock/express

global.testHelpers = {
  config,
  identities: users,
  makeMockNextResponse: () => {
    const res: MockNextResponse = <MockNextResponse>{};
    res.body = {};
    res.headers = {};
    res.status = (code) => {
      res.statusCode = code;
      return res;
    };
    res.send = (body) => {
      res.body = body;
      return res;
    };
    res.json = (body) => {
      res.send(body);
      return res;
    };
    res.setHeader = (name, value) => {
      res.headers[name] = value;
      return res;
    }
    res.redirect = (url: any) => {
      res.status(302);
      res.setHeader('Location', url as string);
      return res;
    }
    return res;
  },
  makeMockExpressResponse: () => {
    const res: MockExpressResponse = <MockExpressResponse>{};
    res.body = '';
    res.headers = {};
    res.status = (code) => {
      res.statusCode = code;
      return res;
    };
    res.send = (body) => {
      res.body = body;
      return res;
    };
    res.json = (body) => {
      res.send(JSON.stringify(body));
      return res;
    };
    res.setHeader = (name, value) => {
      res.headers[name] = value;
      return res;
    }
    res.redirect = (url: any) => {
      res.status(302);
      res.setHeader('Location', url as string);
      return res;
    }
    return res;
  },
};
