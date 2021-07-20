import jwt from 'jsonwebtoken';
import debug from 'debug';
import nodemailer from 'nodemailer';
import type {
  DefaultConfigOptions,
  ConfigOptions,
  GetConfigOptions,
  Config,
} from '../types';
import { emailTemplateText, emailTemplateHTML } from './emailTemplate';

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
  createLoginEmailStrings: ({ url, serviceName }) => ({
    text: emailTemplateText(url, serviceName),
    html: emailTemplateHTML(url, serviceName),
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
  config: Config,
  toEmail: string,
  token: string,
}): Promise<Boolean> {
  // eslint-disable-next-line max-len
  // const urlUnencoded = `${config.authEndpoint}?query=query q1 { completeLogin(token: "${token}") }`;
  const urlUnencoded = `${config.authEndpoint}?loginToken=${token}`;
  const url = encodeURI(urlUnencoded);
  const { text, html } = config.createLoginEmailStrings({ url, serviceName: config.serviceName });

  const debugObject = {
    text,
    html,
    config,
    toEmail,
  };
  debug('blueauth')('sendLoginEmail %j', debugObject);

  try {
    const transporter = nodemailer.createTransport(config.smtpURL);
    const info = await transporter.sendMail({
      from: `"${config.smtpFromName}" <${config.smtpFromAddress}>`, // sender address
      to: toEmail,
      subject: config.smtpSubject,
      text,
      html,
    });
    debug('blueauth')('sendLoginEmail info %o', info);
    return true;
  } catch (error) {
    debug('blueauth')('sendLoginEmail error %o', error);
    return false;
  }
}

export async function loginStart({
  identityPayload,
  config,
  redirectURL,
}: {
  identityPayload: any,
  config: Config,
  redirectURL?: string,
}): Promise<void> {
  // TODO Future: have path to more login flows, like FIDO
  const existingIdentity = await config.findUniqueIdentity(identityPayload);
  if (!existingIdentity) throw new Error('no existing identity');

  const loginFlow = 'email';

  switch (loginFlow) {
    case 'email': {
      const { email } = existingIdentity;
      if (!email) throw new Error('missing email');
      const tokenBody: { email: string, redirectURL?: string } = { email, redirectURL };
      if (redirectURL) tokenBody.redirectURL = redirectURL;
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
  config: Config,
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
  config: GetConfigOptions,
}) {
  const jwtDecoded = jwt.verify(jwtString, config.secret);
  if (typeof jwtDecoded === 'string') throw new Error('unable to decode JWT');
  debug('blueauth')('whoami JWT decoded %o', jwtDecoded);

  // TODO: more strongly type JWTs
  const existingIdentity = await config.findUniqueIdentity(jwtDecoded);
  if (!existingIdentity) throw new Error('no matching identity');

  return existingIdentity;
}
