import { sendLoginEmail } from './core';

const { config } = global.testHelpers;

describe('sendLoginEmail', () => {
  it('returns true', async () => {
    const result = await sendLoginEmail({ config, toEmail: 'fake@test.com', token: 'someString' });
    expect(result).toBe(true);
  });
});
