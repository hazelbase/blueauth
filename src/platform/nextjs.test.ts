/* eslint-disable max-len */
import cookie from 'cookie';
import jwt from 'jsonwebtoken';
import '../types/test.d';
import type { NextApiRequest } from '../types/nextjs';
import type { MockNextResponse } from '../types/mocks';
import { handler, getIdentity } from './nextjs';
import { createJWTSessionToken } from '../lib/core';

const {
  config,
  identities,
  makeMockNextResponse,
} = global.testHelpers;

let res: MockNextResponse = <MockNextResponse>{};
let req: NextApiRequest = <NextApiRequest>{ url: '/', cookies: {} };
const exampleUser = identities[0];

beforeEach(() => {
  res = makeMockNextResponse();
  req = <NextApiRequest>{ url: '/', cookies: {} };
  req.headers = {};
});

describe('handler', () => {
  describe('whoami', () => {
    it('responds with null when no cookie', async () => {
      req.method = 'POST';
      req.body = { query: 'query mecheck { whoami }' };

      await handler(config)(req, res);
      expect(res.body.data.whoami).toBeNull();
    });

    it('responds with user when cookie', async () => {
      req.method = 'POST';
      req.body = { query: 'query mecheck { whoami }' };
      const { id } = exampleUser;
      const { secret } = config;
      const expiresIn = config.sessionLifespan;
      req.cookies = { 'blueauth-session': createJWTSessionToken({ id, secret, expiresIn }) };

      await handler(config)(req, res);

      expect(res.body.data.whoami.id).toBe(id);
      expect(res.body.data.whoami.email).toBe(exampleUser.email);
    });

    it('responds with error when invalid cookie', async () => {
      req.method = 'POST';
      req.body = { query: 'query mecheck { whoami }' };
      const { id } = exampleUser;
      const secret = `someWrongSecret${config.secret}`;
      const expiresIn = config.sessionLifespan;
      // const loginCookie = cookie.serialize('blueauth-session', createJWTSessionToken({ id, secret, expiresIn }));
      // req.headers = { cookie: loginCookie };
      req.cookies = { 'blueauth-session': createJWTSessionToken({ id, secret, expiresIn }) };

      await handler(config)(req, res);

      const firstError = res.body.errors[0];
      expect(firstError.message).toBe('invalid signature');
    });
  });

  describe('register', () => {
    it('responds with identity', async () => {
      req.method = 'POST';
      req.body = {
        query: `
          mutation register {
            register(identity: { email: "222@test.com" })
          }
        `,
      };

      await handler(config)(req, res);

      expect(res.body.data.register.email).toBe('222@test.com');
    });
  });

  describe('start email login', () => {
    // TODO: check email is sent / not sent

    describe('no existing user', () => {
      it('responds with an error', async () => {
        req.method = 'POST';
        req.body = {
          query: `
            mutation register {
              startEmailLogin(identity: { email: "startEmailLogin@test.com" })
            }
          `,
        };

        await handler(config)(req, res);

        expect(res.body.errors[0].message).toBe('no existing identity');
      });
    });

    describe('existing user', () => {
      it('responds with true', async () => {
        const existingIdentity = identities[0];
        req.method = 'POST';
        req.body = {
          query: `
            mutation register {
              startEmailLogin(identity: { email: "${existingIdentity.email}" })
            }
          `,
        };

        await handler(config)(req, res);

        expect(res.body.data.startEmailLogin).toBe(true);
      });
    });
  });

  describe('start email login or register', () => {
    describe('existing user', () => {
      // TODO check email sending
      it('starts log in process for user', async () => {
        const existingIdentity = identities[0];
        req.method = 'POST';
        req.body = {
          query: `
            mutation register {
              registerOrStartEmailLogin(identity: { email: "${existingIdentity.email}" })
            }
          `,
        };

        await handler(config)(req, res);

        expect(res.headers['Set-Cookie']).toBeFalsy();
        expect(res.body.data.registerOrStartEmailLogin).toBe('LOGIN_STARTED');
      });
    });

    describe('no existing user', () => {
      describe('auto login', () => {
        // TODO check email sending
        it('logs them in', async () => {
          req.method = 'POST';
          req.body = {
            query: `
              mutation register {
                registerOrStartEmailLogin(identity: { email: "someNewPerson@test.com" })
              }
            `,
          };

          const loginConfig = { ...config, ...{ loginAfterRegistration: true } };

          await handler(loginConfig)(req, res);

          const cookieHeader = res.headers['Set-Cookie'];
          const cookieParsed = cookie.parse(cookieHeader as string);
          const sessionToken = cookieParsed['blueauth-session'];
          const sessionTokenDecoded = jwt.verify(sessionToken, config.secret);
          const sessionId = typeof sessionTokenDecoded === 'string' ? JSON.parse(sessionTokenDecoded).id : sessionTokenDecoded.id;

          expect(res.body.data.registerOrStartEmailLogin).toBe('LOGIN_COMPLETED');
          expect(sessionId).toBe('aaaa'); // TODO: better handle new user creation ID
        });
      });

      describe('no auto login', () => {
        it('does not log them in, starts log in process', async () => {
          // TODO: check email sending
          req.method = 'POST';
          req.body = {
            query: `
              mutation register {
                registerOrStartEmailLogin(identity: { email: "someNewPerson@test.com" })
              }
            `,
          };

          await handler(config)(req, res);

          expect(res.headers['Set-Cookie']).toBeFalsy();
          expect(res.body.data.registerOrStartEmailLogin).toBe('LOGIN_STARTED');
        });
      });
    });
  });

  describe('complete login', () => {
    describe('valid token', () => {
      it('responds with token in cookie and body, and redirects', async () => {
        const existingIdentity = identities[0];
        const tokenBody = { email: existingIdentity.email };
        const token = jwt.sign(tokenBody, config.secret, { expiresIn: '15m' });

        req.method = 'GET';
        req.query = { loginToken: token };

        await handler(config)(req, res);

        const cookieHeader = res.headers['Set-Cookie'];
        const cookieParsed = cookie.parse(cookieHeader as string);
        const sessionToken = cookieParsed['blueauth-session'];
        const sessionTokenDecoded = jwt.verify(sessionToken, config.secret);
        const sessionId = typeof sessionTokenDecoded === 'string' ? JSON.parse(sessionTokenDecoded).id : sessionTokenDecoded.id;

        expect(res.statusCode).toBe(302);
        expect(res.headers.Location).toBe('/');
        expect(sessionId).toBe(existingIdentity.id);
      });
    });

    describe('invalid token', () => {
      it('responds with no token in cookie or body', async () => {
        const existingIdentity = identities[0];
        const tokenBody = { email: existingIdentity.email };
        const token = jwt.sign(tokenBody, `INVALID_SECRET_${config.secret}`, { expiresIn: '15m' });

        req.method = 'GET';
        req.query = { loginToken: token };

        await handler(config)(req, res);

        const cookieHeader = res.headers['Set-Cookie'];

        expect(res.body).toBe('Error: invalid signature');
        expect(cookieHeader).toBeFalsy();
      });
    });

    describe('no token', () => {
      it('responds with no token in cookie or body', async () => {
        req.method = 'GET';
        req.query = { loginToken: 'just some random string' };

        await handler(config)(req, res);

        const cookieHeader = res.headers['Set-Cookie'];

        expect(res.body).toBe('Error: jwt malformed');
        expect(cookieHeader).toBeFalsy();
      });
    });
  });

  describe('logout', () => {
    it('responds with nothing when no cookie', async () => {
      req.method = 'POST';
      req.body = { query: 'mutation logMeOut { logout }' };

      await handler(config)(req, res);

      expect(res.body.data.logout).toBe(true);
    });

    it('responds with empty cookie', async () => {
      req.method = 'POST';
      req.body = { query: 'mutation logMeOut { logout }' };
      const { id } = exampleUser;
      const secret = `someWrongSecret${config.secret}`;
      const expiresIn = config.sessionLifespan;
      // const loginCookie = cookie.serialize('blueauth-session', createJWTSessionToken({ id, secret, expiresIn }));
      // req.headers = { cookie: loginCookie };
      req.cookies = { 'blueauth-session': createJWTSessionToken({ id, secret, expiresIn }) };

      await handler(config)(req, res);

      const cookieHeader = res.headers['Set-Cookie'];
      const cookieParsed = cookie.parse(cookieHeader as string);
      expect(res.body.data.logout).toBe(true);
      expect(cookieParsed['Max-Age']).toBe('0');
    });
  });
});

