import { graphqlHTTP } from 'express-graphql';
// import http from 'http';
import cookie from 'cookie';
import type { Request, Response } from 'express';
import type { APIGatewayProxyResult, APIGatewayProxyEvent } from 'aws-lambda';
import debug from 'debug';
import {
  loginSubmit,
  makeConfig,
  makeGetConfig,
  whoami,
} from '../lib/core';
import type { ConfigOptions, GraphQLContext, GetConfigOptions } from '../types';
import { schema, root } from '../lib/graphql';

export { ConfigOptions } from '../types';

// class ServerlessRequest extends http.IncomingMessage {
//   constructor({ method, url, headers, body, remoteAddress }: APIGatewayProxyEvent) {
//     super({
//       encrypted: true,
//       readable: false,
//       remoteAddress,
//       address: () => ({ port: 443 }),
//       end: Function.prototype,
//       destroy: Function.prototype,
//     });
//
//     if (typeof headers['content-length'] === 'undefined') {
//       headers['content-length'] = Buffer.byteLength(body);
//     }
//
//     Object.assign(this, {
//       ip: remoteAddress,
//       complete: true,
//       httpVersion: '1.1',
//       httpVersionMajor: '1',
//       httpVersionMinor: '1',
//       method,
//       headers,
//       body,
//       url,
//     });
//
//     this._read = () => {
//       this.push(body);
//       this.push(null);
//     };
//   }
//
// }

export function handler(configInput: ConfigOptions) {
  const config = makeConfig(configInput);
  return async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    const result: APIGatewayProxyResult & {
      headers: { [header: string]: string | number | boolean }
    } = {
      statusCode: 200,
      headers: {},
      body: '',
    };
    if (event.queryStringParameters?.loginToken) {
      const { loginToken } = event.queryStringParameters;
      try {
        const {
          token,
          redirectURL,
        } = await loginSubmit({ jwtString: loginToken as string, config });
        const cookieString = cookie.serialize(`${config.cookieNamePrefix}-session`, token, config.cookieOptions);
        result.headers['Set-Cookie'] = cookieString;
        result.headers.Location = redirectURL || '/';
        result.statusCode = 302;
      } catch (error) {
        result.statusCode = 400;
        result.body = `Error: ${error.message}`;
      }
      return result;
    }

    const cookies = cookie.parse(event.headers.Cookie || '');
    const context: GraphQLContext = {
      config,
      cookies,
      setCookie: (payload: string) => { result.headers['Set-Cookie'] = payload; },
    };

    // console.log('> blueauth start debug 2', {
    //   eventBody: event.body,
    //   eventBodyTypeof: typeof event.body,
    //   headers: event.headers,
    //   contentTypeT: event.headers['Content-Type'],
    //   contentTypeL: event.headers['content-type'],
    // });

    let { body }: { body: any } = event;
    const contentType = event.headers['Content-Type'] || event.headers['content-type'];
    if (contentType && contentType.includes('application/json') && event.body) {
      body = JSON.parse(event.body);
    }
    if (!body && event.queryStringParameters?.query) {
      body = event.queryStringParameters;
    }

    const req = {
      ...event,
      ...{
        body,
        url: '',
        method: event.httpMethod,
        headers: {
          ...event.headers,
          ...{
            'content-type': contentType,
            'content-encoding': event.headers['Content-Encoding'],
          },
        },
      },
    } as unknown as Request;

    const res = {
      setHeader: (key: string, value: string) => {
        result.headers[key] = value;
      },
      end: (payload: any) => { result.body = payload; },
      json: (value: any) => {
        if (typeof value === 'object') result.body = JSON.stringify(value);
        if (typeof value === 'string') result.body = value;
        result.headers['Content-Type'] = 'application/json; charset=utf-8';
      },
    } as unknown as Response;

    await graphqlHTTP({
      graphiql: true,
      schema,
      context,
      rootValue: root,
    })(req, res);

    result.statusCode = res.statusCode || result.statusCode || 200;
    if (Buffer.isBuffer(result.body)) result.body = result.body.toString();

    return result;
  };
}

export function getIdentity(configInput: GetConfigOptions) {
  const config = makeGetConfig(configInput);

  return async ({ event }: { event: APIGatewayProxyEvent }) => {
    try {
      const cookies = cookie.parse(event.headers.Cookie || '');
      const idCookie = cookies[`${config.cookieNamePrefix}-session`];
      debug('blueauth')('handler idCookie %s', idCookie);
      if (!idCookie) return null;
      const identity = await whoami({ jwtString: idCookie, config });
      return identity;
    } catch (error) {
      debug('blueauth')('getIdentity error %o', error);
      return null;
    }
  };
}

export { getIdentity as getUser };
