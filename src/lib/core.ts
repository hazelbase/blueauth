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
  signInAfterRegistration: false,
  sessionLifespan: '7d',
  refreshSession: true,
  smtpFromName: 'Authentication',
  smtpSubject: 'Sign In',
  cookieNamePrefix: 'blueauth',
  cookieOptions: {
    secure: !isNotProd,
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7,
    path: '/',
  },
  createSignInEmailStrings: ({ url, serviceName }) => ({
    text: emailTemplateText(url, serviceName),
    html: emailTemplateHTML(url, serviceName),
  }),
};

export function makeConfig(config: ConfigOptions) {
  const cookieOptions = { ...defaultConfigOptions.cookieOptions, ...config.cookieOptions };
  if (cookieOptions.domain === 'localhost') delete cookieOptions.domain;
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

export async function sendSignInEmail({
  config,
  toEmail,
  token,
}: {
  config: Config,
  toEmail: string,
  token: string,
}): Promise<Boolean> {
  // eslint-disable-next-line max-len
  // const urlUnencoded = `${config.authEndpoint}?query=query q1 { completeSignIn(token: "${token}") }`;
  const urlUnencoded = `${config.authEndpoint}?signInToken=${token}`;
  const url = encodeURI(urlUnencoded);
  const { text, html } = config.createSignInEmailStrings({ url, serviceName: config.serviceName });

  const mailOptions = {
    from: `"${config.smtpFromName}" <${config.smtpFromAddress}>`, // sender address
    to: toEmail,
    subject: config.smtpSubject,
    text,
    html,
  };
  const debugObject = {
    config,
    mailOptions,
  };
  debug('blueauth')('sendSignInEmail %j', debugObject);

  try {
    const transporter = nodemailer.createTransport(config.smtpURL);
    const info = await transporter.sendMail(mailOptions);
    debug('blueauth')('sendSignInEmail info %o', info);
    return true;
  } catch (error) {
    debug('blueauth')('sendSignInEmail error %o', error);
    return false;
  }
}

export async function signInStart({
  identityPayload,
  config,
  redirectURL,
}: {
  identityPayload: any,
  config: Config,
  redirectURL?: string,
}): Promise<void> {
  // TODO Future: have path to more sign in flows, like FIDO
  const existingIdentity = await config.findUniqueIdentity(identityPayload);
  if (!existingIdentity) throw new Error('no existing identity');

  const signInFlow = 'email';

  switch (signInFlow) {
    case 'email': {
      const { email } = existingIdentity;
      if (!email) throw new Error('missing email');
      const tokenBody: { email: string, redirectURL?: string } = { email, redirectURL };
      if (redirectURL) tokenBody.redirectURL = redirectURL;
      const token = jwt.sign(tokenBody, config.secret, { expiresIn: '15m' });
      await sendSignInEmail({ config, toEmail: email, token });
      break;
    }
    default:
      throw new Error(`sign in flow not implemented: ${signInFlow}`);
  }
}

interface SignInSubmit {
  token: string;
  redirectURL?: string;
}

export async function signInSubmit({
  jwtString,
  config,
}: {
  jwtString: string,
  config: Config,
}): Promise<SignInSubmit> {
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
