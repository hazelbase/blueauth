import type { Request } from 'express';
import cookie from 'cookie';
import jwt from 'jsonwebtoken';
import { handler, getIdentity } from './express';
import { createJWTSessionToken } from '../lib/core';
import type { MockExpressResponse } from '../types/mocks';

const {
  config,
  identities,
  makeMockExpressResponse,
} = global.testHelpers;

// eslint-disable-next-line max-len
let res: MockExpressResponse = <MockExpressResponse>{};
let req: Request = <Request>{ url: '/' };
const exampleUser = identities[0];

beforeEach(() => {
  res = makeMockExpressResponse();
  req = <Request>{ url: '/' };
  req.headers = {};
});

describe('handler', () => {
  describe('whoami', () => {
    it('responds with null when no cookie', async () => {
      req.method = 'GET';
      req.body = {
        query: 'query mecheck { whoami }',
      };

      await handler(config)(req, res);

      const body = JSON.parse(res.body);
      expect(body.data.whoami).toBeNull();
    });

    it('responds with user when cookie', async () => {
      req.method = 'GET';
      req.body = { query: 'query mecheck { whoami }' };

      const { id } = exampleUser;
      const { secret } = config;
      const expiresIn = config.sessionLifespan;
      const signInCookie = cookie.serialize('blueauth-session', createJWTSessionToken({ id, secret, expiresIn }));
      req.headers = { cookie: signInCookie };

      await handler(config)(req, res);

      const body = JSON.parse(res.body);
      expect(body.data.whoami.id).toBe(id);
      expect(body.data.whoami.email).toBe(exampleUser.email);
    });

    it('responds with error when invalid cookie', async () => {
      req.method = 'GET';
      req.body = {
        query: 'query mecheck { whoami }',
      };
      const { id } = exampleUser;
      const secret = `someWrongSecret${config.secret}`;
      const expiresIn = config.sessionLifespan;
      const signInCookie = cookie.serialize('blueauth-session', createJWTSessionToken({ id, secret, expiresIn }));
      req.headers = { cookie: signInCookie };

      await handler(config)(req, res);

      const body = JSON.parse(res.body);
      const firstError = body.errors[0];
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

      const body = JSON.parse(res.body);
      expect(body.data.register.email).toBe('222@test.com');
    });
  });

  describe('start email signIn', () => {
    // TODO: check email is sent / not sent

    describe('no existing user', () => {
      it('responds with an error', async () => {
        req.method = 'POST';
        req.body = {
          query: `
            mutation register {
              startEmailSignIn(identity: { email: "startEmailSignIn@test.com" })
            }
          `,
        };

        await handler(config)(req, res);

        const body = JSON.parse(res.body);
        expect(body.errors[0].message).toBe('no existing identity');
      });
    });

    describe('existing user', () => {
      it('responds with true', async () => {
        const existingIdentity = identities[0];
        req.method = 'POST';
        req.body = {
          query: `
            mutation register {
              startEmailSignIn(identity: { email: "${existingIdentity.email}" })
            }
          `,
        };

        await handler(config)(req, res);

        const body = JSON.parse(res.body);
        expect(body.data.startEmailSignIn).toBe(true);
      });
    });
  });

  describe('start email SignIn or register', () => {
    describe('existing user', () => {
      // TODO check email sending
      it('starts SignIn process for user', async () => {
        const existingIdentity = identities[0];
        req.method = 'POST';
        req.body = {
          query: `
            mutation register {
              registerOrStartEmailSignIn(identity: { email: "${existingIdentity.email}" })
            }
          `,
        };

        await handler(config)(req, res);

        const body = JSON.parse(res.body);
        expect(res.headers['Set-Cookie']).toBeFalsy();
        expect(body.data.registerOrStartEmailSignIn).toBe('SIGN_IN_STARTED');
      });
    });

    describe('no existing user', () => {
      describe('auto SignIn', () => {
        // TODO check email sending
        it('signs them in', async () => {
          req.method = 'POST';
          req.body = {
            query: `
              mutation register {
                registerOrStartEmailSignIn(identity: { email: "someNewPerson@test.com" })
              }
            `,
          };

          const signInConfig = { ...config, ...{ signInAfterRegistration: true } };

          await handler(signInConfig)(req, res);

          const cookieHeader = res.headers['Set-Cookie'];
          const cookieParsed = cookie.parse(cookieHeader as string);
          const sessionToken = cookieParsed['blueauth-session'];
          const sessionTokenDecoded = jwt.verify(sessionToken, config.secret);
          const sessionId = typeof sessionTokenDecoded === 'string' ? JSON.parse(sessionTokenDecoded).id : sessionTokenDecoded.id;

          const body = JSON.parse(res.body);
          expect(body.data.registerOrStartEmailSignIn).toBe('SIGN_IN_COMPLETED');
          expect(sessionId).toBe('aaaa'); // TODO: better handle new user creation ID
        });
      });

      describe('no auto signs', () => {
        it('does not sign them in, starts sign in process', async () => {
          // TODO: check email sending
          req.method = 'POST';
          req.body = {
            query: `
              mutation register {
                registerOrStartEmailSignIn(identity: { email: "someNewPerson@test.com" })
              }
            `,
          };

          await handler(config)(req, res);

          const body = JSON.parse(res.body);
          expect(res.headers['Set-Cookie']).toBeFalsy();
          expect(body.data.registerOrStartEmailSignIn).toBe('SIGN_IN_STARTED');
        });
      });
    });
  });

  describe('complete sign', () => {
    describe('valid token', () => {
      it('responds with token in cookie and body, and redirects', async () => {
        const existingIdentity = identities[0];
        const tokenBody = { email: existingIdentity.email };
        const token = jwt.sign(tokenBody, config.secret, { expiresIn: '15m' });

        req.method = 'GET';
        req.query = { signInToken: token };

        await handler(config)(req, res);

        const cookieHeader = res.headers['Set-Cookie'];
        const cookieParsed = cookie.parse(cookieHeader as string);
        const sessionToken = cookieParsed['blueauth-session'];
        const sessionTokenDecoded = jwt.verify(sessionToken, config.secret);
        const sessionId = typeof sessionTokenDecoded === 'string' ? JSON.parse(sessionTokenDecoded).id : sessionTokenDecoded.id;

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
        req.query = { signInToken: token };

        await handler(config)(req, res);

        const cookieHeader = res.headers['Set-Cookie'];

        expect(res.body).toBe('Error: invalid signature');
        expect(cookieHeader).toBeFalsy();
      });
    });

    describe('no token', () => {
      it('responds with no token in cookie or body', async () => {
        req.method = 'GET';
        req.query = { signInToken: 'just some random string' };

        await handler(config)(req, res);

        const cookieHeader = res.headers['Set-Cookie'];

        expect(res.body).toBe('Error: jwt malformed');
        expect(cookieHeader).toBeFalsy();
      });
    });
  });

  describe('signOut', () => {
    it('responds with nothing when no cookie', async () => {
      req.method = 'POST';
      req.body = { query: 'mutation signOut { signOut }' };

      await handler(config)(req, res);

      const body = JSON.parse(res.body);
      expect(body.data.signOut).toBe(true);
    });

    it('responds with empty cookie', async () => {
      req.method = 'POST';
      req.body = { query: 'mutation signOut { signOut }' };
      const { id } = exampleUser;
      const secret = `someWrongSecret${config.secret}`;
      const expiresIn = config.sessionLifespan;
      const signInCookie = cookie.serialize('blueauth-session', createJWTSessionToken({ id, secret, expiresIn }));
      req.headers = { cookie: signInCookie };

      await handler(config)(req, res);

      const body = JSON.parse(res.body);
      const cookieHeader = res.headers['Set-Cookie'];
      const cookieParsed = cookie.parse(cookieHeader as string);
      expect(body.data.signOut).toBe(true);
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
      req.headers = { cookie: 'blah=nothing' };

      const result = await getIdentity(config)({ req });
      expect(result).toBeNull();
    });
  });

  describe('valid cookie', () => {
    it('is an identity', async () => {
      const { id } = exampleUser;
      const { secret } = config;
      const expiresIn = config.sessionLifespan;
      const signInCookie = cookie.serialize('blueauth-session', createJWTSessionToken({ id, secret, expiresIn }));
      req.headers = { cookie: signInCookie };

      const result = await getIdentity(config)({ req });
      expect(result).toBe(exampleUser);
    });
  });

  describe('incorrectly signed cookie', () => {
    it('is null', async () => {
      const { id } = exampleUser;
      const secret = `someWrongSecretAddedTo${config.secret}`;
      const expiresIn = config.sessionLifespan;
      const signInCookie = cookie.serialize('blueauth-session', createJWTSessionToken({ id, secret, expiresIn }));
      req.headers = { cookie: signInCookie };

      const result = await getIdentity(config)({ req });
      expect(result).toBeNull();
    });
  });
});
