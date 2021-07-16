import jwt from 'jsonwebtoken';
import debug from 'debug';
// import nodemailer from 'nodemailer';
import type { ConfigOptions, DefaultConfigOptions, GetConfigOptions } from '../types';

const isNotProd: boolean = typeof process.env.NODE_ENV === 'string' && process.env.NODE_ENV !== 'production';
export const defaultConfigOptions: DefaultConfigOptions = {
  loginAfterRegistration: false,
  sessionLifespan: '7d',
  refreshSession: true,
  smtpFromName: 'Authentication',
  smtpSubject: 'Log In',
  cookieNamePrefix: 'blueauth',
  cookieOptions: {
    secure: !isNotProd,
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7,
    path: '/',
  },
  createLoginEmailStrings: ({ url }) => ({
    // TODO: improve default email templates
    text: `log in at ${url}`,
  }),
};

export function makeConfig(config: ConfigOptions) {
  const cookieOptions = { ...defaultConfigOptions.cookieOptions, ...config.cookieOptions };
  return { ...defaultConfigOptions, ...config, ...{ cookieOptions } };
}

export function makeGetConfig(config: GetConfigOptions) {
  return { ...defaultConfigOptions, ...config };
}

export function createJWTSessionToken({
  id,
  secret,
  expiresIn,
}: { id: string, secret: string, expiresIn: string | number }) {
  return jwt.sign(
    { id },
    secret,
    { expiresIn },
  );
}

export async function sendLoginEmail({
  config,
  toEmail,
  token,
}: {
  config: Required<ConfigOptions>,
  toEmail: string,
  token: string,
}): Promise<Boolean> {
  const urlUnencoded = `${config.authEndpoint}?query=mutation m1 { completeLogin(token: "${token}") }`;
  const url = encodeURI(urlUnencoded);
  const { text, html } = config.createLoginEmailStrings({ url });

  const debugObject = {
    text,
    html,
    config,
    toEmail,
  };
  debug('blueauth')('sendLoginEmail %j', debugObject);

  return true;

  // const transporter = nodemailer.createTransport(config.smtpURL);
  // const info = await transporter.sendMail({
  //   from: `"${config.smtpFromName}" <${config.smtpFromAddress}>`, // sender address
  //   to: toEmail,
  //   subject: config.smtpSubject, // Subject line
  //   text,
  //   html,
  // });
}

export async function loginStart({
  identityPayload,
  config,
}: {
  identityPayload: any,
  config: Required<ConfigOptions>,
}): Promise<void> {
  // TODO Future: have path to more login flows, like FIDO
  const existingIdentity = await config.findUniqueIdentity(identityPayload);
  if (!existingIdentity) throw new Error('no existing identity');

  const loginFlow = 'email';

  switch (loginFlow) {
    case 'email': {
      const { email } = existingIdentity;
      if (!email) throw new Error('missing email');
      const tokenBody: { email: string, redirectURL?: string } = { email };
      // TODO: is this the best place to pass redirectURL?
      if (identityPayload.redirectURL) tokenBody.redirectURL = identityPayload.redirectURL;
      const token = jwt.sign(tokenBody, config.secret, { expiresIn: '15m' });
      sendLoginEmail({ config, toEmail: email, token });
      break;
    }
    default:
      throw new Error(`sign in flow not implemented: ${loginFlow}`);
  }
}

interface LoginSubmit {
  token: string;
  redirectURL?: string;
}

export async function loginSubmit({
  jwtString,
  config,
}: {
  jwtString: string,
  config: Required<ConfigOptions>,
}): Promise<LoginSubmit> {
  const jwtDecoded = jwt.verify(jwtString, config.secret);
  if (typeof jwtDecoded === 'string') throw new Error('unable to decode JWT');

  const existingIdentity = await config.findUniqueIdentity(jwtDecoded);
  if (!existingIdentity) throw new Error('no matching identity');

  const token = createJWTSessionToken({
    id: existingIdentity.id,
    secret: config.secret,
    expiresIn: config.sessionLifespan,
  });

  const { redirectURL } = jwtDecoded;

  return { token, redirectURL };
}

export async function whoami({
  jwtString,
  config,
}: {
  jwtString: string,
  config: Required<GetConfigOptions>,
}) {
  const jwtDecoded = jwt.verify(jwtString, config.secret);
  if (typeof jwtDecoded === 'string') throw new Error('unable to decode JWT');
  debug('blueauth')('whoami JWT decoded %o', jwtDecoded);

  // TODO: more strongly type JWTs
  const existingIdentity = await config.findUniqueIdentity(jwtDecoded);
  if (!existingIdentity) throw new Error('no matching identity');

  return existingIdentity;
}
