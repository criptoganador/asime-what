import { verifyRegistrationResponse, verifyAuthenticationResponse, generateAuthenticationOptions } from '@simplewebauthn/server';

const x: Parameters<typeof verifyAuthenticationResponse>[0] = {
  response: {} as any,
  expectedChallenge: '',
  expectedOrigin: '',
  expectedRPID: '',
  credential: {
    id: '',
    publicKey: new Uint8Array(),
    counter: 0,
  }
};

const y: Parameters<typeof generateAuthenticationOptions>[0] = {
  rpID: '',
  allowCredentials: [{ id: '', type: 'public-key' }]
};