describe('getIdentity', () => {
  describe('no relevant cookies', () => {
    it('is null with no cookies', async () => {
      const result = await getIdentity(config)({ req });
      expect(result).toBeNull();
    });

    it('is null with no related cookies', async () => {
      req.cookies = { blah: 'nothing' };

      const result = await getIdentity(config)({ req });
      expect(result).toBeNull();
    });
  });

  describe('valid cookie', () => {
    it('is an identity', async () => {
      const { id } = exampleUser;
      const { secret } = config;
      const expiresIn = config.sessionLifespan;
      // const loginCookie = cookie.serialize('blueauth-session', createJWTSessionToken({ id, secret, expiresIn }));
      // req.headers = { cookie: loginCookie };
      req.cookies = { 'blueauth-session': createJWTSessionToken({ id, secret, expiresIn }) };

      const result = await getIdentity(config)({ req });
      expect(result).toBe(exampleUser);
    });
  });

  describe('incorrectly signed cookie', () => {
    it('is null', async () => {
      const { id } = exampleUser;
      const secret = `someWrongSecretAddedTo${config.secret}`;
      const expiresIn = config.sessionLifespan;
      // const loginCookie = cookie.serialize('blueauth-session', createJWTSessionToken({ id, secret, expiresIn }));
      // req.headers = { cookie: loginCookie };
      req.cookies = { 'blueauth-session': createJWTSessionToken({ id, secret, expiresIn }) };

      const result = await getIdentity(config)({ req });
      expect(result).toBeNull();
    });
  });
});
