<p align="center">
   <br/>
   <a href="https://blueauth.io" target="_blank"><img width="150px" src="https://cdn.kacdn.org/file/kacdn1/blueauth/logo.png" /></a>
   <h3 align="center">BlueAuth</h3>
   <p align="center">Simple and secure passwordless authentication.</p>
   <p align="center">One-line use in serverless, middleware, express, next.js, and more.</p>
</p>

<details open="open">
<summary>Table of Contents</summary>

- [Installation](#installation)
- [Features](#features)
- [Quick Start](#quick-start)
- [Documentation](#documentation)
- [Examples](#examples)
- [Status](#status)
- [Contributing](#contributing)

</details>

# Installation
```
npm install --save blueauth
```

# Features
- Get secure user authentication with just 1 line of code and a single configuration object. Done in minutes.
- No third parties at all. Just you and your users. Complete control and security of your data.
- No sensitive information to store, and no passwords to manage.
- Stateless. No databases or connections required.
- Run in express, next.js, aws lambda, or anywhere. More pre-built adapters coming soon.
- Secure by default. Restrictive cookie policy, small surface area, and more.
- Coded in typescript, complete with exposed type definitions and inline IDE documentation
- Under 1k lines of code
- Batteries included. Just add your desired settings, and BlueAuth handles everything else.

# Quick Start
Quick example using Next.js.
(Express and Lambda examples are below)

First create an API endpoint. We'll create one accessible at `/api/blueauth`:
```javascript
// pages/api/blueauth.js

import { handler as blueauthHandler } from 'blueauth/nextjs';

// In this example our users are in this array,
// but in the real world you likely have them stored
// in an API service or DB
const users = [
  { id: '123', email: 'jack@example.com' },
  { id: '456', email: 'jill@example.com' },
];

// Now we will export the BlueAuth handler and pass it
// a single configuration object which has a secret key,
// SMTP email information, and two functions;
// findUniqueIdentity to retrieve a user, and
// createIdentity to create a user
export const handler = blueauthHandler({
  secret: 'mySecretForSigning',
  authEndpoint: 'https://myapp.com/api/blueauth', // used for links in emails
  smtpURL: 'smtps://postmaster:pmPassword@smtp.sendgrid.org/', // for sending emails
  smtpFromAddress: 'no-reply@myapp.com',
  findUniqueIdentity: async (payload) => {
    // This is the function used to try to find a given user / identity.
    // The payload here is what you sent to the API, which you will see below.
    // return a single found user / identity, or falsey if none found

    console.log('> looking for a user that matches', payload);

    const user = users.find((user) => (user.email === payload.email || user.id === payload.id));
    // Another example where we are getting users from an API;
    // const user = await fetch('https://secure-api.example-b.com/findUser', { method: 'post', body: JSON.stringify(payload) });

    if (user) {
      console.log('> found an existing user!', user);
      return user;
    } else {
      console.log('> could not find a matching user');
      return null;
    }
  },
  createIdentity: async (payload) => {
    // This is called when a registration is started via the API.

    console.log('> Creating a user with the following info', payload);

    const newId = '789';
    const newUser = { id: newId, ...payload };
    users.push(newUser);
    // const newUser = await fetch('https://secure-api.example-b.com/createUser', { method: 'post', body: JSON.stringify(payload) });
    return newUser;
  },
});
```
You now have an authentication (GraphQL) API service at `/api/blueauth`.

To make it  simple to use, you can use the pre-built javascript client [blueauth-client](https://github.com/hazelbase/blueauth-client). Here's an example:
```javascript
// pages/sign-in.jsx
import React, { useState } from 'react';
import blueauth from 'blueauth-client';

export default function Page() {
  const [email, setEmail] = useState('example@example.com');

  const handleRegister = async () => {
    // This will hit the createIdentity, with the results returned here.
    // By default this does not sign them in.
    // Can enable auto sign in the config options, or implement own logic.
    const { result } = await blueauth().register({ identity: { email } });
    console.log('> new user', result); // whatever is returned from createIdentity
  };

  const handleSignIn = async () => {
    // This will hit the findUniqueIdentity to find a user
    // If it returns a user, an email will be sent with a sign in link
    //   (to the user's email attribute)
    // after clicking the sign in link in the email, they will be sent to redirectURL (default of '/')
    const { result } = await blueauth().startEmailSignIn({
       identity: { email },
       redirectURL: '/dashboard'
    });
    console.log('> is sign in started:', result); // true or false
  };

  const handleRegisterOrSignIn = async () => {
    // This is a combination of register + start sign in.
    //
    // The back end library will first try to find a user with findUniqueIdentity
    // If it finds a user, it will send a sign in email
    // If it does not find a user, it will create one using createIdentity, then send a sign in email
    //   (or if signInAfterRegistration is set to true, a new user will be auto signed in)
    const { result } = await blueauth().registerOrStartEmailSignIn({
      identity: { email },
      redirectURL: '/dashboard'
    });
    // result is SIGN_IN_STARTED (or SIGN_IN_COMPLETED for new user auto sign in)
    console.log('> is new user or is sign in started?', result);
  };

  const handleWhoami = async () => {
    // This does an API call that uses the id stored in the secure cookie
    // and passes it to findUniqueIdentity to find the corresponding user.
    // in other words, in findUniqueIdentity payload is { id: 'someIdHere' }
    const { whoami } = await blueauth().getSelf();
    console.log('> you are', whoami); // whatever is returned from findUniqueIdentity
  };

  const handleSignOut = async () => {
    // This does an API call that deletes the cookie that stores the session information
    const { result } = await blueauth().signOut();
    console.log('> is signed out', result); // true
  };

  return (
    <div>
      <h1>sign in</h1>
      <input
        placeholder="your@email.com"
        type="email"
        onChange={(event) => setEmail(event.target.value)}
      />
      <button onClick={handleRegister}>Register</button>
      <button onClick={handleSignIn}>sign in</button>
      <button onClick={handleRegisterOrSignIn}>Start Register or Sign In</button>
      <button onClick={handleWhoami}>Who Am I?</button>
      <button onClick={handleSignOut}>Sign Out</button>
    </div>
  );
}
```
There is also [blueauth-react](https://github.com/hazelbase/blueauth-react) that adds more features, such as tab syncing, server side rendering, a React provider, and more.

On the server side you can get the authenticated user with `getIdentity`.
```javascript
// pages/api/secureEndpoint.js
import { getIdentity } from 'blueauth/nextjs';

const users = [
  // just another example stub for users
];

// can use the same config object from before,
// but only the secret and findUniqueIdentity are needed
const config = {
  secret: 'mySecretForSigning',
  findUniqueIdentity: (identityPayload) => {
    return users.find((user) => (user.email === payload.email || user.id === payload.id));
  },
};

export default async function handler(req, res) {
  // getIdentity grabs the secure cookie from the request, validates it,
  // and passes the cookie's payload to findUniqueIdentity to return a user
  const user = await getIdentity(config)({ req });

  if (!user) return res.status(400).json({ error: 'must be signed in!' });
  
  console.log('> user is', user);
  return res.status(200).json({
    userStuff: 'really secret',
    favoriteColor: user.favoriteColor
  });
}

```

In next.js you can use `getIdentity` in server side rendering on the pages.

Here's an example of a page that grabs the user in SSR, redirects users to sign in if not already, and has an example button that does an authenticated API request:
```javascript
// pages/dashboard.jsx
import { getIdentity } from 'blueauth/nextjs';

export default function Page({ user }) {
  const handleUserClick = async () => {
    // credentials must be include to send the auth cookies along with the request
    const result = await fetch('/api/secureEndpoint', { credentials: 'include' });
    // (Don't forget to use getIdentity on the server side to retrive this request's user!)
    const jsonResults = await result.json();
    console.log('> your results are', { jsonResults });
  };

  return (
    <div>
      <p>Hi! Your email is {user.email}!</p>
      <button onClick={handleUserClick}>Click to do a request</button>
    </div>
  );
}

export const getServerSideProps = async (context) => {
  const config = { /* your config */ };
  const user = await getIdentity(config)(context);

  if (!user) return { redirect: { destination: '/sign-in' } };
  return { props: { user } };
};
```
[blueauth-react](https://github.com/hazelbase/blueauth-react) can provide an identityContext to persist the identity across the app.

# Documentation
## Configuration
All settings and configuration is done by passing a single configuration object.
Configuration object properties:
Name| Default | Type | Description
------- | ------------- | ------------- | ----------
secret |  | string | **(required)** Key to encrypt, decrypt, and sign data. Keep it secure. Changing will sign out all users.
findUniqueIdentity |  | function | **(required)** The function that takes a payload and returns a corresponding identity/user or falsely
createIdentity |  | function | **(required)** The function that takes a payload and creates a corresponding identity/user
authEndpoint | | string | **(required)** The full URL to where the blueauth endpoint is. Primarily used for the links in sign in emails
smtpURL |  | string | **(required)** The SMTP URL for sending emails
smtpFromAddress |  | string | **(required)** The from email address for emails
smtpFromName | Authentication | string | The from name in emails
smtpSubject | Sign In | string | The subject for the sign in email
cookieNamePrefix | blueauth | string | The prefix for the cookie used by blueauth
cookieOptions |  | object | The options for the auth cookie. Is merged with the default cookie options, with these settings taking priority, and passed to the underlying cookie library. [Option documentation here](https://github.com/jshttp/cookie#options-1)
signInAfterRegistration | false | boolean | Automatically sign in users upon registration
refreshSession | false | boolean | Refresh/extend a user's session upon whoami checks. Otherwise they will have to re-sign in when their original sign in expires.
sessionLifespan | 7 days | string or number | Set how long a user is signed in before having to re-sign in. Can be a string (like '7d' or '24h'), or a number in milliseconds.
serviceName | null | string | The user facing service name. Used in the default email template.
createSignInEmailStrings |  | function | A function to create your own emails to send. Details below.

### createSignInEmailStrings
If you want to define the body of the emails sent instead of using the default email templates, define this function in the config object.
The function receives an object with the `url` key that is the URL the user must visit to be signed in and redirected.
The function must return an object with a (required) `text` and (optional) `html` key for text and html emails.
Example:
```javascript
  const createSignInEmailStrings = ({ url }) => {
    return {
      text: `Please visit ${url} in your browser to sign in`,
      html: `Please click <a href="${url}">HERE</a> to sign in`,
    };
  };

```

## Library API
There are two primary functions exported from the library for every platform adapter: `handler` and `getIdentity`.

### handler
Is first passed a config object as defined above.
It can then can be passed the relevant request and response objects (where applicable) in the platform, and delivers the proper response.
The API of the `handler` varies between platforms (taking a request / response pair, a lambda event, etc.).
> Under the hood, the handler simply transfers each of the various types of requests and responses into a common format to pass to the underlying library logic, and formats the response correctly for the platform

### getIdentity
Is first passed a config object. Can pass the same config object that you pass to `handler`, but since only `secret` and `findUniqueIdentity` are required you can easily define a simple config anywhere.
It can then be passed the relevant platform "request" object (or "event", etc.) and return a user.
> Under the hood, for each platform getIdentity is simply getting the relevant cookie and passing it to the underlying library logic.

## Exposed HTTP API
Everything is handled at a single URL endpoint, which is of course determined by where you mount the library according the the platform you are using.

There are 6 functionalities exposed by the API:
- register a new identity
- start a sign in flow
- complete a sign in flow
- register and/or start a sign in flow
- who am I check
- sign out

The "complete a sign in" flow is simply a GET request against the endpoint with a `signInToken` query parameter (which set to a secure token).
This is typically used by the "sending a sign in email" functionality, which includes the endpoint with the `signInToken` query parameter as a link.
The successful response to this request sets the auth cookie and redirects the user.

The remaining 5 functions are available through the endpoint as GraphQL queries. If you are unfamiliar with GraphQL, you can use the [blueauth-client](https://github.com/hazelbase/blueauth-client) which wraps up all the API calls in a simple javascript library.

The GraphQL schema for these queries:
```
  scalar JSON

  enum ActionResult {
    SIGN_IN_STARTED
    SIGN_IN_COMPLETED
  }

  type Query {
    whoami: JSON
  }

  type Mutation {
    registerOrStartEmailSignIn(identity: JSON!, redirectURL: String): ActionResult!
    startEmailSignIn(identity: JSON!, redirectURL: String): Boolean!
    register(identity: JSON!): JSON!
    signOut: Boolean!
  }

```

# Examples
Please go through the next.js [Quick Start](#quick-start) first the get a quick walkthrough as the first example.

## Next.js
[Quick Start](#quick-start)


## Express
```javascript
import express from 'express';
import { getIdentity, handler } from 'blueauth/express';

const app = express();

const config = { /* your config */ };

app.use('/api/blueauth', handler(config));

app.get('/api/secureEndpoint', async (req, res) => {
  const user = await getIdentity(config)({ req });

  if (!user) return res.status(400).json({ error: 'must be signed in!' });

  return res.status(200).json({
    userStuff: 'really secret',
    favoriteColor: user.favoriteColor,
  });
});

app.listen(8080);

```

## Lambda
```javascript
import { handler } from 'blueauth/lambda';
const config = { /* your config */ };
export default async (event) => handler(config)(event);
```
# Status
- BlueAuth is being actively developed (and maintained).
- The project is still maturing and as such there may be upgrades to the API or changes.
- BlueAuth is being used in production ([are you one of them?](#use-blueauth)).
- Aiming for a `1.0` release by September.

# Contributing
**Help build a simple and secure authentication future!**

Contributions are very much desired!
Official `CONTRIBUTING.md` coming soon.
Use `npx cz` to use the commitizen CLI to create your commits according to project format.
Maintained by [Adrian Artiles](https://twitter.com/AdrianArtiles) and [key.dev](https://key.dev).


## Use BlueAuth?
**Promote your project!**

Get in touch with [Adrian](https://twitter.com/AdrianArtiles) or [hey@key.dev](mailto:hey@key.dev)
Building a showcase to promote secure projects using BlueAuth. All welcomed!
