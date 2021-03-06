import path from 'path';
import favicon from 'serve-favicon';
import compress from 'compression';
import helmet from 'helmet';
import cors from 'cors';

import feathers, { HookContext as FeathersHookContext } from '@feathersjs/feathers';
import configuration from '@feathersjs/configuration';
import express from '@feathersjs/express';
import socketio from '@feathersjs/socketio';

import { Application } from './declarations';
import logger from './logger';
import middleware from './middleware';
import services from './services';
import appHooks from './app.hooks';
import channels from './channels';

import authentication from './authentication';
import { health } from 'feathers-alive-ready';
import { setupSaaSFeathersServiceClient } from './clients/saasClient';
import { setupMikroOrm } from './setupMikroOrm';

export type HookContext<T = any> = { app: Application } & FeathersHookContext<T>;

export default async function generateApp (): Promise<Application> {
  const app: Application = express(feathers());

  // add health check endpoint
  app.configure(health({
    aliveUrl: '/health/alive'
  }));

  // Load app configuration
  app.configure(configuration());
  // Enable security, CORS, compression, favicon and body parsing
  app.use(helmet({
    contentSecurityPolicy: false
  }));
  app.use(cors());
  app.use(compress());
  app.use(express.json({ limit: '100mb' }));
  app.use(express.urlencoded());
  app.use(favicon(path.join(app.get('public'), 'favicon.ico')));
  // Host the public folder
  app.use('/', express.static(app.get('public')));

  // Set up Plugins and providers
  app.configure(express.rest());
  app.configure(socketio());

  // Configure other middleware (see `middleware/index.ts`)
  app.configure(middleware);
  app.configure(authentication);

  // set up mikro-orm
  await setupMikroOrm(app);

  // Set up external feather service clients (see `/clients` directory)
  setupSaaSFeathersServiceClient(app);

  // Set up our services (see `services/index.ts`)
  app.configure(services);

  // Set up event channels (see channels.ts)
  app.configure(channels);

  // Configure a middleware for 404s and the error handler
  app.use(express.notFound());
  app.use(express.errorHandler({ logger } as any));

  app.hooks(appHooks);

  return app;
}
