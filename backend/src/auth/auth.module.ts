import { Module } from '@nestjs/common';
import { Auth0TokenVerifier } from './auth0-token-verifier';

@Module({ providers: [Auth0TokenVerifier], exports: [Auth0TokenVerifier] })
export class AuthModule {}
